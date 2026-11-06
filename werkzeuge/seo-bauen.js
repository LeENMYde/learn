#!/usr/bin/env node
/*
 * Auffindbarkeit in Suchmaschinen – nach jeder neuen oder umbenannten Seite ausführen:
 *   node werkzeuge/seo-bauen.js
 * Schreibt in jede Seite einen Block zwischen <!-- seo --> und <!-- /seo -->:
 *   kanonische Adresse, Robots-Angabe, Vorschau für Messenger und soziale Netzwerke (Open Graph, eigenes Bild aus
 *   assets/og/<pfad-mit-bindestrichen>.png, sonst das Symbol), strukturierte Daten (JSON-LD als @graph: WebPage,
 *   BreadcrumbList, FAQPage aus einem sichtbaren <div class="faq"> mit <details>, Zusatzangaben aus werkzeuge/seo-daten.json).
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
const ZUSATZDATEN = (function () { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'seo-daten.json'), 'utf8')); } catch (e) { return {}; } })();
const HERAUSGEBER = { '@type': 'Organization', '@id': DOMAIN + '/#herausgeber', name: MARKE, url: DOMAIN + '/', logo: BILD };

// Sichtbare häufige Fragen der Seite (<div class="faq"> mit <details><summary>Frage</summary><p>Antwort</p></details>)
const nurText = function (t) { return entities(t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).replace(/&nbsp;/g, ' '); };
function fragen(s) {
  const block = /<div class="faq">([\s\S]*?)<\/div>/.exec(s);
  if (!block) return [];
  const liste = []; const re = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g; let m;
  while ((m = re.exec(block[1]))) liste.push({ '@type': 'Question', name: nurText(m[1]), acceptedAnswer: { '@type': 'Answer', text: nurText(m[2]) } });
  return liste;
}
function vorschaubild(rel) {
  const name = rel.replace(/\.html$/, '').replace(/\//g, '-') + '.png';
  return fs.existsSync(path.join(WURZEL, 'assets', 'og', name)) ? DOMAIN + '/assets/og/' + name : '';
}

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
  const indexieren = NICHT_INDEXIEREN.indexOf(rel) < 0;
  const eigenesBild = vorschaubild(rel);
  const bild = eigenesBild || BILD;
  const graph = [];
  if (rel === 'index.html') {
    graph.push({ '@type': 'WebSite', '@id': DOMAIN + '/#website', name: MARKE, url: url, inLanguage: 'de', description: beschreibung, publisher: { '@id': HERAUSGEBER['@id'] } });
    graph.push(HERAUSGEBER);
  } else {
    const seite = { '@type': 'WebPage', '@id': url + '#seite', name: kurz, url: url, inLanguage: 'de', description: beschreibung,
      isPartOf: { '@type': 'WebSite', '@id': DOMAIN + '/#website', name: MARKE, url: DOMAIN + '/' },
      breadcrumb: { '@id': url + '#pfad' }, dateModified: datum(rel) };
    if (eigenesBild) seite.primaryImageOfPage = { '@type': 'ImageObject', url: eigenesBild, width: 1200, height: 630 };
    graph.push(seite);
    graph.push({ '@type': 'BreadcrumbList', '@id': url + '#pfad', itemListElement: [
      { '@type': 'ListItem', position: 1, name: MARKE, item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: kurz, item: url }] });
    const z = ZUSATZDATEN[rel];
    if (z) {
      const app = { '@type': z.typ || 'WebApplication', '@id': url + '#anwendung', name: kurz, url: url, description: beschreibung, inLanguage: 'de',
        applicationCategory: z.kategorie || 'UtilitiesApplication', operatingSystem: 'Alle mit aktuellem Webbrowser', browserRequirements: 'JavaScript',
        isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, publisher: { '@id': HERAUSGEBER['@id'] }, mainEntityOfPage: { '@id': url + '#seite' } };
      if (z.funktionen) app.featureList = z.funktionen;
      if (z.stichworte) app.keywords = z.stichworte;
      app.image = bild;
      graph.push(app);
      graph.push(HERAUSGEBER);
    }
    const f = fragen(s);
    if (f.length) graph.push({ '@type': 'FAQPage', '@id': url + '#fragen', mainEntity: f, isPartOf: { '@id': url + '#seite' } });
  }
  const daten = { '@context': 'https://schema.org', '@graph': graph };
  const bildText = eigenesBild ? kurz + ' – Vorschau' : MARKE;
  const block = [
    '  <!-- seo -->',
    '  <link rel="canonical" href="' + attr(url) + '">',
    indexieren ? '  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">' : '  <meta name="robots" content="noindex, follow">',
    '  <meta property="og:type" content="website">',
    '  <meta property="og:site_name" content="' + attr(MARKE) + '">',
    '  <meta property="og:locale" content="de_DE">',
    '  <meta property="og:title" content="' + attr(kurz) + '">',
    '  <meta property="og:description" content="' + attr(beschreibung) + '">',
    '  <meta property="og:url" content="' + attr(url) + '">',
    '  <meta property="og:image" content="' + attr(bild) + '">',
    eigenesBild ? '  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta property="og:image:type" content="image/png">' : '',
    '  <meta property="og:image:alt" content="' + attr(bildText) + '">',
    '  <meta name="twitter:card" content="' + (eigenesBild ? 'summary_large_image' : 'summary') + '">',
    '  <meta name="twitter:title" content="' + attr(kurz) + '">',
    '  <meta name="twitter:description" content="' + attr(beschreibung) + '">',
    '  <meta name="twitter:image" content="' + attr(bild) + '">',
    ZUSATZDATEN[rel] && ZUSATZDATEN[rel].stichworte ? '  <meta name="keywords" content="' + attr(ZUSATZDATEN[rel].stichworte) + '">' : '',
    '  <script type="application/ld+json">' + JSON.stringify(daten).replace(/</g, '\\u003c') + '</script>',
    '  <!-- /seo -->'
  ].filter(Boolean).join('\n');
  if (/<!-- seo -->[\s\S]*?<!-- \/seo -->/.test(s)) s = s.replace(/ *<!-- seo -->[\s\S]*?<!-- \/seo -->/, block.replace(/^ {2}/, '  '));
  else s = s.replace(/(<meta name="description" content="[^"]*">)/, '$1\n' + block);
  fs.writeFileSync(datei, s);
  if (indexieren) karte.push({ url: url, datum: datum(rel) });
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
