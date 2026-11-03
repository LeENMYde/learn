/*
 * Erweiterung des IT-Sicherheitsprotokolls
 * - Auswertung der Checkliste je Abschnitt (OK / WARN / FAIL / N/A, offene Punkte)
 * - CVSS-Wert setzt den Schweregrad (CVSS v3.x: 0,1–3,9 niedrig, 4–6,9 mittel, 7–8,9 hoch, 9–10 kritisch)
 * - Übersicht der Findings und CVEs, Briefkopf im PDF, leere Zeilen nicht drucken
 */
'use strict';

(function () {
  const $ = function (id) { return document.getElementById(id); };
  const wert = function (id) { const e = $(id); return e ? e.value : ''; };
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lies(t) { const s = String(t || '').trim().replace(',', '.'); const n = Number(s); return s === '' || !isFinite(n) ? NaN : n; }

  function box(nach, id) {
    if ($(id)) return $(id);
    const d = document.createElement('div'); d.id = id; d.className = 'auswertung'; d.setAttribute('aria-live', 'polite');
    nach.parentNode.insertBefore(d, nach);
    return d;
  }
  function abschnitte(tab) {
    const liste = [];
    tab.querySelectorAll('table.check-grid').forEach(function (t) {
      let titel = '', el = t.closest('.rollen') || t;
      for (let p = el.previousElementSibling; p; p = p.previousElementSibling) if (p.classList.contains('section-title')) { titel = p.textContent.trim(); break; }
      const r = { titel: titel, ok: 0, warn: 0, fail: 0, na: 0, offen: 0, fehl: [], warnung: [] };
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        const radios = tr.querySelectorAll('input[type="radio"]'); if (!radios.length) return;
        const c = tr.querySelector('input[type="radio"]:checked');
        const punkt = (tr.cells[0] ? tr.cells[0].textContent : '').trim();
        if (!c) { r.offen++; return; }
        const v = c.value === 'on' ? ['ok', 'warn', 'fail', 'na'][Array.prototype.indexOf.call(radios, c)] || 'ok' : c.value;
        if (r[v] !== undefined) r[v]++;
        if (v === 'fail') r.fehl.push(punkt); if (v === 'warn') r.warnung.push(punkt);
      });
      liste.push(r);
    });
    return liste;
  }
  function auswerten() {
    // Sicherheitsaudit
    const audit = $('tab-audit');
    if (audit) {
      const ziel = Array.prototype.filter.call(audit.querySelectorAll('.section-title'), function (s) { return /Prüfergebnis/.test(s.textContent); })[0];
      if (ziel) {
        const a = abschnitte(audit).filter(function (x) { return /^\d/.test(x.titel); });
        const sum = a.reduce(function (s, x) { ['ok', 'warn', 'fail', 'na', 'offen'].forEach(function (k) { s[k] += x[k]; }); return s; }, { ok: 0, warn: 0, fail: 0, na: 0, offen: 0 });
        const bewertet = sum.ok + sum.warn + sum.fail;
        const quote = bewertet ? Math.round(sum.ok / bewertet * 100) : 0;
        let html = '<b>Checkliste:</b> ' + sum.ok + ' OK, <b class="erg-hinweis">' + sum.warn + ' WARN</b>, <b class="erg-fehl">' + sum.fail + ' FAIL</b>, ' + sum.na + ' N/A' + (sum.offen ? ', <b>' + sum.offen + ' offen</b>' : '') + (bewertet ? ' · Erfüllungsgrad ' + quote + ' %' : '');
        html += '<table class="it-uebersicht"><tr><th>Abschnitt</th><th>OK</th><th>WARN</th><th>FAIL</th><th>N/A</th><th>offen</th></tr>' + a.map(function (x) {
          return '<tr><td>' + esc(x.titel) + '</td><td>' + x.ok + '</td><td class="' + (x.warn ? 'erg-hinweis' : '') + '">' + x.warn + '</td><td class="' + (x.fail ? 'erg-fehl' : '') + '">' + x.fail + '</td><td>' + x.na + '</td><td>' + x.offen + '</td></tr>';
        }).join('') + '</table>';
        const fehl = [].concat.apply([], a.map(function (x) { return x.fehl; }));
        if (fehl.length) html += '<b class="erg-fehl">FAIL:</b> ' + fehl.map(esc).join(' · ');
        const urteil = sum.fail ? '<b class="erg-fehl">Vorschlag: nicht bestanden – kritische Befunde beheben und erneut prüfen.</b>' : sum.warn ? '<b class="erg-hinweis">Vorschlag: bedingt bestanden – Empfehlungen umsetzen.</b>' : bewertet && !sum.offen ? '<b class="erg-ok">Vorschlag: bestanden.</b>' : '';
        if (urteil) html += '<br>' + urteil;
        box(ziel, 'i-auswertung').innerHTML = html;
      }
    }
    // Findings
    const ft = $('findings-tbody'), ct = $('cve-tbody');
    if (ft) {
      const stufe = { 1: 'kritisch', 2: 'hoch', 3: 'mittel', 4: 'niedrig', 5: 'info' }, z = { kritisch: 0, hoch: 0, mittel: 0, niedrig: 0, info: 0 };
      let offen = 0, behoben = 0;
      Array.prototype.forEach.call(ft.rows, function (tr) {
        const t = tr.querySelector('input[type="text"]'); if (!t || !t.value.trim()) return;
        const s = tr.querySelectorAll('select'); const sev = s[1] ? stufe[s[1].selectedIndex] : null; if (sev) z[sev]++;
        if (s[2]) { if (/Behoben|Akzeptiert|N\/A/.test(s[2].value)) behoben++; else offen++; }
      });
      let cv = { gesamt: 0, offen: 0 };
      if (ct) Array.prototype.forEach.call(ct.rows, function (tr) { const t = tr.querySelector('input'); if (!t || !t.value.trim()) return; cv.gesamt++; const s = tr.querySelectorAll('select'); if (s[2] && s[2].value === 'Offen') cv.offen++; });
      const ziel = (ct || ft).closest('.rollen') || ft;
      box(ziel.nextSibling ? ziel.nextElementSibling || ziel : ziel, 'f-auswertung').innerHTML =
        '<b>Findings:</b> <b class="erg-fehl">' + z.kritisch + ' kritisch</b>, <b class="erg-fehl">' + z.hoch + ' hoch</b>, <b class="erg-hinweis">' + z.mittel + ' mittel</b>, ' + z.niedrig + ' niedrig, ' + z.info + ' info · ' + offen + ' offen, ' + behoben + ' erledigt' +
        (cv.gesamt ? '<br><b>CVEs:</b> ' + cv.gesamt + ' erfasst, ' + cv.offen + ' offen' : '') +
        (z.kritisch + z.hoch ? '<br><b class="erg-fehl">Kritische und hohe Findings vor dem produktiven Betrieb beheben.</b>' : '');
    }
  }

  // CVSS-Wert → Schweregrad
  function cvssStufe(n) { return !isFinite(n) ? 0 : n >= 9 ? 1 : n >= 7 ? 2 : n >= 4 ? 3 : n > 0 ? 4 : 5; }
  document.addEventListener('input', function (ev) {
    const e = ev.target;
    if (e && e.type === 'number' && e.closest && (e.closest('#findings-tbody') || e.closest('#cve-tbody'))) {
      const tr = e.closest('tr'), sel = tr.querySelectorAll('select')[e.closest('#findings-tbody') ? 1 : 0];
      const st = cvssStufe(lies(e.value));
      if (sel && st && isFinite(lies(e.value))) { sel.selectedIndex = st; if (typeof window.colorRow === 'function') window.colorRow(sel); }
    }
  });

  let geplant = false;
  function planen() { if (geplant) return; geplant = true; requestAnimationFrame(function () { geplant = false; auswerten(); }); }
  document.addEventListener('input', planen);
  document.addEventListener('change', planen);

  // Briefkopf und leere Zeilen im PDF
  window.addEventListener('beforeprint', function () {
    const firma = wert('sd-firma');
    const zeilen = [wert('sd-str'), wert('sd-ort'), [wert('sd-tel') ? 'Tel. ' + wert('sd-tel') : '', wert('sd-mail')].filter(Boolean).join(' · '), wert('sd-web'), wert('sd-zert')].filter(Boolean);
    document.querySelectorAll('.briefkopf').forEach(function (b) { b.innerHTML = firma ? '<div class="bk-firma">' + esc(firma) + '</div><div class="bk-adresse">' + zeilen.map(esc).join('<br>') + '</div>' : ''; });
    ['portscan-tbody', 'findings-tbody', 'cve-tbody'].forEach(function (id) {
      const tb = $(id); if (!tb) return;
      Array.prototype.forEach.call(tb.rows, function (tr) {
        const leer = !Array.prototype.some.call(tr.querySelectorAll('input[type="text"], input[type="number"]'), function (x) { return x.value.trim(); });
        tr.classList.toggle('leer-zeile', leer);
      });
    });
    auswerten();
  });
  window.addEventListener('afterprint', function () { document.querySelectorAll('.leer-zeile').forEach(function (tr) { tr.classList.remove('leer-zeile'); }); });

  window.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.tab-content').forEach(function (t) {
      if (t.id === 'tab-stammdaten' || t.querySelector('.briefkopf')) return;
      const b = document.createElement('div'); b.className = 'briefkopf'; t.insertBefore(b, t.firstChild);
    });
    auswerten();
  });
  window.addEventListener('load', function () { setTimeout(auswerten, 80); });
})();
