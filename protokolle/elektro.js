/* Übernommen aus dem Projekt „Prüfprotokolle“ (MIT-Lizenz, LeENMYde), angepasst an die Sammlung. */
'use strict';
// Ersatz für fehlende Elemente (statt optionaler Verkettung, ES2015)
const LEER = { value: '', checked: false, addEventListener: function () {}, appendChild: function () {}, click: function () {} };

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'elektro_stammdaten';
const SETTINGS_KEY = 'elektro_settings';
const SIGNATURE_KEY = 'elektro_signature';
const DEVICES_KEY = 'elektro_devices';

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', function() {
  console.log('ElektroProtokoll v6.1 init...');
  
  setTodayDates();
  initMeasurementRows();
  loadSettings();
  
  // Auto-load stammdaten if enabled
  if ((document.getElementById('settings-auto-load') || LEER).checked) {
    loadStammdaten();
  }
  
  loadStoredSignature();
  initAllCanvases();
  setupDropZone();
  updateDevicesList();
  updateFooterLink();
  
  // Auto-load signature into forms if enabled
  if ((document.getElementById('settings-auto-signature') || LEER).checked) {
    setTimeout(() => {
      ['a-sig-pruefer', 'a-sig-ag', 'g-sig-pruefer', 'g-sig-ag'].forEach(id => {
        if (localStorage.getItem(SIGNATURE_KEY)) {
          loadSignatureToCanvas(id, true);
        }
      });
    }, 200);
  }

  // Setup settings auto-save
  (document.getElementById('settings-remove-link') || LEER).addEventListener('change', () => {
    saveSettings();
    updateFooterLink();
  });
  (document.getElementById('settings-auto-load') || LEER).addEventListener('change', saveSettings);
  (document.getElementById('settings-auto-signature') || LEER).addEventListener('change', saveSettings);
  
  console.log('Init complete');
});

