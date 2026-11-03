/* Übernommen aus dem Projekt „Prüfprotokolle“ (MIT-Lizenz, LeENMYde), angepasst an die Sammlung. */
'use strict';
// Ersatz für fehlende Elemente (statt optionaler Verkettung, ES2015)
const LEER = { value: '', checked: false, addEventListener: function () {}, appendChild: function () {}, click: function () {} };

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY   = 'itsec_stammdaten';
const SETTINGS_KEY  = 'itsec_settings';
const SIGNATURE_KEY = 'itsec_signature';
const TOOLS_KEY     = 'itsec_tools';

// ═══════════════════════════════════════════════════════════════════════════
// PORT-KATEGORIEN – alle Dienste & Protokolle
// ═══════════════════════════════════════════════════════════════════════════

const PORT_CATEGORIES = {
  web: {
    label: '🌐 Web-Services',
    ports: [
      { port:'80',   proto:'HTTP',   transport:'TCP',  desc:'HTTP – unverschlüsselt',                 sev:'warn', note:'Sollte auf HTTPS umleiten (301)' },
      { port:'443',  proto:'HTTPS',  transport:'TCP',  desc:'HTTPS – TLS-verschlüsselt',              sev:'ok',   note:'TLS-Version und Cipher prüfen' },
      { port:'8080', proto:'HTTP-alt',transport:'TCP', desc:'Alternativer HTTP-Port',                  sev:'warn', note:'Proxy / Dev-Server prüfen' },
      { port:'8443', proto:'HTTPS-alt',transport:'TCP',desc:'Alternativer HTTPS-Port',                sev:'info', note:'' },
      { port:'8000', proto:'HTTP-dev',transport:'TCP', desc:'Dev-Server (Django, Flask…)',             sev:'warn', note:'Nicht in Produktion exponieren' },
      { port:'4443', proto:'HTTPS-alt',transport:'TCP',desc:'Alternativer HTTPS-Port',                sev:'info', note:'' },
      { port:'3000', proto:'HTTP-app',transport:'TCP', desc:'Node.js / Grafana / Gitea',               sev:'warn', note:'Direkt-Zugriff vs. Reverse Proxy?' },
      { port:'4000', proto:'HTTP-app',transport:'TCP', desc:'Ghost CMS / Dev-Server',                  sev:'warn', note:'' },
      { port:'8888', proto:'Jupyter', transport:'TCP', desc:'Jupyter Notebook',                        sev:'fail', note:'Öffentlich gefährlich! Auth prüfen' },
      { port:'9000', proto:'Portainer',transport:'TCP',desc:'Portainer / PHP-FPM',                    sev:'warn', note:'Management-UI nicht öffentlich' },
    ]
  },
  db: {
    label: '🗄️ Datenbanken',
    ports: [
      { port:'3306', proto:'MySQL',     transport:'TCP', desc:'MySQL / MariaDB',               sev:'fail', note:'NIEMALS öffentlich exponieren' },
      { port:'5432', proto:'PostgreSQL',transport:'TCP', desc:'PostgreSQL',                    sev:'fail', note:'NIEMALS öffentlich exponieren' },
      { port:'6379', proto:'Redis',     transport:'TCP', desc:'Redis Cache/DB',                sev:'fail', note:'Kein Auth by default! Kritisch!' },
      { port:'27017',proto:'MongoDB',   transport:'TCP', desc:'MongoDB',                       sev:'fail', note:'Auth prüfen, nicht öffentlich' },
      { port:'27018',proto:'MongoDB',   transport:'TCP', desc:'MongoDB Shard/Slave',           sev:'fail', note:'' },
      { port:'5984', proto:'CouchDB',   transport:'TCP', desc:'Apache CouchDB',                sev:'fail', note:'Default-Admin prüfen' },
      { port:'9200', proto:'Elasticsearch',transport:'TCP',desc:'Elasticsearch REST API',     sev:'fail', note:'Kein Auth by default – kritisch!' },
      { port:'9300', proto:'Elasticsearch',transport:'TCP',desc:'Elasticsearch Cluster',      sev:'fail', note:'' },
      { port:'1433', proto:'MSSQL',     transport:'TCP', desc:'SQL-Server-Datenbank',          sev:'fail', note:'' },
      { port:'1521', proto:'Oracle',    transport:'TCP', desc:'Oracle Database',               sev:'fail', note:'' },
      { port:'5601', proto:'Kibana',    transport:'TCP', desc:'Kibana UI',                     sev:'warn', note:'Auth-Bypass-CVEs bekannt' },
      { port:'6432', proto:'PgBouncer', transport:'TCP', desc:'PostgreSQL Connection Pooler',  sev:'warn', note:'' },
      { port:'11211',proto:'Memcached', transport:'TCP/UDP',desc:'Memcached',                 sev:'fail', note:'DRDoS-Amplification möglich!' },
      { port:'7474', proto:'Neo4j',     transport:'TCP', desc:'Neo4j Graph DB (HTTP)',          sev:'warn', note:'' },
      { port:'8086', proto:'InfluxDB',  transport:'TCP', desc:'InfluxDB Metrics',              sev:'warn', note:'' },
    ]
  },
  remote: {
    label: '🖥️ Remote-Zugang',
    ports: [
      { port:'22',   proto:'SSH',    transport:'TCP',  desc:'SSH – Secure Shell',              sev:'warn', note:'Key-only, Root deaktiviert?' },
      { port:'23',   proto:'Telnet', transport:'TCP',  desc:'Telnet – UNVERSCHLÜSSELT',        sev:'fail', note:'Sofort deaktivieren!' },
      { port:'3389', proto:'RDP',    transport:'TCP',  desc:'Remote Desktop Protocol (RDP)',   sev:'fail', note:'Öffentlich = kritisches Risiko' },
      { port:'5900', proto:'VNC',    transport:'TCP',  desc:'VNC Remote Desktop',              sev:'fail', note:'Oft kein / schwaches Passwort' },
      { port:'5901', proto:'VNC-1',  transport:'TCP',  desc:'VNC Display :1',                  sev:'fail', note:'' },
      { port:'5902', proto:'VNC-2',  transport:'TCP',  desc:'VNC Display :2',                  sev:'fail', note:'' },
      { port:'8006', proto:'Proxmox',transport:'TCP',  desc:'Proxmox Web UI (HTTPS)',          sev:'warn', note:'Nur intern / VPN!' },
      { port:'9090', proto:'Cockpit',transport:'TCP',  desc:'Cockpit Linux Admin UI',          sev:'warn', note:'Nur intern / VPN!' },
      { port:'2222', proto:'SSH-alt',transport:'TCP',  desc:'Alternativer SSH-Port',            sev:'info', note:'Security by obscurity – kein Ersatz für Härtung' },
      { port:'4444', proto:'Metasploit',transport:'TCP',desc:'Metasploit Listener / Backdoor', sev:'fail', note:'Kompromittierung möglich!' },
      { port:'6881', proto:'BitTorrent',transport:'TCP/UDP',desc:'BitTorrent DHT',             sev:'warn', note:'' },
    ]
  },
  mail: {
    label: '📧 Mail & Messaging',
    ports: [
      { port:'25',   proto:'SMTP',     transport:'TCP', desc:'SMTP – Mail-Eingang (MTAs)',     sev:'warn', note:'Open-Relay prüfen!' },
      { port:'465',  proto:'SMTPS',    transport:'TCP', desc:'SMTP over TLS (Legacy)',         sev:'info', note:'' },
      { port:'587',  proto:'SMTP-sub', transport:'TCP', desc:'SMTP Submission (Auth)',          sev:'info', note:'Auth erzwungen?' },
      { port:'110',  proto:'POP3',     transport:'TCP', desc:'POP3 – unverschlüsselt',         sev:'warn', note:'POP3S (995) bevorzugen' },
      { port:'995',  proto:'POP3S',    transport:'TCP', desc:'POP3 over TLS',                  sev:'ok',   note:'' },
      { port:'143',  proto:'IMAP',     transport:'TCP', desc:'IMAP – unverschlüsselt',         sev:'warn', note:'IMAPS (993) bevorzugen' },
      { port:'993',  proto:'IMAPS',    transport:'TCP', desc:'IMAP over TLS',                  sev:'ok',   note:'' },
      { port:'4190', proto:'Sieve',    transport:'TCP', desc:'ManageSieve (Mailfilter)',        sev:'info', note:'' },
      { port:'8025', proto:'MailHog',  transport:'TCP', desc:'MailHog Dev-Mailserver',          sev:'fail', note:'NIEMALS in Produktion!' },
    ]
  },
  dns: {
    label: '🔁 DNS & Netzwerkdienste',
    ports: [
      { port:'53',   proto:'DNS',    transport:'TCP/UDP', desc:'Domain Name System',              sev:'warn', note:'Recursion für externe prüfen!' },
      { port:'67',   proto:'DHCP',   transport:'UDP',  desc:'DHCP Server',                        sev:'info', note:'Rogue DHCP möglich?' },
      { port:'68',   proto:'DHCP',   transport:'UDP',  desc:'DHCP Client',                        sev:'info', note:'' },
      { port:'123',  proto:'NTP',    transport:'UDP',  desc:'Network Time Protocol',              sev:'warn', note:'Amplification-Angriffe möglich' },
      { port:'161',  proto:'SNMP',   transport:'UDP',  desc:'SNMP v1/v2c – Community-String',     sev:'fail', note:'"public"/"private" prüfen – kritisch!' },
      { port:'162',  proto:'SNMP-trap',transport:'UDP',desc:'SNMP Trap',                          sev:'warn', note:'' },
      { port:'389',  proto:'LDAP',   transport:'TCP',  desc:'LDAP – unverschlüsselt',             sev:'warn', note:'LDAPS (636) bevorzugen' },
      { port:'636',  proto:'LDAPS',  transport:'TCP',  desc:'LDAP over TLS',                      sev:'info', note:'' },
      { port:'88',   proto:'Kerberos',transport:'TCP/UDP',desc:'Kerberos Authentication',        sev:'warn', note:'' },
      { port:'500',  proto:'IKE',    transport:'UDP',  desc:'IKE / IPSec VPN',                    sev:'info', note:'' },
      { port:'4500', proto:'IKE-NAT',transport:'UDP',  desc:'IKE NAT-Traversal',                  sev:'info', note:'' },
      { port:'179',  proto:'BGP',    transport:'TCP',  desc:'Border Gateway Protocol',            sev:'warn', note:'Route-Hijacking-Risiko' },
      { port:'5353', proto:'mDNS',   transport:'UDP',  desc:'Multicast DNS (Bonjour/Avahi)',      sev:'warn', note:'Informationsleak möglich' },
      { port:'1900', proto:'SSDP',   transport:'UDP',  desc:'UPnP/SSDP Discovery',               sev:'warn', note:'DRDoS-Amplification möglich!' },
    ]
  },
  file: {
    label: '📁 Datei- & Druckfreigabe',
    ports: [
      { port:'21',   proto:'FTP',    transport:'TCP',  desc:'FTP – UNVERSCHLÜSSELT',             sev:'fail', note:'Durch SFTP/FTPS ersetzen' },
      { port:'20',   proto:'FTP-data',transport:'TCP', desc:'FTP Data Transfer',                  sev:'fail', note:'' },
      { port:'989',  proto:'FTPS-data',transport:'TCP',desc:'FTPS Data (Implicit)',               sev:'info', note:'' },
      { port:'990',  proto:'FTPS',   transport:'TCP',  desc:'FTPS Control (Implicit TLS)',        sev:'info', note:'' },
      { port:'139',  proto:'NetBIOS',transport:'TCP',  desc:'NetBIOS Session (SMB legacy)',       sev:'fail', note:'EternalBlue / MS17-010 prüfen' },
      { port:'445',  proto:'SMB',    transport:'TCP',  desc:'SMB-Dateifreigabe',        sev:'fail', note:'EternalBlue / Ransomware-Einfall' },
      { port:'137',  proto:'NetBIOS-NS',transport:'UDP',desc:'NetBIOS Name Service',             sev:'warn', note:'' },
      { port:'138',  proto:'NetBIOS-DGM',transport:'UDP',desc:'NetBIOS Datagram',               sev:'warn', note:'' },
      { port:'2049', proto:'NFS',    transport:'TCP/UDP',desc:'Network File System',             sev:'fail', note:'Exports ohne Auth – gefährlich!' },
      { port:'873',  proto:'rsync',  transport:'TCP',  desc:'rsync Daemon',                       sev:'warn', note:'Auth konfiguriert?' },
      { port:'548',  proto:'AFP',    transport:'TCP',  desc:'AFP-Dateifreigabe',              sev:'warn', note:'macOS-Freigaben' },
      { port:'515',  proto:'LPD',    transport:'TCP',  desc:'Line Printer Daemon',               sev:'warn', note:'' },
      { port:'631',  proto:'IPP',    transport:'TCP',  desc:'Internet Printing Protocol (CUPS)', sev:'info', note:'' },
    ]
  },
  monitor: {
    label: '📊 Monitoring, Admin & DevOps',
    ports: [
      { port:'3000', proto:'Grafana',   transport:'TCP', desc:'Grafana Dashboard',                sev:'warn', note:'Standardpasswort: admin/admin!' },
      { port:'9090', proto:'Prometheus',transport:'TCP', desc:'Prometheus Metrics API',           sev:'warn', note:'Keine Auth by default' },
      { port:'9100', proto:'Node-Exp',  transport:'TCP', desc:'Prometheus Node Exporter',         sev:'warn', note:'Systeminfos öffentlich?' },
      { port:'9093', proto:'Alertmanager',transport:'TCP',desc:'Prometheus Alertmanager',        sev:'warn', note:'' },
      { port:'8086', proto:'InfluxDB',  transport:'TCP', desc:'InfluxDB HTTP API',                sev:'warn', note:'' },
      { port:'5601', proto:'Kibana',    transport:'TCP', desc:'Kibana (ELK Stack)',               sev:'warn', note:'' },
      { port:'9200', proto:'Elasticsearch',transport:'TCP',desc:'Elasticsearch API',             sev:'fail', note:'Kein Auth by default!' },
      { port:'8161', proto:'ActiveMQ',  transport:'TCP', desc:'ActiveMQ Admin UI',               sev:'warn', note:'Default: admin/admin' },
      { port:'15672',proto:'RabbitMQ',  transport:'TCP', desc:'RabbitMQ Management UI',          sev:'warn', note:'Default: guest/guest' },
      { port:'4369', proto:'Erlang-EPM',transport:'TCP', desc:'Erlang Port Mapper (RabbitMQ)',   sev:'fail', note:'Remote-Code-Execution möglich' },
      { port:'2181', proto:'ZooKeeper', transport:'TCP', desc:'Apache ZooKeeper',                sev:'fail', note:'Kein Auth, command execution!' },
      { port:'8080', proto:'Jenkins',   transport:'TCP', desc:'Jenkins CI/CD',                    sev:'warn', note:'Default: kein Passwort!' },
      { port:'8161', proto:'ActiveMQ',  transport:'TCP', desc:'ActiveMQ Web Admin',               sev:'warn', note:'' },
      { port:'4848', proto:'GlassFish', transport:'TCP', desc:'GlassFish Admin Console',          sev:'warn', note:'' },
      { port:'7001', proto:'WebLogic',  transport:'TCP', desc:'Oracle WebLogic',                  sev:'warn', note:'Mehrere kritische CVEs bekannt' },
    ]
  },
  container: {
    label: '🐳 Container, K8s & Cloud',
    ports: [
      { port:'2375', proto:'Docker',   transport:'TCP', desc:'Docker API (UNVERSCHLÜSSELT)',      sev:'fail', note:'Root-Zugriff ohne Auth! Kritisch!' },
      { port:'2376', proto:'Docker-TLS',transport:'TCP',desc:'Docker API (TLS)',                  sev:'warn', note:'Client-Zertifikat prüfen' },
      { port:'2377', proto:'Docker-Swarm',transport:'TCP',desc:'Docker Swarm Cluster Mgmt',      sev:'warn', note:'Nur intern!' },
      { port:'4789', proto:'VXLAN',    transport:'UDP', desc:'Docker Overlay Network (VXLAN)',   sev:'warn', note:'' },
      { port:'6443', proto:'K8s-API',  transport:'TCP', desc:'Kubernetes API Server',            sev:'warn', note:'RBAC konfiguriert?' },
      { port:'8001', proto:'K8s-proxy',transport:'TCP', desc:'kubectl proxy',                    sev:'fail', note:'Niemals öffentlich!' },
      { port:'10250',proto:'Kubelet',  transport:'TCP', desc:'Kubelet API',                      sev:'fail', note:'Anonymer Zugriff = RCE!' },
      { port:'10255',proto:'Kubelet-ro',transport:'TCP',desc:'Kubelet read-only API',            sev:'warn', note:'' },
      { port:'10257',proto:'K8s-ctrl', transport:'TCP', desc:'K8s Controller Manager',           sev:'warn', note:'' },
      { port:'10259',proto:'K8s-sched',transport:'TCP', desc:'K8s Scheduler',                   sev:'warn', note:'' },
      { port:'2379', proto:'etcd',     transport:'TCP', desc:'etcd Key-Value Store (K8s)',       sev:'fail', note:'Alle K8s Secrets lesbar!' },
      { port:'2380', proto:'etcd-peer',transport:'TCP', desc:'etcd Peer Communication',          sev:'fail', note:'' },
      { port:'8080', proto:'K8s-insecure',transport:'TCP',desc:'K8s API insecure (deprecated)', sev:'fail', note:'Kein Auth!' },
      { port:'30000',proto:'NodePort', transport:'TCP', desc:'K8s NodePort Services (30000-32767)',sev:'info',note:'Range prüfen' },
      { port:'3306', proto:'PlanetScale',transport:'TCP',desc:'MySQL/DB in Container',           sev:'fail', note:'Interne DB öffentlich?' },
    ]
  },
  vpn: {
    label: '🔐 VPN, Proxy & Tunnel',
    ports: [
      { port:'1194', proto:'OpenVPN',    transport:'UDP/TCP',desc:'OpenVPN',                   sev:'ok',   note:'TLS-Zertifikate prüfen' },
      { port:'51820',proto:'WireGuard',  transport:'UDP',   desc:'WireGuard VPN',              sev:'ok',   note:'Moderne, sichere Lösung' },
      { port:'1723', proto:'PPTP',       transport:'TCP',   desc:'PPTP VPN – VERALTET',         sev:'fail', note:'Kryptografisch gebrochen! Abschalten!' },
      { port:'1701', proto:'L2TP',       transport:'UDP',   desc:'L2TP (IPSec)',                sev:'warn', note:'Ohne IPSec unsicher' },
      { port:'4500', proto:'IPSec-NAT',  transport:'UDP',   desc:'IPSec NAT-Traversal',        sev:'info', note:'' },
      { port:'500',  proto:'IKEv2',      transport:'UDP',   desc:'IKEv2 / IPSec',              sev:'info', note:'' },
      { port:'443',  proto:'SSL-VPN',    transport:'TCP',   desc:'SSL-VPN (Fortinet, etc.)',   sev:'info', note:'CVE-History prüfen!' },
      { port:'8080', proto:'HTTP-proxy', transport:'TCP',   desc:'HTTP Proxy',                  sev:'warn', note:'Open Proxy?' },
      { port:'3128', proto:'Squid',      transport:'TCP',   desc:'Squid Proxy',                sev:'warn', note:'Open Proxy prüfen' },
      { port:'1080', proto:'SOCKS5',     transport:'TCP',   desc:'SOCKS5 Proxy',               sev:'warn', note:'Auth konfiguriert?' },
      { port:'9050', proto:'Tor-SOCKS',  transport:'TCP',   desc:'Tor SOCKS Proxy',            sev:'warn', note:'' },
      { port:'9001', proto:'Tor-OR',     transport:'TCP',   desc:'Tor Onion Router',           sev:'warn', note:'' },
      { port:'8388', proto:'Shadowsocks',transport:'TCP/UDP',desc:'Shadowsocks Proxy',         sev:'info', note:'' },
    ]
  },
  iot: {
    label: '📡 IoT / Industrial / SCADA',
    ports: [
      { port:'102',  proto:'S7comm',    transport:'TCP', desc:'Siemens S7 PLC (Stuxnet!)',    sev:'fail', note:'Direktzugriff auf Steuerungen!' },
      { port:'502',  proto:'Modbus',    transport:'TCP', desc:'Modbus Industrial Protocol',   sev:'fail', note:'Kein Auth, keine Verschlüsselung' },
      { port:'44818',proto:'EtherNet/IP',transport:'TCP/UDP',desc:'Allen-Bradley EtherNet/IP',sev:'fail', note:'ICS/SCADA direkt exponiert?' },
      { port:'47808',proto:'BACnet',    transport:'UDP', desc:'BACnet Gebäudeautomation',     sev:'warn', note:'' },
      { port:'20000',proto:'DNP3',      transport:'TCP', desc:'DNP3 (Stromversorgung)',       sev:'fail', note:'Kritische Infrastruktur!' },
      { port:'1883', proto:'MQTT',      transport:'TCP', desc:'MQTT Broker – IoT Messaging',  sev:'warn', note:'Auth / TLS konfiguriert?' },
      { port:'8883', proto:'MQTTS',     transport:'TCP', desc:'MQTT over TLS',               sev:'ok',   note:'Zertifikat prüfen' },
      { port:'5683', proto:'CoAP',      transport:'UDP', desc:'CoAP – IoT Protokoll',         sev:'warn', note:'' },
      { port:'8728', proto:'RouterOS',  transport:'TCP', desc:'MikroTik API (unverschl.)',    sev:'fail', note:'Winbox CVE-2018-14847!' },
      { port:'8729', proto:'RouterOS-TLS',transport:'TCP',desc:'MikroTik API (TLS)',         sev:'warn', note:'' },
      { port:'7547', proto:'TR-069',    transport:'TCP', desc:'TR-069 (DSL-Router-Management)',sev:'fail', note:'Massenangriffe bekannt' },
      { port:'9100', proto:'RAW-print', transport:'TCP', desc:'Raw Printing / JetDirect',    sev:'warn', note:'Drucker direkt exponiert?' },
      { port:'623',  proto:'IPMI',      transport:'UDP', desc:'IPMI Baseboard Management (BMC)',sev:'fail', note:'Mehrere kritische CVEs!' },
    ]
  },
  common: {
    label: '⭐ Top häufig gefundene Ports',
    ports: [
      { port:'22',   proto:'SSH',     transport:'TCP', desc:'SSH',                            sev:'warn', note:'Key-only, Fail2ban?' },
      { port:'80',   proto:'HTTP',    transport:'TCP', desc:'HTTP',                           sev:'warn', note:'HTTPS-Redirect?' },
      { port:'443',  proto:'HTTPS',   transport:'TCP', desc:'HTTPS',                          sev:'ok',   note:'TLS-Version prüfen' },
      { port:'21',   proto:'FTP',     transport:'TCP', desc:'FTP unverschlüsselt',            sev:'fail', note:'Durch SFTP ersetzen!' },
      { port:'25',   proto:'SMTP',    transport:'TCP', desc:'SMTP',                           sev:'warn', note:'Open-Relay prüfen' },
      { port:'53',   proto:'DNS',     transport:'TCP/UDP', desc:'DNS',                        sev:'warn', note:'Recursion-Einstellung?' },
      { port:'110',  proto:'POP3',    transport:'TCP', desc:'POP3 unverschlüsselt',           sev:'warn', note:'POP3S bevorzugen' },
      { port:'143',  proto:'IMAP',    transport:'TCP', desc:'IMAP unverschlüsselt',           sev:'warn', note:'IMAPS bevorzugen' },
      { port:'161',  proto:'SNMP',    transport:'UDP', desc:'SNMP',                           sev:'fail', note:'Community-String prüfen!' },
      { port:'3306', proto:'MySQL',   transport:'TCP', desc:'MySQL',                          sev:'fail', note:'Nicht öffentlich!' },
      { port:'3389', proto:'RDP',     transport:'TCP', desc:'RDP',                            sev:'fail', note:'Öffentlich = Risiko' },
      { port:'5432', proto:'PostgreSQL',transport:'TCP',desc:'PostgreSQL',                   sev:'fail', note:'Nicht öffentlich!' },
      { port:'6379', proto:'Redis',   transport:'TCP', desc:'Redis',                          sev:'fail', note:'Kein Auth by default!' },
      { port:'8080', proto:'HTTP-alt',transport:'TCP', desc:'Alternativer HTTP',              sev:'warn', note:'Dienst identifizieren' },
      { port:'27017',proto:'MongoDB', transport:'TCP', desc:'MongoDB',                        sev:'fail', note:'Auth prüfen!' },
    ]
  }
};

