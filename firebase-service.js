/**
 * Total Beauty Salón y Academia - Servicio de Firebase Authentication y Persistencia Realtime Database
 * Proyecto Oficial: totalbregis (https://totalbregis-default-rtdb.firebaseio.com/)
 * Autenticación mediante correo y contraseña con Firebase Auth REST API y persistencia de sesión.
 */

const TB_FIREBASE = (function () {
  'use strict';

  // Configuración oficial de Firebase del proyecto totalbregis
  const CONFIG = {
    apiKey: "AIzaSyAcQRVT7DUGeJs63yWejuxGGaX9Hnv15xI",
    authDomain: "totalbregis.firebaseapp.com",
    databaseURL: "https://totalbregis-default-rtdb.firebaseio.com",
    projectId: "totalbregis",
    storageBucket: "totalbregis.firebasestorage.app",
    messagingSenderId: "630616601479",
    appId: "1:630616601479:web:3cf47df60bdc3aca165922",
    measurementId: "G-4RY5X8R11B"
  };

  let isOnline = false;
  let statusListeners = [];
  let authListeners = [];
  let currentUser = null;

  function notifyStatus(status, detail = '') {
    isOnline = status;
    statusListeners.forEach(fn => {
      try { fn(status, detail); } catch (e) { console.error(e); }
    });
  }

  function onConnectionChange(fn) {
    statusListeners.push(fn);
  }

  function notifyAuth(user) {
    currentUser = user;
    authListeners.forEach(fn => {
      try { fn(user); } catch (e) { console.error(e); }
    });
  }

  function onAuthChange(fn) {
    authListeners.push(fn);
  }

  function getCurrentUser() {
    return currentUser;
  }

  // =========================================================================
  // AUTENTICACIÓN CON FIREBASE AUTH (CORREO / CONTRASEÑA)
  // =========================================================================

  /**
   * Traducir códigos de error comunes de Firebase Auth a mensajes claros en español
   */
  function translateAuthError(errCode) {
    switch (errCode) {
      case 'INVALID_LOGIN_CREDENTIALS':
      case 'INVALID_PASSWORD':
      case 'EMAIL_NOT_FOUND':
        return 'El correo o la contraseña no coinciden en el proyecto totalbregis. Si aún no ha creado este usuario en totalbregis, use la pestaña "Registrar Cuenta" arriba para darlo de alta.';
      case 'EMAIL_EXISTS':
        return 'Este correo ya está registrado en totalbregis. Si no recuerda su contraseña, use el enlace "¿Olvidó su contraseña?".';
      case 'WEAK_PASSWORD : Password should be at least 6 characters':
      case 'WEAK_PASSWORD':
        return 'La contraseña debe contener al menos 6 caracteres.';
      case 'INVALID_EMAIL':
        return 'El formato del correo electrónico ingresado no es válido.';
      case 'USER_DISABLED':
        return 'Esta cuenta de usuario ha sido inhabilitada en Firebase Console.';
      case 'TOO_MANY_ATTEMPTS_TRY_LATER':
        return 'Demasiados intentos fallidos. Por seguridad, intente de nuevo en unos minutos o restablezca su contraseña.';
      case 'OPERATION_NOT_ALLOWED':
        return 'El inicio de sesión con correo y contraseña no está activado en Firebase Console.';
      default:
        return 'Error de autenticación: ' + (errCode || 'No se pudo conectar con el servicio.');
    }
  }

  /**
   * Iniciar sesión con correo y contraseña
   */
  async function login(email, password, remember = true) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.apiKey}`;
    const cleanEmail = (email || '').trim().toLowerCase();

    // Intentar primero con la contraseña tal como fue escrita
    const passwordsToTry = [password];
    if (password && password.trim() !== password) {
      passwordsToTry.push(password.trim());
    }

    let lastError = null;

    for (const pwd of passwordsToTry) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: pwd,
            returnSecureToken: true
          })
        });

        const data = await res.json();

        if (res.ok && !data.error) {
          const user = {
            email: data.email || cleanEmail,
            localId: data.localId,
            idToken: data.idToken,
            refreshToken: data.refreshToken,
            expiresAt: Date.now() + ((parseInt(data.expiresIn, 10) || 3600) * 1000),
            isOffline: false
          };

          if (remember) {
            localStorage.setItem('tb_auth_user', JSON.stringify(user));
          } else {
            sessionStorage.setItem('tb_auth_user', JSON.stringify(user));
          }

          notifyAuth(user);
          notifyStatus(true, `Sesión iniciada: ${user.email}`);
          return { success: true, user };
        }

        lastError = data.error?.message || 'ERROR_UNKNOWN';
      } catch (err) {
        console.error('Error al iniciar sesión:', err);
        return {
          success: false,
          error: 'No se pudo conectar con los servidores de Firebase. Verifique su conexión a internet.'
        };
      }
    }

    return {
      success: false,
      error: translateAuthError(lastError),
      rawError: lastError
    };
  }

  /**
   * Registrar nueva cuenta en Firebase Authentication
   */
  async function register(email, password) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.apiKey}`;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!password || password.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
          returnSecureToken: true
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errMsg = data.error?.message || 'ERROR_UNKNOWN';
        return { success: false, error: translateAuthError(errMsg), rawError: errMsg };
      }

      const user = {
        email: data.email || cleanEmail,
        localId: data.localId,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + ((parseInt(data.expiresIn, 10) || 3600) * 1000),
        isOffline: false
      };

      localStorage.setItem('tb_auth_user', JSON.stringify(user));
      notifyAuth(user);
      notifyStatus(true, `Cuenta registrada: ${user.email}`);
      return { success: true, user };
    } catch (err) {
      console.error('Error al registrar usuario:', err);
      return {
        success: false,
        error: 'No se pudo conectar con Firebase para registrar la cuenta.'
      };
    }
  }

  /**
   * Acceso de emergencia en Modo Local / Sin Conexión
   */
  function loginOffline(email = '') {
    const user = {
      email: (email || '').trim() || 'operador.local@totalbeauty.com',
      localId: 'offline_user',
      idToken: null,
      refreshToken: null,
      expiresAt: Date.now() + 86400000,
      isOffline: true
    };
    sessionStorage.setItem('tb_auth_user', JSON.stringify(user));
    notifyAuth(user);
    notifyStatus(false, 'Modo Local / Offline');
    return { success: true, user };
  }

  /**
   * Refrescar el idToken usando el refreshToken
   */
  async function refreshAuthToken(refreshToken) {
    try {
      const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CONFIG.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
      });

      if (res.ok) {
        const data = await res.json();
        if (currentUser) {
          currentUser.idToken = data.id_token;
          currentUser.refreshToken = data.refresh_token;
          currentUser.expiresAt = Date.now() + ((parseInt(data.expires_in, 10) || 3600) * 1000);
          if (localStorage.getItem('tb_auth_user')) {
            localStorage.setItem('tb_auth_user', JSON.stringify(currentUser));
          }
        }
        return data.id_token;
      }
    } catch (e) {
      console.warn('No se pudo refrescar token:', e);
    }
    return null;
  }

  /**
   * Verificar sesión guardada al abrir la aplicación
   */
  async function checkSession() {
    const raw = localStorage.getItem('tb_auth_user') || sessionStorage.getItem('tb_auth_user');
    if (!raw) return null;

    try {
      const user = JSON.parse(raw);
      if (user && user.refreshToken) {
        // Si el token está por expirar en menos de 5 minutos, refrescarlo
        if (Date.now() > (user.expiresAt - 300000)) {
          const newToken = await refreshAuthToken(user.refreshToken);
          if (!newToken) {
            // Sesión caducada
            logout();
            return null;
          }
        }
        notifyAuth(user);
        notifyStatus(true, `Sesión activa: ${user.email}`);
        return user;
      }
    } catch (e) {
      console.error('Error verificando sesión:', e);
    }
    return null;
  }

  /**
   * Cerrar sesión del usuario
   */
  function logout() {
    currentUser = null;
    localStorage.removeItem('tb_auth_user');
    sessionStorage.removeItem('tb_auth_user');
    notifyAuth(null);
    notifyStatus(false, 'Sesión cerrada');
    return { success: true };
  }

  /**
   * Enviar enlace de restablecimiento de contraseña
   */
  async function sendPasswordReset(email) {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Por favor ingrese un correo válido.' };
    }

    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${CONFIG.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: email.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: translateAuthError(data.error?.message) };
      }

      return {
        success: true,
        message: `Se ha enviado un enlace para restablecer su contraseña al correo ${email}. Revise su bandeja de entrada.`
      };
    } catch (e) {
      return { success: false, error: 'Error de conexión al solicitar restablecimiento.' };
    }
  }

  // =========================================================================
  // HELPER PARA URLs DE REALTIME DATABASE CON AUTENTICACIÓN
  // =========================================================================
  function getDbUrl(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let base = `${CONFIG.databaseURL}${cleanPath}.json`;
    if (currentUser && currentUser.idToken) {
      base += `?auth=${currentUser.idToken}`;
    }
    return base;
  }

  async function testConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(getDbUrl('.info/connected'), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        notifyStatus(true, 'Conectado a Firebase (totalbregis)');
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

    // LocalStorage redundante
    const localVentas = JSON.parse(localStorage.getItem('tb_ventas_db') || '{}');
    if (!localVentas[fecha]) localVentas[fecha] = {};
    localVentas[fecha][venta.id] = venta;
    localStorage.setItem('tb_ventas_db', JSON.stringify(localVentas));

    // Firebase Realtime Database
    try {
      await fetch(getDbUrl(`ventas_diarias/${fecha}/${venta.id}`), {
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
      const res = await fetch(getDbUrl(`ventas_diarias/${fecha}`));
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
      await fetch(getDbUrl(`ventas_diarias/${fecha}/${id}`), {
        method: 'DELETE'
      });
    } catch (e) {}
    return { success: true };
  }

  async function getVentasByRango(fechaInicio, fechaFin) {
    const localVentas = JSON.parse(localStorage.getItem('tb_ventas_db') || '{}');
    let allVentas = { ...localVentas };

    try {
      const res = await fetch(getDbUrl('ventas_diarias'));
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && typeof cloud === 'object') {
          Object.keys(cloud).forEach(f => {
            allVentas[f] = { ...(allVentas[f] || {}), ...cloud[f] };
          });
          localStorage.setItem('tb_ventas_db', JSON.stringify(allVentas));
        }
      }
    } catch (e) {}

    const resultado = [];
    Object.keys(allVentas).sort().forEach(f => {
      if (f >= fechaInicio && f <= fechaFin) {
        const diaVentas = Object.values(allVentas[f] || {});
        resultado.push(...diaVentas);
      }
    });

    return resultado;
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
      savedAt: new Date().toISOString(),
      userEmail: currentUser?.email || 'admin'
    };

    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');
    localHistory[key] = payload;
    localStorage.setItem('tb_arqueos_history', JSON.stringify(localHistory));

    try {
      await fetch(getDbUrl(`arqueos_caja/${key}`), {
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
      const res = await fetch(getDbUrl('arqueos_caja'));
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
      savedAt: new Date().toISOString(),
      userEmail: currentUser?.email || 'admin'
    };

    const localHistory = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');
    localHistory[key] = payload;
    localStorage.setItem('tb_arqueos_chica_history', JSON.stringify(localHistory));

    try {
      await fetch(getDbUrl(`arqueos_caja_chica/${key}`), {
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
      const res = await fetch(getDbUrl('arqueos_caja_chica'));
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
      await fetch(getDbUrl(`balancescore/${key}`), {
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
      const res = await fetch(getDbUrl(`balancescore/${key}`));
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
      await fetch(getDbUrl(`reportes_ingresos/${key}`), {
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
      const res = await fetch(getDbUrl(`reportes_ingresos/${key}`));
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
      await fetch(getDbUrl(`leads_seguimiento/${lead.id}`), {
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
      const res = await fetch(getDbUrl('leads_seguimiento'));
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
      await fetch(getDbUrl(`leads_seguimiento/${leadId}`), {
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
      await fetch(getDbUrl('campana_activa'), {
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
      const res = await fetch(getDbUrl('campana_activa'));
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
      await fetch(getDbUrl(`eventos_mes/${evento.id}`), {
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
      const res = await fetch(getDbUrl('eventos_mes'));
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

  // =========================================================================
  // 7. CONFIGURACIÓN GENERAL (CATÁLOGOS: SERVICIOS, ESTACIONES, ESPECIALISTAS)
  // =========================================================================
  async function saveCatalogo(tipo, items) {
    localStorage.setItem(`tb_cat_${tipo}`, JSON.stringify(items));
    try {
      await fetch(getDbUrl(`configuracion/${tipo}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      });
      return { success: true, source: 'firebase' };
    } catch (e) {
      console.warn(`Error al sincronizar catálogo ${tipo} con Firebase:`, e);
      return { success: true, source: 'local' };
    }
  }

  async function getCatalogo(tipo, defaultItems = []) {
    let local = null;
    try {
      const stored = localStorage.getItem(`tb_cat_${tipo}`);
      if (stored) local = JSON.parse(stored);
    } catch (e) {}

    try {
      const res = await fetch(getDbUrl(`configuracion/${tipo}`));
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && (Array.isArray(cloud) ? cloud.length > 0 : Object.keys(cloud).length > 0)) {
          const list = Array.isArray(cloud) ? cloud : Object.values(cloud);
          localStorage.setItem(`tb_cat_${tipo}`, JSON.stringify(list));
          return list;
        }
      }
    } catch (e) {}

    if (local && Array.isArray(local) && local.length > 0) {
      return local;
    }

    if (defaultItems && defaultItems.length > 0) {
      saveCatalogo(tipo, defaultItems).catch(() => {});
      return defaultItems;
    }

    return [];
  }

  // Inicializar conexión
  setTimeout(testConnection, 500);

  return {
    CONFIG,
    testConnection,
    onConnectionChange,
    // Autenticación
    login,
    logout,
    checkSession,
    getCurrentUser,
    onAuthChange,
    sendPasswordReset,
    // Catálogos de Configuración General
    saveCatalogo,
    getCatalogo,
    // CRUD Módulos
    saveVenta,
    getVentasByFecha,
    getVentasByRango,
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
