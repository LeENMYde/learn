/*
 * Fachliche Erweiterung des Elektro-Prüfprotokolls
 * - Stromkreistabelle mit automatischer Grenzwertprüfung (DIN VDE 0100-600, -410)
 * - Mängelliste mit Einstufung und Frist
 * - Geräteprüfung mit Grenzwerten nach DIN EN 50699 / DIN EN 50678
 * - Geräteliste (Sammelprotokoll) mit CSV-Ausgabe
 * - Briefkopf im PDF, Prüffristen, Kalibrierung der Messgeräte
 */
'use strict';

(function () {
  const $ = function (id) { return document.getElementById(id); };
  const wert = function (id) { const e = $(id); return e ? e.value : ''; };

  // Zahl aus Eingabe: Komma, Leerzeichen und Vergleichszeichen (>500, ≥1) erlaubt
  function lies(t) {
    if (t === null || t === undefined) return NaN;
    const s = String(t).trim().replace(/\s/g, '').replace(',', '.').replace(/^[<>≥≤=~]+/, '');
    if (s === '' || s === '-' || s === '–') return NaN;
    const n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function zahl(w, n) {
    if (!isFinite(w)) return '–';
    return (Math.round(w * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n).replace('.', ',');
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function opt(liste, gewaehlt) {
    return liste.map(function (o) { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(gewaehlt) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
  }
  function datumPlus(iso, monate) {
    if (!iso || !(monate > 0)) return '';
    const d = new Date(iso + 'T12:00:00'); if (isNaN(d)) return '';
    d.setMonth(d.getMonth() + monate);
    return d.toISOString().slice(0, 10);
  }
  function datumDe(iso) { if (!iso) return '–'; const p = iso.split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso; }

  // ---------- Schutzorgane: Abschaltstrom I_a ----------
  // gG-Sicherungen (DIN VDE 0636): [I_n, I_a bei 0,4 s, I_a bei 5 s]
  const GG = { 2: [16, 9.2], 4: [32, 19], 6: [47, 28], 10: [82, 47], 13: [100, 58], 16: [107, 65], 20: [146, 85], 25: [180, 110], 32: [240, 150], 35: [265, 173], 40: [300, 190], 50: [425, 250], 63: [520, 320], 80: [700, 425], 100: [950, 580], 125: [1250, 715], 160: [1650, 950] };
  const FAKTOR = { B: 5, C: 10, D: 20, K: 14, Z: 3 };
  function abschaltstrom(art, In) {
    if (!(In > 0)) return NaN;
    const tab = wert('a-tab'), t = tab === 'auto' ? (In <= 63 ? 0.4 : 5) : +tab;
    if (art === 'gG') { const g = GG[In]; return g ? (t >= 5 ? g[1] : g[0]) : NaN; }
    return FAKTOR[art] ? FAKTOR[art] * In : NaN;
  }

  // ---------- Stromkreise ----------
  const LEITUNGEN = [['', '–'], ['3x1.5', '3 × 1,5'], ['5x1.5', '5 × 1,5'], ['3x2.5', '3 × 2,5'], ['5x2.5', '5 × 2,5'], ['3x4', '3 × 4'], ['5x4', '5 × 4'], ['3x6', '3 × 6'], ['5x6', '5 × 6'], ['5x10', '5 × 10'], ['5x16', '5 × 16'], ['5x25', '5 × 25'], ['5x35', '5 × 35'], ['4x1.5', '4 × 1,5'], ['7x1.5', '7 × 1,5']];
  const ARTEN = [['', '–'], ['B', 'LS B'], ['C', 'LS C'], ['D', 'LS D'], ['K', 'LS K'], ['Z', 'LS Z'], ['gG', 'gG']];
  const NENN = ['', 2, 4, 6, 10, 13, 16, 20, 25, 32, 35, 40, 50, 63, 80, 100, 125, 160];
  const RCD_TYP = ['', 'A', 'F', 'B', 'B+', 'EV', 'A S', 'B S'];
  const IDN = ['', 10, 30, 100, 300, 500];
  const FELDER = ['vert', 'ziel', 'typ', 'leit', 'l', 'art', 'in', 'zs', 'rlpe', 'rnpe', 'rpe', 'rtyp', 'idn', 'id', 'ta', 'ub', 'afdd'];

  function zelle(f, d) {
    const v = d && d[f] !== undefined ? d[f] : '';
    const t = function (ph, cls) { return '<td><input type="text" class="' + (cls || 'z') + '" data-f="' + f + '" ' + (cls === 'txt' ? '' : 'inputmode="decimal" ') + 'placeholder="' + ph + '" value="' + esc(v) + '" aria-label="' + ph + '"></td>'; };
    const s = function (liste, lab) { return '<td><select data-f="' + f + '" aria-label="' + lab + '">' + opt(liste, v) + '</select></td>'; };
    switch (f) {
      case 'vert': return t('UV', 'txt');
      case 'ziel': return t('Stromkreis / Ziel', 'txt');
      case 'typ': return t('NYM-J', 'txt');
      case 'leit': return s(LEITUNGEN, 'Adern und Querschnitt');
      case 'l': return t('m');
      case 'art': return s(ARTEN, 'Art des Schutzorgans');
      case 'in': return s(NENN.map(function (n) { return [String(n), n === '' ? '–' : String(n)]; }), 'Bemessungsstrom');
      case 'zs': return t('Ω') + '<td class="ik" data-a="ik">–</td>';
      case 'rlpe': return t('MΩ');
      case 'rnpe': return t('MΩ');
      case 'rpe': return t('Ω');
      case 'rtyp': return s(RCD_TYP.map(function (n) { return [n, n || '–']; }), 'RCD-Typ');
      case 'idn': return s(IDN.map(function (n) { return [String(n), n === '' ? '–' : String(n)]; }), 'Bemessungsdifferenzstrom');
      case 'id': return t('mA');
      case 'ta': return t('ms');
      case 'ub': return t('V');
      case 'afdd': return s([['', '–'], ['ja', 'ja'], ['nein', 'nein']], 'Fehlerlichtbogen-Schutz');
    }
    return '<td></td>';
  }
  window.addMeasurementRow = function (d) {
    const tb = $('measurement-tbody'); if (!tb) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="center"><span class="row-num">' + (tb.rows.length + 1) + '</span></td>' + FELDER.map(function (f) { return zelle(f, d); }).join('') +
      '<td class="ergebnis-zelle" data-a="erg">–</td><td class="center"><button type="button" class="btn btn-small btn-weg" aria-label="Stromkreis entfernen" onclick="this.closest(\'tr\').remove(); updateRowNumbers();">✕</button></td>';
    tb.appendChild(tr);
    return tr;
  };
  function zeilenwerte(tr) {
    const o = {};
    tr.querySelectorAll('[data-f]').forEach(function (x) { o[x.dataset.f] = x.value; });
    return o;
  }
  window.stromkreisKopieren = function () {
    const tb = $('measurement-tbody'); if (!tb) return;
    const letzte = tb.rows[tb.rows.length - 1];
    const d = letzte ? zeilenwerte(letzte) : {};
    ['ziel', 'l', 'zs', 'rlpe', 'rnpe', 'rpe', 'id', 'ta', 'ub'].forEach(function (k) { d[k] = ''; });
    window.addMeasurementRow(d);
    pruefeAlles();
  };

  function markiere(tr, f, ok) {
    const e = tr.querySelector('[data-f="' + f + '"]'); if (!e) return;
    e.classList.toggle('grenz-fehl', ok === false);
    e.classList.toggle('grenz-ok', ok === true);
  }
  function pruefeStromkreis(tr) {
    const d = zeilenwerte(tr), grund = [], hinweis = [];
    const U0 = +wert('a-u0') || 230, UL = +wert('a-ul') || 50, iso = +wert('a-isospg') || 500, tt = wert('a-netz') === 'TT';
    const isoMin = iso === 250 ? 0.5 : 1;
    const zs = lies(d.zs), In = +d['in'], ia = abschaltstrom(d.art, In), idn = +d.idn;
    let gemessen = false;
    // Schleifenimpedanz und Kurzschlussstrom
    const ikZelle = tr.querySelector('[data-a="ik"]');
    if (isFinite(zs) && zs > 0) {
      gemessen = true;
      ikZelle.textContent = zahl(U0 / zs, 0);
      const zsMax = 2 / 3 * U0 / ia;
      if (isFinite(zsMax)) {
        const ok = zs <= zsMax;
        if (!ok && idn > 0 && !tt) { hinweis.push('Z_S ' + zahl(zs, 2) + ' Ω > ' + zahl(zsMax, 2) + ' Ω: Abschaltung nur über RCD'); markiere(tr, 'zs', null); }
        else { markiere(tr, 'zs', ok); if (!ok) grund.push('Z_S ' + zahl(zs, 2) + ' Ω > ' + zahl(zsMax, 2) + ' Ω (2/3 · U₀/I_a, I_a = ' + zahl(ia, 0) + ' A)'); }
      } else { markiere(tr, 'zs', null); if (!d.art) hinweis.push('Schutzorgan fehlt für die Bewertung von Z_S'); }
    } else { ikZelle.textContent = '–'; markiere(tr, 'zs', null); }
    // Isolationswiderstand
    ['rlpe', 'rnpe'].forEach(function (k) {
      const r = lies(d[k]);
      if (isFinite(r)) { gemessen = true; const ok = r >= isoMin; markiere(tr, k, ok); if (!ok) grund.push('R_iso ' + (k === 'rlpe' ? 'L–PE' : 'N–PE') + ' ' + zahl(r, 2) + ' MΩ < ' + zahl(isoMin, 1) + ' MΩ'); }
      else markiere(tr, k, null);
    });
    // Schutzleiter
    const rpe = lies(d.rpe);
    if (isFinite(rpe)) {
      gemessen = true;
      const teile = String(d.leit || '').split('x'), A = +teile[1], l = lies(d.l);
      const erwartet = A > 0 && l > 0 ? 1.5 * 0.0178 * l / A + 0.1 : NaN;
      // R_PE: über 1 Ω n.i.O. (Richtwert), über dem Leitungswert Hinweis auf Übergangswiderstände
      if (rpe > 1) { markiere(tr, 'rpe', false); grund.push('R_PE ' + zahl(rpe, 2) + ' Ω > 1 Ω'); }
      else if (isFinite(erwartet) && rpe > erwartet) { markiere(tr, 'rpe', null); hinweis.push('R_PE ' + zahl(rpe, 2) + ' Ω höher als der Leitungswert ' + zahl(erwartet, 2) + ' Ω – Klemmstellen prüfen'); }
      else markiere(tr, 'rpe', true);
    } else markiere(tr, 'rpe', null);
    // Fehlerstrom-Schutzeinrichtung
    const id = lies(d.id), ta = lies(d.ta), ub = lies(d.ub), selektiv = /S$/.test(d.rtyp || '');
    if (idn > 0) {
      if (isFinite(id)) { gemessen = true; const ok = id >= 0.5 * idn && id <= idn; markiere(tr, 'id', ok); if (!ok) grund.push('I_Δ ' + zahl(id, 0) + ' mA außerhalb 50–100 % von ' + idn + ' mA'); } else markiere(tr, 'id', null);
      if (isFinite(ta)) { gemessen = true; const ok = selektiv ? ta >= 130 && ta <= 500 : ta <= 300; markiere(tr, 'ta', ok); if (!ok) grund.push('t_A ' + zahl(ta, 0) + ' ms ' + (selektiv ? 'außerhalb 130–500 ms' : '> 300 ms')); } else markiere(tr, 'ta', null);
      if (!d.rtyp) hinweis.push('RCD-Typ angeben');
    } else { markiere(tr, 'id', null); markiere(tr, 'ta', null); }
    if (isFinite(ub)) { gemessen = true; const ok = ub <= UL; markiere(tr, 'ub', ok); if (!ok) grund.push('U_B ' + zahl(ub, 1) + ' V > U_L ' + UL + ' V'); } else markiere(tr, 'ub', null);
    if (tt && idn > 0) { const ra = lies(wert('a-re')); if (isFinite(ra) && ra * idn / 1000 > UL) grund.push('TT: R_A · I_Δn = ' + zahl(ra * idn / 1000, 1) + ' V > ' + UL + ' V'); }
    if (tt && !(idn > 0) && gemessen) hinweis.push('TT-System ohne RCD: Abschaltbedingung prüfen');
    const erg = tr.querySelector('[data-a="erg"]');
    erg.classList.remove('erg-ok', 'erg-fehl', 'erg-hinweis');
    if (!gemessen) { erg.textContent = '–'; erg.title = ''; return { status: 'leer' }; }
    if (grund.length) { erg.textContent = 'n.i.O.'; erg.classList.add('erg-fehl'); }
    else if (hinweis.length) { erg.textContent = 'i.O.*'; erg.classList.add('erg-hinweis'); }
    else { erg.textContent = 'i.O.'; erg.classList.add('erg-ok'); }
    erg.title = grund.concat(hinweis).join('\n');
    return { status: grund.length ? 'fehl' : 'ok', grund: grund, hinweis: hinweis, d: d, nr: tr.querySelector('.row-num').textContent };
  }

  // ---------- Mängel ----------
  window.addMangelRow = function () {
    const tb = $('maengel-tbody'); if (!tb) return;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="center"><span class="row-num">' + (tb.rows.length + 1) + '</span></td>' +
      '<td><input type="text" class="txt" placeholder="Beschreibung des Mangels" aria-label="Mangel"></td>' +
      '<td><input type="text" class="txt" placeholder="Ort, Stromkreis" aria-label="Ort"></td>' +
      '<td><select aria-label="Einstufung">' + opt([['', '–'], ['gering', 'geringfügig'], ['erheblich', 'erheblich'], ['gefahr', 'gefährlich – sofort']], '') + '</select></td>' +
      '<td><input type="date" aria-label="Frist"></td><td><input type="date" aria-label="behoben am"></td>' +
      '<td class="center"><button type="button" class="btn btn-small btn-weg" aria-label="Mangel entfernen" onclick="this.closest(\'tr\').remove(); updateRowNumbers();">✕</button></td>';
    tb.appendChild(tr);
    return tr;
  };

  // ---------- Geräteprüfung ----------
  function geraetGrenzen(sk, laenge, heizKW, art) {
    const g = {};
    const l = isFinite(laenge) && laenge > 0 ? laenge : 5;
    g.rpe = sk === 'I' || art === 'verl' || art === 'mehrfach' || art === 'lade' ? Math.min(1, 0.3 + Math.max(0, Math.ceil((l - 5) / 7.5 - 1e-9)) * 0.1) : NaN;
    g.riso = sk === 'II' ? 2 : sk === 'III' ? 0.25 : heizKW > 0 ? 0.3 : 1;
    g.ipe = sk === 'I' ? (heizKW > 3.5 ? Math.min(10, heizKW) : 3.5) : NaN;
    g.iber = 0.5;
    g.iabl = sk === 'I' ? g.ipe : 0.5;
    return g;
  }
  function pruefeGeraet() {
    if (!$('g-rpe')) return;
    const sk = wert('g-sk'), art = wert('g-art'), g = geraetGrenzen(sk, lies(wert('g-laenge')), lies(wert('g-heiz')) || 0, art);
    const fehler = [], fehlend = [];
    const feld = function (k, grenze, groesser, text, einheit, noetig) {
      const v = lies(wert('g-' + k)), gz = $('g-' + k + '-grenze'), u = $('g-' + k + '-urteil'), e = $('g-' + k);
      if (gz) gz.textContent = isFinite(grenze) ? (groesser ? '≥ ' : '≤ ') + zahl(grenze, grenze < 1 ? 2 : 1) + ' ' + einheit : 'entfällt';
      let ok = null;
      if (isFinite(v) && isFinite(grenze)) ok = groesser ? v >= grenze : v <= grenze;
      if (u) { u.textContent = ok === null ? (isFinite(grenze) && noetig ? 'fehlt' : '–') : ok ? 'i.O.' : 'n.i.O.'; u.className = ok === null ? '' : ok ? 'erg-ok' : 'erg-fehl'; }
      if (e) { e.classList.toggle('grenz-fehl', ok === false); e.classList.toggle('grenz-ok', ok === true); }
      if (ok === false) fehler.push(text + ' ' + zahl(v, 2) + ' ' + einheit + (groesser ? ' < ' : ' > ') + zahl(grenze, 2) + ' ' + einheit);
      if (ok === null && isFinite(grenze) && noetig) fehlend.push(text);
    };
    const schutzleiter = sk === 'I' || art === 'verl' || art === 'mehrfach' || art === 'lade';
    feld('rpe', g.rpe, false, 'R_PE', 'Ω', schutzleiter);
    feld('riso', g.riso, true, 'R_iso', 'MΩ', !lies(wert('g-iabl')) && !lies(wert('g-ipe')) && !lies(wert('g-iber')));
    feld('ipe', g.ipe, false, 'I_PE', 'mA', false);
    feld('iber', sk === 'III' ? NaN : g.iber, false, 'I_B', 'mA', false);
    feld('iabl', sk === 'III' ? NaN : g.iabl, false, 'I_EA', 'mA', false);
    const trcd = lies(wert('g-trcd')), ur = $('g-trcd-urteil');
    if (ur) { ur.textContent = isFinite(trcd) ? (trcd <= 300 ? 'i.O.' : 'n.i.O.') : '–'; ur.className = isFinite(trcd) ? (trcd <= 300 ? 'erg-ok' : 'erg-fehl') : ''; }
    if (isFinite(trcd) && trcd > 300) fehler.push('t_A ' + zahl(trcd, 0) + ' ms > 300 ms');
    if (wert('g-polaritaet') === 'nok') fehler.push('Polarität oder Durchgang fehlerhaft');
    const sicht = document.querySelectorAll('#tab-geraet .pruefliste input[value="nio"]:checked').length;
    if (sicht) fehler.push(sicht + ' Mangel' + (sicht > 1 ? '' : '') + ' bei der Sichtprüfung');
    const fkt = document.querySelector('input[name="g-funktion"]:checked');
    if (fkt && fkt.value === 'nok') fehler.push('Funktionsprüfung nicht bestanden');
    const box = $('g-vorschlag');
    if (box) {
      let html;
      if (fehler.length) html = '<b class="erg-fehl">Vorschlag: nicht bestanden.</b> ' + esc(fehler.join(' · '));
      else if (fehlend.length) html = '<b>Noch offen:</b> ' + esc(fehlend.join(', ')) + (sk === 'I' ? '' : '');
      else html = '<b class="erg-ok">Vorschlag: bestanden.</b> Alle eingetragenen Werte halten die Grenzwerte ein.';
      const kal = wert('g-mg-kal'), dat = wert('g-datum');
      if (kal && dat && kal < dat) html += '<br><b class="erg-fehl">Messgerät:</b> Kalibrierung am ' + datumDe(kal) + ' abgelaufen.';
      box.innerHTML = html;
    }
    autoDatum('g-naechster', wert('g-datum'), +wert('g-intervall'));
  }
  window.geraetInListe = function () {
    const tr = window.addGeraetRow();
    if (!tr) return;
    const f = tr.querySelectorAll('input, select');
    const ipe = wert('g-ipe') || wert('g-iber') || wert('g-iabl');
    const sichtNio = document.querySelectorAll('#tab-geraet .pruefliste input[value="nio"]:checked').length;
    const fkt = document.querySelector('input[name="g-funktion"]:checked');
    const werte = [wert('g-inv'), wert('g-geraet') + (wert('g-modell') ? ' ' + wert('g-modell') : ''), wert('g-standort'), wert('g-sk'), wert('g-laenge'), sichtNio ? 'nio' : 'io', wert('g-rpe'), wert('g-riso'), ipe, fkt ? (fkt.value === 'nok' ? 'nio' : fkt.value === 'ok' ? 'io' : '') : '', wert('g-bemerkungen').slice(0, 80)];
    werte.forEach(function (w, i) { if (f[i]) f[i].value = w; });
    updateRowNumbers();
    window.switchTab('liste');
  };

  // ---------- Geräteliste ----------
  window.addGeraetRow = function () {
    const tb = $('geraete-tbody'); if (!tb) return;
    const tr = document.createElement('tr');
    const t = function (ph, cls) { return '<td><input type="text" class="' + (cls || 'z') + '" ' + (cls === 'txt' ? '' : 'inputmode="decimal" ') + 'placeholder="' + ph + '" aria-label="' + ph + '"></td>'; };
    tr.innerHTML = '<td class="center"><span class="row-num">' + (tb.rows.length + 1) + '</span></td>' + t('Inventar', 'txt') + t('Bezeichnung', 'txt') + t('Standort', 'txt') +
      '<td><select aria-label="Schutzklasse">' + opt([['I', 'I'], ['II', 'II'], ['III', 'III']], 'I') + '</select></td>' + t('m') +
      '<td><select aria-label="Sichtprüfung">' + opt([['', '–'], ['io', 'i.O.'], ['nio', 'n.i.O.']], '') + '</select></td>' + t('Ω') + t('MΩ') + t('mA') +
      '<td><select aria-label="Funktion">' + opt([['', '–'], ['io', 'i.O.'], ['nio', 'n.i.O.']], '') + '</select></td>' +
      '<td class="ergebnis-zelle" data-a="erg">–</td><td data-a="naechste">–</td>' + t('Bemerkung', 'txt') +
      '<td class="center"><button type="button" class="btn btn-small btn-weg" aria-label="Gerät entfernen" onclick="this.closest(\'tr\').remove(); updateRowNumbers();">✕</button></td>';
    tb.appendChild(tr);
    return tr;
  };
  function pruefeListenzeile(tr) {
    const f = tr.querySelectorAll('input, select');
    const sk = f[3].value, l = lies(f[4].value), sicht = f[5].value, rpe = lies(f[6].value), riso = lies(f[7].value), i = lies(f[8].value), fkt = f[9].value;
    const g = geraetGrenzen(sk, l, 0, 'geraet'), grund = [];
    const mark = function (e, ok) { e.classList.toggle('grenz-fehl', ok === false); e.classList.toggle('grenz-ok', ok === true); };
    if (isFinite(rpe) && isFinite(g.rpe)) { mark(f[6], rpe <= g.rpe); if (rpe > g.rpe) grund.push('R_PE > ' + zahl(g.rpe, 1) + ' Ω'); } else mark(f[6], null);
    if (isFinite(riso)) { mark(f[7], riso >= g.riso); if (riso < g.riso) grund.push('R_iso < ' + zahl(g.riso, 2) + ' MΩ'); } else mark(f[7], null);
    const igr = sk === 'I' ? 3.5 : 0.5;
    if (isFinite(i) && sk !== 'III') { mark(f[8], i <= igr); if (i > igr) grund.push('Strom > ' + zahl(igr, 1) + ' mA'); } else mark(f[8], null);
    if (sicht === 'nio') grund.push('Sichtprüfung');
    if (fkt === 'nio') grund.push('Funktion');
    const gemessen = isFinite(rpe) || isFinite(riso) || isFinite(i) || sicht || fkt;
    const erg = tr.querySelector('[data-a="erg"]');
    erg.classList.remove('erg-ok', 'erg-fehl');
    erg.textContent = !gemessen ? '–' : grund.length ? 'n.i.O.' : 'i.O.';
    if (gemessen) erg.classList.add(grund.length ? 'erg-fehl' : 'erg-ok');
    erg.title = grund.join('\n');
    const nx = tr.querySelector('[data-a="naechste"]');
    nx.textContent = gemessen && !grund.length ? datumDe(datumPlus(wert('l-datum'), +wert('l-intervall'))) : '–';
    return gemessen ? (grund.length ? 'fehl' : 'ok') : 'leer';
  }
  window.listeCsv = function () {
    const kopf = ['Nr', 'Inventar-Nr', 'Bezeichnung', 'Standort', 'Schutzklasse', 'Leitung m', 'Sichtprüfung', 'RPE Ohm', 'Riso MOhm', 'IPE/IB mA', 'Funktion', 'Ergebnis', 'Nächste Prüfung', 'Bemerkung'];
    const zeilen = [kopf];
    document.querySelectorAll('#geraete-tbody tr').forEach(function (tr) {
      const f = tr.querySelectorAll('input, select');
      const z = [tr.querySelector('.row-num').textContent];
      for (let i = 0; i < 10; i++) z.push(f[i].value);
      z.push(tr.querySelector('[data-a="erg"]').textContent, tr.querySelector('[data-a="naechste"]').textContent, f[10].value);
      if (z.slice(1).some(function (x) { return x && x !== '–' && x !== 'I'; })) zeilen.push(z);
    });
    const csv = '﻿' + zeilen.map(function (z) { return z.map(function (x) { x = String(x == null ? '' : x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(';'); }).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'geraeteliste-' + (wert('l-datum') || new Date().toISOString().slice(0, 10)) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };

  // ---------- Prüflisten ----------
  window.alleIo = function (praefix) {
    let n = 0;
    for (let i = 1; i < 200; i++) {
      const io = $(praefix + i + '-io'); if (!io) break;
      if (!document.querySelector('input[name="' + praefix + i + '"]:checked')) { io.checked = true; io.dispatchEvent(new Event('change', { bubbles: true })); n++; }
    }
    pruefeAlles();
    return n;
  };
  function zaehle(praefix) {
    const r = { io: 0, nio: 0, na: 0, offen: 0 };
    for (let i = 1; i < 200; i++) {
      if (!$(praefix + i + '-io')) break;
      const c = document.querySelector('input[name="' + praefix + i + '"]:checked');
      if (c) r[c.value]++; else r.offen++;
    }
    return r;
  }

  // ---------- Prüffrist ----------
  const autoWerte = {};
  function autoDatum(id, basis, monate) {
    const e = $(id); if (!e) return;
    const neu = datumPlus(basis, monate);
    if (!neu) return;
    if (!e.value || e.value === autoWerte[id]) { e.value = neu; autoWerte[id] = neu; }
  }

  // ---------- Gesamtauswertung ----------
  window.updateRowNumbers = function () {
    ['measurement-tbody', 'maengel-tbody', 'geraete-tbody'].forEach(function (id) {
      const tb = $(id); if (!tb) return;
      Array.prototype.forEach.call(tb.rows, function (tr, i) { const n = tr.querySelector('.row-num'); if (n) n.textContent = i + 1; });
    });
    pruefeAlles();
  };
  function pruefeAlles() {
    // Anlage
    const tb = $('measurement-tbody');
    if (tb) {
      const erg = Array.prototype.map.call(tb.rows, pruefeStromkreis);
      const gem = erg.filter(function (x) { return x.status !== 'leer'; }), fehl = gem.filter(function (x) { return x.status === 'fehl'; });
      const b = zaehle('b'), e = zaehle('e');
      const maengel = Array.prototype.map.call(($('maengel-tbody') || { rows: [] }).rows, function (tr) { const f = tr.querySelectorAll('input, select'); return { text: f[0].value, stufe: f[2].value, behoben: f[4].value }; }).filter(function (m) { return m.text; });
      const offen = maengel.filter(function (m) { return !m.behoben; }), gefahr = offen.filter(function (m) { return m.stufe === 'gefahr'; });
      const teile = [];
      teile.push('<b>' + gem.length + '</b> Stromkreise gemessen, <b class="' + (fehl.length ? 'erg-fehl' : 'erg-ok') + '">' + fehl.length + ' n.i.O.</b>');
      if (fehl.length) teile.push(fehl.map(function (x) { return 'Nr. ' + esc(x.nr) + (x.d.ziel ? ' (' + esc(x.d.ziel) + ')' : '') + ': ' + esc(x.grund.join(', ')); }).join('<br>'));
      const hin = gem.filter(function (x) { return x.status === 'ok' && x.hinweis.length; });
      if (hin.length) teile.push('<span class="klein">* Hinweise: ' + hin.map(function (x) { return 'Nr. ' + esc(x.nr) + ': ' + esc(x.hinweis.join(', ')); }).join('; ') + '</span>');
      teile.push('Besichtigung: ' + b.io + ' i.O., <b class="' + (b.nio ? 'erg-fehl' : '') + '">' + b.nio + ' n.i.O.</b>, ' + b.na + ' entfällt' + (b.offen ? ', <b>' + b.offen + ' offen</b>' : '') +
        ' · Erprobung: ' + e.io + ' i.O., <b class="' + (e.nio ? 'erg-fehl' : '') + '">' + e.nio + ' n.i.O.</b>, ' + e.na + ' entfällt' + (e.offen ? ', <b>' + e.offen + ' offen</b>' : ''));
      const kal = wert('a-mg-kal'), dat = wert('a-datum');
      if (kal && dat && kal < dat) teile.push('<b class="erg-fehl">Messgerät:</b> Kalibrierung am ' + datumDe(kal) + ' abgelaufen – Messwerte nicht verwertbar.');
      if (!wert('a-mg-typ') && !wert('a-mg-fabrikat') && gem.length) teile.push('<b>Messgerät</b> eintragen (Hersteller, Typ, Seriennummer, Kalibrierung).');
      const box = $('a-auswertung'); if (box) box.innerHTML = teile.join('<br>');
      const v = $('a-vorschlag');
      if (v) {
        let t;
        if (gefahr.length) t = '<b class="erg-fehl">Vorschlag: Anlage darf nicht betrieben werden</b> – ' + gefahr.length + ' gefährliche' + (gefahr.length > 1 ? '' : 'r') + ' Mangel offen.';
        else if (fehl.length || b.nio || e.nio || offen.length) t = '<b class="erg-fehl">Vorschlag: Mängel festgestellt</b> – ' + (fehl.length + b.nio + e.nio) + ' Prüfpunkt' + (fehl.length + b.nio + e.nio === 1 ? '' : 'e') + ' n.i.O., ' + offen.length + ' ' + (offen.length === 1 ? 'Mangel' : 'Mängel') + ' offen.';
        else if (gem.length && !b.offen && !e.offen) t = '<b class="erg-ok">Vorschlag: keine Mängel festgestellt.</b>';
        else t = 'Noch nicht vollständig: ' + (b.offen + e.offen) + ' Prüfpunkte ohne Bewertung' + (gem.length ? '' : ', keine Messwerte') + '.';
        v.innerHTML = t;
      }
      autoDatum('a-naechste', wert('a-datum'), +wert('a-frist'));
    }
    pruefeGeraet();
    // Geräteliste
    const gl = $('geraete-tbody');
    if (gl) {
      const s = Array.prototype.map.call(gl.rows, pruefeListenzeile);
      const ok = s.filter(function (x) { return x === 'ok'; }).length, f = s.filter(function (x) { return x === 'fehl'; }).length;
      const box = $('l-auswertung');
      if (box) {
        let t = '<b>' + (ok + f) + '</b> Geräte geprüft: <b class="erg-ok">' + ok + ' bestanden</b>, <b class="' + (f ? 'erg-fehl' : '') + '">' + f + ' nicht bestanden</b>.';
        if (f) t += ' Nicht bestandene Geräte sofort außer Betrieb nehmen und kennzeichnen.';
        const kal = wert('l-mg-kal'), dat = wert('l-datum');
        if (kal && dat && kal < dat) t += '<br><b class="erg-fehl">Messgerät:</b> Kalibrierung am ' + datumDe(kal) + ' abgelaufen.';
        box.innerHTML = t;
      }
    }
  }
  window.pruefeAlles = pruefeAlles;
  let geplant = false;
  function planen() { if (geplant) return; geplant = true; requestAnimationFrame(function () { geplant = false; pruefeAlles(); }); }
  document.addEventListener('input', function (ev) {
    if (ev.target && autoWerte[ev.target.id] !== undefined && ev.isTrusted) delete autoWerte[ev.target.id];
    planen();
  });
  document.addEventListener('change', planen);

  // ---------- Stammdaten richtig übernehmen (Firma = Auftragnehmer) ----------
  window.applyStammdaten = function () {
    const firma = wert('sd-firma'), adr = [wert('sd-str'), wert('sd-ort')].filter(Boolean).join(', '), p1 = wert('sd-p1'), bef = wert('sd-p1-bef'), mst = wert('sd-meister');
    const setze = function (id, v) { const e = $(id); if (e && !e.value && v) { e.value = v; return 1; } return 0; };
    let n = 0;
    n += setze('a-auftragnehmer', firma + (adr ? ', ' + adr : ''));
    n += setze('a-pruefer', p1 + (bef ? ' (' + bef + ')' : ''));
    n += setze('a-vefk', mst);
    n += setze('g-pruefer', p1); n += setze('l-pruefer', p1);
    pruefeAlles();
    alert(n ? '✓ ' + n + ' Felder aus den Stammdaten übernommen.' : 'Keine leeren Felder gefunden oder keine Stammdaten eingetragen.');
  };

  // ---------- Briefkopf im PDF ----------
  window.addEventListener('beforeprint', function () {
    const firma = wert('sd-firma');
    const zeilen = [wert('sd-str'), wert('sd-ort'), [wert('sd-tel') ? 'Tel. ' + wert('sd-tel') : '', wert('sd-mail')].filter(Boolean).join(' · '), wert('sd-web'), wert('sd-innung') ? 'Innung: ' + wert('sd-innung') : ''].filter(Boolean);
    document.querySelectorAll('.briefkopf').forEach(function (b) {
      b.innerHTML = firma ? '<div class="bk-firma">' + esc(firma) + '</div><div class="bk-adresse">' + zeilen.map(esc).join('<br>') + '</div>' : '';
    });
    // leere Zeilen nicht drucken
    ['measurement-tbody', 'maengel-tbody', 'geraete-tbody'].forEach(function (id) {
      const tb = $(id); if (!tb) return;
      Array.prototype.forEach.call(tb.rows, function (tr) {
        const leer = !Array.prototype.some.call(tr.querySelectorAll('input[type="text"], input[type="date"], select'), function (x) {
          if (x.tagName === 'SELECT') return x.value && x !== tr.querySelector('select[aria-label="Schutzklasse"]');
          return x.value && !(x.dataset.f === 'typ' && x.value === 'NYM-J');
        });
        tr.classList.toggle('leer-zeile', leer);
      });
    });
    pruefeAlles();
  });
  window.addEventListener('afterprint', function () { document.querySelectorAll('.leer-zeile').forEach(function (tr) { tr.classList.remove('leer-zeile'); }); });

  // ---------- Start ----------
  window.addEventListener('DOMContentLoaded', function () {
    const heute = new Date().toISOString().slice(0, 10);
    ['l-datum', 'l-datum-pruefer', 'l-datum-ag'].forEach(function (id) { const e = $(id); if (e && !e.value) e.value = heute; });
    if ($('maengel-tbody') && !$('maengel-tbody').rows.length) for (let i = 0; i < 3; i++) window.addMangelRow();
    if ($('geraete-tbody') && !$('geraete-tbody').rows.length) for (let i = 0; i < 5; i++) window.addGeraetRow();
    pruefeAlles();
  });
  window.addEventListener('load', function () { setTimeout(pruefeAlles, 50); });
})();