// Transport-Protokolle
const TRANSPORT_PROTOS = ['TCP','UDP','TCP/UDP','SCTP','GRE','ESP','AH','ICMP','ICMPv6','IGMP','OSPF','PIM','VRRP','L2TP','MPLS'];

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', function () {
  setTodayDates();
  initPortScanRows();
  initFindingRows();
  initCveRows();
  loadSettings();

  const s = getSettings();
  if (s.autoLoad) applyStammdaten();

  loadStoredSignature();
  initAllCanvases();
  setupDropZone();
  updateToolsList();
  updateFooterLink();

  if (s.autoSignature) {
    setTimeout(() => {
      ['a-sig-pruefer','a-sig-ag','pt-sig-pruefer','pt-sig-ag'].forEach(id => {
        if (localStorage.getItem(SIGNATURE_KEY)) loadSignatureToCanvas(id, true);
      });
    }, 200);
  }

  (document.getElementById('settings-remove-link') || LEER).addEventListener('change', () => { saveSettings(); updateFooterLink(); });
  (document.getElementById('settings-auto-load') || LEER).addEventListener('change', saveSettings);
  (document.getElementById('settings-auto-signature') || LEER).addEventListener('change', saveSettings);

  if (localStorage.getItem('itsec_banner')) {
    const b = document.getElementById('privacy-banner');
    if (b) b.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER / BRANDING (identisch zu ElektroProtokoll)
// ═══════════════════════════════════════════════════════════════════════════

function updateFooterLink() {
  const footerLink = document.getElementById('footer-link');
  if (!footerLink) return;
  const removeLink = (document.getElementById('settings-remove-link') || LEER).checked || false;
  const firma = (document.getElementById('sd-firma') || LEER).value || '';
  if (removeLink && firma) {
    footerLink.textContent = firma;
  } else {
    footerLink.innerHTML = firma;
  }
}

function getFooterLink() {
  const removeLink = (document.getElementById('settings-remove-link') || LEER).checked || false;
  const firma = (document.getElementById('sd-firma') || LEER).value || '';
  return (removeLink && firma) ? firma : '';
}

// ═══════════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════════

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById('tab-' + tabName);
  const btn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
  setTimeout(initAllCanvases, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATES
// ═══════════════════════════════════════════════════════════════════════════

function setTodayDates() {
  const today = new Date().toISOString().split('T')[0];
  ['a-datum','a-datum-ag','a-datum-pruefer','ps-datum','pt-von','pt-datum-ag','pt-datum-pruefer'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PORT-SCAN TABLE
// ═══════════════════════════════════════════════════════════════════════════

function buildTransportSelect(selected) {
  return TRANSPORT_PROTOS.map(p =>
    `<option${p === selected ? ' selected' : ''}>${p}</option>`
  ).join('');
}

function buildSevSelect(selected) {
  const opts = [
    {v:'',    l:'--'},
    {v:'ok',  l:'✓ OK'},
    {v:'warn',l:'⚠ WARN'},
    {v:'fail',l:'✗ FAIL'},
    {v:'info',l:'ℹ INFO'},
  ];
  return opts.map(o => `<option value="${o.v}"${o.v === selected ? ' selected' : ''}>${o.l}</option>`).join('');
}

function makePortRow(d) {
  const p = d || {};
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${p.port||''}" placeholder="z.B. 443"></td>
    <td><input type="text" class="proto-col" value="${p.proto||''}" placeholder="HTTPS"></td>
    <td><select onchange="colorRow(this)">${buildTransportSelect(p.transport||'TCP')}</select></td>
    <td><select><option>open</option><option>closed</option><option>filtered</option><option>open|filtered</option><option>unfiltered</option></select></td>
    <td><input type="text" value="${p.desc||''}" placeholder="Dienst / Beschreibung"></td>
    <td><input type="text" value="${p.version||''}" placeholder="Version / Banner"></td>
    <td><select onchange="colorRow(this)">${buildSevSelect(p.sev||'')}</select></td>
    <td><input type="text" value="${p.note||''}" placeholder="Empfehlung / Bemerkung"></td>
    <td style="text-align:center"><button onclick="this.closest('tr').remove()" type="button" class="btn btn-small btn-weg" aria-label="Zeile entfernen">✕</button></td>
  `;
  const sevSel = tr.querySelectorAll('select')[2];
  if (sevSel && p.sev) colorRow(sevSel);
  return tr;
}

function addPortRow() {
  (document.getElementById('portscan-tbody') || LEER).appendChild(makePortRow(null));
}

function initPortScanRows() {
  const tbody = document.getElementById('portscan-tbody');
  if (!tbody || tbody.children.length > 0) return;
  for (let i = 0; i < 10; i++) tbody.appendChild(makePortRow(null));
}

function preloadPorts(category) {
  const cat = PORT_CATEGORIES[category];
  if (!cat) return;
  const tbody = document.getElementById('portscan-tbody');
  if (!tbody) return;
  const existingPorts = new Set(
    [...tbody.querySelectorAll('tr')].map(tr => ((tr.querySelector('input') || LEER).value || '').trim()).filter(Boolean)
  );
  let added = 0;
  cat.ports.forEach(p => {
    if (!existingPorts.has(p.port)) {
      tbody.appendChild(makePortRow(p));
      added++;
    }
  });
  if (added === 0) alert(`Alle Ports aus "${cat.label}" sind bereits in der Tabelle.`);
}

function clearPortTable() {
  if (!confirm('Port-Tabelle leeren?')) return;
  const tbody = document.getElementById('portscan-tbody');
  if (tbody) tbody.innerHTML = '';
}

function colorRow(sel) {
  const tr = sel.closest('tr');
  if (!tr) return;
  tr.className = '';
  const colorMap = { ok: 'row-ok', warn: 'row-warn', fail: 'row-fail', info: 'row-info' };
  const val = sel.value;
  if (colorMap[val]) tr.classList.add(colorMap[val]);
}

// ═══════════════════════════════════════════════════════════════════════════
// FINDINGS & CVE TABLES
// ═══════════════════════════════════════════════════════════════════════════

function initFindingRows() {
  const tbody = document.getElementById('findings-tbody');
  if (!tbody || tbody.children.length > 0) return;
  for (let i = 0; i < 5; i++) addFindingRow();
}

function addFindingRow() {
  const tbody = document.getElementById('findings-tbody');
  if (!tbody) return;
  const num = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="text-align:center;font-weight:bold;color:var(--leise);">${num}</td>
    <td><input type="text" placeholder="Kurzbeschreibung der Schwachstelle"></td>
    <td><select><option>--</option><option>Auth</option><option>Crypto</option><option>Config</option><option>Patch</option><option>Network</option><option>Injection</option><option>Priv-Esc</option><option>Info-Leak</option><option>Sonstiges</option></select></td>
    <td><input type="number" step="0.1" min="0" max="10" placeholder="0.0" style="width:100%;"></td>
    <td><select onchange="colorRow(this)"><option value="">--</option><option value="fail">🔴 Kritisch</option><option value="fail">🔴 Hoch</option><option value="warn">🟡 Mittel</option><option value="ok">🟢 Niedrig</option><option value="info">🔵 Info</option></select></td>
    <td><select><option>Offen</option><option>In Arbeit</option><option>Behoben</option><option>Akzeptiert</option><option>N/A</option></select></td>
    <td><input type="text" placeholder="Empfohlene Maßnahme"></td>
    <td><input type="date"></td>
    <td style="text-align:center"><button onclick="this.closest('tr').remove()" type="button" class="btn btn-small btn-weg" aria-label="Zeile entfernen">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function initCveRows() {
  const tbody = document.getElementById('cve-tbody');
  if (!tbody || tbody.children.length > 0) return;
  for (let i = 0; i < 5; i++) addCveRow();
}

function addCveRow() {
  const tbody = document.getElementById('cve-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="CVE-2024-XXXXX"></td>
    <td><input type="text" placeholder="openssl / nginx / …"></td>
    <td><input type="text" placeholder="3.1.2" style="width:100%;"></td>
    <td><input type="number" step="0.1" min="0" max="10" placeholder="0.0" style="width:100%;"></td>
    <td><select onchange="colorRow(this)"><option value="">--</option><option value="fail">CRITICAL</option><option value="fail">HIGH</option><option value="warn">MEDIUM</option><option value="ok">LOW</option><option value="info">NONE</option></select></td>
    <td><input type="text" placeholder="Kurzbeschreibung"></td>
    <td><select><option>ja</option><option>nein</option><option>Workaround</option></select></td>
    <td><select><option>Offen</option><option>Behoben</option><option>Akzeptiert</option><option>N/A</option></select></td>
    <td style="text-align:center"><button onclick="this.closest('tr').remove()" type="button" class="btn btn-small btn-weg" aria-label="Zeile entfernen">✕</button></td>
  `;
  tbody.appendChild(tr);
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS / SIGNATURES (identisch zum Original)
// ═══════════════════════════════════════════════════════════════════════════

const initializedCanvases = new Set();

function initAllCanvases() {
  ['a-sig-pruefer','a-sig-ag','pt-sig-pruefer','pt-sig-ag','sig-canvas'].forEach(id => initCanvas(id));
}

function initCanvas(canvasId) {
  if (initializedCanvases.has(canvasId)) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  let drawing = false, lastX = 0, lastY = 0;
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return { x: s.clientX - r.left, y: s.clientY - r.top };
  }
  function start(e) { e.preventDefault(); drawing = true; const p = getPos(e); lastX=p.x; lastY=p.y; }
  function draw(e) {
    if (!drawing) return; e.preventDefault();
    const p = getPos(e); const ctx = canvas.getContext('2d');
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y);
    ctx.strokeStyle='#1a1a2e'; ctx.lineWidth=1.8; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
    lastX=p.x; lastY=p.y;
  }
  function stop() { drawing = false; }
  if (canvasId !== 'sig-stored') {
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, {passive:false});
    canvas.addEventListener('touchmove', draw, {passive:false});
    canvas.addEventListener('touchend', stop);
  }
  initializedCanvases.add(canvasId);
}

function clearSignature(id) {
  const c = document.getElementById(id);
  if (c) c.getContext('2d').clearRect(0,0,c.width,c.height);
}

function saveSignature() {
  const c = document.getElementById('sig-canvas');
  if (!c) return;
  localStorage.setItem(SIGNATURE_KEY, c.toDataURL());
  loadStoredSignature();
  alert('✓ Unterschrift gespeichert!');
}

function loadStoredSignature() {
  const data = localStorage.getItem(SIGNATURE_KEY);
  if (!data) return;
  const c = document.getElementById('sig-stored');
  if (!c) return;
  const img = new Image();
  img.onload = () => { const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); };
  img.src = data;
}

function loadSignatureToCanvas(id, silent) {
  const data = localStorage.getItem(SIGNATURE_KEY);
  if (!data) { if (!silent) alert('Keine gespeicherte Unterschrift gefunden.'); return; }
  const c = document.getElementById(id);
  if (!c) return;
  const img = new Image();
  img.onload = () => { const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0,c.width,c.height); };
  img.src = data;
}

