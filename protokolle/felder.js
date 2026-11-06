/*
 * Kopftabellen der Protokolle (Bezeichnung | Feld | Bezeichnung | Feld …) als Raster aus Feldpaaren.
 * Jedes Feld bekommt so mindestens eine brauchbare Breite, statt sich eine Tabellenzeile mit vielen anderen zu teilen.
 * Die Eingabefelder selbst werden nur verschoben (IDs, Werte und Reihenfolge bleiben gleich).
 */
'use strict';
(function () {
  document.querySelectorAll('.protokoll table.form-table').forEach(function (tab) {
    if (tab.querySelector('th')) return;          // Messwerttabellen mit Spaltenköpfen bleiben Tabellen
    const raster = document.createElement('div');
    raster.className = 'feldraster';
    Array.prototype.forEach.call(tab.rows, function (tr) {
      let paar = null;
      Array.prototype.forEach.call(tr.cells, function (td) {
        if (td.classList.contains('label')) {
          paar = document.createElement('div');
          paar.className = 'paar';
          const l = document.createElement('div');
          l.className = 'paar-name';
          while (td.firstChild) l.appendChild(td.firstChild);
          // Doppelpunkt am Ende entfällt, der Name steht über dem Feld
          const letzter = l.lastChild;
          if (letzter && letzter.nodeType === 3) letzter.textContent = letzter.textContent.replace(/:\s*$/, '');
          paar.appendChild(l);
          raster.appendChild(paar);
          if (td.colSpan >= 3) paar.classList.add('voll');
          return;
        }
        const f = document.createElement('div');
        f.className = 'paar-feld';
        while (td.firstChild) f.appendChild(td.firstChild);
        if (!paar) { paar = document.createElement('div'); paar.className = 'paar voll'; raster.appendChild(paar); }
        paar.appendChild(f);
        const radios = f.querySelectorAll('input[type="radio"], input[type="checkbox"]').length;
        if (paar.querySelectorAll('.paar-feld').length > 1 || radios > 2) paar.classList.add('voll');
        else if (td.colSpan >= 3 || f.querySelector('textarea')) paar.classList.add('breit');
        // lange Auswahltexte (z. B. Prüfanlass) brauchen zwei Spalten, sonst werden sie im PDF abgeschnitten
        const sel = f.querySelector('select');
        if (sel && Array.prototype.some.call(sel.options, function (o) { return o.text.length > 30; })) paar.classList.add('breit');
      });
    });
    const huelle = tab.closest('.rollen') || tab;
    huelle.parentNode.replaceChild(raster, huelle);
  });
})();

/*
 * Reiter der Protokolle für Tastatur und Bildschirmleser: role="tablist"/"tab"/"tabpanel",
 * aria-selected und aria-controls, Pfeiltasten, Pos1 und Ende wechseln den Reiter.
 */
(function () {
  const leiste = document.querySelector('.protokoll .tabs');
  if (!leiste) return;
  const knoepfe = Array.prototype.slice.call(leiste.querySelectorAll('.tab-btn'));
  leiste.setAttribute('role', 'tablist');
  leiste.setAttribute('aria-label', 'Bereiche des Protokolls');
  function name(b) { const m = /switchTab\('([a-z0-9-]+)'\)/.exec(b.getAttribute('onclick') || ''); return m ? m[1] : ''; }
  function abgleichen() {
    knoepfe.forEach(function (b) {
      const an = b.classList.contains('active');
      b.setAttribute('aria-selected', an ? 'true' : 'false');
      b.tabIndex = an ? 0 : -1;
    });
  }
  knoepfe.forEach(function (b) {
    const n = name(b), feld = n && document.getElementById('tab-' + n);
    b.setAttribute('role', 'tab');
    b.type = 'button';
    if (!b.id) b.id = 'reiter-' + n;
    if (feld) { b.setAttribute('aria-controls', feld.id); feld.setAttribute('role', 'tabpanel'); feld.setAttribute('aria-labelledby', b.id); }
    b.addEventListener('keydown', function (ev) {
      const i = knoepfe.indexOf(b);
      let z = -1;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') z = (i + 1) % knoepfe.length;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') z = (i - 1 + knoepfe.length) % knoepfe.length;
      else if (ev.key === 'Home') z = 0;
      else if (ev.key === 'End') z = knoepfe.length - 1;
      if (z < 0) return;
      ev.preventDefault();
      knoepfe[z].click();
      knoepfe[z].focus();
    });
  });
  abgleichen();
  // switchTab() wird auch aus dem Programm aufgerufen (Wiederherstellen, Sprungmarken): Klassenwechsel beobachten
  if (window.MutationObserver) new MutationObserver(abgleichen).observe(leiste, { attributes: true, subtree: true, attributeFilter: ['class'] });
})();
