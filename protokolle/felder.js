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