function deleteSavedSignature() {
  if (!confirm('Unterschrift wirklich löschen?')) return;
  localStorage.removeItem(SIGNATURE_KEY);
  clearSignature('sig-stored');
  alert('Unterschrift gelöscht.');
}

// ═══════════════════════════════════════════════════════════════════════════
// STAMMDATEN
// ═══════════════════════════════════════════════════════════════════════════

function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
}

function saveSettings() {
  const s = {
    removeLink:    (document.getElementById('settings-remove-link') || LEER).checked  || false,
    autoLoad:      (document.getElementById('settings-auto-load') || LEER).checked    || false,
    autoSignature: (document.getElementById('settings-auto-signature') || LEER).checked || false,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function loadSettings() {
  const s = getSettings();
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.checked=!!v; };
  set('settings-remove-link', s.removeLink);
  set('settings-auto-load',   s.autoLoad);
  set('settings-auto-signature', s.autoSignature);
}

function applyStammdaten() {
  let d; try { d = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { d = {}; }
  const fill = (id, v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
  fill('a-auftragnehmer', d.firma);
  fill('a-pruefer', d.p1);
  fill('ps-pruefer', d.p1);
  fill('pt-pruefer', d.p1);
  updateFooterLink();
}

function saveStammdaten() {
  const g = id => (document.getElementById(id) || LEER).value||'';
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    firma:g('sd-firma'),tel:g('sd-tel'),str:g('sd-str'),mail:g('sd-mail'),
    ort:g('sd-ort'),web:g('sd-web'),ustid:g('sd-ustid'),zert:g('sd-zert'),
    verantw:g('sd-verantw'),p1:g('sd-p1'),p1qual:g('sd-p1-qual'),
    p2:g('sd-p2'),p2qual:g('sd-p2-qual'),
  }));
}

