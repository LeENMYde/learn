/*
 * Gemeinsame Helfer für alle Seiten der Sammlung
 * ==============================================
 * Im <head> einbinden (ohne defer, damit das Farbthema sofort sitzt):
 *   <script src="../assets/basis.js"></script>
 *
 * Auf der Seite:
 *   <div id="seitenkopf" data-wurzel="../"></div>   → Kopfzeile mit Marke, Navigation, Hell/Dunkel
 *   <div id="seitenfuss" data-wurzel="../"></div>   → Fußzeile
 *   <span data-tex="Q = m \cdot c \cdot \Delta T"></span>          → Formel (KaTeX, im Text)
 *   <div data-tex-block="W = \frac{Q}{3600}"></div>                  → Formel als eigene Zeile
 *
 * In Skripten:
 *   Formel.setze(element, 'U = R \\cdot I', true)
 *   Thema.farbe('--text')     → aktuelle Farbe aus stil.css (z. B. für Canvas)
 *   document.addEventListener('themawechsel', …)
 */
(function () {
  'use strict';

  // ---------- Farbthema ----------
  const SPEICHER = 'sammlung-thema';

  function gespeichertesThema() {
    try { return localStorage.getItem(SPEICHER); } catch (e) { return null; }
  }

  function aktuellesThema() {
    const gesetzt = document.documentElement.getAttribute('data-thema');
    if (gesetzt) return gesetzt;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dunkel' : 'hell';
  }

  function themaSetzen(thema, merken) {
    document.documentElement.setAttribute('data-thema', thema);
    if (merken) { try { localStorage.setItem(SPEICHER, thema); } catch (e) { /* privates Fenster */ } }
    document.dispatchEvent(new CustomEvent('themawechsel', { detail: thema }));
    schalterAktualisieren();
  }

  const vorher = gespeichertesThema();
  if (vorher === 'hell' || vorher === 'dunkel') document.documentElement.setAttribute('data-thema', vorher);

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const folgen = function () { if (!gespeichertesThema()) document.dispatchEvent(new CustomEvent('themawechsel', { detail: aktuellesThema() })); };
    if (mq.addEventListener) mq.addEventListener('change', folgen); else if (mq.addListener) mq.addListener(folgen);
  }

  window.Thema = {
    aktuell: aktuellesThema,
    setze: function (t) { themaSetzen(t, true); },
    // Wert einer CSS-Variablen aus stil.css, z. B. für Zeichnungen auf Canvas
    farbe: function (name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
  };

  const MOND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const SONNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function schalterAktualisieren() {
    document.querySelectorAll('.themenschalter').forEach(function (k) {
      const dunkel = aktuellesThema() === 'dunkel';
      k.innerHTML = dunkel ? SONNE : MOND;
      k.setAttribute('aria-label', dunkel ? 'Helles Design' : 'Dunkles Design');
      k.title = k.getAttribute('aria-label');
    });
  }


  // ---------- Formeln mit KaTeX ----------
  window.Formel = {
    setze: function (element, tex, block) {
      if (!window.katex) { element.textContent = tex; return; }
      try {
        window.katex.render(tex, element, {
          displayMode: !!block, throwOnError: false, strict: 'ignore', output: 'html',
          // \htmlClass{ergebnis}{…} erlaubt, damit Ergebnisse im Farbthema erscheinen
          trust: function (k) { return k.command === '\\htmlClass'; }
        });
      } catch (e) {
        element.textContent = tex;
      }
    },
    alle: function (wurzel) {
      (wurzel || document).querySelectorAll('[data-tex], [data-tex-block]').forEach(function (el) {
        const block = el.hasAttribute('data-tex-block');
        Formel.setze(el, el.getAttribute(block ? 'data-tex-block' : 'data-tex'), block);
      });
    },
    // Zahl für LaTeX: deutsches Komma ohne Zwischenraum, schmales Leerzeichen als Tausendertrenner
    zahl: function (text) {
      // erst das Komma, dann das Leerzeichen (sonst würde das Komma in \\, mit ersetzt)
      return String(text).replace(/,/g, '{,}').replace(/\u202F/g, '\\,').replace(/−/g, '-');
    }
  };


  // ---------- Kopf- und Fußzeile ----------
  function kopfBauen() {
    const ziel = document.getElementById('seitenkopf');
    if (!ziel) return;
    const wurzel = ziel.getAttribute('data-wurzel') || '';
    const hier = ziel.getAttribute('data-seite') || '';
    ziel.className = 'seite';
    ziel.innerHTML =
      '<header class="seitenkopf">' +
        '<a class="marke" href="' + wurzel + 'index.html"><span class="marke-zeichen" aria-hidden="true">∑</span>Formeln &amp; Rechner</a>' +
        '<nav aria-label="Hauptnavigation">' +
          '<a href="' + wurzel + 'index.html"' + (hier === 'start' ? ' aria-current="page"' : '') + '>Übersicht</a>' +
          '<a class="optional" href="' + wurzel + 'index.html#bereiche">Bereiche</a>' +
          '<button type="button" class="themenschalter"></button>' +
        '</nav>' +
      '</header>';
    ziel.querySelector('.themenschalter').addEventListener('click', function () {
      themaSetzen(aktuellesThema() === 'dunkel' ? 'hell' : 'dunkel', true);
    });
    schalterAktualisieren();
  }

  function fussBauen() {
    const ziel = document.getElementById('seitenfuss');
    if (!ziel) return;
    ziel.className = 'seite';
    ziel.innerHTML =
      '<footer class="seitenfuss">' +
        '<span>Läuft komplett offline, ohne externe Dateien.</span>' +
        '<span>Formelsatz mit KaTeX (MIT-Lizenz), lokal in assets/katex.</span>' +
      '</footer>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    kopfBauen();
    fussBauen();
    Formel.alle();
  });
})();
