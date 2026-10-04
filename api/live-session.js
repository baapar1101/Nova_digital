const MAX_SDP_BYTES = 65_536

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return sendJson(response, 405, { error: 'Method not allowed.' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return sendJson(response, 503, {
      error:
        'GPT-Live is installed but OPENAI_API_KEY is not configured on the server.',
    })
  }

  const origin = request.headers.origin
  const host = request.headers.host
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return sendJson(response, 403, { error: 'Unexpected request origin.' })
      }
    } catch {
      return sendJson(response, 403, { error: 'Unexpected request origin.' })
    }
  }

  const sdp = request.body?.sdp
  if (
    typeof sdp !== 'string' ||
    !sdp.trim() ||
    Buffer.byteLength(sdp, 'utf8') > MAX_SDP_BYTES
  ) {
    return sendJson(response, 400, { error: 'A valid SDP offer is required.' })
  }

  const session = {
    model: 'gpt-live-1',
    instructions:
      'You are Nova, a compact friendly desktop robot. Speak naturally, warmly, and concisely. Keep routine answers to one or two short sentences. You can be interrupted at any time. Never claim that a physical robot action happened unless the application confirms it.',
    audio: {
      output: {
        voice: 'marin',
      },
    },
    store: false,
  }

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session,
        transport: {
          type: 'webrtc',
          sdp,
        },
      }),
    })

    const body = await openaiResponse.json().catch(() => null)

    if (!openaiResponse.ok) {
      console.error('GPT-Live session creation failed', {
        status: openaiResponse.status,
        error: body?.error?.message || body?.error || 'Unknown OpenAI error',
      })

      return sendJson(response, openaiResponse.status, {
        error:
          body?.error?.message ||
          'OpenAI could not create the GPT-Live session.',
      })
    }

    response.status(201).setHeader('Cache-Control', 'no-store')
    return response.json(body)
  } catch (error) {
    console.error('GPT-Live connection error', error)
    return sendJson(response, 502, {
      error: 'Could not reach the OpenAI GPT-Live service.',
    })
  }
}
