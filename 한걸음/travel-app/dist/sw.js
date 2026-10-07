const CACHE = 'hangeoreum-regions-v103';
const SHELL = ['./','./index.html','./styles.css','./mascot.css','./diary.css','./design-system.css','./assets/fonts/PretendardVariable.woff2','./assets/fonts/Cafe24Dongdong.woff2','./assets/photos/mokpo-history-1.jpg','./assets/photos/yudalsan-panorama.jpg','./place-media.js','./gangneung-media.js','./gyeongju-media.js','./assets/photos/gyeongju-cheomseongdae.jpg','./assets/photos/gyeongju-donggung-wolji.jpg','./assets/photos/gyeongju-bulguksa.jpg','./assets/photos/gyeongju-yangnam-joint.jpg','./assets/diary/travel-sketch.png','./assets/diary/reference-landscape.png','./assets/diary/flowers.svg','./assets/diary/route-doodles.svg','./assets/diary/custom-route.svg','./regions.js','./route-engine.js','./saved-walk-paths.js','./walk-paths.json','./saved-bus-legs.js','./bus-legs.json','./solo-travel.js','./place-booking.js','./app.js','./map-config.js','./places.json','./gangneung-places.json','./gyeongju-places.json','./gyeongju-routes.geojson','./gyeongju-six-theme-routes.geojson','./gyeongju-six-theme-routes.gpx','./gyeongju-theme-draft.geojson','./gyeongju-theme-candidates.geojson','./gyeongju-theme-routes.gpx','./lodgings.json','./gyeongju-lodgings.json','./mokpo-card.webp','./gangneung-card.png','./gyeongju-card.png','./assets/mascot/turtle-base-ui.png','./assets/mascot/turtle-map.png','./assets/mascot/turtle-walk.png','./assets/mascot/turtle-bus.png','./assets/mascot/turtle-discover.png','./assets/mascot/turtle-think.png','./assets/mascot/turtle-memo.png','./assets/mascot/turtle-rest.png','./manifest.webmanifest','./assets/brand/header-logo.png','./assets/brand/favicon-64.png','./assets/brand/apple-touch-icon.png','./icon-192.png','./icon-512.png','./vendor/leaflet.css','./vendor/leaflet.js'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); }
    return response;
  }).catch(() => caches.open(CACHE).then((cache) => cache.match(event.request, {ignoreSearch:true}))));
});
