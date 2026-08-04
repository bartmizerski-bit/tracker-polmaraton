// Service worker — odpowiada za działanie apki offline.
// Wersja cache'a: podbij ten numer przy każdej większej zmianie plików,
// żeby przeglądarka pobrała świeżą wersję zamiast starej z pamięci.
const CACHE_NAME = "pol-na-full-v1";

// Pliki "powłoki" apki — muszą działać nawet bez internetu.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Instalacja: pobierz i zapisz powłokę apki w cache'u.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Aktywacja: usuń stare wersje cache'a z poprzednich wdrożeń.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Obsługa zapytań: najpierw cache, dopiero potem sieć (offline-first).
// Nowo pobrane pliki dokładane są do cache'a na bieżąco.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
