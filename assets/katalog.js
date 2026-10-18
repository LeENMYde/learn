/*
 * Katalog aller Rechner, Formelsammlungen und Simulationen
 * =========================================================
 * Ein neuer Eintrag hier genügt, und die Übersicht (index.html) zeigt ihn an.
 *
 *   titel    Name auf der Karte
 *   pfad     relativ zum Ordner „rechner“
 *   bereich  Oberbegriff, wird zum Filter (#Elektrotechnik …)
 *   themen   Stichwörter, ebenfalls filterbar
 *   text     ein Satz, was man dort tun kann
 *   tex      eine typische Formel als Erkennungszeichen (LaTeX)
 */
window.KATALOG = [
  {
    titel: 'Warmwasser-Rechner',
    pfad: 'elektro/warmwasser.html',
    bereich: 'Elektrotechnik',
    themen: ['Wärme', 'Energie', 'Wasserkosten', 'Jahreskosten', 'Wirkungsgrad'],
    text: 'Kochendwassergerät, Boiler, Durchlauferhitzer und druckfester Speicher: Wärmemenge, Heizzeit, Leistung, Strom- und Wasserkosten bis aufs Jahr, in jede Richtung und mit Rechenweg.',
    tex: 'Q = m_\\text{w} \\cdot c \\cdot \\Delta T'
  },
  {
    titel: 'Leitungsdimensionierung',
    pfad: 'elektro/leitungsdimensionierung.html',
    bereich: 'Elektrotechnik',
    themen: ['Leitungen', 'Spannungsfall', 'Schutzorgane', 'Kurzschluss', 'Verlustkosten'],
    text: 'Gleich-, Wechsel- und Drehstrom: Betriebsstrom, Schutzorgan, Querschnitt nach Verlegeart, Spannungsfall, Abschaltbedingung und Leitungsverluste, mit allen Nachweisen und Rechenweg.',
    tex: '\\Delta U = \\frac{2 \\cdot l \\cdot I \\cdot \\cos\\varphi}{\\kappa \\cdot A}'
  }
];
