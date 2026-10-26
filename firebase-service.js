/**

 * Total Beauty Salón y Academia - Servicio de Firebase Authentication y Persistencia Realtime Database

 * Proyecto Oficial: totalbregis (https://totalbregis-default-rtdb.firebaseio.com/)

 * Autenticación mediante correo y contraseña con Firebase Auth REST API y persistencia de sesión.

 */



const TB_FIREBASE = (function () {

  // Límite estricto de sesión: 1 hora obligatoria (3,600,000 ms)

  const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

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

          const now = Date.now();

          const user = {

            email: data.email || cleanEmail,

            localId: data.localId,

            idToken: data.idToken,

            refreshToken: data.refreshToken,

            loginTimestamp: now,

            sessionExpiresAt: now + SESSION_TIMEOUT_MS,

            expiresAt: Date.now() + ((parseInt(data.expiresIn, 10) || 3600) * 1000)

          };



          localStorage.setItem('tb_auth_user', JSON.stringify(user));

          localStorage.setItem('tb_session_login_time', String(now));

          sessionStorage.setItem('tb_auth_user', JSON.stringify(user));



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

   * Verificar sesión guardada al abrir la aplicación con límite estricto de 1 hora

   */

  async function checkSession() {

    const raw = localStorage.getItem('tb_auth_user') || sessionStorage.getItem('tb_auth_user');

    if (!raw) return { active: false };



    try {

      const user = JSON.parse(raw);

      const loginTime = user.loginTimestamp || parseInt(localStorage.getItem('tb_session_login_time') || '0', 10);

      const elapsed = Date.now() - loginTime;



      // OBLIGATORIO: Si transcurrió 1 hora o más (3,600,000 ms), forzar cierre de sesión

      if (!loginTime || elapsed >= SESSION_TIMEOUT_MS) {

        console.warn(`Sesión expirada tras ${Math.round(elapsed / 60000)} minutos (límite: 1 hora).`);

        logout();

        return {

          active: false,

          expired: true,

          message: '⚠️ Por seguridad, la sesión caduca automáticamente después de 1 hora. Por favor inicie sesión nuevamente.'

        };

      }



      if (user && user.refreshToken) {

        // Si el idToken está por expirar pero está dentro de la hora permitida, refrescarlo

        if (Date.now() > (user.expiresAt - 300000)) {

          const newToken = await refreshAuthToken(user.refreshToken);

          if (!newToken) {

            logout();

            return {

              active: false,

              expired: true,

              message: 'La sesión no pudo ser validada con Firebase. Por favor inicie sesión nuevamente.'

            };

          }

        }

        notifyAuth(user);

        notifyStatus(true, `Conectado a Firebase (${user.email})`);

        return { active: true, user, remainingMs: SESSION_TIMEOUT_MS - elapsed };

      }

    } catch (e) {

      console.error('Error verificando sesión:', e);

    }

    logout();

    return { active: false };

  }



  /**

   * Cerrar sesión del usuario

   */

  function logout() {

    currentUser = null;

    localStorage.removeItem('tb_auth_user');

    localStorage.removeItem('tb_session_login_time');

    sessionStorage.removeItem('tb_auth_user');

    notifyAuth(null);

    notifyStatus(false, 'Sesión cerrada');

    return { success: true };

  }



  // Monitoreo activo: si la página permanece abierta, expirar automáticamente a los 60 min

  setInterval(() => {

    if (currentUser) {

      const loginTime = currentUser.loginTimestamp || parseInt(localStorage.getItem('tb_session_login_time') || '0', 10);

      if (loginTime && (Date.now() - loginTime >= SESSION_TIMEOUT_MS)) {

        logout();

        window.dispatchEvent(new CustomEvent('tb_session_expired', {

          detail: { message: '⚠️ Su sesión ha expirado tras 1 hora de acceso continuo. Por favor inicie sesión nuevamente.' }

        }));

      }

    }

  }, 10000);



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

  function getDbUrl(path, extraParams = null) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let base = `${CONFIG.databaseURL}${cleanPath}.json`;
    const params = [];
    if (currentUser && currentUser.idToken) {
      params.push(`auth=${encodeURIComponent(currentUser.idToken)}`);
    }
    if (extraParams) {
      if (typeof extraParams === 'string') {
        const cleanExtra = (extraParams.startsWith('?') || extraParams.startsWith('&'))
          ? extraParams.slice(1)
          : extraParams;
        if (cleanExtra) params.push(cleanExtra);
      } else if (typeof extraParams === 'object') {
        for (const [k, v] of Object.entries(extraParams)) {
          params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        }
      }
    }
    if (params.length > 0) {
      base += `?${params.join('&')}`;
    }
    return base;
  }



  async function testConnection() {

    try {

      const controller = new AbortController();

      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(getDbUrl('ping'), { signal: controller.signal });

      clearTimeout(timeoutId);

      if (res.ok) {

        notifyStatus(true, 'Conectado a Firebase (totalbregis)');

        return true;

      }

    } catch (e) {}

    notifyStatus(false, 'Sin conexión con Firebase');

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
      const res = await fetch(getDbUrl(`arqueos_caja/${key}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firebase status ${res.status}: ${errText}`);
      }
      notifyStatus(true, 'Arqueo guardado en Firebase');
      return { success: true, key, source: 'firebase' };
    } catch (err) {
      console.error('Error guardando arqueo principal:', err);
      notifyStatus(false, 'Arqueo guardado localmente (error Firebase)');
      return { success: true, key, source: 'local' };
    }
  }

  async function getArqueosList() {
    try {
      const url = getDbUrl('arqueos_caja', { _t: Date.now() });
      const res = await fetch(url);
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData)) {
          localStorage.setItem('tb_arqueos_history', JSON.stringify(cloudData));
          return cloudData;
        } else if (cloudData === null) {
          const local = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');
          if (Object.keys(local).length > 0) {
            await fetch(getDbUrl('arqueos_caja'), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(local)
            });
            return local;
          }
          return {};
        }
      }
    } catch (err) {
      console.warn('Error al consultar arqueos_caja en Firebase:', err);
    }
    return JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');
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
      const res = await fetch(getDbUrl(`arqueos_caja_chica/${key}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firebase status ${res.status}: ${errText}`);
      }
      notifyStatus(true, 'Caja chica guardada en Firebase');
      return { success: true, key, source: 'firebase' };
    } catch (err) {
      console.error('Error guardando caja chica:', err);
      notifyStatus(false, 'Caja chica guardada localmente (error Firebase)');
      return { success: true, key, source: 'local' };
    }
  }

  async function getArqueosChicaList() {
    try {
      const url = getDbUrl('arqueos_caja_chica', { _t: Date.now() });
      const res = await fetch(url);
      if (res.ok) {
        const cloudData = await res.json();
        if (cloudData && typeof cloudData === 'object' && !Array.isArray(cloudData)) {
          localStorage.setItem('tb_arqueos_chica_history', JSON.stringify(cloudData));
          return cloudData;
        } else if (cloudData === null) {
          const local = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');
          if (Object.keys(local).length > 0) {
            await fetch(getDbUrl('arqueos_caja_chica'), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(local)
            });
            return local;
          }
          return {};
        }
      }
    } catch (err) {
      console.warn('Error al consultar arqueos_caja_chica en Firebase:', err);
    }
    return JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');
  }

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

  // =========================================================================

  // 7. CONFIGURACIÓN GENERAL (CATÁLOGOS: SERVICIOS, ESTACIONES, ESPECIALISTAS)

  // PERSISTENCIA ESTRICTA EN FIREBASE SIN INYECCIÓN DE DATOS DE PRUEBA

  // =========================================================================

  async function saveCatalogo(tipo, items) {

    const cleanList = Array.isArray(items) ? items : Object.values(items || {});

    localStorage.setItem(`tb_cat_${tipo}`, JSON.stringify(cleanList));

    try {

      const payload = {

        initialized: true,

        items: cleanList,

        updatedAt: new Date().toISOString()

      };

      await fetch(getDbUrl(`configuracion/${tipo}`), {

        method: 'PUT',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload)

      });

      return { success: true, source: 'firebase' };

    } catch (e) {

      console.warn(`Error al sincronizar catálogo ${tipo} con Firebase:`, e);

      return { success: true, source: 'local' };

    }

  }



  async function getCatalogo(tipo) {

    try {

      const res = await fetch(getDbUrl(`configuracion/${tipo}`));

      if (res.ok) {

        const cloud = await res.json();

        // Si no existe el nodo en Firebase, retornamos lista vacía (sin inyectar datos de prueba)

        if (cloud === null || cloud === undefined) {

          localStorage.setItem(`tb_cat_${tipo}`, JSON.stringify([]));

          return [];

        }



        let list = [];

        if (cloud.items !== undefined) {

          list = Array.isArray(cloud.items) ? cloud.items.filter(Boolean) : Object.values(cloud.items || {});

        } else if (Array.isArray(cloud)) {

          // Retrocompatibilidad por si estaba guardado como array directo

          list = cloud.filter(Boolean);

        } else if (typeof cloud === 'object') {

          // Objeto de Firebase (mapa id -> item o { initialized: true })

          const copy = { ...cloud };

          delete copy.initialized;

          delete copy.updatedAt;

          delete copy.exists;

          list = Object.values(copy);

        }



        localStorage.setItem(`tb_cat_${tipo}`, JSON.stringify(list));

        return list;

      }

    } catch (e) {

      console.warn(`Error al consultar catálogo ${tipo} desde Firebase:`, e);

    }



    // Si falló la red (sin conexión puntual), usar la copia en localStorage

    try {
      const stored = localStorage.getItem(`tb_cat_${tipo}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.items)) return parsed.items;
      }
    } catch (e) {}



    return [];

  }

  // Configuración del Fondo Base de Caja Chica
  async function saveCajaChicaConfig(cfg) {
    const payload = {
      fondoBase: parseFloat(cfg?.fondoBase || 0) || 0,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('tb_cfg_caja_chica', JSON.stringify(payload));
    try {
      await fetch(getDbUrl('configuracion/caja_chica'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { success: true };
    } catch (e) {
      console.warn('Error al guardar configuración de caja chica en Firebase:', e);
      return { success: false, error: e.message };
    }
  }

  async function getCajaChicaConfig() {
    try {
      const res = await fetch(getDbUrl('configuracion/caja_chica'));
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && typeof cloud === 'object') {
          localStorage.setItem('tb_cfg_caja_chica', JSON.stringify(cloud));
          return cloud;
        }
      }
    } catch (e) {
      console.warn('Error al consultar configuración de caja chica de Firebase:', e);
    }
    return JSON.parse(localStorage.getItem('tb_cfg_caja_chica') || '{"fondoBase":0}');
  }





  // =========================================================================

  // 8. REGISTRO DE AUDITORÍA Y BITÁCORA DE MOVIMIENTOS DEL SISTEMA

  // =========================================================================

  async function saveAuditLog(entry) {

    if (!entry.id) {

      entry.id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    }

    if (!entry.fechaHora) entry.fechaHora = new Date().toISOString();

    if (!entry.usuario) entry.usuario = currentUser?.email || 'Usuario';

    if (!entry.estado) entry.estado = 'ACTIVO';



    const localAudit = JSON.parse(localStorage.getItem('tb_auditoria_logs') || '{}');

    localAudit[entry.id] = entry;

    localStorage.setItem('tb_auditoria_logs', JSON.stringify(localAudit));



    try {

      await fetch(getDbUrl(`auditoria_movimientos/${entry.id}`), {

        method: 'PUT',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(entry)

      });

      return { success: true, id: entry.id, source: 'firebase' };

    } catch (e) {

      console.warn('Error al registrar auditoría en Firebase:', e);

      return { success: true, id: entry.id, source: 'local' };

    }

  }



  async function getAuditoriaLogs() {

    const local = JSON.parse(localStorage.getItem('tb_auditoria_logs') || '{}');

    try {

      const res = await fetch(getDbUrl('auditoria_movimientos'));

      if (res.ok) {

        const cloud = await res.json();

        if (cloud && typeof cloud === 'object') {

          const merged = { ...local, ...cloud };

          localStorage.setItem('tb_auditoria_logs', JSON.stringify(merged));

          return Object.values(merged).sort((a, b) => (b.fechaHora || '').localeCompare(a.fechaHora || ''));

        }

      }

    } catch (e) {

      console.warn('Error consultando auditoría:', e);

    }

    return Object.values(local).sort((a, b) => (b.fechaHora || '').localeCompare(a.fechaHora || ''));

  }



  async function updateAuditLog(entry) {

    if (!entry || !entry.id) return { success: false };

    const local = JSON.parse(localStorage.getItem('tb_auditoria_logs') || '{}');

    local[entry.id] = entry;

    localStorage.setItem('tb_auditoria_logs', JSON.stringify(local));



    try {

      await fetch(getDbUrl(`auditoria_movimientos/${entry.id}`), {

        method: 'PUT',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(entry)

      });

      return { success: true };

    } catch (e) {

      return { success: false, error: e };

    }

  }



  async function deleteArqueo(tipo, key) {

    if (tipo === 'chica') {

      const local = JSON.parse(localStorage.getItem('tb_arqueos_chica_history') || '{}');

      delete local[key];

      localStorage.setItem('tb_arqueos_chica_history', JSON.stringify(local));

      try {

        await fetch(getDbUrl(`arqueos_caja_chica/${key}`), { method: 'DELETE' });

      } catch (e) {}

    } else {

      const local = JSON.parse(localStorage.getItem('tb_arqueos_history') || '{}');

      delete local[key];

      localStorage.setItem('tb_arqueos_history', JSON.stringify(local));

      try {

        await fetch(getDbUrl(`arqueos_caja/${key}`), { method: 'DELETE' });

      } catch (e) {}

    }

    return { success: true };

  }



  async function deleteLead(id) {

    const local = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');

    delete local[id];

    localStorage.setItem('tb_leads_db', JSON.stringify(local));

    try {

      await fetch(getDbUrl(`leads_seguimiento/${id}`), { method: 'DELETE' });

    } catch (e) {}

    return { success: true };

  }



  async function deleteEvento(id) {

    const local = JSON.parse(localStorage.getItem('tb_eventos_db') || '{}');

    delete local[id];

    localStorage.setItem('tb_eventos_db', JSON.stringify(local));

    try {

      await fetch(getDbUrl(`eventos_mes/${id}`), { method: 'DELETE' });

    } catch (e) {}

    return { success: true };

  }



  // Inicializar conexión
  setTimeout(testConnection, 500);
  setInterval(testConnection, 25000);



  // =========================================================================
  // VERIFICACIÓN DE CONTRASEÑA DE LA CUENTA ACTIVA (AUTENTICACIÓN PARA CIERRE)
  // =========================================================================
  async function verifyCurrentUserPassword(password) {
    if (!currentUser || !currentUser.email) {
      return { success: false, error: 'No hay ninguna sesión activa en este momento.' };
    }
    if (!password) {
      return { success: false, error: 'Por favor ingrese su contraseña.' };
    }

    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CONFIG.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          password: password,
          returnSecureToken: true
        })
      });

      const data = await res.json();
      if (res.ok && data.idToken) {
        currentUser.idToken = data.idToken;
        if (data.refreshToken) currentUser.refreshToken = data.refreshToken;
        return { success: true };
      }

      return {
        success: false,
        error: 'Contraseña incorrecta.'
      };
    } catch (e) {
      console.error('Error verificando contraseña:', e);
      return {
        success: false,
        error: 'Contraseña incorrecta.'
      };
    }
  }

  // =========================================================================
  // CONTROL DE CAJA Y ENTREGAS DE DINERO (CON FOTOGRAFÍA)
  // =========================================================================
  async function getControlCaja() {
    let local = JSON.parse(localStorage.getItem('tb_control_caja') || '{"fondoBase":0,"entregas":{}}');
    try {
      const res = await fetch(getDbUrl('control_caja', { _t: Date.now() }));
      if (res.ok) {
        const cloud = await res.json();
        if (cloud && typeof cloud === 'object') {
          local = {
            fondoBase: typeof cloud.fondoBase === 'number' ? cloud.fondoBase : (local.fondoBase || 0),
            entregas: cloud.entregas || {}
          };
          localStorage.setItem('tb_control_caja', JSON.stringify(local));
          return local;
        }
      }
    } catch (e) {
      console.warn('Error consultando control_caja:', e);
    }
    return local;
  }

  async function saveEntregaDinero(entrega) {
    if (!entrega.id) {
      entrega.id = `ent_${Date.now()}`;
    }
    const local = JSON.parse(localStorage.getItem('tb_control_caja') || '{"fondoBase":0,"entregas":{}}');
    if (!local.entregas) local.entregas = {};
    local.entregas[entrega.id] = entrega;
    localStorage.setItem('tb_control_caja', JSON.stringify(local));

    try {
      const res = await fetch(getDbUrl(`control_caja/entregas/${entrega.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entrega)
      });
      return { success: res.ok, id: entrega.id };
    } catch (e) {
      console.warn('Error guardando entrega en Firebase:', e);
      return { success: true, id: entrega.id, localOnly: true };
    }
  }

  async function deleteEntregaDinero(id) {
    const local = JSON.parse(localStorage.getItem('tb_control_caja') || '{"fondoBase":0,"entregas":{}}');
    if (local.entregas) delete local.entregas[id];
    localStorage.setItem('tb_control_caja', JSON.stringify(local));

    try {
      await fetch(getDbUrl(`control_caja/entregas/${id}`), { method: 'DELETE' });
    } catch (e) {}
    return { success: true };
  }

  async function saveFondoBaseCaja(monto) {
    const local = JSON.parse(localStorage.getItem('tb_control_caja') || '{"fondoBase":0,"entregas":{}}');
    local.fondoBase = parseFloat(monto) || 0;
    localStorage.setItem('tb_control_caja', JSON.stringify(local));

    try {
      await fetch(getDbUrl('control_caja/fondoBase'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(local.fondoBase)
      });
    } catch (e) {}
    return { success: true };
  }


  // =========================================================================
  // GESTIÓN Y DESCARGA DE USUARIOS DESDE FIREBASE AUTHENTICATION & RTDB
  // =========================================================================

  async function downloadFirebaseUsers() {
    try {
      // 1. Obtener usuarios configurados en Firebase Realtime Database
      let userList = [];
      try {
        const resRoles = await fetch(getDbUrl('configuracion/usuarios_roles', { _t: Date.now() }));
        if (resRoles.ok) {
          const json = await resRoles.json();
          if (json && json.items) {
            userList = Array.isArray(json.items) ? json.items : Object.values(json.items);
          }
        }
      } catch (e) {
        console.warn('Error al leer configuracion/usuarios_roles:', e);
      }

      // Si falló la consulta o vino vacío, preservar de localStorage para no sobreescribir permisos
      if (!Array.isArray(userList) || userList.length === 0) {
        try {
          const cached = localStorage.getItem('tb_cat_usuarios_roles');
          if (cached) {
            const parsed = JSON.parse(cached);
            userList = Array.isArray(parsed) ? parsed : (parsed?.items || []);
          }
        } catch (e) {}
      }

      // 2. Escanear usuarios con actividad en la base de datos de Firebase
      const discoveredEmails = new Set();
      try {
        const resAudit = await fetch(getDbUrl('auditoria_movimientos', { _t: Date.now() }));
        if (resAudit.ok) {
          const auditObj = await resAudit.json();
          if (auditObj && typeof auditObj === 'object') {
            Object.values(auditObj).forEach(item => {
              if (item && item.usuario && item.usuario.includes('@')) {
                discoveredEmails.add(item.usuario.toLowerCase().trim());
              }
            });
          }
        }
      } catch (e) { console.warn('Scan audit users error:', e); }

      try {
        const resArqueos = await fetch(getDbUrl('arqueos_caja', { _t: Date.now() }));
        if (resArqueos.ok) {
          const arqObj = await resArqueos.json();
          if (arqObj && typeof arqObj === 'object') {
            Object.values(arqObj).forEach(item => {
              if (item && item.responsable && item.responsable.includes('@')) {
                discoveredEmails.add(item.responsable.toLowerCase().trim());
              }
              if (item && item.userEmail && item.userEmail.includes('@')) {
                discoveredEmails.add(item.userEmail.toLowerCase().trim());
              }
            });
          }
        }
      } catch (e) { console.warn('Scan arqueos users error:', e); }

      if (!Array.isArray(userList)) userList = [];

      // 3. Garantizar siempre a francisco@totalb.com como Administrador Principal
      let fran = userList.find(u => (u.email || '').toLowerCase().trim() === 'francisco@totalb.com');
      const allModules = [
        'arqueo-principal', 'arqueo-chica', 'historial', 'ventas',
        'balancescore', 'ingresos', 'interesadas', 'campana',
        'configuracion', 'auditoria'
      ];

      if (!fran) {
        userList.unshift({
          email: 'francisco@totalb.com',
          nombre: 'Francisco (Admin Principal)',
          rol: 'Administrador',
          isAdmin: true,
          modulos: [...allModules],
          origen: 'Firebase Cloud',
          updatedAt: new Date().toISOString()
        });
      } else {
        fran.rol = 'Administrador';
        fran.isAdmin = true;
        fran.modulos = [...allModules];
        fran.origen = 'Firebase Cloud';
      }

      // 4. Agregar usuarios descubiertos que no estén en la lista
      discoveredEmails.forEach(em => {
        if (!userList.some(u => (u.email || '').toLowerCase().trim() === em)) {
          userList.push({
            email: em,
            nombre: em.split('@')[0],
            rol: 'Recepción y Ventas',
            isAdmin: false,
            modulos: ['ventas', 'ingresos', 'interesadas'],
            origen: 'Firebase Actividad',
            updatedAt: new Date().toISOString()
          });
        }
      });

      // Guardar lista sincronizada en Firebase
      await saveCatalogo('usuarios_roles', userList);
      return { success: true, users: userList };
    } catch (err) {
      console.error('Error al descargar usuarios de Firebase:', err);
      return { success: false, error: err.message, users: [] };
    }
  }

  async function registerNewFirebaseUser(email, password, nombre = '') {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, error: 'Correo y contraseña requeridos' };
    }

    try {
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
          returnSecureToken: false
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = translateAuthError(data.error?.message || 'Error al registrar usuario en Firebase');
        return { success: false, error: errMsg };
      }

      return {
        success: true,
        user: {
          email: cleanEmail,
          nombre: nombre || cleanEmail.split('@')[0],
          localId: data.localId
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

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

    getEventosAll,

    deleteEvento,

    deleteLead,

    deleteArqueo,

    // Registro de Auditoría y Movimientos

    saveAuditLog,

    getAuditoriaLogs,

    updateAuditLog,
    verifyCurrentUserPassword,
    getControlCaja,
    saveEntregaDinero,
    deleteEntregaDinero,
    saveFondoBaseCaja,
    saveCajaChicaConfig,
    getCajaChicaConfig,
    downloadFirebaseUsers,
    registerNewFirebaseUser

  };

})();