// ═══════════════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════════════════════

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  const tab = document.getElementById('tab-' + tabName);
  const btn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
  
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');
  
  // Re-init canvases on tab switch (in case they weren't visible before)
  setTimeout(initAllCanvases, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

function setTodayDates() {
  const today = new Date().toISOString().split('T')[0];
  const dateIds = [
    'a-datum', 'g-datum', 'a-datum-ag', 'a-datum-pruefer',
    'g-datum-ag', 'g-datum-pruefer'
  ];
  dateIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MEASUREMENT TABLE (Stromkreismessungen)
// ═══════════════════════════════════════════════════════════════════════════

function initMeasurementRows() {
  const tbody = document.getElementById('measurement-tbody');
  if (!tbody) return;
  if (tbody.children.length === 0) {
    for (let i = 0; i < 10; i++) addMeasurementRow();
  }
}

function addMeasurementRow() {
  const tbody = document.getElementById('measurement-tbody');
  if (!tbody) return;
  const rowNum = tbody.children.length + 1;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td style="text-align: center;"><span class="row-num">${rowNum}</span></td>
    <td><input type="text" placeholder="Bezeichnung"></td>
    <td><input type="text" placeholder="z.B. NYM-J"></td>
    <td><input type="text" placeholder="z.B. 1,5"></td>
    <td><input type="text" placeholder="z.B. 3"></td>
    <td><input type="text" placeholder="B/C"></td>
    <td><input type="number" step="1" placeholder="A"></td>
    <td><input type="text" placeholder="Zs / Ik"></td>
    <td><input type="number" step="0.01" placeholder="MΩ"></td>
    <td><input type="text" placeholder="Typ / IΔN"></td>
    <td style="text-align: center;"><input type="checkbox"></td>
    <td style="text-align: center;"><input type="checkbox"></td>
    <td><input type="number" step="0.1" placeholder="V"></td>
    <td><input type="number" step="0.01" placeholder="Ω"></td>
    <td><select><option>--</option><option>i.O.</option><option>n.i.O.</option></select></td>
    <td style="text-align: center;"><button onclick="this.parentElement.parentElement.remove();updateRowNumbers()" type="button" class="btn btn-small btn-weg" aria-label="Zeile entfernen">✕</button></td>
  `;
  tbody.appendChild(row);
}

function updateRowNumbers() {
  const tbody = document.getElementById('measurement-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach((tr, i) => {
    const num = tr.querySelector('.row-num');
    if (num) num.textContent = i + 1;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS / SIGNATURE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

const initializedCanvases = new Set();

function initAllCanvases() {
  const canvasIds = ['a-sig-pruefer', 'a-sig-ag', 'g-sig-pruefer', 'g-sig-ag', 'sig-canvas'];
  canvasIds.forEach(id => initCanvas(id));
}

function initCanvas(canvasId) {
  if (initializedCanvases.has(canvasId)) return;
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  // Wait for visibility
  if (canvas.offsetWidth === 0) {
    setTimeout(() => initCanvas(canvasId), 100);
    return;
  }

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';

  let drawing = false;

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    const c = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const c = getCoords(e);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  });

  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mouseleave', () => drawing = false);

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    drawing = true;
    const c = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    const c = getCoords(e);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    drawing = false;
  }, { passive: false });

  initializedCanvases.add(canvasId);
  console.log(`✓ Canvas ${canvasId} initialized (${canvas.width}x${canvas.height})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function clearSignature(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function saveSignature() {
  const canvas = document.getElementById('sig-canvas');
  if (!canvas) {
    alert('Canvas nicht gefunden');
    return;
  }

  try {
    const data = canvas.toDataURL('image/png');
    localStorage.setItem(SIGNATURE_KEY, data);
    loadStoredSignature();
    alert('✓ Unterschrift gespeichert');
  } catch (e) {
    alert('Fehler: ' + e.message);
  }
}

function deleteSavedSignature() {
  if (!confirm('Gespeicherte Unterschrift wirklich löschen?')) return;
  localStorage.removeItem(SIGNATURE_KEY);
  const stored = document.getElementById('sig-stored');
  if (stored) {
    const ctx = stored.getContext('2d');
    ctx.clearRect(0, 0, stored.width, stored.height);
  }
  alert('✓ Gespeicherte Unterschrift gelöscht');
}

function loadStoredSignature() {
  const canvas = document.getElementById('sig-stored');
  if (!canvas) return;

  const data = localStorage.getItem(SIGNATURE_KEY);
  if (!data) return;

  // Set canvas dimensions if not yet set
  if (canvas.width === 0 || canvas.width === 300) {
    canvas.width = canvas.offsetWidth || 350;
    canvas.height = canvas.offsetHeight || 100;
  }

  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9;
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  };
  img.src = data;
}

function loadSignatureToCanvas(targetCanvasId, silent = false) {
  const data = localStorage.getItem(SIGNATURE_KEY);
  if (!data) {
    if (!silent) alert('Keine gespeicherte Unterschrift vorhanden.\n\nBitte erst im Stammdaten-Tab eine Unterschrift speichern.');
    return;
  }

  const canvas = document.getElementById(targetCanvasId);
  if (!canvas) return;

  // Ensure canvas dimensions are set
  if (canvas.width === 0 || canvas.width === 300) {
    canvas.width = canvas.offsetWidth || 350;
    canvas.height = canvas.offsetHeight || 100;
  }

  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.85;
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  };
  img.src = data;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEASUREMENT DEVICE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function saveMeasurementDevice() {
  const fabrikat = (document.getElementById('a-mg-fabrikat') || LEER).value;
  const typ = (document.getElementById('a-mg-typ') || LEER).value;
  const sn = (document.getElementById('a-mg-sn') || LEER).value;
  const kal = (document.getElementById('a-mg-kal') || LEER).value;

  if (!fabrikat && !typ) {
    alert('Bitte mindestens Fabrikat oder Typ eingeben');
    return;
  }

  const device = {
    fabrikat: fabrikat || '',
    typ: typ || '',
    sn: sn || '',
    kal: kal || '',
    saved: new Date().toISOString()
  };

  let devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  
  // Remove duplicate
  const key = `${device.fabrikat}|${device.typ}`;
  devices = devices.filter(d => `${d.fabrikat || ''}|${d.typ}` !== key);
  devices.unshift(device);
  devices = devices.slice(0, 20);

  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  updateDevicesList();
  alert(`✓ Messgerät gespeichert:\n${device.fabrikat} ${device.typ}`);
}

function addDeviceFromStammdaten() {
  const fabrikat = (document.getElementById('sd-mg-fabrikat') || LEER).value;
  const typ = (document.getElementById('sd-mg-typ') || LEER).value;
  const sn = (document.getElementById('sd-mg-sn') || LEER).value;
  const kal = (document.getElementById('sd-mg-kal') || LEER).value;

  if (!fabrikat && !typ) {
    alert('Bitte mindestens Fabrikat oder Typ eingeben');
    return;
  }

  const device = {
    fabrikat: fabrikat || '',
    typ: typ || '',
    sn: sn || '',
    kal: kal || '',
    saved: new Date().toISOString()
  };

  let devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  const key = `${device.fabrikat}|${device.typ}`;
  devices = devices.filter(d => `${d.fabrikat || ''}|${d.typ}` !== key);
  devices.unshift(device);
  devices = devices.slice(0, 20);

  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  updateDevicesList();
  
  // Clear input fields
  document.getElementById('sd-mg-fabrikat').value = '';
  document.getElementById('sd-mg-typ').value = '';
  document.getElementById('sd-mg-sn').value = '';
  document.getElementById('sd-mg-kal').value = '';
  
  alert(`✓ Messgerät hinzugefügt: ${device.fabrikat} ${device.typ}`);
}

function loadMeasurementDevice() {
  const devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  if (devices.length === 0) {
    alert('Keine gespeicherten Messgeräte vorhanden.\n\nFüge welche im Stammdaten-Tab hinzu.');
    return;
  }

  // If multiple devices, show selection
  if (devices.length > 1) {
    let msg = 'Welches Messgerät laden?\n\n';
    devices.forEach((d, i) => {
      msg += `${i + 1}. ${d.fabrikat} ${d.typ}${d.sn ? ' (SN: ' + d.sn + ')' : ''}\n`;
    });
    msg += '\nNummer eingeben (1-' + devices.length + '):';
    const input = prompt(msg, '1');
    if (!input) return;
    const idx = parseInt(input) - 1;
    if (idx < 0 || idx >= devices.length) {
      alert('Ungültige Nummer');
      return;
    }
    loadDevice(devices[idx]);
  } else {
    loadDevice(devices[0]);
  }
}

function loadDevice(device) {
  document.getElementById('a-mg-fabrikat').value = device.fabrikat || '';
  document.getElementById('a-mg-typ').value = device.typ || '';
  document.getElementById('a-mg-sn').value = device.sn || '';
  document.getElementById('a-mg-kal').value = device.kal || '';
  alert(`✓ Messgerät geladen:\n${device.fabrikat} ${device.typ}`);
}

function updateDevicesList() {
  const list = document.getElementById('devices-list');
  if (!list) return;

  const devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  if (devices.length === 0) {
    list.innerHTML = '<em style="color:var(--leise);">Keine Messgeräte gespeichert</em>';
    return;
  }

  let html = '<ol>';
  devices.forEach((d, i) => {
    html += `<li>
      <strong>${d.fabrikat || ''} ${d.typ || ''}</strong>
      ${d.sn ? ' | SN: ' + d.sn : ''}
      ${d.kal ? ' | Kal: ' + d.kal : ''}
      <button onclick="deleteDevice(${i})" class="btn btn-small btn-weg" style="float: right;" aria-label="entfernen">✕</button>
    </li>`;
  });
  html += '</ol>';
  list.innerHTML = html;
}

function deleteDevice(index) {
  let devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  if (!confirm(`Gerät "${devices[index].fabrikat} ${devices[index].typ}" wirklich löschen?`)) return;
  devices.splice(index, 1);
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  updateDevicesList();
}

function showDevicesJSON() {
  const devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  alert('Messgeräte (JSON):\n\n' + JSON.stringify(devices, null, 2));
}

function exportDevicesJSON() {
  const devices = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
  if (devices.length === 0) {
    alert('Keine Messgeräte zum Exportieren');
    return;
  }

  const data = {
    __type: 'elektroprotokoll-devices',
    version: 1,
    devices: devices,
    exported: new Date().toISOString()
  };

  const json = JSON.stringify(data, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = `messgeraete-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  alert(`✓ ${devices.length} Messgeräte exportiert`);
}

function importDevicesJSON() {
  document.getElementById('devices-file-input').click();
}

function handleDevicesImport(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      let devices = [];

      if (data.__type === 'elektroprotokoll-devices' && data.devices) {
        devices = data.devices;
      } else if (Array.isArray(data)) {
        devices = data;
      } else if (data.devices && Array.isArray(data.devices)) {
        devices = data.devices;
      } else {
        throw new Error('Keine Geräte in der Datei gefunden');
      }

      // Merge with existing
      const existing = JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]');
      const merged = [...devices];
      existing.forEach(d => {
        const key = `${d.fabrikat || ''}|${d.typ}`;
        if (!merged.find(m => `${m.fabrikat || ''}|${m.typ}` === key)) {
          merged.push(d);
        }
      });

      localStorage.setItem(DEVICES_KEY, JSON.stringify(merged.slice(0, 20)));
      updateDevicesList();
      alert(`✓ ${devices.length} Messgeräte importiert (insgesamt: ${merged.length})`);
    } catch (err) {
      alert('❌ Fehler beim Import: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function clearAllDevices() {
  if (!confirm('Wirklich ALLE gespeicherten Messgeräte löschen?')) return;
  localStorage.removeItem(DEVICES_KEY);
  updateDevicesList();
  alert('✓ Alle Messgeräte gelöscht');
}

// ═══════════════════════════════════════════════════════════════════════════
// STAMMDATEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function applyStammdaten() {
  const firma = (document.getElementById('sd-firma') || LEER).value;
  const p1 = (document.getElementById('sd-p1') || LEER).value;

  let applied = [];

  if (firma) {
    const aAg = document.getElementById('a-auftraggeber');
    const gAg = document.getElementById('g-auftraggeber');
    if (aAg && !aAg.value) { aAg.value = firma; applied.push('Anlage Auftraggeber'); }
    if (gAg && !gAg.value) { gAg.value = firma; applied.push('Gerät Auftraggeber'); }
  }
  
  if (p1) {
    const aP = document.getElementById('a-pruefer');
    const gP = document.getElementById('g-pruefer');
    if (aP && !aP.value) { aP.value = p1; applied.push('Anlage Prüfer'); }
    if (gP && !gP.value) { gP.value = p1; applied.push('Gerät Prüfer'); }
  }

  if (applied.length > 0) {
    alert('✓ Übernommen:\n' + applied.join('\n'));
  } else {
    alert('Keine leeren Felder gefunden. Bitte erst Stammdaten eingeben.');
  }
}

function exportStammdaten() {
  const data = {
    __type: 'elektroprotokoll-stammdaten',
    version: 1,
    firma: (document.getElementById('sd-firma') || LEER).value || '',
    tel: (document.getElementById('sd-tel') || LEER).value || '',
    str: (document.getElementById('sd-str') || LEER).value || '',
    mail: (document.getElementById('sd-mail') || LEER).value || '',
    ort: (document.getElementById('sd-ort') || LEER).value || '',
    web: (document.getElementById('sd-web') || LEER).value || '',
    ustid: (document.getElementById('sd-ustid') || LEER).value || '',
    innung: (document.getElementById('sd-innung') || LEER).value || '',
    meister: (document.getElementById('sd-meister') || LEER).value || '',
    p1: (document.getElementById('sd-p1') || LEER).value || '',
    p1_bef: (document.getElementById('sd-p1-bef') || LEER).value || '',
    p2: (document.getElementById('sd-p2') || LEER).value || '',
    p2_bef: (document.getElementById('sd-p2-bef') || LEER).value || '',
    devices: JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]'),
    exported: new Date().toISOString()
  };

  const json = JSON.stringify(data, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = `stammdaten-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  alert(`✓ Stammdaten exportiert:\n- Firmendaten\n- ${data.devices.length} Messgeräte`);
}

function exportAllSettings() {
  const stammdaten = {
    firma: (document.getElementById('sd-firma') || LEER).value || '',
    tel: (document.getElementById('sd-tel') || LEER).value || '',
    str: (document.getElementById('sd-str') || LEER).value || '',
    mail: (document.getElementById('sd-mail') || LEER).value || '',
    ort: (document.getElementById('sd-ort') || LEER).value || '',
    web: (document.getElementById('sd-web') || LEER).value || '',
    ustid: (document.getElementById('sd-ustid') || LEER).value || '',
    innung: (document.getElementById('sd-innung') || LEER).value || '',
    meister: (document.getElementById('sd-meister') || LEER).value || '',
    p1: (document.getElementById('sd-p1') || LEER).value || '',
    p1_bef: (document.getElementById('sd-p1-bef') || LEER).value || '',
    p2: (document.getElementById('sd-p2') || LEER).value || '',
    p2_bef: (document.getElementById('sd-p2-bef') || LEER).value || ''
  };

  const data = {
    __type: 'elektroprotokoll-all',
    version: 1,
    stammdaten: stammdaten,
    settings: JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    devices: JSON.parse(localStorage.getItem(DEVICES_KEY) || '[]'),
    signature: localStorage.getItem(SIGNATURE_KEY) || null,
    exported: new Date().toISOString()
  };

  const json = JSON.stringify(data, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stammdaten));
  
  alert(`✓ KOMPLETT-BACKUP erstellt:\n- Stammdaten\n- ${data.devices.length} Messgeräte\n- Einstellungen\n- Unterschrift: ${data.signature ? 'JA' : 'nein'}`);
}

function importStammdaten(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      if (!(data.__type || '').includes('elektroprotokoll')) {
        throw new Error('Keine ElektroProtokoll JSON-Datei');
      }

      let imported = [];

      // Single stammdaten file
      if (data.__type === 'elektroprotokoll-stammdaten') {
        applyStammdatenToFields(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        imported.push('Stammdaten');
        
        if (data.devices && data.devices.length > 0) {
          localStorage.setItem(DEVICES_KEY, JSON.stringify(data.devices));
          updateDevicesList();
          imported.push(`${data.devices.length} Messgeräte`);
        }
      }
      // Devices only
      else if (data.__type === 'elektroprotokoll-devices') {
        if (data.devices) {
          localStorage.setItem(DEVICES_KEY, JSON.stringify(data.devices));
          updateDevicesList();
          imported.push(`${data.devices.length} Messgeräte`);
        }
      }
      // Full backup
      else if (data.__type === 'elektroprotokoll-all') {
        if (data.stammdaten) {
          applyStammdatenToFields(data.stammdaten);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.stammdaten));
          imported.push('Stammdaten');
        }
        if (data.settings) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
          loadSettings();
          imported.push('Einstellungen');
        }
        if (data.devices) {
          localStorage.setItem(DEVICES_KEY, JSON.stringify(data.devices));
          updateDevicesList();
          imported.push(`${data.devices.length} Messgeräte`);
        }
        if (data.signature) {
          localStorage.setItem(SIGNATURE_KEY, data.signature);
          loadStoredSignature();
          imported.push('Unterschrift');
        }
      }

      alert('✓ Import erfolgreich:\n' + imported.join('\n'));
    } catch (err) {
      alert('❌ Fehler: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function applyStammdatenToFields(data) {
  if (data.firma !== undefined) document.getElementById('sd-firma').value = data.firma;
  if (data.tel !== undefined) document.getElementById('sd-tel').value = data.tel;
  if (data.str !== undefined) document.getElementById('sd-str').value = data.str;
  if (data.mail !== undefined) document.getElementById('sd-mail').value = data.mail;
  if (data.ort !== undefined) document.getElementById('sd-ort').value = data.ort;
  if (data.web !== undefined) document.getElementById('sd-web').value = data.web;
  if (data.ustid !== undefined) document.getElementById('sd-ustid').value = data.ustid;
  if (data.innung !== undefined) document.getElementById('sd-innung').value = data.innung;
  if (data.meister !== undefined) document.getElementById('sd-meister').value = data.meister;
  if (data.p1 !== undefined) document.getElementById('sd-p1').value = data.p1;
  if (data.p1_bef !== undefined) document.getElementById('sd-p1-bef').value = data.p1_bef;
  if (data.p2 !== undefined) document.getElementById('sd-p2').value = data.p2;
  if (data.p2_bef !== undefined) document.getElementById('sd-p2-bef').value = data.p2_bef;
}

function loadStammdaten() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      applyStammdatenToFields(data);
    } catch (e) {
      console.error('Error loading stammdaten:', e);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

function saveSettings() {
  const settings = {
    removeLink: (document.getElementById('settings-remove-link') || LEER).checked || false,
    autoLoad: (document.getElementById('settings-auto-load') || LEER).checked || false,
    autoSignature: (document.getElementById('settings-auto-signature') || LEER).checked || false
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      const removeLink = document.getElementById('settings-remove-link');
      const autoLoad = document.getElementById('settings-auto-load');
      const autoSig = document.getElementById('settings-auto-signature');
      if (removeLink) removeLink.checked = settings.removeLink;
      if (autoLoad) autoLoad.checked = settings.autoLoad;
      if (autoSig) autoSig.checked = settings.autoSignature;
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER LINK
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
// DRAG & DROP
// ═══════════════════════════════════════════════════════════════════════════

function setupDropZone() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      document.getElementById('file-input').files = e.dataTransfer.files;
      importStammdaten(document.getElementById('file-input'));
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM RESET
// ═══════════════════════════════════════════════════════════════════════════

function resetForm(type) {
  if (!confirm('Formular wirklich leeren? Alle Daten in diesem Tab gehen verloren.')) return;

  const tab = document.getElementById('tab-' + type);
  if (!tab) return;

  tab.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
    } else {
      el.value = '';
    }
  });

  // Clear all canvases in this tab
  tab.querySelectorAll('canvas').forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  setTodayDates();
  tab.dispatchEvent(new Event('input', { bubbles: true }));
  alert('✓ Formular geleert');
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE ALL DATA
// ═══════════════════════════════════════════════════════════════════════════

function clearAllData() {
  if (!confirm('⚠️ ACHTUNG!\n\nWirklich ALLE Daten dieser App löschen?\n\n- Stammdaten\n- Messgeräte\n- Unterschrift\n- Einstellungen\n\nDiese Aktion kann nicht rückgängig gemacht werden!')) return;
  
  if (!confirm('Bist du WIRKLICH sicher? Nochmal bestätigen:')) return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SIGNATURE_KEY);
  localStorage.removeItem(DEVICES_KEY);
  
  alert('✓ Alle Daten gelöscht. Seite wird neu geladen.');
  location.reload();
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════════════════

function exportPDF(type) {
  // Update footer before printing
  updateFooterLink();
  
  // Remove any previous print-active markers
  document.querySelectorAll('.print-active').forEach(el => el.classList.remove('print-active'));
  
  // Mark only the relevant tab for printing
  const tabToPrint = document.getElementById('tab-' + type);
  if (tabToPrint) {
    tabToPrint.classList.add('print-active');
  }
  
  // Anlagenprüfung druckt im Querformat (@page quer in protokoll.css)
  
  // Restore after print dialog closes
  const restorePrint = () => {
    document.querySelectorAll('.print-active').forEach(el => el.classList.remove('print-active'));
    window.removeEventListener('afterprint', restorePrint);
  };
  window.addEventListener('afterprint', restorePrint);
  
  // Trigger print
  setTimeout(() => {
    window.print();
  }, 100);
}
