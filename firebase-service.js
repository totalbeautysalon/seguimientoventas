/**
 * Total Beauty Salón y Academia - Servicio de Firebase y Persistencia Local
 * Interconexión 100% de Ventas, Arqueos, Caja Chica, Leads/Tipificación y Campañas.
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
    } catch (e) {}
    notifyStatus(false, 'Modo Local / Sin Conexión');
    return false;
  }

  // =========================================================================
  // 1. REGISTRO DIARIO DE VENTAS (INTERCONECTADO)
  // =========================================================================
  async function saveVenta(venta) {
    if (!venta.id) {
      venta.id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    const fecha = venta.fecha || new Date().toISOString().split('T')[0];

    // LocalStorage
    const localVentas = JSON.parse(localStorage.getItem('tb_ventas_db') || '{}');
    if (!localVentas[fecha]) localVentas[fecha] = {};
    localVentas[fecha][venta.id] = venta;
    localStorage.setItem('tb_ventas_db', JSON.stringify(localVentas));

    // Firebase
    try {
      await fetch(`${CONFIG.databaseURL}/ventas_diarias/${fecha}/${venta.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venta)
      });
      notifyStatus(true, 'Venta guardada en Firebase');
      return { success: true, id: venta.id, source: 'firebase' };
    } catch (e) {
      notifyStatus(false, 'Venta guardada localmente');
      return { success: true, id: venta.id, source: 'local' };
    }
  }

  async function getVentasByFecha(fecha) {
    const localVentas = JSON.parse(localStorage.getItem('tb_ventas_db') || '{}');
    const local = localVentas[fecha] || {};

    try {
      const res = await fetch(`${CONFIG.databaseURL}/ventas_diarias/${fecha}.json`);
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && typeof cloud === 'object') {
          const merged = { ...local, ...cloud };
          localVentas[fecha] = merged;
          localStorage.setItem('tb_ventas_db', JSON.stringify(localVentas));
          return Object.values(merged);
        }
      }
    } catch (e) {}

    return Object.values(local);
  }

  async function deleteVenta(fecha, id) {
    const localVentas = JSON.parse(localStorage.getItem('tb_ventas_db') || '{}');
    if (localVentas[fecha] && localVentas[fecha][id]) {
      delete localVentas[fecha][id];
      localStorage.setItem('tb_ventas_db', JSON.stringify(localVentas));
    }

    try {
      await fetch(`${CONFIG.databaseURL}/ventas_diarias/${fecha}/${id}.json`, {
        method: 'DELETE'
      });
    } catch (e) {}
    return { success: true };
  }

  // =========================================================================
  // 2. ARQUEOS DE CAJA PRINCIPAL Y CAJA CHICA
  // =========================================================================
  async function saveArqueoPrincipal(data, pdfBase64 = null) {
    const fecha = data.header.fecha || new Date().toISOString().split('T')[0];
    const key = `${fecha}_${(data.header.responsable || 'responsable').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const payload = {
      tipo: 'caja_principal',
      ...data,
      pdfBase64: pdfBase64 || null,
      savedAt: new Date().toISOString()
    };

    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');
    localHistory[key] = payload;
    localStorage.setItem('tb_arqueos_history', JSON.stringify(localHistory));

    try {
      await fetch(`${CONFIG.databaseURL}/arqueos_caja/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notifyStatus(true, 'Arqueo guardado en Firebase');
      return { success: true, key, source: 'firebase' };
    } catch (err) {
      notifyStatus(false, 'Arqueo guardado localmente');
    }
    return { success: true, key, source: 'local' };
  }

  async function getArqueosList() {
    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');
    try {
      const res = await fetch(`${CONFIG.databaseURL}/arqueos_caja.json`);
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object') {
          const combined = { ...localHistory, ...cloudData };
          localStorage.setItem('tb_arqueos_history', JSON.stringify(combined));
          return combined;
        }
      }
    } catch (err) {}
    return localHistory;
  }

  async function saveArqueoCajaChica(data, pdfBase64 = null) {
    const fecha = data.header.fecha || new Date().toISOString().split('T')[0];
    const key = `${fecha}_${(data.header.responsable || 'responsable').replace(/[^a-zA-Z0-9]/g, '_')}`;

    const payload = {
      tipo: 'caja_chica',
      ...data,
      pdfBase64: pdfBase64 || null,
      savedAt: new Date().toISOString()
    };

    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');
    localHistory[key] = payload;
    localStorage.setItem('tb_arqueos_chica_history', JSON.stringify(localHistory));

    try {
      await fetch(`${CONFIG.databaseURL}/arqueos_caja_chica/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      notifyStatus(true, 'Caja chica guardada en Firebase');
      return { success: true, key, source: 'firebase' };
    } catch (err) {
      notifyStatus(false, 'Caja chica guardada localmente');
    }
    return { success: true, key, source: 'local' };
  }

  async function getArqueosChicaList() {
    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');
    try {
      const res = await fetch(`${CONFIG.databaseURL}/arqueos_caja_chica.json`);
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

  // =========================================================================
  // 3. BALANCESCORE POR ESTACIONES
  // =========================================================================
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
      await fetch(`${CONFIG.databaseURL}/balancescore/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { success: true, source: 'firebase' };
    } catch (e) {}
    return { success: true, source: 'local' };
  }

  async function getBalanceScore(fecha) {
    const key = fecha || new Date().toISOString().split('T')[0];
    const localScores = JSON.parse(localStorage.getItem('tb_balancescore') || '{}');
    try {
      const res = await fetch(`${CONFIG.databaseURL}/balancescore/${key}.json`);
      if (res.ok) {
        const cloud = await res.json();
        if (cloud) return cloud;
      }
    } catch (e) {}
    return localScores[key] || null;
  }

  // =========================================================================
  // 4. REPORTE DIARIO DE INGRESOS
  // =========================================================================
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
      await fetch(`${CONFIG.databaseURL}/reportes_ingresos/${key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { success: true, source: 'firebase' };
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

  // =========================================================================
  // 5. INTERESADAS Y CIERRES (CON TIPIFICACIÓN Y SEGUIMIENTO)
  // =========================================================================
  async function saveLead(lead) {
    if (!lead.id) {
      lead.id = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }
    const localLeads = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');
    localLeads[lead.id] = lead;
    localStorage.setItem('tb_leads_db', JSON.stringify(localLeads));

    try {
      await fetch(`${CONFIG.databaseURL}/leads_seguimiento/${lead.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
      return { success: true, id: lead.id, source: 'firebase' };
    } catch (e) {
      return { success: true, id: lead.id, source: 'local' };
    }
  }

  async function getLeadsAll() {
    const localLeads = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');
    try {
      const res = await fetch(`${CONFIG.databaseURL}/leads_seguimiento.json`);
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && typeof cloud === 'object') {
          const merged = { ...localLeads, ...cloud };
          localStorage.setItem('tb_leads_db', JSON.stringify(merged));
          return Object.values(merged);
        }
      }
    } catch (e) {}
    return Object.values(localLeads);
  }

  async function updateLeadSeguimiento(leadId, nuevoSeguimiento, nuevaTipificacion) {
    const localLeads = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');
    if (!localLeads[leadId]) return { success: false };

    const lead = localLeads[leadId];
    if (!lead.historialSeguimiento) lead.historialSeguimiento = [];
    lead.historialSeguimiento.push({
      fechaHora: new Date().toISOString(),
      ...nuevoSeguimiento
    });
    if (nuevaTipificacion) {
      lead.tipificacion = nuevaTipificacion;
    }
    lead.updatedAt = new Date().toISOString();
    localLeads[leadId] = lead;
    localStorage.setItem('tb_leads_db', JSON.stringify(localLeads));

    try {
      await fetch(`${CONFIG.databaseURL}/leads_seguimiento/${leadId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead)
      });
    } catch (e) {}

    return { success: true, lead };
  }

  // =========================================================================
  // 6. CAMPAÑA ACTIVA Y EVENTOS DEL MES
  // =========================================================================
  async function saveCampanaActiva(campana) {
    localStorage.setItem('tb_campana_activa', JSON.stringify(campana));
    try {
      await fetch(`${CONFIG.databaseURL}/campana_activa.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campana)
      });
      return { success: true, source: 'firebase' };
    } catch (e) {}
    return { success: true, source: 'local' };
  }

  async function getCampanaActiva() {
    const local = JSON.parse(localStorage.getItem('tb_campana_activa') || 'null');
    try {
      const res = await fetch(`${CONFIG.databaseURL}/campana_activa.json`);
      if (res.ok) {
        const cloud = await res.json();
        if (cloud) {
          localStorage.setItem('tb_campana_activa', JSON.stringify(cloud));
          return cloud;
        }
      }
    } catch (e) {}
    return local;
  }

  async function saveEvento(evento) {
    if (!evento.id) {
      evento.id = `ev_${Date.now()}`;
    }
    const localEventos = JSON.parse(localStorage.getItem('tb_eventos_db') || '{}');
    localEventos[evento.id] = evento;
    localStorage.setItem('tb_eventos_db', JSON.stringify(localEventos));

    try {
      await fetch(`${CONFIG.databaseURL}/eventos_mes/${evento.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evento)
      });
    } catch (e) {}
    return { success: true, id: evento.id };
  }

  async function getEventosAll() {
    const local = JSON.parse(localStorage.getItem('tb_eventos_db') || '{}');
    try {
      const res = await fetch(`${CONFIG.databaseURL}/eventos_mes.json`);
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && typeof cloud === 'object') {
          const merged = { ...local, ...cloud };
          localStorage.setItem('tb_eventos_db', JSON.stringify(merged));
          return Object.values(merged);
        }
      }
    } catch (e) {}
    return Object.values(local);
  }

  setTimeout(testConnection, 500);

  return {
    CONFIG,
    testConnection,
    onConnectionChange,
    saveVenta,
    getVentasByFecha,
    deleteVenta,
    saveArqueo: saveArqueoPrincipal,
    saveArqueoPrincipal,
    getArqueosList,
    saveArqueoCajaChica,
    getArqueosChicaList,
    saveBalanceScore,
    getBalanceScore,
    saveIngresosReport,
    getIngresosReport,
    saveLead,
    getLeadsAll,
    updateLeadSeguimiento,
    saveCampanaActiva,
    getCampanaActiva,
    saveEvento,
    getEventosAll
  };
})();
