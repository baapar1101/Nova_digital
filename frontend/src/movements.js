const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const frame = (at, pan, tilt) => ({ at, pan, tilt })

// The three mechanical demonstrations mirror the Rhino reference poses:
// normal at home, pan about the vertical bearing, and tilt about the
// horizontal geared axis. Values stay inside Nova's physical limits.
export const MOVEMENTS = [
  {
    id: 'normal',
    label: 'Normal',
    axis: 'normal',
    symbol: '•',
    range: 'PAN 0° · TILT 0°',
    description: 'Returns both axes to the centered home position.',
    action: 'Return to normal',
    duration: 1200,
    face: 'blinking',
    frames: [frame(0, 0, 0), frame(1, 0, 0)],
  },
  {
    id: 'pan',
    label: 'Pan',
    axis: 'pan',
    symbol: '↔',
    range: '−48°  ↔  +48°',
    description: 'Sweeps left and right around the vertical bearing.',
    action: 'Run pan sweep',
    duration: 5200,
    face: 'blinking',
    frames: [
      frame(0, 0, 0),
      frame(0.18, -48, 0),
      frame(0.38, 0, 0),
      frame(0.60, 48, 0),
      frame(0.82, 0, 0),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'tilt',
    label: 'Tilt',
    axis: 'tilt',
    symbol: '↕',
    range: '0°  ↕  38°',
    description: 'Nods on the horizontal pinion and segment gear.',
    action: 'Run tilt nod',
    duration: 4200,
    face: 'blinking',
    frames: [
      frame(0, 0, 0),
      frame(0.22, 0, 24),
      frame(0.42, 0, 38),
      frame(0.58, 0, 38),
      frame(0.78, 0, 14),
      frame(1, 0, 0),
    ],
  },
]

// Expression performances are timed to the source face videos. Each one
// starts and finishes at home so performances can be changed safely without
// leaving either geared axis in an unexpected pose.
export const ANIMATION_PERFORMANCES = [
  {
    id: 'expression-blinking',
    face: 'blinking',
    label: 'Blink',
    symbol: '◉',
    motion: 'Soft breathing',
    duration: 5080,
    frames: [
      frame(0, 0, 0),
      frame(0.2, -3, 3),
      frame(0.42, 3, 1),
      frame(0.64, -2, 4),
      frame(0.84, 2, 1),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-winking',
    face: 'winking',
    label: 'Wink',
    symbol: '✦',
    motion: 'Cheeky glance',
    duration: 3160,
    frames: [
      frame(0, 0, 0),
      frame(0.24, 18, 4),
      frame(0.5, 23, 10),
      frame(0.7, 16, 5),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-giggling',
    face: 'giggling',
    label: 'Giggle',
    symbol: '≈',
    motion: 'Playful sway',
    duration: 5520,
    frames: [
      frame(0, 0, 0),
      frame(0.16, -15, 8),
      frame(0.31, 16, 13),
      frame(0.46, -18, 7),
      frame(0.61, 17, 14),
      frame(0.77, -12, 6),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-drinking',
    face: 'drinking',
    label: 'Drink',
    symbol: '⌁',
    motion: 'Curious sip',
    duration: 10200,
    frames: [
      frame(0, 0, 0),
      frame(0.13, -12, 7),
      frame(0.29, -22, 22),
      frame(0.58, -22, 28),
      frame(0.73, -12, 17),
      frame(0.88, 5, 6),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-afraiding',
    face: 'afraiding',
    label: 'Afraid',
    symbol: '!',
    motion: 'Startled recoil',
    duration: 3160,
    frames: [
      frame(0, 0, 0),
      frame(0.13, 0, 30),
      frame(0.3, -17, 35),
      frame(0.47, 14, 31),
      frame(0.64, -9, 27),
      frame(0.82, 5, 15),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-tireding',
    face: 'tireding',
    label: 'Tired',
    symbol: '—',
    motion: 'Sleepy droop',
    duration: 4920,
    frames: [
      frame(0, 0, 0),
      frame(0.24, -6, 13),
      frame(0.52, -10, 31),
      frame(0.72, -8, 34),
      frame(0.88, -3, 18),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-loving',
    face: 'loving',
    label: 'Love',
    symbol: '♥',
    motion: 'Affectionate sway',
    duration: 6000,
    frames: [
      frame(0, 0, 0),
      frame(0.18, -20, 9),
      frame(0.36, 19, 13),
      frame(0.54, -15, 16),
      frame(0.72, 14, 10),
      frame(0.88, -5, 5),
      frame(1, 0, 0),
    ],
  },
  {
    id: 'expression-heart-eying',
    face: 'heart-eying',
    label: 'Heart eyes',
    symbol: '♡',
    motion: 'Joyful celebration',
    duration: 5840,
    frames: [
      frame(0, 0, 0),
      frame(0.14, -24, 8),
      frame(0.29, 24, 17),
      frame(0.44, -28, 11),
      frame(0.59, 27, 20),
      frame(0.75, -18, 13),
      frame(0.9, 9, 6),
      frame(1, 0, 0),
    ],
  },
]

export function getMovementById(id) {
  return MOVEMENTS.find((movement) => movement.id === id) || MOVEMENTS[0]
}

export function getMotionById(id) {
  return (
    MOVEMENTS.find((movement) => movement.id === id) ||
    ANIMATION_PERFORMANCES.find((movement) => movement.id === id) ||
    null
  )
}

function smootherStep(value) {
  const t = clamp(value, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function sampleMovement(movement, progress) {
  const t = clamp(progress, 0, 1)
  const frames = movement.frames

  if (t <= frames[0].at) {
    return { pan: frames[0].pan, tilt: frames[0].tilt }
  }

  for (let index = 1; index < frames.length; index += 1) {
    const next = frames[index]
    const previous = frames[index - 1]

    if (t <= next.at) {
      const span = next.at - previous.at || 1
      const local = smootherStep((t - previous.at) / span)

      return {
        pan: previous.pan + (next.pan - previous.pan) * local,
        tilt: previous.tilt + (next.tilt - previous.tilt) * local,
      }
    }
  }

  const last = frames[frames.length - 1]
  return { pan: last.pan, tilt: last.tilt }
}