function fillStammdatenForm(d) {
  const f = (id,v) => { const el=document.getElementById(id); if(el&&v!==undefined) el.value=v; };
  f('sd-firma',d.firma); f('sd-tel',d.tel); f('sd-str',d.str); f('sd-mail',d.mail);
  f('sd-ort',d.ort); f('sd-web',d.web); f('sd-ustid',d.ustid); f('sd-zert',d.zert);
  f('sd-verantw',d.verantw); f('sd-p1',d.p1); f('sd-p1-qual',d.p1qual);
  f('sd-p2',d.p2); f('sd-p2-qual',d.p2qual);
}

function exportStammdaten() {
  saveStammdaten();
  downloadJSON(localStorage.getItem(STORAGE_KEY)||'{}', 'itsec_stammdaten.json');
}

function exportAllSettings() {
  saveStammdaten();
  downloadJSON(JSON.stringify({
    stammdaten: JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),
    settings:   JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'),
    tools:      JSON.parse(localStorage.getItem(TOOLS_KEY)||'[]'),
    signature:  localStorage.getItem(SIGNATURE_KEY)||null,
  }, null, 2), 'itsec_backup_'+new Date().toISOString().split('T')[0]+'.json');
}

function importStammdaten(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.stammdaten) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.stammdaten));
        if (data.settings)  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
        if (data.tools)     localStorage.setItem(TOOLS_KEY,    JSON.stringify(data.tools));
        if (data.signature) localStorage.setItem(SIGNATURE_KEY, data.signature);
        loadSettings(); updateToolsList(); loadStoredSignature();
        fillStammdatenForm(data.stammdaten);
        alert('✓ Backup erfolgreich importiert!');
      } else {
        localStorage.setItem(STORAGE_KEY, e.target.result);
        fillStammdatenForm(data);
        alert('✓ Stammdaten importiert!');
      }
    } catch (e) { alert('Fehler: Ungültiges JSON-Format.'); }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOLS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function getTools() { try { return JSON.parse(localStorage.getItem(TOOLS_KEY))||[]; } catch (e) { return []; } }
