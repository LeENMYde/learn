/*
 * Baukasten für Auslegungsrechner
 * ===============================
 * Baut eine Rechnerseite im gemeinsamen Aufbau: Eingaben, Ansicht, Ergebnis,
 * Rechenweg und Formelsammlung. Die Seite liefert nur Felder, Rechnung und Zeichnung.
 *
 *   <main data-rechner></main>
 *   <script src="../assets/rechner.js"></script>
 *   <script>Rechner.seite({ titel, einleitung, gruppen, beispiel, rechne, ergebnis, weg, sammlung, bild })</script>
 *
 * Felder:  { k, tex, name, e, min, max, ganz, wahl: [[wert, text], …], wenn: function (e) {…}, hilfe }
 * Listen:  { k, name, zeile: 'Raum', max, spalten: [ wie Felder ], neu: function (i) { return {…}; } }
 * Eingaben werden über basis.js gemerkt und lassen sich teilen; Listen liegen dafür als JSON in einem versteckten Feld.
 */
(function () {
  'use strict';

  function lies(t) {
    const s = String(t).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    return s === '' || s === '-' ? NaN : Number(s);
  }
  // Zahl deutsch formatiert, n Nachkommastellen; nie NaN oder Infinity im Text
  function zahl(w, n) {
    if (typeof w !== 'number' || !isFinite(w)) return '–';
    n = n || 0;
    const t = (Math.round(w * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n).replace('.', ',').replace('-', '−');
    const p = t.split(',');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return p.join(',').replace(/^−(0(,0*)?)$/, '$1');
  }
  // Zahl mit sinnvoller Genauigkeit (3 gültige Stellen, höchstens n Nachkommastellen)
  function rund(w, max) {
    if (!isFinite(w)) return '–';
    const a = Math.abs(w), n = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return zahl(w, Math.min(n, max === undefined ? 3 : max));
  }
  function tz(w, n) { return Formel.zahl(zahl(w, n)); }
  function E(t) { return '\\htmlClass{ergebnis}{' + t + '}'; }
  function F(t) { return '\\htmlClass{fehlertext}{' + t + '}'; }
  function EF(ok) { return ok ? E : F; }
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  function knoten(tag, klasse, text) {
    const k = document.createElement(tag);
    if (klasse) k.className = klasse;
    if (text !== undefined) k.textContent = text;
    return k;
  }
  function farbe(n) { return Thema.farbe(n); }
  // gleichmäßige Werte für Wahlfelder: Zahlenwerte als Zahl speichern
  function wahlWert(v) { return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; }

  let zaehler = 0;

  function seite(K) {
    const haupt = document.querySelector('main[data-rechner]') || document.querySelector('main');
    haupt.classList.add('seite');
    haupt.setAttribute('data-merken', '');
    const id = function (n) { return 'r' + (++zaehler) + '-' + n; };

    // ---------- Gerüst ----------
    const held = knoten('section', 'held');
    const h1 = knoten('h1'); h1.append(knoten('span', 'unterstrichen', K.titel)); held.append(h1);
    if (K.einleitung) held.append(knoten('p', '', K.einleitung));
    haupt.append(held);

    const oben = knoten('div', 'rechnen' + (K.bild ? '' : ' ohne-bild'));
    const tEin = knoten('section', 'tafel'); const hEin = knoten('h2', '', 'Was ist bekannt?'); hEin.id = id('werte');
    tEin.setAttribute('aria-labelledby', hEin.id); tEin.append(hEin);
    if (K.hilfe) tEin.append(knoten('p', 'hilfe', K.hilfe));
    const felderZiel = knoten('div'); tEin.append(felderZiel);
    const kBsp = knoten('button', 'knopf-leise', 'Beispielwerte wiederherstellen'); kBsp.type = 'button'; tEin.append(kBsp);
    oben.append(tEin);

    let cv = null, cx = null, bildHinweis = null, kAnim = null, zusatzBild = null;
    if (K.bild) {
      const tBild = knoten('section', 'tafel bild-tafel'); const hB = knoten('h2', '', K.bild.titel || 'Ansicht'); hB.id = id('bild');
      tBild.setAttribute('aria-labelledby', hB.id); tBild.append(hB);
      cv = knoten('canvas', 'rechner-bild'); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', K.bild.label || K.titel);
      cx = cv.getContext('2d'); tBild.append(cv);
      zusatzBild = knoten('div', 'bild-zusatz'); tBild.append(zusatzBild);
      const st = knoten('div', 'steuerung');
      if (K.bild.animiert) { kAnim = knoten('button', 'knopf', '■ Anhalten'); kAnim.type = 'button'; kAnim.setAttribute('data-nicht-merken', ''); st.append(kAnim); }
      bildHinweis = knoten('span', 'zustand'); st.append(bildHinweis);
      tBild.append(st);
      oben.append(tBild);
    }
    haupt.append(oben);

    const tErg = knoten('section', 'tafel abstand'); const kz = knoten('div', 'kopf-zeile');
    const hErg = knoten('h2', '', 'Ergebnis'); hErg.id = id('ergebnis'); tErg.setAttribute('aria-labelledby', hErg.id);
    const urteilEl = knoten('span', 'urteil'); urteilEl.setAttribute('aria-live', 'polite');
    kz.append(hErg, urteilEl); tErg.append(kz);
    const melEl = knoten('div', 'meldungen'), kachEl = knoten('div', 'kacheln'), nwEl = knoten('ul', 'nachweise'), zusEl = knoten('div', 'zusatz');
    tErg.append(melEl, kachEl, nwEl, zusEl);
    haupt.append(tErg);

    const zwei = knoten('div', 'zwei');
    const tWeg = knoten('section', 'tafel'); const hW = knoten('h2', '', 'So wird gerechnet'); hW.id = id('weg'); tWeg.setAttribute('aria-labelledby', hW.id);
    const wegEl = knoten('ol', 'weg');
    tWeg.append(hW, knoten('p', 'hilfe', 'Die Schritte mit deinen Zahlen.'), wegEl);
    const tSam = knoten('section', 'tafel'); const hS = knoten('h2', '', 'Formelsammlung'); hS.id = id('formeln'); tSam.setAttribute('aria-labelledby', hS.id);
    const samEl = knoten('div', 'formelsammlung');
    tSam.append(hS, knoten('p', 'hilfe', 'Alle Formeln und Tabellenwerte, die der Rechner verwendet.'), samEl);
    if (K.quellen) { const q = knoten('p', 'quellen', K.quellen); tSam.append(q); }
    zwei.append(tWeg, tSam);
    haupt.append(zwei);

    // ---------- Eingaben ----------
    let e = kopie(K.beispiel);
    const felder = {};      // k → { el, f, zeile }
    const listen = {};      // k → { versteckt, aufbauen }
    const sichtbar = [];    // [zeile oder gruppe, wenn]

    function zeigeWert(k) {
      const x = felder[k]; if (!x) return;
      x.el.value = x.f.wahl ? String(e[k]) : String(Math.round(e[k] * 10000) / 10000).replace('.', ',');
      x.zeile.classList.remove('widerspruch');
    }
    function einFeld(f, ziel) {
      const zeile = knoten('div', 'feld gegeben');
      const fid = id('f-' + f.k);
      const lab = document.createElement('label'); lab.htmlFor = fid;
      const sym = knoten('span', 'symbol'); if (f.tex) Formel.setze(sym, f.tex);
      lab.append(sym, knoten('span', 'name', f.name)); zeile.append(lab);
      let el;
      if (f.wahl) {
        el = document.createElement('select');
        f.wahl.forEach(function (w) { const o = knoten('option', '', w[1]); o.value = String(w[0]); el.append(o); });
        el.addEventListener('change', function () {
          e[f.k] = wahlWert(el.value);
          if (f.bei) f.bei(e, el.value, setzeWerte);
          rechnen();
        });
        zeile.append(el, knoten('span'));
        zeile.classList.add('mit-wahl');
      } else {
        el = document.createElement('input'); el.type = 'text'; el.inputMode = 'decimal'; el.autocomplete = 'off';
        el.addEventListener('input', function () {
          const w = lies(el.value);
          const ok = isFinite(w) && w >= f.min && w <= f.max;
          zeile.classList.toggle('widerspruch', !ok);
          el.setAttribute('aria-invalid', ok ? 'false' : 'true');
          if (!ok) { el.title = 'Erlaubt: ' + zahl(f.min, 3) + ' bis ' + zahl(f.max, 3) + ' ' + (f.e || ''); return; }
          el.title = '';
          e[f.k] = f.ganz ? Math.round(w) : w;
          if (f.bei) f.bei(e, w, setzeWerte);
          rechnen();
        });
        el.addEventListener('blur', function () { zeigeWert(f.k); el.setAttribute('aria-invalid', 'false'); });
        zeile.append(el, knoten('span', 'einheit', f.e || ''));
      }
      el.id = fid;
      if (f.hilfe) zeile.title = f.hilfe;
      felder[f.k] = { el: el, f: f, zeile: zeile };
      if (f.wenn) sichtbar.push([zeile, f.wenn]);
      ziel.append(zeile);
    }
    // Werte von außen setzen (z. B. Vorlagen) und anzeigen
    function setzeWerte(o) { Object.keys(o).forEach(function (k) { e[k] = o[k]; zeigeWert(k); }); }

    function eineListe(L, ziel) {
      const versteckt = document.createElement('input'); versteckt.type = 'hidden'; versteckt.id = id('l-' + L.k);
      const box = knoten('div', 'liste'); box.setAttribute('data-nicht-merken', '');
      const neuK = knoten('button', 'knopf', '+ ' + (L.zeile || 'Zeile') + ' hinzufügen'); neuK.type = 'button'; neuK.setAttribute('data-nicht-merken', '');
      function speichern() { versteckt.value = JSON.stringify(e[L.k]); }
      function pruefeZeile(z, i) {
        const neu = L.neu(i), o = {};
        L.spalten.forEach(function (s) {
          let w = z && z[s.k] !== undefined ? z[s.k] : neu[s.k];
          if (s.wahl) { if (!s.wahl.some(function (x) { return String(x[0]) === String(w); })) w = neu[s.k]; w = s.text ? w : wahlWert(String(w)); }
          else if (s.text) w = String(w).slice(0, 40);
          else { w = Number(w); if (!isFinite(w) || w < s.min || w > s.max) w = neu[s.k]; if (s.ganz) w = Math.round(w); }
          o[s.k] = w;
        });
        return o;
      }
      function aufbauen() {
        box.innerHTML = '';
        e[L.k].forEach(function (z, i) {
          const karte = knoten('fieldset', 'listen-zeile');
          const lg = knoten('legend'); lg.append(knoten('span', '', (L.zeile || 'Zeile') + ' ' + (i + 1)));
          const weg = knoten('button', 'entfernen', '×'); weg.type = 'button'; weg.setAttribute('aria-label', (L.zeile || 'Zeile') + ' ' + (i + 1) + ' entfernen');
          weg.disabled = e[L.k].length <= (L.min || 1);
          weg.addEventListener('click', function () { e[L.k].splice(i, 1); speichern(); aufbauen(); rechnen(); });
          lg.append(weg); karte.append(lg);
          L.spalten.forEach(function (s) {
            const lab = knoten('label', 'listen-feld' + (s.breit ? ' breit' : ''));
            lab.append(knoten('span', 'listen-name', s.name + (s.e ? ' (' + s.e + ')' : '')));
            let el;
            if (s.wahl) {
              el = document.createElement('select');
              s.wahl.forEach(function (w) { const o = knoten('option', '', w[1]); o.value = String(w[0]); el.append(o); });
              el.value = String(z[s.k]);
              el.addEventListener('change', function () { z[s.k] = s.text ? el.value : wahlWert(el.value); speichern(); rechnen(); });
            } else {
              el = document.createElement('input'); el.type = 'text'; el.autocomplete = 'off';
              if (!s.text) el.inputMode = 'decimal'; else el.className = 'text';
              el.value = s.text ? z[s.k] : String(Math.round(z[s.k] * 10000) / 10000).replace('.', ',');
              el.addEventListener('input', function () {
                if (s.text) { z[s.k] = el.value.slice(0, 40); speichern(); rechnen(); return; }
                const w = lies(el.value), ok = isFinite(w) && w >= s.min && w <= s.max;
                lab.classList.toggle('widerspruch', !ok); el.setAttribute('aria-invalid', ok ? 'false' : 'true');
                if (!ok) return;
                z[s.k] = s.ganz ? Math.round(w) : w; speichern(); rechnen();
              });
              el.addEventListener('blur', function () { if (!s.text) { el.value = String(Math.round(z[s.k] * 10000) / 10000).replace('.', ','); lab.classList.remove('widerspruch'); } });
            }
            lab.append(el); karte.append(lab);
          });
          box.append(karte);
        });
        neuK.disabled = e[L.k].length >= (L.max || 30);
      }
      neuK.addEventListener('click', function () {
        const letzte = e[L.k][e[L.k].length - 1];
        e[L.k].push(pruefeZeile(L.kopieren && letzte ? Object.assign({}, letzte, L.neu(e[L.k].length)) : null, e[L.k].length));
        speichern(); aufbauen(); rechnen();
        const f = box.querySelector('.listen-zeile:last-child input, .listen-zeile:last-child select'); if (f) f.focus();
      });
      // Wiederherstellen aus Merken oder Teilen-Link
      versteckt.addEventListener('input', function () {
        let a = null; try { a = JSON.parse(versteckt.value); } catch (x) { a = null; }
        if (!Array.isArray(a) || !a.length) return;
        e[L.k] = a.slice(0, L.max || 30).map(pruefeZeile);
        aufbauen(); rechnen();
      });
      ziel.append(versteckt, box, neuK);
      listen[L.k] = { aufbauen: aufbauen, speichern: speichern };
    }

    K.gruppen.forEach(function (g) {
      const fs = knoten('fieldset', 'gruppe'); fs.style.setProperty('--farbe', g.farbe || 'var(--linie)');
      fs.append(knoten('legend', '', g.titel));
      if (g.hilfe) fs.append(knoten('p', 'gruppen-hilfe', g.hilfe));
      if (g.liste) eineListe(g.liste, fs);
      (g.felder || []).forEach(function (f) { einFeld(f, fs); });
      if (g.wenn) sichtbar.push([fs, g.wenn]);
      felderZiel.append(fs);
    });
    function alleZeigen() {
      Object.keys(felder).forEach(zeigeWert);
      Object.keys(listen).forEach(function (k) { listen[k].speichern(); listen[k].aufbauen(); });
    }
    kBsp.addEventListener('click', function () { e = kopie(K.beispiel); alleZeigen(); rechnen(); });

    // ---------- Ergebnis-Bausteine ----------
    const H = {
      urteil: function (ok, text) {
        urteilEl.textContent = text || (ok ? 'reicht' : 'reicht nicht');
        urteilEl.className = 'urteil' + (ok === true ? ' gut' : ok === false ? ' schlecht' : '');
      },
      meldung: function (text, fehler) { const d = knoten('div', 'hinweis' + (fehler ? ' fehler' : ''), text); melEl.append(d); },
      kacheln: function (liste) {
        liste.forEach(function (k) {
          if (!k) return;
          const d = knoten('div', 'kachel'); d.style.setProperty('--farbe', k[2] || 'var(--linie)');
          d.append(knoten('div', 'wert', k[0]), knoten('small', '', k[1])); kachEl.append(d);
        });
      },
      nachweise: function (liste) {
        liste.forEach(function (n) {
          if (!n) return;
          const li = knoten('li', n[0] === true ? 'gut' : n[0] === false ? 'schlecht' : 'info');
          li.append(knoten('span', 'marke-n', n[0] === true ? '✓' : n[0] === false ? '✕' : 'i'), knoten('span', 'was', n[1]), knoten('span', 'wie', n[2] || ''));
          nwEl.append(li);
        });
      },
      // zeilen: Arrays von Texten; opt.zahl: Spalten rechtsbündig; opt.klasse(i): Zeilenklasse
      tabelle: function (titel, kopf, zeilen, opt) {
        opt = opt || {};
        if (titel) zusEl.append(knoten('h3', 'zwischen', titel));
        const rahmen = knoten('div', 'rahmen'), t = knoten('table', 'tabelle' + (opt.breit ? ' breit' : ''));
        const th = knoten('thead'), tr0 = knoten('tr');
        kopf.forEach(function (k, i) { tr0.append(knoten('th', (opt.zahl || []).indexOf(i) >= 0 ? 'zahl' : '', k)); });
        th.append(tr0); t.append(th);
        const tb = knoten('tbody');
        zeilen.forEach(function (z, j) {
          const tr = knoten('tr', opt.klasse ? opt.klasse(j) || '' : '');
          z.forEach(function (w, i) { tr.append(knoten('td', (opt.zahl || []).indexOf(i) >= 0 ? 'zahl' : '', w)); });
          tb.append(tr);
        });
        t.append(tb); rahmen.append(t); zusEl.append(rahmen);
        if (opt.fuss) zusEl.append(knoten('p', 'tabellen-fuss', opt.fuss));
      },
      absatz: function (text, titel) { if (titel) zusEl.append(knoten('h3', 'zwischen', titel)); zusEl.append(knoten('p', 'absatz', text)); },
      element: function (el) { zusEl.append(el); }
    };

    function schritt(t, tex) {
      const li = knoten('li'); const b = knoten('div', 'rechnung');
      Formel.setze(b, tex, false);
      li.append(knoten('div', 'titel', t), b); return li;
    }
    (K.sammlung || []).forEach(function (x) {
      const s = knoten('section'); s.append(knoten('h3', '', x[0]));
      const b = knoten('div', 'formelblock'); Formel.setze(b, x[1], true); s.append(b);
      if (x[2]) s.append(knoten('p', '', x[2]));
      samEl.append(s);
    });

    // ---------- Rechnen ----------
    let r = null;
    function rechnen() {
      sichtbar.forEach(function (s) { s[0].hidden = !s[1](e); });
      melEl.innerHTML = ''; kachEl.innerHTML = ''; nwEl.innerHTML = ''; zusEl.innerHTML = ''; wegEl.innerHTML = '';
      urteilEl.textContent = ''; urteilEl.className = 'urteil';
      try {
        r = K.rechne(e);
        K.ergebnis(r, e, H);
        (K.weg ? K.weg(r, e) : []).forEach(function (s) { if (s) wegEl.append(schritt(s[0], s[1])); });
      } catch (x) {
        r = null;
        melEl.innerHTML = ''; kachEl.innerHTML = ''; nwEl.innerHTML = ''; zusEl.innerHTML = '';
        H.meldung('Mit diesen Eingaben lässt sich nicht rechnen. Bitte Werte prüfen.', true);
        if (window.console) console.warn(x);
      }
      if (cv) zeichnen(letzteZeit);
      if (K.nachher) K.nachher(r, e);
    }

    // ---------- Zeichnung ----------
    let B = 600, Hh = 300, dpr = 1, laeuft = !!(K.bild && K.bild.animiert), letzteZeit = 0;
    const bewegungAus = false;
    function groesse() {
      if (!cv) return;
      B = Math.max(200, cv.parentElement.clientWidth - 40);
      dpr = window.devicePixelRatio || 1;
      Hh = Math.round(K.bild.hoehe ? K.bild.hoehe(B, e) : Math.max(220, Math.min(360, B * 0.55)));
      cv.width = Math.round(B * dpr); cv.height = Math.round(Hh * dpr);
      cv.style.width = '100%'; cv.style.height = Hh + 'px';
      B = cv.clientWidth || B;
      cv.width = Math.round(B * dpr);
    }
    function zeichnen(t) {
      if (!cv || !r) return;
      letzteZeit = t;
      const h = Math.round(K.bild.hoehe ? K.bild.hoehe(B, e) : Hh);
      if (h !== Hh) groesse();
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, B, Hh);
      cx.fillStyle = farbe('--flaeche2'); cx.fillRect(0, 0, B, Hh);
      try { K.bild.zeichne(cx, B, Hh, t, r, e); } catch (x) { if (window.console) console.warn(x); }
      if (bildHinweis && K.bild.hinweis) bildHinweis.textContent = K.bild.hinweis(r, e);
    }
    function schleife(t) { if (laeuft && !bewegungAus) zeichnen(t); requestAnimationFrame(schleife); }
    if (cv) {
      if (kAnim) kAnim.addEventListener('click', function () { laeuft = !laeuft; kAnim.textContent = laeuft ? '■ Anhalten' : '▶ Abspielen'; zeichnen(performance.now()); });
      let uhr = 0;
      window.addEventListener('resize', function () { clearTimeout(uhr); uhr = setTimeout(function () { groesse(); zeichnen(performance.now()); }, 60); });
      document.addEventListener('themawechsel', function () { zeichnen(performance.now()); });
      window.addEventListener('beforeprint', function () { zeichnen(letzteZeit); });
    }

    alleZeigen();
    groesse();
    rechnen();
    if (cv) { zeichnen(0); requestAnimationFrame(schleife); }
    return { werte: function () { return e; }, neu: rechnen, setze: function (o) { setzeWerte(o); rechnen(); }, bildZusatz: zusatzBild };
  }

  // ---------- Zeichenhilfen ----------
  const Z = {
    pfeil: function (cx, x1, y1, x2, y2, kopf) {
      kopf = kopf || 7;
      const a = Math.atan2(y2 - y1, x2 - x1);
      cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
      cx.beginPath(); cx.moveTo(x2, y2);
      cx.lineTo(x2 - kopf * Math.cos(a - 0.4), y2 - kopf * Math.sin(a - 0.4));
      cx.lineTo(x2 - kopf * Math.cos(a + 0.4), y2 - kopf * Math.sin(a + 0.4));
      cx.closePath(); cx.fill();
    },
    text: function (cx, t, x, y, ausr, groesse, fett, f) {
      cx.fillStyle = f || farbe('--text');
      cx.font = (fett === false ? '' : '600 ') + (groesse || 12) + 'px ' + (farbe('--technik') || 'sans-serif');
      cx.textAlign = ausr || 'left'; cx.textBaseline = 'middle';
      cx.fillText(t, x, y);
    },
    // Farbe zwischen kalt (0) und warm (1)
    waerme: function (a) {
      a = Math.max(0, Math.min(1, a));
      const s = [[43, 123, 185], [110, 111, 166], [228, 87, 46], [242, 165, 65]];
      const p = a * (s.length - 1), i = Math.min(s.length - 2, Math.floor(p)), f = p - i;
      const c = s[i].map(function (v, j) { return Math.round(v + (s[i + 1][j] - v) * f); });
      return 'rgb(' + c.join(',') + ')';
    },
    // Achsen für Diagramme: gibt Umrechnung zurück
    achsen: function (cx, x0, y0, b, h, xa, xb, ya, yb, opt) {
      opt = opt || {};
      const X = function (v) { return x0 + (v - xa) / (xb - xa) * b; };
      const Y = function (v) { return y0 + h - (v - ya) / (yb - ya) * h; };
      cx.strokeStyle = farbe('--linie'); cx.lineWidth = 1;
      const sx = opt.xSchritt || (xb - xa) / 5, sy = opt.ySchritt || (yb - ya) / 4;
      cx.font = '11px ' + farbe('--technik'); cx.fillStyle = farbe('--leise');
      for (let v = Math.ceil(xa / sx) * sx, n = 0; v <= xb + 1e-9 && n < 60; v += sx, n++) {
        cx.beginPath(); cx.moveTo(X(v), y0); cx.lineTo(X(v), y0 + h); cx.stroke();
        cx.textAlign = 'center'; cx.textBaseline = 'top'; cx.fillText(zahl(v, opt.xStellen || 0), X(v), y0 + h + 4);
      }
      for (let v = Math.ceil(ya / sy) * sy, n = 0; v <= yb + 1e-9 && n < 60; v += sy, n++) {
        cx.beginPath(); cx.moveTo(x0, Y(v)); cx.lineTo(x0 + b, Y(v)); cx.stroke();
        cx.textAlign = 'right'; cx.textBaseline = 'middle'; cx.fillText(zahl(v, opt.yStellen || 0), x0 - 4, Y(v));
      }
      if (opt.xName) { cx.textAlign = 'right'; cx.textBaseline = 'top'; cx.fillText(opt.xName, x0 + b, y0 + h + 18); }
      if (opt.yName) { cx.textAlign = 'left'; cx.textBaseline = 'bottom'; cx.fillText(opt.yName, x0, y0 - 4); }
      return { X: X, Y: Y };
    }
  };

  window.Rechner = { seite: seite, zahl: zahl, rund: rund, tz: tz, E: E, F: F, EF: EF, lies: lies, farbe: farbe, Z: Z };
})();
