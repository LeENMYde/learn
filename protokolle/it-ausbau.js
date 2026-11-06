/*
 * Ausbau des IT-Sicherheitsprotokolls
 * - Prüfhinweise zu jedem Punkt: wie prüfen (Befehl), Sollzustand, Bezug (BSI IT-Grundschutz, OWASP, RFC)
 * - Scan-Ausgabe (nmap normal/-oG, masscan, ss -tulpn) in die Port-Tabelle übernehmen
 * - HTTP-Header aus curl -I auswerten, Zertifikatsablauf bewerten
 * - CVSS-3.1-Rechner (Basiswert nach FIRST-Spezifikation)
 * - Grafik der Checkliste und Maßnahmenplan mit Fristen
 * Alles läuft im Browser; nichts wird übertragen.
 */
'use strict';
(function () {
  const $ = function (id) { return document.getElementById(id); };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function knoten(tag, klasse, text) { const k = document.createElement(tag); if (klasse) k.className = klasse; if (text !== undefined) k.textContent = text; return k; }
  function feuer(el, typ) { el.dispatchEvent(new Event(typ, { bubbles: true })); }

  // ---------- Prüfhinweise: [wie prüfen, Befehl, Sollzustand, Bezug] ----------
  const TIPPS = {
    net1: ['Vollständigen Scan aller TCP-Ports und der wichtigsten UDP-Ports von außen und innen.', 'nmap -sS -sV -p- --min-rate 2000 -oA scan ZIEL\nnmap -sU --top-ports 100 ZIEL', 'Ergebnis liegt dem Protokoll bei, jeder offene Port ist begründet.', 'BSI NET.1.1, OPS.1.1.3'],
    net2: ['Scan von außen (Internet) mit dem Soll abgleichen.', 'nmap -Pn -p- ÖFFENTLICHE-IP', 'Nur die freigegebenen Dienste (meist 80/443) erreichbar.', 'BSI NET.3.2 (Firewall)'],
    net3: ['Von außen auf 22, 3389, 9090, 8006, 5900 prüfen.', 'nmap -Pn -p 22,3389,5900,8006,9090 ÖFFENTLICHE-IP', 'Verwaltungszugänge nur über VPN oder aus dem Verwaltungsnetz.', 'BSI SYS.1.1.A21'],
    net4: ['Prüfen, ob IPv6 aktiv ist und ob die Firewall auch für IPv6 gilt.', 'ip -6 addr\nip6tables -S   bzw.   nft list ruleset', 'IPv6 entweder genauso gefiltert wie IPv4 oder bewusst abgeschaltet.', 'BSI NET.1.1.A27'],
    net5: ['Netzplan ansehen, VLANs und Regeln zwischen Zonen prüfen.', 'ip -d link show\nbridge vlan show', 'Server, Clients, Gäste und Verwaltung in getrennten Netzen.', 'BSI NET.1.1.A5'],
    net6: ['Dienste suchen, die auf allen Adressen lauschen.', 'ss -tulpn | grep -E "0\\.0\\.0\\.0|\\[::\\]"', 'Interne Dienste (Datenbank, Cache) nur auf 127.0.0.1 oder internem Netz.', 'BSI SYS.1.3.A10'],
    ssl1: ['Zertifikatskette und Ablaufdatum prüfen.', 'openssl s_client -connect HOST:443 -servername HOST </dev/null | openssl x509 -noout -subject -issuer -dates', 'Gültig, vertrauenswürdige Kette, Name passt.', 'BSI TR-03116-4'],
    ssl2: ['Unterstützte Protokolle testen.', 'nmap --script ssl-enum-ciphers -p 443 HOST\nopenssl s_client -connect HOST:443 -tls1_1', 'Nur TLS 1.2 und 1.3; TLS 1.0/1.1 abgelehnt.', 'BSI TR-02102-2'],
    ssl3: ['Cipher Suites auflisten.', 'nmap --script ssl-enum-ciphers -p 443 HOST', 'Nur AEAD (AES-GCM, ChaCha20) mit Forward Secrecy (ECDHE).', 'BSI TR-02102-2'],
    ssl4: ['Header der Antwort prüfen (unten: Header einfügen).', 'curl -sI https://HOST | grep -i strict', 'max-age mindestens 180 Tage (15552000), möglichst includeSubDomains.', 'RFC 6797'],
    ssl5: ['Automatische Erneuerung und Überwachung prüfen.', 'systemctl list-timers | grep -i cert\nopenssl x509 -enddate -noout -in CERT.pem', 'Erneuerung automatisch, Warnung spätestens 14 Tage vor Ablauf.', 'BSI OPS.1.1.3'],
    auth1: ['Anmeldung mit Herstellerkennwörtern versuchen, Dokumentation prüfen.', 'hydra -C defaults.txt ZIEL DIENST   (nur mit Freigabe)', 'Keine Standardkennwörter, auch nicht bei Druckern, Switches, IPMI.', 'BSI ORP.4.A8'],
    auth2: ['Richtlinie und Konfiguration ansehen.', 'grep -E "minlen|minclass" /etc/security/pwquality.conf', 'Mindestens 12 Zeichen oder Passphrasen, Abgleich gegen bekannte geleakte Kennwörter.', 'BSI ORP.4.A22, NIST SP 800-63B'],
    auth3: ['Admin-Zugänge der Anwendungen und Panels prüfen.', '', 'Zweiter Faktor (TOTP, FIDO2) für alle Verwaltungszugänge.', 'BSI ORP.4.A21'],
    auth4: ['Sperre nach Fehlversuchen testen.', 'fail2ban-client status\nfail2ban-client status sshd', 'Sperre oder Verzögerung nach wenigen Fehlversuchen.', 'BSI SYS.1.1.A36'],
    auth5: ['Wirksame SSH-Konfiguration ausgeben.', 'sshd -T | grep -Ei "passwordauthentication|kbdinteractive"', 'passwordauthentication no, kbdinteractiveauthentication no', 'BSI SYS.1.3.A16'],
    auth6: ['Wirksame SSH-Konfiguration ausgeben.', 'sshd -T | grep -i permitrootlogin', 'permitrootlogin no (oder prohibit-password nur mit Begründung)', 'BSI SYS.1.3.A2'],
    auth7: ['Konten ohne Kennwort und Gastzugänge suchen.', 'awk -F: \'($2==""){print $1}\' /etc/shadow\nsmbclient -L //HOST -N', 'Keine anonymen Zugriffe auf Freigaben, Dienste und Oberflächen.', 'BSI ORP.4.A2'],
    auth8: ['Letzte Anmeldungen und Kontenliste prüfen.', 'lastlog | grep -v "Never"\nchage -l BENUTZER', 'Konten ausgeschiedener Personen gelöscht, ungenutzte gesperrt.', 'BSI ORP.4.A4'],
    fw1: ['Status der Host-Firewall prüfen.', 'ufw status verbose\nnft list ruleset\nfirewall-cmd --list-all', 'Firewall aktiv und beim Start geladen.', 'BSI SYS.1.1.A16'],
    fw2: ['Standardrichtlinie der Eingangskette prüfen.', 'nft list ruleset | grep -A2 "hook input"\niptables -S INPUT | head -1', 'Eingehend: Standard verwerfen, nur benötigte Ports erlaubt.', 'BSI NET.3.2.A4'],
    fw3: ['Regeln mit Dokumentation vergleichen.', '', 'Jede Regel hat Zweck, Verantwortlichen und Datum.', 'BSI NET.3.2.A6'],
    fw4: ['Wichtige Kernel-Parameter abfragen.', 'sysctl net.ipv4.conf.all.rp_filter net.ipv4.tcp_syncookies kernel.kptr_restrict net.ipv4.conf.all.accept_redirects', 'rp_filter 1, tcp_syncookies 1, accept_redirects 0, kptr_restrict ≥ 1.', 'CIS Benchmark'],
    fw5: ['Laufende und aktivierte Dienste auflisten.', 'systemctl list-units --type=service --state=running\nsystemctl list-unit-files --state=enabled', 'Nur benötigte Dienste aktiv.', 'BSI SYS.1.1.A6'],
    fw6: ['Status des Mandatory Access Control prüfen.', 'aa-status   bzw.   getenforce', 'AppArmor/SELinux aktiv, Profile im enforce-Modus.', 'BSI SYS.1.3.A10'],
    upd1: ['Ausstehende Updates anzeigen.', 'apt list --upgradable   bzw.   dnf check-update\nneeds-restarting -r', 'Keine offenen Sicherheitsupdates, Neustart nach Kernel-Update erfolgt.', 'BSI OPS.1.1.3'],
    upd2: ['Automatische Updates prüfen.', 'systemctl status unattended-upgrades\ncat /etc/apt/apt.conf.d/20auto-upgrades', 'Sicherheitsupdates automatisch, Rückmeldung bei Fehlern.', 'BSI OPS.1.1.3.A16'],
    upd3: ['Versionen der Anwendungen und Images mit aktuellen Releases vergleichen.', 'docker images --format "{{.Repository}}:{{.Tag}} {{.CreatedSince}}"', 'Keine Images älter als die letzte Sicherheitsversion.', 'BSI APP.4.4.A11'],
    upd4: ['Schwachstellenscanner über System und Images laufen lassen.', 'trivy image IMAGE\ngrype IMAGE', 'Keine offenen kritischen und hohen CVEs ohne Begründung (unten im CVE-Reiter).', 'BSI OPS.1.1.3'],
    upd5: ['Abhängigkeiten der Anwendungen prüfen.', 'npm audit --omit=dev\npip-audit\ncomposer audit', 'Keine bekannten kritischen Schwachstellen in Abhängigkeiten.', 'OWASP A06'],
    log1: ['Ziel der Protokolle prüfen.', 'journalctl --disk-usage\ngrep -r "@@" /etc/rsyslog.d/', 'Protokolle zusätzlich auf einem getrennten System.', 'BSI OPS.1.1.5'],
    log2: ['Erfolgreiche und fehlgeschlagene Anmeldungen suchen.', 'journalctl -u ssh --since today | grep -E "Accepted|Failed"', 'Beides wird mit Zeit, Konto und Quelle protokolliert.', 'BSI OPS.1.1.5.A3'],
    log3: ['Testalarm auslösen.', '', 'Alarm erreicht einen Menschen, auch nachts und am Wochenende.', 'BSI DER.1'],
    log4: ['Rotation und Aufbewahrung prüfen.', 'cat /etc/logrotate.conf\njournalctl --disk-usage', 'Rotation aktiv, Aufbewahrung nach Vorgabe (Datenschutz beachten).', 'BSI OPS.1.1.5'],
    log5: ['Externe Überwachung prüfen.', '', 'Ausfall wird von außen erkannt und gemeldet.', 'BSI OPS.1.1.1'],
    bak1: ['Zeitplan und letzte Läufe prüfen.', 'systemctl list-timers | grep -i backup\nrestic snapshots   bzw.   borg list REPO', 'Sicherungen laufen nach Plan, Fehler werden gemeldet.', 'BSI CON.3'],
    bak2: ['Letzten Wiederherstellungstest nachweisen lassen oder durchführen.', 'restic restore latest --target /tmp/test', 'Wiederherstellung regelmäßig erfolgreich getestet und dokumentiert.', 'BSI CON.3.A5'],
    bak3: ['Speicherorte der Kopien prüfen (siehe Backup-Planer).', '', 'Drei Kopien, zwei Medien, eine außer Haus, eine offline oder unveränderlich.', 'BSI CON.3.A4'],
    bak4: ['Verschlüsselung der Sicherung prüfen.', 'restic cat config\nborg info REPO | grep -i encrypt', 'Sicherungen verschlüsselt, Schlüssel getrennt aufbewahrt.', 'BSI CON.3.A9'],
    bak5: ['Wiederanlauf-Dokumentation ansehen.', '', 'RTO und RPO festgelegt, Schritte zur Wiederherstellung beschrieben.', 'BSI DER.4'],
    cfg1: ['Konfiguration und Repositorys nach Geheimnissen durchsuchen.', 'gitleaks detect -s .\ngrep -rniE "password|secret|token" /opt/APP --include=*.yml', 'Keine Kennwörter oder Schlüssel im Klartext in Repos oder Images.', 'OWASP A02'],
    cfg2: ['Typische Dateien von außen abrufen.', 'curl -s -o /dev/null -w "%{http_code}" https://HOST/.env\ncurl -s -o /dev/null -w "%{http_code}" https://HOST/.git/config', 'Antwort 403 oder 404, nie 200.', 'OWASP A05'],
    cfg3: ['Rechte sensibler Dateien prüfen.', 'find /etc /opt -name "*.env" -o -name "*.key" | xargs ls -l', 'Schlüssel und .env höchstens 600/640, Eigentümer Dienstkonto.', 'BSI SYS.1.3.A4'],
    cfg4: ['Benutzer der Prozesse prüfen.', 'ps -eo user,comm | sort | uniq -c\ndocker inspect -f "{{.Config.User}}" CONTAINER', 'Dienste laufen unter eigenem, unprivilegiertem Konto.', 'BSI SYS.1.1.A9'],
    cfg5: ['Header prüfen (im Reiter Port-Scan einfügen und auswerten).', 'curl -sI https://HOST', 'CSP, X-Content-Type-Options, frame-ancestors, Referrer-Policy gesetzt.', 'OWASP Secure Headers'],
    cfg6: ['Server-Header und Fehlerseiten ansehen.', 'curl -sI https://HOST | grep -iE "server|x-powered-by"\ncurl -s https://HOST/gibtsnicht', 'Keine Versionsnummern von Server, Sprache oder Framework.', 'OWASP A05'],
    cfg7: ['Privilegierte Container suchen.', 'docker ps -q | xargs docker inspect -f "{{.Name}} {{.HostConfig.Privileged}}"', 'Kein privileged ohne dokumentierte Begründung.', 'BSI SYS.1.6.A21'],
    mail1: ['TXT-Eintrag der Domain abfragen.', 'dig +short TXT beispiel.de | grep spf', 'Ein SPF-Eintrag, endet auf -all (oder ~all mit DMARC reject).', 'RFC 7208'],
    mail2: ['Signatur in einer gesendeten Mail und Schlüssel prüfen.', 'dig +short TXT SELEKTOR._domainkey.beispiel.de', 'DKIM-Signatur gültig, Schlüssel RSA ≥ 2048 bit oder Ed25519.', 'RFC 6376'],
    mail3: ['DMARC-Eintrag abfragen.', 'dig +short TXT _dmarc.beispiel.de', 'p=quarantine oder p=reject, Berichte (rua) werden ausgewertet.', 'RFC 7489, BSI TR-03182'],
    mail4: ['MTA-STS bzw. TLSA-Eintrag prüfen.', 'dig +short TXT _mta-sts.beispiel.de\ndig +short TLSA _25._tcp.mx.beispiel.de', 'Eingehende Mails nur verschlüsselt zustellbar.', 'RFC 8461, RFC 7672'],
    mail5: ['Relay-Test von außen.', 'nmap -p 25 --script smtp-open-relay MX', 'Server nimmt keine Mails für fremde Domains von Fremden an.', 'BSI APP.5.3'],
    mail6: ['PTR-Eintrag mit HELO-Namen vergleichen.', 'dig +short -x IP-DES-MAILSERVERS', 'PTR zeigt auf den Mailserver-Namen, dieser löst auf die IP auf.', 'RFC 1912'],
    mail7: ['DNSSEC-Signatur prüfen.', 'dig +dnssec beispiel.de SOA\ndelv beispiel.de', 'Antwort mit RRSIG, Validierung „fully validated“.', 'RFC 4033'],
    mail8: ['CAA-Eintrag abfragen.', 'dig +short CAA beispiel.de', 'Nur die genutzte Zertifizierungsstelle ist erlaubt.', 'RFC 8659'],
    ctr1: ['Eingebundene Volumes prüfen.', 'docker ps -q | xargs docker inspect -f "{{.Name}} {{range .Mounts}}{{.Source}} {{end}}" | grep docker.sock', 'docker.sock nirgends eingebunden (sonst Root auf dem Host).', 'BSI SYS.1.6.A20'],
    ctr2: ['Benutzer in den Containern prüfen.', 'docker ps -q | xargs docker inspect -f "{{.Name}} user={{.Config.User}}"', 'USER gesetzt oder Docker im Rootless-Modus.', 'BSI SYS.1.6.A17'],
    ctr3: ['Veröffentlichte Ports ansehen.', 'docker ps --format "{{.Names}} {{.Ports}}"', 'Ports hinter dem Proxy als 127.0.0.1:…; Docker schreibt eigene iptables-Regeln vorbei an ufw.', 'Docker-Dokumentation'],
    ctr4: ['Herkunft und Tags der Images prüfen.', 'docker ps --format "{{.Image}}"', 'Offizielle oder eigene Images, feste Version oder Digest.', 'BSI SYS.1.6.A6'],
    ctr5: ['Limits der Container prüfen.', 'docker stats --no-stream\ndocker inspect -f "{{.Name}} mem={{.HostConfig.Memory}} pids={{.HostConfig.PidsLimit}}" CONTAINER', 'Speicher-, CPU- und PID-Grenzen gesetzt.', 'BSI SYS.1.6.A15'],
    ctr6: ['Dateisystem und Capabilities prüfen.', 'docker inspect -f "{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapAdd}}" CONTAINER', 'read_only wo möglich, cap_drop: ALL und nur Nötiges hinzu.', 'BSI SYS.1.6.A18'],
    ctr7: ['Erreichbarkeit der Verwaltung prüfen (z. B. 8006, 443 des Hypervisors).', 'nmap -p 8006,9443,443 HYPERVISOR', 'Nur aus dem Verwaltungsnetz erreichbar, mit 2FA.', 'BSI SYS.1.5'],
    ctr8: ['Vorlagen und Snapshots prüfen.', '', 'Keine Kennwörter oder Schlüssel in Vorlagen, Vorlagen regelmäßig aktualisiert.', 'BSI SYS.1.5.A9'],
    org1: ['Inventar mit Scan-Ergebnis vergleichen.', '', 'Jedes gefundene System steht im Inventar mit Zweck und Verantwortlichem.', 'BSI ORP.1, ISO 27001 A.5.9'],
    org2: ['Zuständigkeiten nachfragen.', '', 'Für jedes System ein Verantwortlicher und eine Vertretung.', 'BSI ORP.1.A1'],
    org3: ['Notfallplan und letzte Übung ansehen.', '', 'Plan aktuell, ausgedruckt verfügbar, mindestens jährlich geübt.', 'BSI DER.4, BSI-Standard 200-4'],
    org4: ['Datei abrufen.', 'curl -s https://HOST/.well-known/security.txt', 'Contact und Expires gesetzt, Meldungen werden bearbeitet.', 'RFC 9116'],
    org5: ['Konten und Rechte durchsehen.', 'getent group sudo wheel docker', 'Keine geteilten Admin-Konten; Rechte nach Bedarf und dokumentiert.', 'BSI ORP.4.A1'],
    org6: ['Unterlagen zum Datenschutz prüfen.', '', 'Verträge zur Auftragsverarbeitung, Löschkonzept, Verzeichnis nach Art. 30 DSGVO.', 'DSGVO Art. 28, 30, 32'],
    org7: ['Zugang zum Raum und zu Racks prüfen.', '', 'Verschlossen, Zutritt protokolliert, Klima und Rauchmelder überwacht.', 'BSI INF.2'],
    org8: ['Nachweise der Schulungen ansehen.', '', 'Regelmäßige Sensibilisierung, Meldeweg für Verdachtsfälle bekannt.', 'BSI ORP.3'],
    ow1: ['Zugriffe mit fremden IDs und ohne Anmeldung testen.', 'curl -s -H "Cookie: …" https://HOST/api/objekt/FREMDE-ID', 'Serverseitige Prüfung jeder Berechtigung.', 'OWASP A01:2021'],
    ow2: ['Transportverschlüsselung und Speicherung von Kennwörtern prüfen.', '', 'TLS überall, Kennwörter mit Argon2id/bcrypt, keine eigenen Kryptoverfahren.', 'OWASP A02:2021'],
    ow3: ['Eingaben mit Sonderzeichen testen, Code-Review.', 'sqlmap -u "https://HOST/seite?id=1"   (nur mit Freigabe)', 'Parametrisierte Abfragen, Ausgaben kontextgerecht kodiert.', 'OWASP A03:2021'],
    ow4: ['Bedrohungsmodell und Missbrauchsfälle besprechen.', '', 'Sicherheit in der Planung berücksichtigt (z. B. Ratenbegrenzung, Missbrauchsfälle).', 'OWASP A04:2021'],
    ow5: ['Standardkonfiguration, Debug-Modus, Verzeichnislisten prüfen.', 'curl -s https://HOST/ | grep -i "debug\\|stack trace"', 'Keine Debug-Ausgaben, gehärtete Konfiguration.', 'OWASP A05:2021'],
    ow6: ['Versionen der Komponenten mit CVE-Datenbanken vergleichen.', 'trivy fs .', 'Keine bekannten verwundbaren Komponenten.', 'OWASP A06:2021'],
    ow7: ['Anmeldung, Sitzungen und Passwort-Reset prüfen.', '', 'Ratenbegrenzung, sichere Sitzungscookies, 2FA möglich.', 'OWASP A07:2021'],
    ow8: ['Herkunft von Updates und Paketen prüfen.', '', 'Signierte Updates, gesicherte CI/CD-Kette, keine unsichere Deserialisierung.', 'OWASP A08:2021'],
    ow9: ['Sicherheitsrelevante Ereignisse auslösen und im Log suchen.', '', 'Anmeldungen, Rechtefehler und Eingabefehler werden protokolliert und ausgewertet.', 'OWASP A09:2021'],
    ow10: ['Funktionen suchen, die Adressen abrufen (Webhooks, Vorschauen).', 'curl "https://HOST/vorschau?url=http://169.254.169.254/"   (nur mit Freigabe)', 'Ziele auf erlaubte Liste beschränkt, interne Adressen gesperrt.', 'OWASP A10:2021']
  };
  function tippsEinfuegen() {
    Object.keys(TIPPS).forEach(function (name) {
      const r = document.querySelector('input[type="radio"][name="' + name + '"]'); if (!r) return;
      const td = r.closest('tr').cells[0]; if (!td || td.querySelector('.pruef-tipp')) return;
      const t = TIPPS[name], d = knoten('details', 'pruef-tipp'), s = knoten('summary', '', 'ⓘ so prüfen');
      d.append(s, knoten('div', '', t[0]));
      if (t[1]) d.append(knoten('code', '', t[1]));
      d.append(knoten('div', '', 'Soll: ' + t[2]), knoten('div', '', 'Bezug: ' + t[3]));
      td.append(d);
    });
  }

  // ---------- Scan-Ausgabe übernehmen ----------
  function bekannt(port) {
    if (typeof PORT_CATEGORIES === 'undefined') return null;
    let treffer = null;
    Object.keys(PORT_CATEGORIES).forEach(function (k) { PORT_CATEGORIES[k].ports.forEach(function (p) { if (!treffer && String(p.port) === String(port)) treffer = p; }); });
    return treffer;
  }
  function scanLesen(text) {
    const o = [], gesehen = {};
    const add = function (port, transport, zustand, dienst, version, adresse) {
      port = String(+port); if (!(+port >= 0 && +port <= 65535)) return;
      const key = port + '/' + transport; if (gesehen[key]) return; gesehen[key] = true;
      o.push({ port: port, transport: transport.toUpperCase(), zustand: zustand || 'open', dienst: dienst || '', version: (version || '').trim().slice(0, 120), adresse: adresse || '' });
    };
    String(text).split(/\r?\n/).slice(0, 5000).forEach(function (z) {
      let m;
      // nmap -oG: Host: 1.2.3.4 ()  Ports: 22/open/tcp//ssh//OpenSSH 9.6/, …
      if ((m = /Ports:\s*(.*)$/.exec(z))) {
        m[1].split(/,\s*/).forEach(function (p) { const f = p.split('/'); if (f.length >= 5) add(f[0], f[2], f[1], f[4], f[6]); });
        return;
      }
      // nmap normal: 22/tcp open ssh OpenSSH 9.6p1
      if ((m = /^\s*(\d{1,5})\/(tcp|udp|sctp)\s+(open|closed|filtered|open\|filtered|unfiltered)\s+(\S+)?\s*(.*)$/.exec(z))) { add(m[1], m[2], m[3], m[4], m[5]); return; }
      // masscan: Discovered open port 443/tcp on 1.2.3.4
      if ((m = /Discovered open port (\d{1,5})\/(tcp|udp) on (\S+)/.exec(z))) { add(m[1], m[2], 'open', '', '', m[3]); return; }
      // ss -tulpn: tcp LISTEN 0 4096 0.0.0.0:22 0.0.0.0:* users:(("sshd",…))
      if ((m = /^(tcp|udp)\s+\S+\s+\d+\s+\d+\s+(\S+):(\d{1,5})\s+\S+(?:\s+users:\(\("([^"]+)")?/.exec(z))) { add(m[3], m[1], 'open', m[4] || '', '', m[2]); }
    });
    return o;
  }
  function scanUebernehmen() {
    const ein = $('scan-eingabe'), tb = $('portscan-tbody'), aus = $('scan-ergebnis'); if (!ein || !tb) return;
    const liste = scanLesen(ein.value);
    if (!liste.length) { aus.textContent = 'Keine Ports erkannt. Unterstützt: nmap (normal, -oG), masscan, ss -tulpn.'; return; }
    let neu = 0, kritisch = 0;
    liste.forEach(function (p) {
      // freie Zeile suchen, sonst neue anhängen
      let tr = Array.prototype.filter.call(tb.rows, function (r) { const i = r.querySelector('input'); return i && !i.value.trim(); })[0];
      if (!tr) { if (typeof window.addPortRow === 'function') window.addPortRow(); tr = tb.rows[tb.rows.length - 1]; }
      if (!tr) return;
      const ins = tr.querySelectorAll('input[type="text"]'), sel = tr.querySelectorAll('select');
      const k = bekannt(p.port), lokal = /^(127\.|\[?::1\]?|localhost)/.test(p.adresse);
      ins[0].value = p.port; ins[1].value = (k ? k.proto : p.dienst).slice(0, 40);
      if (sel[0]) { const t = Array.prototype.filter.call(sel[0].options, function (o) { return o.text === p.transport; })[0]; if (t) sel[0].value = t.value; }
      if (sel[1]) { const t = Array.prototype.filter.call(sel[1].options, function (o) { return o.text === p.zustand; })[0]; if (t) sel[1].value = t.value; }
      ins[2].value = (k ? k.desc : p.dienst) + (p.adresse ? ' (' + p.adresse + ')' : '');
      ins[3].value = p.version;
      let sev = k ? k.sev : 'info', note = k ? k.note : '';
      if (lokal) { sev = 'ok'; note = 'nur lokal erreichbar'; }
      if (p.zustand !== 'open') sev = 'ok';
      if (sel[2]) { sel[2].value = sev; if (typeof window.colorRow === 'function') window.colorRow(sel[2]); }
      ins[4].value = note;
      if (sev === 'fail') kritisch++;
      neu++;
      feuer(ins[0], 'input');
    });
    aus.textContent = neu + ' Ports übernommen' + (kritisch ? ', davon ' + kritisch + ' kritisch (rot).' : '.');
  }

  // ---------- HTTP-Header ----------
  function headerTabelle() {
    const t = Array.prototype.filter.call(document.querySelectorAll('.section-title'), function (s) { return /HTTP-Sicherheitsheader/.test(s.textContent); })[0];
    if (!t) return null;
    let el = t.nextElementSibling; while (el && !el.querySelector('table')) el = el.nextElementSibling;
    return el ? el.querySelector('table') : null;
  }
  function tlsTabelle() {
    const t = Array.prototype.filter.call(document.querySelectorAll('.section-title'), function (s) { return /SSL\/TLS-Scan/.test(s.textContent); })[0];
    if (!t) return null;
    let el = t.nextElementSibling; while (el && !el.querySelector('table')) el = el.nextElementSibling;
    return el ? el.querySelector('table') : null;
  }
  function zeileSetzen(tab, muster, wert, vorhanden, bewertung, bem) {
    if (!tab) return;
    Array.prototype.forEach.call(tab.tBodies[0].rows, function (tr) {
      if (!muster.test(tr.cells[0].textContent)) return;
      const t = tr.querySelectorAll('input[type="text"]'), c = tr.querySelector('input[type="checkbox"]'), s = tr.querySelector('select');
      if (t[0] && wert !== null) { t[0].value = wert.slice(0, 200); feuer(t[0], 'input'); }
      if (c && vorhanden !== null) { c.checked = vorhanden; feuer(c, 'change'); }
      if (s && bewertung) { s.value = bewertung; feuer(s, 'change'); }
      if (t[t.length - 1] && t.length > 1 && bem !== null) { t[t.length - 1].value = bem.slice(0, 200); feuer(t[t.length - 1], 'input'); }
    });
  }
  function headerAuswerten() {
    const ein = $('header-eingabe'), aus = $('header-ergebnis'); if (!ein || !aus) return;
    const h = {}, cookies = [];
    String(ein.value).split(/\r?\n/).slice(0, 500).forEach(function (z) {
      const m = /^\s*([A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(z); if (!m) return;
      const k = m[1].toLowerCase();
      if (k === 'set-cookie') cookies.push(m[2]); else h[k] = (h[k] ? h[k] + ', ' : '') + m[2].trim();
    });
    if (!Object.keys(h).length && !cookies.length) { aus.textContent = 'Keine Header erkannt – Zeilen der Form „Name: Wert“ einfügen.'; return; }
    const erg = [], tab = headerTabelle(), tls = tlsTabelle();
    const bewerte = function (muster, name, wert, stufe, text) { erg.push([stufe, name + ': ' + text]); zeileSetzen(tab, muster, wert || '', !!wert, stufe === 'gut' ? 'OK' : stufe === 'warn' ? 'WARN' : 'FAIL', text); };
    const csp = h['content-security-policy'];
    if (!csp) bewerte(/Content-Security/, 'Content-Security-Policy', '', 'fehl', 'fehlt – Schutz vor eingeschleusten Skripten (XSS) fehlt');
    else if (/script-src[^;]*'unsafe-inline'|default-src[^;]*'unsafe-inline'(?![^;]*script-src)/.test(csp) || /unsafe-eval/.test(csp)) bewerte(/Content-Security/, 'Content-Security-Policy', csp, 'warn', 'vorhanden, erlaubt aber unsafe-inline/unsafe-eval');
    else bewerte(/Content-Security/, 'Content-Security-Policy', csp, 'gut', 'vorhanden');
    const hsts = h['strict-transport-security'], ma = hsts ? +((/max-age=(\d+)/i.exec(hsts) || [0, 0])[1]) : 0;
    if (!hsts) bewerte(/Strict-Transport/, 'Strict-Transport-Security', '', 'fehl', 'fehlt – Abstufung auf HTTP möglich');
    else if (ma < 15552000) bewerte(/Strict-Transport/, 'Strict-Transport-Security', hsts, 'warn', 'max-age ' + Math.round(ma / 86400) + ' Tage – mindestens 180 empfohlen');
    else bewerte(/Strict-Transport/, 'Strict-Transport-Security', hsts, 'gut', 'max-age ' + Math.round(ma / 86400) + ' Tage' + (/includesubdomains/i.test(hsts) ? ', includeSubDomains' : ''));
    if (tls) zeileSetzen(tls, /^HSTS/, hsts ? 'ja' : 'nein', null, hsts ? (ma >= 15552000 ? 'OK' : 'WARN') : 'FAIL', hsts ? 'max-age=' + ma : '');
    const xfo = h['x-frame-options'], fa = csp && /frame-ancestors/.test(csp);
    if (xfo || fa) bewerte(/X-Frame/, 'X-Frame-Options / frame-ancestors', xfo || 'CSP frame-ancestors', 'gut', 'Einbetten in fremde Seiten geregelt');
    else bewerte(/X-Frame/, 'X-Frame-Options', '', 'fehl', 'fehlt – Clickjacking möglich');
    const xcto = h['x-content-type-options'];
    bewerte(/X-Content-Type/, 'X-Content-Type-Options', xcto || '', xcto && /nosniff/i.test(xcto) ? 'gut' : 'fehl', xcto && /nosniff/i.test(xcto) ? 'nosniff' : 'fehlt');
    const rp = h['referrer-policy'];
    bewerte(/Referrer/, 'Referrer-Policy', rp || '', !rp ? 'warn' : /unsafe-url|no-referrer-when-downgrade/.test(rp) ? 'warn' : 'gut', !rp ? 'fehlt (Browser-Standard strict-origin-when-cross-origin)' : rp);
    const pp = h['permissions-policy'];
    bewerte(/Permissions/, 'Permissions-Policy', pp || '', pp ? 'gut' : 'warn', pp ? 'vorhanden' : 'fehlt – Kamera, Mikrofon, Standort nicht eingeschränkt');
    const srv = h.server || '', xp = h['x-powered-by'];
    const verrat = /\d/.test(srv) || !!xp;
    bewerte(/Server-Header/, 'Server-Header', srv + (xp ? ' / X-Powered-By: ' + xp : ''), verrat ? 'warn' : 'gut', verrat ? 'verrät Version' + (xp ? ' und Framework (X-Powered-By)' : '') : srv ? 'ohne Version' : 'nicht gesetzt');
    cookies.forEach(function (c) {
      const name = c.split('=')[0].trim().slice(0, 40), fehl = [];
      if (!/;\s*secure/i.test(c)) fehl.push('Secure'); if (!/;\s*httponly/i.test(c)) fehl.push('HttpOnly'); if (!/;\s*samesite=(lax|strict)/i.test(c)) fehl.push('SameSite');
      erg.push([fehl.length ? 'warn' : 'gut', 'Cookie ' + name + ': ' + (fehl.length ? 'ohne ' + fehl.join(', ') : 'Secure, HttpOnly, SameSite')]);
    });
    if (h['access-control-allow-origin'] === '*') erg.push(['warn', 'Access-Control-Allow-Origin: * – jede Seite darf Antworten lesen; nur für öffentliche Daten']);
    aus.innerHTML = '';
    const ul = knoten('ul', 'header-liste');
    erg.forEach(function (e) { ul.append(knoten('li', e[0], (e[0] === 'gut' ? '✓ ' : e[0] === 'warn' ? '⚠ ' : '✗ ') + e[1])); });
    aus.append(ul);
    const fehlt = erg.filter(function (e) { return e[0] === 'fehl'; }).length, warn = erg.filter(function (e) { return e[0] === 'warn'; }).length;
    // passenden Checklistenpunkt im Audit vorschlagen, wenn noch leer
    const r = document.querySelector('input[name="cfg5"]:checked');
    if (!r) { const ziel = document.querySelector('input[name="cfg5"][value="' + (fehlt ? 'fail' : warn ? 'warn' : 'ok') + '"]'); if (ziel) { ziel.checked = true; feuer(ziel, 'change'); } }
    aus.append(knoten('p', 'hilfe', 'Tabelle ausgefüllt. ' + fehlt + ' fehlend, ' + warn + ' mit Hinweis. Der Punkt „HTTP Security-Header“ im Audit wurde vorgeschlagen, falls noch offen.'));
  }

  // ---------- Zertifikatsablauf ----------
  function zertifikatPruefen() {
    const tls = tlsTabelle(); if (!tls) return;
    Array.prototype.forEach.call(tls.tBodies[0].rows, function (tr) {
      if (!/gültig bis/.test(tr.cells[0].textContent)) return;
      const d = tr.querySelector('input[type="date"]'), s = tr.querySelector('select'), b = tr.querySelectorAll('input[type="text"]'); if (!d || !d.value) return;
      const ablauf = new Date(d.value + 'T12:00:00'), ref = $('a-datum') && $('a-datum').value ? new Date($('a-datum').value + 'T12:00:00') : new Date();
      const tage = Math.round((ablauf - ref) / 86400000); if (!isFinite(tage)) return;
      if (s) s.value = tage < 0 ? 'FAIL' : tage < 30 ? 'WARN' : 'OK';
      const bem = b[b.length - 1]; if (bem && (!bem.value || /^(noch|seit) /.test(bem.value))) bem.value = tage < 0 ? 'seit ' + (-tage) + ' Tagen abgelaufen' : 'noch ' + tage + ' Tage gültig';
    });
  }

  // ---------- CVSS 3.1 ----------
  const W = { AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }, AC: { L: 0.77, H: 0.44 }, UI: { N: 0.85, R: 0.62 }, CIA: { H: 0.56, L: 0.22, N: 0 } };
  const TEILE = ['av', 'ac', 'pr', 'ui', 's', 'c', 'i', 'a'];
  function aufrunden(x) { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; }
  function cvss(v) {
    const S = v.s === 'C', pr = v.pr === 'N' ? 0.85 : v.pr === 'L' ? (S ? 0.68 : 0.62) : (S ? 0.5 : 0.27);
    const iss = 1 - (1 - W.CIA[v.c]) * (1 - W.CIA[v.i]) * (1 - W.CIA[v.a]);
    const imp = S ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
    const exp = 8.22 * W.AV[v.av] * W.AC[v.ac] * pr * W.UI[v.ui];
    const basis = imp <= 0 ? 0 : S ? aufrunden(Math.min(1.08 * (imp + exp), 10)) : aufrunden(Math.min(imp + exp, 10));
    return { basis: basis, imp: imp, exp: exp };
  }
  function stufe(n) { return n === 0 ? 'keine' : n < 4 ? 'niedrig' : n < 7 ? 'mittel' : n < 9 ? 'hoch' : 'kritisch'; }
  function cvssWerte() { const v = {}; TEILE.forEach(function (k) { const e = $('cvss-' + k); v[k] = e ? e.value : ''; }); return v; }
  function vektor(v) { return 'CVSS:3.1/AV:' + v.av + '/AC:' + v.ac + '/PR:' + v.pr + '/UI:' + v.ui + '/S:' + v.s + '/C:' + v.c + '/I:' + v.i + '/A:' + v.a; }
  function cvssZeigen(vonVektor) {
    const v = cvssWerte(), r = cvss(v), aus = $('cvss-ergebnis'); if (!aus) return;
    if (!vonVektor && $('cvss-vektor')) $('cvss-vektor').value = vektor(v);
    aus.innerHTML = '';
    const b = knoten('b', '', r.basis.toFixed(1).replace('.', ',')); b.style.color = r.basis >= 7 ? '#C0392B' : r.basis >= 4 ? '#B07A12' : '#2E8B57';
    aus.append('Basiswert ', b, ' (' + stufe(r.basis) + ') · Ausnutzbarkeit ' + r.exp.toFixed(1).replace('.', ',') + ' · Auswirkung ' + Math.max(0, r.imp).toFixed(1).replace('.', ','));
  }
  function vektorLesen() {
    const t = ($('cvss-vektor') || { value: '' }).value.trim().toUpperCase();
    const m = /^CVSS:3\.[01]\/(.*)$/.exec(t); if (!m) return;
    const teile = {}; m[1].split('/').forEach(function (p) { const q = p.split(':'); if (q.length === 2) teile[q[0]] = q[1]; });
    let ok = true;
    TEILE.forEach(function (k) { const e = $('cvss-' + k), w = teile[k.toUpperCase()]; if (!e || !w || !Array.prototype.some.call(e.options, function (o) { return o.value === w; })) ok = false; });
    if (!ok) return;
    TEILE.forEach(function (k) { $('cvss-' + k).value = teile[k.toUpperCase()]; });
    cvssZeigen(true);
  }
  function zielListe() {
    const s = $('cvss-ziel'), tb = $('findings-tbody'); if (!s || !tb) return;
    const alt = s.value; s.innerHTML = '';
    Array.prototype.forEach.call(tb.rows, function (tr, i) { const t = tr.querySelector('input[type="text"]'); const o = knoten('option', '', (i + 1) + (t && t.value ? ' – ' + t.value.slice(0, 40) : '')); o.value = String(i); s.append(o); });
    if (alt && s.querySelector('option[value="' + alt + '"]')) s.value = alt;
  }
  function cvssUebernehmen() {
    const tb = $('findings-tbody'), s = $('cvss-ziel'); if (!tb || !s) return;
    const tr = tb.rows[+s.value]; if (!tr) return;
    const v = cvssWerte(), r = cvss(v), n = tr.querySelector('input[type="number"]'), t = tr.querySelector('input[type="text"]');
    if (n) { n.value = r.basis.toFixed(1); feuer(n, 'input'); }
    if (t) { const vek = vektor(v); t.value = (t.value.replace(/\s*\[CVSS:3\.[01]\/[^\]]*\]/, '') + ' [' + vek + ']').trim().slice(0, 300); feuer(t, 'input'); }
  }

  // ---------- Grafik und Maßnahmenplan ----------
  function abschnitte() {
    const tab = $('tab-audit'); if (!tab) return [];
    const o = [];
    tab.querySelectorAll('table.check-grid').forEach(function (t) {
      let titel = ''; for (let p = (t.closest('.rollen') || t).previousElementSibling; p; p = p.previousElementSibling) if (p.classList.contains('section-title')) { titel = p.textContent.trim(); break; }
      if (!/^\d/.test(titel)) return;
      const r = { titel: titel, ok: 0, warn: 0, fail: 0, na: 0, offen: 0, punkte: [] };
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        const c = tr.querySelector('input[type="radio"]:checked'), bef = tr.querySelector('input[type="text"]');
        const name = (tr.cells[0].firstChild ? tr.cells[0].firstChild.textContent : '').trim();
        if (!c) { r.offen++; return; }
        r[c.value] = (r[c.value] || 0) + 1;
        if (c.value === 'fail' || c.value === 'warn') r.punkte.push([c.value, name, bef ? bef.value : '']);
      });
      o.push(r);
    });
    return o;
  }
  function grafik(a) {
    const ziel = $('i-auswertung'); if (!ziel) return;
    let c = $('auswertung-grafik');
    if (!c) { c = document.createElement('canvas'); c.id = 'auswertung-grafik'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Balken je Abschnitt: OK, WARN, FAIL, N/A und offen'); ziel.parentNode.insertBefore(c, ziel.nextSibling); }
    const d = window.devicePixelRatio || 1, w = Math.min(760, Math.max(280, c.parentNode.clientWidth || 600)), zh = 20, h = a.length * zh + 34;
    c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.height = h + 'px';
    const cx = c.getContext('2d'); cx.setTransform(d, 0, 0, d, 0, 0); cx.clearRect(0, 0, w, h);
    const farbe = function (n) { return window.Thema ? Thema.farbe(n) : '#555'; };
    const lx = Math.min(220, w * 0.42), bw = w - lx - 10;
    const F = [['ok', '#2E8B57', 'OK'], ['warn', '#E0A526', 'WARN'], ['fail', '#C0392B', 'FAIL'], ['na', '#9AA3AD', 'N/A'], ['offen', 'rgba(154,163,173,0.3)', 'offen']];
    cx.font = '11px ' + (farbe('--technik') || 'sans-serif'); cx.textBaseline = 'middle';
    a.forEach(function (r, i) {
      const y = i * zh + 4, n = r.ok + r.warn + r.fail + r.na + r.offen || 1;
      cx.fillStyle = farbe('--text'); cx.textAlign = 'right'; cx.fillText(r.titel.length > 34 ? r.titel.slice(0, 33) + '…' : r.titel, lx - 6, y + zh / 2 - 2);
      let x = lx;
      F.forEach(function (q) { const ww = bw * (r[q[0]] || 0) / n; cx.fillStyle = q[1]; cx.fillRect(x, y, ww, zh - 6); x += ww; });
    });
    let x = lx; const ly = a.length * zh + 16;
    F.forEach(function (q) { cx.fillStyle = q[1]; cx.fillRect(x, ly - 5, 10, 10); cx.fillStyle = farbe('--leise'); cx.textAlign = 'left'; cx.fillText(q[2], x + 14, ly); x += 62; });
  }
  function fristDatum(tage) {
    const basis = $('a-datum') && $('a-datum').value ? new Date($('a-datum').value + 'T12:00:00') : new Date();
    basis.setDate(basis.getDate() + tage);
    return ('0' + basis.getDate()).slice(-2) + '.' + ('0' + (basis.getMonth() + 1)).slice(-2) + '.' + basis.getFullYear();
  }
  const PRIO = { kritisch: [0, 7], hoch: [1, 30], mittel: [2, 90], niedrig: [3, 180] };
  let planText = '';
  function plan(a) {
    const ziel = $('massnahmenplan'); if (!ziel) return;
    const zeilen = [];
    a.forEach(function (r) { r.punkte.forEach(function (p) { zeilen.push([p[0] === 'fail' ? 'hoch' : 'mittel', 'Checkliste ' + r.titel.split(' ')[0], p[1] + (p[2] ? ' – ' + p[2] : '')]); }); });
    const ft = $('findings-tbody');
    if (ft) Array.prototype.forEach.call(ft.rows, function (tr) {
      const t = tr.querySelector('input[type="text"]'); if (!t || !t.value.trim()) return;
      const s = tr.querySelectorAll('select'); if (s[2] && /Behoben|Akzeptiert|N\/A/.test(s[2].value)) return;
      const st = s[1] ? ['', 'kritisch', 'hoch', 'mittel', 'niedrig', 'niedrig'][s[1].selectedIndex] : ''; if (!st) return;
      const m = tr.querySelectorAll('input[type="text"]')[1];
      zeilen.push([st, 'Finding ' + tr.cells[0].textContent.trim(), t.value + (m && m.value ? ' → ' + m.value : '')]);
    });
    const pt = $('portscan-tbody');
    if (pt) Array.prototype.forEach.call(pt.rows, function (tr) {
      const i = tr.querySelectorAll('input[type="text"]'), s = tr.querySelectorAll('select');
      if (!i[0] || !i[0].value.trim() || !s[2] || s[2].value !== 'fail' || (s[1] && !/open/.test(s[1].value))) return;
      zeilen.push(['hoch', 'Port ' + i[0].value, (i[1].value || '') + ' offen' + (i[4] && i[4].value ? ' – ' + i[4].value : '')]);
    });
    const ht = headerTabelle();
    if (ht) Array.prototype.forEach.call(ht.tBodies[0].rows, function (tr) { const s = tr.querySelector('select'); if (s && s.value === 'FAIL') zeilen.push(['mittel', 'Header', tr.cells[0].textContent.trim() + ' setzen']); });
    zeilen.sort(function (x, y) { return PRIO[x[0]][0] - PRIO[y[0]][0]; });
    ziel.innerHTML = '';
    if (!zeilen.length) { ziel.append(knoten('p', 'hilfe', 'Keine offenen Maßnahmen – sobald Punkte mit FAIL/WARN, offene Findings oder kritische Ports erfasst sind, erscheinen sie hier.')); planText = ''; return; }
    const t = knoten('table', 'plan-tabelle'), k = knoten('tr');
    ['Nr.', 'Priorität', 'Quelle', 'Maßnahme', 'Frist', 'erledigt'].forEach(function (x) { k.append(knoten('th', '', x)); }); t.append(k);
    zeilen.slice(0, 200).forEach(function (z, i) {
      const tr = knoten('tr');
      tr.append(knoten('td', '', String(i + 1)), knoten('td', 'prio-' + z[0], z[0]), knoten('td', '', z[1]), knoten('td', '', z[2]), knoten('td', '', fristDatum(PRIO[z[0]][1])), knoten('td', '', '☐'));
      t.append(tr);
    });
    ziel.append(t);
    planText = zeilen.map(function (z, i) { return (i + 1) + '. [' + z[0] + ', bis ' + fristDatum(PRIO[z[0]][1]) + '] ' + z[2] + ' (' + z[1] + ')'; }).join('\n');
  }
  function aktualisieren() { const a = abschnitte(); grafik(a); plan(a); zertifikatPruefen(); zielListe(); }
  let geplant = false;
  function planen() { if (geplant) return; geplant = true; setTimeout(function () { geplant = false; aktualisieren(); }, 60); }

  window.addEventListener('DOMContentLoaded', function () {
    tippsEinfuegen();
    const b1 = $('scan-uebernehmen'); if (b1) b1.addEventListener('click', scanUebernehmen);
    const b2 = $('header-auswerten'); if (b2) b2.addEventListener('click', headerAuswerten);
    const b3 = $('cvss-uebernehmen'); if (b3) b3.addEventListener('click', cvssUebernehmen);
    const b4 = $('plan-uebernehmen'); if (b4) b4.addEventListener('click', function () { const m = $('a-maengel'); if (!m || !planText) return; m.value = (m.value.trim() ? m.value.trim() + '\n\n' : '') + 'Maßnahmenplan:\n' + planText; feuer(m, 'input'); });
    TEILE.forEach(function (k) { const e = $('cvss-' + k); if (e) e.addEventListener('change', function () { cvssZeigen(false); }); });
    const vk = $('cvss-vektor'); if (vk) vk.addEventListener('input', vektorLesen);
    cvssZeigen(!!(vk && vk.value)); if (vk && vk.value) vektorLesen();
    document.addEventListener('input', planen); document.addEventListener('change', planen);
    const ft = $('findings-tbody'); if (ft && window.MutationObserver) new MutationObserver(planen).observe(ft, { childList: true });
    window.addEventListener('resize', planen);
    document.addEventListener('themawechsel', planen);
    window.addEventListener('beforeprint', aktualisieren);
    aktualisieren();
  });
  window.addEventListener('load', function () { setTimeout(function () { aktualisieren(); if ($('cvss-vektor') && $('cvss-vektor').value) vektorLesen(); }, 150); });
})();
