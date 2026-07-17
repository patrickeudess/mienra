// Service worker MIENRA — mode hors ligne (PWA).
// -------------------------------------------------------------------------
// Objectif : après une première visite EN LIGNE, l'application (sa coquille et
// ses fichiers CSS/JS/police) se charge et fonctionne SANS réseau.
//
// Règle de sécurité essentielle : les appels Supabase (données ET
// authentification) ne sont JAMAIS mis en cache. Ils vont toujours au réseau,
// pour que la synchronisation et la connexion restent correctes et à jour.
// Le service worker ne modifie donc rien à la logique de synchro : il ne fait
// que rendre la coquille de l'app disponible hors ligne.
//
// Cache-busting : les fichiers sont demandés avec des suffixes `?v=...`. On
// stocke et on relit sans tenir compte de la query (`ignoreSearch`), donc une
// seule entrée par fichier, toujours retrouvée quelle que soit la version.
//
// Mise à jour : le nom de cache est versionné (VERSION). Pour forcer un
// rafraîchissement propre après un déploiement, incrémenter le suffixe.

const VERSION = "mienra-cache-v7-20260717";

// Coquille complète, précachée dès l'installation (chemins « propres », sans
// query) : l'app est utilisable hors ligne dès la première visite en ligne.
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./fonts.css",
  "./styles.css",
  "./design-polish.css",
  "./dashboard-filters.css",
  "./responsive.css",
  "./production-tools.css",
  "./redesign.css",
  "./app-pro.js",
  "./relational-sync.js",
  "./server-receipts.js",
  "./production-tools.js",
  "./dashboard-role-fix.js",
  "./receipt-pdf-download.js",
  "./production-hardening.js",
  "./cloud-config.js",
  "./assets/vendor/supabase-js-2.110.7.min.js",
  "./assets/vendor/jspdf-2.5.1.umd.min.js",
  "./assets/mienra-logo.jpeg",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/fonts/inter-latin-400.woff2",
  "./assets/fonts/inter-latin-600.woff2",
  "./assets/fonts/inter-latin-700.woff2",
  "./assets/fonts/inter-latin-800.woff2",
  "./assets/fonts/inter-latin-ext-400.woff2",
  "./assets/fonts/inter-latin-ext-600.woff2",
  "./assets/fonts/inter-latin-ext-700.woff2",
  "./assets/fonts/inter-latin-ext-800.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // Tolérant : un fichier manquant ne fait pas échouer toute l'installation.
      Promise.allSettled(CORE.map((u) => cache.add(new Request(u, { cache: "reload" }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSupabase(url) {
  return url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Données / authentification Supabase : toujours le réseau, jamais le cache.
  if (isSupabase(url)) return;

  const sameOrigin = url.origin === self.location.origin;

  // Navigation (chargement de la page) : réseau d'abord, coquille en cache
  // comme secours hors ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }).then((r) => r || caches.match("./")))
    );
    return;
  }

  // Ressources (CSS/JS/police locale, SDK CDN) : « stale-while-revalidate ».
  // On sert le cache tout de suite (en ignorant `?v=`), et on met à jour en
  // arrière-plan quand le réseau est là.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
            const copy = res.clone();
            // Clé « propre » (sans query) pour garder une seule entrée par fichier.
            const key = sameOrigin ? url.origin + url.pathname : req;
            caches.open(VERSION).then((c) => c.put(key, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
