// Cache public inference dependencies only. This does NOT guarantee an offline
// page reload. Private preview pages, scripts, images, and their credentials
// remain entirely under normal browser handling: no shell interception/prefetch.
// Photos and generated cards are never stored by this service worker.
const CACHE_PREFIX = 'look-again-';
const LEGACY_SHELL_PREFIX = `${CACHE_PREFIX}shell-`;
const MODEL_CACHE = `${CACHE_PREFIX}public-v1-siglip-tjs-3.8.1`;
const LIBRARY_PATH = '/npm/@huggingface/transformers@3.8.1';
const MODEL_PATH = '/Xenova/siglip-base-patch16-224/resolve/';
const MODEL_DOWNLOAD_HOSTS = new Set([
  'cdn-lfs.huggingface.co',
  'cdn-lfs.hf.co',
  'cdn-lfs-us-1.hf.co',
  'cdn-lfs-eu-1.hf.co',
  'cas-bridge.xethub.hf.co',
]);

function publicKind(url) {
  if (url.username || url.password || url.hash) return null;
  if (url.origin === self.location.origin) return null;
  if (url.protocol !== 'https:') return null;
  if (url.hostname === 'cdn.jsdelivr.net' && !url.search
    && (url.pathname === LIBRARY_PATH || url.pathname.startsWith(`${LIBRARY_PATH}/`))) {
    return 'public';
  }
  if (url.hostname === 'huggingface.co' && url.pathname.startsWith(MODEL_PATH)) {
    // Public download flag is allowed; token/auth or arbitrary queries are not.
    if ([...url.searchParams].every(([key, value]) => key === 'download' && value === 'true')) {
      return 'public';
    }
  }
  return null;
}

function safeResponse(response) {
  if (!response || !response.ok || response.status !== 200
    || !['basic', 'cors', 'default'].includes(response.type)) return false;
  const control = response.headers.get('cache-control') || '';
  const vary = response.headers.get('vary') || '';
  if (/\b(private|no-store|no-cache)\b/i.test(control)
    || /(^|,)\s*(\*|cookie|authorization)\s*(,|$)/i.test(vary)
    || response.headers.has('set-cookie')) return false;
  if (!response.url) return false;
  const finalURL = new URL(response.url);
  // Redirected Hugging Face artifacts are cached under the original, public
  // model URL. Signed CDN URLs themselves are never intercepted/cache keys.
  return publicKind(finalURL) === 'public'
    || (finalURL.protocol === 'https:' && MODEL_DOWNLOAD_HOSTS.has(finalURL.hostname));
}

async function readCache(cacheName, request) {
  try {
    return await (await caches.open(cacheName)).match(request);
  } catch {
    return undefined;
  }
}

async function writeCache(cacheName, request, response) {
  if (!safeResponse(response)) return;
  try {
    await (await caches.open(cacheName)).put(request, response.clone());
  } catch {
    // Quota, private mode, Vary, or storage failures must not break inference.
  }
}

function anonymousRequest(url) {
  return new Request(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'default',
    redirect: 'follow',
  });
}

self.addEventListener('install', (event) => {
  // No install-time network requests, especially to owner-private shell files.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      // Remove the old shell-v1 cache without deleting downloaded model files
      // or any other application's / Transformers.js's cache.
      await Promise.all(keys.filter((key) => key.startsWith(LEGACY_SHELL_PREFIX))
        .map((key) => caches.delete(key)));
    } catch { /* Cache availability does not determine whether the app works. */ }
    await self.clients.claim();
  })());
});

async function serve(event, url) {
  const request = anonymousRequest(url.href);
  const cached = await readCache(MODEL_CACHE, request);
  // Model/runtime files are large; reuse a successful cached public response.
  if (cached) return cached;
  try {
    const response = await fetch(request);
    event.waitUntil(writeCache(MODEL_CACHE, request, response));
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('authorization')
    || request.headers.has('cookie') || request.headers.has('range')) return;
  const url = new URL(request.url);
  const kind = publicKind(url);
  if (!kind) return;
  // Cross-origin "same-origin" requests carry no cookies. Explicit credentialed
  // requests are left untouched; allowed public downloads use credentials:omit.
  if (request.credentials === 'include') return;
  event.respondWith(serve(event, url));
});
