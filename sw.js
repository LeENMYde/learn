/*
 * Offline-Speicher für die ganze Sammlung
 * ========================================
 * Seiten: erst aus dem Netz (damit Änderungen sofort ankommen), ohne Netz aus dem Speicher.
 * Bilder, Schriften, Skripte: sofort aus dem Speicher, im Hintergrund aufgefrischt.
 * Neue Seite? Unten in DATEIEN eintragen und STAND ändern.
 */
const STAND = '89d1c6ee90';
const SPEICHER = 'rechner-' + STAND;
const DATEIEN = [
  "./",
  "index.html",
  "assets/basis.js",
  "assets/katex/fonts/KaTeX_AMS-Regular.woff2",
  "assets/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "assets/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "assets/katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "assets/katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "assets/katex/fonts/KaTeX_Main-Bold.woff2",
  "assets/katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "assets/katex/fonts/KaTeX_Main-Italic.woff2",
  "assets/katex/fonts/KaTeX_Main-Regular.woff2",
  "assets/katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "assets/katex/fonts/KaTeX_Math-Italic.woff2",
  "assets/katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "assets/katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "assets/katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "assets/katex/fonts/KaTeX_Script-Regular.woff2",
  "assets/katex/fonts/KaTeX_Size1-Regular.woff2",
  "assets/katex/fonts/KaTeX_Size2-Regular.woff2",
  "assets/katex/fonts/KaTeX_Size3-Regular.woff2",
  "assets/katex/fonts/KaTeX_Size4-Regular.woff2",
  "assets/katex/fonts/KaTeX_Typewriter-Regular.woff2",
  "assets/katex/katex.min.css",
  "assets/katex/katex.min.js",
  "assets/rechner.css",
  "assets/rechner.js",
  "assets/stil.css",
  "assets/symbol-192.png",
  "assets/symbol-512.png",
  "assets/symbol-apple.png",
  "assets/symbol-maskable.png",
  "brandschutz/brandsimulation.html",
  "dach/dachrinne.html",
  "dach/gaubenwange.html",
  "dach/kehle-grat.html",
  "dach/schneefang.html",
  "dach/schornsteinverwahrung.html",
  "dach/sparren-lattung.html",
  "elektro/beleuchtung.html",
  "elektro/blitzschutz.html",
  "elektro/leitungsdimensionierung.html",
  "elektro/ohmsches-gesetz.html",
  "elektro/pv-dach.html",
  "elektro/pv-notstrom.html",
  "elektro/pv-string.html",
  "elektro/pv-verschattung.html",
  "elektro/schleifenimpedanz.html",
  "elektro/selektivitaet.html",
  "elektro/transformator.html",
  "elektro/wallbox.html",
  "elektro/warmwasser.html",
  "favicon.png",
  "heizung/ausdehnungsgefaess.html",
  "heizung/fussbodenheizung.html",
  "heizung/heizlast.html",
  "heizung/hydraulischer-abgleich.html",
  "heizung/waermepumpe.html",
  "manifest.webmanifest",
  "mechanik/kraefte.html",
  "projektmappe.html",
  "protokolle/elektro-pruefung.js",
  "protokolle/elektro.html",
  "protokolle/elektro.js",
  "protokolle/felder.js",
  "protokolle/it-pruefung.js",
  "protokolle/it-sicherheit.html",
  "protokolle/it-sicherheit.js",
  "protokolle/protokoll.css",
  "sanitaer/abwasser.html",
  "sanitaer/gasleitung.html",
  "sanitaer/trinkwasser-rohrnetz.html",
  "sanitaer/trinkwasserschutz.html"
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(SPEICHER).then(function (c) { return c.addAll(DATEIEN); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.filter(function (n) { return n.indexOf('rechner-') === 0 && n !== SPEICHER; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (ev) {
  const anfrage = ev.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  const seite = anfrage.mode === 'navigate' || (anfrage.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (seite) {
    ev.respondWith(fetch(anfrage).then(function (antwort) {
      const kopie = antwort.clone();
      caches.open(SPEICHER).then(function (c) { c.put(anfrage, kopie); });
      return antwort;
    }).catch(function () {
      return caches.match(anfrage, { ignoreSearch: true }).then(function (t) { return t || caches.match('index.html'); });
    }));
    return;
  }
  ev.respondWith(caches.match(anfrage).then(function (treffer) {
    const frisch = fetch(anfrage).then(function (antwort) {
      if (antwort.ok) { const kopie = antwort.clone(); caches.open(SPEICHER).then(function (c) { c.put(anfrage, kopie); }); }
      return antwort;
    }).catch(function () { return treffer; });
    return treffer || frisch;
  }));
});
