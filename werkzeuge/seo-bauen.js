#!/usr/bin/env node
/*
 * Auffindbarkeit in Suchmaschinen – nach jeder neuen oder umbenannten Seite ausführen:
 *   node werkzeuge/seo-bauen.js
 * Schreibt in jede Seite einen Block zwischen <!-- seo --> und <!-- /seo -->:
 *   kanonische Adresse, Vorschau für Messenger und soziale Netzwerke (Open Graph), strukturierte Daten (JSON-LD).
 * Ergänzt „ – Formeln & Rechner“ im Titel der Unterseiten, die feste Linkliste der Startseite (<noscript>),
 * sitemap.xml (Änderungsdatum aus Git) und robots.txt.
 * Nur Node.js, keine Pakete. Die Seiten selbst bleiben reines HTML, CSS und JavaScript.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WURZEL = path.join(__dirname, '..');
const DOMAIN = 'https://' + fs.readFileSync(path.join(WURZEL, 'CNAME'), 'utf8').trim();
const MARKE = 'Formeln & Rechner';
const ZUSATZ = ' – ' + MARKE;
const BILD = DOMAIN + '/assets/symbol-512.png';
const NICHT_INDEXIEREN = ['projektmappe.html'];   // persönliche Ablage im Browser, kein eigener Inhalt

function seiten(ordner, rel) {
  let liste = [];
  fs.readdirSync(ordner, { withFileTypes: true }).forEach(function (e) {
    if (e.name.startsWith('.') || ['assets', 'werkzeuge', 'node_modules'].indexOf(e.name) >= 0) return;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) liste = liste.concat(seiten(path.join(ordner, e.name), r));
    else if (e.name.endsWith('.html') && e.name !== '404.html') liste.push(r);
  });
  return liste.sort(function (a, b) { return (a !== 'index.html') - (b !== 'index.html') || a.localeCompare(b); });
}
const attr = function (t) { return String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const html = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const entities = function (t) { return t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); };
function datum(rel) {
  try { const d = execSync('git log -1 --format=%cs -- "' + rel + '"', { cwd: WURZEL }).toString().trim(); if (d) return d; } catch (e) { /* ohne Git */ }
  return new Date().toISOString().slice(0, 10);
}

const alle = seiten(WURZEL, '');
const karte = [];
alle.forEach(function (rel) {
  const datei = path.join(WURZEL, rel);
  let s = fs.readFileSync(datei, 'utf8');
  const url = DOMAIN + '/' + (rel === 'index.html' ? '' : rel);
  // Titel: Unterseiten bekommen den Namen der Sammlung dazu
  let titel = entities((/<title>([^<]*)<\/title>/.exec(s) || ['', MARKE])[1]);
  const kurz = titel.endsWith(ZUSATZ) ? titel.slice(0, -ZUSATZ.length) : titel;
  if (rel !== 'index.html' && !titel.endsWith(ZUSATZ)) { titel = kurz + ZUSATZ; s = s.replace(/<title>[^<]*<\/title>/, '<title>' + html(titel) + '</title>'); }
  const beschreibung = entities((/<meta name="description" content="([^"]*)"/.exec(s) || ['', ''])[1]);
  const daten = rel === 'index.html'
    ? { '@context': 'https://schema.org', '@type': 'WebSite', name: MARKE, url: url, inLanguage: 'de', description: beschreibung }
    : { '@context': 'https://schema.org', '@type': 'WebPage', name: kurz, url: url, inLanguage: 'de', description: beschreibung, isPartOf: { '@type': 'WebSite', name: MARKE, url: DOMAIN + '/' } };
  const block = [
    '  <!-- seo -->',
    '  <link rel="canonical" href="' + attr(url) + '">',
    NICHT_INDEXIEREN.indexOf(rel) >= 0 ? '  <meta name="robots" content="noindex, follow">' : '',
    '  <meta property="og:type" content="website">',
    '  <meta property="og:site_name" content="' + attr(MARKE) + '">',
    '  <meta property="og:locale" content="de_DE">',
    '  <meta property="og:title" content="' + attr(kurz) + '">',
    '  <meta property="og:description" content="' + attr(beschreibung) + '">',
    '  <meta property="og:url" content="' + attr(url) + '">',
    '  <meta property="og:image" content="' + attr(BILD) + '">',
    '  <meta name="twitter:card" content="summary">',
    '  <script type="application/ld+json">' + JSON.stringify(daten).replace(/</g, '\\u003c') + '</script>',
    '  <!-- /seo -->'
  ].filter(Boolean).join('\n');
  if (/<!-- seo -->[\s\S]*?<!-- \/seo -->/.test(s)) s = s.replace(/ *<!-- seo -->[\s\S]*?<!-- \/seo -->/, block.replace(/^ {2}/, '  '));
  else s = s.replace(/(<meta name="description" content="[^"]*">)/, '$1\n' + block);
  fs.writeFileSync(datei, s);
  if (NICHT_INDEXIEREN.indexOf(rel) < 0) karte.push({ url: url, datum: datum(rel) });
});

// Startseite: feste Linkliste aller Seiten (für Suchmaschinen und Browser ohne JavaScript)
const startDatei = path.join(WURZEL, 'index.html');
let start = fs.readFileSync(startDatei, 'utf8');
const q = "'((?:\\\\'|[^'])*)'";
const re = new RegExp('titel: ' + q + ',[\\s\\S]*?pfad: ' + q + ',[\\s\\S]*?text: ' + q, 'g');
const eintraege = []; let m;
const quelle = start.slice(start.indexOf('const eintraege'));
while ((m = re.exec(quelle))) eintraege.push({ titel: m[1].replace(/\\'/g, "'"), pfad: m[2], text: m[3].replace(/\\'/g, "'") });
const liste = '<!-- linkliste -->\n  <noscript>\n    <section class="seite alle-links" aria-label="Alle Rechner">\n      <h2>Alle Rechner und Werkzeuge</h2>\n      <ul>\n' +
  eintraege.map(function (e) { return '        <li><a href="' + attr(e.pfad) + '">' + html(e.titel) + '</a> – ' + html(e.text) + '</li>'; }).join('\n') +
  '\n      </ul>\n    </section>\n  </noscript>\n  <!-- /linkliste -->';
if (/<!-- linkliste -->[\s\S]*?<!-- \/linkliste -->/.test(start)) start = start.replace(/<!-- linkliste -->[\s\S]*?<!-- \/linkliste -->/, liste);
else start = start.replace(/(\n\s*<div id="seitenfuss")/, '\n  ' + liste + '$1');
fs.writeFileSync(startDatei, start);

// sitemap.xml und robots.txt
fs.writeFileSync(path.join(WURZEL, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  karte.map(function (k) { return '  <url><loc>' + html(k.url) + '</loc><lastmod>' + k.datum + '</lastmod></url>'; }).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(WURZEL, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: ' + DOMAIN + '/sitemap.xml\n');
console.log(alle.length + ' Seiten, ' + karte.length + ' in der Sitemap, ' + eintraege.length + ' Links auf der Startseite, Domain ' + DOMAIN);
