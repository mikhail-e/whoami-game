// Who am I? Game - Service Worker
// Hybrid PWA service worker with smart caching strategies

const CACHE_NAME = 'whoami-game-v1.3.1';
const CACHE_VERSION = Date.now(); // For cache busting critical files

// Static assets that benefit from cache-first strategy
const staticAssets = [
    '/',
    '/index.html',
    '/game.html',
    '/manifest.json',
    '/favicon.ico',
    '/icons/icon-48x48.svg',
    '/icons/icon-72x72.svg',
    '/icons/icon-96x96.svg',
    '/icons/icon-144x144.svg',
    '/icons/icon-192x192.svg',
    '/icons/icon-512x512.svg',
    // External resources - cache for performance
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'
];

// Dynamic assets that need network-first strategy for immediate updates
const dynamicAssets = [
    '/css/style.css',
    '/js/game.js',
    '/js/game-room.js',
    '/js/translations.js',
    '/js/pwa.js'
];

// Install event - cache static resources only
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static app shell resources');
                return cache.addAll(staticAssets);
            })
            .catch((error) => {
                console.error('Cache failed:', error);
            })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Helper function to check if URL is a dynamic asset
function isDynamicAsset(url) {
    return dynamicAssets.some(asset => url.includes(asset));
}

// Helper function to check if URL is a static asset
function isStaticAsset(url) {
    return staticAssets.some(asset => url.includes(asset.replace('/', '')));
}

// Helper function to check if request is cacheable (avoid browser extension errors)
function isCacheableRequest(request) {
    const url = new URL(request.url);

    // Skip non-HTTP(S) schemes (chrome-extension, moz-extension, etc.)
    if (!url.protocol.startsWith('http')) {
        return false;
    }

    // Skip if request is not from same origin and not a known external resource
    const isFromSameOrigin = url.origin === self.location.origin;
    const isKnownExternal = url.hostname.includes('cdn.jsdelivr.net');

    if (!isFromSameOrigin && !isKnownExternal) {
        return false;
    }

    // Skip requests with unusual schemes or protocols
    const unsupportedSchemes = ['chrome-extension', 'moz-extension', 'safari-extension', 'webkit-extension', 'file'];
    if (unsupportedSchemes.some(scheme => request.url.startsWith(scheme))) {
        return false;
    }

    return true;
}

// Network-first strategy for dynamic assets (immediate updates)
async function networkFirstStrategy(request) {
    try {
        console.log('Network-first for dynamic asset:', request.url);
        const response = await fetch(request);

        // Cache successful responses only if request is cacheable
        if (response && response.status === 200 && isCacheableRequest(request)) {
            try {
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, response.clone());
            } catch (cacheError) {
                console.warn('Failed to cache response:', request.url, cacheError);
            }
        }

        return response;
    } catch (error) {
        console.log('Network failed, trying cache:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Cache-first strategy for static assets (performance)
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        console.log('Serving static asset from cache:', request.url);
        return cachedResponse;
    }

    console.log('Fetching static asset from network:', request.url);
    const response = await fetch(request);

    // Cache successful responses only if request is cacheable
    if (response && response.status === 200 && isCacheableRequest(request)) {
        try {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        } catch (cacheError) {
            console.warn('Failed to cache response:', request.url, cacheError);
        }
    }

    return response;
}

// Fetch event - hybrid caching strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip non-cacheable requests (browser extensions, file://, etc.)
    if (!isCacheableRequest(event.request)) {
        console.log('Skipping non-cacheable request:', event.request.url);
        return;
    }

    // Skip socket.io requests - always go to network for real-time data
    if (event.request.url.includes('socket.io')) {
        return;
    }

    // Skip API requests - always go to network for real-time data
    if (event.request.url.includes('/api/')) {
        return;
    }

    const requestUrl = event.request.url;

    event.respondWith(
        (async () => {
            try {
                // Dynamic assets: Network-first for immediate updates
                if (isDynamicAsset(requestUrl)) {
                    return await networkFirstStrategy(event.request);
                }

                // Static assets: Cache-first for performance
                if (isStaticAsset(requestUrl)) {
                    return await cacheFirstStrategy(event.request);
                }

                // Default: Try cache first, then network
                const cachedResponse = await caches.match(event.request);
                if (cachedResponse) {
                    console.log('Serving from cache:', requestUrl);
                    return cachedResponse;
                }

                console.log('Fetching from network:', requestUrl);
                return await fetch(event.request);

            } catch (error) {
                console.error('Fetch failed:', error);

                // Return offline page for HTML requests
                if (event.request.headers.get('accept')?.includes('text/html')) {
                    const offlinePage = await caches.match('/index.html');
                    return offlinePage || new Response('Offline', { status: 503 });
                }

                throw error;
            }
        })()
    );
});

// Message handler for update checks from PWA manager
self.addEventListener('message', (event) => {
    if (event.data === 'CHECK_UPDATE') {
        console.log('Manual update check requested');
        self.skipWaiting();
    }
});

// Background sync (for future enhancement)
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    // Future: sync offline actions when connection restored
});

// Push notification handler (for future enhancement)
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    // Future: handle game invitations and notifications
});