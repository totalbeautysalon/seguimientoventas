/**
 * Total Beauty Salón y Academia - Servicio de Firebase
 * Sincronización en la nube con total-beauty-crm y respaldo offline en localStorage.
 */

const TB_FIREBASE = (function () {
  'use strict';

  const CONFIG = {
    apiKey: "AIzaSyBlOxvGvw3-KddRfK63EOKhrM4MjA1wpNY",
    authDomain: "total-beauty-crm.firebaseapp.com",
    databaseURL: "https://total-beauty-crm-default-rtdb.firebaseio.com",
    projectId: "total-beauty-crm",
    storageBucket: "total-beauty-crm.firebasestorage.app",
    messagingSenderId: "790991554884",
    appId: "1:790991554884:web:7d52bbc3e4fd1e442d6f11"
  };

  let isOnline = false;
  let statusListeners = [];

  function notifyStatus(status, detail = '') {
    isOnline = status;
    statusListeners.forEach(fn => fn(status, detail));
  }

  function onConnectionChange(fn) {
    statusListeners.push(fn);
  }

  // Comprobar conectividad con Firebase Realtime Database
  async function testConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${CONFIG.databaseURL}/.info/connected.json`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        notifyStatus(true, 'Conectado a Firebase CRM');
        return true;
      }
    } catch (e) {
      // Offline fallback
    }
    notifyStatus(false, 'Modo Local / Sin Conexión');
    return false;
  }

  // --- 1. ARQUEO DE CAJA PRINCIPAL ---
  async function saveArqueoPrincipal(data, pdfBase64 = null) {
    const fecha = data.header.fecha || new Date().toISOString().split('T')[0];
    const key = `${fecha}_${(data.header.responsable || 'responsable').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const payload = {
      tipo: 'caja_principal',
      ...data,
      pdfBase64: pdfBase64 || null,
      savedAt: new Date().toISOString()
    };

    // Respaldo en localStorage
    try {
      const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');
      localHistory[key] = payload;
      localStorage.setItem('tb_arqueos_history', JSON.stringify(localHistory));
    } catch (e) {
      console.warn('Error en localStorage', e);
    }

    // Sincronizar en Firebase
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${CONFIG.databaseURL}/arqueos_caja/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        notifyStatus(true, 'Guardado en Firebase');
        return { success: true, key, source: 'firebase' };
      }
    } catch (err) {
      console.warn('Firebase offline, guardado localmente:', err);
      notifyStatus(false, 'Guardado localmente (Offline)');
    }

    return { success: true, key, source: 'local' };
  }

  async function getArqueosList() {
    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CONFIG.databaseURL}/arqueos_caja.json`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object') {
          notifyStatus(true, 'Sincronizado');
          const combined = { ...localHistory, ...cloudData };
          localStorage.setItem('tb_arqueos_history', JSON.stringify(combined));
          return combined;
        }
      }
    } catch (err) {
      notifyStatus(false, 'Historial local');
    }

    return localHistory;
  }

  // --- 2. ARQUEO DE CAJA CHICA ---
  async function saveArqueoCajaChica(data, pdfBase64 = null) {
    const fecha = data.header.fecha || new Date().toISOString().split('T')[0];
    const key = `${fecha}_${(data.header.responsable || 'responsable').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const payload = {
      tipo: 'caja_chica',
      ...data,
      pdfBase64: pdfBase64 || null,
      savedAt: new Date().toISOString()
    };

    // Respaldo en localStorage
    try {
      const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');
      localHistory[key] = payload;
      localStorage.setItem('tb_arqueos_chica_history', JSON.stringify(localHistory));
    } catch (e) {
      console.warn('Error en localStorage', e);
    }

    // Sincronizar en Firebase
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${CONFIG.databaseURL}/arqueos_caja_chica/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        notifyStatus(true, 'Guardado en Firebase');
        return { success: true, key, source: 'firebase' };
      }
    } catch (err) {
      notifyStatus(false, 'Guardado localmente (Offline)');
    }

    return { success: true, key, source: 'local' };
  }

  async function getArqueosChicaList() {
    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${CONFIG.databaseURL}/arqueos_caja_chica.json`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object') {
          const combined = { ...localHistory, ...cloudData };
          localStorage.setItem('tb_arqueos_chica_history', JSON.stringify(combined));
          return combined;
        }
      }
    } catch (err) {}

    return localHistory;
  }

  // --- 3. BALANCESCORE POR ESTACIONES ---
  async function saveBalanceScore(fecha, stationsData) {
    const key = fecha || new Date().toISOString().split('T')[0];
    const payload = {
      fecha: key,
      stations: stationsData,
      updatedAt: new Date().toISOString()
    };

    const localScores = JSON.parse(localStorage.getItem('tb_balancescore') || '{}');
    localScores[key] = payload;
    localStorage.setItem('tb_balancescore', JSON.stringify(localScores));

    try {
      const res = await fetch(`${CONFIG.databaseURL}/balancescore/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return { success: true, source: 'firebase' };
    } catch (e) {}
    return { success: true, source: 'local' };
  }

  // --- 4. REPORTE DIARIO DE INGRESOS ---
  async function saveIngresosReport(fecha, reportData) {
    const key = fecha || new Date().toISOString().split('T')[0];
    const payload = {
      fecha: key,
      ...reportData,
      updatedAt: new Date().toISOString()
    };

    const localIngresos = JSON.parse(localStorage.getItem('tb_ingresos_reportes') || '{}');
    localIngresos[key] = payload;
    localStorage.setItem('tb_ingresos_reportes', JSON.stringify(localIngresos));

    try {
      const res = await fetch(`${CONFIG.databaseURL}/reportes_ingresos/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return { success: true, source: 'firebase' };
    } catch (e) {}
    return { success: true, source: 'local' };
  }

  async function getIngresosReport(fecha) {
    const key = fecha || new Date().toISOString().split('T')[0];
    const local = JSON.parse(localStorage.getItem('tb_ingresos_reportes') || '{}');

    try {
      const res = await fetch(`${CONFIG.databaseURL}/reportes_ingresos/${key}.json`);
      if (res.ok) {
        const cloud = await res.json();
        if (cloud) return cloud;
      }
    } catch (e) {}

    return local[key] || null;
  }

  // --- 5. INTERESADAS Y CIERRES ---
  async function saveInteresadas(fecha, type, data) {
    const key = fecha || new Date().toISOString().split('T')[0];
    const local = JSON.parse(localStorage.getItem('tb_interesadas_cierres') || '{}');
    if (!local[key]) local[key] = {};
    local[key][type] = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('tb_interesadas_cierres', JSON.stringify(local));

    try {
      const res = await fetch(`${CONFIG.databaseURL}/interesadas_cierres/${key}/${type}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(local[key][type])
      });
      if (res.ok) return { success: true, source: 'firebase' };
    } catch (e) {}

    return { success: true, source: 'local' };
  }

  // --- 6. CAMPAÑA DEL MES Y EVENTOS ---
  async function saveCampanaEventos(periodKey, payload) {
    const key = periodKey || '2026-10';
    const local = JSON.parse(localStorage.getItem('tb_campanas_eventos') || '{}');
    local[key] = {
      ...payload,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('tb_campanas_eventos', JSON.stringify(local));

    try {
      const res = await fetch(`${CONFIG.databaseURL}/campanas_eventos/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(local[key])
      });
      if (res.ok) return { success: true, source: 'firebase' };
    } catch (e) {}

    return { success: true, source: 'local' };
  }

  setTimeout(testConnection, 500);

  return {
    CONFIG,
    testConnection,
    onConnectionChange,
    saveArqueo: saveArqueoPrincipal,
    saveArqueoPrincipal,
    getArqueosList,
    saveArqueoCajaChica,
    getArqueosChicaList,
    saveBalanceScore,
    saveIngresosReport,
    getIngresosReport,
    saveInteresadas,
    saveCampanaEventos
  };
})();