function saveToolsData(t) { localStorage.setItem(TOOLS_KEY, JSON.stringify(t)); }

function updateToolsList() {
  const list = document.getElementById('tools-list'); if (!list) return;
  const tools = getTools();
  if (!tools.length) { list.innerHTML='<em style="color:var(--leise);">Keine Werkzeuge gespeichert</em>'; return; }
  list.innerHTML = '<ol>' + tools.map((t,i) =>
    `<li><strong>${t.name}</strong>${t.ver?' v'+t.ver:''} – ${t.use||''}${t.url?` <a href="${t.url}" target="_blank" style="color:#142e60">[Link]</a>`:''}
     <button onclick="removeTool(${i})" style="margin-left:8px;font-size:10px;padding:1px 5px;border:none;background:#dc2626;color:white;border-radius:3px;cursor:pointer;">✕</button></li>`
  ).join('')+'</ol>';
}

function addToolFromStammdaten() {
  const name = (((document.getElementById('sd-tool-name') || LEER).value) || '').trim();
  if (!name) { alert('Bitte Tool-Namen eingeben.'); return; }
  const tools = getTools();
  tools.push({
    name, ver: (document.getElementById('sd-tool-ver') || LEER).value||'',
    use: (document.getElementById('sd-tool-use') || LEER).value||'',
    url: (document.getElementById('sd-tool-url') || LEER).value||'',
  });
  saveToolsData(tools); updateToolsList();
  ['sd-tool-name','sd-tool-ver','sd-tool-use','sd-tool-url'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
}

function removeTool(idx) { const t=getTools(); t.splice(idx,1); saveToolsData(t); updateToolsList(); }
function clearAllTools() { if(!confirm('Alle Werkzeuge löschen?')) return; localStorage.removeItem(TOOLS_KEY); updateToolsList(); }
function exportToolsJSON() { downloadJSON(JSON.stringify(getTools(),null,2),'itsec_tools.json'); }
function importToolsJSON() { (document.getElementById('tools-file-input') || LEER).click(); }

function handleToolsImport(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) { saveToolsData(data); updateToolsList(); alert('✓ Werkzeuge importiert!'); }
      else alert('Fehler: Erwarte ein Array.');
    } catch (e) { alert('Fehler: Ungültiges JSON.'); }
  };
  reader.readAsText(file);
}

