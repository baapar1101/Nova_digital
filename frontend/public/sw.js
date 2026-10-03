const CACHE_VERSION = 'nova-digital-v4'
const RUNTIME_CACHE = 'nova-runtime-v4'

const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/animations/blinking.mov',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (await cache.match(request)) || (await caches.match('/'))
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Media elements can use byte-range requests. Let the browser/network handle
  // those directly instead of returning an incompatible whole cached response.
  if (request.headers.has('range')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/models/') ||
    url.pathname.startsWith('/animations/') ||
    /\.(?:js|css|svg|png|glb|webp|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request))
  }
})
