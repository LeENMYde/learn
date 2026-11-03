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
    const haupt = document.querySelector('main');
    if (haupt && !haupt.id) haupt.id = 'inhalt';
    ziel.className = 'seite';
    ziel.innerHTML =
      '<a class="sprung" href="#' + (haupt ? haupt.id : 'inhalt') + '">Zum Inhalt</a>' +
      '<header class="seitenkopf">' +
        '<a class="marke" href="' + wurzel + 'index.html"><span class="marke-zeichen" aria-hidden="true">∑</span>Formeln &amp; Rechner</a>' +
        '<nav aria-label="Hauptnavigation">' +
          '<a href="' + wurzel + 'index.html"' + (hier === 'start' ? ' aria-current="page"' : '') + '>Übersicht</a>' +
          '<a class="optional" href="' + wurzel + 'index.html#bereiche">Bereiche</a>' +
          '<button type="button" class="installieren" hidden>App installieren</button>' +
          '<button type="button" class="themenschalter"></button>' +
        '</nav>' +
      '</header>';
    ziel.querySelector('.themenschalter').addEventListener('click', function () {
      themaSetzen(aktuellesThema() === 'dunkel' ? 'hell' : 'dunkel', true);
    });
    schalterAktualisieren();
    const inst = ziel.querySelector('.installieren');
    if (installAngebot) inst.hidden = false;
    inst.addEventListener('click', function () {
      if (!installAngebot) return;
      installAngebot.prompt();
      installAngebot.userChoice.then(function () { installAngebot = null; inst.hidden = true; });
    });
  }

  // ---------- Als App installieren und offline nutzen ----------
  let installAngebot = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    installAngebot = ev;
    document.querySelectorAll('.installieren').forEach(function (k) { k.hidden = false; });
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      const kopf = document.getElementById('seitenkopf');
      const wurzel = (kopf && kopf.getAttribute('data-wurzel')) || '';
      navigator.serviceWorker.register(wurzel + 'sw.js').catch(function () { /* ohne Offline-Speicher geht es auch */ });
    });
  }

  function fussBauen() {
    const ziel = document.getElementById('seitenfuss');
    if (!ziel) return;
    ziel.className = 'seite';
    ziel.innerHTML =
      '<footer class="seitenfuss">' +
        '<p class="haftung"><strong>Ohne Gewähr.</strong> Formeln, Tabellenwerte und Ergebnisse sind sorgfältig erstellt, können aber Fehler enthalten. ' +
        'Ergebnisse vor der Ausführung prüfen; maßgeblich sind die gültigen Normen, Herstellerangaben und die Fachplanung. ' +
        'Etwas passt nicht? Bitte melden an <a href="mailto:support@pr1m3.de?subject=' + encodeURIComponent('Hinweis zu: ' + document.title) + '">support@pr1m3.de</a>.</p>' +
        '<span>Läuft komplett offline, ohne externe Dateien' + (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator ? ', einmal geladen auch ohne Netz' : '') + '.</span>' +
        '<span>Formelsatz mit KaTeX (MIT-Lizenz), lokal in assets/katex.</span>' +
      '</footer>';
  }

  // ---------- Eingaben merken und als Link teilen ----------
  // Auf Seiten mit <main data-merken>: eingetragene Werte, Einheiten und gewählte Modi
  // bleiben im Browser und lassen sich als Link weitergeben (?werte=…).
  const merkSchluessel = 'eingaben:' + location.pathname.replace(/\/index\.html$/, '/');
  function steuerelemente(haupt) {
    return Array.prototype.slice.call(haupt.querySelectorAll('input, select, textarea')).filter(function (el) {
      return el.type !== 'file' && el.type !== 'button' && el.type !== 'submit' && !el.closest('[data-nicht-merken]') && !el.closest('.nicht-merken');
    });
  }
  function schluessel(el, i) { return el.id ? '#' + el.id : el.name ? '@' + el.name : i; }
  function zustandLesen(haupt) {
    const z = { modi: [], werte: {} };
    haupt.querySelectorAll('button[aria-pressed="true"]').forEach(function (k) {
      const t = k.textContent.trim().replace(/\s+/g, ' ');
      if (t && t.length < 80) z.modi.push(t);
    });
    steuerelemente(haupt).forEach(function (el, i) {
      const feld = el.closest('.feld');
      let w;
      if (el.type === 'checkbox' || el.type === 'radio') w = el.checked;
      else if (feld && el.tagName === 'INPUT' && el.type !== 'range') w = feld.classList.contains('gegeben') ? el.value : '';
      else w = el.value;
      z.werte[schluessel(el, i)] = w;
    });
    return z;
  }
  function zustandSetzen(haupt, z) {
    if (!z || !z.werte) return;
    // 1. Modi (Knöpfe) wie gespeichert drücken
    (z.modi || []).forEach(function (t) {
      const k = Array.prototype.slice.call(haupt.querySelectorAll('button[aria-pressed]')).filter(function (b) { return b.textContent.trim().replace(/\s+/g, ' ') === t; })[0];
      if (k && k.getAttribute('aria-pressed') !== 'true') k.click();
    });
    // 2. Auswahlfelder und Haken, dann 3. Zahlen (Einheit zuerst, damit die Zahl richtig gelesen wird)
    [function (el) { return el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio'; },
     function (el) { return !(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio'); }].forEach(function (passt) {
      steuerelemente(haupt).forEach(function (el, i) {
        if (!passt(el)) return;
        const k = schluessel(el, i);
        if (!(k in z.werte)) return;
        const w = z.werte[k];
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked === !!w) return;
          el.checked = !!w;
        } else {
          const feld = el.closest('.feld');
          const jetzt = feld && el.tagName === 'INPUT' && el.type !== 'range' ? (feld.classList.contains('gegeben') ? el.value : '') : el.value;
          if (jetzt === w) return;
          el.value = w;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }
  function linkWerte() {
    const m = /[?&]werte=([^&#]+)/.exec(location.search);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; }
  }
  function merkenEinrichten() {
    const haupt = document.querySelector('main[data-merken]');
    if (!haupt) return;
    let uhr = 0, bereit = false;
    const sichern = function () {
      if (!bereit) return;
      clearTimeout(uhr);
      uhr = setTimeout(function () { try { localStorage.setItem(merkSchluessel, JSON.stringify(zustandLesen(haupt))); } catch (e) { /* ohne Speicher */ } }, 400);
    };
    haupt.addEventListener('input', sichern, true);
    haupt.addEventListener('change', sichern, true);
    haupt.addEventListener('click', function (ev) { if (ev.target.closest('button')) sichern(); }, true);
    // Wiederherstellen, nachdem die Seite sich selbst aufgebaut hat
    setTimeout(function () {
      const ausLink = linkWerte();
      let z = ausLink;
      if (!z) { try { z = JSON.parse(localStorage.getItem(merkSchluessel) || 'null'); } catch (e) { z = null; } }
      try { zustandSetzen(haupt, z); } catch (e) { /* Seite hat sich geändert, dann eben Beispielwerte */ }
      bereit = true;
      if (ausLink) { sichern(); if (history.replaceState) history.replaceState(null, '', location.pathname + location.hash); }
    }, 0);
    // Knopf zum Teilen
    const held = document.querySelector('.held');
    if (held) {
      const leiste = document.createElement('div');
      leiste.className = 'teilen-leiste';
      leiste.innerHTML = '<button type="button" class="knopf teilen">Link mit diesen Werten kopieren</button><span class="teilen-meldung" aria-live="polite"></span>';
      held.append(leiste);
      leiste.querySelector('button').addEventListener('click', function () {
        const json = JSON.stringify(zustandLesen(haupt));
        const kurz = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const url = location.origin + location.pathname + '?werte=' + kurz + location.hash;
        const melden = function (t) { const m = leiste.querySelector('.teilen-meldung'); m.textContent = t; setTimeout(function () { m.textContent = ''; }, 4000); };
        const ok = function () { melden('Link kopiert – öffnet diese Seite mit genau diesen Werten.'); };
        if (navigator.clipboard && navigator.clipboard.writeText && location.protocol !== 'file:') navigator.clipboard.writeText(url).then(ok, function () { window.prompt('Link kopieren:', url); });
        else window.prompt('Link kopieren:', url);
      });
    }
  }

  // ---------- PDF-Export (über den Druckdialog „Als PDF speichern“) ----------
  // Jede Seite mit <main> bekommt einen Knopf; Kopf mit Bauvorhaben, Bearbeiter und Datum,
  // Bedienelemente werden ausgeblendet, eingeklappte Bereiche geöffnet. Eigene Lösung: <main data-eigenes-pdf>.
  const PDF_SPEICHER = 'pdf-angaben';
  function pdfAngaben() { try { return JSON.parse(localStorage.getItem(PDF_SPEICHER) || '{}') || {}; } catch (e) { return {}; } }
  function heute() { const d = new Date(); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function pdfEinrichten() {
    const haupt = document.querySelector('main');
    const held = document.querySelector('.held');
    if (!haupt || !held || haupt.hasAttribute('data-eigenes-pdf') || document.getElementById('seitenkopf') && document.getElementById('seitenkopf').getAttribute('data-seite') === 'start') return;
    // Kopf für den Druck
    const kopf = document.createElement('div');
    kopf.className = 'druckkopf';
    kopf.setAttribute('aria-hidden', 'true');
    haupt.insertBefore(kopf, haupt.firstChild);
    const kopfFuellen = function () {
      const a = pdfAngaben(), titel = (held.querySelector('h1') || {}).textContent || document.title;
      kopf.innerHTML = '';
      const z = function (k, v) { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = k; d.append(b, document.createTextNode(' ' + v)); kopf.append(d); };
      const t = document.createElement('div'); t.className = 'druckkopf-titel'; t.textContent = titel.trim(); kopf.append(t);
      z('Datum:', heute());
      z('Bauvorhaben:', a.projekt || '—');
      z('Bearbeiter:', a.bearbeiter || '—');
      if (a.firma) z('Firma:', a.firma);
      const q = document.createElement('div'); q.className = 'druckkopf-quelle'; q.textContent = 'Formeln & Rechner · ' + location.host + location.pathname.replace(/\/[^/]*$/, '/') ; kopf.append(q);
    };
    // Knopf und kleines Formular
    let leiste = held.querySelector('.teilen-leiste');
    if (!leiste) { leiste = document.createElement('div'); leiste.className = 'teilen-leiste'; held.append(leiste); }
    const knopf = document.createElement('button');
    knopf.type = 'button'; knopf.className = 'knopf pdf-knopf'; knopf.textContent = 'PDF erstellen';
    knopf.setAttribute('aria-expanded', 'false');
    leiste.insertBefore(knopf, leiste.firstChild);
    const form = document.createElement('div');
    form.className = 'pdf-form'; form.hidden = true;
    form.innerHTML = '<label>Bauvorhaben <input type="text" data-k="projekt" data-nicht-merken autocomplete="off"></label>' +
      '<label>Bearbeiter <input type="text" data-k="bearbeiter" data-nicht-merken autocomplete="name"></label>' +
      '<label>Firma <input type="text" data-k="firma" data-nicht-merken autocomplete="organization"></label>' +
      '<label class="pdf-haken"><input type="checkbox" data-h="weg"> Rechenweg mitdrucken</label>' +
      '<label class="pdf-haken"><input type="checkbox" data-h="sammlung"> Formelsammlung mitdrucken</label>' +
      '<button type="button" class="knopf-haupt">Als PDF speichern</button>' +
      '<span class="pdf-hinweis">Im Druckdialog „Als PDF speichern“ wählen. Ohne Bedienknöpfe, mit Kopf und Seitenzahlen.</span>';
    leiste.after(form);
    const a0 = pdfAngaben();
    const haken = function () { const a = pdfAngaben(); document.body.classList.toggle('druck-ohne-weg', a.weg === false); document.body.classList.toggle('druck-ohne-sammlung', a.sammlung !== true); };
    form.querySelectorAll('input[data-h]').forEach(function (i) {
      const k = i.getAttribute('data-h');
      i.checked = k === 'weg' ? a0.weg !== false : a0.sammlung === true;
      i.addEventListener('change', function () { const a = pdfAngaben(); a[k] = i.checked; try { localStorage.setItem(PDF_SPEICHER, JSON.stringify(a)); } catch (e) { /* ohne Speicher */ } haken(); });
    });
    haken();
    form.querySelectorAll('input[data-k]').forEach(function (i) {
      i.value = a0[i.getAttribute('data-k')] || '';
      i.addEventListener('input', function () { const a = pdfAngaben(); a[i.getAttribute('data-k')] = i.value.slice(0, 120); try { localStorage.setItem(PDF_SPEICHER, JSON.stringify(a)); } catch (e) { /* ohne Speicher */ } });
    });
    knopf.addEventListener('click', function () { form.hidden = !form.hidden; knopf.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) form.querySelector('input').focus(); });
    form.querySelector('.knopf-haupt').addEventListener('click', function () { window.print(); });
    // vor und nach dem Druck
    let geoeffnet = [], titelAlt = document.title;
    window.addEventListener('beforeprint', function () {
      kopfFuellen();
      geoeffnet = [];
      document.querySelectorAll('main details:not([open])').forEach(function (d) { d.open = true; geoeffnet.push(d); });
      titelAlt = document.title;
      const a = pdfAngaben();
      document.title = titelAlt + (a.projekt ? ' – ' + a.projekt : '') + ' – ' + heute();
      document.dispatchEvent(new CustomEvent('vordruck'));
    });
    window.addEventListener('afterprint', function () {
      geoeffnet.forEach(function (d) { d.open = false; });
      document.title = titelAlt;
      document.dispatchEvent(new CustomEvent('nachdruck'));
    });
    kopfFuellen();
  }

  document.addEventListener('DOMContentLoaded', function () {
    kopfBauen();
    fussBauen();
    Formel.alle();
    merkenEinrichten();
    pdfEinrichten();
  });
})();