function saveTools() {
  const tools = [];
  for (let i=1;i<=3;i++) {
    const name = (((document.getElementById(`a-tool${i}`) || LEER).value) || '').trim();
    if (name) tools.push({name, ver:(document.getElementById(`a-tool${i}-ver`) || LEER).value||'', use:(document.getElementById(`a-tool${i}-use`) || LEER).value||''});
  }
  if (!tools.length) { alert('Keine Werkzeuge ausgefüllt.'); return; }
  const existing = getTools();
  tools.forEach(t => { if (!existing.find(e=>e.name===t.name)) existing.push(t); });
  saveToolsData(existing); updateToolsList();
  alert('✓ Werkzeuge gespeichert!');
}

function loadTools() {
  const tools = getTools();
  if (!tools.length) { alert('Keine gespeicherten Werkzeuge.'); return; }
  for (let i=0;i<Math.min(tools.length,3);i++) {
    const t=tools[i];
    const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
    s(`a-tool${i+1}`,t.name); s(`a-tool${i+1}-ver`,t.ver); s(`a-tool${i+1}-use`,t.use);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT (identisch zum Original)
// ═══════════════════════════════════════════════════════════════════════════

function exportPDF(type) {
  updateFooterLink();
  document.querySelectorAll('.print-active').forEach(el => el.classList.remove('print-active'));
  const tab = document.getElementById('tab-' + type);
  if (tab) tab.classList.add('print-active');
  window.print();
  setTimeout(() => document.querySelectorAll('.print-active').forEach(el => el.classList.remove('print-active')), 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM RESET
// ═══════════════════════════════════════════════════════════════════════════

function resetForm(tabName) {
  const names = {audit:'Sicherheitsaudit',portscan:'Port-Scan',findings:'Findings/Pentest'};
  if (!confirm(`Alle Eingaben im Tab "${names[tabName]||tabName}" wirklich löschen?`)) return;
  const tab = document.getElementById('tab-' + tabName);
  if (!tab) return;
  tab.querySelectorAll('input[type=text],input[type=number],input[type=email],textarea').forEach(el=>el.value='');
  tab.querySelectorAll('input[type=date]').forEach(el=>el.value='');
  tab.querySelectorAll('input[type=checkbox]').forEach(el=>el.checked=false);
  tab.querySelectorAll('input[type=radio]').forEach(el=>el.checked=false);
  tab.querySelectorAll('select').forEach(el=>el.selectedIndex=0);
  if (tabName==='portscan') { const t=document.getElementById('portscan-tbody'); if(t) t.innerHTML=''; initPortScanRows(); }
  if (tabName==='findings') {
    const ft=document.getElementById('findings-tbody'); if(ft) ft.innerHTML='';
    const ct=document.getElementById('cve-tbody'); if(ct) ct.innerHTML='';
    initFindingRows(); initCveRows();
  }
  tab.querySelectorAll('canvas.signature').forEach(c => c.getContext('2d').clearRect(0,0,c.width,c.height));
  setTodayDates();
  tab.dispatchEvent(new Event('input', { bubbles: true }));
}

// ═══════════════════════════════════════════════════════════════════════════
// DROP ZONE
// ═══════════════════════════════════════════════════════════════════════════

function setupDropZone() {
  const zone = document.getElementById('drop-zone'); if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) { const reader = new FileReader(); reader.onload = ev => { try { const d=JSON.parse(ev.target.result); const sd=d.stammdaten||d; localStorage.setItem(STORAGE_KEY,JSON.stringify(sd)); if(d.settings) localStorage.setItem(SETTINGS_KEY,JSON.stringify(d.settings)); if(d.tools) localStorage.setItem(TOOLS_KEY,JSON.stringify(d.tools)); if(d.signature) localStorage.setItem(SIGNATURE_KEY,d.signature); fillStammdatenForm(sd); loadSettings(); updateToolsList(); loadStoredSignature(); alert('✓ Import erfolgreich!'); } catch (e) { alert('Fehler beim Lesen der Datei.'); } }; reader.readAsText(file); }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function downloadJSON(content, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], {type:'application/json'})),
    download: filename
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function clearAllData() {
  if (!confirm('⚠️ ALLE gespeicherten Daten löschen? Unwiderruflich!')) return;
  [STORAGE_KEY,SETTINGS_KEY,SIGNATURE_KEY,TOOLS_KEY,'itsec_banner'].forEach(k=>localStorage.removeItem(k));
  location.reload();
}
