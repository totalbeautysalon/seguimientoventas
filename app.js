/**
 * Total Beauty Salón y Academia - Portal Integral de Gestión
 * Sistema Completo Interconectado:
 * - Arqueo de Caja Principal y Arqueo de Caja Chica con PDF oficial y reseteo de campos
 * - Registro Diario de Ventas (fecha*, telefono*, clienta, servicio*, estacion*, especialista*, metodo*, total*, status*, notas)
 * - Interesadas y Cierres con 3 Opciones (Nuevo Registro, Seguimiento por WhatsApp/Llamada, BalanceScore)
 * - Campaña Activa ("Ver cómo está funcionando" vs Ventas Reales) y Eventos del Mes
 * - Cero datos de prueba en estado inicial (inicio limpio para producción)
 */

(function () {
  'use strict';

  // =========================================================================
// GESTIÓN HORARIA OFICIAL: HIDALGO, MÉXICO (America/Mexico_City / UTC-6)
// =========================================================================
function getHidalgoDateTime(dateObj = new Date()) {
  if (typeof window !== 'undefined' && window.getHidalgoDateTime) {
    return window.getHidalgoDateTime(dateObj);
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(dateObj);
    const m = {};
    parts.forEach(p => { m[p.type] = p.value; });
    let hour = m.hour;
    if (hour === '24') hour = '00';
    const fecha = `${m.year}-${m.month}-${m.day}`;
    const hora = `${hour}:${m.minute}`;
    const horaSeg = `${hour}:${m.minute}:${m.second}`;
    return {
      fecha,
      hora,
      horaSeg,
      isoLocal: `${fecha}T${horaSeg}`,
      display: `${m.day}/${m.month}/${m.year} ${hora}`
    };
  } catch (err) {
    const cstEpoch = dateObj.getTime() - (6 * 3600000);
    const cst = new Date(cstEpoch);
    const y = cst.getUTCFullYear();
    const mo = String(cst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cst.getUTCDate()).padStart(2, '0');
    const h = String(cst.getUTCHours()).padStart(2, '0');
    const mi = String(cst.getUTCMinutes()).padStart(2, '0');
    const s = String(cst.getUTCSeconds()).padStart(2, '0');
    const fecha = `${y}-${mo}-${d}`;
    const hora = `${h}:${mi}`;
    const horaSeg = `${h}:${mi}:${s}`;
    return {
      fecha,
      hora,
      horaSeg,
      isoLocal: `${fecha}T${horaSeg}`,
      display: `${d}/${mo}/${y} ${hora}`
    };
  }
}

function getHidalgoDateStr(dateObj = new Date()) {
  return getHidalgoDateTime(dateObj).fecha;
}

function getHidalgoTimeStr(dateObj = new Date()) {
  return getHidalgoDateTime(dateObj).hora;
}

function getHidalgoIsoString(dateObj = new Date()) {
  return getHidalgoDateTime(dateObj).isoLocal;
}

  // =========================================================================
  // SISTEMA GLOBAL DE ANIMACIÓN Y CARGA LUXURY TOTAL BEAUTY
  // =========================================================================
  let globalLoaderTimeout = null;
  let globalLoaderSafetyTimer = null;

  function showGlobalLoader(title = 'Cargando...', subtitle = 'Sincronizando...') {
    const overlay = document.getElementById('tb-global-loader');
    if (!overlay) return;
    const titleEl = document.getElementById('tb-loader-title');
    const subEl = document.getElementById('tb-loader-subtitle');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;

    clearTimeout(globalLoaderTimeout);
    clearTimeout(globalLoaderSafetyTimer);

    overlay.style.display = 'flex';
    void overlay.offsetWidth;
    overlay.classList.add('active');

    // Auto-cierre de seguridad absoluto: nunca puede quedarse trabado más de 3 segundos
    globalLoaderSafetyTimer = setTimeout(() => {
      hideGlobalLoader(0);
    }, 3000);
  }

  function hideGlobalLoader(minDelayMs = 100) {
    const overlay = document.getElementById('tb-global-loader');
    if (!overlay) return;
    clearTimeout(globalLoaderSafetyTimer);
    clearTimeout(globalLoaderTimeout);
    globalLoaderTimeout = setTimeout(() => {
      overlay.classList.remove('active');
      overlay.style.display = 'none';
    }, minDelayMs);
  }

  window.showGlobalLoader = showGlobalLoader;
  window.hideGlobalLoader = hideGlobalLoader;



  // --- ELEMENTOS Y CANVAS ---
  const formPrincipal = document.getElementById('form-arqueo-principal');
  const formChica = document.getElementById('form-arqueo-chica');

  const sigPadPrincipal = document.getElementById('signature-pad');
  let sigCtxPrincipal = null;
  let isDrawingPrincipal = false;
  let sigDataPrincipal = false;

  const sigPadChica = document.getElementById('chica-signature-pad');
  let sigCtxChica = null;
  let isDrawingChica = false;
  let sigDataChica = false;

  let currentModule = 'arqueo-principal';
  let lastLoggedModule = null;
  let currentHistTipo = 'principal'; // 'principal' o 'chica'
  // --- ESTADO DE CORTES CONTINUOS DE CAJA PRINCIPAL ---
  let currentCorteNum = 1;
  let currentCorteVentas = [];
  let currentCortesHoy = [];
  let currentCorteHoraInicio = '00:00';
  let currentLeadOption = 1;         // 1: Nuevo, 2: Seguimiento, 3: BalanceScore

  // --- FORMATEO DE MONEDA Y NÚMEROS ---
  function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseVal(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const v = parseFloat(el.value);
    return isNaN(v) ? 0 : v;
  }

  function setDisplay(id, val) {
    const el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') {
        el.value = (parseFloat(val) || 0).toFixed(2);
      } else {
        el.textContent = formatCurrency(val);
      }
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(16px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- HIDRATACIÓN INMEDIATA DE MEMORIA DESDE LOCALSTORAGE (0 ms) ---
  function hydrateMemoryFromLocalStorage() {
    try {
      const srv = localStorage.getItem('tb_cat_servicios');
      if (srv) {
        const parsed = JSON.parse(srv);
        if (Array.isArray(parsed) && parsed.length > 0) catServicios = parsed;
      }
      const est = localStorage.getItem('tb_cat_estaciones');
      if (est) {
        const parsed = JSON.parse(est);
        if (Array.isArray(parsed) && parsed.length > 0) {
          catEstaciones = parsed;
          catEstaciones.forEach(e => {
            if (e.metaQuincenal === undefined) e.metaQuincenal = parseFloat(e.meta) || 0;
            if (e.clientesMeta === undefined) e.clientesMeta = parseInt(e.metaClientes, 10) || 0;
          });
        }
      }
      const esp = localStorage.getItem('tb_cat_especialistas');
      if (esp) {
        const parsed = JSON.parse(esp);
        if (Array.isArray(parsed) && parsed.length > 0) catEspecialistas = parsed;
      }
      const usr = localStorage.getItem('tb_cat_usuarios_roles');
      if (usr) {
        const parsed = JSON.parse(usr);
        if (Array.isArray(parsed) && parsed.length > 0) catUsuariosRoles = parsed;
      }
      const crs = localStorage.getItem('tb_cat_metas_cursos');
      if (crs) {
        const parsed = JSON.parse(crs);
        if (Array.isArray(parsed) && parsed[0]) catCursosMeta = parsed[0];
      }
      const caja = localStorage.getItem('tb_control_caja');
      if (caja) {
        const parsed = JSON.parse(caja);
        if (parsed && typeof parsed === 'object') controlCajaData = parsed;
      }
      const chica = localStorage.getItem('tb_cajachica_config');
      if (chica) {
        const parsed = JSON.parse(chica);
        if (parsed && parsed.fondoBase) cajaChicaFundData.fondoBase = parseFloat(parsed.fondoBase) || 0;
      }
    } catch (e) {
      console.warn('Error hidratando memoria local:', e);
    }
  }
  hydrateMemoryFromLocalStorage();

  // --- NAVEGACIÓN ENTRE MÓDULOS ---
  const moduleTitles = {
    'arqueo-principal': {
      title: 'Arqueo Diario de Caja Principal',
      desc: 'Fondo inicial, ingresos de ventas, conteo físico, conciliación y validación'
    },
    'arqueo-chica': {
      title: 'Arqueo Diario de Caja Chica',
      desc: 'Fondo inicial, salidas por gastos menores, conteo físico y conciliación'
    },
    'historial': {
      title: 'Reportes Diarios de Arqueo',
      desc: 'Consulta y descarga de reportes oficiales guardados en Firebase'
    },
    'ventas': {
      title: 'Registro Diario de Ventas',
      desc: 'Captura detallada de operaciones, métodos de pago e interconexión con caja'
    },
    'mi-meta': {
      title: 'Mi Meta - Avance por Estación',
      desc: 'Monitoreo en tiempo real del cumplimiento de metas por estación y academia para todo el equipo'
    },
    'balancescore': {
      title: 'BalanceScore por Estaciones',
      desc: 'Medición de metas de ingresos y calidad operativa en las estaciones de trabajo'
    },
    'ingresos': {
      title: 'Reporte Diario de Ingresos',
      desc: 'Detalle de servicios, montos, métodos de pago, Academia Total Beauty y desglose operativo del día'
    },
    'interesadas': {
      title: 'Interesadas, Solo Preguntan y Cierres',
      desc: '3 Opciones: BalanceScore de Conversión, Nuevo registro y Directorio de Seguimiento'
    },
    'campana': {
      title: 'Campaña Activa y Eventos del Mes',
      desc: 'Objetivos mensuales, monitoreo de ventas en vivo y calendario de eventos'
    },
    'configuracion': {
      title: 'Configuración General',
      desc: 'Administración de catálogos: Servicios y Productos, Estaciones de Trabajo y Especialistas'
    },
    'auditoria': {
      title: 'Registro de Auditoría y Eventos del Sistema',
      desc: 'Bitácora de movimientos, autoría de usuarios y reversión segura con Llave Maestra (0401)'
    }
  };

  function switchModule(modKey) {
    if (!hasModulePermission(modKey)) {
      showToast('⛔ Acceso restringido. Su rol no tiene permiso para este módulo.', 'warning');
      const allowed = getAllowedModulesForCurrentUser();
      const fallback = allowed[0] || 'ventas';
      if (modKey !== fallback && allowed.length > 0) {
        switchModule(fallback);
      }
      return;
    }
    if (modKey === 'configuracion' && !isConfigUnlocked) {
      openUnlockConfigModal('servicios');
      return;
    }
    currentModule = modKey;
    try {
      localStorage.setItem('tb_active_module', modKey);
    } catch (e) {}

    document.querySelectorAll('.menu-item-link').forEach(link => {
      if (link.dataset.module === modKey) link.classList.add('active');
      else link.classList.remove('active');
    });

    document.querySelectorAll('.module-view').forEach(view => {
      view.classList.remove('active-view');
      view.style.display = 'none';
    });
    const target = document.getElementById(`view-${modKey}`);
    if (target) {
      target.classList.remove('view-forbidden');
      target.classList.add('active-view');
      target.style.removeProperty('display');
      target.style.display = 'block';
      target.style.visibility = 'visible';
      target.style.opacity = '1';
    }

    const info = moduleTitles[modKey] || { title: 'Total Beauty', desc: '' };
    document.getElementById('topbar-module-title').textContent = info.title;
    let modDesc = info.desc;
    if (modKey === 'balancescore') {
      const numEst = (catEstaciones && catEstaciones.length > 0) ? catEstaciones.length : 0;
      modDesc = `Medición de metas de ingresos y calidad operativa en las ${numEst} estaciones de trabajo`;
    }
    document.getElementById('topbar-module-desc').textContent = modDesc;

    document.getElementById('app-sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');

    // Registrar auditoría de acceso a la sección
    if (lastLoggedModule !== modKey) {
      lastLoggedModule = modKey;
      logAuditMovement({
        modulo: 'Navegación',
        accion: 'ACCESO_SECCION',
        descripcion: `Acceso a la sección: ${info.title}`,
        payload: { modulo: modKey },
        reversible: false
      });
    }

    // Al entrar a Registro de Ventas, sincronizar vista activa y selector principal
    if (modKey === 'ventas') {
      setVentasViewMode(currentVentasViewMode);
      setVentasSectionMode(currentVentasSectionMode);
    }

    // Carga y actualización inmediata de datos de la sección
    refreshActiveModuleData();
  }

  // =========================================================================
  // PORTAL / MENÚ LAUNCHER PRINCIPAL DE MÓDULOS (TOTAL BEAUTY)
  // =========================================================================
  const TB_MODULE_PORTAL_ITEMS = [
    {
      key: 'ventas',
      icon: '💰',
      title: 'Registro Diario de Ventas',
      desc: 'Asistente dinámico paso a paso: clienta, servicio, estación, cobro mixto y confirmación.',
      badge: 'Operación Diaria',
      badgeClass: 'badge-ventas'
    },
    {
      key: 'mi-meta',
      icon: '🎯',
      title: 'Mi Meta',
      desc: 'Avance en tiempo real de metas por estación de trabajo y academia para todo el equipo.',
      badge: 'Objetivos',
      badgeClass: 'badge-metas'
    },
    {
      key: 'arqueo-principal',
      icon: '💵',
      title: 'Arqueo Caja Principal',
      desc: 'Fondo inicial, registro de cobros, conteo físico simplificado, entregas y validación de cierre.',
      badge: 'Caja & Cierre',
      badgeClass: 'badge-caja'
    },
    {
      key: 'arqueo-chica',
      icon: '🪙',
      title: 'Arqueo Caja Chica',
      desc: 'Fondo fijo, reposición de caja chica, gastos menores y comprobantes fiscales.',
      badge: 'Caja Menor',
      badgeClass: 'badge-chica'
    },
    {
      key: 'historial',
      icon: '📑',
      title: 'Reportes Diarios Arqueo',
      desc: 'Histórico de arqueos cerrados, consultas por fecha, firmas digitales y reportes en PDF.',
      badge: 'Historial',
      badgeClass: 'badge-historial'
    },
    {
      key: 'balancescore',
      icon: '💈',
      title: 'BalanceScore Estaciones',
      desc: 'Medición de metas de ingresos quincenales, productividad y calidad por estación.',
      badge: 'Rendimiento',
      badgeClass: 'badge-score'
    },
    {
      key: 'ingresos',
      icon: '📊',
      title: 'Reporte Diario Ingresos',
      desc: 'Análisis global de facturación diaria, cortes por método de pago y comparativas.',
      badge: 'Finanzas',
      badgeClass: 'badge-ingresos'
    },
    {
      key: 'interesadas',
      icon: '🎯',
      title: 'Interesadas y Cierres',
      desc: 'Embudo de prospectos, llamadas de seguimiento, academias y matriculación.',
      badge: 'Comercial',
      badgeClass: 'badge-leads'
    },
    {
      key: 'campana',
      icon: '🌟',
      title: 'Campaña y Eventos',
      desc: 'Cronograma de talleres, masterclasses, fechas clave y eventos especiales.',
      badge: 'Eventos',
      badgeClass: 'badge-campana'
    },
    {
      key: 'configuracion',
      icon: '⚙️',
      title: 'Configuración General',
      desc: 'Catálogos de servicios, productos, estaciones, especialistas, metas, roles y seguridad.',
      badge: 'Administración',
      badgeClass: 'badge-admin'
    },
    {
      key: 'auditoria',
      icon: '🛡️',
      title: 'Registro de Auditoría',
      desc: 'Bitácora integral de movimientos, trazabilidad por usuario y reversión con Llave Maestra.',
      badge: 'Seguridad',
      badgeClass: 'badge-audit'
    }
  ];

  function openModuleLauncher() {
    const launcherOverlay = document.getElementById('modal-modulo-launcher');
    const launcherGrid = document.getElementById('launcher-modules-grid');
    const greetingEl = document.getElementById('launcher-user-greeting');
    if (!launcherOverlay || !launcherGrid) return;

    const curUser = TB_FIREBASE.getCurrentUser();
    if (greetingEl) {
      greetingEl.textContent = curUser?.email ? `Usuario activo: ${curUser.email}` : 'Portal Oficial de Operaciones';
    }

    const allowed = getAllowedModulesForCurrentUser();
    const visibleItems = TB_MODULE_PORTAL_ITEMS.filter(item => allowed.includes(item.key));

    launcherGrid.innerHTML = visibleItems.map(item => `
      <div class="launcher-card" data-module="${item.key}" role="button" tabindex="0">
        <div class="launcher-card-top">
          <div class="launcher-card-icon">${item.icon}</div>
          <span class="launcher-card-badge ${item.badgeClass}">${item.badge}</span>
        </div>
        <div class="launcher-card-content">
          <h4 class="launcher-card-title">${item.title}</h4>
          <p class="launcher-card-desc">${item.desc}</p>
        </div>
        <div class="launcher-card-action">
          <span>Ingresar</span>
          <span class="launcher-arrow">→</span>
        </div>
      </div>
    `).join('');

    launcherGrid.querySelectorAll('.launcher-card').forEach(card => {
      card.addEventListener('click', () => {
        const modKey = card.dataset.module;
        closeModuleLauncher();
        if (modKey) switchModule(modKey);
      });
    });

    launcherOverlay.style.display = 'flex';
    document.body.classList.add('launcher-open');
  }

  function closeModuleLauncher() {
    const launcherOverlay = document.getElementById('modal-modulo-launcher');
    if (launcherOverlay) {
      launcherOverlay.style.display = 'none';
    }
    document.body.classList.remove('launcher-open');
    if (!currentModule) {
      const allowed = getAllowedModulesForCurrentUser();
      switchModule(allowed[0] || 'ventas');
    }
  }

  function refreshActiveModuleData() {
    if (!currentModule) return;
    if (currentModule === 'arqueo-principal') {
      const curFecha = document.getElementById('header_fecha')?.value || getHidalgoDateStr();
      syncVentasToCajaPrincipal(curFecha, false);
      loadControlCajaData();
    } else if (currentModule === 'ventas') {
      populateSalesDropdowns();
      const todayHidalgo = getHidalgoDateStr();
      const filterInput = document.getElementById('ventas_filtro_fecha');
      let vf = filterInput?.value;
      if (!vf || vf > todayHidalgo) {
        vf = todayHidalgo;
        if (filterInput) filterInput.value = todayHidalgo;
      }
      const isSilent = currentVentasList && currentVentasList.length > 0;
      renderVentas(vf, isSilent);
    } else if (currentModule === 'mi-meta') {
      renderMiMetaView();
    } else if (currentModule === 'balancescore') {
      renderBalanceScoreStations();
    } else if (currentModule === 'configuracion') {
      loadAndRenderConfiguracion();
    } else if (currentModule === 'auditoria') {
      renderAuditoriaView();
    } else if (currentModule === 'arqueo-chica') {
      loadCajaChicaFundData();
    } else if (currentModule === 'historial') {
      loadHistorial();
    } else if (currentModule === 'ingresos') {
      renderIngresosReport();
    } else if (currentModule === 'interesadas') {
      loadInteresadasView();
    } else if (currentModule === 'campana') {
      renderCampanaActiva();
      renderEventosTimeline();
    }
  }

  // --- CANVAS DE FIRMA DIGITAL ---
  function setupSignaturePad(canvas, onDrawEnd) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    let drawing = false;

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (cx - rect.left) * (canvas.width / rect.width),
        y: (cy - rect.top) * (canvas.height / rect.height)
      };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    function stop(e) {
      if (!drawing) return;
      e.preventDefault();
      drawing = false;
      ctx.closePath();
      if (onDrawEnd) onDrawEnd();
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);

    return ctx;
  }

  // =========================================================================
  // SISTEMA DE FIRMA DIGITAL EN PANTALLA COMPLETA / HORIZONTAL CON CUADRITO NEGRO
  // =========================================================================
  let activeSignatureTarget = null; // 'principal' | 'chica'
  let modalSigCanvas = null;
  let modalSigCtx = null;
  let hasModalSignatureDrawn = false;
  let isDrawingModal = false;

  function initInteractiveSignatureSystem() {
    modalSigCanvas = document.getElementById('signature-fullscreen-canvas');
    if (!modalSigCanvas) return;

    modalSigCtx = modalSigCanvas.getContext('2d');

    function checkOrientation() {
      const banner = document.getElementById('sig-orientation-alert');
      if (!banner) return;
      const isPortrait = (window.innerHeight > window.innerWidth);
      banner.style.display = isPortrait ? 'flex' : 'none';
    }

    function resizeModalCanvas(preserveContent = true) {
      if (!modalSigCanvas) return;
      const wrap = document.getElementById('sig-canvas-wrap');
      if (!wrap) return;

      let tempImgData = null;
      if (preserveContent && hasModalSignatureDrawn && modalSigCanvas.width > 0 && modalSigCanvas.height > 0) {
        tempImgData = modalSigCanvas.toDataURL();
      }

      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.max(280, Math.floor(rect.width));
      const targetHeight = Math.max(160, Math.floor(rect.height));

      modalSigCanvas.width = targetWidth * dpr;
      modalSigCanvas.height = targetHeight * dpr;
      modalSigCanvas.style.width = `${targetWidth}px`;
      modalSigCanvas.style.height = `${targetHeight}px`;

      modalSigCtx = modalSigCanvas.getContext('2d');
      modalSigCtx.scale(dpr, dpr);
      modalSigCtx.lineWidth = 3.2;
      modalSigCtx.lineCap = 'round';
      modalSigCtx.lineJoin = 'round';
      modalSigCtx.strokeStyle = '#000000';

      if (tempImgData) {
        const img = new Image();
        img.onload = () => {
          modalSigCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
        };
        img.src = tempImgData;
      }
    }

    function getCoords(e) {
      const rect = modalSigCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawingModal = true;
      hasModalSignatureDrawn = true;
      const wm = document.getElementById('sig-modal-watermark');
      if (wm) wm.style.display = 'none';

      const { x, y } = getCoords(e);
      modalSigCtx.beginPath();
      modalSigCtx.moveTo(x, y);
    }

    function moveDraw(e) {
      if (!isDrawingModal) return;
      e.preventDefault();
      const { x, y } = getCoords(e);
      modalSigCtx.lineTo(x, y);
      modalSigCtx.stroke();
    }

    function stopDraw(e) {
      if (!isDrawingModal) return;
      e.preventDefault();
      isDrawingModal = false;
      modalSigCtx.closePath();
    }

    modalSigCanvas.addEventListener('mousedown', startDraw);
    modalSigCanvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', stopDraw);

    modalSigCanvas.addEventListener('touchstart', startDraw, { passive: false });
    modalSigCanvas.addEventListener('touchmove', moveDraw, { passive: false });
    window.addEventListener('touchend', stopDraw);

    function openSignatureModal(target) {
      activeSignatureTarget = target;
      const modal = document.getElementById('modal-signature-fullscreen');
      if (!modal) return;

      modal.style.display = 'flex';
      checkOrientation();

      const titleEl = document.getElementById('sig-modal-title');
      if (titleEl) {
        titleEl.textContent = (target === 'chica') ? 'Firma: Arqueo Caja Chica' : 'Firma: Arqueo Caja Principal';
      }

      setTimeout(() => {
        resizeModalCanvas(false);
        const wrap = document.getElementById('sig-canvas-wrap');
        const rect = wrap ? wrap.getBoundingClientRect() : { width: 500, height: 250 };
        modalSigCtx.clearRect(0, 0, rect.width, rect.height);
        hasModalSignatureDrawn = false;
        const wm = document.getElementById('sig-modal-watermark');
        if (wm) wm.style.display = 'block';
      }, 70);
    }

    function closeSignatureModal() {
      const modal = document.getElementById('modal-signature-fullscreen');
      if (modal) modal.style.display = 'none';
      isDrawingModal = false;
    }

    // Clic en los cuadritos negros de los formularios
    document.getElementById('box-firma-principal')?.addEventListener('click', () => {
      openSignatureModal('principal');
    });
    document.getElementById('box-firma-chica')?.addEventListener('click', () => {
      openSignatureModal('chica');
    });

    // Botón Reintentar (limpiar trazo)
    document.getElementById('btn-sig-retry')?.addEventListener('click', () => {
      if (modalSigCanvas && modalSigCtx) {
        const wrap = document.getElementById('sig-canvas-wrap');
        const rect = wrap ? wrap.getBoundingClientRect() : { width: modalSigCanvas.width, height: modalSigCanvas.height };
        modalSigCtx.clearRect(0, 0, rect.width, rect.height);
        hasModalSignatureDrawn = false;
        const wm = document.getElementById('sig-modal-watermark');
        if (wm) wm.style.display = 'block';
        showToast('Lienzo limpio. Puede dibujar nuevamente.', 'info');
      }
    });

    // Botón Confirmar
    document.getElementById('btn-sig-confirm')?.addEventListener('click', () => {
      if (!hasModalSignatureDrawn) {
        showToast('⚠️ Por favor realice su firma en el recuadro blanco antes de confirmar', 'warning');
        return;
      }

      const dataUrl = modalSigCanvas.toDataURL('image/png');

      if (activeSignatureTarget === 'principal') {
        sigDataPrincipal = true;
        const ph = document.getElementById('placeholder-firma-principal');
        const pv = document.getElementById('preview-firma-principal');
        const img = document.getElementById('img-preview-firma-principal');
        if (img) img.src = dataUrl;
        if (ph) ph.style.display = 'none';
        if (pv) pv.style.display = 'flex';

        if (sigPadPrincipal && sigCtxPrincipal) {
          const i = new Image();
          i.onload = () => {
            sigCtxPrincipal.clearRect(0, 0, sigPadPrincipal.width, sigPadPrincipal.height);
            sigCtxPrincipal.drawImage(i, 0, 0, sigPadPrincipal.width, sigPadPrincipal.height);
          };
          i.src = dataUrl;
        }
      } else if (activeSignatureTarget === 'chica') {
        sigDataChica = true;
        const ph = document.getElementById('placeholder-firma-chica');
        const pv = document.getElementById('preview-firma-chica');
        const img = document.getElementById('img-preview-firma-chica');
        if (img) img.src = dataUrl;
        if (ph) ph.style.display = 'none';
        if (pv) pv.style.display = 'flex';

        if (sigPadChica && sigCtxChica) {
          const i = new Image();
          i.onload = () => {
            sigCtxChica.clearRect(0, 0, sigPadChica.width, sigPadChica.height);
            sigCtxChica.drawImage(i, 0, 0, sigPadChica.width, sigPadChica.height);
          };
          i.src = dataUrl;
        }
      }

      closeSignatureModal();
      showToast('✅ Firma registrada y confirmada', 'success');
    });

    // Botones Cancelar / Cerrar
    document.getElementById('btn-sig-cancel')?.addEventListener('click', closeSignatureModal);
    document.getElementById('btn-close-signature-modal')?.addEventListener('click', closeSignatureModal);

    // Ajustar orientación y dimensiones dinámicamente
    window.addEventListener('resize', () => {
      const modal = document.getElementById('modal-signature-fullscreen');
      if (modal && modal.style.display === 'flex') {
        checkOrientation();
        resizeModalCanvas(true);
      }
    });

    window.addEventListener('orientationchange', () => {
      const modal = document.getElementById('modal-signature-fullscreen');
      if (modal && modal.style.display === 'flex') {
        setTimeout(() => {
          checkOrientation();
          resizeModalCanvas(true);
        }, 150);
      }
    });
  }

  // =========================================================================
  // 1. REGISTRO DIARIO DE VENTAS (100% INTERCONECTADO)
  // =========================================================================
  // =========================================================================
  // 1. REGISTRO DIARIO DE VENTAS (100% INTERCONECTADO Y VISUAL)
  // =========================================================================
  let currentVentasList = [];
  let currentVentasMetodoFilter = 'todos';
  let currentVentasSearchTerm = '';
  let currentVentasViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('tb_ventas_view_preference'))
    || ((typeof window !== 'undefined' && window.innerWidth <= 768) ? 'tarjetas' : 'tabla');

  function setVentasViewMode(mode) {
    currentVentasViewMode = mode || 'tabla';
    try {
      localStorage.setItem('tb_ventas_view_preference', currentVentasViewMode);
    } catch (e) {}

    const btnTabla = document.getElementById('btn-view-tabla');
    const btnTarjetas = document.getElementById('btn-view-tarjetas');
    const tableWrap = document.getElementById('ventas-table-wrapper');
    const cardsWrap = document.getElementById('ventas-cards-wrapper');

    if (currentVentasViewMode === 'tarjetas') {
      if (btnTarjetas) btnTarjetas.classList.add('active');
      if (btnTabla) btnTabla.classList.remove('active');
      if (tableWrap) tableWrap.style.display = 'none';
      if (cardsWrap) cardsWrap.style.display = 'block';
    } else {
      if (btnTabla) btnTabla.classList.add('active');
      if (btnTarjetas) btnTarjetas.classList.remove('active');
      if (tableWrap) tableWrap.style.display = 'block';
      if (cardsWrap) cardsWrap.style.display = 'none';
    }
  }

  // Modo de sección: 'nueva-venta' (formulario guiado) vs 'ver-ventas' (listado del día)
  let currentVentasSectionMode = (typeof localStorage !== 'undefined' && localStorage.getItem('tb_ventas_section_mode')) || 'nueva-venta';

  function setVentasSectionMode(mode) {
    if (mode !== 'nueva-venta' && mode !== 'ver-ventas') mode = 'nueva-venta';
    currentVentasSectionMode = mode;
    try {
      localStorage.setItem('tb_ventas_section_mode', mode);
    } catch (e) {}

    const btnNueva = document.getElementById('btn-choice-nueva-venta');
    const btnVer = document.getElementById('btn-choice-ver-ventas');
    const wizardCard = document.getElementById('ventas-wizard-card');
    const listadoSection = document.getElementById('ventas-listado-section');

    if (btnNueva) btnNueva.classList.toggle('active', mode === 'nueva-venta');
    if (btnVer) btnVer.classList.toggle('active', mode === 'ver-ventas');

    if (mode === 'nueva-venta') {
      if (wizardCard) {
        wizardCard.style.display = 'block';
        wizardCard.style.animation = 'fadeInStep 0.25s ease forwards';
      }
      if (listadoSection) listadoSection.style.display = 'none';
    } else {
      if (wizardCard) wizardCard.style.display = 'none';
      if (listadoSection) {
        listadoSection.style.display = 'block';
        listadoSection.style.animation = 'fadeInStep 0.25s ease forwards';
      }
      const fecha = document.getElementById('ventas_filtro_fecha')?.value || getHidalgoDateStr();
      renderVentasFilteredList(fecha);
    }
  }

  // Apertura de WhatsApp con mensaje personalizado de agradecimiento y opinión en Google Maps
  function openWhatsAppReview(venta) {
    if (!venta) return;

    // 1. Extraer nombre de la clienta
    let clientaName = (venta.clienta || '').trim();
    const isGeneric = !clientaName || /mostrador|p[uú]blico/i.test(clientaName);
    
    // Saludo amigable y personalizado
    let saludo = '¡Hola! 💖✨';
    if (!isGeneric) {
      saludo = `¡Hola, ${clientaName}! 💖✨`;
    }

    // 2. Extraer servicio realizado
    let servicioTexto = '';
    const srv = (venta.servicio || '').trim();
    if (srv && srv !== '-') {
      servicioTexto = ` para tu servicio de *${srv}*`;
    }

    // 3. Redactar el mensaje oficial con enlace a Google Maps
    const reviewUrl = 'https://maps.app.goo.gl/unQv8bQhD5uHivNc9?g_st=ac';
    const mensaje = `${saludo}

Muchas gracias por visitarnos hoy${servicioTexto}. Nos encantó atenderte.

¿Nos ayudarías regalándonos tu opinión en Google Maps contándonos tu experiencia? 👉 ${reviewUrl}
Si gustas, también puedes adjuntar una fotito de cómo quedó tu servicio. 📸

¡Tu opinión significa muchísimo para nosotros y nos ayuda a seguir creciendo! ¡Que tengas un excelente día! 😊🙌`;

    // 4. Gestión del número de teléfono a 10 dígitos
    let rawPhone = (venta.telefono || '').toString().trim();
    let cleanDigits = rawPhone.replace(/\D/g, '');

    if (cleanDigits.length < 10) {
      const promptLabel = !isGeneric ? ` de "${clientaName}"` : '';
      const input = prompt(
        `📱 WhatsApp Total Beauty\n\nLa clienta${promptLabel} no tiene registrado un número a 10 dígitos.\n\nEscriba el número a 10 dígitos de WhatsApp (o pulse Cancelar/Aceptar en blanco para abrir WhatsApp y seleccionar el contacto):`,
        ''
      );
      if (input !== null && input.trim() !== '') {
        const cleanInput = input.replace(/\D/g, '');
        if (cleanInput.length >= 10) {
          cleanDigits = cleanInput;
          const tenDigits = cleanInput.slice(-10);
          venta.telefono = tenDigits;
          if (venta.id && venta.fecha) {
            TB_FIREBASE.saveVenta(venta).catch(e => console.warn('Error al actualizar teléfono en Firebase:', e));
            if (Array.isArray(currentVentasList)) {
              const idx = currentVentasList.findIndex(x => x.id === venta.id);
              if (idx !== -1) currentVentasList[idx].telefono = tenDigits;
            }
            renderVentasFilteredList(venta.fecha);
          }
        }
      }
    }

    let finalNumber = '';
    if (cleanDigits.length === 10) {
      finalNumber = '52' + cleanDigits;
    } else if (cleanDigits.length === 12 && cleanDigits.startsWith('52')) {
      finalNumber = cleanDigits;
    } else if (cleanDigits.length > 10) {
      finalNumber = cleanDigits;
    }

    const encodedMsg = encodeURIComponent(mensaje);
    const waUrl = finalNumber 
      ? `https://api.whatsapp.com/send?phone=${finalNumber}&text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`;

    showToast(`💬 Abriendo WhatsApp para ${!isGeneric ? clientaName : 'la clienta'}...`, 'info');
    window.open(waUrl, '_blank');
  }

  // =========================================================================
  // TICKET DIGITAL DE COMPRA EN VENTANA EXTERNA Y COMPARTIR POR WHATSAPP
  // =========================================================================
  function escapeJsString(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }

    function getTicketWindowFeatures() {
    const w = 480;
    const h = 820;
    const left = Math.max(0, Math.round((screen.width - w) / 2));
    const top = Math.max(0, Math.round((screen.height - h) / 2));
    return `width=${w},height=${h},top=${top},left=${left},toolbar=no,menubar=no,location=no,status=no,resizable=yes,scrollbars=yes`;
  }

  function getTicketLoadingHTML(venta) {
    const clienta = venta?.clienta || 'Cliente';
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generando Comprobante - Total Beauty</title>
  <style>
    body {
      margin: 0; padding: 24px;
      background: #0b0f19; color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 90vh; text-align: center;
    }
    .spinner-box {
      width: 58px; height: 58px;
      border: 4px solid rgba(212,175,55,0.2);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 22px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .brand { font-size: 1.5rem; font-weight: 900; letter-spacing: 2px; color: #d4af37; margin-bottom: 6px; }
    .sub { font-size: 0.85rem; color: #94a3b8; margin-bottom: 20px; letter-spacing: 1px; }
    .notice {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(212,175,55,0.35);
      padding: 16px 24px;
      border-radius: 14px;
      font-size: 0.95rem;
      color: #fef08a;
      max-width: 400px;
      line-height: 1.5;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .countdown-sec {
      font-size: 1.8rem;
      font-weight: 900;
      color: #22c55e;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="spinner-box"></div>
  <div class="brand">TOTAL BEAUTY</div>
  <div class="sub">SALÓN • ACADEMY • SPA</div>
  <div class="notice">
    <div>Asegurando registro de venta en Firebase...</div>
    <div style="color:#ffffff; font-size:0.85rem; margin-top:4px;">Preparando ticket de compra para <strong>${escapeHtml(clienta)}</strong></div>
    <div class="countdown-sec" id="timer">3s</div>
  </div>
  <script>
    let s = 3;
    const t = document.getElementById('timer');
    const interval = setInterval(() => {
      s--;
      if (s > 0) {
        if (t) t.textContent = s + 's';
      } else {
        if (t) t.textContent = '¡Listo!';
        clearInterval(interval);
      }
    }, 1000);
  <\/script>
</body>
</html>`;
  }

  function generateVentaTicketHTML(venta) {
    if (!venta) return '';

    const folio = (venta.id || '').replace(/^v_/, '').slice(0, 8).toUpperCase() || Date.now().toString().slice(-6);
    const fecha = venta.fecha || getHidalgoDateStr();
    const hora = venta.hora || (venta.createdAt ? new Date(venta.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : getHidalgoTimeStr());
    const clientaName = (venta.clienta || '').trim() || 'Cliente Mostrador';
    const clientaPhone = (venta.telefono || '').trim() || 'Sin teléfono';
    const cleanPhone = clientaPhone.replace(/\D/g, '');
    const totalCobrado = parseFloat(venta.totalCobrado) || 0;
    const totalCobradoFormatted = formatCurrency(totalCobrado);
    const folioSafeJs = JSON.stringify(folio);
    const clientaSafeJs = JSON.stringify(clientaName);
    const phoneSafeJs = JSON.stringify(cleanPhone);
    const totalSafeJs = JSON.stringify(totalCobradoFormatted);

    // Método y Status badges
    let metodoBadge = `<span class="ticket-payment-badge badge-pagado">💵 Efectivo</span>`;
    const mpLower = (venta.metodoPago || '').toLowerCase();
    let desgloseHtml = '';
    if (venta.desglosePago && (venta.metodoPago === 'Mixto' || (venta.desglosePago.efectivo > 0 && (venta.desglosePago.tarjeta > 0 || venta.desglosePago.transferencia > 0)))) {
      const parts = [];
      if (venta.desglosePago.efectivo > 0) parts.push(`💵 Efectivo: ${formatCurrency(venta.desglosePago.efectivo)}`);
      if (venta.desglosePago.tarjeta > 0) parts.push(`💳 Tarjeta: ${formatCurrency(venta.desglosePago.tarjeta)}`);
      if (venta.desglosePago.transferencia > 0) parts.push(`📱 Transferencia: ${formatCurrency(venta.desglosePago.transferencia)}`);
      metodoBadge = `<span class="ticket-payment-badge badge-anticipo">🔀 Mixto</span>`;
      desgloseHtml = `<div style="font-size:0.78rem; color:#64748b; margin-top:4px; font-weight:700;">${parts.join(' &bull; ')}</div>`;
    } else if (mpLower.includes('tarj')) {
      metodoBadge = `<span class="ticket-payment-badge" style="background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe;">💳 Tarjeta</span>`;
    } else if (mpLower.includes('transf')) {
      metodoBadge = `<span class="ticket-payment-badge badge-anticipo">📱 Transferencia</span>`;
    }

    let statusBadge = `<span class="ticket-payment-badge badge-pagado">✅ Pagado Completo</span>`;
    if (venta.statusPago === 'Anticipo') statusBadge = `<span class="ticket-payment-badge badge-anticipo">🟡 Anticipo</span>`;
    if (venta.statusPago === 'Saldo pendiente') statusBadge = `<span class="ticket-payment-badge badge-pendiente">🔴 Saldo Pendiente</span>`;

    // Logo src
    const logoSrc = (typeof TOTAL_BEAUTY_LOGO_BASE64 !== 'undefined' && TOTAL_BEAUTY_LOGO_BASE64)
      ? TOTAL_BEAUTY_LOGO_BASE64
      : 'assets/logoheader.png';

    // Generar tabla de servicios
    let servicesRows = '';
    if (Array.isArray(venta.servicios) && venta.servicios.length > 0) {
      servicesRows = venta.servicios.map(s => `
        <tr>
          <td>
            <div class="ticket-srv-name">${escapeHtml(s.servicio || 'Servicio')}</div>
            <div class="ticket-srv-meta">🪞 ${escapeHtml(s.estacion || '-')} &bull; 💅 ${escapeHtml(s.especialista || '-')}</div>
          </td>
          <td class="ticket-srv-price">${formatCurrency(s.precio || 0)}</td>
        </tr>
      `).join('');
    } else {
      servicesRows = `
        <tr>
          <td>
            <div class="ticket-srv-name">${escapeHtml(venta.servicio || 'Servicio')}</div>
            <div class="ticket-srv-meta">🪞 ${escapeHtml(venta.estacion || '-')} &bull; 💅 ${escapeHtml(venta.especialista || '-')}</div>
          </td>
          <td class="ticket-srv-price">${totalCobradoFormatted}</td>
        </tr>
      `;
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket de Compra #${folio} - Total Beauty</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 14px 60px 14px;
      -webkit-font-smoothing: antialiased;
    }

    /* Barra de acciones (no se imprime) */
    .ticket-actions-bar {
      width: 100%;
      max-width: 440px;
      margin-bottom: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .btn-action-primary-wa {
      width: 100%;
      background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
      color: #ffffff;
      border: none;
      padding: 15px 20px;
      font-size: 1.05rem;
      font-weight: 800;
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.45);
      transition: all 0.25s ease;
      letter-spacing: 0.2px;
      animation: pulseWa 2s infinite ease-in-out;
    }

    @keyframes pulseWa {
      0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(34, 197, 94, 0.45); }
      50% { transform: scale(1.02); box-shadow: 0 8px 26px rgba(34, 197, 94, 0.65); }
    }

    .btn-action-primary-wa:hover {
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      animation: none;
      transform: translateY(-2px);
    }

    .btn-action-secondary-wa {
      width: 100%;
      background: #0f172a;
      color: #38bdf8;
      border: 1.5px solid #38bdf8;
      padding: 12px 16px;
      font-size: 0.94rem;
      font-weight: 800;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .btn-action-secondary-wa:hover {
      background: #1e293b;
      color: #7dd3fc;
      border-color: #7dd3fc;
      transform: translateY(-2px);
    }

    .ticket-sharing-help {
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 12px;
      padding: 10px 14px;
      text-align: left;
    }

    .ticket-sub-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .btn-action-sec {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid #334155;
      padding: 10px 14px;
      font-size: 0.88rem;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-action-sec:hover {
      background: #334155;
      color: #ffffff;
      border-color: #d4af37;
    }

    .share-feedback-notice {
      display: none;
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 10px;
      padding: 12px 14px;
      color: #166534;
      font-size: 0.86rem;
      line-height: 1.45;
      text-align: left;
      margin-top: 6px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }

    /* Contenedor del Ticket Imprimible / Capturable */
    .tb-ticket-card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border-radius: 18px;
      border: 2px solid #d4af37;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
      overflow: hidden;
      position: relative;
    }

    /* Header */
    .ticket-header {
      background: linear-gradient(180deg, #0b0f19 0%, #151d2f 100%);
      color: #ffffff;
      padding: 22px 18px 16px 18px;
      text-align: center;
      border-bottom: 3.5px solid #d4af37;
    }

    .ticket-logo {
      height: 48px;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 6px;
      filter: drop-shadow(0 2px 8px rgba(0,0,0,0.45));
    }

    .ticket-brand {
      font-size: 1.25rem;
      font-weight: 900;
      letter-spacing: 0.06em;
      color: #ffffff;
      text-transform: uppercase;
      margin: 0;
      line-height: 1.2;
    }

    .ticket-subbrand {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #d4af37;
      text-transform: uppercase;
      margin: 3px 0 10px 0;
    }

    .ticket-badge-pill {
      display: inline-block;
      background: rgba(212, 175, 55, 0.2);
      border: 1px solid #d4af37;
      color: #fef08a;
      font-weight: 800;
      font-size: 0.78rem;
      padding: 4px 14px;
      border-radius: 99px;
      letter-spacing: 0.05em;
    }

    /* Cuerpo */
    .ticket-body {
      padding: 18px 20px;
      background: #ffffff;
    }

    /* Metadata */
    .ticket-meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.84rem;
    }

    .ticket-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-meta-label {
      color: #64748b;
      font-weight: 600;
    }

    .ticket-meta-val {
      color: #0f172a;
      font-weight: 700;
    }

    .ticket-folio {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 800;
      background: #0f172a;
      color: #fef08a;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
    }

    /* Títulos de sección */
    .ticket-section-title {
      font-size: 0.82rem;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .ticket-section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    /* Tabla de Servicios */
    .ticket-services-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
      margin-bottom: 16px;
    }

    .ticket-services-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 800;
      padding: 8px 10px;
      border-bottom: 1.5px solid #cbd5e1;
      text-align: left;
      font-size: 0.78rem;
      text-transform: uppercase;
    }

    .ticket-services-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }

    .ticket-srv-name {
      font-weight: 700;
      color: #0f172a;
    }

    .ticket-srv-meta {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 2px;
    }

    .ticket-srv-price {
      text-align: right;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
      white-space: nowrap;
    }

    /* Total Hero Banner */
    .ticket-total-hero {
      background: linear-gradient(135deg, #0b0f19 0%, #1e293b 100%);
      color: #ffffff;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 16px;
      border: 1.5px solid #d4af37;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 14px rgba(212, 175, 55, 0.25);
    }

    .ticket-total-label {
      font-size: 0.88rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #fef08a;
    }

    .ticket-total-amount {
      font-size: 1.7rem;
      font-weight: 900;
      color: #4ade80;
      font-variant-numeric: tabular-nums;
    }

    /* Detalles de Pago */
    .ticket-payment-details {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 0.84rem;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ticket-payment-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-payment-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .badge-pagado { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-anticipo { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .badge-pendiente { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

    /* Footer con Google Maps */
    .ticket-footer {
      background: #fffdf5;
      border-top: 1.5px dashed #d4af37;
      padding: 16px 14px;
      text-align: center;
      border-radius: 0 0 16px 16px;
    }

    .ticket-footer-heart {
      font-size: 1.35rem;
      margin-bottom: 4px;
    }

    .ticket-footer-title {
      font-size: 0.95rem;
      font-weight: 800;
      color: #78350f;
      margin-bottom: 4px;
    }

    .ticket-footer-sub {
      font-size: 0.78rem;
      color: #64748b;
      line-height: 1.35;
      margin-bottom: 12px;
    }

    .ticket-google-review-box {
      background: #ffffff;
      border: 1px solid #fef08a;
      border-radius: 10px;
      padding: 10px;
      box-shadow: 0 2px 6px rgba(212, 175, 55, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .ticket-stars {
      color: #f59e0b;
      font-size: 1.1rem;
      letter-spacing: 2px;
    }

    .ticket-review-cta {
      font-size: 0.82rem;
      font-weight: 800;
      color: #1e3a8a;
      text-decoration: underline;
      word-break: break-all;
    }

    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .ticket-actions-bar { display: none !important; }
      .tb-ticket-card { box-shadow: none !important; border: 1px solid #ccc !important; max-width: 80mm !important; }
    }
  </style>

  <!-- Librería gráfica html2canvas para generación de imagen -->
  <script src="libs/html2pdf.bundle.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
</head>
<body>

  <!-- Barra de Acciones de Usuario -->
  <div class="ticket-actions-bar">
    <!-- Botón 1: Enviar Imagen del Ticket a WhatsApp con archivo adjunto -->
    <button type="button" id="btn-share-file-wa" class="btn-action-primary-wa" onclick="shareTicketAsImageFile()">
      <span style="font-size:1.35rem;">🖼️</span>
      <span>Enviar Imagen del Ticket a WhatsApp</span>
    </button>

    <!-- Botón 2: Abrir Chat Directo con el número de la clienta -->
    <button type="button" id="btn-share-direct-wa" class="btn-action-secondary-wa" onclick="openDirectWhatsAppChat()">
      <span style="font-size:1.2rem;">💬</span>
      <span>Abrir Chat Directo con ${escapeHtml(clientaName)} (+52)</span>
    </button>

    <div class="ticket-sub-actions">
      <button type="button" id="btn-download-img" class="btn-action-sec" onclick="downloadTicketImage()">
        <span>📥</span> Descargar Imagen
      </button>
      <button type="button" class="btn-action-sec" onclick="window.print()">
        <span>🖨️</span> Imprimir Ticket
      </button>
    </div>

    <!-- Guía rápida para el usuario -->
    <div class="ticket-sharing-help">
      <div style="font-weight:800; color:#d4af37; margin-bottom:4px; font-size:0.8rem;">💡 ¿Cómo compartir el ticket con la clienta?</div>
      <div style="font-size:0.75rem; color:#cbd5e1; line-height:1.45;">
        • <strong>Para enviar la foto del ticket:</strong> Toca <strong>"🖼️ Enviar Imagen a WhatsApp"</strong> (abre WhatsApp con la foto del ticket adjunta).<br>
        • <strong>Para abrir directo a su chat:</strong> Toca <strong>"💬 Abrir Chat Directo"</strong> y en WhatsApp solo presiona <strong>Ctrl + V</strong> (la foto ya está en tu portapapeles).
      </div>
    </div>

    <div id="share-feedback-notice" class="share-feedback-notice"></div>
  </div>

  <!-- Tarjeta Oficial del Ticket (Se capturará como imagen para WhatsApp) -->
  <div class="tb-ticket-card" id="tb-ticket-card">
    <!-- Header -->
    <div class="ticket-header">
      <img src="${logoSrc}" alt="Total Beauty" class="ticket-logo" onerror="this.style.display='none'">
      <h2 class="ticket-brand">TOTAL BEAUTY</h2>
      <div class="ticket-subbrand">SALÓN &bull; ACADEMY &bull; SPA</div>
      <div class="ticket-badge-pill">COMPROBANTE DE COMPRA</div>
    </div>

    <!-- Body -->
    <div class="ticket-body">
      <!-- Meta -->
      <div class="ticket-meta-box">
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">📅 Fecha y Hora:</span>
          <span class="ticket-meta-val">${formatDateDisplay(fecha)} &bull; ${hora}</span>
        </div>
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">🏷️ Folio:</span>
          <span class="ticket-folio">#${folio}</span>
        </div>
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">👤 Clienta:</span>
          <span class="ticket-meta-val">${escapeHtml(clientaName)}</span>
        </div>
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">📱 Teléfono:</span>
          <span class="ticket-meta-val">${escapeHtml(clientaPhone)}</span>
        </div>
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">🪞 Estación:</span>
          <span class="ticket-meta-val">${escapeHtml(venta.estacion || '-')}</span>
        </div>
        <div class="ticket-meta-row">
          <span class="ticket-meta-label">💅 Especialista:</span>
          <span class="ticket-meta-val">${escapeHtml(venta.especialista || '-')}</span>
        </div>
      </div>

      <!-- Detalle de Servicios -->
      <div class="ticket-section-title"><span>✂️</span> Detalle del Servicio</div>
      <table class="ticket-services-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th style="text-align:right;">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${servicesRows}
        </tbody>
      </table>

      <!-- Banner de Total Hero -->
      <div class="ticket-total-hero">
        <span class="ticket-total-label">TOTAL COBRADO</span>
        <span class="ticket-total-amount">${totalCobradoFormatted}</span>
      </div>

      <!-- Forma de Pago -->
      <div class="ticket-payment-details">
        <div class="ticket-payment-row">
          <span class="ticket-meta-label">💳 Forma de Pago:</span>
          <div>${metodoBadge}</div>
        </div>
        ${desgloseHtml}
        <div class="ticket-payment-row" style="margin-top:2px;">
          <span class="ticket-meta-label">📌 Estado del Pago:</span>
          <div>${statusBadge}</div>
        </div>
        ${venta.notas ? `
          <div style="margin-top:4px; font-size:0.78rem; color:#64748b; border-top:1px dashed #e2e8f0; padding-top:4px;">
            💬 <strong>Notas:</strong> ${escapeHtml(venta.notas)}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Footer con Google Maps -->
    <div class="ticket-footer">
      <div class="ticket-footer-heart">💖✨</div>
      <div class="ticket-footer-title">¡Muchas gracias por tu visita!</div>
      <div class="ticket-footer-sub">Tu preferencia nos impulsa a seguir brindándote la mejor calidad y servicio.</div>
      
      <div class="ticket-google-review-box">
        <div style="font-size:0.8rem; font-weight:800; color:#854d0e;">¡Tu opinión nos ayuda a seguir creciendo!</div>
        <div class="ticket-stars">★★★★★</div>
        <div style="font-size:0.75rem; color:#a16207; font-weight:700;">Déjanos tu reseña en Google Maps</div>
      </div>

      <div style="margin-top:12px; font-size:0.72rem; color:#94a3b8;">
        TOTAL BEAUTY &bull; TICKET DE COMPRA VÁLIDO &bull; PACHUCA, HIDALGO
      </div>
    </div>
  </div>

  <script>
    async function captureTicketCanvas() {
      const ticketCard = document.getElementById('tb-ticket-card');
      if (!ticketCard) return null;
      const h2c = window.html2canvas || (window.html2pdf && window.html2pdf().html2canvas);
      if (!h2c) {
        alert('Cargando librería gráfica... por favor intente en un segundo.');
        return null;
      }
      return await h2c(ticketCard, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollY: 0
      });
    }

    function getCleanWaData() {
      var folio = ${folioSafeJs};
      var clientName = ${clientaSafeJs};
      var clientPhone = ${phoneSafeJs};
      var totalFormatted = ${totalSafeJs};
      var reviewUrl = "https://maps.app.goo.gl/unQv8bQhD5uHivNc9?g_st=ac";

      var cleanDigits = (clientPhone || '').replace(/[^0-9]/g, '');
      if (cleanDigits.length < 10) {
        var inputPhone = prompt(
          [
            '📱 Número de WhatsApp para "' + clientName + '":',
            '',
            'No se registró un número a 10 dígitos.',
            '',
            'Por favor escriba el número a 10 dígitos de WhatsApp:'
          ].join(String.fromCharCode(10)),
          ''
        );
        if (inputPhone && inputPhone.trim()) {
          cleanDigits = inputPhone.replace(/[^0-9]/g, '');
        }
      }

      var waNumber = cleanDigits.length >= 10 ? '52' + cleanDigits.slice(-10) : '';

      var messageText = [
        '¡Hola, ' + clientName + '! 💖✨',
        '',
        'Muchas gracias por visitarnos hoy en *Total Beauty*. Te compartimos tu comprobante de compra *#' + folio + '* por ' + totalFormatted + '.',
        '',
        '¿Nos ayudarías regalándonos tu opinión en Google Maps contándonos tu experiencia? 👉 ' + reviewUrl,
        'Si gustas, también puedes adjuntar una fotito de cómo quedó tu servicio. 📸',
        '',
        '¡Tu opinión significa muchísimo para nosotros y nos ayuda a seguir creciendo! ¡Que tengas un excelente día! 😊🙌'
      ].join(String.fromCharCode(10));

      return {
        folio: folio,
        clientName: clientName,
        waNumber: waNumber,
        messageText: messageText
      };
    }

    // BOTÓN 1: Compartir directamente el archivo de imagen del ticket en WhatsApp (abre WhatsApp con la foto adjunta)
    async function shareTicketAsImageFile() {
      const btn = document.getElementById('btn-share-file-wa');
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Preparando imagen del ticket...';
      }

      try {
        const data = getCleanWaData();
        const canvas = await captureTicketCanvas();
        if (!canvas) throw new Error('No se pudo generar la imagen del ticket.');

        const blob = await new Promise(function(resolve) { canvas.toBlob(resolve, 'image/png'); });
        const fileName = 'Ticket-TotalBeauty-' + data.folio + '.png';
        const file = new File([blob], fileName, { type: 'image/png' });

        // Intentar copiar al portapapeles siempre como respaldo
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          } catch (e) {
            console.warn('Clipboard fallback:', e);
          }
        }

        // Si el dispositivo/navegador soporta compartir archivos directamente (Móviles / Tablets / Windows Share):
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          if (btn) {
            btn.innerHTML = '<span>📲</span> Abriendo WhatsApp con imagen...';
          }
          await navigator.share({
            files: [file],
            title: 'Ticket Total Beauty #' + data.folio,
            text: data.messageText
          });
          const notice = document.getElementById('share-feedback-notice');
          if (notice) {
            notice.style.display = 'block';
            notice.innerHTML = '<strong>✅ ¡Imagen y mensaje compartidos con éxito!</strong>';
          }
        } else {
          // En computadoras sin soporte de compartir archivo directo: descargar imagen y abrir chat directo
          const dlLink = document.createElement('a');
          dlLink.download = fileName;
          dlLink.href = URL.createObjectURL(blob);
          dlLink.click();

          const waUrl = data.waNumber
            ? 'https://api.whatsapp.com/send?phone=' + encodeURIComponent(data.waNumber) + '&text=' + encodeURIComponent(data.messageText)
            : 'https://api.whatsapp.com/send?text=' + encodeURIComponent(data.messageText);
          window.open(waUrl, '_blank');

          const notice = document.getElementById('share-feedback-notice');
          if (notice) {
            notice.style.display = 'block';
            notice.innerHTML = '<strong>📋 ¡Imagen del ticket copiada al portapapeles y descargada!</strong><br>' +
              'Se abrió el chat de WhatsApp. En WhatsApp solo presiona <strong>Ctrl + V</strong> (o Pegar) para adjuntar la foto del ticket y dale Enviar.';
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error al compartir imagen:', err);
          alert('Detalle al compartir imagen: ' + (err.message || err));
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      }
    }

    // BOTÓN 2: Abrir directamente el chat con el número registrado
    async function openDirectWhatsAppChat() {
      const btn = document.getElementById('btn-share-direct-wa');
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Abriendo Chat Directo...';
      }

      try {
        const data = getCleanWaData();
        if (!data.waNumber) {
          alert('Se requiere un número telefónico a 10 dígitos para abrir el chat de WhatsApp de forma directa.');
          return;
        }

        // Generar imagen y copiarla al portapapeles en segundo plano para que el usuario solo presione Ctrl + V
        let copied = false;
        try {
          const canvas = await captureTicketCanvas();
          if (canvas) {
            const blob = await new Promise(function(resolve) { canvas.toBlob(resolve, 'image/png'); });
            const fileName = 'Ticket-TotalBeauty-' + data.folio + '.png';

            if (navigator.clipboard && navigator.clipboard.write) {
              try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                copied = true;
              } catch (clipErr) {
                console.warn('Portapapeles no disponible:', clipErr);
              }
            }

            const dlLink = document.createElement('a');
            dlLink.download = fileName;
            dlLink.href = URL.createObjectURL(blob);
            dlLink.click();
          }
        } catch (imgErr) {
          console.warn('Detalle al generar imagen de respaldo:', imgErr);
        }

        const waUrl = 'https://api.whatsapp.com/send?phone=' + encodeURIComponent(data.waNumber) + '&text=' + encodeURIComponent(data.messageText);
        window.open(waUrl, '_blank');

        const notice = document.getElementById('share-feedback-notice');
        if (notice) {
          notice.style.display = 'block';
          notice.innerHTML = '<strong>✅ ¡Chat de WhatsApp abierto directamente con ' + data.clientName + ' (+' + data.waNumber + ')!</strong><br>' +
            'El mensaje con tu enlace de Google Maps ya está listo en la barra de texto.<br>' +
            (copied ? '📋 <em>La imagen del ticket fue COPIADA al portapapeles. Solo presiona <strong>Ctrl + V</strong> en WhatsApp para adjuntarla.</em><br>' : '') +
            '📁 <em>La imagen también se descargó en tu dispositivo.</em>';
        }
      } catch (err) {
        console.error('Error al abrir chat directo:', err);
        alert('No se pudo abrir el chat de WhatsApp: ' + (err.message || err));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      }
    }

    async function downloadTicketImage() {
      var btn = document.getElementById('btn-download-img');
      if (btn) btn.disabled = true;
      try {
        var canvas = await captureTicketCanvas();
        if (!canvas) return;
        var folio = ${folioSafeJs};
        var dlLink = document.createElement('a');
        dlLink.download = 'Ticket-TotalBeauty-' + folio + '.png';
        dlLink.href = canvas.toDataURL('image/png');
        dlLink.click();
      } catch (e) {
        alert('Error al descargar: ' + e);
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  <\/script>
</body>
</html>`;
  }

  function openVentaTicketExternalWindow(venta, preOpenedWindow = null) {
    if (!venta) return;

    const htmlContent = generateVentaTicketHTML(venta);
    const winFeatures = getTicketWindowFeatures();
    const winName = 'TicketTotalBeauty_' + Date.now();

    let targetWin = preOpenedWindow;
    if (!targetWin || targetWin.closed) {
      try {
        targetWin = window.open('about:blank', winName, winFeatures);
      } catch (e) {
        console.warn('Fallo al abrir ventana externa:', e);
      }
    }

    if (targetWin && targetWin.document) {
      try {
        targetWin.document.open();
        targetWin.document.write(htmlContent);
        targetWin.document.close();
        if (targetWin.focus) targetWin.focus();
        return;
      } catch (wErr) {
        console.warn('Error al escribir en targetWin:', wErr);
      }
    }

    // Fallback con Blob URL si document.write fue bloqueado o restringido por el navegador
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const bWin = window.open(blobUrl, winName, winFeatures);
      if (bWin) {
        if (bWin.focus) bWin.focus();
        return;
      }
    } catch (bErr) {
      console.warn('Fallo fallback blob:', bErr);
    }

    showToast('⚠️ Ventana emergente bloqueada por el navegador. Haga clic para abrir el ticket.', 'warning');
    const backupBtn = document.createElement('div');
    backupBtn.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; background:#0b0f19; border:2px solid #d4af37; border-radius:14px; padding:16px 20px; box-shadow:0 12px 30px rgba(0,0,0,0.6); color:#fff; text-align:center;';
    backupBtn.innerHTML = `
      <div style="font-weight:800; color:#d4af37; margin-bottom:8px; font-size:1rem;">🧾 Ticket de Compra Listo</div>
      <button type="button" style="background:linear-gradient(135deg,#d4af37,#aa771c); color:#000; font-weight:800; border:none; padding:10px 18px; border-radius:8px; cursor:pointer;" id="btn-manual-open-ticket">Abrir Ticket en Nueva Ventana</button>
    `;
    document.body.appendChild(backupBtn);
    backupBtn.querySelector('#btn-manual-open-ticket')?.addEventListener('click', () => {
      const w = window.open('about:blank', 'TicketTotalBeauty_' + Date.now(), winFeatures);
      if (w) {
        w.document.open();
        w.document.write(htmlContent);
        w.document.close();
        if (w.focus) w.focus();
      }
      backupBtn.remove();
    });
    setTimeout(() => backupBtn.remove(), 25000);
  }

  async function renderVentas(fecha, isSilent = false) {
    const todayHidalgo = getHidalgoDateStr();
    const filterInput = document.getElementById('ventas_filtro_fecha');
    const vFechaInput = document.getElementById('venta_fecha');

    if (!fecha || fecha > todayHidalgo) {
      fecha = todayHidalgo;
    }
    if (filterInput && (!filterInput.value || filterInput.value > todayHidalgo)) {
      filterInput.value = fecha;
    }
    if (vFechaInput && (!vFechaInput.value || vFechaInput.value > todayHidalgo)) {
      vFechaInput.value = fecha;
    }

    const tbody = document.getElementById('tbody-ventas');
    const cardsContainer = document.getElementById('ventas-cards-container');

    // SOLUCIÓN DEFINITIVA A VENTAS QUE SE BORRAN O PARPADEAN:
    // Sólo mostrar mensaje "Cargando ventas..." si NO hay ventas previas mostradas en pantalla
    // y NO es una actualización en segundo plano. Si ya hay ventas mostradas, mantenerlas visibles
    // hasta que lleguen los datos actualizados para que NUNCA desaparezcan de la vista del usuario.
    if (!isSilent && (!currentVentasList || currentVentasList.length === 0)) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:18px; color:var(--muted);">Cargando ventas...</td></tr>';
      if (cardsContainer) cardsContainer.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:24px; color:var(--muted);">Cargando ventas...</div>';
    }

    let ventas = [];
    try {
      ventas = await TB_FIREBASE.getVentasByFecha(fecha);
    } catch (e) {
      console.warn('Error al obtener ventas de Firebase:', e);
    }

    const newVentasList = Array.isArray(ventas) ? ventas : Object.values(ventas || {});

    // Ordenar de forma descendente: la venta más reciente siempre aparece arriba
    newVentasList.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB && timeA !== timeB) return timeB - timeA;
      return (b.hora || '').localeCompare(a.hora || '');
    });

    // ESCUDO DE PROTECCIÓN DE MEMORIA:
    // Si la llamada devuelve 0 ventas pero en memoria YA tenemos ventas para este mismo día,
    // NUNCA sobreescribir la memoria con un arreglo vacío por un fallo transitorio de red.
    if (newVentasList.length === 0 && currentVentasList && currentVentasList.length > 0) {
      const currentHasMatchingDate = currentVentasList.some(v => (v.fecha || todayHidalgo) === fecha);
      if (currentHasMatchingDate) {
        console.warn(`[renderVentas] Escudo de memoria activo: preservando ${currentVentasList.length} ventas mostradas para ${fecha}.`);
      } else {
        currentVentasList = newVentasList;
      }
    } else {
      currentVentasList = newVentasList;
    }

    let totCobrado = 0;
    let totEfec = 0;
    let totTarj = 0;
    let totTransf = 0;

    currentVentasList.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      totCobrado += imp;
      if (v.desglosePago) {
        totEfec += parseFloat(v.desglosePago.efectivo) || 0;
        totTarj += parseFloat(v.desglosePago.tarjeta) || 0;
        totTransf += parseFloat(v.desglosePago.transferencia) || 0;
      } else {
        const mp = (v.metodoPago || '').toLowerCase();
        if (mp.includes('efec')) totEfec += imp;
        else if (mp.includes('tarj')) totTarj += imp;
        else if (mp.includes('transf')) totTransf += imp;
        else totEfec += imp;
      }
    });

    setDisplay('kpi-ventas-total', totCobrado);
    setDisplay('kpi-ventas-efectivo', totEfec);
    setDisplay('kpi-ventas-tarjeta', totTarj);
    setDisplay('kpi-ventas-transf', totTransf);
    setDisplay('tabla-ventas-gran-total', totCobrado);

    const opsBadge = document.getElementById('ventas-badge-operaciones');
    if (opsBadge) opsBadge.textContent = `${currentVentasList.length} Operaciones`;

    const countPill = document.getElementById('choice-ventas-count-pill');
    if (countPill) countPill.textContent = `${currentVentasList.length} ${currentVentasList.length === 1 ? 'venta' : 'ventas'}`;

    const totalBadge = document.getElementById('choice-ventas-total-badge');
    if (totalBadge) totalBadge.textContent = formatCurrency(totCobrado);

    const wizLinkCount = document.getElementById('wizard-link-count');
    if (wizLinkCount) wizLinkCount.textContent = currentVentasList.length;

    renderVentasFilteredList(fecha);
  }

  function getClientAvatar(name) {
    if (!name || name.toLowerCase().includes('mostrador') || name.toLowerCase().includes('cliente')) {
      return `<div class="client-avatar avatar-mostrador" title="Cliente Mostrador">👤</div>`;
    }
    const parts = name.trim().split(/\s+/);
    const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    const colors = [
      { bg: '#fce7f3', text: '#9d174d' },
      { bg: '#e0e7ff', text: '#3730a3' },
      { bg: '#dcfce7', text: '#166534' },
      { bg: '#fef3c7', text: '#92400e' },
      { bg: '#ccfbf1', text: '#115e59' },
      { bg: '#f3e8ff', text: '#6b21a8' },
      { bg: '#fee2e2', text: '#991b1b' }
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const color = colors[Math.abs(hash) % colors.length];
    return `<div class="client-avatar" style="background:${color.bg}; color:${color.text};">${initials}</div>`;
  }

  function formatPhoneLink(phone) {
    if (!phone) return '<span style="color:var(--muted); font-size:0.75rem;">Sin teléfono</span>';
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length >= 10) {
      const formatted = clean.length === 10 ? `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6)}` : clean;
      return `<a href="https://wa.me/52${clean}" target="_blank" rel="noopener noreferrer" class="phone-wa-link" title="Contactar por WhatsApp">
        <span>📱</span> ${formatted}
      </a>`;
    }
    return `<span style="font-family:monospace; font-size:0.8rem; color:var(--slate);">${phone}</span>`;
  }

  function renderVentasFilteredList(fecha) {
    if (!fecha) {
      fecha = document.getElementById('ventas_filtro_fecha')?.value || getHidalgoDateStr();
    }
    const tbody = document.getElementById('tbody-ventas');
    const cardsContainer = document.getElementById('ventas-cards-container');

    const search = (currentVentasSearchTerm || '').toLowerCase().trim();
    const metodoFilter = currentVentasMetodoFilter;

    let filtered = currentVentasList.filter(v => {
      // Filtro por método de pago
      if (metodoFilter !== 'todos') {
        const mp = (v.metodoPago || '').toLowerCase();
        const d = v.desglosePago;
        if (metodoFilter === 'efectivo') {
          if (!mp.includes('efec') && (!d || !(parseFloat(d.efectivo) > 0))) return false;
        }
        if (metodoFilter === 'tarjeta') {
          if (!mp.includes('tarj') && (!d || !(parseFloat(d.tarjeta) > 0))) return false;
        }
        if (metodoFilter === 'transferencia') {
          if (!mp.includes('transf') && (!d || !(parseFloat(d.transferencia) > 0))) return false;
        }
      }
      // Filtro por término de búsqueda
      if (search) {
        const textToSearch = `${v.clienta || ''} ${v.telefono || ''} ${v.servicio || ''} ${v.estacion || ''} ${v.especialista || ''} ${v.notas || ''} ${v.totalCobrado || ''}`.toLowerCase();
        if (!textToSearch.includes(search)) return false;
      }
      return true;
    });

    if (tbody) tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';

    if (filtered.length === 0) {
      const msg = currentVentasList.length === 0 
        ? `No hay ventas registradas para este día (${fecha}). Registre una nueva venta arriba.`
        : `No se encontraron ventas que coincidan con la búsqueda o filtro seleccionado.`;

      const resetBtnHtml = currentVentasList.length > 0 
        ? `<div style="margin-top:12px;"><button type="button" class="btn btn-sm btn-outline-dark btn-reset-ventas-filters" style="font-size:0.82rem; font-weight:700; padding:6px 14px; border-radius:8px; cursor:pointer;">👁️ Mostrar todas las ventas registradas (${currentVentasList.length})</button></div>`
        : '';

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="table-empty-notice" style="text-align:center; padding:28px 16px;">
              <div><span style="font-size:1.8rem;">📂</span></div>
              <div style="margin-top:6px; font-weight:600; color:var(--text);">${msg}</div>
              ${resetBtnHtml}
            </td>
          </tr>
        `;
      }
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:32px 16px; color:var(--text); background:#f8fafc; border-radius:12px; border:1px dashed var(--border);">
            <div style="font-size:2rem; margin-bottom:8px;">📂</div>
            <div style="font-size:0.95rem; font-weight:600;">${msg}</div>
            ${resetBtnHtml}
          </div>
        `;
      }
      return;
    }

    // Renderizar Filas de Tabla
    if (tbody) {
      filtered.forEach(v => {
        const tr = document.createElement('tr');
        const horaStr = v.hora || (v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');

        // Status badge
        let statusBadge = `<span class="badge-status-pago status-pagado">✅ Pagado</span>`;
        if (v.statusPago === 'Anticipo') statusBadge = `<span class="badge-status-pago status-anticipo">🟡 Anticipo</span>`;
        if (v.statusPago === 'Saldo pendiente') statusBadge = `<span class="badge-status-pago status-pendiente">🔴 Pendiente</span>`;

        // Método badge
        let metodoBadge = `<span class="badge-metodo-pago metodo-efectivo">💵 Efectivo</span>`;
        const mpLower = (v.metodoPago || '').toLowerCase();
        if (v.desglosePago && (v.metodoPago === 'Mixto' || (v.desglosePago.efectivo > 0 && (v.desglosePago.tarjeta > 0 || v.desglosePago.transferencia > 0)) || (v.desglosePago.tarjeta > 0 && v.desglosePago.transferencia > 0))) {
          const parts = [];
          if (v.desglosePago.efectivo > 0) parts.push(`💵 ${formatCurrency(v.desglosePago.efectivo)}`);
          if (v.desglosePago.tarjeta > 0) parts.push(`💳 ${formatCurrency(v.desglosePago.tarjeta)}`);
          if (v.desglosePago.transferencia > 0) parts.push(`📱 ${formatCurrency(v.desglosePago.transferencia)}`);
          metodoBadge = `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span class="badge-metodo-pago metodo-mixto" title="${parts.join(' + ')}">🔀 Mixto</span>
              <span style="font-size:0.72rem; color:var(--slate); font-weight:700;">${parts.join(' + ')}</span>
            </div>
          `;
        } else if (mpLower.includes('tarj')) {
          metodoBadge = `<span class="badge-metodo-pago metodo-tarjeta">💳 Tarjeta</span>`;
        } else if (mpLower.includes('transf')) {
          metodoBadge = `<span class="badge-metodo-pago metodo-transf">📱 Transferencia</span>`;
        }

        tr.className = 'venta-table-row';
        tr.dataset.id = v.id;
        tr.title = 'Toca esta venta para abrir WhatsApp con agradecimiento y pedir opinión en Google Maps 💖💬';

        const avatar = getClientAvatar(v.clienta);
        const phone = formatPhoneLink(v.telefono);
        const clientName = v.clienta ? `<strong>${v.clienta}</strong>` : `<span style="color:var(--muted); font-style:italic;">Cliente Mostrador</span>`;

        tr.innerHTML = `
          <td><span style="font-size:0.8rem; font-weight:600; color:var(--slate);">🕒 ${horaStr}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              ${avatar}
              <div>
                <div style="font-size:0.9rem; line-height:1.2;">${clientName}</div>
                <div style="margin-top:2px;">${phone}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight:700; color:var(--dark); font-size:0.9rem; display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
              <span>${escapeHtml(v.servicio || '-')}</span>
              ${v.servicios && v.servicios.length > 1 ? `<span class="badge" style="background:#fef9c3; color:#854d0e; font-size:0.72rem; padding:2px 6px; border-radius:4px; font-weight:800;">${v.servicios.length} servicios</span>` : ''}
            </div>
            <div style="font-size:0.78rem; color:var(--muted); display:flex; align-items:center; gap:4px; margin-top:2px;">
              <span>💅</span> ${escapeHtml(v.especialista || 'Sin especialista')}
            </div>
          </td>
          <td>
            <span class="venta-estacion-badge">🪞 ${escapeHtml(v.estacion || '-')}</span>
          </td>
          <td>${metodoBadge}</td>
          <td>${statusBadge}</td>
          <td class="text-right">
            <span style="font-weight:800; font-size:1.05rem; color:#15803d;">${formatCurrency(v.totalCobrado)}</span>
          </td>
          <td class="text-center" style="white-space:nowrap;">
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <button type="button" class="btn-venta-ticket-action" data-id="${v.id}" title="Ver e imprimir ticket de compra en ventana externa" style="background:#0f172a; color:#d4af37; border:1px solid #d4af37; border-radius:6px; padding:5px 8px; font-weight:800; font-size:0.76rem; cursor:pointer;">
                <span>🧾</span> Ticket
              </button>
              <button type="button" class="btn-venta-wa-action" data-id="${v.id}" title="Enviar mensaje de agradecimiento y opinión por WhatsApp">
                <span>💬</span> WhatsApp
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm btn-del-venta" data-id="${v.id}" data-fecha="${v.fecha || fecha}" title="Eliminar Venta" style="padding:4px 8px;">✕</button>
            </div>
          </td>
        `;

        tr.querySelector('.btn-venta-ticket-action')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openVentaTicketExternalWindow(v);
        });

        tr.addEventListener('click', (e) => {
          if (e.target.closest('.btn-del-venta') || e.target.closest('.btn-venta-ticket-action')) return;
          openWhatsAppReview(v);
        });

        tbody.appendChild(tr);
      });
    }

    // Renderizar Tarjetas Visuales
    if (cardsContainer) {
      filtered.forEach(v => {
        const card = document.createElement('div');
        card.className = 'venta-visual-card';
        const horaStr = v.hora || (v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');

        let statusBadge = `<span class="badge-status-pago status-pagado">✅ Pagado</span>`;
        if (v.statusPago === 'Anticipo') statusBadge = `<span class="badge-status-pago status-anticipo">🟡 Anticipo</span>`;
        if (v.statusPago === 'Saldo pendiente') statusBadge = `<span class="badge-status-pago status-pendiente">🔴 Pendiente</span>`;

        let metodoBadge = `<span class="badge-metodo-pago metodo-efectivo">💵 Efectivo</span>`;
        const mpLower = (v.metodoPago || '').toLowerCase();
        if (v.desglosePago && (v.metodoPago === 'Mixto' || (v.desglosePago.efectivo > 0 && (v.desglosePago.tarjeta > 0 || v.desglosePago.transferencia > 0)) || (v.desglosePago.tarjeta > 0 && v.desglosePago.transferencia > 0))) {
          const parts = [];
          if (v.desglosePago.efectivo > 0) parts.push(`💵 ${formatCurrency(v.desglosePago.efectivo)}`);
          if (v.desglosePago.tarjeta > 0) parts.push(`💳 ${formatCurrency(v.desglosePago.tarjeta)}`);
          if (v.desglosePago.transferencia > 0) parts.push(`📱 ${formatCurrency(v.desglosePago.transferencia)}`);
          metodoBadge = `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span class="badge-metodo-pago metodo-mixto" title="${parts.join(' + ')}">🔀 Mixto</span>
              <span style="font-size:0.72rem; color:var(--slate); font-weight:700;">${parts.join(' + ')}</span>
            </div>
          `;
        } else if (mpLower.includes('tarj')) {
          metodoBadge = `<span class="badge-metodo-pago metodo-tarjeta">💳 Tarjeta</span>`;
        } else if (mpLower.includes('transf')) {
          metodoBadge = `<span class="badge-metodo-pago metodo-transf">📱 Transferencia</span>`;
        }

        card.className = 'venta-visual-card';
        card.dataset.id = v.id;
        card.style.cursor = 'pointer';
        card.title = 'Toca esta tarjeta para abrir WhatsApp con agradecimiento y pedir opinión en Google Maps 💖💬';

        const avatar = getClientAvatar(v.clienta);
        const phone = formatPhoneLink(v.telefono);
        const clientName = v.clienta || 'Cliente Mostrador';

        card.innerHTML = `
          <div class="venta-card-header">
            <div class="venta-card-client-wrap">
              ${avatar}
              <div>
                <div class="venta-card-client-name">${clientName}</div>
                <div class="venta-card-phone">${phone}</div>
              </div>
            </div>
            ${statusBadge}
          </div>

          <div class="venta-card-body">
            <div class="venta-card-service-title" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
              <span>${escapeHtml(v.servicio || 'Servicio')}</span>
              ${v.servicios && v.servicios.length > 1 ? `<span class="badge" style="background:#fef9c3; color:#854d0e; font-size:0.72rem; padding:2px 6px; border-radius:10px; font-weight:800;">${v.servicios.length} servicios</span>` : ''}
            </div>
            <div class="venta-card-tags">
              <span class="venta-tag tag-estacion">🪞 ${escapeHtml(v.estacion || 'Estación')}</span>
              <span class="venta-tag tag-especialista">💅 ${escapeHtml(v.especialista || 'Especialista')}</span>
              <span class="venta-tag tag-hora">🕒 ${horaStr}</span>
            </div>
            ${v.notas ? `<div class="venta-card-notes">💬 ${escapeHtml(v.notas)}</div>` : ''}
            <div class="venta-card-wa-wrap" style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              <button type="button" class="btn-card-ticket-view" data-id="${v.id}" style="background:#0f172a; color:#d4af37; border:1px solid #d4af37; border-radius:8px; padding:8px 10px; font-weight:800; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
                <span>🧾</span> Ver Ticket
              </button>
              <button type="button" class="btn-card-wa-review" data-id="${v.id}">
                <span>💬</span> WhatsApp
              </button>
            </div>
          </div>

          <div class="venta-card-footer">
            <div class="venta-card-payment">
              ${metodoBadge}
            </div>
            <div class="venta-card-amount">
              ${formatCurrency(v.totalCobrado)}
            </div>
            <button type="button" class="btn btn-outline-danger btn-sm btn-del-venta" data-id="${v.id}" data-fecha="${v.fecha || fecha}" title="Eliminar Venta" style="padding:4px 8px; border-radius:6px;">
              ✕
            </button>
          </div>
        `;

        card.querySelector('.btn-card-ticket-view')?.addEventListener('click', (e) => {
          e.stopPropagation();
          openVentaTicketExternalWindow(v);
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-del-venta') || e.target.closest('.btn-card-ticket-view')) return;
          openWhatsAppReview(v);
        });

        cardsContainer.appendChild(card);
      });
    }
  }

  // =========================================================================
  // GESTIÓN Y CONTROL DE CORTES DIARIOS DE CAJA PRINCIPAL
  // =========================================================================
  function updateCorteBanner(fecha, numVentasCorte, cortesHoy = []) {
    const badgeNum = document.getElementById('badge-corte-numero');
    const periodoEl = document.getElementById('banner-corte-periodo');
    const resumenEl = document.getElementById('banner-corte-resumen');
    const btnVerCortes = document.getElementById('btn-ver-cortes-hoy');
    const countCortesEl = document.getElementById('count-cortes-hoy');

    const corteNum = (cortesHoy ? cortesHoy.length : 0) + 1;
    currentCorteNum = corteNum;

    if (badgeNum) badgeNum.textContent = 'CORTE #' + corteNum;

    const ultimoCorte = (cortesHoy && cortesHoy.length > 0) ? cortesHoy[cortesHoy.length - 1] : null;
    const horaDesde = ultimoCorte ? (ultimoCorte.header?.hora || ultimoCorte.hora || '00:00') : 'Inicio (00:00)';
    currentCorteHoraInicio = horaDesde;

    if (periodoEl) {
      periodoEl.innerHTML = 'Período del corte: <strong>' + horaDesde + '</strong> &rarr; <strong>En curso</strong>';
    }

    if (resumenEl) {
      let ultInfo = 'Primer corte del día';
      if (ultimoCorte) {
        const dest = ultimoCorte.destinoEfectivo || ultimoCorte.validacion?.destinoEfectivo;
        if (dest === 'se_guarda_en_sobre') {
          ultInfo = 'Último corte #' + (ultimoCorte.corteNum || 1) + ': Retirado en Sobre [' + (ultimoCorte.folioSobre || ultimoCorte.validacion?.folioSobre || 'Folio') + '] (' + formatCurrency(ultimoCorte.montoSobre || ultimoCorte.validacion?.importeEntregado || 0) + ' - No faltante)';
        } else if (dest === 'se_resguarda_otro') {
          ultInfo = 'Último corte #' + (ultimoCorte.corteNum || 1) + ': Resguardado en ' + (ultimoCorte.lugarResguardo || ultimoCorte.validacion?.lugarResguardo || 'Lugar') + ' [' + (ultimoCorte.folioResguardo || ultimoCorte.validacion?.folioResguardo || 'Folio') + '] (' + formatCurrency(ultimoCorte.montoResguardo || ultimoCorte.validacion?.importeEntregado || 0) + ' - No faltante)';
        } else {
          ultInfo = 'Último corte #' + (ultimoCorte.corteNum || 1) + ': Quedó en caja (' + formatCurrency(ultimoCorte.montoQuedaEnCaja || ultimoCorte.conteo?.total || 0) + ' &bull; Pasó a Fondo)';
        }
      }
      resumenEl.innerHTML = '<strong>' + numVentasCorte + '</strong> venta(s) en este corte &bull; ' + ultInfo;
    }

    if (btnVerCortes && countCortesEl) {
      if (cortesHoy && cortesHoy.length > 0) {
        btnVerCortes.style.display = 'inline-block';
        countCortesEl.textContent = String(cortesHoy.length);
      } else {
        btnVerCortes.style.display = 'none';
        countCortesEl.textContent = '0';
      }
    }

    suggestFolios(fecha, corteNum);
  }

  function suggestFolios(fecha, corteNum) {
    const fClean = (fecha || getHidalgoDateStr()).replace(/[^0-9]/g, '');
    const cPad = String(corteNum || 1).padStart(2, '0');

    const inpSobre = document.getElementById('val_folio_sobre');
    if (inpSobre && (!inpSobre.value || inpSobre.dataset.autoFolio === 'true')) {
      inpSobre.value = 'SOBRE-' + fClean + '-' + cPad;
      inpSobre.dataset.autoFolio = 'true';
    }

    const inpResg = document.getElementById('val_folio_resguardo');
    if (inpResg && (!inpResg.value || inpResg.dataset.autoFolio === 'true')) {
      inpResg.value = 'RESG-' + fClean + '-' + cPad;
      inpResg.dataset.autoFolio = 'true';
    }
  }

  // Interconexión: Sincronizar automáticamente las ventas del día a Caja Principal
  async function syncVentasToCajaPrincipal(fecha, autoAlert = true) {
    if (!fecha) fecha = document.getElementById('header_fecha')?.value || getHidalgoDateStr();
    const allVentas = await TB_FIREBASE.getVentasByFecha(fecha);
    const cortesHoy = await TB_FIREBASE.getCortesByFecha(fecha);
    currentCortesHoy = cortesHoy;

    // Recopilar IDs de ventas ya contempladas en cortes anteriores del día
    const yaCortadasSet = new Set();
    let ultimoCorte = null;
    if (Array.isArray(cortesHoy) && cortesHoy.length > 0) {
      cortesHoy.forEach(c => {
        if (Array.isArray(c.ventasIds)) {
          c.ventasIds.forEach(id => yaCortadasSet.add(id));
        }
      });
      ultimoCorte = cortesHoy[cortesHoy.length - 1];
    }

    // Filtrar exclusivamente las ventas que corresponden al corte actual
    // (Ocurridas después del último corte registrado)
    const ventas = allVentas.filter(v => {
      if (!v || !v.id) return false;
      if (yaCortadasSet.has(v.id)) return false;
      if (ultimoCorte) {
        if (ultimoCorte.corteTimestamp && v.createdAt) {
          if (new Date(v.createdAt).getTime() <= new Date(ultimoCorte.corteTimestamp).getTime()) {
            return false;
          }
        } else if (v.hora && ultimoCorte.hora && v.hora <= ultimoCorte.hora) {
          return false;
        }
      }
      return true;
    });

    currentCorteVentas = ventas;
    updateCorteBanner(fecha, ventas.length, cortesHoy);

    // Reiniciar contadores de ingresos (Solo Servicios de belleza, Cursos de academia y Venta de productos)
    const matrix = {
      servicios: { e: 0, t: 0, j: 0 },
      cursos:    { e: 0, t: 0, j: 0 },
      productos: { e: 0, t: 0, j: 0 }
    };

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const mp = (v.metodoPago || '').toLowerCase();

      // Si tiene desglose de servicios múltiples en el ticket, distribuir proporcionalmente
      if (Array.isArray(v.servicios) && v.servicios.length > 0) {
        const sumServicios = v.servicios.reduce((s, it) => s + (parseFloat(it.precio) || 0), 0);
        v.servicios.forEach(it => {
          const sPrice = parseFloat(it.precio) || 0;
          const ratio = sumServicios > 0 ? (sPrice / sumServicios) : (1 / v.servicios.length);
          const itemImp = imp * ratio;

          const est = (it.estacion || '').toLowerCase();
          const serv = (it.servicio || '').toLowerCase();

          let targetCat = 'servicios';
          if (est.includes('academia') || serv.includes('curso') || serv.includes('taller')) {
            targetCat = 'cursos';
          } else if (est.includes('retail') || serv.includes('producto') || serv.includes('shampoo')) {
            targetCat = 'productos';
          }

          if (v.desglosePago) {
            matrix[targetCat].e += (parseFloat(v.desglosePago.efectivo) || 0) * ratio;
            matrix[targetCat].j += (parseFloat(v.desglosePago.tarjeta) || 0) * ratio;
            matrix[targetCat].t += (parseFloat(v.desglosePago.transferencia) || 0) * ratio;
          } else {
            const col = mp.includes('transf') ? 't' : (mp.includes('tarj') ? 'j' : 'e');
            matrix[targetCat][col] += itemImp;
          }
        });
      } else {
        const est = (v.estacion || '').toLowerCase();
        const serv = (v.servicio || '').toLowerCase();

        let targetCat = 'servicios';
        if (est.includes('academia') || serv.includes('curso') || serv.includes('taller')) {
          targetCat = 'cursos';
        } else if (est.includes('retail') || serv.includes('producto') || serv.includes('shampoo')) {
          targetCat = 'productos';
        }

        if (v.desglosePago) {
          matrix[targetCat].e += parseFloat(v.desglosePago.efectivo) || 0;
          matrix[targetCat].j += parseFloat(v.desglosePago.tarjeta) || 0;
          matrix[targetCat].t += parseFloat(v.desglosePago.transferencia) || 0;
        } else {
          const col = mp.includes('transf') ? 't' : (mp.includes('tarj') ? 'j' : 'e');
          matrix[targetCat][col] += imp;
        }
      }
    });

    // Rellenar formulario de Caja Principal
    ['servicios', 'cursos', 'productos'].forEach(k => {
      const elE = document.getElementById(`ing_${k}_efec`);
      const elT = document.getElementById(`ing_${k}_transf`);
      const elJ = document.getElementById(`ing_${k}_tarj`);
      if (elE) elE.value = matrix[k].e.toFixed(2);
      if (elT) elT.value = matrix[k].t.toFixed(2);
      if (elJ) elJ.value = matrix[k].j.toFixed(2);
    });

    const opEl = document.getElementById('ing_operaciones_cobradas');
    if (opEl) opEl.value = ventas.length > 0 ? ventas.length : '';

    // Sincronizar en segundo plano el Control de Transferencias y Tarjetas
    const transfEl = document.getElementById('ctrl_transf_reg');
    const tarjEl = document.getElementById('ctrl_tarj_reg');
    if (transfEl) transfEl.value = parseVal('ing_total_transf').toFixed(2);
    if (tarjEl) tarjEl.value = parseVal('ing_total_tarjeta').toFixed(2);

    recalculatePrincipal();

    if (autoAlert) {
      showToast(`✅ ${ventas.length} ventas del día cargadas exitosamente a Caja Principal`, 'success');
    }
  }

  // =========================================================================
  // 2. LÓGICA DE CAJA PRINCIPAL
  // =========================================================================
  function recalculatePrincipal() {
    const fCaja = parseVal('f_inicial_caja');
    setDisplay('kpi-f-inicial', fCaja);
    setDisplay('concil_fondo_inicial', fCaja);

    // Ingresos del día (calculados de ventas)
    let totEfec = 0, totTransf = 0, totTarj = 0;
    ['servicios', 'cursos', 'productos'].forEach(k => {
      const e = parseVal(`ing_${k}_efec`);
      const t = parseVal(`ing_${k}_transf`);
      const j = parseVal(`ing_${k}_tarj`);
      const rowTot = e + t + j;
      setDisplay(`ing_${k}_total`, rowTot);
      totEfec += e;
      totTransf += t;
      totTarj += j;
    });

    const granTotalIngresos = totEfec + totTransf + totTarj;
    setDisplay('ing_total_efectivo', totEfec);
    setDisplay('ing_total_transf', totTransf);
    setDisplay('ing_total_tarjeta', totTarj);
    setDisplay('ing_gran_total', granTotalIngresos);
    setDisplay('kpi-ingresos', granTotalIngresos);

    // Conteo físico principal (simplificado: cantidad que hay en caja)
    let totalContado = 0;
    const conteoInput = document.getElementById('conteo_total_efectivo');
    if (conteoInput) {
      if (conteoInput.tagName === 'INPUT') {
        totalContado = parseFloat(conteoInput.value) || 0;
        const hintEl = document.getElementById('hint-conteo-estado');
        if (hintEl) {
          if (!conteoInput.value && totalContado === 0) {
            hintEl.textContent = 'Pendiente de captura';
            hintEl.style.color = 'var(--primary)';
          } else {
            hintEl.textContent = `Capturado: ${formatCurrency(totalContado)}`;
            hintEl.style.color = '#16a34a';
          }
        }
      } else {
        totalContado = parseFloat(conteoInput.textContent.replace(/[^0-9.-]/g, '')) || 0;
      }
    }
    setDisplay('kpi-efectivo-contado', totalContado);

    // Sincronizar automáticamente el monto contado con el destino del efectivo si no fue editado manualmente
    const destVal = document.getElementById('val_destino_efectivo')?.value || 'se_queda_en_caja';
    if (destVal === 'se_queda_en_caja') {
      const inpQ = document.getElementById('val_monto_queda_caja');
      if (inpQ && (!inpQ.value || inpQ.dataset.manual !== 'true')) {
        inpQ.value = totalContado.toFixed(2);
      }
    } else if (destVal === 'se_guarda_en_sobre') {
      const inpS = document.getElementById('val_importe_sobre');
      if (inpS && (!inpS.value || inpS.dataset.manual !== 'true')) {
        inpS.value = totalContado.toFixed(2);
      }
      const inpEnt = document.getElementById('val_importe_entregado');
      if (inpEnt) inpEnt.value = totalContado.toFixed(2);
    } else if (destVal === 'se_resguarda_otro') {
      const inpR = document.getElementById('val_importe_resguardo');
      if (inpR && (!inpR.value || inpR.dataset.manual !== 'true')) {
        inpR.value = totalContado.toFixed(2);
      }
      const inpEnt = document.getElementById('val_importe_entregado');
      if (inpEnt) inpEnt.value = totalContado.toFixed(2);
    }

    // Conciliación Caja Principal:
    // fCaja representa el fondo neto actual en caja física (ya descontadas las entregas realizadas)
    const today = (document.getElementById('header_fecha')?.value || getHidalgoDateStr());
    const entregasCorte = getEntregasDelCorte(today);
    const totalEntregadoCorte = entregasCorte.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);

    // En la tabla de conciliación, mostrar la base con la que inició el corte antes de las entregas
    const fondoInicialAntesEntregas = fCaja + totalEntregadoCorte;
    setDisplay('concil_fondo_inicial', fondoInicialAntesEntregas);
    setDisplay('concil_ingresos_efectivo', totEfec);
    setDisplay('concil_total_entregas', totalEntregadoCorte);
    setDisplay('concil_efectivo_contado', totalContado);

    const lblBadgeEnt = document.getElementById('lbl_concil_entregas_badge');
    if (lblBadgeEnt) {
      lblBadgeEnt.textContent = '(-) ' + entregasCorte.length + (entregasCorte.length === 1 ? ' entrega' : ' entregas');
    }

    const esperado = Math.max(0, fCaja + totEfec);
    setDisplay('concil_efectivo_esperado', esperado);

    const diferencia = totalContado - esperado;
    setDisplay('concil_diferencia_caja', diferencia);
    setDisplay('kpi-diferencia', diferencia);

    // Actualizar indicador superior de efectivo en caja
    const lblDisp = document.getElementById('lbl-fondo-disponible');
    if (lblDisp) {
      lblDisp.textContent = formatCurrency(esperado);
    }

    // Resultado automático badge y campo de explicación condicional
    const cardBadge = document.getElementById('card_res_cuadrada_badge');
    const kpiBadge = document.getElementById('kpi-status-badge');
    const difLabel = document.getElementById('concil_diferencia_label');
    const wrapExpl = document.getElementById('wrap_concil_explicacion');

    if (Math.abs(diferencia) < 0.005) {
      if (cardBadge) {
        cardBadge.className = 'kpi-status-badge badge-cuadrada';
        cardBadge.textContent = '✅ Caja cuadrada';
      }
      if (kpiBadge) {
        kpiBadge.textContent = 'Cuadrada';
        kpiBadge.className = 'kpi-status-badge badge-cuadrada';
      }
      if (difLabel) {
        difLabel.textContent = '✅ Caja cuadrada exacta';
        difLabel.style.color = 'var(--success)';
      }
      if (wrapExpl) wrapExpl.style.display = 'none';
    } else if (diferencia > 0.005) {
      if (cardBadge) {
        cardBadge.className = 'kpi-status-badge badge-sobrante';
        cardBadge.textContent = `🟡 Sobrante: ${formatCurrency(diferencia)}`;
      }
      if (kpiBadge) {
        kpiBadge.textContent = `Sobrante: ${formatCurrency(diferencia)}`;
        kpiBadge.className = 'kpi-status-badge badge-sobrante';
      }
      if (difLabel) {
        difLabel.textContent = `🟡 Sobrante de ${formatCurrency(diferencia)}`;
        difLabel.style.color = 'var(--warning)';
      }
      if (wrapExpl) wrapExpl.style.display = 'block';
    } else {
      const faltanteAbs = Math.abs(diferencia);
      if (cardBadge) {
        cardBadge.className = 'kpi-status-badge badge-faltante';
        cardBadge.textContent = `🔴 Faltante: ${formatCurrency(faltanteAbs)}`;
      }
      if (kpiBadge) {
        kpiBadge.textContent = `Faltante: ${formatCurrency(faltanteAbs)}`;
        kpiBadge.className = 'kpi-status-badge badge-faltante';
      }
      if (difLabel) {
        difLabel.textContent = `🔴 Faltante de ${formatCurrency(faltanteAbs)}`;
        difLabel.style.color = 'var(--danger)';
      }
      if (wrapExpl) wrapExpl.style.display = 'block';
    }

    // Control transferencias y pagos no en efectivo (Condicional a que existan ventas no-efectivo)
    const tReg = parseVal('ctrl_transf_reg');
    const tVer = parseVal('ctrl_transf_verif');
    setDisplay('ctrl_transf_dif', tVer - tReg);

    const jReg = parseVal('ctrl_tarj_reg');
    const jVer = parseVal('ctrl_tarj_verif');
    setDisplay('ctrl_tarj_dif', jVer - jReg);

    const oReg = parseVal('ctrl_otros_reg');
    const oVer = parseVal('ctrl_otros_verif');
    setDisplay('ctrl_otros_dif', oVer - oReg);

    const totReg = tReg + jReg + oReg;
    const totVer = tVer + jVer + oVer;
    setDisplay('ctrl_total_reg', totReg);
    setDisplay('ctrl_total_verif', totVer);
    setDisplay('ctrl_total_dif', totVer - totReg);

    // Condición solicitada: SOLO preguntar cuando en ventas del día se registre transferencia, tarjeta u otro
    const secControlPagos = document.getElementById('sec-control-pagos-no-efectivo');
    if (secControlPagos) {
      if (totReg > 0.005) {
        secControlPagos.style.display = 'block';
        const rowTransf = document.getElementById('row_ctrl_transf');
        if (rowTransf) rowTransf.style.display = tReg > 0.005 ? '' : 'none';

        const rowTarj = document.getElementById('row_ctrl_tarj');
        if (rowTarj) rowTarj.style.display = jReg > 0.005 ? '' : 'none';

        const rowOtros = document.getElementById('row_ctrl_otros');
        if (rowOtros) rowOtros.style.display = oReg > 0.005 ? '' : 'none';
      } else {
        secControlPagos.style.display = 'none';
      }
    }

    // 6. RESUMEN FINAL DEL DÍA
    setDisplay('resumen_total_ingresos', granTotalIngresos);
    setDisplay('resumen_total_efectivo', totalContado);
    setDisplay('resumen_total_transf', tVer);
    setDisplay('resumen_total_tarjetas', jVer + oVer);
    setDisplay('resumen_diferencia_caja', diferencia);

    // Ocultar transferencias si está en 0, mostrar si > 0
    const rowTransf = document.getElementById('row_resumen_transf');
    if (rowTransf) rowTransf.style.display = tVer > 0 ? '' : 'none';

    // Ocultar tarjetas/otros si está en 0, mostrar si > 0
    const rowTarj = document.getElementById('row_resumen_tarjetas');
    if (rowTarj) rowTarj.style.display = (jVer + oVer) > 0 ? '' : 'none';

    // Efectivo entregado: mostrar cantidad y a quién se entregó
    const entregasHoy = getEntregasDelDia(today);
    const totalEntregadoHoy = entregasHoy.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);

    setDisplay('resumen_total_retiros', totalEntregadoHoy);

    const detalleEl = document.getElementById('resumen_detalle_entregas');
    if (detalleEl) {
      if (entregasHoy.length === 0) {
        detalleEl.textContent = 'Sin entregas hoy';
      } else {
        const destinatarios = entregasHoy.map(e => `${e.recibe || 'Personal'} ($${(parseFloat(e.cantidad) || 0).toFixed(2)})`).join(', ');
        detalleEl.textContent = `Entregado a: ${destinatarios}`;
      }
    }

    // Hora de entrega de dinero: colocar la hora de la última entrega realizada hoy
    const horaEntregaInput = document.getElementById('val_hora_entrega');
    if (horaEntregaInput) {
      if (entregasHoy.length > 0) {
        const ultimaEntrega = entregasHoy[entregasHoy.length - 1];
        horaEntregaInput.value = ultimaEntrega?.hora || '';
      } else {
        horaEntregaInput.value = '';
      }
    }

    const respH = document.getElementById('header_responsable')?.value || '';
    const valN = document.getElementById('val_responsable_nombre');
    if (valN && (!valN.value || valN.dataset.synced === 'true')) {
      valN.value = respH;
      valN.dataset.synced = 'true';
    }
  }

  function serializePrincipal() {
    const today = (document.getElementById('header_fecha')?.value || getHidalgoDateStr());
    const allEntregas = Object.values(controlCajaData.entregas || {});
    const entregasHoy = allEntregas.filter(e => isEntregaFromDate(e, today));
    const totalEntregadoHoy = entregasHoy.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);
    const entregasCorte = getEntregasDelCorte(today);
    const totalEntregadoCorte = entregasCorte.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);
    const dif = parseVal('concil_diferencia_caja');
    const resArqueo = (Math.abs(dif) < 0.005) ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante');

    const destVal = document.getElementById('val_destino_efectivo')?.value || 'se_queda_en_caja';
    const contado = parseVal('conteo_total_efectivo');

    let montoQueda = 0;
    let folioSobre = null;
    let montoSobre = 0;
    let folioResguardo = null;
    let lugarResguardo = null;
    let montoResguardo = 0;
    let importeRetirado = 0;

    if (destVal === 'se_queda_en_caja') {
      montoQueda = parseVal('val_monto_queda_caja') || contado;
      importeRetirado = 0;
    } else if (destVal === 'se_guarda_en_sobre') {
      folioSobre = document.getElementById('val_folio_sobre')?.value.trim() || '';
      montoSobre = parseVal('val_importe_sobre') || contado;
      importeRetirado = montoSobre;
    } else if (destVal === 'se_resguarda_otro') {
      folioResguardo = document.getElementById('val_folio_resguardo')?.value.trim() || '';
      lugarResguardo = document.getElementById('val_lugar_resguardo')?.value.trim() || '';
      montoResguardo = parseVal('val_importe_resguardo') || contado;
      importeRetirado = montoResguardo;
    }

    const corteNum = currentCorteNum || 1;
    const corteId = 'corte_' + Date.now();
    const corteTimestamp = new Date().toISOString();

    return {
      corteId,
      corteNum,
      corteTimestamp,
      periodo: {
        desdeHora: currentCorteHoraInicio || '00:00',
        hastaHora: document.getElementById('header_hora')?.value || getHidalgoTimeStr()
      },
      ventasIds: (currentCorteVentas || []).map(v => v.id),
      destinoEfectivo: destVal,
      montoQuedaEnCaja: montoQueda,
      folioSobre,
      montoSobre,
      folioResguardo,
      lugarResguardo,
      montoResguardo,
      header: {
        fecha: document.getElementById('header_fecha')?.value || '',
        responsable: document.getElementById('header_responsable')?.value || '',
        hora: document.getElementById('header_hora')?.value || ''
      },
      fondoInicial: parseVal('f_inicial_caja'),
      ingresos: {
        servicios: { e: parseVal('ing_servicios_efec'), t: parseVal('ing_servicios_transf'), j: parseVal('ing_servicios_tarj') },
        cursos:    { e: parseVal('ing_cursos_efec'),    t: parseVal('ing_cursos_transf'),    j: parseVal('ing_cursos_tarj') },
        productos: { e: parseVal('ing_productos_efec'), t: parseVal('ing_productos_transf'), j: parseVal('ing_productos_tarj') },
        totales: {
          efectivo: parseVal('ing_total_efectivo'),
          transferencia: parseVal('ing_total_transf'),
          tarjeta: parseVal('ing_total_tarjeta'),
          granTotal: parseVal('ing_gran_total')
        },
        operaciones: document.getElementById('ing_operaciones_cobradas')?.value || ''
      },
      conteo: {
        total: contado,
        desglose: {
          b1000: parseInt(document.getElementById('billete_1000')?.value, 10) || 0,
          b500:  parseInt(document.getElementById('billete_500')?.value, 10) || 0,
          b200:  parseInt(document.getElementById('billete_200')?.value, 10) || 0,
          b100:  parseInt(document.getElementById('billete_100')?.value, 10) || 0,
          b50:   parseInt(document.getElementById('billete_50')?.value, 10) || 0,
          b20:   parseInt(document.getElementById('billete_20')?.value, 10) || 0,
          m10:   parseInt(document.getElementById('moneda_10')?.value, 10) || 0,
          m5:    parseInt(document.getElementById('moneda_5')?.value, 10) || 0,
          m2:    parseInt(document.getElementById('moneda_2')?.value, 10) || 0,
          m1:    parseInt(document.getElementById('moneda_1')?.value, 10) || 0,
          m050:  parseInt(document.getElementById('moneda_050')?.value, 10) || 0
        }
      },
      conciliacion: {
        fondo: parseVal('f_inicial_caja'),
        ingresosEfec: parseVal('ing_total_efectivo'),
        retiros: totalEntregadoCorte,
        esperado: parseVal('concil_efectivo_esperado'),
        contado: contado,
        diferencia: dif,
        resultado: resArqueo,
        explicacion: document.getElementById('concil_explicacion')?.value || ''
      },
      controlPagos: {
        transfReg: parseVal('ctrl_transf_reg'),
        transfVer: parseVal('ctrl_transf_verif'),
        tarjReg: parseVal('ctrl_tarj_reg'),
        tarjVer: parseVal('ctrl_tarj_verif'),
        otrosReg: parseVal('ctrl_otros_reg'),
        otrosVer: parseVal('ctrl_otros_verif')
      },
      resumen: {
        totalIngresos: parseVal('resumen_total_ingresos'),
        totalEfectivo: parseVal('resumen_total_efectivo'),
        totalTransf: parseVal('ctrl_transf_verif'),
        totalTarjetas: parseVal('ctrl_tarj_verif'),
        totalEntregado: totalEntregadoHoy,
        detalleEntregas: entregasHoy.map(e => e.recibe + ': $' + (parseFloat(e.cantidad)||0).toFixed(2)).join(', '),
        numServicios: document.getElementById('resumen_num_servicios')?.value || '',
        numCursos: document.getElementById('resumen_num_cursos')?.value || '',
        obsDia: document.getElementById('resumen_observaciones_dia')?.value || ''
      },
      resumenFinal: {
        totalIngresosDia: parseVal('resumen_total_ingresos'),
        totalEfectivoContado: parseVal('resumen_total_efectivo'),
        totalTransferencias: parseVal('ctrl_transf_verif'),
        totalTarjetas: parseVal('ctrl_tarj_verif'),
        totalEntregado: totalEntregadoHoy
      },
      validacion: {
        responsable: document.getElementById('val_responsable_nombre')?.value || '',
        horaCierre: document.getElementById('val_hora_cierre')?.value || '',
        horaEntrega: document.getElementById('val_hora_entrega')?.value || '',
        destinoEfectivo: destVal,
        folioSobre,
        folioResguardo,
        lugarResguardo: lugarResguardo || document.getElementById('val_efectivo_otro_lugar')?.value || '',
        importeEntregado: importeRetirado,
        signatureData: sigDataPrincipal && sigPadPrincipal ? sigPadPrincipal.toDataURL() : null,
        observaciones: document.getElementById('val_observaciones')?.value || ''
      }
    };
  }

  function clearPrincipalForm() {
    if (formPrincipal) formPrincipal.reset();
    if (sigCtxPrincipal && sigPadPrincipal) {
      sigCtxPrincipal.clearRect(0, 0, sigPadPrincipal.width, sigPadPrincipal.height);
      sigDataPrincipal = false;
    }
    const phP = document.getElementById('placeholder-firma-principal');
    const pvP = document.getElementById('preview-firma-principal');
    const imgP = document.getElementById('img-preview-firma-principal');
    if (phP) phP.style.display = 'flex';
    if (pvP) pvP.style.display = 'none';
    if (imgP) imgP.src = '';
    const dStr = getHidalgoDateStr();
    const hm = getHidalgoTimeStr();
    const userEmail = TB_FIREBASE.getCurrentUser()?.email || '';

    if (document.getElementById('header_responsable')) document.getElementById('header_responsable').value = userEmail;
    if (document.getElementById('val_responsable_nombre')) document.getElementById('val_responsable_nombre').value = userEmail;
    if (document.getElementById('header_fecha')) document.getElementById('header_fecha').value = dStr;
    if (document.getElementById('header_hora')) document.getElementById('header_hora').value = hm;
    if (document.getElementById('val_hora_cierre')) document.getElementById('val_hora_cierre').value = hm;
    if (document.getElementById('val_hora_entrega')) document.getElementById('val_hora_entrega').value = '';
    if (document.getElementById('wrap_efectivo_otro_lugar')) document.getElementById('wrap_efectivo_otro_lugar').style.display = 'none';

    // 1. Limpiar campo y estado del conteo de efectivo físico
    const conteoEl = document.getElementById('conteo_total_efectivo');
    if (conteoEl) {
      conteoEl.value = '';
      conteoEl.dataset.manual = 'false';
    }
    const hintConteo = document.getElementById('hint-conteo-estado');
    if (hintConteo) {
      hintConteo.textContent = 'Pendiente de captura';
      hintConteo.style.color = 'var(--primary)';
    }

    // 2. Limpiar denominaciones de billetes y monedas
    ['billete_1000', 'billete_500', 'billete_200', 'billete_100', 'billete_50', 'billete_20',
     'moneda_10', 'moneda_5', 'moneda_2', 'moneda_1', 'moneda_050'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '0';
    });
    ['sub_1000', 'sub_500', 'sub_200', 'sub_100', 'sub_50', 'sub_20',
     'sub_10', 'sub_5', 'sub_2', 'sub_1', 'sub_050',
     'conteo_total_monedas', 'conteo_total_billetes', 'conteo_gran_total'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '$0.00';
    });

    // 3. Limpiar control de pagos verificados
    ['ctrl_transf_verif', 'ctrl_tarj_verif', 'ctrl_otros_verif'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '0.00';
    });
    ['ctrl_transf_dif', 'ctrl_tarj_dif', 'ctrl_otros_dif', 'ctrl_total_verif', 'ctrl_total_dif'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '0.00';
    });

    // 4. Limpiar aclaraciones y notas
    const explEl = document.getElementById('concil_explicacion');
    if (explEl) explEl.value = '';
    const wrapExpl = document.getElementById('wrap_concil_explicacion');
    if (wrapExpl) wrapExpl.style.display = 'none';

    const obsEl = document.getElementById('val_observaciones');
    if (obsEl) obsEl.value = '';

    // 5. Resetear destino de efectivo a opción 1 ("Se queda en caja")
    const selDest = document.getElementById('val_destino_efectivo');
    if (selDest) selDest.value = 'se_queda_en_caja';
    const wrapQ = document.getElementById('wrap_destino_queda_caja');
    const wrapS = document.getElementById('wrap_destino_guarda_sobre');
    const wrapR = document.getElementById('wrap_destino_resguarda_otro');
    if (wrapQ) wrapQ.style.display = 'block';
    if (wrapS) wrapS.style.display = 'none';
    if (wrapR) wrapR.style.display = 'none';

    ['val_monto_queda_caja', 'val_importe_sobre', 'val_importe_resguardo', 'val_importe_entregado'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = '0.00'; el.dataset.manual = 'false'; }
    });

    ['val_folio_sobre', 'val_folio_resguardo', 'val_lugar_resguardo', 'val_efectivo_otro_lugar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.dataset.autoFolio = 'false'; }
    });

    // 6. Resetear badges y etiquetas de estado de conciliación
    const cardBadge = document.getElementById('card_res_cuadrada_badge');
    if (cardBadge) {
      cardBadge.className = 'kpi-status-badge badge-cuadrada';
      cardBadge.textContent = 'Pendiente de conteo';
    }
    const kpiBadge = document.getElementById('kpi-status-badge');
    if (kpiBadge) {
      kpiBadge.textContent = 'Pendiente';
      kpiBadge.className = 'kpi-status-badge';
    }
    const difLabel = document.getElementById('concil_diferencia_label');
    if (difLabel) {
      difLabel.textContent = 'Sin diferencia';
      difLabel.style.color = 'var(--muted)';
    }

    loadControlCajaData();
    loadCajaChicaFundData();
    recalculatePrincipal();
  }

  // Poblar reporte oficial de Caja Principal (1 Sola Hoja Fácil de Leer)
  function populatePrincipalPrintable(data) {
    if (!data) return '';
    const header = data.header || {};
    const ingresos = data.ingresos || {};
    const conteo = data.conteo || {};
    const concil = data.conciliacion || {};
    const ctrl = data.controlPagos || {};
    const res = data.resumen || data.resumenFinal || {};
    const val = data.validacion || {};

    const rawF = header.fecha || data.fecha || '';
    const rawR = header.responsable || val.responsable || data.responsable || 'Responsable';
    const rawH = header.hora || '';

    const setEl = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    // Encabezado
    setEl('p_fecha', rawF || '__ / __ / ____');
    setEl('p_responsable', rawR || '________________');
    setEl('p_hora', rawH || '____');

    // Número de corte y período
    const corteNum = data.corteNum || 1;
    const perDesde = data.periodo?.desdeHora || '00:00';
    const perHasta = data.periodo?.hastaHora || rawH || '';
    setEl('p_corte_num', 'Corte #' + corteNum + ' (' + perDesde + ' - ' + perHasta + ')');

    // 1. Fondo Inicial y Conciliación
    const fondo = parseFloat(data.fondoInicial !== undefined ? data.fondoInicial : concil.fondo) || 0;
    setEl('p_f_caja', formatCurrency(fondo));
    setEl('p_concil_fondo', formatCurrency(fondo));

    // 2. Ingresos del Día
    const srv = ingresos.servicios || {};
    const cur = ingresos.cursos || {};
    const prd = ingresos.productos || {};

    const srvE = parseFloat(srv.e) || 0, srvT = parseFloat(srv.t) || 0, srvJ = parseFloat(srv.j) || 0;
    const curE = parseFloat(cur.e) || 0, curT = parseFloat(cur.t) || 0, curJ = parseFloat(cur.j) || 0;
    const prdE = parseFloat(prd.e) || 0, prdT = parseFloat(prd.t) || 0, prdJ = parseFloat(prd.j) || 0;

    const totEfec = ingresos.totales?.efectivo !== undefined ? parseFloat(ingresos.totales.efectivo) : (srvE + curE + prdE);
    const totTransf = ingresos.totales?.transferencia !== undefined ? parseFloat(ingresos.totales.transferencia) : (srvT + curT + prdT);
    const totTarj = ingresos.totales?.tarjeta !== undefined ? parseFloat(ingresos.totales.tarjeta) : (srvJ + curJ + prdJ);
    const granTot = ingresos.totales?.granTotal !== undefined ? parseFloat(ingresos.totales.granTotal) : (totEfec + totTransf + totTarj);

    setEl('p_ing_tot_e', formatCurrency(totEfec));
    setEl('p_ing_tot_t', formatCurrency(totTransf));
    setEl('p_ing_tot_j', formatCurrency(totTarj));
    setEl('p_ing_tot_gran', formatCurrency(granTot));
    setEl('p_operaciones', ingresos.operaciones || '0');

    setEl('p_srv_tot_pdf', formatCurrency(srvE + srvT + srvJ));
    setEl('p_cur_tot_pdf', formatCurrency(curE + curT + curJ));
    setEl('p_prd_tot_pdf', formatCurrency(prdE + prdT + prdJ));

    // Conteo y Conciliación
    const totContado = parseFloat(conteo.total !== undefined ? conteo.total : concil.contado) || 0;
    const ingEfec = parseFloat(concil.ingresosEfec !== undefined ? concil.ingresosEfec : totEfec) || 0;
    const totEntregado = parseFloat(res.totalEntregado !== undefined ? res.totalEntregado : (val.importeEntregado || concil.retiros || 0)) || 0;
    const esperado = parseFloat(concil.esperado !== undefined ? concil.esperado : (fondo + ingEfec)) || 0;
    const dif = parseFloat(concil.diferencia !== undefined ? concil.diferencia : (totContado - esperado)) || 0;

    setEl('p_concil_ingresos', formatCurrency(ingEfec));
    setEl('p_res_retiros', formatCurrency(totEntregado));
    setEl('p_concil_esperado', formatCurrency(esperado));
    setEl('p_concil_contado', formatCurrency(totContado));
    setEl('p_concil_diferencia', formatCurrency(dif));

    const resArqueo = concil.resultado || (Math.abs(dif) < 0.005 ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante'));
    const badgeStatusPdf = document.getElementById('p_badge_status_pdf');
    if (badgeStatusPdf) {
      if (resArqueo === 'cuadrada') {
        badgeStatusPdf.textContent = '✅ CAJA CUADRADA';
        badgeStatusPdf.style.background = '#f0fdf4';
        badgeStatusPdf.style.borderColor = '#16a34a';
        badgeStatusPdf.style.color = '#15803d';
      } else if (resArqueo === 'sobrante') {
        badgeStatusPdf.textContent = '🟡 SOBRANTE: ' + formatCurrency(dif);
        badgeStatusPdf.style.background = '#fffbeb';
        badgeStatusPdf.style.borderColor = '#f59e0b';
        badgeStatusPdf.style.color = '#b45309';
      } else {
        badgeStatusPdf.textContent = '🔴 FALTANTE: ' + formatCurrency(Math.abs(dif));
        badgeStatusPdf.style.background = '#fef2f2';
        badgeStatusPdf.style.borderColor = '#ef4444';
        badgeStatusPdf.style.color = '#b91c1c';
      }
    }

    setEl('p_dif_badge_cell', resArqueo === 'cuadrada' ? '✅ Exacto' : (resArqueo === 'sobrante' ? '🟡 Sobrante' : '🔴 Faltante'));

    const wrapExpl = document.getElementById('p_wrap_explicacion_pdf');
    if (wrapExpl) {
      wrapExpl.style.display = (resArqueo !== 'cuadrada' && concil.explicacion?.trim()) ? 'block' : 'none';
    }
    setEl('p_explicacion', concil.explicacion?.trim() || 'Sin explicación registrada.');

    // Control de Transferencias y Tarjetas
    const tReg = parseFloat(ctrl.transfReg !== undefined ? ctrl.transfReg : totTransf) || 0;
    const tVer = parseFloat(ctrl.transfVer !== undefined ? ctrl.transfVer : res.totalTransf || res.totalTransferencias || totTransf) || 0;
    const jReg = parseFloat(ctrl.tarjReg !== undefined ? ctrl.tarjReg : totTarj) || 0;
    const jVer = parseFloat(ctrl.tarjVer !== undefined ? ctrl.tarjVer : res.totalTarjetas || totTarj) || 0;

    setEl('p_ctrl_transf_reg', formatCurrency(tReg));
    setEl('p_ctrl_transf_ver', formatCurrency(tVer));
    setEl('p_ctrl_transf_dif', formatCurrency(tVer - tReg));

    setEl('p_ctrl_tarj_reg', formatCurrency(jReg));
    setEl('p_ctrl_tarj_ver', formatCurrency(jVer));
    setEl('p_ctrl_tarj_dif', formatCurrency(jVer - jReg));

    const totRegCtrl = tReg + jReg;
    const secCtrlPdf = document.getElementById('pdf_sec_control_pagos');
    if (secCtrlPdf) {
      secCtrlPdf.style.display = (totRegCtrl > 0.005) ? 'block' : 'none';
    }

    // Observaciones y Destino del Efectivo
    const valResp = val.responsable || rawR || '';
    setEl('p_val_nombre', valResp);

    const fImg = document.getElementById('p_val_firma_img');
    const fBlank = document.getElementById('p_val_firma_blank');
    if (val.signatureData) {
      if (fImg) {
        fImg.src = val.signatureData;
        fImg.style.display = 'block';
      }
      if (fBlank) fBlank.style.display = 'none';
    } else {
      if (fImg) fImg.style.display = 'none';
      if (fBlank) fBlank.style.display = 'inline-block';
    }

    const dest = data.destinoEfectivo || val.destinoEfectivo || 'se_queda_en_caja';
    let destTexto = '1.- Se queda en caja (Fondo base)';
    let folioTexto = '--';
    let showFolio = false;
    let showQueda = false;
    let estatusTexto = 'Permanece en caja física y pasa como Fondo Inicial al siguiente corte';

    const quedaMonto = parseFloat(data.montoQuedaEnCaja || totContado) || 0;
    const sobreMonto = parseFloat(data.montoSobre || val.importeEntregado || totContado) || 0;
    const resgMonto = parseFloat(data.montoResguardo || val.importeEntregado || totContado) || 0;

    if (dest === 'se_guarda_en_sobre') {
      destTexto = '2.- Se guarda en sobre cerrado';
      folioTexto = data.folioSobre || val.folioSobre || 'Sin folio';
      showFolio = true;
      showQueda = false;
      estatusTexto = 'Retirado en sobre con folio oficial &bull; DEBIDAMENTE REGISTRADO (NO considerado faltante)';
      setEl('p_val_importe_entregado', formatCurrency(sobreMonto));
    } else if (dest === 'se_resguarda_otro') {
      const lug = data.lugarResguardo || val.lugarResguardo || 'Otro lugar';
      destTexto = '3.- Se resguarda en ' + lug;
      folioTexto = data.folioResguardo || val.folioResguardo || 'Sin folio';
      showFolio = true;
      showQueda = false;
      estatusTexto = 'Resguardado en ' + lug + ' con folio oficial &bull; DEBIDAMENTE REGISTRADO (NO considerado faltante)';
      setEl('p_val_importe_entregado', formatCurrency(resgMonto));
    } else {
      destTexto = '1.- Se queda en caja (Fondo base)';
      showFolio = false;
      showQueda = true;
      estatusTexto = 'Permanece en caja física &bull; Pasa como Fondo Inicial al corte siguiente';
      setEl('p_val_importe_queda', formatCurrency(quedaMonto));
    }

    setEl('p_val_entregado_a', destTexto);
    setEl('p_val_folio_oficial', folioTexto);

    const wrapFolio = document.getElementById('pdf_wrap_folio_row');
    if (wrapFolio) wrapFolio.style.display = showFolio ? 'block' : 'none';
    const wrapQueda = document.getElementById('pdf_wrap_queda_row');
    if (wrapQueda) wrapQueda.style.display = showQueda ? 'block' : 'none';

    const elEst = document.getElementById('p_val_estatus_cierre');
    if (elEst) elEst.innerHTML = estatusTexto;

    setEl('p_val_observaciones', val.observaciones?.trim() || res.obsDia?.trim() || 'Sin observaciones.');

    const cln = valResp.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim().replace(/\s+/g, '_');
    return 'Arqueo_Caja_Principal_Corte' + corteNum + '_' + (rawF || 'Fecha') + '_' + (cln || 'Responsable') + '.pdf';
  }

  function syncPrincipalPrintable() {
    recalculatePrincipal();
    const liveData = serializePrincipal();
    return populatePrincipalPrintable(liveData);
  }

  // =========================================================================
  // 3. LÓGICA DE CAJA CHICA Y CONTROL DE FONDO INICIAL MENSUAL
  // =========================================================================
  let cajaChicaFundData = { fondoBase: 0, salidasMes: 0, fondoDisponible: 0 };

  async function loadCajaChicaFundData() {
    try {
      const cfg = await TB_FIREBASE.getCajaChicaConfig();
      const fondoBase = parseFloat(cfg?.fondoBase || 0) || 0;

      // Obtener todos los arqueos de caja chica guardados
      const arqueosObj = await TB_FIREBASE.getArqueosChicaList();
      const arqueosList = Object.values(arqueosObj || {});

      // Determinar mes en curso (YYYY-MM)
      const curFecha = document.getElementById('chica_fecha')?.value || getHidalgoDateStr();
      const currentMonth = curFecha.slice(0, 7); // ej. "2026-10"

      // Sumar salidas de arqueos de este mes
      const arqueosMes = arqueosList.filter(a => {
        const f = a.header?.fecha || '';
        return f.startsWith(currentMonth);
      });

      const totalSalidasMes = arqueosMes.reduce((acc, a) => {
        return acc + (parseFloat(a.totalSalidas || a.conciliacion?.salidas || 0) || 0);
      }, 0);

      const fondoDisponible = Math.max(0, fondoBase - totalSalidasMes);

      cajaChicaFundData = {
        fondoBase,
        salidasMes: totalSalidasMes,
        fondoDisponible
      };

      // Actualizar labels en vista Caja Chica
      const lblBase = document.getElementById('lbl-chica-base');
      const lblDesc = document.getElementById('lbl-chica-descuentos');
      const fInput = document.getElementById('chica_fondo_inicial');

      if (lblBase) lblBase.textContent = formatCurrency(fondoBase);
      if (lblDesc) lblDesc.textContent = totalSalidasMes > 0 ? `-${formatCurrency(totalSalidasMes)}` : '$0.00';
      if (fInput) fInput.value = fondoDisponible.toFixed(2);

      // Actualizar en Configuración si está abierto
      renderConfigCajaChicaValues(fondoBase, totalSalidasMes, fondoDisponible);

      recalculateChica();
    } catch (e) {
      console.warn('Error en loadCajaChicaFundData:', e);
    }
  }

  function renderConfigCajaChicaValues(base, salidas, disp) {
    const inp = document.getElementById('cfg_chica_fondo_base');
    const lBase = document.getElementById('cfg_lbl_chica_base');
    const lSal = document.getElementById('cfg_lbl_chica_salidas');
    const lDisp = document.getElementById('cfg_lbl_chica_disponible');

    if (inp && (!inp.value || inp.dataset.loaded !== 'true')) {
      inp.value = base > 0 ? base.toFixed(2) : '';
      inp.dataset.loaded = 'true';
    }
    if (lBase) lBase.textContent = formatCurrency(base);
    if (lSal) lSal.textContent = salidas > 0 ? `-${formatCurrency(salidas)}` : '$0.00';
    if (lDisp) lDisp.textContent = formatCurrency(disp);
  }

  function recalculateChica() {
    const fChica = parseVal('chica_fondo_inicial');
    setDisplay('kpi-chica-fondo', fChica);
    setDisplay('pc_fondo_inicial', fChica);
    setDisplay('chica_concil_fondo', fChica);

    // Salidas
    let totSal = 0;
    document.querySelectorAll('.chica-salida-row').forEach(r => {
      totSal += parseFloat(r.querySelector('.chica-importe')?.value) || 0;
    });
    setDisplay('chica_total_salidas', totSal);
    setDisplay('kpi-chica-salidas', totSal);
    setDisplay('chica_concil_salidas', totSal);

    // Conteo físico chica
    const denoms = [
      { id: 'chica_b_1000', subId: 'chica_sub_1000', val: 1000 },
      { id: 'chica_b_500',  subId: 'chica_sub_500',  val: 500 },
      { id: 'chica_b_200',  subId: 'chica_sub_200',  val: 200 },
      { id: 'chica_b_100',  subId: 'chica_sub_100',  val: 100 },
      { id: 'chica_b_50',   subId: 'chica_sub_50',   val: 50 },
      { id: 'chica_b_20',   subId: 'chica_sub_20',   val: 20 },
      { id: 'chica_m_10',   subId: 'chica_sub_10',   val: 10 },
      { id: 'chica_m_5',    subId: 'chica_sub_5',    val: 5 },
      { id: 'chica_m_2',    subId: 'chica_sub_2',    val: 2 },
      { id: 'chica_m_1',    subId: 'chica_sub_1',    val: 1 },
      { id: 'chica_m_050',  subId: 'chica_sub_050',  val: 0.50 }
    ];

    let totalContado = 0;
    denoms.forEach(item => {
      const q = parseInt(document.getElementById(item.id)?.value, 10) || 0;
      const sub = q * item.val;
      totalContado += sub;
      const subEl = document.getElementById(item.subId);
      if (subEl) subEl.textContent = formatCurrency(sub);
    });

    setDisplay('chica_total_contado', totalContado);
    setDisplay('kpi-chica-contado', totalContado);
    setDisplay('chica_concil_contado', totalContado);

    // Conciliación Caja Chica:
    // Efectivo esperado = Fondo inicial - Salidas autorizadas
    const esperado = fChica - totSal;
    setDisplay('chica_concil_esperado', esperado);

    const dif = totalContado - esperado;
    setDisplay('chica_concil_diferencia', dif);
    setDisplay('kpi-chica-diferencia', dif);

    // Actualizar tarjetas de resumen visual instantáneo de Caja Chica
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setTxt('lbl-chica-sum-fondo', formatCurrency(fChica));
    setTxt('lbl-chica-sum-salidas', totSal > 0 ? `-${formatCurrency(totSal)}` : '$0.00');
    setTxt('lbl-chica-sum-esperado', formatCurrency(esperado));
    setTxt('lbl-chica-sum-contado', formatCurrency(totalContado));
    
    const sumDifEl = document.getElementById('lbl-chica-sum-diferencia');
    if (sumDifEl) {
      if (Math.abs(dif) < 0.005) {
        sumDifEl.style.color = '#15803d';
        sumDifEl.textContent = '$0.00 (Cuadrada)';
      } else if (dif > 0) {
        sumDifEl.style.color = '#d97706';
        sumDifEl.textContent = `+${formatCurrency(dif)} (Sobrante)`;
      } else {
        sumDifEl.style.color = '#dc2626';
        sumDifEl.textContent = `-${formatCurrency(Math.abs(dif))} (Faltante)`;
      }
    }

    // Badges automáticos no modificables y explicación condicional
    const cardBadge = document.getElementById('card_chica_cuadrada_badge');
    const kBadge = document.getElementById('kpi-chica-status-badge');
    const dLabel = document.getElementById('chica_diferencia_label');
    const wrapExpl = document.getElementById('wrap_chica_explicacion');

    if (Math.abs(dif) < 0.005) {
      if (cardBadge) {
        cardBadge.className = 'kpi-status-badge badge-cuadrada';
        cardBadge.textContent = '✅ Caja cuadrada';
      }
      if (kBadge) {
        kBadge.textContent = 'Cuadrada';
        kBadge.className = 'kpi-status-badge badge-cuadrada';
      }
      if (dLabel) {
        dLabel.textContent = '✅ Caja cuadrada exacta';
        dLabel.style.color = 'var(--success)';
      }
      if (wrapExpl) wrapExpl.style.display = 'none';
    } else if (dif > 0.005) {
      if (cardBadge) {
        cardBadge.className = 'kpi-status-badge badge-sobrante';
        cardBadge.textContent = `🟡 Sobrante: ${formatCurrency(dif)}`;
      }
      if (kBadge) {
        kBadge.textContent = `Sobrante: ${formatCurrency(dif)}`;
        kBadge.className = 'kpi-status-badge badge-sobrante';
      }
      if (dLabel) {
        dLabel.textContent = `🟡 Sobrante de ${formatCurrency(dif)}`;
        dLabel.style.color = 'var(--warning)';
      }
      if (wrapExpl) wrapExpl.style.display = 'block';
    } else {
      const faltanteAbs = Math.abs(dif);
      if (cardBadge) {
        cardBadge.className = 'kpi-status-badge badge-faltante';
        cardBadge.textContent = `🔴 Faltante: ${formatCurrency(faltanteAbs)}`;
      }
      if (kBadge) {
        kBadge.textContent = `Faltante: ${formatCurrency(faltanteAbs)}`;
        kBadge.className = 'kpi-status-badge badge-faltante';
      }
      if (dLabel) {
        dLabel.textContent = `🔴 Faltante de ${formatCurrency(faltanteAbs)}`;
        dLabel.style.color = 'var(--danger)';
      }
      if (wrapExpl) wrapExpl.style.display = 'block';
    }

    const userEmail = TB_FIREBASE.getCurrentUser()?.email || '';
    const respChica = document.getElementById('chica_responsable');
    const valNC = document.getElementById('chica_val_nombre');
    if (respChica) respChica.value = userEmail;
    if (valNC) valNC.value = userEmail;
  }

  
  function addOrFillChicaExpense(concept) {
    if (!concept) return;
    const tbody = document.getElementById('tbody-chica-salidas');
    if (!tbody) return;

    const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Encargada';
    const rows = tbody.querySelectorAll('.chica-salida-row');
    let targetRow = null;

    if (rows.length === 1) {
      const firstRow = rows[0];
      const cVal = (firstRow.querySelector('.chica-concepto')?.value || '').trim();
      const iVal = parseFloat(firstRow.querySelector('.chica-importe')?.value) || 0;
      if (!cVal && iVal === 0) {
        targetRow = firstRow;
      }
    }

    if (!targetRow) {
      const tr = document.createElement('tr');
      tr.className = 'chica-salida-row';
      tr.innerHTML = `
        <td><input type="text" class="input-text chica-concepto" placeholder="Ej. Materiales, insumos..."></td>
        <td><input type="text" class="input-text chica-motivo" placeholder="Para qué se utilizó..."></td>
        <td><input type="text" class="input-text chica-autorizo" placeholder="Persona que autorizó..."></td>
        <td>
          <div class="currency-input-wrap"><span class="currency-prefix">$</span>
            <input type="number" step="0.01" min="0" class="input-currency chica-calc-trigger chica-importe" value="0.00" onfocus="this.select()">
          </div>
        </td>
        <td class="text-center">
          <input type="file" accept="image/*" class="chica-file-input" style="display:none;">
          <button type="button" class="btn btn-secondary btn-sm btn-subir-evidencia" style="padding:6px 10px; font-size:0.75rem; border-radius:6px; white-space:nowrap;">📷 Ticket</button>
          <div class="chica-preview-wrap" style="display:none; margin-top:4px;">
            <img class="chica-thumb-img btn-thumb-foto" src="" style="width:36px; height:36px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer;" title="Clic para ampliar ticket">
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-row" title="Eliminar fila" style="padding:4px 8px;">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
      targetRow = tr;
    }

    const cInput = targetRow.querySelector('.chica-concepto');
    const mInput = targetRow.querySelector('.chica-motivo');
    const aInput = targetRow.querySelector('.chica-autorizo');
    const iInput = targetRow.querySelector('.chica-importe');

    if (cInput) cInput.value = concept;
    if (mInput && !mInput.value) mInput.value = concept;
    if (aInput && !aInput.value) aInput.value = userEmail;

    if (iInput) {
      iInput.focus();
      iInput.select();
    }
    recalculateChica();
    showToast(`Concepto "${concept}" agregado. Ingrese el importe.`, 'info');
  }

  function serializeChica() {
    const salidas = [];
    document.querySelectorAll('.chica-salida-row').forEach(r => {
      salidas.push({
        concepto: r.querySelector('.chica-concepto')?.value || '',
        motivo: r.querySelector('.chica-motivo')?.value || '',
        autorizo: r.querySelector('.chica-autorizo')?.value || '',
        importe: parseFloat(r.querySelector('.chica-importe')?.value) || 0,
        evidencia: r.dataset.evidenciaBase64 || ''
      });
    });

    const dif = parseVal('chica_concil_diferencia');
    const resArqueo = (Math.abs(dif) < 0.005) ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante');

    return {
      header: {
        fecha: document.getElementById('chica_fecha')?.value || '',
        responsable: document.getElementById('chica_responsable')?.value || '',
        hora: document.getElementById('chica_hora')?.value || ''
      },
      fondoInicial: parseVal('chica_fondo_inicial'),
      salidas: salidas,
      totalSalidas: parseVal('chica_total_salidas'),
      conteoTotal: parseVal('chica_total_contado'),
      conteoDesglose: {
        b1000: parseInt(document.getElementById('chica_b_1000')?.value, 10) || 0,
        b500:  parseInt(document.getElementById('chica_b_500')?.value, 10) || 0,
        b200:  parseInt(document.getElementById('chica_b_200')?.value, 10) || 0,
        b100:  parseInt(document.getElementById('chica_b_100')?.value, 10) || 0,
        b50:   parseInt(document.getElementById('chica_b_50')?.value, 10) || 0,
        b20:   parseInt(document.getElementById('chica_b_20')?.value, 10) || 0,
        m10:   parseInt(document.getElementById('chica_m_10')?.value, 10) || 0,
        m5:    parseInt(document.getElementById('chica_m_5')?.value, 10) || 0,
        m2:    parseInt(document.getElementById('chica_m_2')?.value, 10) || 0,
        m1:    parseInt(document.getElementById('chica_m_1')?.value, 10) || 0,
        m050:  parseInt(document.getElementById('chica_m_050')?.value, 10) || 0
      },
      conciliacion: {
        fondo: parseVal('chica_fondo_inicial'),
        salidas: parseVal('chica_total_salidas'),
        esperado: parseVal('chica_concil_esperado'),
        contado: parseVal('chica_total_contado'),
        diferencia: dif,
        resultado: resArqueo,
        explicacion: document.getElementById('chica_explicacion')?.value || ''
      },
      validacion: {
        responsable: document.getElementById('chica_val_nombre')?.value || '',
        signatureData: sigDataChica && sigPadChica ? sigPadChica.toDataURL() : null
      }
    };
  }

  function clearChicaForm() {
    formChica.reset();
    if (sigCtxChica && sigPadChica) {
      sigCtxChica.clearRect(0, 0, sigPadChica.width, sigPadChica.height);
      sigDataChica = false;
    }
    const phC = document.getElementById('placeholder-firma-chica');
    const pvC = document.getElementById('preview-firma-chica');
    const imgC = document.getElementById('img-preview-firma-chica');
    if (phC) phC.style.display = 'flex';
    if (pvC) pvC.style.display = 'none';
    if (imgC) imgC.src = '';
    const dStr = getHidalgoDateStr();
    const hm = getHidalgoTimeStr();
    const userEmail = TB_FIREBASE.getCurrentUser()?.email || '';

    if (document.getElementById('chica_fecha')) document.getElementById('chica_fecha').value = dStr;
    if (document.getElementById('chica_hora')) document.getElementById('chica_hora').value = hm;
    if (document.getElementById('chica_responsable')) document.getElementById('chica_responsable').value = userEmail;
    if (document.getElementById('chica_val_nombre')) document.getElementById('chica_val_nombre').value = userEmail;

    // Reiniciar tabla de salidas a una fila limpia
    const tbody = document.getElementById('tbody-chica-salidas');
    if (tbody) {
      tbody.innerHTML = `
        <tr class="chica-salida-row">
          <td><input type="text" class="input-text chica-concepto" placeholder="Ej. Materiales, insumos..."></td>
          <td><input type="text" class="input-text chica-motivo" placeholder="Para qué se utilizó..."></td>
          <td><input type="text" class="input-text chica-autorizo" placeholder="Persona que autorizó..."></td>
          <td>
            <div class="currency-input-wrap"><span class="currency-prefix">$</span>
              <input type="number" step="0.01" min="0" class="input-currency chica-calc-trigger chica-importe" value="0.00">
            </div>
          </td>
          <td class="text-center">
            <input type="file" accept="image/*" class="chica-file-input" style="display:none;">
            <button type="button" class="btn btn-secondary btn-sm btn-subir-evidencia" style="padding:4px 8px; font-size:0.75rem;">📷 Ticket</button>
            <div class="chica-preview-wrap" style="display:none; margin-top:3px;">
              <img class="chica-thumb-img btn-thumb-foto" src="" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer;" title="Clic para ampliar ticket">
            </div>
          </td>
          <td class="text-center">
            <button type="button" class="btn btn-outline-danger btn-sm btn-del-row" title="Eliminar fila">✕</button>
          </td>
        </tr>
      `;
    }

    loadCajaChicaFundData();
  }

  // Poblar de forma defensiva el reporte oficial de Caja Chica
  function populateChicaPrintable(data) {
    if (!data) return '';
    const header = data.header || {};
    const concil = data.conciliacion || {};
    const val = data.validacion || {};

    const rawF = header.fecha || data.fecha || '';
    const rawR = header.responsable || val.responsable || data.responsable || 'Responsable';
    const rawH = header.hora || '';

    const setEl = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setEl('pc_fecha', rawF || '__ / __ / ____');
    setEl('pc_responsable', rawR || '________________');
    setEl('pc_hora', rawH || '____');

    // 1. Fondo Inicial
    const fondo = parseFloat(data.fondoInicial !== undefined ? data.fondoInicial : concil.fondo) || 0;
    setEl('pc_fondo_inicial', formatCurrency(fondo));

    // 2. Salidas
    const pcTbody = document.getElementById('pc_tbody_salidas');
    let sumSalidas = 0;
    if (pcTbody) {
      pcTbody.innerHTML = '';
      const salidasArr = Array.isArray(data.salidas) ? data.salidas : (data.salidas ? Object.values(data.salidas) : []);
      if (salidasArr.length === 0) {
        pcTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#9ca3af; padding:8px;">Sin salidas de efectivo registradas</td></tr>';
      } else {
        salidasArr.forEach(s => {
          const imp = parseFloat(s.importe) || 0;
          sumSalidas += imp;
          const tr = document.createElement('tr');
          const hasEv = Boolean(s.evidencia);
          tr.innerHTML = `
            <td>${s.concepto || ''}</td>
            <td>${s.motivo || ''}</td>
            <td>${s.autorizo || ''}</td>
            <td class="amount">${formatCurrency(imp)}</td>
            <td style="text-align:center;">
              ${hasEv ? `<span class="btn-preview-ticket" data-evidencia="${s.evidencia}" style="cursor:pointer; color:#0284c7; text-decoration:underline; font-weight:700;">📎 Ver Ticket</span>` : '--'}
            </td>
          `;
          pcTbody.appendChild(tr);
        });
      }
    }
    const totSalidas = parseFloat(data.totalSalidas !== undefined ? data.totalSalidas : (concil.salidas !== undefined ? concil.salidas : sumSalidas)) || 0;
    setEl('pc_total_salidas', formatCurrency(totSalidas));

    // 3. Conteo Físico Caja Chica
    const denoms = [
      { key: 'b1000', qId: 'pc_b_1000_q', tId: 'pc_b_1000_tot', val: 1000 },
      { key: 'b500',  qId: 'pc_b_500_q',  tId: 'pc_b_500_tot',  val: 500 },
      { key: 'b200',  qId: 'pc_b_200_q',  tId: 'pc_b_200_tot',  val: 200 },
      { key: 'b100',  qId: 'pc_b_100_q',  tId: 'pc_b_100_tot',  val: 100 },
      { key: 'b50',   qId: 'pc_b_50_q',   tId: 'pc_b_50_tot',   val: 50 },
      { key: 'b20',   qId: 'pc_b_20_q',   tId: 'pc_b_20_tot',   val: 20 },
      { key: 'm10',   qId: 'pc_m_10_q',   tId: 'pc_m_10_tot',   val: 10 },
      { key: 'm5',    qId: 'pc_m_5_q',    tId: 'pc_m_5_tot',    val: 5 },
      { key: 'm2',    qId: 'pc_m_2_q',    tId: 'pc_m_2_tot',    val: 2 },
      { key: 'm1',    qId: 'pc_m_1_q',    tId: 'pc_m_1_tot',    val: 1 },
      { key: 'm050',  qId: 'pc_m_050_q',  tId: 'pc_m_050_tot',  val: 0.50 }
    ];

    const desglose = data.conteoDesglose || {};
    const hasDesglose = Boolean(data.conteoDesglose);
    let conteoCalc = 0;

    denoms.forEach(d => {
      const q = hasDesglose ? (parseInt(desglose[d.key], 10) || 0) : 0;
      const sub = q * d.val;
      if (hasDesglose) conteoCalc += sub;
      setEl(d.qId, hasDesglose ? (q > 0 ? q : '0') : '--');
      setEl(d.tId, hasDesglose ? formatCurrency(sub) : '--');
    });

    const totContado = parseFloat(data.conteoTotal !== undefined ? data.conteoTotal : concil.contado) || (hasDesglose ? conteoCalc : 0);
    setEl('pc_total_contado', formatCurrency(totContado));

    // 4. Conciliación
    const esperado = parseFloat(concil.esperado !== undefined ? concil.esperado : (fondo - totSalidas)) || 0;
    const dif = parseFloat(concil.diferencia !== undefined ? concil.diferencia : (totContado - esperado)) || 0;

    setEl('pc_concil_fondo', formatCurrency(fondo));
    setEl('pc_concil_salidas', formatCurrency(totSalidas));
    setEl('pc_concil_esperado', formatCurrency(esperado));
    setEl('pc_concil_contado', formatCurrency(totContado));
    setEl('pc_concil_diferencia', formatCurrency(dif));

    const resArqueo = concil.resultado || (Math.abs(dif) < 0.005 ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante'));
    setEl('pc_box_cuadrada', resArqueo === 'cuadrada' ? '✓' : '');
    setEl('pc_box_sobrante', resArqueo === 'sobrante' ? '✓' : '');
    setEl('pc_box_faltante', resArqueo === 'faltante' ? '✓' : '');

    setEl('pc_explicacion', concil.explicacion?.trim() || (Math.abs(dif) < 0.005 ? 'Caja chica cuadrada sin observaciones.' : 'Sin observaciones.'));

    // Validación y Firma
    const valResp = val.responsable || rawR || '';
    setEl('pc_val_nombre', valResp);

    const fImg = document.getElementById('pc_val_firma_img');
    const fBlank = document.getElementById('pc_val_firma_blank');
    if (val.signatureData) {
      if (fImg) {
        fImg.src = val.signatureData;
        fImg.style.display = 'inline-block';
      }
      if (fBlank) fBlank.style.display = 'none';
    } else {
      if (fImg) fImg.style.display = 'none';
      if (fBlank) fBlank.style.display = 'inline-block';
    }

    const cln = valResp.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim().replace(/\s+/g, '_');
    return `Arqueo_Caja_Chica_${rawF || 'Fecha'}_${cln || 'Responsable'}.pdf`;
  }

  function syncChicaPrintable() {
    recalculateChica();
    const liveData = serializeChica();
    return populateChicaPrintable(liveData);
  }

  // =========================================================================
  // 4. EXPORTACIÓN A PDF Y GUARDADO CON LIMPIEZA INMEDIATA
  // =========================================================================
  async function exportPDF(isChica = false) {
    const el = document.getElementById(isChica ? 'printable-report-chica' : 'printable-report');
    const fileName = isChica ? syncChicaPrintable() : syncPrincipalPrintable();

    el.style.display = 'block';
    const opt = {
      margin:       [10, 12, 10, 12],
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    try {
      if (window.html2pdf) {
        await window.html2pdf().set(opt).from(el).save();
        logAuditMovement({
          modulo: isChica ? 'Caja Chica' : 'Arqueo Principal',
          accion: 'DESCARGA_PDF_OFICIAL',
          descripcion: `Descarga de reporte oficial PDF al cierre de arqueo: ${fileName}`,
          payload: { fileName, isChica },
          reversible: false
        });
      } else {
        window.print();
      }
    } catch (e) {
      console.warn('Fallback print:', e);
      window.print();
    } finally {
      el.style.display = 'none';
    }
    return fileName;
  }

  // Guardar en Firebase Cloud -> Descargar PDF -> Limpiar Formulario
  async function saveFirebaseAndDownload(isChica = false) {
    const fechaId = isChica ? 'chica_fecha' : 'header_fecha';
    const respId = isChica ? 'chica_responsable' : 'header_responsable';

    let fecha = document.getElementById(fechaId)?.value;
    let resp = document.getElementById(respId)?.value?.trim();

    if (!fecha) {
      fecha = getHidalgoDateStr();
      const el = document.getElementById(fechaId);
      if (el) el.value = fecha;
    }
    if (!resp) {
      const curEmail = TB_FIREBASE.getCurrentUser()?.email;
      if (curEmail) {
        resp = curEmail;
        const el = document.getElementById(respId);
        if (el) el.value = curEmail;
      } else {
        showToast('Por favor ingrese el nombre del responsable', 'warning');
        document.getElementById(respId)?.focus();
        return;
      }
    }

    if (!isChica) {
      const destVal = document.getElementById('val_destino_efectivo')?.value || 'se_queda_en_caja';
      if (destVal === 'se_guarda_en_sobre') {
        const fol = document.getElementById('val_folio_sobre')?.value.trim();
        if (!fol) {
          showToast('Por favor ingrese el Folio Oficial del Sobre', 'warning');
          document.getElementById('val_folio_sobre')?.focus();
          return;
        }
      } else if (destVal === 'se_resguarda_otro') {
        const fol = document.getElementById('val_folio_resguardo')?.value.trim();
        const lug = document.getElementById('val_lugar_resguardo')?.value.trim();
        if (!fol) {
          showToast('Por favor ingrese el Folio de Resguardo', 'warning');
          document.getElementById('val_folio_resguardo')?.focus();
          return;
        }
        if (!lug) {
          showToast('Por favor especifique el lugar de resguardo', 'warning');
          document.getElementById('val_lugar_resguardo')?.focus();
          return;
        }
      }
    }

    showToast('Guardando ' + (isChica ? 'Caja Chica' : ('Corte #' + (currentCorteNum || 1) + ' de Caja Principal')) + ' en Firebase...', 'info');

    // 1. Guardar en Firebase
    let saveResult = null;
    let savedData = null;
    try {
      if (isChica) {
        savedData = serializeChica();
        saveResult = await TB_FIREBASE.saveArqueoCajaChica(savedData);
        logAuditMovement({
          modulo: 'Caja Chica',
          accion: 'ALTA_ARQUEO_CHICA',
          descripcion: 'Cierre Arqueo Caja Chica: Fecha ' + fecha + ' por ' + resp + ' - Fondo Final: $' + parseFloat(savedData.totalFondoFinal || 0).toFixed(2),
          payload: { arqueoKey: saveResult?.key || (fecha + '_' + resp.replace(/[^a-zA-Z0-9]/g, '_')), fecha, data: savedData }
        });
      } else {
        savedData = serializePrincipal();
        saveResult = await TB_FIREBASE.saveArqueoPrincipal(savedData);
        logAuditMovement({
          modulo: 'Arqueo Principal',
          accion: 'ALTA_ARQUEO_PRINCIPAL',
          descripcion: 'Corte de Caja #' + (savedData.corteNum || 1) + ': Fecha ' + fecha + ' por ' + resp + ' - Ingresos Corte: $' + parseFloat(savedData.resumenFinal?.totalIngresosDia || 0).toFixed(2) + ' - Destino: ' + savedData.destinoEfectivo + (savedData.folioSobre ? ' [Sobre ' + savedData.folioSobre + ']' : '') + (savedData.folioResguardo ? ' [Resg ' + savedData.folioResguardo + ']' : ''),
          payload: { arqueoKey: saveResult?.key, fecha, corteNum: savedData.corteNum, data: savedData }
        });

        // Actualizar fondo persistente continuo en Firebase para el próximo corte o día siguiente
        let nuevoFondo = 0.00;
        if (savedData.destinoEfectivo === 'se_queda_en_caja') {
          nuevoFondo = parseFloat(savedData.montoQuedaEnCaja || savedData.conteo?.total || 0) || 0;
        } else {
          nuevoFondo = 0.00;
        }
        await TB_FIREBASE.saveFondoBaseCaja(nuevoFondo);
        controlCajaData.fondoBase = nuevoFondo;
      }
    } catch (saveErr) {
      console.error('Error al guardar arqueo:', saveErr);
      showToast('❌ Error al guardar arqueo: ' + (saveErr?.message || saveErr), 'error');
      return;
    }

    // 2. Notificación explícita de REGISTRO GUARDADO requerida por el usuario
    showToast('✅ Registro guardado. ' + (isChica ? 'Arqueo de Caja Chica' : ('Corte #' + (savedData?.corteNum || 1) + ' de Caja Principal')) + ' guardado con éxito.', 'success');

    // 3. Limpiar los campos para nuevo corte
    if (isChica) {
      clearChicaForm();
    } else {
      clearPrincipalForm();
      // Recargar de inmediato los cortes de hoy y sincronizar ventas del nuevo corte
      await loadControlCajaData();
      await syncVentasToCajaPrincipal(fecha, false);
      renderControlCajaFondo();
      recalculatePrincipal();
    }
    showToast('✨ Formulario listo para el siguiente corte de caja.', 'info');

    // 4. Mostrar de inmediato el Ticket Digital ordenado listo para captura
    openReportTicketViewer(savedData, isChica, saveResult?.key);
  }

  
  // =========================================================================
  // GENERADOR DE TICKETS OFICIALES PARA CAPTURA DE PANTALLA Y WHATSAPP
  // =========================================================================

  function formatDenominationsSummary(conteo) {
    if (!conteo) return '';
    const b = conteo.billetes || {};
    const m = conteo.monedas || {};

    const denomsB = [
      { k: '1,000', v: b['1000'] || b.b1000 || 0 },
      { k: '500', v: b['500'] || b.b500 || 0 },
      { k: '200', v: b['200'] || b.b200 || 0 },
      { k: '100', v: b['100'] || b.b100 || 0 },
      { k: '50', v: b['50'] || b.b50 || 0 },
      { k: '20', v: b['20'] || b.b20 || 0 }
    ].filter(x => parseInt(x.v, 10) > 0);

    const denomsM = [
      { k: '20', v: m['20'] || m.m20 || 0 },
      { k: '10', v: m['10'] || m.m10 || 0 },
      { k: '5', v: m['5'] || m.m5 || 0 },
      { k: '2', v: m['2'] || m.m2 || 0 },
      { k: '1', v: m['1'] || m.m1 || 0 },
      { k: '0.50', v: m['0.5'] || m['0.50'] || m.m050 || 0 }
    ].filter(x => parseInt(x.v, 10) > 0);

    let parts = [];
    if (denomsB.length > 0) {
      parts.push(`<div><strong>Billetes:</strong> ` + denomsB.map(x => `${x.v} de $${x.k}`).join(' &bull; ') + `</div>`);
    }
    if (denomsM.length > 0) {
      parts.push(`<div><strong>Monedas:</strong> ` + denomsM.map(x => `${x.v} de $${x.k}`).join(' &bull; ') + `</div>`);
    }
    return parts.join('');
  }

  function buildWhatsAppTicketSummary(item, isChica, key) {
    if (!item) return '';
    const fecha = item.header?.fecha || item.fecha || getHidalgoDateStr();
    const hora = item.header?.hora || item.hora || '';
    const responsable = item.header?.responsable || item.validacion?.responsable || item.responsable || 'Cajera';
    const cNum = item.corteNum || 1;
    const ticketId = key || item.corteId || item.id || 'N/A';

    let txt = `🌸 *TOTAL BEAUTY SALON & ACADEMY* 🌸\n`;
    if (isChica) {
      const fIni = parseFloat(item.fondoInicial || 0);
      const sal = parseFloat(item.totalSalidas || 0);
      const cont = parseFloat(item.conteoTotal || 0);
      const dif = parseFloat(item.diferencia ?? (cont - (fIni - sal))) || 0;
      txt += `🧾 *ARQUEO DE CAJA CHICA*\n`;
      txt += `📅 Fecha: ${fecha} ${hora ? ('(' + hora + ')') : ''}\n`;
      txt += `👤 Responsable: ${responsable}\n`;
      txt += `🏷️ Folio: ${ticketId}\n`;
      txt += `---------------------------------\n`;
      txt += `💰 Fondo Asignado: ${formatCurrency(fIni)}\n`;
      txt += `📤 Salidas y Gastos: -${formatCurrency(sal)}\n`;
      txt += `💵 Saldo Teórico: ${formatCurrency(fIni - sal)}\n`;
      txt += `👁️ Efectivo Contado: ${formatCurrency(cont)}\n`;
      txt += `⚖️ Diferencia: ${formatCurrency(dif)} ${Math.abs(dif) < 0.01 ? '✅ CUADRADA' : (dif > 0 ? '⚠️ SOBRANTE' : '❌ FALTANTE')}\n`;
    } else {
      const fIni = parseFloat(item.fondoInicial || 0);
      const cobEfec = parseFloat(item.ingresos?.totales?.efectivo || 0);
      const cobDig = parseFloat((item.ingresos?.totales?.transferencia || 0) + (item.ingresos?.totales?.tarjeta || 0));
      const ent = parseFloat(item.resumen?.totalEntregado ?? item.resumenFinal?.totalEntregado ?? 0);
      const esp = parseFloat(item.conciliacion?.efectivoEsperado || (fIni + cobEfec - ent));
      const cont = parseFloat(item.conteo?.total || 0);
      const dif = parseFloat(item.conciliacion?.diferencia ?? (cont - esp)) || 0;
      const dest = item.destinoEfectivo || 'se_queda_en_caja';
      let destTxt = 'Se queda en caja como fondo inicial';
      if (dest === 'se_guarda_en_sobre') destTxt = `En sobre con folio ${item.folioSobre || 'N/A'}`;
      if (dest === 'se_resguarda_otro') destTxt = `Resguardo en ${item.lugarResguardo || 'Otro'} (Folio ${item.folioResguardo || 'N/A'})`;

      txt += `🧾 *CORTE DE CAJA #${cNum}*\n`;
      txt += `📅 Fecha: ${fecha} ${hora ? ('(' + hora + ')') : ''}\n`;
      txt += `👤 Responsable: ${responsable}\n`;
      txt += `🏷️ Folio: ${ticketId}\n`;
      txt += `---------------------------------\n`;
      txt += `💰 Fondo Inicial: ${formatCurrency(fIni)}\n`;
      txt += `💵 Cobros Efectivo: ${formatCurrency(cobEfec)}\n`;
      if (cobDig > 0) txt += `💳 Cobros Transf/Tarjeta: ${formatCurrency(cobDig)}\n`;
      if (ent > 0) txt += `📤 Entregas Realizadas: -${formatCurrency(ent)}\n`;
      txt += `---------------------------------\n`;
      txt += `🎯 Efectivo Esperado: ${formatCurrency(esp)}\n`;
      txt += `👁️ Conteo Físico Real: ${formatCurrency(cont)}\n`;
      txt += `⚖️ Diferencia: ${formatCurrency(dif)} ${Math.abs(dif) < 0.01 ? '✅ CUADRADA' : (dif > 0 ? '⚠️ SOBRANTE' : '❌ FALTANTE')}\n`;
      txt += `---------------------------------\n`;
      txt += `📍 Destino Efectivo: ${destTxt}\n`;
    }
    txt += `---------------------------------\n`;
    txt += `_Total Beauty • Sistema Seguro de Caja_`;
    return txt;
  }

  function renderTicketHTML(item, isChica, key) {
    if (!item) return '<div style="color:#ffffff; text-align:center; padding:20px;">No hay información disponible</div>';

    const fecha = item.header?.fecha || item.fecha || getHidalgoDateStr();
    const hora = item.header?.hora || item.hora || '';
    const responsable = item.header?.responsable || item.validacion?.responsable || item.responsable || 'Responsable de Caja';
    const cNum = item.corteNum || 1;
    const ticketId = key || item.corteId || item.id || `TB-${Date.now().toString(36).toUpperCase()}`;

    let html = `
    <div class="tb-ticket-container" id="printable-ticket-content">
      <!-- Header -->
      <div class="tb-ticket-header">
        <img src="assets/logoheader.png" alt="Total Beauty" class="tb-ticket-logo" onerror="this.src=TOTAL_BEAUTY_LOGO_BASE64">
        <h2 class="tb-ticket-brand">TOTAL BEAUTY</h2>
        <div class="tb-ticket-subbrand">SALÓN &bull; ACADEMY</div>
        <div class="tb-ticket-pill-type">${isChica ? 'ARQUEO DE CAJA CHICA' : ('CORTE DE CAJA #' + cNum)}</div>
      </div>

      <!-- Body -->
      <div class="tb-ticket-body">
        <!-- Metadata -->
        <div class="tb-ticket-meta">
          <div class="tb-ticket-meta-row">
            <span class="tb-ticket-meta-label">📅 Fecha y Hora:</span>
            <span class="tb-ticket-meta-val">${formatDateDisplay(fecha)} ${hora ? ('&bull; ' + hora) : ''}</span>
          </div>
          <div class="tb-ticket-meta-row">
            <span class="tb-ticket-meta-label">👤 Responsable:</span>
            <span class="tb-ticket-meta-val">${escapeHtml(responsable)}</span>
          </div>
          <div class="tb-ticket-meta-row">
            <span class="tb-ticket-meta-label">🏷️ Folio Corte:</span>
            <span class="tb-ticket-folio-badge">${escapeHtml(ticketId)}</span>
          </div>
        </div>
    `;

    if (isChica) {
      // CAJA CHICA TICKET
      const fondoInicial = parseFloat(item.fondoInicial || item.conciliacion?.fondo || 0) || 0;
      const totalSalidas = parseFloat(item.totalSalidas || item.conciliacion?.salidas || 0) || 0;
      const saldoEsperado = parseFloat(item.saldoEsperado || item.conciliacion?.saldoEsperado || (fondoInicial - totalSalidas)) || 0;
      const contado = parseFloat(item.conteoTotal || item.conciliacion?.contado || 0) || 0;
      const dif = parseFloat(item.diferencia ?? item.conciliacion?.diferencia ?? (contado - saldoEsperado)) || 0;
      const res = item.conciliacion?.resultado || (Math.abs(dif) < 0.01 ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante'));

      let statusBadge = '';
      if (res === 'cuadrada' || Math.abs(dif) < 0.01) {
        statusBadge = '<div class="tb-ticket-status-badge tb-ticket-status-cuadrada">✅ CAJA CHICA CUADRADA ($0.00)</div>';
      } else if (res === 'sobrante' || dif > 0) {
        statusBadge = `<div class="tb-ticket-status-badge tb-ticket-status-sobrante">⚠️ SOBRANTE: +${formatCurrency(dif)}</div>`;
      } else {
        statusBadge = `<div class="tb-ticket-status-badge tb-ticket-status-faltante">❌ FALTANTE: -${formatCurrency(Math.abs(dif))}</div>`;
      }

      html += statusBadge;

      // Resumen Financiero
      html += `
        <div class="tb-ticket-section-title"><span>💵</span> Conciliación de Caja Chica</div>
        <div class="tb-ticket-row">
          <span>Fondo Asignado Caja Chica:</span>
          <span class="tb-ticket-amount">${formatCurrency(fondoInicial)}</span>
        </div>
        <div class="tb-ticket-row" style="color:#b91c1c;">
          <span>(-) Total Salidas y Gastos:</span>
          <span class="tb-ticket-amount">-${formatCurrency(totalSalidas)}</span>
        </div>
        <div class="tb-ticket-row bold" style="border-top:1px dashed #cbd5e1; padding-top:6px;">
          <span>(=) Saldo Teórico en Caja:</span>
          <span class="tb-ticket-amount">${formatCurrency(saldoEsperado)}</span>
        </div>
        <div class="tb-ticket-row bold total-highlight">
          <span>(👁️) Efectivo Físico Contado:</span>
          <span class="tb-ticket-amount" style="color:#15803d;">${formatCurrency(contado)}</span>
        </div>
        <div class="tb-ticket-row bold">
          <span>Diferencia Final:</span>
          <span class="tb-ticket-amount" style="color:${Math.abs(dif) < 0.01 ? '#15803d' : '#b91c1c'};">${formatCurrency(dif)}</span>
        </div>
        <hr class="tb-ticket-divider">
      `;

      // Detalle de Salidas (si las hay)
      const salidas = item.salidas || [];
      if (salidas.length > 0) {
        html += `<div class="tb-ticket-section-title"><span>🧾</span> Salidas Registradas (${salidas.length})</div>`;
        html += `<table class="tb-ticket-table"><thead><tr><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead><tbody>`;
        salidas.forEach((s) => {
          html += `<tr>
            <td>
              <div style="font-weight:700;">${escapeHtml(s.concepto || 'Gasto')}</div>
              <div style="font-size:0.72rem; color:#64748b;">${s.comprobante ? escapeHtml(s.comprobante) : ''} ${s.folio ? ('[' + escapeHtml(s.folio) + ']') : ''}</div>
            </td>
            <td style="text-align:right; font-weight:700; color:#b91c1c;">${formatCurrency(s.importe || 0)}</td>
          </tr>`;
        });
        html += `</tbody></table><hr class="tb-ticket-divider">`;
      }

      // Detalle Conteo Físico
      const denoms = formatDenominationsSummary(item.conteo);
      if (denoms) {
        html += `<div class="tb-ticket-section-title"><span>🪙</span> Conteo Físico Desglosado</div>
        <div style="font-size:0.78rem; background:#f8fafc; padding:8px 10px; border-radius:8px; line-height:1.45; border:1px solid #e2e8f0; margin-bottom:12px;">
          ${denoms}
        </div>`;
      }

    } else {
      // CAJA PRINCIPAL TICKET
      const fondoInicial = parseFloat(item.fondoInicial || item.conciliacion?.fondoInicial || item.conciliacion?.fondo || 0) || 0;
      const cobrosEfectivo = parseFloat(item.ingresos?.totales?.efectivo || item.conciliacion?.ingresosEfectivo || item.resumen?.cobrosEfectivo || 0) || 0;
      const cobrosTransf = parseFloat(item.ingresos?.totales?.transferencia || item.conciliacion?.ingresosTransferencia || 0) || 0;
      const cobrosTarjeta = parseFloat(item.ingresos?.totales?.tarjeta || item.conciliacion?.ingresosTarjeta || 0) || 0;
      const cobrosTotal = parseFloat(item.ingresos?.totales?.granTotal || item.resumen?.totalIngresos || (cobrosEfectivo + cobrosTransf + cobrosTarjeta)) || 0;
      
      const entregas = parseFloat(item.resumen?.totalEntregado ?? item.resumenFinal?.totalEntregado ?? item.conciliacion?.entregas ?? item.conciliacion?.retiros ?? 0) || 0;
      const esperado = parseFloat(item.conciliacion?.efectivoEsperado || (fondoInicial + cobrosEfectivo - entregas)) || 0;
      const contado = parseFloat(item.conteo?.total || item.conciliacion?.contado || 0) || 0;
      const dif = parseFloat(item.conciliacion?.diferencia ?? (contado - esperado)) || 0;
      const res = item.conciliacion?.resultado || (Math.abs(dif) < 0.01 ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante'));

      let statusBadge = '';
      if (res === 'cuadrada' || Math.abs(dif) < 0.01) {
        statusBadge = '<div class="tb-ticket-status-badge tb-ticket-status-cuadrada">✅ CAJA CUADRADA ($0.00)</div>';
      } else if (res === 'sobrante' || dif > 0) {
        statusBadge = `<div class="tb-ticket-status-badge tb-ticket-status-sobrante">⚠️ SOBRANTE: +${formatCurrency(dif)}</div>`;
      } else {
        statusBadge = `<div class="tb-ticket-status-badge tb-ticket-status-faltante">❌ FALTANTE: -${formatCurrency(Math.abs(dif))}</div>`;
      }

      html += statusBadge;

      // Conciliación de Efectivo
      html += `
        <div class="tb-ticket-section-title"><span>💵</span> Conciliación de Efectivo</div>
        <div class="tb-ticket-row">
          <span>Fondo Inicial en Caja:</span>
          <span class="tb-ticket-amount">${formatCurrency(fondoInicial)}</span>
        </div>
        <div class="tb-ticket-row" style="color:#15803d;">
          <span>(+) Cobros Efectivo en Corte:</span>
          <span class="tb-ticket-amount">+${formatCurrency(cobrosEfectivo)}</span>
        </div>
      `;
      if (entregas > 0.005) {
        html += `
        <div class="tb-ticket-row" style="color:#b91c1c;">
          <span>(-) Entregas Realizadas:</span>
          <span class="tb-ticket-amount">-${formatCurrency(entregas)}</span>
        </div>
        `;
      }
      html += `
        <div class="tb-ticket-row bold" style="border-top:1px dashed #cbd5e1; padding-top:6px;">
          <span>(=) Efectivo Esperado en Caja:</span>
          <span class="tb-ticket-amount">${formatCurrency(esperado)}</span>
        </div>
        <div class="tb-ticket-row bold total-highlight">
          <span>(👁️) Conteo Físico Real:</span>
          <span class="tb-ticket-amount" style="color:#15803d;">${formatCurrency(contado)}</span>
        </div>
        <div class="tb-ticket-row bold">
          <span>Diferencia de Caja:</span>
          <span class="tb-ticket-amount" style="color:${Math.abs(dif) < 0.01 ? '#15803d' : '#b91c1c'};">${formatCurrency(dif)}</span>
        </div>
        <hr class="tb-ticket-divider">
      `;

      // Destino del Dinero
      const dest = item.destinoEfectivo || item.validacion?.destinoEfectivo || 'se_queda_en_caja';
      const montoQueda = parseFloat(item.montoQuedaEnCaja || contado) || 0;
      const montoEntregaDest = parseFloat(item.montoEntregado || item.validacion?.importeEntregado || 0) || 0;

      if (dest === 'se_guarda_en_sobre') {
        html += `
          <div class="tb-ticket-destino-box tb-ticket-destino-sobre">
            <div style="font-weight:800; font-size:0.88rem; display:flex; align-items:center; gap:6px;">
              <span>✉️</span> Destino: Se Guarda en Sobre
            </div>
            <div style="margin-top:4px;">
              Folio Sobre: <strong class="tb-ticket-folio-badge">${escapeHtml(item.folioSobre || 'N/A')}</strong>
              &bull; Importe: <strong>${formatCurrency(montoEntregaDest || contado)}</strong>
            </div>
            <div style="font-size:0.75rem; color:#1e40af; margin-top:2px;">El efectivo sale de caja para resguardo en sobre oficial.</div>
          </div>
        `;
      } else if (dest === 'se_resguarda_otro') {
        html += `
          <div class="tb-ticket-destino-box tb-ticket-destino-resguardo">
            <div style="font-weight:800; font-size:0.88rem; display:flex; align-items:center; gap:6px;">
              <span>🏦</span> Destino: Resguardo Externo
            </div>
            <div style="margin-top:4px;">
              Lugar: <strong>${escapeHtml(item.lugarResguardo || 'Especificado')}</strong> &bull; Folio: <strong class="tb-ticket-folio-badge">${escapeHtml(item.folioResguardo || 'N/A')}</strong>
            </div>
            <div>Importe: <strong>${formatCurrency(montoEntregaDest || contado)}</strong></div>
          </div>
        `;
      } else {
        html += `
          <div class="tb-ticket-destino-box tb-ticket-destino-caja">
            <div style="font-weight:800; font-size:0.88rem; display:flex; align-items:center; gap:6px;">
              <span>💵</span> Destino: Se Queda en Caja
            </div>
            <div style="margin-top:4px;">
              Importe Base que Permanece: <strong>${formatCurrency(montoQueda)}</strong>
            </div>
            <div style="font-size:0.75rem; color:#166534; margin-top:2px;">Pasa íntegramente como Fondo Inicial para el siguiente turno o día.</div>
          </div>
        `;
      }

      // Detalle de Conteo Billetes y Monedas
      const denoms = formatDenominationsSummary(item.conteo);
      if (denoms) {
        html += `
          <div class="tb-ticket-section-title"><span>🪙</span> Conteo Físico Desglosado</div>
          <div style="font-size:0.78rem; background:#f8fafc; padding:8px 10px; border-radius:8px; line-height:1.45; border:1px solid #e2e8f0; margin-bottom:12px;">
            ${denoms}
          </div>
        `;
      }

      // Resumen Global de Cobros (Efectivo, Tarjeta, Transferencia)
      html += `
        <div class="tb-ticket-section-title"><span>💳</span> Resumen Global de Cobros</div>
        <div class="tb-ticket-row">
          <span>Cobros Efectivo:</span>
          <span class="tb-ticket-amount">${formatCurrency(cobrosEfectivo)}</span>
        </div>
        <div class="tb-ticket-row">
          <span>Cobros Transferencia:</span>
          <span class="tb-ticket-amount">${formatCurrency(cobrosTransf)}</span>
        </div>
        <div class="tb-ticket-row">
          <span>Cobros Tarjeta:</span>
          <span class="tb-ticket-amount">${formatCurrency(cobrosTarjeta)}</span>
        </div>
        <div class="tb-ticket-row bold" style="background:#f8fafc; padding:6px 8px; border-radius:6px; margin-top:4px;">
          <span>Total Ventas Cobradas en Corte:</span>
          <span class="tb-ticket-amount" style="color:#0f172a;">${formatCurrency(cobrosTotal)}</span>
        </div>
        <hr class="tb-ticket-divider">
      `;

      // Desglose por Concepto
      const srvTot = parseFloat(item.ingresos?.desglose?.servicios || item.resumen?.serviciosTotal || 0) || 0;
      const curTot = parseFloat(item.ingresos?.desglose?.cursos || item.resumen?.cursosTotal || 0) || 0;
      const prdTot = parseFloat(item.ingresos?.desglose?.productos || item.resumen?.productosTotal || 0) || 0;

      if (srvTot > 0 || curTot > 0 || prdTot > 0) {
        html += `
          <div class="tb-ticket-section-title"><span>🏷️</span> Ventas por Categoría</div>
          <div class="tb-ticket-row"><span>Servicios del Salón:</span><span class="tb-ticket-amount">${formatCurrency(srvTot)}</span></div>
          <div class="tb-ticket-row"><span>Cursos y Academia:</span><span class="tb-ticket-amount">${formatCurrency(curTot)}</span></div>
          <div class="tb-ticket-row"><span>Venta de Productos:</span><span class="tb-ticket-amount">${formatCurrency(prdTot)}</span></div>
          <hr class="tb-ticket-divider">
        `;
      }
    }

    // Observaciones o notas
    const obs = item.validacion?.observacion || item.observaciones || item.conciliacion?.explicacion;
    if (obs && obs.trim()) {
      html += `
        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px 10px; margin-bottom:12px; font-size:0.78rem;">
          <strong style="color:#92400e;">Observaciones / Justificación:</strong>
          <div style="color:#78350f; margin-top:3px;">${escapeHtml(obs)}</div>
        </div>
      `;
    }

    // Firma del Responsable
    const firmaImg = item.validacion?.firmaBase64 || item.firmaBase64;
    html += `
      <div class="tb-ticket-signature-wrap">
        ${firmaImg ? `<img src="${firmaImg}" class="tb-ticket-signature-img" alt="Firma Responsable">` : '<div style="height:35px; border-bottom:1px solid #cbd5e1; width:150px; margin:0 auto 4px auto;"></div>'}
        <div class="tb-ticket-signature-name">${escapeHtml(responsable)}</div>
        <div class="tb-ticket-signature-sub">Firma de Responsabilidad y Conformidad</div>
      </div>
    `;

    // Footer del Ticket
    html += `
      </div>
      <div class="tb-ticket-footer">
        <div><strong>TOTAL BEAUTY SALON &amp; ACADEMY</strong></div>
        <div>Corte sincronizado y protegido en Firebase Realtime Database</div>
        <div style="margin-top:4px; font-size:0.68rem; color:#94a3b8;">Tecnología Antigravity &bull; Comprobante Oficial de Caja</div>
      </div>
    </div>
    `;

    return html;
  }


  // =========================================================================
  // 5. MÓDULO HISTORIAL (CON TICKET DIGITAL ORDENADO PARA CAPTURA)
  // =========================================================================
  let activeViewingReport = null;

  function openReportTicketViewer(item, isChica, key) {
    if (!item) {
      showToast('No se encontraron datos del comprobante', 'warning');
      return;
    }
    const fecha = item.header?.fecha || item.fecha || 'Sin fecha';
    const resp = item.header?.responsable || item.validacion?.responsable || 'Sin asignar';
    const tipoLabel = isChica ? 'Caja Chica' : 'Caja Principal';
    const cNum = item.corteNum || 1;

    activeViewingReport = { item, isChica, key };

    logAuditMovement({
      modulo: 'Historial Arqueo',
      accion: 'VISUALIZAR_TICKET',
      descripcion: `Visualización de ticket oficial: ${tipoLabel} (${fecha}) por ${resp}`,
      payload: { key, isChica, fecha, responsable: resp },
      reversible: false
    });

    const modalTitle = document.getElementById('pdf-modal-title');
    const modalSub = document.getElementById('pdf-modal-subtitle');
    const previewContainer = document.getElementById('pdf-preview-container');
    const modal = document.getElementById('modal-view-pdf-report');

    if (modalTitle) {
      modalTitle.innerHTML = `<span>🧾</span> Ticket Oficial: ${isChica ? 'Caja Chica' : ('Corte #' + cNum)}`;
    }
    if (modalSub) {
      modalSub.innerHTML = `📅 <strong>${fecha}</strong> &bull; 👤 <strong>${resp}</strong>`;
    }

    if (previewContainer) {
      previewContainer.innerHTML = renderTicketHTML(item, isChica, key);
    }

    if (modal) {
      modal.style.display = 'flex';
      const body = document.getElementById('pdf-modal-body');
      if (body) body.scrollTop = 0;
    }
  }

  // Compatibilidad con invocaciones existentes
  const openReportPdfViewer = openReportTicketViewer;

  function closeReportPdfModal() {
    const modal = document.getElementById('modal-view-pdf-report');
    if (modal) modal.style.display = 'none';
  }

  async function downloadPdfFromViewer() {
    if (!activeViewingReport) return;
    const { isChica, isIngresos, item, fileName } = activeViewingReport;
    let el;
    if (isIngresos) {
      populateIngresosPrintable();
      el = document.getElementById('printable-report-ingresos');
    } else if (isChica) {
      populateChicaPrintable(item);
      el = document.getElementById('printable-report-chica');
    } else {
      populatePrincipalPrintable(item);
      el = document.getElementById('printable-report');
    }

    showToast('Generando y descargando PDF oficial...', 'info');

    el.style.display = 'block';
    const opt = {
      margin:       [10, 12, 10, 12],
      filename:     fileName || (isChica ? 'Arqueo_Caja_Chica.pdf' : 'Arqueo_Caja_Principal.pdf'),
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    try {
      if (window.html2pdf) {
        await window.html2pdf().set(opt).from(el).save();
        logAuditMovement({
          modulo: isIngresos ? 'Reporte Ingresos' : (isChica ? 'Caja Chica' : 'Historial Arqueo'),
          accion: 'DESCARGA_PDF_OFICIAL',
          descripcion: `Descarga de reporte oficial PDF: ${fileName}`,
          payload: { fileName, isChica, isIngresos },
          reversible: false
        });
        showToast(`✅ PDF descargado: ${fileName}`, 'success');
      } else {
        window.print();
      }
    } catch (e) {
      console.warn('Error al exportar PDF:', e);
      window.print();
    } finally {
      el.style.display = 'none';
    }
  }

  function printPdfFromViewer() {
    if (!activeViewingReport) return;
    const { isChica, isIngresos, item } = activeViewingReport;
    let elId = 'printable-report';
    if (isIngresos) {
      populateIngresosPrintable();
      elId = 'printable-report-ingresos';
    } else if (isChica) {
      populateChicaPrintable(item);
      elId = 'printable-report-chica';
    } else {
      populatePrincipalPrintable(item);
    }
    const el = document.getElementById(elId);
    document.querySelectorAll('#printable-report, #printable-report-chica, #printable-report-ingresos').forEach(e => e.classList.remove('printing-active'));
    if (el) el.classList.add('printing-active');
    window.print();
    setTimeout(() => {
      if (el) el.classList.remove('printing-active');
    }, 1000);
  }

  // =========================================================================
  // 5. MÓDULO HISTORIAL (CON VISTA PREVIA Y DESCARGA DIRECTA DE PDF)
  // =========================================================================
  async function loadHistorial(filterDate = null) {
    const container = document.getElementById('history-grid-container');
    const emptyState = document.getElementById('historial-empty-state');
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px;"><div class="tb-inline-spinner">Cargando reportes de Firebase...</div></div>';

    showGlobalLoader('Cargando Reportes...', 'Consultando historial en Firebase Cloud...');
    let list = {};
    try {
      if (currentHistTipo === 'principal') {
        list = await TB_FIREBASE.getArqueosList();
      } else {
        list = await TB_FIREBASE.getArqueosChicaList();
      }
    } catch (err) {
      console.error('Error al cargar historial:', err);
      showToast('Error al consultar historial de Firebase', 'error');
    } finally {
      hideGlobalLoader(250);
    }

    const keys = Object.keys(list).sort().reverse();
    let filteredKeys = keys;
    if (filterDate) filteredKeys = keys.filter(k => k.startsWith(filterDate));

    container.innerHTML = '';
    if (filteredKeys.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    filteredKeys.forEach(k => {
      const item = list[k] || {};
      const card = document.createElement('div');
      card.className = 'history-item-card';
      card.style.cursor = 'pointer';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'Haga clic para ver el ticket digital de este arqueo';

      const resBadgeClass = item.conciliacion?.resultado === 'cuadrada' ? 'badge-cuadrada' :
                            (item.conciliacion?.resultado === 'sobrante' ? 'badge-sobrante' : 'badge-faltante');
      const resText = item.conciliacion?.resultado === 'cuadrada' ? 'Cuadrada' :
                      (item.conciliacion?.resultado === 'sobrante' ? 'Sobrante' : 'Faltante');

      if (currentHistTipo === 'principal') {
        const efecEntregado = item.resumen?.totalEntregado ?? item.resumenFinal?.totalEntregado ?? item.validacion?.importeEntregado ?? item.conciliacion?.retiros ?? 0;
        const cNum = item.corteNum || 1;
        const dest = item.destinoEfectivo || item.validacion?.destinoEfectivo;
        let destBadge = '<span style="background:#f0fdf4; color:#15803d; padding:2px 7px; border-radius:4px; font-size:0.75rem; font-weight:700;">💵 En Caja</span>';
        if (dest === 'se_guarda_en_sobre') {
          destBadge = `<span style="background:#eff6ff; color:#2563eb; padding:2px 7px; border-radius:4px; font-size:0.75rem; font-weight:700;">✉️ Sobre [${item.folioSobre || 'Folio'}]</span>`;
        } else if (dest === 'se_resguarda_otro') {
          destBadge = `<span style="background:#fffbeb; color:#d97706; padding:2px 7px; border-radius:4px; font-size:0.75rem; font-weight:700;">🏦 Resguardo [${item.folioResguardo || 'Folio'}]</span>`;
        }
        card.innerHTML = `
          <div class="history-card-header">
            <div>
              <div class="history-date" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span>📅 ${item.header?.fecha || item.fecha || 'Sin Fecha'}</span>
                <span style="background:#0b0f17; color:#d4af37; padding:2px 7px; border-radius:4px; font-weight:800; font-size:0.75rem;">Corte #${cNum}</span>
                ${destBadge}
              </div>
              <div class="history-responsable">👤 ${item.header?.responsable || item.validacion?.responsable || 'Sin asignar'} (${item.header?.hora || ''})</div>
            </div>
            <span class="kpi-status-badge ${resBadgeClass}">${resText}</span>
          </div>
          <div class="history-metrics">
            <div class="history-metric-box"><div class="label">Ingresos Corte</div><div class="val">${formatCurrency(item.ingresos?.totales?.granTotal || item.resumen?.totalIngresos || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Efectivo Contado</div><div class="val">${formatCurrency(item.conteo?.total || item.conciliacion?.contado || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Efectivo Entregado</div><div class="val">${formatCurrency(efecEntregado)}</div></div>
            <div class="history-metric-box"><div class="label">Diferencia</div><div class="val" style="color:${Math.abs(item.conciliacion?.diferencia || 0) < 0.01 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(item.conciliacion?.diferencia || 0)}</div></div>
          </div>
          <div class="history-card-action" style="margin-top:10px; padding-top:10px; border-top:1px dashed #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">🔑 ${k}</span>
            <span class="btn btn-sm btn-firebase" style="padding:4px 12px; font-size:0.8rem; pointer-events:none; display:inline-flex; align-items:center; gap:5px;">
              <span>🧾</span> Ver Ticket Digital
            </span>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="history-card-header">
            <div>
              <div class="history-date">📅 ${item.header?.fecha || item.fecha || 'Sin Fecha'} (Caja Chica)</div>
              <div class="history-responsable">👤 ${item.header?.responsable || item.validacion?.responsable || 'Sin asignar'} (${item.header?.hora || ''})</div>
            </div>
            <span class="kpi-status-badge ${resBadgeClass}">${resText}</span>
          </div>
          <div class="history-metrics">
            <div class="history-metric-box"><div class="label">Fondo Inicial</div><div class="val">${formatCurrency(item.fondoInicial || item.conciliacion?.fondo || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Total Salidas</div><div class="val">${formatCurrency(item.totalSalidas || item.conciliacion?.salidas || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Efectivo Contado</div><div class="val">${formatCurrency(item.conteoTotal || item.conciliacion?.contado || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Diferencia</div><div class="val" style="color:${Math.abs(item.conciliacion?.diferencia || 0) < 0.01 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(item.conciliacion?.diferencia || 0)}</div></div>
          </div>
          <div class="history-card-action" style="margin-top:10px; padding-top:10px; border-top:1px dashed #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; color:#64748b; font-family:monospace;">🔑 ${k}</span>
            <span class="btn btn-sm btn-firebase" style="padding:4px 12px; font-size:0.8rem; pointer-events:none; display:inline-flex; align-items:center; gap:5px;">
              <span>🧾</span> Ver Ticket Digital
            </span>
          </div>
        `;
      }

      const isChica = currentHistTipo === 'chica';
      card.addEventListener('click', () => {
        openReportPdfViewer(item, isChica, k);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openReportPdfViewer(item, isChica, k);
        }
      });
      container.appendChild(card);
    });
  }

  // =========================================================================
  // 6. BALANCESCORE POR ESTACIONES Y CURSOS (METAS QUINCENALES Y RANGOS FLEXIBLES)
  // =========================================================================
  // Metas cargadas directamente de Estaciones de Trabajo y Cursos en Firebase

  let bsPeriodoModo = 'dia'; // 'dia', 'semana', 'quincena', 'mes', 'rango'
  let catMetas = [];

  function switchBsPeriodMode(mode) {
    bsPeriodoModo = mode;
    document.querySelectorAll('.bs-period-pill').forEach(btn => {
      if (btn.dataset.period === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // Mostrar el contenedor de controles correspondiente
    ['dia', 'semana', 'quincena', 'mes', 'rango'].forEach(m => {
      const el = document.getElementById(`bs-ctrl-${m}`);
      if (el) el.style.display = (m === mode) ? 'flex' : 'none';
    });

    const periodLabels = {
      dia: '1. Por Día',
      semana: '2. Por Semana',
      quincena: '3. Por Quincena',
      mes: '4. Por Mes (1 al 30/31)',
      rango: '5. Rango de Días'
    };
    logAuditMovement({
      modulo: 'BalanceScore',
      accion: 'CAMBIO_PERIODO',
      descripcion: `Filtrado de BalanceScore Estaciones por período: ${periodLabels[mode] || mode}`,
      payload: { modo: mode },
      reversible: false
    });

    renderBalanceScoreStations();
  }

  function getMonthName(monthNumber) {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[monthNumber - 1] || '';
  }

  function formatDateDisplay(yyyy_mm_dd) {
    if (!yyyy_mm_dd) return '--/--/----';
    const parts = yyyy_mm_dd.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return yyyy_mm_dd;
  }

  function getBsActivePeriodRange() {
    const today = getHidalgoDateStr();
    let fechaInicio = today;
    let fechaFin = today;
    let diasPeriodo = 1;
    let factorPeriodo = 1 / 15;
    let periodoTexto = `Día: ${formatDateDisplay(today)}`;
    let esAvanceMes = false;

    if (bsPeriodoModo === 'dia') {
      const el = document.getElementById('bs_fecha_dia');
      const f = (el && el.value) ? el.value : today;
      fechaInicio = f;
      fechaFin = f;
      diasPeriodo = 1;
      factorPeriodo = 1 / 15;
      periodoTexto = `Día: ${formatDateDisplay(f)}`;
    } else if (bsPeriodoModo === 'semana') {
      const el = document.getElementById('bs_fecha_semana');
      const f = (el && el.value) ? el.value : today;
      const dEnd = new Date(f + 'T00:00:00');
      const dStart = new Date(dEnd);
      dStart.setDate(dEnd.getDate() - 6);
      fechaInicio = dStart.toISOString().split('T')[0];
      fechaFin = f;
      diasPeriodo = 7;
      factorPeriodo = 7 / 15;
      periodoTexto = `Semana: Del ${formatDateDisplay(fechaInicio)} al ${formatDateDisplay(fechaFin)} (7 días)`;
    } else if (bsPeriodoModo === 'quincena') {
      const mEl = document.getElementById('bs_quin_mes');
      const mesVal = (mEl && mEl.value) ? mEl.value : today.substring(0, 7);
      const tEl = document.getElementById('bs_quin_tipo');
      const tipo = (tEl && tEl.value) ? tEl.value : '1';
      const [y, m] = mesVal.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();

      if (tipo === '1') {
        fechaInicio = `${mesVal}-01`;
        fechaFin = `${mesVal}-15`;
        diasPeriodo = 15;
        factorPeriodo = 1.0;
        periodoTexto = `1ª Quincena (Días 1 al 15) de ${getMonthName(m)} ${y}`;
      } else {
        fechaInicio = `${mesVal}-16`;
        fechaFin = `${mesVal}-${String(lastDay).padStart(2, '0')}`;
        diasPeriodo = lastDay - 15;
        factorPeriodo = 1.0;
        periodoTexto = `2ª Quincena (Días 16 al ${lastDay}) de ${getMonthName(m)} ${y}`;
      }
    } else if (bsPeriodoModo === 'mes') {
      const mEl = document.getElementById('bs_mes_val');
      const mesVal = (mEl && mEl.value) ? mEl.value : today.substring(0, 7);
      const chk = document.getElementById('bs_mes_hasta_hoy');
      const hastaHoy = chk ? chk.checked : true;
      const [y, m] = mesVal.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();

      const isCurrentMonth = (mesVal === today.substring(0, 7));
      const todayDay = parseInt(today.substring(8, 10), 10);

      if (hastaHoy && isCurrentMonth) {
        fechaInicio = `${mesVal}-01`;
        fechaFin = today;
        diasPeriodo = todayDay;
        factorPeriodo = todayDay / 15;
        esAvanceMes = true;
        periodoTexto = `Mes de ${getMonthName(m)} ${y}: Avance del día 1 al ${todayDay} (${todayDay} de ${lastDay} días transcurridos)`;
      } else {
        fechaInicio = `${mesVal}-01`;
        fechaFin = `${mesVal}-${String(lastDay).padStart(2, '0')}`;
        diasPeriodo = lastDay;
        factorPeriodo = 2.0; // Mes completo = 2 quincenas
        periodoTexto = `Mes completo de ${getMonthName(m)} ${y} (Día 1 al ${lastDay})`;
      }
    } else if (bsPeriodoModo === 'rango') {
      const d1El = document.getElementById('bs_rango_desde');
      const d2El = document.getElementById('bs_rango_hasta');
      const d1 = (d1El && d1El.value) ? d1El.value : today;
      const d2 = (d2El && d2El.value) ? d2El.value : today;

      fechaInicio = d1 <= d2 ? d1 : d2;
      fechaFin = d1 <= d2 ? d2 : d1;

      const dt1 = new Date(fechaInicio + 'T00:00:00');
      const dt2 = new Date(fechaFin + 'T00:00:00');
      const diffTime = Math.abs(dt2 - dt1);
      diasPeriodo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      factorPeriodo = diasPeriodo / 15;
      periodoTexto = `Rango de Días: Del ${formatDateDisplay(fechaInicio)} al ${formatDateDisplay(fechaFin)} (${diasPeriodo} días)`;
    }

    return { fechaInicio, fechaFin, diasPeriodo, factorPeriodo, periodoTexto, esAvanceMes };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getActiveStationMetas() {
    // Toma directamente los datos de Estaciones de Trabajo + la dimensión de Cursos (SOLO lo guardado en Firebase)
    const estacionesList = (catEstaciones && catEstaciones.length > 0) ? catEstaciones.map(e => ({
      id: e.nombre,
      nombre: e.nombre,
      icono: e.icono || '💈',
      metaQuincenal: parseFloat(e.metaQuincenal || e.meta || 0),
      clientesMeta: parseInt(e.clientesMeta || e.metaClientes || 0, 10),
      isCurso: (e.nombre || '').toLowerCase().includes('curso') || (e.nombre || '').toLowerCase().includes('academia')
    })) : [];

    const yaTieneCursos = estacionesList.some(e => e.isCurso || e.id === 'Cursos');
    if (!yaTieneCursos) {
      const cursosMetaQuincenal = (catCursosMeta && catCursosMeta.metaQuincenal) ? parseFloat(catCursosMeta.metaQuincenal) : 0;
      const cursosClientesMeta = (catCursosMeta && catCursosMeta.clientesMeta) ? parseInt(catCursosMeta.clientesMeta, 10) : 0;
      estacionesList.push({
        id: 'Cursos',
        nombre: (catCursosMeta && catCursosMeta.nombre) ? catCursosMeta.nombre : 'Academia Total Beauty (Cursos)',
        icono: (catCursosMeta && catCursosMeta.icono) ? catCursosMeta.icono : '🎓',
        metaQuincenal: cursosMetaQuincenal,
        clientesMeta: cursosClientesMeta,
        isCurso: true
      });
    }

    return estacionesList;
  }

  async function renderBalanceScoreStations() {
    const container = document.getElementById('stations-grid-container');
    if (!container) return;
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--muted);">Cargando Balanced Scorecard y ventas acumuladas...</div>';

    // Actualizar descripción dinámica de topbar con el número real de estaciones
    const numEst = (catEstaciones && catEstaciones.length > 0) ? catEstaciones.length : 0;
    const topbarDesc = document.getElementById('topbar-module-desc');
    if (topbarDesc && currentModule === 'balancescore') {
      topbarDesc.textContent = `Medición de metas de ingresos y calidad operativa en las ${numEst} estaciones de trabajo`;
    }

    const { fechaInicio, fechaFin, diasPeriodo, factorPeriodo, periodoTexto, esAvanceMes } = getBsActivePeriodRange();

    const lblPeriodo = document.getElementById('bs-periodo-texto');
    if (lblPeriodo) lblPeriodo.textContent = periodoTexto;

    // Obtener todas las ventas registradas en el período consultado
    const ventas = await TB_FIREBASE.getVentasByRango(fechaInicio, fechaFin);
    const activeMetas = getActiveStationMetas();

    if (activeMetas.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:45px 20px; color:var(--muted); background:#fff; border-radius:var(--radius); border:1px dashed var(--border);">
          <span style="font-size:2.2rem; display:block; margin-bottom:12px;">📊</span>
          <h3 style="color:var(--dark); font-size:1.15rem; margin-bottom:6px;">Sin Estaciones Configuradas</h3>
          <p style="font-size:0.88rem; max-width:480px; margin:0 auto 16px auto;">
            Para visualizar el BalanceScore y medir el avance de metas, primero dé de alta sus estaciones en <strong>Configuración General &gt; Estaciones de Trabajo</strong>.
          </p>
          <a href="#" class="btn btn-primary btn-sm btn-goto-config" data-config-tab="estaciones" style="text-decoration:none;">
            ⚙️ Ir a Configurar Estaciones
          </a>
        </div>
      `;
      const avgBadge = document.getElementById('bs-overall-badge');
      if (avgBadge) { avgBadge.textContent = 'Score General: 0%'; }
      const totalVentasEl = document.getElementById('kpi-bs-ventas-total');
      if (totalVentasEl) totalVentasEl.textContent = '$0.00';
      const totalMetaEl = document.getElementById('kpi-bs-meta-total');
      if (totalMetaEl) totalMetaEl.textContent = '$0.00';
      const totalClientesEl = document.getElementById('kpi-bs-clientes-total');
      if (totalClientesEl) totalClientesEl.textContent = '0';
      const cumplimientoEl = document.getElementById('kpi-bs-pct-total');
      if (cumplimientoEl) cumplimientoEl.textContent = '0%';
      return;
    }

    container.innerHTML = '';
    let granTotalVentas = 0;
    let granTotalMeta = 0;
    let granTotalClientes = 0;

    activeMetas.forEach(st => {
      const isCursos = st.id === 'Cursos' || (st.nombre || '').toLowerCase().includes('curso') || (st.nombre || '').toLowerCase().includes('academia') || st.isCurso;

      // Filtrar ventas de esta estación o de cursos
      let ventasSt = [];
      if (isCursos) {
        ventasSt = ventas.filter(v => {
          const est = (v.estacion || '').toLowerCase();
          const serv = (v.servicio || '').toLowerCase();
          return est.includes('academia') || est.includes('curso') || serv.includes('curso') || serv.includes('taller') || v.tipo === 'Curso';
        });
      } else {
        ventasSt = ventas.filter(v => {
          const est = (v.estacion || '').trim().toLowerCase();
          const serv = (v.servicio || '').trim().toLowerCase();
          const stName = (st.nombre || st.id || '').trim().toLowerCase();
          const esCurso = est.includes('academia') || est.includes('curso') || serv.includes('curso') || serv.includes('taller') || v.tipo === 'Curso';
          const matchEst = est === stName || est.includes(stName) || stName.includes(est);
          return matchEst && !esCurso;
        });
      }

      const lograda = ventasSt.reduce((sum, v) => sum + (parseFloat(v.totalCobrado) || 0), 0);
      const clientesReales = ventasSt.length;
      const ticket = clientesReales > 0 ? (lograda / clientesReales) : 0;

      // Desglose por método de pago y top servicios
      let mEfec = 0;
      let mTarj = 0;
      let mTransf = 0;
      const servCounts = {};

      ventasSt.forEach(v => {
        const val = parseFloat(v.totalCobrado) || 0;
        if (v.desglosePago) {
          mEfec += parseFloat(v.desglosePago.efectivo) || 0;
          mTarj += parseFloat(v.desglosePago.tarjeta) || 0;
          mTransf += parseFloat(v.desglosePago.transferencia) || 0;
        } else {
          const mp = (v.metodoPago || '').toLowerCase();
          if (mp.includes('tarj')) mTarj += val;
          else if (mp.includes('transf')) mTransf += val;
          else mEfec += val;
        }

        const sKey = (v.servicio || '').trim();
        if (sKey) servCounts[sKey] = (servCounts[sKey] || 0) + 1;
      });

      const topServicios = Object.entries(servCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nombre, cant]) => `${nombre} (${cant})`)
        .join(', ');

      // Calcular meta proporcional al período seleccionado
      const metaQuincenalBase = parseFloat(st.metaQuincenal) || 0;
      const metaPeriodo = Math.round(metaQuincenalBase * factorPeriodo);
      const clientesMetaBase = parseInt(st.clientesMeta, 10) || 0;
      const clientesMetaPeriodo = Math.round(clientesMetaBase * factorPeriodo);

      granTotalVentas += lograda;
      granTotalMeta += metaPeriodo;
      granTotalClientes += clientesReales;

      // % REAL DE AVANCE (Sin fórmulas ficticias ni pisos artificiales de 40%)
      const pct = metaPeriodo > 0 ? Math.round((lograda / metaPeriodo) * 100) : (lograda > 0 ? 100 : 0);

      // Color dinámico de desempeño real
      let barColor = '#ef4444'; // Rojo < 75%
      let badgeBg = '#ef4444';
      if (pct >= 100) {
        barColor = '#10b981'; // Verde >= 100%
        badgeBg = '#10b981';
      } else if (pct >= 75) {
        barColor = '#f59e0b'; // Ámbar 75-99%
        badgeBg = '#f59e0b';
      } else if (pct > 0) {
        barColor = '#3b82f6'; // Azul si hay ventas > 0
        badgeBg = '#3b82f6';
      } else {
        barColor = '#cbd5e1'; // Gris si 0%
        badgeBg = '#64748b';
      }

      // Avance respecto al mes completo si aplica
      let avanceMensualHtml = '';
      if (esAvanceMes && metaQuincenalBase > 0) {
        const metaMensualCompleta = metaQuincenalBase * 2;
        const pctMesCompleto = Math.round((lograda / metaMensualCompleta) * 100);
        avanceMensualHtml = `
          <div style="font-size:0.73rem; color:var(--muted); margin-top:6px; display:flex; justify-content:space-between; border-top:1px dashed #e2e8f0; padding-top:4px;">
            <span>Avance vs Meta Mensual ($${formatCurrency(metaMensualCompleta)}):</span>
            <strong>${pctMesCompleto}%</strong>
          </div>
        `;
      }

      const card = document.createElement('div');
      card.className = `station-scorecard-card ${isCursos ? 'card-academia' : ''}`;
      
      const headerBg = isCursos 
        ? 'linear-gradient(135deg, #065f46, #047857)' 
        : 'linear-gradient(135deg, #1e293b, #0f172a)';
      const typeLabel = isCursos ? 'Academia Total Beauty' : 'Estación de Trabajo';

      card.innerHTML = `
        <div style="background:${headerBg}; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="station-header-icon">${st.icono || (isCursos ? '🎓' : '💈')}</span>
            <div>
              <span class="station-header-name">${escapeHtml(st.nombre)}</span>
              <span class="station-header-type">${typeLabel}</span>
            </div>
          </div>
          <span style="background:${badgeBg}; color:#fff; font-size:0.85rem; font-weight:800; padding:4px 12px; border-radius:20px; box-shadow:0 2px 4px rgba(0,0,0,0.15);">
            ${pct}%
          </span>
        </div>

        <div style="padding:14px; display:flex; flex-direction:column; flex:1;">
          
          <!-- Caja de Ingresos vs Meta -->
          <div class="station-revenue-box">
            <div class="revenue-row-main">
              <div>
                <span class="revenue-sublabel">Ingresos Reales</span>
                <div class="revenue-main-val">${formatCurrency(lograda)}</div>
              </div>
              <div style="text-align:right;">
                <span class="revenue-sublabel">Meta Período</span>
                <div class="revenue-target-val">${formatCurrency(metaPeriodo)}</div>
              </div>
            </div>

            <!-- Barra de Avance -->
            <div class="progress-bar-bg" style="height:9px; background:#e2e8f0; border-radius:5px; overflow:hidden;">
              <div class="progress-bar-fill" style="width:${Math.min(100, pct)}%; background:${barColor}; height:100%; border-radius:5px; transition:width 0.4s ease;"></div>
            </div>

            <div class="progress-meta-text">
              <span style="color:${barColor}; font-weight:700;">${pct}% alcanzado</span>
              <span style="color:var(--muted);">${metaPeriodo > lograda ? `Faltan: ${formatCurrency(metaPeriodo - lograda)}` : '¡Objetivo superado!'}</span>
            </div>

            ${pct >= 100 ? `
              <div style="margin-top:8px; text-align:center;">
                <span style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px; display:inline-block;">
                  🏆 ¡Meta del Período Superada!
                </span>
              </div>
            ` : ''}

            ${avanceMensualHtml}
          </div>

          <!-- Métricas de Clientes y Ticket Promedio -->
          <div class="station-kpi-subgrid">
            <div class="station-kpi-pill">
              <span class="pill-label">${isCursos ? 'Alumnas Atendidas' : 'Clientas Atendidas'}</span>
              <span class="pill-val">${clientesReales} <small style="font-size:0.7rem; color:var(--muted); font-weight:600;">/ Meta: ${clientesMetaPeriodo}</small></span>
            </div>
            <div class="station-kpi-pill">
              <span class="pill-label">Ticket Promedio</span>
              <span class="pill-val">${formatCurrency(ticket)}</span>
            </div>
          </div>

          <!-- Desglose de Métodos de Pago -->
          <div class="station-metodos-section">
            <div class="metodos-section-title">
              <span>💳</span> Desglose de Cobros
            </div>
            <div class="station-metodos-chips">
              <span class="station-metodo-chip" style="background:#ecfdf5; color:#166534; border:1px solid #bbf7d0;">
                💵 Efec: <strong>${formatCurrency(mEfec)}</strong>
              </span>
              <span class="station-metodo-chip" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe;">
                💳 Tarj: <strong>${formatCurrency(mTarj)}</strong>
              </span>
              <span class="station-metodo-chip" style="background:#f5f3ff; color:#5b21b6; border:1px solid #ddd6fe;">
                📱 Transf: <strong>${formatCurrency(mTransf)}</strong>
              </span>
            </div>
          </div>

          <!-- Top Servicios / Cursos -->
          <div class="station-top-services" style="margin-top:auto;">
            <strong>⭐ ${isCursos ? 'Cursos más solicitados:' : 'Servicios más realizados:'}</strong><br>
            <span>${topServicios || 'Sin operaciones registradas en el período'}</span>
          </div>

        </div>
      `;
      container.appendChild(card);
    });

    // Actualizar KPIs de resumen global con PORCENTAJES 100% REALES
    const pctGlobal = granTotalMeta > 0 ? Math.round((granTotalVentas / granTotalMeta) * 100) : (granTotalVentas > 0 ? 100 : 0);

    const bBadge = document.getElementById('bs-overall-badge');
    if (bBadge) {
      bBadge.textContent = `Score General: ${pctGlobal}%`;
      if (pctGlobal >= 100) {
        bBadge.style.background = '#10b981';
        bBadge.style.color = '#ffffff';
      } else if (pctGlobal >= 75) {
        bBadge.style.background = '#f59e0b';
        bBadge.style.color = '#ffffff';
      } else if (pctGlobal > 0) {
        bBadge.style.background = '#3b82f6';
        bBadge.style.color = '#ffffff';
      } else {
        bBadge.style.background = '#64748b';
        bBadge.style.color = '#ffffff';
      }
    }

    const kv = document.getElementById('kpi-bs-ventas-total');
    if (kv) kv.textContent = formatCurrency(granTotalVentas);

    const km = document.getElementById('kpi-bs-meta-total');
    if (km) km.textContent = formatCurrency(granTotalMeta);

    const kp = document.getElementById('kpi-bs-pct-total');
    if (kp) kp.textContent = `${pctGlobal}%`;

    const kc = document.getElementById('kpi-bs-clientes-total');
    if (kc) kc.textContent = `${granTotalClientes}`;
  }

  // =========================================================================
  // MÓDULO: MI META - AVANCE Y CUMPLIMIENTO POR ESTACIÓN EN TIEMPO REAL
  // =========================================================================
  let miMetaPeriodoModo = 'mes'; // 'mes', 'quincena', 'semana', 'dia'

  function switchMiMetaPeriodMode(mode) {
    miMetaPeriodoModo = mode;
    document.querySelectorAll('.mi-meta-pill').forEach(btn => {
      if (btn.dataset.period === mode) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    renderMiMetaView();
  }

  function getMiMetaDateRange() {
    const today = getHidalgoDateStr();
    const parts = today.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const lastDay = new Date(y, m, 0).getDate();

    let fechaInicio = today;
    let fechaFin = today;
    let factorPeriodo = 2.0; // Mes completo (la meta base en catálogo es quincenal, 15 días, por lo que mes completo = * 2)
    let periodoTexto = '';
    let diasRestantes = 0;

    if (miMetaPeriodoModo === 'mes') {
      fechaInicio = `${parts[0]}-${parts[1]}-01`;
      fechaFin = `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, '0')}`;
      factorPeriodo = 2.0;
      diasRestantes = Math.max(0, lastDay - d);
      periodoTexto = `Mes de ${getMonthName(m)} ${y} (Del 01 al ${lastDay} de ${getMonthName(m)})`;
    } else if (miMetaPeriodoModo === 'quincena') {
      if (d <= 15) {
        fechaInicio = `${parts[0]}-${parts[1]}-01`;
        fechaFin = `${parts[0]}-${parts[1]}-15`;
        diasRestantes = Math.max(0, 15 - d);
        periodoTexto = `1ª Quincena (01 al 15 de ${getMonthName(m)} ${y})`;
      } else {
        fechaInicio = `${parts[0]}-${parts[1]}-16`;
        fechaFin = `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, '0')}`;
        diasRestantes = Math.max(0, lastDay - d);
        periodoTexto = `2ª Quincena (16 al ${lastDay} de ${getMonthName(m)} ${y})`;
      }
      factorPeriodo = 1.0;
    } else if (miMetaPeriodoModo === 'semana') {
      const now = new Date(today + 'T00:00:00');
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0 = Lunes, 6 = Domingo
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const fMon = monday.toISOString().split('T')[0];
      const fSun = sunday.toISOString().split('T')[0];
      fechaInicio = fMon;
      fechaFin = fSun;
      factorPeriodo = 7 / 15;
      diasRestantes = Math.max(0, 6 - dayOfWeek);
      periodoTexto = `Semana Actual: Del ${formatDateDisplay(fechaInicio)} al ${formatDateDisplay(fechaFin)}`;
    } else if (miMetaPeriodoModo === 'dia') {
      fechaInicio = today;
      fechaFin = today;
      factorPeriodo = 1 / 15;
      diasRestantes = 0;
      periodoTexto = `Día de Hoy: ${formatDateDisplay(today)}`;
    }

    return { fechaInicio, fechaFin, factorPeriodo, periodoTexto, diasRestantes, lastDay, currentDay: d };
  }

  async function renderMiMetaView() {
    const container = document.getElementById('mi-meta-stations-grid');
    if (!container) return;

    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:35px; color:var(--muted);"><span class="spinner" style="display:inline-block; margin-right:8px;"></span> Calculando progreso y metas por estación...</div>';

    const { fechaInicio, fechaFin, factorPeriodo, periodoTexto, diasRestantes } = getMiMetaDateRange();

    const lblPeriodo = document.getElementById('mi-meta-periodo-texto');
    if (lblPeriodo) lblPeriodo.textContent = periodoTexto;

    // Obtener todas las ventas del rango desde Firebase
    const ventas = await TB_FIREBASE.getVentasByRango(fechaInicio, fechaFin);
    const activeMetas = getActiveStationMetas();

    const countEl = document.getElementById('mi-meta-estaciones-count');
    if (countEl) countEl.textContent = `${activeMetas.length} estación${activeMetas.length !== 1 ? 'es' : ''}`;

    if (activeMetas.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:45px 20px; color:var(--muted); background:#fff; border-radius:12px; border:1px dashed #cbd5e1;">
          <span style="font-size:2.5rem; display:block; margin-bottom:12px;">🎯</span>
          <h3 style="color:#0f172a; font-size:1.15rem; margin-bottom:6px;">Sin Estaciones Configuradas</h3>
          <p style="font-size:0.88rem; max-width:480px; margin:0 auto 16px auto;">
            Para visualizar las barras de avance, primero configure las estaciones y metas en <strong>Configuración General &gt; Estaciones de Trabajo</strong>.
          </p>
        </div>
      `;
      document.getElementById('kpi-mi-meta-total') && (document.getElementById('kpi-mi-meta-total').textContent = '$0.00');
      document.getElementById('kpi-mi-meta-ventas') && (document.getElementById('kpi-mi-meta-ventas').textContent = '$0.00');
      document.getElementById('kpi-mi-meta-pct') && (document.getElementById('kpi-mi-meta-pct').textContent = '0%');
      document.getElementById('kpi-mi-meta-mini-fill') && (document.getElementById('kpi-mi-meta-mini-fill').style.width = '0%');
      document.getElementById('kpi-mi-meta-dias') && (document.getElementById('kpi-mi-meta-dias').textContent = `${diasRestantes} días`);
      return;
    }

    container.innerHTML = '';
    let granTotalVentas = 0;
    let granTotalMeta = 0;

    activeMetas.forEach(st => {
      const isCursos = st.id === 'Cursos' || (st.nombre || '').toLowerCase().includes('curso') || (st.nombre || '').toLowerCase().includes('academia') || st.isCurso;

      // Filtrar ventas asignadas a esta estación
      let ventasSt = [];
      if (isCursos) {
        ventasSt = ventas.filter(v => {
          const est = (v.estacion || '').toLowerCase();
          const serv = (v.servicio || '').toLowerCase();
          return est.includes('academia') || est.includes('curso') || serv.includes('curso') || serv.includes('taller') || v.tipo === 'Curso';
        });
      } else {
        ventasSt = ventas.filter(v => {
          const est = (v.estacion || '').trim().toLowerCase();
          const serv = (v.servicio || '').trim().toLowerCase();
          const stName = (st.nombre || st.id || '').trim().toLowerCase();
          const esCurso = est.includes('academia') || est.includes('curso') || serv.includes('curso') || serv.includes('taller') || v.tipo === 'Curso';
          const matchEst = est === stName || est.includes(stName) || stName.includes(est);
          return matchEst && !esCurso;
        });
      }

      const lograda = ventasSt.reduce((sum, v) => sum + (parseFloat(v.totalCobrado) || 0), 0);
      const clientesReales = ventasSt.length;
      const ticket = clientesReales > 0 ? (lograda / clientesReales) : 0;

      // Calcular meta para el período
      const metaQuincenalBase = parseFloat(st.metaQuincenal) || 0;
      const metaPeriodo = Math.round(metaQuincenalBase * factorPeriodo);

      granTotalVentas += lograda;
      granTotalMeta += metaPeriodo;

      // Porcentaje real de avance
      const pct = metaPeriodo > 0 ? Math.round((lograda / metaPeriodo) * 100) : (lograda > 0 ? 100 : 0);
      const barWidth = Math.min(100, Math.max(0, pct));
      const diferencia = lograda - metaPeriodo;
      const isCumplida = pct >= 100;

      // Cálculo de meta diaria sugerida
      const diasDiv = Math.max(1, diasRestantes || 1);
      const metaDiariaSugerida = isCumplida ? 0 : Math.round(Math.max(0, -diferencia) / diasDiv);

      // Determinar clase, colores, badges y mensaje motivacional
      let statusClass = 'meta-iniciando';
      let badgeClass = 'badge-meta-iniciando';
      let badgeText = '⏳ Impulso Requerido';
      let barGradient = 'linear-gradient(90deg, #ef4444, #f87171)';
      let pctColor = '#ef4444';
      let motivationalMsg = `Faltan $${formatCurrency(Math.abs(diferencia))} para alcanzar el objetivo.`;

      if (pct >= 100) {
        statusClass = 'meta-cumplida';
        badgeClass = 'badge-meta-cumplida';
        badgeText = '🎉 ¡Meta Cumplida!';
        barGradient = 'linear-gradient(90deg, #10b981, #059669)';
        pctColor = '#059669';
        motivationalMsg = `¡Felicidades! Se ha superado la meta por $${formatCurrency(diferencia)} 👏`;
      } else if (pct >= 75) {
        statusClass = 'meta-cerca';
        badgeClass = 'badge-meta-cerca';
        badgeText = '⚡ Muy Cerca';
        barGradient = 'linear-gradient(90deg, #3b82f6, #10b981)';
        pctColor = '#0284c7';
        motivationalMsg = `¡A solo $${formatCurrency(Math.abs(diferencia))} de lograr la meta! ¡El último esfuerzo! 💪`;
      } else if (pct >= 40) {
        statusClass = 'meta-en-camino';
        badgeClass = 'badge-meta-en-camino';
        badgeText = '🚀 En Buen Camino';
        barGradient = 'linear-gradient(90deg, #f59e0b, #3b82f6)';
        pctColor = '#d97706';
        motivationalMsg = `¡Buen ritmo! Generando $${formatCurrency(metaDiariaSugerida)}/día se llega a la meta.`;
      }

      const card = document.createElement('div');
      card.className = `mi-meta-card ${statusClass}`;
      card.innerHTML = `
        <div class="mi-meta-card-top">
          <div class="mi-meta-card-identity">
            <span class="mi-meta-station-icon">${st.icono || (isCursos ? '🎓' : '💈')}</span>
            <div>
              <h4 class="mi-meta-station-title">${escapeHtml(st.nombre)}</h4>
              <span class="mi-meta-station-type">${isCursos ? 'Academia Total Beauty' : 'Estación de Trabajo'}</span>
            </div>
          </div>
          <div class="mi-meta-status-badge ${badgeClass}">
            ${badgeText}
          </div>
        </div>

        <div class="mi-meta-progress-section">
          <div class="mi-meta-pct-row">
            <span class="mi-meta-pct-label">Avance hacia la meta:</span>
            <span class="mi-meta-pct-number" style="color:${pctColor};">${pct}%</span>
          </div>
          <div class="mi-meta-bar-track" title="${pct}% completado">
            <div class="mi-meta-bar-fill" style="width:${barWidth}%; background:${barGradient};"></div>
          </div>
        </div>

        <div class="mi-meta-stats-grid">
          <div class="mi-meta-stat-box">
            <span class="stat-box-label">Vendido</span>
            <span class="stat-box-value val-lograda">$${formatCurrency(lograda)}</span>
          </div>
          <div class="mi-meta-stat-box">
            <span class="stat-box-label">Meta Objetivo</span>
            <span class="stat-box-value val-meta">$${formatCurrency(metaPeriodo)}</span>
          </div>
          <div class="mi-meta-stat-box">
            <span class="stat-box-label">${isCumplida ? 'Superada por' : 'Faltante'}</span>
            <span class="stat-box-value ${isCumplida ? 'val-superada' : 'val-faltante'}">
              ${isCumplida ? '+' : ''}$${formatCurrency(Math.abs(diferencia))}
            </span>
          </div>
          <div class="mi-meta-stat-box">
            <span class="stat-box-label">Meta Diaria Sug.</span>
            <span class="stat-box-value val-diaria">
              ${isCumplida ? '¡Lograda! 🎉' : `$${formatCurrency(metaDiariaSugerida)}/día`}
            </span>
          </div>
        </div>

        <div class="mi-meta-card-footer">
          <div class="mi-meta-footer-extra">
            <span>👥 <strong>${clientesReales}</strong> cliente${clientesReales !== 1 ? 's' : ''}</span>
            <span>🎟️ Prom: <strong>$${formatCurrency(ticket)}</strong></span>
          </div>
          <div class="mi-meta-motivational-msg">
            ${motivationalMsg}
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Actualizar KPIs Globales
    const pctGlobal = granTotalMeta > 0 ? Math.round((granTotalVentas / granTotalMeta) * 100) : (granTotalVentas > 0 ? 100 : 0);

    const kTotal = document.getElementById('kpi-mi-meta-total');
    if (kTotal) kTotal.textContent = `$${formatCurrency(granTotalMeta)}`;

    const kVentas = document.getElementById('kpi-mi-meta-ventas');
    if (kVentas) kVentas.textContent = `$${formatCurrency(granTotalVentas)}`;

    const kPct = document.getElementById('kpi-mi-meta-pct');
    if (kPct) kPct.textContent = `${pctGlobal}%`;

    const kMini = document.getElementById('kpi-mi-meta-mini-fill');
    if (kMini) kMini.style.width = `${Math.min(100, Math.max(0, pctGlobal))}%`;

    const kDias = document.getElementById('kpi-mi-meta-dias');
    if (kDias) {
      if (miMetaPeriodoModo === 'dia') kDias.textContent = 'Hoy';
      else kDias.textContent = `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`;
    }
  }

  // =========================================================================
  // 7. REPORTE DIARIO DE INGRESOS (SALÓN Y ACADEMIA)
  // =========================================================================
  let currentRepIngresosVentas = [];
  let repActiveUnitFilter = 'todas';
  let repActiveView = 'tabla'; // 'tabla' o 'cards'

  function getVentaUnidad(v) {
    const est = (v.estacion || '').toLowerCase();
    const serv = (v.servicio || '').toLowerCase();
    const tipo = (v.tipo || '').toLowerCase();

    // 1. Academia Total Beauty
    if (
      est.includes('academia') ||
      est.includes('curso') ||
      serv.includes('curso') ||
      serv.includes('taller') ||
      serv.includes('diplomado') ||
      serv.includes('masterclass') ||
      tipo === 'curso' ||
      (Array.isArray(catServicios) && catServicios.some(s => s.nombre === v.servicio && s.tipo === 'Curso'))
    ) {
      return 'academia';
    }

    // 2. Retail / Productos
    if (
      est.includes('retail') ||
      est.includes('producto') ||
      tipo === 'producto' ||
      (Array.isArray(catServicios) && catServicios.some(s => s.nombre === v.servicio && s.tipo === 'Producto'))
    ) {
      return 'retail';
    }

    // 3. Salón de Belleza
    return 'salon';
  }

  async function renderIngresosReport() {
    const fIn = document.getElementById('rep_ingresos_fecha');
    if (!fIn) return;
    if (!fIn.value) fIn.value = getHidalgoDateStr();
    const fecha = fIn.value;

    const tbody = document.getElementById('rep-ventas-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="padding:30px; color:var(--muted);">Cargando reporte de ingresos en vivo...</td></tr>';
    }

    const ventas = await TB_FIREBASE.getVentasByFecha(fecha);
    
    // Clasificar unidad en cada venta
    ventas.forEach(v => {
      v._unidad = getVentaUnidad(v);
    });

    currentRepIngresosVentas = ventas;

    // Métricas financieras globales
    let totEfec = 0, countEfec = 0;
    let totTarj = 0, countTarj = 0;
    let totTransf = 0, countTransf = 0;
    let totSalon = 0, countSalon = 0;
    let totAcad = 0, countAcad = 0;
    let totRetail = 0, countRetail = 0;

    const stationTotals = {};
    const servicesCount = {};

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const mp = (v.metodoPago || '').toLowerCase();
      
      if (v.desglosePago) {
        const e = parseFloat(v.desglosePago.efectivo) || 0;
        const j = parseFloat(v.desglosePago.tarjeta) || 0;
        const t = parseFloat(v.desglosePago.transferencia) || 0;
        totEfec += e; if (e > 0) countEfec++;
        totTarj += j; if (j > 0) countTarj++;
        totTransf += t; if (t > 0) countTransf++;
      } else {
        if (mp.includes('tarj')) {
          totTarj += imp;
          countTarj++;
        } else if (mp.includes('transf')) {
          totTransf += imp;
          countTransf++;
        } else {
          totEfec += imp;
          countEfec++;
        }
      }

      if (v._unidad === 'academia') {
        totAcad += imp;
        countAcad++;
        const key = '🎓 Academia Total Beauty';
        if (!stationTotals[key]) stationTotals[key] = { name: key, total: 0, count: 0, isAcad: true };
        stationTotals[key].total += imp;
        stationTotals[key].count++;
      } else if (v._unidad === 'retail') {
        totRetail += imp;
        countRetail++;
        const key = '🛍️ Retail / Productos';
        if (!stationTotals[key]) stationTotals[key] = { name: key, total: 0, count: 0, isRetail: true };
        stationTotals[key].total += imp;
        stationTotals[key].count++;
      } else {
        totSalon += imp;
        countSalon++;
        const stName = v.estacion || 'Estación General';
        const key = `💈 ${stName}`;
        if (!stationTotals[key]) stationTotals[key] = { name: key, total: 0, count: 0, isSalon: true };
        stationTotals[key].total += imp;
        stationTotals[key].count++;
      }

      // Conteo para ranking
      const sName = v.servicio || (v._unidad === 'academia' ? 'Curso / Taller' : 'Servicio General');
      if (!servicesCount[sName]) {
        servicesCount[sName] = {
          name: sName,
          unidad: v._unidad,
          count: 0,
          total: 0
        };
      }
      servicesCount[sName].count++;
      servicesCount[sName].total += imp;
    });

    const totalGeneral = totEfec + totTarj + totTransf;
    const countGeneral = ventas.length;
    const ticketPromedio = countGeneral > 0 ? (totalGeneral / countGeneral) : 0;

    // Actualizar KPIs de cabecera
    const kTot = document.getElementById('kpi-ingreso-total');
    if (kTot) kTot.textContent = formatCurrency(totalGeneral);
    const kTotSub = document.getElementById('kpi-ingreso-total-sub');
    if (kTotSub) kTotSub.textContent = `${countGeneral} operaciones cobradas`;

    const pctSalon = totalGeneral > 0 ? Math.round((totSalon / totalGeneral) * 100) : 0;
    const pctAcad = totalGeneral > 0 ? Math.round((totAcad / totalGeneral) * 100) : 0;
    const pctRetail = totalGeneral > 0 ? Math.round((totRetail / totalGeneral) * 100) : 0;

    const sVal = document.getElementById('rep_salon_val');
    if (sVal) sVal.textContent = formatCurrency(totSalon);
    const sPct = document.getElementById('rep_salon_pct');
    if (sPct) sPct.textContent = `${pctSalon}% del total (${countSalon} servicios)`;

    const aVal = document.getElementById('rep_academia_val');
    if (aVal) aVal.textContent = formatCurrency(totAcad);
    const aPct = document.getElementById('rep_academia_pct');
    if (aPct) aPct.textContent = `${pctAcad}% del total (${countAcad} cursos)`;

    const rVal = document.getElementById('rep_retail_val');
    if (rVal) rVal.textContent = formatCurrency(totRetail);
    const rPct = document.getElementById('rep_retail_pct');
    if (rPct) rPct.textContent = `${pctRetail}% del total (${countRetail} productos)`;

    const tEl = document.getElementById('kpi-ingreso-ticket');
    if (tEl) tEl.textContent = formatCurrency(ticketPromedio);

    let pred = 'Efectivo';
    let predVal = totEfec;
    if (totTarj > totEfec && totTarj > totTransf) { pred = 'Tarjeta'; predVal = totTarj; }
    if (totTransf > totEfec && totTransf > totTarj) { pred = 'Transferencia'; predVal = totTransf; }
    const mPred = document.getElementById('kpi-ingreso-metodo');
    if (mPred) mPred.textContent = pred;
    const mPredSub = document.getElementById('kpi-ingreso-metodo-sub');
    if (mPredSub) mPredSub.textContent = formatCurrency(predVal);

    // Actualizar Tabla de Métodos de Pago
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('rep_efectivo_count', countEfec);
    setTxt('rep_efectivo_val', formatCurrency(totEfec));
    setTxt('rep_efectivo_pct', totalGeneral > 0 ? `${Math.round((totEfec / totalGeneral) * 100)}%` : '0%');

    setTxt('rep_tarjeta_count', countTarj);
    setTxt('rep_tarjeta_val', formatCurrency(totTarj));
    setTxt('rep_tarjeta_pct', totalGeneral > 0 ? `${Math.round((totTarj / totalGeneral) * 100)}%` : '0%');

    setTxt('rep_transf_count', countTransf);
    setTxt('rep_transf_val', formatCurrency(totTransf));
    setTxt('rep_transf_pct', totalGeneral > 0 ? `${Math.round((totTransf / totalGeneral) * 100)}%` : '0%');

    setTxt('rep_metodos_count', countGeneral);
    setTxt('rep_metodos_total', formatCurrency(totalGeneral));

    // Actualizar Tabla de Estaciones y Academia
    const estTbody = document.getElementById('rep_estaciones_tbody');
    if (estTbody) {
      estTbody.innerHTML = '';
      const stEntries = Object.values(stationTotals).sort((a, b) => b.total - a.total);
      
      if (stEntries.length === 0) {
        estTbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding:16px; color:var(--muted);">Sin ingresos registrados en esta fecha</td></tr>';
      } else {
        stEntries.forEach(item => {
          const pctSt = totalGeneral > 0 ? Math.round((item.total / totalGeneral) * 100) : 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="font-weight:700;">${escapeHtml(item.name)}</td>
            <td class="text-center">${item.count}</td>
            <td class="text-right font-bold">${formatCurrency(item.total)}</td>
            <td class="text-right">${pctSt}%</td>
          `;
          estTbody.appendChild(tr);
        });
      }
    }
    setTxt('rep_unidades_count', countGeneral);
    setTxt('rep_unidades_total', formatCurrency(totalGeneral));

    // Actualizar contadores de las pestañas
    setTxt('count-rep-todas', countGeneral);
    setTxt('count-rep-salon', countSalon);
    setTxt('count-rep-academia', countAcad);
    setTxt('count-rep-retail', countRetail);

    // Renderizar Ranking de Servicios y Cursos
    renderIngresosRanking(Object.values(servicesCount), totalGeneral);

    // Renderizar Detalle de Operaciones
    renderIngresosVentasDetalle();
  }

  function renderIngresosRanking(rankingList, totalGeneral) {
    const container = document.getElementById('rep-ranking-container');
    const countEl = document.getElementById('rep-ranking-count');
    if (!container) return;

    rankingList.sort((a, b) => b.total - a.total);

    if (countEl) countEl.textContent = `${rankingList.length} servicios/cursos diferentes`;

    if (rankingList.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted);">Sin servicios registrados en esta fecha</div>';
      return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'rep-ranking-grid';

    rankingList.forEach(item => {
      const pct = totalGeneral > 0 ? Math.round((item.total / totalGeneral) * 100) : 0;
      
      let unitBadge = '<span class="badge-unit-salon">💇‍♀️ Salón</span>';
      let barColor = '#ec4899';
      if (item.unidad === 'academia') {
        unitBadge = '<span class="badge-unit-academia">🎓 Academia</span>';
        barColor = '#059669';
      } else if (item.unidad === 'retail') {
        unitBadge = '<span class="badge-unit-retail">🛍️ Retail</span>';
        barColor = '#0284c7';
      }

      const card = document.createElement('div');
      card.className = 'rep-ranking-card';
      card.innerHTML = `
        <div class="rep-ranking-header">
          <div class="rep-ranking-title">${escapeHtml(item.name)}</div>
          ${unitBadge}
        </div>
        <div class="rep-ranking-meta">
          <span>${item.count} ${item.count === 1 ? 'venta' : 'ventas'}</span>
          <strong style="color:var(--dark); font-size:0.9rem;">${formatCurrency(item.total)}</strong>
        </div>
        <div class="rep-ranking-bar-bg">
          <div class="rep-ranking-bar-fill" style="width:${Math.max(4, Math.min(100, pct))}%; background:${barColor};"></div>
        </div>
        <div style="font-size:0.72rem; color:var(--muted); text-align:right;">
          ${pct}% del ingreso del día
        </div>
      `;
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  function renderIngresosVentasDetalle() {
    const tbody = document.getElementById('rep-ventas-tbody');
    const cardsContainer = document.getElementById('rep-cards-view');
    const countBadge = document.getElementById('rep-ventas-count-badge');
    const searchVal = (document.getElementById('rep_ingresos_search')?.value || '').trim().toLowerCase();

    let filtered = currentRepIngresosVentas || [];

    // Filtro por unidad
    if (repActiveUnitFilter && repActiveUnitFilter !== 'todas') {
      filtered = filtered.filter(v => v._unidad === repActiveUnitFilter);
    }

    // Filtro por búsqueda
    if (searchVal) {
      filtered = filtered.filter(v => {
        const serv = (v.servicio || '').toLowerCase();
        const cli = (v.clienta || '').toLowerCase();
        const esp = (v.especialista || '').toLowerCase();
        const est = (v.estacion || '').toLowerCase();
        const mp = (v.metodoPago || '').toLowerCase();
        const not = (v.notas || '').toLowerCase();
        return serv.includes(searchVal) || cli.includes(searchVal) || esp.includes(searchVal) || est.includes(searchVal) || mp.includes(searchVal) || not.includes(searchVal);
      });
    }

    if (countBadge) countBadge.textContent = `${filtered.length} Operaciones`;

    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center" style="padding:40px 20px; color:var(--muted);">
            <span style="font-size:2rem; display:block; margin-bottom:8px;">📋</span>
            <strong>No se encontraron operaciones registradas</strong>
            <p style="font-size:0.8rem; margin-top:4px; margin-bottom:0;">
              ${searchVal ? 'Intente con otro término de búsqueda o cambie el filtro de unidad.' : 'No hay ventas guardadas para la fecha seleccionada.'}
            </p>
          </td>
        </tr>
      `;
      if (cardsContainer) {
        cardsContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted);">No hay operaciones registradas</div>';
      }
      return;
    }

    // Renderizar filas de la tabla
    tbody.innerHTML = '';
    if (cardsContainer) cardsContainer.innerHTML = '';

    filtered.forEach((v, idx) => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const horaStr = v.createdAt ? v.createdAt.substring(11, 16) : '--:--';
      const folio = `#${idx + 1}`;

      // Badge de unidad
      let unitBadge = '<span class="badge-unit-salon">💇‍♀️ Salón</span>';
      if (v._unidad === 'academia') {
        unitBadge = '<span class="badge-unit-academia">🎓 Academia</span>';
      } else if (v._unidad === 'retail') {
        unitBadge = '<span class="badge-unit-retail">🛍️ Retail</span>';
      }

      // Badge de método de pago
      const mpLower = (v.metodoPago || '').toLowerCase();
      let mpBadge = '<span class="badge-metodo badge-efectivo">💵 Efectivo</span>';
      if (mpLower.includes('tarj')) {
        mpBadge = '<span class="badge-metodo badge-tarjeta">💳 Tarjeta</span>';
      } else if (mpLower.includes('transf')) {
        mpBadge = '<span class="badge-metodo badge-transferencia">📱 Transf</span>';
      }

      // Avatar inicial clienta
      const initial = (v.clienta || 'C').charAt(0).toUpperCase();

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:0.82rem; font-family:monospace; font-weight:700; color:var(--slate);">
          ${folio} <small style="display:block; color:var(--muted);">${horaStr}</small>
        </td>
        <td>${unitBadge}</td>
        <td>
          <strong style="color:var(--dark); font-size:0.9rem;">${escapeHtml(v.servicio || 'Servicio')}</strong>
          ${v.tipo ? `<small style="display:block; color:var(--muted); font-size:0.75rem;">${escapeHtml(v.tipo)}</small>` : ''}
        </td>
        <td class="text-right" style="font-size:1.05rem; font-weight:800; color:#15803d; white-space:nowrap;">
          ${formatCurrency(imp)}
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="user-avatar-initial" style="width:28px; height:28px; font-size:0.75rem;">${initial}</div>
            <div>
              <span style="font-weight:700; font-size:0.85rem; color:var(--dark);">${escapeHtml(v.clienta || 'Público Mostrador')}</span>
              ${v.telefono ? `<small style="display:block; color:var(--muted); font-size:0.72rem;">📱 ${escapeHtml(v.telefono)}</small>` : ''}
            </div>
          </div>
        </td>
        <td style="font-size:0.85rem; font-weight:600; color:var(--slate);">
          ${escapeHtml(v.especialista || '--')}
        </td>
        <td style="font-size:0.82rem; color:var(--slate);">
          <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-weight:600;">
            ${v._unidad === 'academia' ? '🎓 Academia' : escapeHtml(v.estacion || 'General')}
          </span>
        </td>
        <td>${mpBadge}</td>
        <td>
          <span class="status-badge status-pagado" style="font-size:0.75rem; padding:2px 8px;">
            ${escapeHtml(v.statusPago || 'Cobrado')}
          </span>
        </td>
        <td style="font-size:0.78rem; color:var(--muted); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(v.notas || '')}">
          ${escapeHtml(v.notas || '--')}
        </td>
      `;
      tbody.appendChild(tr);

      // Card para vista móvil
      if (cardsContainer) {
        const card = document.createElement('div');
        card.className = 'venta-item-card';
        card.innerHTML = `
          <div class="venta-card-top">
            <div style="display:flex; align-items:center; gap:8px;">
              ${unitBadge}
              <span style="font-size:0.75rem; font-weight:700; color:var(--muted); font-family:monospace;">${folio} (${horaStr})</span>
            </div>
            <div class="venta-card-amount">${formatCurrency(imp)}</div>
          </div>
          <div class="venta-card-service" style="margin-top:6px;">${escapeHtml(v.servicio || 'Servicio')}</div>
          <div class="venta-card-meta-grid" style="margin-top:8px;">
            <div class="meta-item"><span class="meta-label">Clienta / Alumna:</span><span class="meta-val">${escapeHtml(v.clienta || 'Público')}</span></div>
            <div class="meta-item"><span class="meta-label">Especialista:</span><span class="meta-val">${escapeHtml(v.especialista || '--')}</span></div>
            <div class="meta-item"><span class="meta-label">Estación:</span><span class="meta-val">${escapeHtml(v.estacion || 'General')}</span></div>
            <div class="meta-item"><span class="meta-label">Método:</span><span class="meta-val">${mpBadge}</span></div>
          </div>
          ${v.notas ? `<div style="font-size:0.75rem; color:var(--muted); margin-top:6px; background:#f8fafc; padding:4px 8px; border-radius:4px;">📝 ${escapeHtml(v.notas)}</div>` : ''}
        `;
        cardsContainer.appendChild(card);
      }
    });
  }

  function populateIngresosPrintable() {
    const fIn = document.getElementById('rep_ingresos_fecha');
    const fecha = fIn?.value || getHidalgoDateStr();
    const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Administración Total Beauty';
    const now = new Date();
    const horaEmision = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    setTxt('pi_fecha', formatDateDisplay(fecha));
    setTxt('pi_responsable', userEmail);
    setTxt('pi_hora', horaEmision);
    setTxt('pi_firma_resp_name', userEmail);

    const ventas = currentRepIngresosVentas || [];

    let totEfec = 0, countEfec = 0;
    let totTarj = 0, countTarj = 0;
    let totTransf = 0, countTransf = 0;
    let totSalon = 0, countSalon = 0;
    let totAcad = 0, countAcad = 0;
    let totRetail = 0, countRetail = 0;

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const mp = (v.metodoPago || '').toLowerCase();
      if (v.desglosePago) {
        const e = parseFloat(v.desglosePago.efectivo) || 0;
        const j = parseFloat(v.desglosePago.tarjeta) || 0;
        const t = parseFloat(v.desglosePago.transferencia) || 0;
        totEfec += e; if (e > 0) countEfec++;
        totTarj += j; if (j > 0) countTarj++;
        totTransf += t; if (t > 0) countTransf++;
      } else {
        if (mp.includes('tarj')) { totTarj += imp; countTarj++; }
        else if (mp.includes('transf')) { totTransf += imp; countTransf++; }
        else { totEfec += imp; countEfec++; }
      }

      if (v._unidad === 'academia') { totAcad += imp; countAcad++; }
      else if (v._unidad === 'retail') { totRetail += imp; countRetail++; }
      else { totSalon += imp; countSalon++; }
    });

    const totalGeneral = totEfec + totTarj + totTransf;
    const countGeneral = ventas.length;

    // Resumen ejecutivo tabla
    const resTbody = document.getElementById('pi_resumen_tbody');
    if (resTbody) {
      resTbody.innerHTML = `
        <tr>
          <td>💇‍♀️ Salón de Belleza</td>
          <td class="amount">${countSalon}</td>
          <td class="amount">${formatCurrency(totSalon)}</td>
          <td class="amount">${totalGeneral > 0 ? Math.round((totSalon / totalGeneral) * 100) : 0}%</td>
        </tr>
        <tr>
          <td>🎓 Academia Total Beauty (Cursos & Talleres)</td>
          <td class="amount">${countAcad}</td>
          <td class="amount">${formatCurrency(totAcad)}</td>
          <td class="amount">${totalGeneral > 0 ? Math.round((totAcad / totalGeneral) * 100) : 0}%</td>
        </tr>
        <tr>
          <td>🛍️ Retail / Venta de Productos</td>
          <td class="amount">${countRetail}</td>
          <td class="amount">${formatCurrency(totRetail)}</td>
          <td class="amount">${totalGeneral > 0 ? Math.round((totRetail / totalGeneral) * 100) : 0}%</td>
        </tr>
      `;
    }
    setTxt('pi_total_ops', countGeneral);
    setTxt('pi_total_ingreso', formatCurrency(totalGeneral));

    // Métodos tabla
    setTxt('pi_efec_ops', countEfec);
    setTxt('pi_efec_val', formatCurrency(totEfec));
    setTxt('pi_efec_pct', totalGeneral > 0 ? `${Math.round((totEfec / totalGeneral) * 100)}%` : '0%');

    setTxt('pi_tarj_ops', countTarj);
    setTxt('pi_tarj_val', formatCurrency(totTarj));
    setTxt('pi_tarj_pct', totalGeneral > 0 ? `${Math.round((totTarj / totalGeneral) * 100)}%` : '0%');

    setTxt('pi_transf_ops', countTransf);
    setTxt('pi_transf_val', formatCurrency(totTransf));
    setTxt('pi_transf_pct', totalGeneral > 0 ? `${Math.round((totTransf / totalGeneral) * 100)}%` : '0%');

    // Detalle tabla
    const detTbody = document.getElementById('pi_detalle_tbody');
    if (detTbody) {
      detTbody.innerHTML = '';
      if (ventas.length === 0) {
        detTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:14px; color:#666;">Sin operaciones registradas en esta fecha</td></tr>';
      } else {
        ventas.forEach((v, idx) => {
          const imp = parseFloat(v.totalCobrado) || 0;
          const horaStr = v.createdAt ? v.createdAt.substring(11, 16) : '--:--';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>#${idx + 1} (${horaStr})</td>
            <td><strong>${escapeHtml(v.servicio || 'Servicio')}</strong> <span style="font-size:0.75rem; color:#666;">(${v._unidad === 'academia' ? 'Academia' : (v._unidad === 'retail' ? 'Retail' : 'Salón')})</span></td>
            <td>${escapeHtml(v.clienta || 'Público')}</td>
            <td>${escapeHtml(v.especialista || '--')}</td>
            <td>${escapeHtml(v.metodoPago || 'Efectivo')}</td>
            <td class="amount">${formatCurrency(imp)}</td>
          `;
          detTbody.appendChild(tr);
        });
      }
    }

    return `Reporte_Diario_Ingresos_${fecha}.pdf`;
  }

  function openIngresosPdfViewer() {
    const fIn = document.getElementById('rep_ingresos_fecha');
    const fecha = fIn?.value || getHidalgoDateStr();
    const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Administración Total Beauty';
    const totIng = document.getElementById('kpi-ingreso-total')?.textContent || '$0.00';
    const efecTot = document.getElementById('kpi-ingreso-efectivo')?.textContent || '$0.00';
    const transfTot = document.getElementById('kpi-ingreso-transferencia')?.textContent || '$0.00';
    const tarjTot = document.getElementById('kpi-ingreso-tarjeta')?.textContent || '$0.00';
    const srvTot = document.getElementById('kpi-ingreso-servicios')?.textContent || '$0.00';
    const curTot = document.getElementById('kpi-ingreso-cursos')?.textContent || '$0.00';
    const prdTot = document.getElementById('kpi-ingreso-productos')?.textContent || '$0.00';

    const item = {
      isIngresos: true,
      fecha,
      responsable: userEmail,
      ingresos: {
        totales: { granTotal: totIng, efectivo: efecTot, transferencia: transfTot, tarjeta: tarjTot }
      }
    };
    activeViewingReport = { isIngresos: true, isChica: false, item, key: 'ING-' + fecha };

    const modalTitle = document.getElementById('pdf-modal-title');
    const modalSub = document.getElementById('pdf-modal-subtitle');
    const previewContainer = document.getElementById('pdf-preview-container');
    const modal = document.getElementById('modal-view-pdf-report');

    if (modalTitle) modalTitle.innerHTML = '<span>🧾</span> Ticket: Ingresos Diarios';
    if (modalSub) modalSub.innerHTML = `📅 <strong>${formatDateDisplay(fecha)}</strong> &bull; Total: <strong>${totIng}</strong>`;

    if (previewContainer) {
      previewContainer.innerHTML = `
        <div class="tb-ticket-container" id="printable-ticket-content">
          <div class="tb-ticket-header">
            <img src="assets/logoheader.png" alt="Total Beauty" class="tb-ticket-logo" onerror="this.src=TOTAL_BEAUTY_LOGO_BASE64">
            <h2 class="tb-ticket-brand">TOTAL BEAUTY</h2>
            <div class="tb-ticket-subbrand">SALÓN &bull; ACADEMY</div>
            <div class="tb-ticket-pill-type">REPORTE DIARIO DE INGRESOS</div>
          </div>
          <div class="tb-ticket-body">
            <div class="tb-ticket-meta">
              <div class="tb-ticket-meta-row"><span class="tb-ticket-meta-label">📅 Fecha:</span><span class="tb-ticket-meta-val">${formatDateDisplay(fecha)}</span></div>
              <div class="tb-ticket-meta-row"><span class="tb-ticket-meta-label">👤 Generó:</span><span class="tb-ticket-meta-val">${escapeHtml(userEmail)}</span></div>
              <div class="tb-ticket-meta-row"><span class="tb-ticket-meta-label">🏷️ Clave:</span><span class="tb-ticket-folio-badge">ING-${fecha}</span></div>
            </div>
            <div class="tb-ticket-status-badge tb-ticket-status-cuadrada">
              💰 GRAN TOTAL INGRESOS: ${totIng}
            </div>
            <div class="tb-ticket-section-title"><span>💳</span> Por Método de Pago</div>
            <div class="tb-ticket-row"><span>Efectivo:</span><span class="tb-ticket-amount">${efecTot}</span></div>
            <div class="tb-ticket-row"><span>Transferencias:</span><span class="tb-ticket-amount">${transfTot}</span></div>
            <div class="tb-ticket-row"><span>Tarjetas:</span><span class="tb-ticket-amount">${tarjTot}</span></div>
            <hr class="tb-ticket-divider">
            <div class="tb-ticket-section-title"><span>🏷️</span> Por Unidad de Negocio</div>
            <div class="tb-ticket-row"><span>Servicios del Salón:</span><span class="tb-ticket-amount">${srvTot}</span></div>
            <div class="tb-ticket-row"><span>Cursos y Academia:</span><span class="tb-ticket-amount">${curTot}</span></div>
            <div class="tb-ticket-row"><span>Venta de Productos:</span><span class="tb-ticket-amount">${prdTot}</span></div>
            <hr class="tb-ticket-divider">
            <div style="font-size:0.75rem; color:#64748b; text-align:center; padding:4px 0;">
              Total Beauty Portal Oficial &bull; Reporte en tiempo real
            </div>
          </div>
          <div class="tb-ticket-footer">
            <div><strong>TOTAL BEAUTY SALON &amp; ACADEMY</strong></div>
            <div>Sistema Administrativo Sincronizado en Firebase</div>
          </div>
        </div>
      `;
    }

    if (modal) {
      modal.style.display = 'flex';
      const body = document.getElementById('pdf-modal-body');
      if (body) body.scrollTop = 0;
    }
  }


  // =========================================================================
  // 8. INTERESADAS Y CIERRES (1: BALANCESCORE, 2: NUEVO REGISTRO, 3: SEGUIMIENTO)
  // =========================================================================
  let activeLeadId = null;

  function getTipifBadgeHtml(tipif) {
    const t = (tipif || '').toLowerCase();
    if (t === 'cierre') {
      return '<span class="status-badge status-pagado" style="font-weight:800; padding:3px 10px;">🟢 Cierre</span>';
    } else if (t === 'en seguimiento') {
      return '<span class="status-badge status-pendiente" style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe; font-weight:800; padding:3px 10px;">🟣 En seguimiento</span>';
    } else if (t === 'solo pregunta') {
      return '<span class="status-badge status-pendiente" style="background:#fef9c3; color:#854d0e; border:1px solid #fde047; font-weight:800; padding:3px 10px;">🟡 Solo pregunta</span>';
    } else if (t === 'no interesada') {
      return '<span class="status-badge status-diferencia" style="font-weight:700; padding:3px 10px;">⚪ No interesada</span>';
    } else {
      return '<span class="status-badge status-pendiente" style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; font-weight:800; padding:3px 10px;">🔵 Interesada</span>';
    }
  }

  function switchLeadOption(optNum) {
    currentLeadOption = parseInt(optNum, 10) || 1;

    document.querySelectorAll('.option-pill').forEach(btn => {
      if (parseInt(btn.dataset.opt, 10) === currentLeadOption) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    [1, 2, 3].forEach(n => {
      const el = document.getElementById(`lead-subview-${n}`);
      if (el) el.style.display = (n === currentLeadOption) ? 'block' : 'none';
    });

    // Opción 1: BalanceScore de Conversión
    if (currentLeadOption === 1) renderLeadsBalanceScore();
    // Opción 3: Directorio de Seguimiento
    if (currentLeadOption === 3) renderLeadsDirectory();

    const leadOptLabels = {
      1: '1. BalanceScore de Conversión Comercial',
      2: '2. Nuevo Registro & Tipificación',
      3: '3. Seguimiento en Tipificación'
    };
    logAuditMovement({
      modulo: 'Interesadas',
      accion: 'ACCESO_OPCION_LEADS',
      descripcion: `Ingreso a la opción: ${leadOptLabels[currentLeadOption] || currentLeadOption}`,
      payload: { opcion: currentLeadOption },
      reversible: false
    });
  }

  function loadInteresadasView() {
    const fReg = document.getElementById('lead_reg_fecha');
    if (fReg && !fReg.value) fReg.value = getHidalgoDateStr();
    switchLeadOption(currentLeadOption || 1);
  }

  // Opción 1: BalanceScore de Conversión Comercial en Tiempo Real
  async function renderLeadsBalanceScore() {
    const leads = await TB_FIREBASE.getLeadsAll();

    const total = leads.length;
    const preguntan = leads.filter(l => l.tipificacion === 'Solo pregunta').length;
    const seguimiento = leads.filter(l => l.tipificacion === 'En seguimiento').length;
    const cierres = leads.filter(l => l.tipificacion === 'Cierre').length;

    const tasa = total > 0 ? Math.round((cierres / total) * 100) : 0;

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    setTxt('kpi-bs-leads-total', total);
    setTxt('kpi-bs-leads-preguntan', preguntan);
    setTxt('kpi-bs-leads-seguimiento', seguimiento);
    setTxt('kpi-bs-leads-cierres', cierres);

    setTxt('visual-bs-interesadas', total);
    setTxt('visual-bs-preguntan', preguntan);
    setTxt('visual-bs-seguimiento', seguimiento);
    setTxt('visual-bs-cierres', cierres);
    setTxt('visual-bs-tasa', `${tasa}%`);

    // Comparativa Salón vs Academia
    const salonLeads = leads.filter(l => (l.unidad || '').includes('Salón'));
    const salonCierres = salonLeads.filter(l => l.tipificacion === 'Cierre').length;
    const salonTasa = salonLeads.length > 0 ? Math.round((salonCierres / salonLeads.length) * 100) : 0;

    const acadLeads = leads.filter(l => (l.unidad || '').includes('Academia'));
    const acadCierres = acadLeads.filter(l => l.tipificacion === 'Cierre').length;
    const acadTasa = acadLeads.length > 0 ? Math.round((acadCierres / acadLeads.length) * 100) : 0;

    setTxt('bs-salon-leads', salonLeads.length);
    setTxt('bs-salon-cierres', salonCierres);
    setTxt('bs-salon-tasa', `${salonTasa}%`);

    setTxt('bs-academia-leads', acadLeads.length);
    setTxt('bs-academia-cierres', acadCierres);
    setTxt('bs-academia-tasa', `${acadTasa}%`);

    // Desglose por Canal
    const canalCounts = {};
    leads.forEach(l => {
      const c = l.canal || 'WhatsApp';
      if (!canalCounts[c]) canalCounts[c] = { total: 0, cierres: 0 };
      canalCounts[c].total += 1;
      if (l.tipificacion === 'Cierre') canalCounts[c].cierres += 1;
    });

    const tbodyCanal = document.getElementById('tbody-bs-canales');
    if (tbodyCanal) {
      tbodyCanal.innerHTML = '';
      const canales = Object.keys(canalCounts);
      if (canales.length === 0) {
        tbodyCanal.innerHTML = '<tr><td colspan="4" class="text-center" style="color:var(--muted); padding:14px;">No hay canales registrados aún</td></tr>';
      } else {
        canales.forEach(c => {
          const inf = canalCounts[c];
          const pct = inf.total > 0 ? Math.round((inf.cierres / inf.total) * 100) : 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${escapeHtml(c)}</strong></td>
            <td class="text-right">${inf.total}</td>
            <td class="text-right" style="font-weight:700; color:var(--success);">${inf.cierres}</td>
            <td class="text-right" style="font-weight:800;">${pct}%</td>
          `;
          tbodyCanal.appendChild(tr);
        });
      }
    }
  }

  // Opción 3: Directorio de Seguimiento por Llamada o WhatsApp (Ordenado por el más antiguo primero, sin eliminar)
  async function renderLeadsDirectory() {
    const container = document.getElementById('lead-directory-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--muted);">Cargando directorio de prospectos...</div>';

    const leads = await TB_FIREBASE.getLeadsAll();
    const filtroTipif = document.getElementById('filtro_lead_tipif')?.value || 'TODAS';
    const filtroUnidad = document.getElementById('filtro_lead_unidad')?.value || 'TODAS';
    const query = (document.getElementById('buscador_leads')?.value || '').toLowerCase().trim();

    // Filtrar por Tipificación Actual, Unidad y Buscador
    const filtered = leads.filter(l => {
      if (filtroTipif !== 'TODAS' && (l.tipificacion || 'Interesada') !== filtroTipif) return false;
      if (filtroUnidad !== 'TODAS' && (l.unidad || '').toLowerCase() !== filtroUnidad.toLowerCase()) return false;
      if (query) {
        const nom = (l.nombre || '').toLowerCase();
        const tel = (l.telefono || '').toLowerCase();
        const serv = (l.servicio || '').toLowerCase();
        if (!nom.includes(query) && !tel.includes(query) && !serv.includes(query)) return false;
      }
      return true;
    });

    const badge = document.getElementById('lead-counter-badge');
    if (badge) badge.textContent = `${filtered.length} Prospectos`;

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:45px 20px; color:var(--muted); background:#fff; border-radius:12px; border:1px dashed var(--border);">
          <span style="font-size:2.2rem; display:block; margin-bottom:8px;">📭</span>
          <h4 style="color:var(--dark); margin-bottom:4px;">No se encontraron prospectos</h4>
          <p style="font-size:0.85rem; max-width:420px; margin:0 auto;">
            ${query || filtroTipif !== 'TODAS' ? 'Intente con otro filtro de tipificación o término de búsqueda.' : 'No hay interesadas registradas aún. Use la Opción 2 para dar de alta nuevos prospectos.'}
          </p>
        </div>
      `;
      return;
    }

    // ORDENAR POR EL MÁS ANTIGUO PRIMERO (Requisito explícito: orden cronológico ascendente)
    filtered.sort((a, b) => {
      const tA = (a.createdAt || a.fecha || '9999-99-99') + '';
      const tB = (b.createdAt || b.fecha || '9999-99-99') + '';
      return tA.localeCompare(tB);
    });

    filtered.forEach(l => {
      const cleanTel = (l.telefono || '').replace(/\D/g, '');
      const waMsg = encodeURIComponent(`Hola ${l.nombre || ''}, te saludamos de Total Beauty Salón y Academia ✨ Respecto a tu interés en ${l.servicio || 'nuestros servicios'}, ¿te gustaría agendar tu cita o resolver alguna duda?`);
      const waUrl = `https://wa.me/52${cleanTel}?text=${waMsg}`;
      const initial = (l.nombre || 'P').charAt(0).toUpperCase();

      const tipifActual = l.tipificacion || 'Interesada';
      const tipifBadge = getTipifBadgeHtml(tipifActual);
      const isAcad = (l.unidad || '').toLowerCase().includes('academia');

      const card = document.createElement('div');
      card.className = 'lead-dir-item';
      card.dataset.id = l.id;
      card.innerHTML = `
        <div class="lead-dir-left">
          <div class="lead-avatar">${initial}</div>
          <div class="lead-dir-info">
            <button type="button" class="lead-name-btn" data-id="${l.id}" title="Click para ver historial de contactos y tipificar">
              <span class="lead-name-text">${escapeHtml(l.nombre || 'Prospecto')}</span>
              <span class="lead-click-hint">👉 Ver Historial & Tipificar</span>
            </button>
            <div class="lead-subinfo">
              <span class="lead-service-tag">${escapeHtml(l.servicio || 'General')}</span>
              <span class="lead-date-tag">📅 Reg: ${formatDateDisplay(l.fecha)}</span>
              <span class="lead-unit-tag">${isAcad ? '🎓 Academia' : '💇‍♀️ Salón'}</span>
              ${l.canal ? `<span style="color:var(--muted); font-size:0.75rem;">(Vía: ${escapeHtml(l.canal)})</span>` : ''}
            </div>
          </div>
        </div>

        <div class="lead-dir-right">
          ${tipifBadge}
          <div class="lead-quick-actions">
            <a href="${waUrl}" target="_blank" class="btn-whatsapp btn-sm" title="Enviar WhatsApp a ${cleanTel}" style="text-decoration:none;">
              <span>💬</span> WhatsApp
            </a>
            <a href="tel:${cleanTel}" class="btn btn-secondary btn-sm" title="Llamar" style="text-decoration:none; padding:4px 8px;">
              <span>📞</span>
            </a>
            <button type="button" class="btn btn-primary btn-sm btn-open-lead-modal" data-id="${l.id}" style="font-weight:700;">
              <span>📋</span> Historial
            </button>
          </div>
        </div>
      `;

      // Click en el nombre o botón para ver historial y registrar tipificación
      card.querySelector('.lead-name-btn')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openLeadDetailModal(l.id);
      });
      card.querySelector('.btn-open-lead-modal')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openLeadDetailModal(l.id);
      });

      container.appendChild(card);
    });
  }

  // Modal de Detalle de Contactos e Historial de Tipificación
  async function openLeadDetailModal(leadId) {
    activeLeadId = leadId;
    const leads = await TB_FIREBASE.getLeadsAll();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const modal = document.getElementById('modal-lead-detalle');
    if (!modal) return;

    logAuditMovement({
      modulo: 'Interesadas',
      accion: 'CONSULTA_HISTORIAL_LEAD',
      descripcion: `Consulta de expediente e historial de contactos de la interesada: ${lead.nombre || 'Prospecto'} (${lead.telefono || 'Sin teléfono'})`,
      payload: { leadId, nombre: lead.nombre, tipificacion: lead.tipificacion },
      reversible: false
    });

    // Poblar información
    document.getElementById('mlead-nombre').textContent = lead.nombre || 'Prospecto';
    const cleanTel = (lead.telefono || '').replace(/\D/g, '');
    const isAcad = (lead.unidad || '').toLowerCase().includes('academia');
    const subText = `📱 ${lead.telefono || 'Sin teléfono'} • ${isAcad ? '🎓 Academia' : '💇‍♀️ Salón'} • 📅 Registro: ${formatDateDisplay(lead.fecha)}`;
    document.getElementById('mlead-sub').textContent = subText;

    document.getElementById('mlead-servicio').textContent = lead.servicio || 'No especificado';
    document.getElementById('mlead-canal').textContent = lead.canal || 'WhatsApp';

    const waMsg = encodeURIComponent(`Hola ${lead.nombre || ''}, te saludamos de Total Beauty Salón y Academia ✨ Respecto a tu interés en ${lead.servicio || 'nuestros servicios'}, ¿te gustaría agendar tu cita o resolver alguna duda?`);
    const waUrl = `https://wa.me/52${cleanTel}?text=${waMsg}`;
    const btnWa = document.getElementById('mlead-btn-wa');
    if (btnWa) btnWa.href = waUrl;
    const btnCall = document.getElementById('mlead-btn-call');
    if (btnCall) btnCall.href = `tel:${cleanTel}`;

    const tipifActual = lead.tipificacion || 'Interesada';
    const badgeTipif = document.getElementById('mlead-tipif-actual');
    if (badgeTipif) {
      badgeTipif.innerHTML = getTipifBadgeHtml(tipifActual);
    }

    const selTipif = document.getElementById('mlead_new_tipif');
    if (selTipif) selTipif.value = tipifActual;

    renderLeadTimeline(lead);

    modal.style.display = 'flex';
  }

  function closeLeadDetailModal() {
    const modal = document.getElementById('modal-lead-detalle');
    if (modal) modal.style.display = 'none';
    activeLeadId = null;
  }

  function renderLeadTimeline(lead) {
    const container = document.getElementById('mlead-timeline-container');
    if (!container) return;

    container.innerHTML = '';

    const historial = (lead.historialSeguimiento && lead.historialSeguimiento.length > 0)
      ? [...lead.historialSeguimiento]
      : [];

    if (historial.length === 0) {
      historial.push({
        fechaHora: lead.createdAt || (lead.fecha ? lead.fecha + 'T10:00:00.000Z' : new Date().toISOString()),
        medio: lead.canal || 'WhatsApp',
        accion: 'Registro inicial del prospecto',
        tipificacion: lead.tipificacion || 'Interesada',
        notas: lead.notas || 'Sin notas iniciales registradas',
        usuario: 'Recepción'
      });
    }

    // Cronológico descendente (último contacto primero)
    historial.sort((a, b) => (b.fechaHora || '').localeCompare(a.fechaHora || ''));

    const timeline = document.createElement('div');
    timeline.className = 'lead-timeline';

    historial.forEach(h => {
      let icon = '💬';
      const mLower = (h.medio || h.accion || '').toLowerCase();
      if (mLower.includes('llamada')) icon = '📞';
      else if (mLower.includes('presencial') || mLower.includes('mostrador') || mLower.includes('sucursal')) icon = '🚪';
      else if (mLower.includes('red') || mLower.includes('instagram') || mLower.includes('facebook')) icon = '📸';

      let fechaDisplay = '--/--/----';
      if (h.fechaHora) {
        const d = new Date(h.fechaHora);
        if (!isNaN(d.getTime())) {
          fechaDisplay = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
      }

      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-badge">${icon} ${escapeHtml(h.medio || h.accion || 'Contacto')}</span>
            <span class="timeline-date">${fechaDisplay}</span>
          </div>
          <div style="margin-top:2px;">
            ${getTipifBadgeHtml(h.tipificacion || lead.tipificacion)}
          </div>
          <div class="timeline-notes">
            ${escapeHtml(h.notas || h.resultado || 'Sin comentarios adicionales')}
          </div>
          ${h.usuario ? `<div class="timeline-user">Registró: ${escapeHtml(h.usuario)}</div>` : ''}
        </div>
      `;
      timeline.appendChild(item);
    });

    container.appendChild(timeline);
  }


  // =========================================================================
  // 9. CAMPAÑA ACTIVA Y EVENTOS DEL MES (MONITOREO EN VIVO)
  // =========================================================================
  async function renderCampanaActiva() {
    const campana = await TB_FIREBASE.getCampanaActiva();
    const tituloDisplay = document.getElementById('campana-titulo-display');
    const periodoDisplay = document.getElementById('campana-periodo-display');
    const progressBar = document.getElementById('campana-progress-bar-fill');
    const progresoTexto = document.getElementById('campana-progreso-texto');
    const diasRestantes = document.getElementById('campana-dias-restantes');
    const ventasCountEl = document.getElementById('campana-ventas-periodo-count');
    const metricSalon = document.getElementById('campana-metric-salon');
    const metricAcademia = document.getElementById('campana-metric-academia');
    const metricTicket = document.getElementById('campana-metric-ticket');
    const paquetesContainer = document.getElementById('campana-paquetes-display-container');

    if (!campana || !campana.nombre) {
      tituloDisplay.textContent = 'Sin Campaña Activa Configurada';
      periodoDisplay.textContent = 'Haga clic en "Configurar Campaña Activa" para definir las metas de este mes.';
      progressBar.style.width = '0%';
      progresoTexto.textContent = '$0.00 / $0.00 (0%)';
      diasRestantes.textContent = 'Días restantes: --';
      ventasCountEl.textContent = '0 ventas registradas';
      metricSalon.textContent = '0 / 0';
      metricAcademia.textContent = '0 / 0';
      metricTicket.textContent = '$0.00';
      paquetesContainer.innerHTML = `
        <div class="table-empty-notice" style="padding:24px 10px;">
          <span>🏷️</span>
          No hay paquetes ni promociones activas. Configure la campaña arriba para agregarlos.
        </div>
      `;
      return;
    }

    tituloDisplay.textContent = campana.nombre;
    periodoDisplay.textContent = `Vigencia: del ${campana.fechaInicio || '--'} al ${campana.fechaFin || '--'}`;

    // Calcular días restantes
    if (campana.fechaFin) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const fin = new Date(campana.fechaFin);
      fin.setHours(0, 0, 0, 0);
      const diffTime = fin - hoy;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      diasRestantes.textContent = diffDays >= 0 ? `Días restantes de campaña: ${diffDays}` : 'Campaña concluida';
    }

    // Calcular ventas reales en el período de la campaña
    const localVentasDB = JSON.parse(localStorage.getItem('tb_ventas_db') || '{}');
    let ingresosEnPeriodo = 0;
    let ventasEnPeriodoCount = 0;
    let clientasSalon = 0;
    let alumnasAcademia = 0;

    const fIni = campana.fechaInicio || '1970-01-01';
    const fFin = campana.fechaFin || '2099-12-31';

    Object.keys(localVentasDB).forEach(f => {
      if (f >= fIni && f <= fFin) {
        const diaVentas = Object.values(localVentasDB[f] || {});
        diaVentas.forEach(v => {
          const imp = parseFloat(v.totalCobrado) || 0;
          ingresosEnPeriodo += imp;
          ventasEnPeriodoCount += 1;
          const est = (v.estacion || '').toLowerCase();
          if (est.includes('academia')) alumnasAcademia += 1;
          else clientasSalon += 1;
        });
      }
    });

    const meta = parseFloat(campana.metaIngreso) || 0;
    const pct = meta > 0 ? Math.min(100, Math.round((ingresosEnPeriodo / meta) * 100)) : 0;
    progressBar.style.width = `${pct}%`;
    progresoTexto.textContent = `${formatCurrency(ingresosEnPeriodo)} / ${formatCurrency(meta)} (${pct}%)`;
    ventasCountEl.textContent = `${ventasEnPeriodoCount} ventas registradas en el período`;

    metricSalon.textContent = `${clientasSalon} / Meta: ${campana.metaSalon || '0'}`;
    metricAcademia.textContent = `${alumnasAcademia} / Meta: ${campana.metaAcademia || '0'}`;
    const avgTicket = ventasEnPeriodoCount > 0 ? ingresosEnPeriodo / ventasEnPeriodoCount : 0;
    metricTicket.textContent = formatCurrency(avgTicket);

    // Paquetes promocionales
    if (campana.promociones && campana.promociones.trim()) {
      paquetesContainer.innerHTML = `
        <div style="border:1px solid var(--border); padding:16px; border-radius:var(--radius-sm); background:#fafafa; font-size:0.9rem; line-height:1.6; white-space:pre-wrap;">
          ${campana.promociones}
        </div>
      `;
    } else {
      paquetesContainer.innerHTML = `
        <div class="table-empty-notice" style="padding:24px 10px;">
          <span>🏷️</span>
          Sin paquetes especiales definidos para esta campaña.
        </div>
      `;
    }
  }

  async function renderEventosTimeline() {
    const container = document.getElementById('events-timeline-container');
    container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--muted);">Cargando eventos...</div>';

    const eventos = await TB_FIREBASE.getEventosAll();

    container.innerHTML = '';
    if (eventos.length === 0) {
      container.innerHTML = `
        <div class="table-empty-notice" style="padding:24px 10px;">
          <span>📅</span>
          No hay eventos registrados para este mes. Agregue uno con el botón "+ Nuevo Evento".
        </div>
      `;
      return;
    }

    eventos.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-item-card';
      const dObj = ev.fecha ? new Date(ev.fecha + 'T00:00:00') : new Date();
      const diaStr = String(dObj.getDate()).padStart(2, '0');
      const mesStr = dObj.toLocaleString('es-MX', { month: 'short' }).toUpperCase();

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="event-date-badge">
            <div class="day">${diaStr}</div>
            <div class="month">${mesStr}</div>
          </div>
          <div>
            <div style="font-weight:700; color:var(--dark); font-size:0.92rem;">${ev.titulo}</div>
            <div style="font-size:0.78rem; color:var(--muted);">${ev.tipo || 'Salón'} &bull; Resp: <strong>${ev.responsable || 'Equipo'}</strong></div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="kpi-status-badge badge-cuadrada">Confirmado</span>
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-evento" data-id="${ev.id}">✕</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // =========================================================================
  // 10. CONFIGURACIÓN GENERAL (CATÁLOGOS: SERVICIOS, ESTACIONES, ESPECIALISTAS)
  // =========================================================================
  let currentConfigTab = 'servicios';
  let catServicios = [];
  let catEstaciones = [];
  let catEspecialistas = [];
  let catUsuariosRoles = [];
  let isConfigUnlocked = (sessionStorage.getItem('tb_cfg_unlocked') === 'true');
  let pendingConfigTab = 'servicios';

  const ALL_MODULE_KEYS = [
    'arqueo-principal',
    'arqueo-chica',
    'historial',
    'ventas',
    'mi-meta',
    'balancescore',
    'ingresos',
    'interesadas',
    'campana',
    'configuracion',
    'auditoria'
  ];

  const MODULE_DEFINITIONS = [
    { id: 'arqueo-principal', icono: '💵', label: 'Arqueo Caja Principal', desc: 'Fondo, conteo físico, conciliación y entrega de dinero' },
    { id: 'arqueo-chica', icono: '🪙', label: 'Arqueo Caja Chica', desc: 'Fondo base mensual, gastos menores y comprobantes' },
    { id: 'historial', icono: '📑', label: 'Reportes Diarios Arqueo', desc: 'Historial de arqueos guardados y visor PDF oficial' },
    { id: 'ventas', icono: '💰', label: 'Registro Diario de Ventas', desc: 'Captura visual de operaciones, métodos de pago y caja' },
    { id: 'mi-meta', icono: '🎯', label: 'Mi Meta', desc: 'Progreso y avance de metas por estación de trabajo en tiempo real' },
    { id: 'balancescore', icono: '💈', label: 'BalanceScore Estaciones', desc: 'Balanced Scorecard por estación y academia por períodos' },
    { id: 'ingresos', icono: '💰', label: 'Reporte Diario Ingresos', desc: 'Desglose detallado de servicios, montos y exportación PDF' },
    { id: 'interesadas', icono: '🎯', label: 'Interesadas y Cierres', desc: 'BalanceScore de conversión, registro y tipificación' },
    { id: 'campana', icono: '🌟', label: 'Campaña y Eventos', desc: 'Monitoreo de metas mensuales y calendario' },
    { id: 'configuracion', icono: '⚙️', label: 'Configuración General', desc: 'Servicios, estaciones, especialistas, metas y roles' },
    { id: 'auditoria', icono: '🛡️', label: 'Registro de Auditoría', desc: 'Bitácora de movimientos y reversión con llave maestra' }
  ];

  const ROLE_PRESETS = {
    'Administrador': {
      nombre: 'Administrador',
      modulos: [
        'arqueo-principal', 'arqueo-chica', 'historial', 'ventas', 'mi-meta',
        'balancescore', 'ingresos', 'interesadas', 'campana',
        'configuracion', 'auditoria'
      ]
    },
    'Encargado de Caja': {
      nombre: 'Encargado de Caja',
      modulos: ['arqueo-principal', 'arqueo-chica', 'historial', 'ventas', 'mi-meta']
    },
    'Recepción y Ventas': {
      nombre: 'Recepción y Ventas',
      modulos: ['ventas', 'mi-meta', 'interesadas']
    },
    'Ventas y Crecimiento': {
      nombre: 'Ventas y Crecimiento',
      modulos: ['ventas', 'mi-meta', 'balancescore', 'interesadas', 'campana']
    },
    'Especialista': {
      nombre: 'Especialista',
      modulos: ['ventas', 'mi-meta']
    },
    'Personalizado': {
      nombre: 'Personalizado',
      modulos: ['ventas', 'mi-meta']
    }
  };

  let catCursosMeta = {
    id: 'Cursos',
    nombre: 'Cursos & Talleres Academia',
    icono: '🎓',
    metaQuincenal: 0,
    clientesMeta: 0,
    isCurso: true
  };

  function switchConfigTab(tabKey) {
    currentConfigTab = tabKey;
    document.querySelectorAll('.config-nav-pill').forEach(btn => {
      if (btn.dataset.cfgtab === tabKey) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    ['servicios', 'estaciones', 'especialistas', 'metas', 'cajaprincipal', 'cajachica', 'usuarios'].forEach(k => {
      const el = document.getElementById(`config-subview-${k}`);
      if (el) el.style.display = (k === tabKey) ? 'block' : 'none';
    });
    if (tabKey === 'servicios') renderCatServiciosTable();
    if (tabKey === 'estaciones') renderCatEstacionesTable();
    if (tabKey === 'especialistas') renderCatEspecialistasTable();
    if (tabKey === 'metas') renderCatMetasTable();
    if (tabKey === 'cajaprincipal') loadControlCajaData();
    if (tabKey === 'cajachica') loadCajaChicaFundData();
    if (tabKey === 'usuarios') {
      renderUsuariosRolesView();
      descargarUsuariosDeFirebase(false);
    }

    const cfgTabLabels = {
      servicios: '1. Servicios & Productos',
      estaciones: '2. Estaciones de Trabajo',
      especialistas: '3. Especialistas',
      metas: '4. Metas Quincenales',
      cajaprincipal: '5. Fondo Caja Principal',
      cajachica: '6. Fondo Caja Chica',
      usuarios: '7. Usuarios & Roles'
    };
    logAuditMovement({
      modulo: 'Configuración General',
      accion: 'CAMBIO_SUBPESTAÑA',
      descripcion: `Acceso a la subpestaña: ${cfgTabLabels[tabKey] || tabKey}`,
      payload: { subtab: tabKey },
      reversible: false
    });
  }

  async function loadCatalogsData() {
    try {
      // CARGA RÁPIDA EN PARALELO DESDE FIREBASE
      const [estRes, espRes, srvRes, usrRes, crsRes] = await Promise.all([
        TB_FIREBASE.getCatalogo('estaciones'),
        TB_FIREBASE.getCatalogo('especialistas'),
        TB_FIREBASE.getCatalogo('servicios'),
        TB_FIREBASE.getCatalogo('usuarios_roles'),
        TB_FIREBASE.getCatalogo('metas_cursos')
      ]);

      if (Array.isArray(estRes)) {
        catEstaciones = estRes;
        catEstaciones.forEach(est => {
          if (est.metaQuincenal === undefined) est.metaQuincenal = parseFloat(est.meta) || 0;
          if (est.clientesMeta === undefined) est.clientesMeta = parseInt(est.metaClientes, 10) || 0;
        });
      }
      if (Array.isArray(espRes)) catEspecialistas = espRes;
      if (Array.isArray(srvRes)) catServicios = srvRes;
      if (Array.isArray(usrRes)) {
        catUsuariosRoles = usrRes;
        let franUser = catUsuariosRoles.find(u => (u.email || '').toLowerCase().trim() === 'francisco@totalb.com');
        if (!franUser) {
          franUser = {
            email: 'francisco@totalb.com',
            nombre: 'Francisco (Admin Principal)',
            rol: 'Administrador',
            isAdmin: true,
            modulos: [...ALL_MODULE_KEYS],
            updatedAt: new Date().toISOString()
          };
          catUsuariosRoles.unshift(franUser);
          TB_FIREBASE.saveCatalogo('usuarios_roles', catUsuariosRoles);
        } else {
          franUser.rol = 'Administrador';
          franUser.isAdmin = true;
          franUser.modulos = [...ALL_MODULE_KEYS];
        }
      }

      if (Array.isArray(crsRes) && crsRes[0]) {
        catCursosMeta = {
          id: 'Cursos',
          nombre: 'Cursos & Talleres Academia',
          icono: '🎓',
          isCurso: true,
          metaQuincenal: parseFloat(crsRes[0].metaQuincenal || 0),
          clientesMeta: parseInt(crsRes[0].clientesMeta || 0, 10)
        };
      }

      populateSalesDropdowns();
      populateConfigStationDropdowns();

      // ACTUALIZAR EN VIVO LA VISTA ACTIVA SI DEPENDE DE CATÁLOGOS
      if (currentModule === 'balancescore') {
        renderBalanceScoreStations();
      } else if (currentModule === 'configuracion') {
        renderCatServiciosTable();
        renderCatEstacionesTable();
        renderCatEspecialistasTable();
        renderCatMetasTable();
      }
    } catch (err) {
      console.warn('Error en loadCatalogsData:', err);
    }
  }

  function populateSalesDropdowns() {
    // 1. Selector de Servicios en Venta
    const servSelect = document.getElementById('venta_servicio');
    if (servSelect) {
      const currentVal = servSelect.value;
      
      const grupos = {
        'Servicios (Salón)': catServicios.filter(s => s.tipo === 'Servicio'),
        'Productos (Retail)': catServicios.filter(s => s.tipo === 'Producto'),
        'Cursos (Academia)': catServicios.filter(s => s.tipo === 'Curso')
      };

      let count = 0;
      servSelect.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.disabled = true;
      defaultOpt.selected = true;
      defaultOpt.textContent = 'Seleccione servicio o producto...';
      servSelect.appendChild(defaultOpt);

      Object.entries(grupos).forEach(([grpName, items]) => {
        if (items.length > 0) {
          count += items.length;
          const optGroup = document.createElement('optgroup');
          optGroup.label = grpName;
          items.forEach(it => {
            const opt = document.createElement('option');
            opt.value = it.nombre;
            opt.textContent = `${it.nombre} - $${parseFloat(it.precio || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
            opt.dataset.estacion = it.estacion || '';
            opt.dataset.precio = it.precio || 0;
            optGroup.appendChild(opt);
          });
          servSelect.appendChild(optGroup);
        }
      });

      if (count === 0) {
        servSelect.innerHTML = '<option value="" disabled selected>No hay servicios ni productos configurados (agregue en Configuración General)</option>';
      } else if (currentVal && Array.from(servSelect.options).some(o => o.value === currentVal)) {
        servSelect.value = currentVal;
      }
      syncVentaServicioComboboxFromSelect();
    }

    // 2. Selector de Estaciones en Venta
    const estSelect = document.getElementById('venta_estacion');
    if (estSelect) {
      const currentVal = estSelect.value;
      if (catEstaciones.length === 0) {
        estSelect.innerHTML = '<option value="" disabled selected>No hay estaciones configuradas (agregue en Configuración General)</option>';
      } else {
        estSelect.innerHTML = '<option value="" disabled selected>Seleccione la estación...</option>';
        catEstaciones.forEach(est => {
          const opt = document.createElement('option');
          opt.value = est.nombre;
          opt.textContent = `${est.icono || '💈'} ${est.nombre}`;
          estSelect.appendChild(opt);
        });
        if (currentVal && Array.from(estSelect.options).some(o => o.value === currentVal)) {
          estSelect.value = currentVal;
        }
      }
    }

    // 3. Selector de Especialistas en Venta
    const espSelect = document.getElementById('venta_especialista');
    if (espSelect) {
      const currentVal = espSelect.value;
      if (catEspecialistas.length === 0) {
        espSelect.innerHTML = '<option value="" disabled selected>No hay especialistas configurados (agregue en Configuración General)</option>';
      } else {
        espSelect.innerHTML = '<option value="" disabled selected>Seleccione especialista...</option>';
        catEspecialistas.forEach(esp => {
          const opt = document.createElement('option');
          opt.value = esp.nombre;
          opt.textContent = `${esp.nombre} (${esp.estacion || 'General'})`;
          espSelect.appendChild(opt);
        });
        if (currentVal && Array.from(espSelect.options).some(o => o.value === currentVal)) {
          espSelect.value = currentVal;
        }
      }
    }
  }

  // =========================================================================
  // BUSCADOR EN TIEMPO REAL - SERVICIO O PRODUCTO EN VENTAS
  // =========================================================================
  let comboboxHighlightedIndex = -1;

  function renderVentaServicioComboboxOptions(searchTerm = '') {
    const panel = document.getElementById('combobox_servicio_panel');
    const optionsContainer = document.getElementById('combobox_servicio_options');
    const countBadge = document.getElementById('combobox_servicio_count');
    const servSelect = document.getElementById('venta_servicio');
    if (!optionsContainer) return;

    const term = (searchTerm || '').toLowerCase().trim();
    const currentVal = servSelect?.value || '';

    // Obtener catálogo catServicios
    let allItems = Array.isArray(catServicios) ? [...catServicios] : [];
    
    // Si catServicios está vacío pero servSelect tiene opciones, extraerlas como fallback
    if (allItems.length === 0 && servSelect && servSelect.options.length > 1) {
      Array.from(servSelect.options).forEach(opt => {
        if (opt.value) {
          allItems.push({
            nombre: opt.value,
            tipo: opt.parentElement?.tagName === 'OPTGROUP' ? opt.parentElement.label.replace(/\s*\(.*\)/, '') : 'Servicio',
            estacion: opt.dataset.estacion || '',
            precio: parseFloat(opt.dataset.precio || 0)
          });
        }
      });
    }

    const filtered = allItems.filter(s => {
      if (!term) return true;
      const haystack = `${s.nombre || ''} ${s.tipo || ''} ${s.estacion || ''} ${s.precio || ''}`.toLowerCase();
      return haystack.includes(term);
    });

    if (countBadge) {
      if (term) {
        countBadge.textContent = `${filtered.length} encontrados de ${allItems.length}`;
      } else {
        countBadge.textContent = `${allItems.length} disponibles`;
      }
    }

    if (filtered.length === 0) {
      optionsContainer.innerHTML = `
        <div class="combobox-empty-notice">
          <div style="font-size:1.5rem; margin-bottom:4px;">🔍</div>
          <div style="font-weight:700; color:#0f172a;">No se encontraron servicios ni productos que coincidan con "${escapeHtml(searchTerm)}".</div>
          <div style="font-size:0.75rem; color:#64748b; margin-top:6px;">Pruebe con otra palabra clave o <a href="#" class="config-mini-link btn-goto-config" data-config-tab="servicios" style="color:#d4af37; font-weight:700; text-decoration:underline;">agregue uno nuevo en Configuración</a>.</div>
        </div>
      `;
      comboboxHighlightedIndex = -1;
      return;
    }

    // Agrupar por tipo (Servicio, Producto, Curso)
    const grupos = {
      'Servicios (Salón)': filtered.filter(s => (s.tipo || '').toLowerCase().includes('servicio')),
      'Productos (Retail)': filtered.filter(s => (s.tipo || '').toLowerCase().includes('producto')),
      'Cursos (Academia)': filtered.filter(s => (s.tipo || '').toLowerCase().includes('curso'))
    };

    const knownCheck = (t) => {
      const tl = (t || '').toLowerCase();
      return tl.includes('servicio') || tl.includes('producto') || tl.includes('curso');
    };
    const otherItems = filtered.filter(s => !knownCheck(s.tipo));
    if (otherItems.length > 0) {
      grupos['Otros Registros'] = otherItems;
    }

    let html = '';
    let globalIndex = 0;

    Object.entries(grupos).forEach(([grpName, items]) => {
      if (items.length > 0) {
        const icon = grpName.includes('Servicio') ? '✂️' : (grpName.includes('Producto') ? '🛍️' : (grpName.includes('Curso') ? '🎓' : '📌'));
        html += `<div class="combobox-group-header">${icon} ${escapeHtml(grpName)} (${items.length})</div>`;
        
        items.forEach(it => {
          const isSelected = it.nombre === currentVal;
          const precioFormatted = parseFloat(it.precio || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
          const estacionLabel = it.estacion ? `🪞 ${escapeHtml(it.estacion)}` : 'Sin estación fija';
          const tipoBadge = it.tipo ? `<span class="combobox-item-badge">${escapeHtml(it.tipo)}</span>` : '';

          // Resaltar coincidencia si hay búsqueda
          let displayName = escapeHtml(it.nombre);
          if (term) {
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp('(' + escapedTerm + ')', 'gi');
            displayName = displayName.replace(regex, '<mark style="background:#fef08a; color:#854d0e; padding:0 2px; border-radius:2px; font-weight:800;">$1</mark>');
          }

          html += `
            <div class="combobox-item ${isSelected ? 'selected' : ''}" 
                 data-nombre="${escapeHtml(it.nombre)}" 
                 data-estacion="${escapeHtml(it.estacion || '')}" 
                 data-precio="${it.precio || 0}"
                 data-tipo="${escapeHtml(it.tipo || '')}"
                 data-idx="${globalIndex}">
              <div class="combobox-item-info">
                <div class="combobox-item-title">${displayName}</div>
                <div class="combobox-item-meta">
                  ${tipoBadge}
                  <span>${estacionLabel}</span>
                </div>
              </div>
              <div class="combobox-item-price">$${precioFormatted}</div>
            </div>
          `;
          globalIndex++;
        });
      }
    });

    optionsContainer.innerHTML = html;
    comboboxHighlightedIndex = -1;
  }

  function openVentaServicioCombobox() {
    const panel = document.getElementById('combobox_servicio_panel');
    const input = document.getElementById('venta_servicio_busqueda');
    if (!panel) return;

    const term = input ? input.value.trim() : '';
    const servSelect = document.getElementById('venta_servicio');
    const searchTerm = (servSelect && servSelect.value === term) ? '' : term;
    
    renderVentaServicioComboboxOptions(searchTerm);
    panel.style.display = 'block';

    setTimeout(() => {
      const selectedEl = panel.querySelector('.combobox-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }, 40);
  }

  function closeVentaServicioCombobox() {
    const panel = document.getElementById('combobox_servicio_panel');
    if (panel) panel.style.display = 'none';
    comboboxHighlightedIndex = -1;
  }

  function selectVentaServicioItem(nombre, estacion, precio) {
    const input = document.getElementById('venta_servicio_busqueda');
    const btnClear = document.getElementById('btn-clear-combobox-servicio');
    const servSelect = document.getElementById('venta_servicio');

    if (input) input.value = nombre;
    if (btnClear) btnClear.style.display = nombre ? 'block' : 'none';

    if (servSelect) {
      servSelect.value = nombre;
      servSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (estacion) {
      const estSelect = document.getElementById('venta_estacion');
      if (estSelect) estSelect.value = estacion;
    }
    if (precio && parseFloat(precio) > 0) {
      const prcInput = document.getElementById('venta_servicio_precio');
      if (prcInput) prcInput.value = parseFloat(precio).toFixed(2);
    }

    closeVentaServicioCombobox();
  }

  function resetVentaServicioCombobox() {
    const input = document.getElementById('venta_servicio_busqueda');
    const btnClear = document.getElementById('btn-clear-combobox-servicio');
    const servSelect = document.getElementById('venta_servicio');

    if (input) input.value = '';
    if (btnClear) btnClear.style.display = 'none';
    if (servSelect) {
      servSelect.value = '';
      servSelect.selectedIndex = 0;
    }
    closeVentaServicioCombobox();
  }

  function syncVentaServicioComboboxFromSelect() {
    const servSelect = document.getElementById('venta_servicio');
    const input = document.getElementById('venta_servicio_busqueda');
    const btnClear = document.getElementById('btn-clear-combobox-servicio');

    if (!servSelect || !input) return;
    const val = servSelect.value;
    if (val) {
      input.value = val;
      if (btnClear) btnClear.style.display = 'block';
    } else {
      input.value = '';
      if (btnClear) btnClear.style.display = 'none';
    }
  }

  function initVentaServicioCombobox() {
    const input = document.getElementById('venta_servicio_busqueda');
    const btnClear = document.getElementById('btn-clear-combobox-servicio');
    const btnToggle = document.getElementById('btn-toggle-combobox-servicio');
    const panel = document.getElementById('combobox_servicio_panel');
    const optionsContainer = document.getElementById('combobox_servicio_options');
    const wrap = document.getElementById('wrap-combobox-servicio');

    if (!input || !panel) return;

    // Al hacer clic o enfocar el buscador, abrir la lista
    input.addEventListener('focus', () => {
      openVentaServicioCombobox();
    });
    input.addEventListener('click', () => {
      openVentaServicioCombobox();
    });

    // Búsqueda y filtrado en TIEMPO REAL
    input.addEventListener('input', (e) => {
      const term = e.target.value;
      if (btnClear) btnClear.style.display = term ? 'block' : 'none';
      openVentaServicioCombobox();
      renderVentaServicioComboboxOptions(term);
    });

    // Botón para alternar desplegable (▼)
    btnToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.style.display === 'block') {
        closeVentaServicioCombobox();
      } else {
        input.focus();
        openVentaServicioCombobox();
      }
    });

    // Botón para limpiar búsqueda y selección (✕)
    btnClear?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetVentaServicioCombobox();
      const prcInput = document.getElementById('venta_servicio_precio');
      if (prcInput) prcInput.value = '';
      input.focus();
    });

    // Delegación de clic en las opciones del combobox
    optionsContainer?.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.combobox-item');
      if (itemEl) {
        const nombre = itemEl.dataset.nombre;
        const estacion = itemEl.dataset.estacion;
        const precio = itemEl.dataset.precio;
        selectVentaServicioItem(nombre, estacion, precio);
      }
    });

    // Navegación por teclado (Flechas, Enter, Escape)
    input.addEventListener('keydown', (e) => {
      const items = panel.querySelectorAll('.combobox-item');
      if (panel.style.display !== 'block' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        openVentaServicioCombobox();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length === 0) return;
        comboboxHighlightedIndex = (comboboxHighlightedIndex + 1) % items.length;
        items.forEach((it, i) => it.classList.toggle('highlighted', i === comboboxHighlightedIndex));
        items[comboboxHighlightedIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length === 0) return;
        comboboxHighlightedIndex = (comboboxHighlightedIndex - 1 + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('highlighted', i === comboboxHighlightedIndex));
        items[comboboxHighlightedIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (panel.style.display === 'block' && items.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const target = comboboxHighlightedIndex >= 0 ? items[comboboxHighlightedIndex] : items[0];
          if (target) {
            selectVentaServicioItem(target.dataset.nombre, target.dataset.estacion, target.dataset.precio);
          }
        }
      } else if (e.key === 'Escape') {
        closeVentaServicioCombobox();
      }
    });

    // Cerrar al hacer clic fuera del componente
    document.addEventListener('click', (e) => {
      if (wrap && !wrap.contains(e.target)) {
        closeVentaServicioCombobox();
      }
    });
  }

  function populateConfigStationDropdowns() {
    const s1 = document.getElementById('cfg_serv_estacion');
    const s2 = document.getElementById('cfg_esp_estacion');
    const sEdit = document.getElementById('edit_serv_estacion');
    [s1, s2, sEdit].forEach(sel => {
      if (!sel) return;
      const cur = sel.value;
      if (catEstaciones.length === 0) {
        sel.innerHTML = '<option value="" disabled selected>Primero agregue estaciones en la pestaña Estaciones de Trabajo</option>';
      } else {
        sel.innerHTML = '<option value="" disabled selected>Seleccione estación...</option>';
        catEstaciones.forEach(est => {
          const opt = document.createElement('option');
          opt.value = est.nombre;
          opt.textContent = `${est.icono || '💈'} ${est.nombre}`;
          sel.appendChild(opt);
        });
        if (cur && Array.from(sel.options).some(o => o.value === cur)) {
          sel.value = cur;
        }
      }
    });
  }

  async function loadAndRenderConfiguracion() {
    await loadCatalogsData();
    renderCatServiciosTable();
    renderCatEstacionesTable();
    renderCatEspecialistasTable();
    renderCatMetasTable();
    await loadControlCajaData();
    await loadCajaChicaFundData();
  }

  let autosaveMetasDebounceTimer = null;

  function autoSaveMetasToFirebase() {
    const badge = document.getElementById('badge-autosave-metas');
    if (badge) {
      badge.textContent = '⏳ Guardando automáticamente en Firebase...';
      badge.style.color = '#b45309';
      badge.style.background = '#fef3c7';
      badge.style.borderColor = '#fde68a';
    }

    clearTimeout(autosaveMetasDebounceTimer);
    autosaveMetasDebounceTimer = setTimeout(async () => {
      await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
      await TB_FIREBASE.saveCatalogo('metas_cursos', [catCursosMeta]);
      await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());

      if (badge) {
        badge.textContent = '⚡ Auto-guardado en Firebase: Cada cambio se guarda automáticamente';
        badge.style.color = '#065f46';
        badge.style.background = '#ecfdf5';
        badge.style.borderColor = '#a7f3d0';
      }

      renderCatEstacionesTable();
      renderBalanceScoreStations();
    }, 350);
  }

  function renderCatMetasTable() {
    const tbody = document.getElementById('tbody-cat-metas');
    const badgeCount = document.getElementById('badge-total-metas');
    const allMetas = getActiveStationMetas();
    if (badgeCount) badgeCount.textContent = `${allMetas.length} Estaciones y Academia`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (allMetas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty-notice" style="padding:32px 16px;"><span>🎯</span>No hay estaciones configuradas en la base de datos. Agregue estaciones en la pestaña <strong>2. Estaciones de Trabajo</strong> para asignar metas.</td></tr>';
      return;
    }

    allMetas.forEach(m => {
      const tr = document.createElement('tr');
      const metaQ = parseFloat(m.metaQuincenal) || 0;
      const metaM = metaQ * 2;
      const metaD = Math.round(metaQ / 15);
      const isCurso = m.id === 'Cursos' || (m.nombre || '').toLowerCase().includes('curso') || (m.nombre || '').toLowerCase().includes('academia') || m.isCurso;

      if (isCurso) {
        tr.className = 'tr-meta-academia';
      }

      tr.innerHTML = `
        <td style="font-size:1.3rem; text-align:center;">
          <div style="width:38px; height:38px; border-radius:10px; background:${isCurso ? '#ecfdf5' : '#f1f5f9'}; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            ${m.icono || (isCurso ? '🎓' : '💈')}
          </div>
        </td>
        <td>
          <strong style="color:var(--dark); font-size:0.92rem;">${escapeHtml(m.nombre)}</strong>
          ${isCurso ? '<span class="badge-unit-academia" style="margin-left:6px;">🎓 Academia</span>' : '<span style="font-size:0.75rem; color:var(--muted); margin-left:6px;">(Estación Salón)</span>'}
        </td>
        <td>
          <div class="currency-input-wrap">
            <span class="currency-prefix">$</span>
            <input type="number" step="100" min="0" class="input-currency input-meta-quincenal styled-input" data-id="${m.id}" value="${metaQ}" style="font-weight:800; color:#15803d;">
          </div>
        </td>
        <td>
          <input type="number" min="0" class="table-input-meta input-meta-clientes styled-input" data-id="${m.id}" value="${m.clientesMeta || 0}" style="font-weight:700;">
        </td>
        <td class="text-right" style="font-weight:800; color:var(--primary); font-size:0.92rem;" id="meta-mensual-${m.id}">
          ${formatCurrency(metaM)}
        </td>
        <td class="text-right" style="font-weight:700; color:var(--dark); font-size:0.88rem;" id="meta-diaria-${m.id}">
          ${formatCurrency(metaD)}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Event listeners para auto-guardado reactivo
    tbody.querySelectorAll('.input-meta-quincenal').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const val = parseFloat(e.target.value) || 0;
        const elM = document.getElementById(`meta-mensual-${id}`);
        const elD = document.getElementById(`meta-diaria-${id}`);
        if (elM) elM.textContent = formatCurrency(val * 2);
        if (elD) elD.textContent = formatCurrency(Math.round(val / 15));

        if (id === 'Cursos') {
          catCursosMeta.metaQuincenal = val;
        } else {
          const est = catEstaciones.find(item => item.id === id || item.nombre === id);
          if (est) est.metaQuincenal = val;
        }
        autoSaveMetasToFirebase();
      });
    });

    tbody.querySelectorAll('.input-meta-clientes').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const val = parseInt(e.target.value, 10) || 0;
        if (id === 'Cursos') {
          catCursosMeta.clientesMeta = val;
        } else {
          const est = catEstaciones.find(item => item.id === id || item.nombre === id);
          if (est) est.clientesMeta = val;
        }
        autoSaveMetasToFirebase();
      });
    });
  }

  function renderCatServiciosTable() {
    const tbody = document.getElementById('tbody-cat-servicios');
    const badge = document.getElementById('badge-total-servicios');
    const pillCount = document.getElementById('pill-count-servicios');
    const searchInput = document.getElementById('cfg_serv_search');
    const searchVal = (searchInput?.value || '').trim();
    const btnClear = document.getElementById('btn-clear-serv-search');

    if (btnClear) {
      btnClear.style.display = searchVal ? 'inline-block' : 'none';
    }

    const norm = str => (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleanSearch = norm(searchVal);

    let filtered = catServicios || [];
    if (cleanSearch) {
      filtered = filtered.filter(s => {
        const nom = norm(s.nombre);
        const est = norm(s.estacion);
        const tipo = norm(s.tipo);
        const precio = (s.precio !== undefined ? s.precio : '').toString();
        return nom.includes(cleanSearch) || est.includes(cleanSearch) || tipo.includes(cleanSearch) || precio.includes(cleanSearch);
      });
    }

    if (badge) {
      if (cleanSearch) {
        badge.textContent = `${filtered.length} de ${catServicios.length} Registros`;
      } else {
        badge.textContent = `${catServicios.length} Registros`;
      }
    }
    if (pillCount) pillCount.textContent = `${catServicios.length}`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-notice" style="padding:32px 16px; text-align:center;">
            <span style="font-size:2rem; display:block; margin-bottom:6px;">✨</span>
            <div style="font-size:0.95rem; font-weight:600; color:var(--dark); margin-bottom:8px;">
              ${searchVal ? `No se encontraron servicios que coincidan con "${escapeHtml(searchVal)}"` : 'No hay servicios ni productos configurados en la base de datos.'}
            </div>
            ${searchVal ? '<button type="button" class="btn btn-sm btn-secondary" id="btn-reset-serv-search" style="margin-top:6px; font-weight:600; cursor:pointer;">🔄 Limpiar búsqueda y mostrar todos</button>' : ''}
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(s => {
      const tr = document.createElement('tr');
      
      let badgeHtml = '<span class="badge-unit-salon">💇‍♀️ Servicio</span>';
      if (s.tipo === 'Producto') {
        badgeHtml = '<span class="badge-unit-retail">🛍️ Producto</span>';
      } else if (s.tipo === 'Curso') {
        badgeHtml = '<span class="badge-unit-academia">🎓 Curso</span>';
      }

      tr.innerHTML = `
        <td>
          <strong style="color:var(--dark); font-size:0.92rem;">${escapeHtml(s.nombre)}</strong>
        </td>
        <td>${badgeHtml}</td>
        <td>
          <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-size:0.8rem; font-weight:600; color:#334155;">
            ${escapeHtml(s.estacion || 'General')}
          </span>
        </td>
        <td class="text-right" style="font-weight:800; color:#15803d; font-size:0.95rem;">
          ${formatCurrency(parseFloat(s.precio || 0))}
        </td>
        <td class="text-center" style="white-space:nowrap;">
          <button type="button" class="btn-cat-action btn-cat-action-edit btn-edit-cfg-serv" data-id="${s.id}" title="Editar servicio/producto">
            ✏️ Editar
          </button>
          <button type="button" class="btn-cat-action btn-cat-action-del btn-del-cfg-serv" data-id="${s.id}" title="Eliminar servicio/producto">
            🗑️ Eliminar
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderCatEstacionesTable() {
    const tbody = document.getElementById('tbody-cat-estaciones');
    const badge = document.getElementById('badge-total-estaciones');
    const pillCount = document.getElementById('pill-count-estaciones');
    const searchVal = (document.getElementById('cfg_est_search')?.value || '').trim().toLowerCase();

    if (badge) badge.textContent = `${catEstaciones.length} Estaciones`;
    if (pillCount) pillCount.textContent = `${catEstaciones.length}`;
    if (!tbody) return;

    let filtered = catEstaciones || [];
    if (searchVal) {
      filtered = filtered.filter(e => (e.nombre || '').toLowerCase().includes(searchVal));
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="table-empty-notice" style="padding:32px 16px;">
            <span style="font-size:2rem; display:block; margin-bottom:6px;">💈</span>
            ${searchVal ? 'No se encontraron estaciones con ese nombre.' : 'No hay estaciones de trabajo configuradas en la base de datos.'}
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(est => {
      const tr = document.createElement('tr');
      const metaQ = parseFloat(est.metaQuincenal || est.meta || 0);
      const clientesQ = parseInt(est.clientesMeta || est.metaClientes || 0, 10);
      const metaD = Math.round(metaQ / 15);

      tr.innerHTML = `
        <td style="text-align:center;">
          <div style="width:36px; height:36px; border-radius:8px; background:#f1f5f9; display:inline-flex; align-items:center; justify-content:center; font-size:1.25rem;">
            ${est.icono || '💈'}
          </div>
        </td>
        <td>
          <strong style="color:var(--dark); font-size:0.92rem;">${escapeHtml(est.nombre)}</strong>
        </td>
        <td class="text-right" style="font-weight:800; color:#15803d; font-size:0.95rem;">
          ${formatCurrency(metaQ)}
        </td>
        <td class="text-right" style="font-weight:600; color:var(--slate);">
          ${clientesQ} <small style="color:var(--muted);">clientes</small>
        </td>
        <td class="text-right" style="color:var(--muted); font-size:0.85rem;">
          ${formatCurrency(metaD)}
        </td>
        <td class="text-center">
          <button type="button" class="btn-cat-del btn-del-cfg-est" data-id="${est.id}" title="Eliminar estación">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderCatEspecialistasTable() {
    const tbody = document.getElementById('tbody-cat-especialistas');
    const badge = document.getElementById('badge-total-especialistas');
    const pillCount = document.getElementById('pill-count-especialistas');
    const searchVal = (document.getElementById('cfg_esp_search')?.value || '').trim().toLowerCase();

    if (badge) badge.textContent = `${catEspecialistas.length} Especialistas`;
    if (pillCount) pillCount.textContent = `${catEspecialistas.length}`;
    if (!tbody) return;

    let filtered = catEspecialistas || [];
    if (searchVal) {
      filtered = filtered.filter(e => {
        const nom = (e.nombre || '').toLowerCase();
        const est = (e.estacion || '').toLowerCase();
        const tel = (e.telefono || '').toLowerCase();
        return nom.includes(searchVal) || est.includes(searchVal) || tel.includes(searchVal);
      });
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="table-empty-notice" style="padding:32px 16px;">
            <span style="font-size:2rem; display:block; margin-bottom:6px;">👩‍🎨</span>
            ${searchVal ? 'No se encontraron especialistas que coincidan con la búsqueda.' : 'No hay especialistas dados de alta en el equipo.'}
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(esp => {
      const tr = document.createElement('tr');
      const initial = (esp.nombre || 'E').charAt(0).toUpperCase();
      const cleanTel = (esp.telefono || '').replace(/\D/g, '');

      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="user-avatar-initial" style="width:32px; height:32px; font-size:0.85rem;">${initial}</div>
            <strong style="color:var(--dark); font-size:0.92rem;">${escapeHtml(esp.nombre)}</strong>
          </div>
        </td>
        <td>
          <span style="background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:2px 8px; border-radius:6px; font-size:0.8rem; font-weight:700;">
            ${escapeHtml(esp.estacion || 'General')}
          </span>
        </td>
        <td>
          ${esp.telefono ? `
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-family:monospace; font-size:0.85rem; font-weight:600; color:var(--slate);">${escapeHtml(esp.telefono)}</span>
              <a href="https://wa.me/52${cleanTel}" target="_blank" class="btn-whatsapp btn-sm" style="padding:1px 6px; font-size:0.7rem; text-decoration:none;" title="WhatsApp">💬</a>
            </div>
          ` : '<span style="color:var(--muted); font-size:0.8rem;">Sin teléfono</span>'}
        </td>
        <td class="text-center">
          <button type="button" class="btn-cat-del btn-del-cfg-esp" data-id="${esp.id}" title="Eliminar especialista">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 11. INICIALIZACIÓN Y EVENT LISTENERS
  // =========================================================================
  // =========================================================================
  // GESTIÓN Y FILTRADO ROBUSTO DE ENTREGAS DE DINERO (ZONA HIDALGO)
  // =========================================================================
  function isEntregaFromDate(entrega, targetDate) {
    if (!entrega) return false;
    if (entrega.fecha === targetDate) return true;
    const dStr = entrega.createdAt || entrega.fechaHora;
    if (dStr) {
      try {
        if (getHidalgoDateStr(new Date(dStr)) === targetDate) return true;
      } catch (e) {}
    }
    if (entrega.id && typeof entrega.id === 'string' && entrega.id.startsWith('ent_')) {
      const ts = parseInt(entrega.id.replace('ent_', ''), 10);
      if (ts > 1000000000000) {
        try {
          if (getHidalgoDateStr(new Date(ts)) === targetDate) return true;
        } catch (e) {}
      }
    }
    return false;
  }

  function getEntregasDelDia(fecha) {
    const targetDate = fecha || document.getElementById('header_fecha')?.value || getHidalgoDateStr();
    const allEntregas = Object.values(controlCajaData.entregas || {});
    return allEntregas.filter(e => isEntregaFromDate(e, targetDate)).sort((a, b) => {
      const tA = (a.hora || a.createdAt || a.fechaHora || '');
      const tB = (b.hora || b.createdAt || b.fechaHora || '');
      return tA.localeCompare(tB);
    });
  }

  function getEntregasDelCorte(fecha) {
    const entregasHoy = getEntregasDelDia(fecha);
    if (!currentCortesHoy || currentCortesHoy.length === 0) {
      return entregasHoy;
    }
    const ultimoCorte = currentCortesHoy[currentCortesHoy.length - 1];
    if (!ultimoCorte || !ultimoCorte.corteTimestamp) {
      return entregasHoy;
    }
    const tCorte = new Date(ultimoCorte.corteTimestamp).getTime();
    return entregasHoy.filter(e => {
      const dStr = e.createdAt || e.fechaHora;
      if (dStr) return new Date(dStr).getTime() > tCorte;
      if (e.id && typeof e.id === 'string' && e.id.startsWith('ent_')) {
        const ts = parseInt(e.id.replace('ent_', ''), 10);
        if (ts > 1000000000000) return ts > tCorte;
      }
      return true;
    });
  }

  // =========================================================================
  // CONTROL DE CAJA, FONDO INICIAL Y ENTREGAS DE DINERO (CON FOTOGRAFÍA)
  // =========================================================================
  async function loadControlCajaData() {
    try {
      controlCajaData = await TB_FIREBASE.getControlCaja();
      
      // Si el fondo base nunca ha sido definido en Firebase ni LocalStorage (null o undefined), consultar el último corte global cerrado
      if (controlCajaData.fondoBase === undefined || controlCajaData.fondoBase === null || isNaN(controlCajaData.fondoBase)) {
        const lastCorte = await TB_FIREBASE.getUltimoCorteGlobal();
        if (lastCorte) {
          const dest = lastCorte.destinoEfectivo || lastCorte.validacion?.destinoEfectivo;
          if (dest === 'se_queda_en_caja' || !dest) {
            const monto = parseFloat(lastCorte.montoQuedaEnCaja || lastCorte.conteo?.total || lastCorte.conciliacion?.contado || 0) || 0;
            controlCajaData.fondoBase = monto;
            await TB_FIREBASE.saveFondoBaseCaja(monto);
          } else {
            controlCajaData.fondoBase = 0;
            await TB_FIREBASE.saveFondoBaseCaja(0);
          }
        } else {
          controlCajaData.fondoBase = 0;
          await TB_FIREBASE.saveFondoBaseCaja(0);
        }
      }

      renderControlCajaFondo();
    } catch (e) {
      console.warn('Error en loadControlCajaData:', e);
    }
  }

  function renderControlCajaFondo() {
    const today = (document.getElementById('header_fecha')?.value || getHidalgoDateStr());
    const entregasHoy = getEntregasDelDia(today);
    const entregasCorte = getEntregasDelCorte(today);

    let fondoBase = parseFloat(controlCajaData.fondoBase || 0);

    if (currentCortesHoy && currentCortesHoy.length > 0) {
      const ultimoCorte = currentCortesHoy[currentCortesHoy.length - 1];
      const dest = ultimoCorte.destinoEfectivo || ultimoCorte.validacion?.destinoEfectivo;
      if (dest === 'se_queda_en_caja') {
        fondoBase = parseFloat(ultimoCorte.montoQuedaEnCaja || ultimoCorte.conteo?.total || ultimoCorte.conciliacion?.contado || 0);
      } else {
        fondoBase = 0.00;
      }
    }

    const totalEntregadoHoy = entregasHoy.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);
    const totalEntregadoCorte = entregasCorte.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);

    const fInput = document.getElementById('f_inicial_caja');
    if (fInput) fInput.value = fondoBase.toFixed(2);

    const lblBase = document.getElementById('lbl-fondo-base');
    const lblEntr = document.getElementById('lbl-total-entregado');
    const lblDisp = document.getElementById('lbl-fondo-disponible');
    const countBadge = document.getElementById('count-entregas-hoy');

    const vEfec = parseVal('ing_total_efectivo');
    const efectivoTotalCaja = Math.max(0, (fondoBase + vEfec) - totalEntregadoCorte);

    if (lblBase) lblBase.textContent = formatCurrency(fondoBase);
    if (lblEntr) lblEntr.textContent = formatCurrency(totalEntregadoHoy);
    if (lblDisp) lblDisp.textContent = formatCurrency(efectivoTotalCaja);
    if (countBadge) countBadge.textContent = String(entregasHoy.length);

    renderConfigCajaPrincipalValues(fondoBase, totalEntregadoHoy, efectivoTotalCaja);

    recalculatePrincipal();
  }

  function renderConfigCajaPrincipalValues(base, entregas, disp) {
    const inp = document.getElementById('cfg_principal_fondo_base');
    const lBase = document.getElementById('cfg_lbl_principal_base');
    const lEntr = document.getElementById('cfg_lbl_principal_entregas');
    const lDisp = document.getElementById('cfg_lbl_principal_disponible');

    const cfgBase = (typeof controlCajaData.fondoBase === 'number' && !isNaN(controlCajaData.fondoBase)) ? controlCajaData.fondoBase : base;

    if (inp && (!inp.dataset.loaded || document.activeElement !== inp)) {
      inp.value = (typeof cfgBase === 'number' && !isNaN(cfgBase)) ? cfgBase.toFixed(2) : '0.00';
      inp.dataset.loaded = 'true';
    }
    if (lBase) lBase.textContent = formatCurrency(base);
    if (lEntr) lEntr.textContent = entregas > 0 ? `-${formatCurrency(entregas)}` : '$0.00';
    if (lDisp) lDisp.textContent = formatCurrency(disp);
  }

  function openAuthConfirmModal(isChica = false) {
    pendingAuthIsChica = isChica;
    const modal = document.getElementById('modal-auth-confirm');
    const emailEl = document.getElementById('auth-confirm-email');
    const pwdInput = document.getElementById('input-auth-confirm-pwd');
    const errBox = document.getElementById('auth-confirm-error');

    const curUser = TB_FIREBASE.getCurrentUser();
    if (emailEl) emailEl.textContent = curUser?.email || 'Usuario';
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.type = 'password';
    }
    if (errBox) errBox.style.display = 'none';
    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (pwdInput) pwdInput.focus(); }, 100);
  }

  function closeAuthConfirmModal() {
    const modal = document.getElementById('modal-auth-confirm');
    if (modal) modal.style.display = 'none';
    const pwdInput = document.getElementById('input-auth-confirm-pwd');
    if (pwdInput) pwdInput.value = '';
  }

  // =========================================================================
  // 12. REGISTRO DE AUDITORÍA Y CONTROL CON LLAVE MAESTRA (0401)
  // =========================================================================
  const MASTER_KEY = '0401';
  let currentAuditLogs = [];
  let currentUndoLogId = null;

  // Estado de Control de Caja y Entrega de Dinero
  let controlCajaData = { fondoBase: 0, entregas: {} };
  let fotoEntregaBase64 = null;
  let pendingAuthIsChica = false;

  // Clave Privada de Gerencia para operaciones de alta seguridad (eliminaciones)
  const GERENCIA_PRIVATE_KEY = '04012021';

  function solicitarClaveGerencia(motivo = 'autorizar esta operación') {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-auth-gerencia');
      const input = document.getElementById('input-pin-gerencia');
      const btnConfirm = document.getElementById('btn-confirm-auth-gerencia');
      const btnCancel = document.getElementById('btn-cancel-auth-gerencia');
      const errorMsg = document.getElementById('msg-pin-gerencia-error');
      const descEl = document.getElementById('txt-auth-gerencia-desc');

      if (descEl) {
        descEl.innerHTML = `Para <strong>${motivo}</strong>, ingrese la <strong>Clave Privada de Gerencia</strong>:`;
      }
      if (btnConfirm) {
        btnConfirm.innerHTML = '🔓 Autorizar Operación';
      }

      if (!modal || !input || !btnConfirm || !btnCancel) {
        const pin = prompt('🔒 AUTORIZACIÓN GERENCIAL REQUERIDA\n\nIngrese la Clave Privada de Gerencia:');
        if (pin === GERENCIA_PRIVATE_KEY) {
          resolve(true);
        } else {
          if (pin !== null) {
            showToast('Clave de gerencia incorrecta', 'error');
            logAuditMovement({
              modulo: 'Seguridad',
              accion: 'CLAVE_GERENCIA_INCORRECTA',
              descripcion: `Intento denegado de clave privada de gerencia para: ${motivo}`,
              reversible: false
            });
          }
          resolve(false);
        }
        return;
      }

      input.value = '';
      if (errorMsg) errorMsg.style.display = 'none';
      modal.style.display = 'flex';
      setTimeout(() => input.focus(), 80);

      const cleanup = () => {
        modal.style.display = 'none';
        btnConfirm.onclick = null;
        btnCancel.onclick = null;
        input.onkeydown = null;
      };

      const handleConfirm = () => {
        const entered = (input.value || '').trim();
        if (entered === GERENCIA_PRIVATE_KEY) {
          cleanup();
          resolve(true);
        } else {
          if (errorMsg) errorMsg.style.display = 'block';
          input.value = '';
          input.focus();
          showToast('Clave de gerencia incorrecta', 'error');
          logAuditMovement({
            modulo: 'Seguridad',
            accion: 'CLAVE_GERENCIA_INCORRECTA',
            descripcion: `Intento denegado de clave privada de gerencia para: ${motivo}`,
            reversible: false
          });
        }
      };

      btnConfirm.onclick = handleConfirm;
      btnCancel.onclick = () => {
        cleanup();
        resolve(false);
      };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          cleanup();
          resolve(false);
        }
      };
    });
  }

  async function logAuditMovement({ modulo, accion, descripcion, payload, reversible = true, meta = {} }) {
    try {
      const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Usuario';
      const logEntry = {
        fechaHora: getHidalgoIsoString(),
        usuario: userEmail,
        modulo,
        accion,
        descripcion,
        payload,
        reversible,
        estado: 'ACTIVO',
        meta
      };
      await TB_FIREBASE.saveAuditLog(logEntry);
    } catch (e) {
      console.warn('Error registrando auditoría:', e);
    }
  }

  function formatDateTime(isoString) {
    if (!isoString) return '--/--/---- --:--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d);
    } catch (e) {
      return isoString;
    }
  }

  function getModuleBadgeClass(modulo) {
    switch (modulo) {
      case 'Navegación': return 'audit-badge-nav';
      case 'Autenticación': return 'audit-badge-auth';
      case 'Seguridad': return 'audit-badge-sec';
      case 'Ventas': return 'audit-badge-ventas';
      case 'Arqueo Principal':
      case 'Caja Chica':
      case 'Historial Arqueo': return 'audit-badge-caja';
      case 'BalanceScore': return 'audit-badge-balancescore';
      case 'Reporte Ingresos': return 'audit-badge-ingresos';
      case 'Configuración General': return 'audit-badge-config';
      case 'Interesadas': return 'audit-badge-leads';
      case 'Campaña': return 'audit-badge-campana';
      default: return 'audit-badge-auditoria';
    }
  }

  async function renderAuditoriaView() {
    const tbody = document.getElementById('tbody-auditoria-logs');
    const badge = document.getElementById('badge-total-audit');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--muted);">Cargando bitácora de eventos desde Firebase...</td></tr>';
    }

    currentAuditLogs = await TB_FIREBASE.getAuditoriaLogs();
    renderAuditoriaTable();
  }

  function renderAuditoriaTable() {
    const tbody = document.getElementById('tbody-auditoria-logs');
    const badge = document.getElementById('badge-total-audit');
    if (!tbody) return;

    const query = (document.getElementById('filtro_audit_busqueda')?.value || '').toLowerCase().trim();
    const filtroModulo = document.getElementById('filtro_audit_modulo')?.value || 'TODOS';
    const filtroEstado = document.getElementById('filtro_audit_estado')?.value || 'TODOS';

    const filtered = currentAuditLogs.filter(item => {
      if (filtroModulo !== 'TODOS' && item.modulo !== filtroModulo) return false;
      if (filtroEstado !== 'TODOS' && item.estado !== filtroEstado) return false;
      if (query) {
        const u = (item.usuario || '').toLowerCase();
        const d = (item.descripcion || '').toLowerCase();
        const a = (item.accion || '').toLowerCase();
        const m = (item.modulo || '').toLowerCase();
        if (!u.includes(query) && !d.includes(query) && !a.includes(query) && !m.includes(query)) return false;
      }
      return true;
    });

    if (badge) badge.textContent = `${filtered.length} Movimientos`;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty-notice">
            <span>🛡️</span>
            No se encontraron eventos o movimientos con los filtros seleccionados.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(log => {
      const tr = document.createElement('tr');
      const isRevertido = log.estado === 'REVERTIDO';
      const isReversible = log.reversible !== false && !isRevertido;

      tr.innerHTML = `
        <td>
          <span style="font-family:monospace; font-size:0.78rem; color:var(--dark); font-weight:600;">
            ${formatDateTime(log.fechaHora)}
          </span>
        </td>
        <td>
          <strong style="font-size:0.84rem; color:var(--dark);">${log.usuario || 'Usuario'}</strong>
        </td>
        <td>
          <span class="audit-badge ${getModuleBadgeClass(log.modulo)}">${log.modulo || 'General'}</span>
        </td>
        <td>
          <span class="audit-code-snippet">${log.accion}</span>
        </td>
        <td>
          <div style="font-size:0.86rem; color:var(--dark); font-weight:500; line-height:1.4;">
            ${log.descripcion}
          </div>
          ${isRevertido && log.revertidoAt ? `<div style="font-size:0.74rem; color:#b91c1c; margin-top:3px;">↩️ Revertido el ${formatDateTime(log.revertidoAt)} por <strong>${log.revertidoPor || 'Admin'}</strong></div>` : ''}
        </td>
        <td class="text-center">
          ${isRevertido 
            ? '<span class="kpi-status-badge badge-faltante" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;">⚪ Revertido</span>' 
            : '<span class="kpi-status-badge badge-cuadrada">🟢 Aplicado</span>'}
        </td>
        <td class="text-center">
          ${isReversible 
            ? `<button type="button" class="btn btn-outline-danger btn-sm btn-undo-log" data-id="${log.id}" title="Deshacer este movimiento con Llave Maestra 0401">↩️ Deshacer</button>`
            : '<span style="color:var(--muted); font-size:0.78rem;">--</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function openMasterKeyModal(logItem) {
    currentUndoLogId = logItem.id;
    const modal = document.getElementById('modal-master-key');
    const descEl = document.getElementById('modal-audit-desc');
    const metaEl = document.getElementById('modal-audit-meta');
    const inputKey = document.getElementById('input-master-key');
    const errorBox = document.getElementById('modal-master-error');

    if (descEl) descEl.textContent = logItem.descripcion;
    if (metaEl) metaEl.innerHTML = `Módulo: <strong>${logItem.modulo}</strong> &bull; Usuario: <strong>${logItem.usuario}</strong> &bull; Fecha: ${formatDateTime(logItem.fechaHora)}`;
    if (inputKey) {
      inputKey.value = '';
      inputKey.type = 'password';
    }
    if (errorBox) errorBox.style.display = 'none';
    if (modal) modal.style.display = 'flex';
    setTimeout(() => { if (inputKey) inputKey.focus(); }, 100);
  }

  function closeMasterKeyModal() {
    const modal = document.getElementById('modal-master-key');
    if (modal) modal.style.display = 'none';
    currentUndoLogId = null;
  }

  async function executeUndoMovement(logItem) {
    const { accion, payload } = logItem;
    if (!payload) throw new Error('Este movimiento no tiene datos reversibles asociados.');

    switch (accion) {
      case 'ALTA_VENTA':
        if (payload.fecha && payload.id) {
          await TB_FIREBASE.deleteVenta(payload.fecha, payload.id);
          renderVentas(payload.fecha);
          if (payload.fecha === document.getElementById('header_fecha')?.value) {
            syncVentasToCajaPrincipal(payload.fecha, false);
          }
        }
        break;

      case 'BAJA_VENTA':
        if (payload.venta) {
          await TB_FIREBASE.saveVenta(payload.venta);
          renderVentas(payload.fecha || payload.venta.fecha);
          if ((payload.fecha || payload.venta.fecha) === document.getElementById('header_fecha')?.value) {
            syncVentasToCajaPrincipal(payload.fecha || payload.venta.fecha, false);
          }
        }
        break;

      case 'ALTA_SERVICIO':
        if (payload.item && payload.item.id) {
          catServicios = catServicios.filter(s => s.id !== payload.item.id);
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
        }
        break;

      case 'BAJA_SERVICIO':
        if (payload.item) {
          if (!catServicios.some(s => s.id === payload.item.id)) {
            catServicios.push(payload.item);
          }
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
        }
        break;

      case 'EDICION_SERVICIO':
        if (payload.antes && payload.antes.id) {
          const idx = catServicios.findIndex(s => s.id === payload.antes.id);
          if (idx !== -1) {
            catServicios[idx] = { ...payload.antes };
          } else {
            catServicios.push(payload.antes);
          }
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
        }
        break;

      case 'ALTA_ESTACION':
        if (payload.item) {
          catEstaciones = catEstaciones.filter(st => st.id !== payload.item.id && st.nombre !== payload.item.nombre);
          await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
          await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());
          renderCatEstacionesTable();
          renderCatMetasTable();
          populateSalesDropdowns();
          populateConfigStationDropdowns();
          renderBalanceScoreStations();
        }
        break;

      case 'BAJA_ESTACION':
        if (payload.item) {
          if (!catEstaciones.some(st => st.id === payload.item.id || st.nombre === payload.item.nombre)) {
            catEstaciones.push(payload.item);
          }
          await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
          await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());
          renderCatEstacionesTable();
          renderCatMetasTable();
          populateSalesDropdowns();
          populateConfigStationDropdowns();
          renderBalanceScoreStations();
        }
        break;

      case 'ALTA_ESPECIALISTA':
        if (payload.item && payload.item.id) {
          catEspecialistas = catEspecialistas.filter(esp => esp.id !== payload.item.id);
          await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
          renderCatEspecialistasTable();
          populateSalesDropdowns();
        }
        break;

      case 'BAJA_ESPECIALISTA':
        if (payload.item) {
          if (!catEspecialistas.some(esp => esp.id === payload.item.id)) {
            catEspecialistas.push(payload.item);
          }
          await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
          renderCatEspecialistasTable();
          populateSalesDropdowns();
        }
        break;

      case 'VACIAR_CATALOGO':
        if (payload.catalogType === 'servicios') {
          catServicios = payload.items || [];
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
        } else if (payload.catalogType === 'estaciones') {
          catEstaciones = payload.items || [];
          await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
          await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());
          renderCatEstacionesTable();
          renderCatMetasTable();
          populateSalesDropdowns();
          populateConfigStationDropdowns();
          renderBalanceScoreStations();
        } else if (payload.catalogType === 'especialistas') {
          catEspecialistas = payload.items || [];
          await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
          renderCatEspecialistasTable();
          populateSalesDropdowns();
        } else if (payload.catalogType === 'todo') {
          catServicios = payload.servicios || [];
          catEstaciones = payload.estaciones || [];
          catEspecialistas = payload.especialistas || [];
          await Promise.all([
            TB_FIREBASE.saveCatalogo('servicios', catServicios),
            TB_FIREBASE.saveCatalogo('estaciones', catEstaciones),
            TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas),
            TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas())
          ]);
          loadAndRenderConfiguracion();
          populateSalesDropdowns();
          populateConfigStationDropdowns();
          renderBalanceScoreStations();
        }
        break;

      case 'ALTA_ARQUEO_PRINCIPAL':
        if (payload.arqueoKey) {
          const delRes = await TB_FIREBASE.deleteArqueo('principal', payload.arqueoKey);
          const arqueoEliminado = delRes?.item || payload.data || {};
          const fArqueo = arqueoEliminado.header?.fecha || arqueoEliminado.fecha || payload.fecha || getHidalgoDateStr();

          // Restaurar el fondo base al valor previo a este corte
          let fondoRestaurar = 0;
          if (arqueoEliminado.fondoInicial !== undefined && arqueoEliminado.fondoInicial !== null && !isNaN(arqueoEliminado.fondoInicial)) {
            fondoRestaurar = parseFloat(arqueoEliminado.fondoInicial) || 0;
          } else {
            const lastGlobal = await TB_FIREBASE.getUltimoCorteGlobal();
            if (lastGlobal && lastGlobal.destinoEfectivo === 'se_queda_en_caja') {
              fondoRestaurar = parseFloat(lastGlobal.montoQuedaEnCaja || lastGlobal.conteo?.total || 0) || 0;
            }
          }
          await TB_FIREBASE.saveFondoBaseCaja(fondoRestaurar);
          controlCajaData.fondoBase = fondoRestaurar;

          // Sincronizar ventas del día y liberar las ventas que estaban contempladas en este corte
          await syncVentasToCajaPrincipal(fArqueo, false);
          await loadControlCajaData();
          renderControlCajaFondo();
          recalculatePrincipal();
          loadHistorial();
        }
        break;

      case 'ALTA_ARQUEO_CHICA':
        if (payload.arqueoKey) {
          await TB_FIREBASE.deleteArqueo('chica', payload.arqueoKey);
          await loadControlCajaData();
          loadHistorial();
          recalculateChica();
        }
        break;

      case 'ALTA_LEAD':
        if (payload.lead && payload.lead.id) {
          await TB_FIREBASE.deleteLead(payload.lead.id);
          loadInteresadasView();
        }
        break;

      case 'UPDATE_LEAD':
        if (payload.leadBackup) {
          await TB_FIREBASE.saveLead(payload.leadBackup);
          loadInteresadasView();
        }
        break;

      case 'BAJA_LEAD':
        if (payload.leadBackup) {
          await TB_FIREBASE.saveLead(payload.leadBackup);
          loadInteresadasView();
        }
        break;

      case 'CONFIG_CAMPANA':
        if (payload.prevCampana) {
          await TB_FIREBASE.saveCampanaActiva(payload.prevCampana);
          renderCampanaActiva();
        }
        break;

      case 'ALTA_EVENTO':
        if (payload.evento && payload.evento.id) {
          await TB_FIREBASE.deleteEvento(payload.evento.id);
          renderEventosTimeline();
        }
        break;

      case 'BAJA_EVENTO':
        if (payload.evento) {
          await TB_FIREBASE.saveEvento(payload.evento);
          renderEventosTimeline();
        }
        break;

      case 'ENTREGA_DINERO':
        if (payload.entrega && payload.entrega.id) {
          await TB_FIREBASE.deleteEntregaDinero(payload.entrega.id);
          await loadControlCajaData();
        }
        break;

      default:
        throw new Error(`Acción "${accion}" no reconocida para reversión.`);
    }

    // Actualizar registro en Firebase a estado REVERTIDO
    logItem.estado = 'REVERTIDO';
    logItem.revertidoAt = new Date().toISOString();
    logItem.revertidoPor = TB_FIREBASE.getCurrentUser()?.email || 'Usuario';
    await TB_FIREBASE.updateAuditLog(logItem);

    // Registrar en la bitácora el evento de reversión
    await TB_FIREBASE.saveAuditLog({
      modulo: 'Auditoría',
      accion: 'REVERTIR_CON_LLAVE_MAESTRA',
      descripcion: `Movimiento deshecho con Llave Maestra: [${logItem.descripcion}]`,
      reversible: false,
      payload: { targetLogId: logItem.id }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Hidratación inmediata en memoria local (0 ms)
    hydrateMemoryFromLocalStorage();
    populateSalesDropdowns();
    populateConfigStationDropdowns();
    initVentaServicioCombobox();

    // Inicializar vista en Ventas respetando preferencia guardada
    setVentasViewMode(currentVentasViewMode);
    setVentasSectionMode(currentVentasSectionMode);

    // Configurar Canvas de Firmas base
    sigCtxPrincipal = setupSignaturePad(sigPadPrincipal, () => { sigDataPrincipal = true; });
    sigCtxChica = setupSignaturePad(sigPadChica, () => { sigDataChica = true; });

    // Inicializar Sistema de Firma Digital con Cuadrito Negro y Modal Pantalla Grande
    initInteractiveSignatureSystem();

    // Menú Lateral
    document.querySelectorAll('.menu-item-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const mod = link.dataset.module;
        document.getElementById('app-sidebar')?.classList.remove('open');
        document.getElementById('sidebar-backdrop')?.classList.remove('active');
        if (mod) switchModule(mod);
      });
    });

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      const sidebar = document.getElementById('app-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      const isOpen = sidebar?.classList.toggle('open');
      if (backdrop) {
        if (isOpen) backdrop.classList.add('active');
        else backdrop.classList.remove('active');
      }
    });

    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
      document.getElementById('app-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-backdrop')?.classList.remove('active');
    });

    // Desplazamiento animado del menú y scroll hint
    const sidebarMenu = document.querySelector('.sidebar-menu');
    const scrollHint = document.getElementById('sidebar-scroll-hint');
    if (sidebarMenu && scrollHint) {
      function updateScrollHint() {
        const nearBottom = (sidebarMenu.scrollHeight - sidebarMenu.scrollTop - sidebarMenu.clientHeight < 25);
        if (nearBottom) {
          scrollHint.style.opacity = '0';
          scrollHint.style.pointerEvents = 'none';
        } else {
          scrollHint.style.opacity = '1';
          scrollHint.style.pointerEvents = 'auto';
        }
      }
      sidebarMenu.addEventListener('scroll', updateScrollHint, { passive: true });
      setTimeout(updateScrollHint, 400);

      scrollHint.addEventListener('click', () => {
        sidebarMenu.scrollBy({ top: 140, behavior: 'smooth' });
      });
    }

    // Firebase Status Dot
    TB_FIREBASE.onConnectionChange((online) => {
      const dot = document.getElementById('fb-status-dot');
      const text = document.getElementById('fb-status-text');
      if (dot) dot.className = online ? 'status-dot' : 'status-dot offline';
      if (text) text.textContent = online ? 'Firebase Conectado' : 'Sin Conexión con Firebase';
    });

    // Recálculo dinámico en Caja Principal y Chica
    document.addEventListener('input', (e) => {
      if (e.target.matches('.calc-trigger') || e.target.matches('.ant-pago') || e.target.matches('.ant-saldo')) {
        recalculatePrincipal();
      }
      if (e.target.matches('.chica-calc-trigger') || e.target.matches('.chica-importe')) {
        recalculateChica();
      }
    });

    // Botones de incremento denominaciones
    document.querySelectorAll('.denom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.denomination-row');
        const input = row.querySelector('.denom-input');
        if (!input) return;
        let v = parseInt(input.value, 10) || 0;
        if (btn.dataset.action === 'inc') v += 1;
        if (btn.dataset.action === 'dec') v = Math.max(0, v - 1);
        input.value = v;
        recalculatePrincipal();
      });
    });

    // Botones de incremento/decremento denominaciones Caja Chica
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.denom-btn-chica');
      if (btn) {
        const row = btn.closest('.denomination-row');
        const input = row?.querySelector('.chica-denom-input');
        if (!input) return;
        let v = parseInt(input.value, 10) || 0;
        if (btn.dataset.action === 'inc') v += 1;
        if (btn.dataset.action === 'dec') v = Math.max(0, v - 1);
        input.value = v;
        recalculateChica();
      }
    });

    // Botones de incremento rápido (+5) en denominaciones
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.denom-btn-quick');
      if (btn) {
        const row = btn.closest('.denomination-row');
        const input = row?.querySelector('.chica-denom-input');
        if (!input) return;
        let v = parseInt(input.value, 10) || 0;
        if (btn.dataset.action === 'add5') v += 5;
        input.value = v;
        recalculateChica();
      }
    });

    // Chips de conceptos frecuentes en Caja Chica (1 clic)
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.btn-quick-chip');
      if (chip) {
        const concept = chip.dataset.concept || chip.textContent.trim();
        addOrFillChicaExpense(concept);
      }
    });

    // Botón reiniciar conteo en cero de Caja Chica
    document.getElementById('btn-reset-conteo-chica')?.addEventListener('click', () => {
      document.querySelectorAll('.chica-denom-input').forEach(inp => {
        inp.value = 0;
      });
      recalculateChica();
      showToast('🧹 Conteo de caja chica reiniciado a cero', 'info');
    });

    // Auto-seleccionar texto al enfocar campos numéricos para escribir de inmediato
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('.chica-denom-input') || e.target.matches('.chica-importe') || e.target.matches('.denom-input')) {
        e.target.select();
      }
    });

    // Filas dinámicas en Caja Chica y Anticipos
    document.getElementById('btn-add-chica-salida')?.addEventListener('click', () => {
      const tbody = document.getElementById('tbody-chica-salidas');
      const tr = document.createElement('tr');
      tr.className = 'chica-salida-row';
      tr.innerHTML = `
        <td><input type="text" class="input-text chica-concepto" placeholder="Ej. Materiales, insumos..."></td>
        <td><input type="text" class="input-text chica-motivo" placeholder="Para qué se utilizó..."></td>
        <td><input type="text" class="input-text chica-autorizo" placeholder="Persona que autorizó..."></td>
        <td>
          <div class="currency-input-wrap"><span class="currency-prefix">$</span>
            <input type="number" step="0.01" min="0" class="input-currency chica-calc-trigger chica-importe" value="0.00">
          </div>
        </td>
        <td class="text-center">
          <input type="file" accept="image/*" class="chica-file-input" style="display:none;">
          <button type="button" class="btn btn-secondary btn-sm btn-subir-evidencia" style="padding:4px 8px; font-size:0.75rem;">📷 Ticket</button>
          <div class="chica-preview-wrap" style="display:none; margin-top:3px;">
            <img class="chica-thumb-img btn-thumb-foto" src="" style="width:32px; height:32px; object-fit:cover; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer;" title="Clic para ampliar ticket">
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-row" title="Eliminar fila">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
      recalculateChica();
    });

    
    // Delegación para subida de evidencia en salidas de caja chica
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-subir-evidencia');
      if (btn) {
        const row = btn.closest('.chica-salida-row');
        const fileInput = row?.querySelector('.chica-file-input');
        if (fileInput) fileInput.click();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.matches('.chica-file-input')) {
        const file = e.target.files?.[0];
        if (!file) return;
        const row = e.target.closest('.chica-salida-row');
        const reader = new FileReader();
        reader.onload = (re) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 800;
            let w = img.width, h = img.height;
            if (w > h && w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const base64 = canvas.toDataURL('image/jpeg', 0.75);

            if (row) {
              row.dataset.evidenciaBase64 = base64;
              const prevWrap = row.querySelector('.chica-preview-wrap');
              const prevImg = row.querySelector('.chica-thumb-img');
              const btnSubir = row.querySelector('.btn-subir-evidencia');
              if (prevImg) prevImg.src = base64;
              if (prevWrap) prevWrap.style.display = 'block';
              if (btnSubir) {
                btnSubir.innerHTML = '✅ Cambiar';
                btnSubir.className = 'btn btn-outline-success btn-sm btn-subir-evidencia';
              }
            }
            showToast('Ticket/Comprobante adjuntado con éxito', 'success');
          };
          img.src = re.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    // Clic en foto de evidencia de caja chica para ampliar en lightbox
    document.addEventListener('click', (e) => {
      if (e.target.matches('.chica-thumb-img')) {
        const src = e.target.src;
        const modal = document.getElementById('modal-ver-foto');
        const img = document.getElementById('img-ver-foto-full');
        const tit = document.getElementById('ver-foto-titulo');
        const meta = document.getElementById('ver-foto-meta');
        if (img) img.src = src;
        if (tit) tit.textContent = 'Evidencia de Gasto de Caja Chica';
        if (meta) meta.textContent = 'Comprobante / Ticket adjunto';
        if (modal) modal.style.display = 'flex';
      }
    });

    // Guardar Fondo Inicial de Caja Principal en Configuración General
    document.getElementById('form-config-cajaprincipal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = document.getElementById('cfg_principal_fondo_base')?.value;
      const val = parseFloat(raw);
      if (isNaN(val) || val < 0) {
        showToast('El fondo inicial no puede ser negativo', 'warning');
        return;
      }
      showToast('Guardando fondo inicial de Caja Principal en Firebase...', 'info');
      await TB_FIREBASE.saveFondoBaseCaja(val);
      controlCajaData.fondoBase = val;
      logAuditMovement({
        modulo: 'Configuración General',
        accion: 'CONFIG_CAJA_PRINCIPAL_FONDO',
        descripcion: `Actualización de Fondo Inicial de Caja Principal: ${val.toFixed(2)}`,
        payload: { fondoBase: val }
      });
      showToast('✅ Fondo Inicial de Caja Principal guardado en Firebase', 'success');
      renderControlCajaFondo();
      await loadControlCajaData();
    });

    // Guardar Fondo de Caja Chica en Configuración General
    document.getElementById('form-config-cajachica')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = parseFloat(document.getElementById('cfg_chica_fondo_base')?.value) || 0;
      if (val < 0) {
        showToast('El fondo base no puede ser negativo', 'warning');
        return;
      }
      showToast('Guardando fondo base de Caja Chica en Firebase...', 'info');
      await TB_FIREBASE.saveCajaChicaConfig({ fondoBase: val });
      logAuditMovement({
        modulo: 'Configuración General',
        accion: 'CONFIG_CAJA_CHICA_FONDO',
        descripcion: `Actualización de Fondo Base de Caja Chica: $${val.toFixed(2)}`,
        payload: { fondoBase: val }
      });
      showToast('✅ Fondo de Caja Chica guardado en Firebase', 'success');
      await loadCajaChicaFundData();
    });

    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn-del-row')) {
        const tr = e.target.closest('tr');
        if (tr) {
          tr.remove();
          recalculatePrincipal();
          recalculateChica();
        }
      }
    });

    // Guardado de Arqueo Diario de Caja Principal
    document.getElementById('btn-save-firebase-bottom')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveFirebaseAndDownload(false);
    });

    document.getElementById('form-arqueo-principal')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveFirebaseAndDownload(false);
    });

    // Guardado de Arqueo Diario de Caja Chica
    document.getElementById('btn-save-firebase-chica')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await saveFirebaseAndDownload(true);
    });

    document.getElementById('form-arqueo-chica')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveFirebaseAndDownload(true);
    });

    document.getElementById('btn-cancel-auth-confirm')?.addEventListener('click', () => {
      closeAuthConfirmModal();
    });

    document.getElementById('btn-toggle-auth-confirm-pwd')?.addEventListener('click', () => {
      const inp = document.getElementById('input-auth-confirm-pwd');
      const btn = document.getElementById('btn-toggle-auth-confirm-pwd');
      if (inp) {
        const isPwd = inp.type === 'password';
        inp.type = isPwd ? 'text' : 'password';
        if (btn) btn.textContent = isPwd ? '🙈' : '👁️';
      }
    });

    document.getElementById('btn-submit-auth-confirm')?.addEventListener('click', async () => {
      const pwdInput = document.getElementById('input-auth-confirm-pwd');
      const errBox = document.getElementById('auth-confirm-error');
      const pwd = pwdInput ? pwdInput.value : '';

      if (!pwd) {
        if (errBox) {
          errBox.textContent = 'Contraseña incorrecta.';
          errBox.style.display = 'block';
        }
        showToast('Contraseña incorrecta', 'danger');
        return;
      }

      showToast('Verificando...', 'info');
      const authRes = await TB_FIREBASE.verifyCurrentUserPassword(pwd);
      if (!authRes.success) {
        if (errBox) {
          errBox.textContent = 'Contraseña incorrecta.';
          errBox.style.display = 'block';
        }
        showToast('Contraseña incorrecta', 'danger');
        return;
      }

      closeAuthConfirmModal();
      showToast('Autenticación confirmada', 'success');
      await saveFirebaseAndDownload(pendingAuthIsChica);
    });

    document.getElementById('input-auth-confirm-pwd')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-submit-auth-confirm')?.click();
      }
    });

    // Botón para verificar rápidamente pagos registrados
    document.getElementById('btn-auto-verif-pagos')?.addEventListener('click', () => {
      const tReg = parseVal('ctrl_transf_reg');
      const jReg = parseVal('ctrl_tarj_reg');
      const oReg = parseVal('ctrl_otros_reg');
      const elT = document.getElementById('ctrl_transf_verif');
      const elJ = document.getElementById('ctrl_tarj_verif');
      const elO = document.getElementById('ctrl_otros_verif');
      if (elT) elT.value = tReg.toFixed(2);
      if (elJ) elJ.value = jReg.toFixed(2);
      if (elO) elO.value = oReg.toFixed(2);
      recalculatePrincipal();
      showToast('Pagos no en efectivo marcados como verificados', 'success');
    });

  // =========================================================================
  // CONTROLADOR DEL MODAL DE CORTES DE CAJA DE HOY
  // =========================================================================
  function renderModalCortesHoy() {
    const modal = document.getElementById('modal-lista-cortes-hoy');
    const container = document.getElementById('cortes-hoy-cards-container');
    if (!modal || !container) return;

    if (!currentCortesHoy || currentCortesHoy.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:28px 16px; color:#64748b; font-size:0.95rem;">No se han realizado cortes de caja en esta fecha.</div>';
    } else {
      container.innerHTML = '';
      currentCortesHoy.forEach(corte => {
        const card = document.createElement('div');
        card.className = 'corte-card-item';

        const num = corte.corteNum || 1;
        const hora = corte.header?.hora || corte.hora || '--:--';
        const resp = corte.header?.responsable || corte.validacion?.responsable || 'Responsable';
        const totIng = parseFloat(corte.ingresos?.totales?.granTotal || corte.resumen?.totalIngresos || 0);
        const totCont = parseFloat(corte.conteo?.total || corte.conciliacion?.contado || 0);
        const dif = parseFloat(corte.conciliacion?.diferencia || 0);
        const resArqueo = corte.conciliacion?.resultado || (Math.abs(dif) < 0.005 ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante'));
        const dest = corte.destinoEfectivo || corte.validacion?.destinoEfectivo;

        let badgeClass = 'badge-cuadrada';
        let badgeText = 'Cuadrada';
        if (resArqueo === 'sobrante') { badgeClass = 'badge-sobrante'; badgeText = 'Sobrante'; }
        else if (resArqueo === 'faltante') { badgeClass = 'badge-faltante'; badgeText = 'Faltante'; }

        let destHtml = '';
        if (dest === 'se_guarda_en_sobre') {
          destHtml = '✉️ <strong>Sobre cerrado:</strong> Folio <span style="font-family:monospace; font-weight:700;">' + (corte.folioSobre || corte.validacion?.folioSobre || 'N/A') + '</span> &bull; Monto: <strong>' + formatCurrency(corte.montoSobre || corte.validacion?.importeEntregado || totCont) + '</strong> <span style="color:#2563eb; font-weight:600;">(Resguardado - No faltante)</span>';
        } else if (dest === 'se_resguarda_otro') {
          destHtml = '🏦 <strong>Resguardo:</strong> ' + (corte.lugarResguardo || 'Otro lugar') + ' &bull; Folio <span style="font-family:monospace; font-weight:700;">' + (corte.folioResguardo || corte.validacion?.folioResguardo || 'N/A') + '</span> &bull; Monto: <strong>' + formatCurrency(corte.montoResguardo || corte.validacion?.importeEntregado || totCont) + '</strong> <span style="color:#d97706; font-weight:600;">(Resguardado - No faltante)</span>';
        } else {
          destHtml = '💵 <strong>Se quedó en caja:</strong> Monto: <strong>' + formatCurrency(corte.montoQuedaEnCaja || totCont) + '</strong> <span style="color:#15803d; font-weight:600;">(Pasó al Fondo Inicial del sig. corte)</span>';
        }

        const numVentas = Array.isArray(corte.ventasIds) ? corte.ventasIds.length : (corte.ingresos?.operaciones || '0');

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="background:#0b0f17; color:#d4af37; padding:2px 8px; border-radius:4px; font-weight:800; font-size:0.85rem;">Corte #${num}</span>
              <span style="font-weight:700; color:#0f172a; font-size:0.92rem;">Hora: ${hora}</span>
              <span style="color:#64748b; font-size:0.8rem;">&bull; 👤 ${resp}</span>
            </div>
            <span class="kpi-status-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:8px; font-size:0.82rem;">
            <div><span style="color:#64748b;">Ventas en corte:</span> <strong>${numVentas}</strong> (${formatCurrency(totIng)})</div>
            <div><span style="color:#64748b;">Efectivo contado:</span> <strong>${formatCurrency(totCont)}</strong></div>
            <div><span style="color:#64748b;">Diferencia:</span> <strong style="color:${Math.abs(dif)<0.01?'#16a34a':'#dc2626'}">${formatCurrency(dif)}</strong></div>
          </div>
          <div style="font-size:0.8rem; background:#f8fafc; border:1px solid #e2e8f0; padding:6px 10px; border-radius:6px; margin-bottom:8px;">
            ${destHtml}
          </div>
          <div style="display:flex; justify-content:flex-end;">
            <button type="button" class="btn btn-firebase btn-sm btn-view-corte-pdf" style="font-size:0.78rem; padding:4px 10px; font-weight:700;">
              🧾 Ver Ticket
            </button>
          </div>
        `;

        card.querySelector('.btn-view-corte-pdf')?.addEventListener('click', () => {
          modal.style.display = 'none';
          openReportPdfViewer(corte, false, corte.key);
        });

        container.appendChild(card);
      });
    }

    modal.style.display = 'flex';
  }

    // Control interactivo de destino del efectivo al cierre del corte
    const destSelect = document.getElementById('val_destino_efectivo');
    if (destSelect) {
      destSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const wrapQueda = document.getElementById('wrap_destino_queda_caja');
        const wrapSobre = document.getElementById('wrap_destino_guarda_sobre');
        const wrapResg = document.getElementById('wrap_destino_resguarda_otro');
        const inpContado = parseVal('conteo_total_efectivo');

        if (wrapQueda) wrapQueda.style.display = (val === 'se_queda_en_caja') ? 'block' : 'none';
        if (wrapSobre) wrapSobre.style.display = (val === 'se_guarda_en_sobre') ? 'block' : 'none';
        if (wrapResg) wrapResg.style.display = (val === 'se_resguarda_otro') ? 'block' : 'none';

        if (val === 'se_queda_en_caja') {
          const inpQ = document.getElementById('val_monto_queda_caja');
          if (inpQ && (!inpQ.value || parseVal('val_monto_queda_caja') === 0)) {
            inpQ.value = inpContado.toFixed(2);
          }
          const inpEnt = document.getElementById('val_importe_entregado');
          if (inpEnt) inpEnt.value = '0.00';
        } else if (val === 'se_guarda_en_sobre') {
          const inpS = document.getElementById('val_importe_sobre');
          if (inpS && (!inpS.value || parseVal('val_importe_sobre') === 0)) {
            inpS.value = inpContado.toFixed(2);
          }
          const inpEnt = document.getElementById('val_importe_entregado');
          if (inpEnt) inpEnt.value = (inpS ? inpS.value : inpContado.toFixed(2));
          suggestFolios(document.getElementById('header_fecha')?.value, currentCorteNum);
        } else if (val === 'se_resguarda_otro') {
          const inpR = document.getElementById('val_importe_resguardo');
          if (inpR && (!inpR.value || parseVal('val_importe_resguardo') === 0)) {
            inpR.value = inpContado.toFixed(2);
          }
          const inpEnt = document.getElementById('val_importe_entregado');
          if (inpEnt) inpEnt.value = (inpR ? inpR.value : inpContado.toFixed(2));
          suggestFolios(document.getElementById('header_fecha')?.value, currentCorteNum);
        }
      });
    }

    // Botones rápidos Copiar Contado
    document.getElementById('btn-copy-queda-caja')?.addEventListener('click', () => {
      const val = parseVal('conteo_total_efectivo').toFixed(2);
      const inp = document.getElementById('val_monto_queda_caja');
      if (inp) { inp.value = val; inp.dataset.manual = 'true'; }
      showToast('Monto copiado: $' + val, 'info');
    });

    document.getElementById('btn-copy-sobre')?.addEventListener('click', () => {
      const val = parseVal('conteo_total_efectivo').toFixed(2);
      const inp = document.getElementById('val_importe_sobre');
      if (inp) { inp.value = val; inp.dataset.manual = 'true'; }
      const inpEnt = document.getElementById('val_importe_entregado');
      if (inpEnt) inpEnt.value = val;
      showToast('Importe copiado al sobre: $' + val, 'info');
    });

    document.getElementById('btn-copy-resguardo')?.addEventListener('click', () => {
      const val = parseVal('conteo_total_efectivo').toFixed(2);
      const inp = document.getElementById('val_importe_resguardo');
      if (inp) { inp.value = val; inp.dataset.manual = 'true'; }
      const inpEnt = document.getElementById('val_importe_entregado');
      if (inpEnt) inpEnt.value = val;
      showToast('Importe copiado a resguardo: $' + val, 'info');
    });

    ['val_monto_queda_caja', 'val_importe_sobre', 'val_importe_resguardo'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        e.target.dataset.manual = 'true';
        if (id === 'val_importe_sobre' || id === 'val_importe_resguardo') {
          const inpEnt = document.getElementById('val_importe_entregado');
          if (inpEnt) inpEnt.value = e.target.value;
        }
      });
    });

    ['val_folio_sobre', 'val_folio_resguardo'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        e.target.dataset.autoFolio = 'false';
      });
    });

    // Modal Cortes de Hoy
    document.getElementById('btn-ver-cortes-hoy')?.addEventListener('click', () => {
      renderModalCortesHoy();
    });
    document.getElementById('btn-close-cortes-hoy')?.addEventListener('click', () => {
      document.getElementById('modal-lista-cortes-hoy').style.display = 'none';
    });
    document.getElementById('btn-close-cortes-hoy-x')?.addEventListener('click', () => {
      document.getElementById('modal-lista-cortes-hoy').style.display = 'none';
    });

        // Control de Caja: Entrega de Dinero
    document.getElementById('btn-open-entrega-dinero')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-entrega-dinero');
      const form = document.getElementById('form-entrega-dinero');
      const prevWrap = document.getElementById('ent_preview_wrap');
      if (form) form.reset();
      if (prevWrap) prevWrap.style.display = 'none';
      fotoEntregaBase64 = null;

      // Mostrar el efectivo actualmente disponible en caja
      const dispEl = document.getElementById('modal-ent-disponible');
      if (dispEl) {
        const fBase = parseVal('f_inicial_caja');
        const vEfec = parseVal('ing_total_efectivo');
        const disp = Math.max(0, fBase + vEfec);
        dispEl.textContent = formatCurrency(disp);
      }

      if (modal) modal.style.display = 'flex';
      setTimeout(() => { document.getElementById('ent_recibe')?.focus(); }, 100);
    });

    document.getElementById('btn-cancel-entrega-dinero')?.addEventListener('click', () => {
      document.getElementById('modal-entrega-dinero').style.display = 'none';
      fotoEntregaBase64 = null;
    });

    // Captura y compresión de fotografía
    document.getElementById('ent_foto')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (re) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > h && w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          fotoEntregaBase64 = canvas.toDataURL('image/jpeg', 0.72);

          const prevWrap = document.getElementById('ent_preview_wrap');
          const prevImg = document.getElementById('ent_preview_img');
          if (prevImg) prevImg.src = fotoEntregaBase64;
          if (prevWrap) prevWrap.style.display = 'block';
        };
        img.src = re.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('form-entrega-dinero')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const recibe = document.getElementById('ent_recibe').value.trim();
      const cantidad = parseFloat(document.getElementById('ent_cantidad').value) || 0;
      const concepto = document.getElementById('ent_concepto').value.trim();

      if (!recibe || cantidad <= 0 || !concepto) {
        showToast('Complete los campos requeridos: A quién, Cantidad y Concepto', 'warning');
        return;
      }

      showGlobalLoader('Registrando Entrega...', 'Descontando de caja y guardando comprobante...');
      showToast('Guardando entrega de dinero...', 'info');
      try {
        const curUser = TB_FIREBASE.getCurrentUser();
        const hDate = document.getElementById('header_fecha')?.value || getHidalgoDateStr();
        const hTime = getHidalgoTimeStr();
        const nowIso = new Date().toISOString();

        const entrega = {
          id: 'ent_' + Date.now(),
          fecha: hDate,
          hora: hTime,
          fechaHora: nowIso,
          createdAt: nowIso,
          recibe,
          cantidad,
          concepto,
          fotoBase64: fotoEntregaBase64 || null,
          registradoPor: curUser?.email || 'Usuario'
        };

        if (!controlCajaData.entregas) controlCajaData.entregas = {};
        controlCajaData.entregas[entrega.id] = entrega;

        await TB_FIREBASE.saveEntregaDinero(entrega);

        // Descontar inmediatamente del Fondo Base en Firebase y memoria
        const fondoActual = (typeof controlCajaData.fondoBase === 'number' && !isNaN(controlCajaData.fondoBase))
          ? controlCajaData.fondoBase
          : (parseFloat(document.getElementById('f_inicial_caja')?.value) || 0);
        const nuevoFondo = Math.max(0, fondoActual - cantidad);
        await TB_FIREBASE.saveFondoBaseCaja(nuevoFondo);
        controlCajaData.fondoBase = nuevoFondo;

        logAuditMovement({
          modulo: 'Arqueo Principal',
          accion: 'ENTREGA_DINERO',
          descripcion: 'Entrega de dinero en efectivo: $' + cantidad.toFixed(2) + ' a "' + recibe + '" por "' + concepto + '" - Nuevo fondo en caja: $' + nuevoFondo.toFixed(2),
          payload: { entrega, fondoRestante: nuevoFondo }
        });

        document.getElementById('modal-entrega-dinero').style.display = 'none';
        showToast('✅ Entrega de $' + cantidad.toFixed(2) + ' registrada. Total en caja restante: $' + nuevoFondo.toFixed(2), 'success');

        renderControlCajaFondo();
        recalculatePrincipal();
        await loadControlCajaData();
        renderControlCajaFondo();
      } catch (err) {
        console.error('Error al guardar entrega:', err);
        showToast('Error al registrar entrega de dinero', 'error');
      } finally {
        hideGlobalLoader(150);
      }
    });

    // Ver entregas de hoy y lightbox de fotos
    document.getElementById('btn-ver-entregas-hoy')?.addEventListener('click', () => {
      const today = (document.getElementById('header_fecha')?.value || getHidalgoDateStr());
      const entregasHoy = getEntregasDelDia(today);
      const tbody = document.getElementById('tbody-entregas-hoy');
      const thTot = document.getElementById('th-total-entregas-hoy');

      let sumEnt = 0;
      if (tbody) {
        tbody.innerHTML = '';
        if (entregasHoy.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--muted);">No hay entregas registradas hoy.</td></tr>';
        } else {
          entregasHoy.forEach(item => {
            const imp = parseFloat(item.cantidad) || 0;
            sumEnt += imp;
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><span style="font-family:monospace; font-weight:600;">${item.hora || '--:--'}</span></td>
              <td><strong>${escapeHtml(item.recibe)}</strong></td>
              <td>${escapeHtml(item.concepto)}</td>
              <td class="text-right"><strong style="color:#b91c1c;">$${imp.toFixed(2)}</strong></td>
              <td class="text-center">
                ${item.fotoBase64 ? `<img src="${item.fotoBase64}" class="btn-thumb-foto" data-id="${item.id}" title="Ver comprobante" style="width:36px; height:36px; object-fit:cover; border-radius:4px; cursor:pointer;">` : '<span style="color:#94a3b8; font-size:0.75rem;">Sin foto</span>'}
              </td>
              <td class="text-center">
                <button type="button" class="btn btn-outline-danger btn-sm btn-del-entrega" data-id="${item.id}" title="Eliminar registro">✕</button>
              </td>
            `;
            tbody.appendChild(tr);
          });
        }
      }

      if (thTot) thTot.textContent = formatCurrency(sumEnt);
      document.getElementById('modal-lista-entregas').style.display = 'flex';
    });

    document.getElementById('btn-close-lista-entregas')?.addEventListener('click', () => {
      document.getElementById('modal-lista-entregas').style.display = 'none';
    });

    // Clic en thumbnail para lightbox de foto y eliminación de entrega protegida
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-thumb-foto')) {
        const id = e.target.dataset.id;
        const entrega = controlCajaData.entregas?.[id];
        if (entrega && entrega.fotoBase64) {
          document.getElementById('img-ver-foto-full').src = entrega.fotoBase64;
          document.getElementById('ver-foto-titulo').textContent = `Entrega a ${entrega.recibe} ($${parseFloat(entrega.cantidad).toFixed(2)})`;
          document.getElementById('ver-foto-meta').textContent = `Registrado por: ${entrega.registradoPor || 'Usuario'} a las ${entrega.hora || ''} (${entrega.concepto})`;
          document.getElementById('modal-ver-foto').style.display = 'flex';
        }
      }
      if (e.target.matches('.btn-del-entrega')) {
        const id = e.target.dataset.id;
        const autorizado = await solicitarClaveGerencia('eliminar entrega de dinero');
        if (!autorizado) return;

        if (confirm('¿Está seguro de eliminar este registro de entrega de dinero? El importe volverá al fondo disponible de caja.')) {
          const entregaItem = controlCajaData.entregas ? controlCajaData.entregas[id] : null;
          const cantDevolver = entregaItem ? (parseFloat(entregaItem.cantidad) || 0) : 0;

          TB_FIREBASE.deleteEntregaDinero(id).then(async () => {
            if (controlCajaData.entregas && controlCajaData.entregas[id]) {
              delete controlCajaData.entregas[id];
            }
            if (cantDevolver > 0) {
              const nuevoFondo = (parseFloat(controlCajaData.fondoBase) || 0) + cantDevolver;
              await TB_FIREBASE.saveFondoBaseCaja(nuevoFondo);
              controlCajaData.fondoBase = nuevoFondo;
            }
            await loadControlCajaData();
            renderControlCajaFondo();
            recalculatePrincipal();
            document.getElementById('btn-ver-entregas-hoy')?.click();
            showToast('Entrega eliminada y $' + cantDevolver.toFixed(2) + ' devueltos a caja', 'info');
            logAuditMovement({
              modulo: 'Caja Principal',
              accion: 'ELIMINAR_ENTREGA_DINERO',
              descripcion: `Eliminación de entrega de dinero: ID ${id} ($${cantDevolver.toFixed(2)}) reintegrado a caja`,
              payload: { id, cantidad: cantDevolver },
              reversible: false
            });
          });
        }
      }
    });

    document.getElementById('btn-close-ver-foto')?.addEventListener('click', () => {
      document.getElementById('modal-ver-foto').style.display = 'none';
    });

    document.getElementById('header_fecha')?.addEventListener('change', (e) => {
      syncVentasToCajaPrincipal(e.target.value, false);
      renderControlCajaFondo();
    });

    document.getElementById('btn-sync-ventas-caja')?.addEventListener('click', () => {
      const fecha = document.getElementById('ventas_filtro_fecha')?.value;
      syncVentasToCajaPrincipal(fecha, true);
      switchModule('arqueo-principal');
    });

    document.getElementById('btn-copy-entregado')?.addEventListener('click', () => {
      document.getElementById('val_importe_entregado').value = parseVal('conteo_total_efectivo').toFixed(2);
      showToast('Importe entregado copiado del conteo', 'info');
    });

    // Historial switches
    document.getElementById('btn-hist-tipo-principal')?.addEventListener('click', () => {
      currentHistTipo = 'principal';
      document.getElementById('btn-hist-tipo-principal').classList.add('active');
      document.getElementById('btn-hist-tipo-chica').classList.remove('active');
      loadHistorial(document.getElementById('historial_filtro_fecha')?.value || null);
    });

    document.getElementById('btn-hist-tipo-chica')?.addEventListener('click', () => {
      currentHistTipo = 'chica';
      document.getElementById('btn-hist-tipo-chica').classList.add('active');
      document.getElementById('btn-hist-tipo-principal').classList.remove('active');
      loadHistorial(document.getElementById('historial_filtro_fecha')?.value || null);
    });

    document.getElementById('historial_filtro_fecha')?.addEventListener('change', (e) => {
      loadHistorial(e.target.value);
    });

    document.getElementById('btn-historial-todos')?.addEventListener('click', () => {
      document.getElementById('historial_filtro_fecha').value = '';
      loadHistorial();
    });

    document.getElementById('btn-refresh-history')?.addEventListener('click', () => {
      loadHistorial(document.getElementById('historial_filtro_fecha')?.value || null);
      showToast('Historial recargado desde Firebase', 'success');
    });

    // Eventos del Visor de Reportes PDF
    const modalViewPdf = document.getElementById('modal-view-pdf-report');
    modalViewPdf?.addEventListener('click', (e) => {
      if (e.target === modalViewPdf) closeReportPdfModal();
    });
    document.getElementById('btn-close-pdf-modal')?.addEventListener('click', closeReportPdfModal);
    document.getElementById('btn-copy-ticket-whatsapp')?.addEventListener('click', () => {
      if (!activeViewingReport?.item) return;
      const txt = buildWhatsAppTicketSummary(activeViewingReport.item, activeViewingReport.isChica, activeViewingReport.key);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => {
          showToast('📋 ¡Resumen copiado! Listo para pegar en WhatsApp', 'success');
        }).catch(() => {
          showToast('No se pudo copiar automáticamente al portapapeles', 'warning');
        });
      } else {
        showToast('📋 Portapapeles no soportado en este dispositivo', 'warning');
      }
    });
    document.getElementById('btn-download-modal-pdf')?.addEventListener('click', () => {
      showToast('Función PDF eliminada. Use la opción de Captura o WhatsApp.', 'info');
    });
    document.getElementById('btn-print-modal-pdf')?.addEventListener('click', () => {
      window.print();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalViewPdf && modalViewPdf.style.display !== 'none') {
        closeReportPdfModal();
      }
    });

    // -----------------------------------------------------------------------
    // EVENTOS: REGISTRO DIARIO DE VENTAS (WIZARD CON MULTI-SERVICIO EN TICKET)
    // -----------------------------------------------------------------------
    let currentTicketServicios = [];

    // Al seleccionar un servicio: autocompletar estación y precio sugerido
    document.getElementById('venta_servicio')?.addEventListener('change', (e) => {
      syncVentaServicioComboboxFromSelect();
      const selected = e.target.selectedOptions[0];
      if (selected) {
        const est = selected.dataset.estacion;
        const prc = selected.dataset.precio;
        if (est) {
          const estEl = document.getElementById('venta_estacion');
          if (estEl) estEl.value = est;
        }
        if (prc && parseFloat(prc) > 0) {
          const prcEl = document.getElementById('venta_servicio_precio');
          if (prcEl) prcEl.value = parseFloat(prc).toFixed(2);
        }
      }
    });

    // Renderizar lista dinámica de servicios agregados al ticket
    function renderTicketServiciosList() {
      const listEl = document.getElementById('ticket-servicios-items-list');
      const countEl = document.getElementById('lbl-ticket-servicios-count');
      const subtotalEl = document.getElementById('lbl-ticket-servicios-subtotal');
      if (!listEl) return;

      const subtotal = currentTicketServicios.reduce((sum, item) => sum + (parseFloat(item.precio) || 0), 0);
      const count = currentTicketServicios.length;

      if (countEl) countEl.textContent = `${count} ${count === 1 ? 'servicio' : 'servicios'}`;
      if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

      if (count === 0) {
        listEl.innerHTML = `
          <div id="ticket-servicios-empty" style="text-align:center; padding:18px 10px; color:#64748b; font-size:0.85rem; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
            Seleccione un servicio arriba y toque <strong>"➕ Agregar este servicio al ticket"</strong> (o toque directamente <strong>"Continuar ➔"</strong> para agregar el servicio seleccionado).
          </div>
        `;
        return;
      }

      listEl.innerHTML = currentTicketServicios.map((it, idx) => `
        <div class="ticket-servicio-item" style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; border-left:3.5px solid #d4af37; border-radius:8px; padding:10px 14px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.15rem;">✂️</span>
            <div>
              <div style="font-weight:800; font-size:0.92rem; color:#000000;">
                <span style="color:#d4af37; font-size:0.8rem; margin-right:4px;">#${idx + 1}</span>${escapeHtml(it.servicio)}
              </div>
              <div style="font-size:0.78rem; color:#64748b; display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap;">
                <span>🪞 ${escapeHtml(it.estacion)}</span>
                <span>&bull;</span>
                <span>💅 ${escapeHtml(it.especialista)}</span>
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-weight:800; font-size:0.95rem; color:#15803d;">${formatCurrency(it.precio)}</span>
            <button type="button" class="btn btn-outline-danger btn-sm btn-del-ticket-item" data-idx="${idx}" title="Quitar servicio del ticket" style="padding:3px 8px; font-size:0.75rem; border-radius:6px; font-weight:700;">✕</button>
          </div>
        </div>
      `).join('');

      // Evento para quitar servicio individual del ticket
      listEl.querySelectorAll('.btn-del-ticket-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const delIdx = parseInt(btn.dataset.idx, 10);
          if (!isNaN(delIdx) && delIdx >= 0 && delIdx < currentTicketServicios.length) {
            const removed = currentTicketServicios.splice(delIdx, 1)[0];
            renderTicketServiciosList();
            showToast(`🗑️ Servicio "${removed.servicio}" quitado del ticket`, 'info');
            // Recalcular total sugerido
            const newSub = currentTicketServicios.reduce((s, it) => s + (parseFloat(it.precio) || 0), 0);
            const totEl = document.getElementById('venta_total');
            if (totEl) totEl.value = newSub > 0 ? newSub.toFixed(2) : '';
          }
        });
      });
    }

    // Función para agregar el servicio actual de los inputs al ticket
    function addCurrentServiceToTicket(silent = false) {
      const srvSelect = document.getElementById('venta_servicio');
      const estSelect = document.getElementById('venta_estacion');
      const espSelect = document.getElementById('venta_especialista');
      const prcInput = document.getElementById('venta_servicio_precio');

      const srvVal = srvSelect?.value;
      const srvText = srvSelect && srvSelect.selectedIndex >= 0 && srvSelect.options[srvSelect.selectedIndex]?.value
        ? srvSelect.options[srvSelect.selectedIndex].text.split(' - $')[0].trim()
        : '';
      const estVal = estSelect?.value;
      const espVal = espSelect?.value;
      const prcVal = parseFloat(prcInput?.value) || 0;

      if (!srvVal) {
        if (!silent) showToast('Por favor seleccione el servicio o producto', 'warning');
        srvSelect?.focus();
        return false;
      }
      if (!estVal) {
        if (!silent) showToast('Por favor seleccione la estación de trabajo', 'warning');
        estSelect?.focus();
        return false;
      }
      if (!espVal) {
        if (!silent) showToast('Por favor seleccione la especialista', 'warning');
        espSelect?.focus();
        return false;
      }

      currentTicketServicios.push({
        servicio: srvText || srvVal,
        estacion: estVal,
        especialista: espVal,
        precio: prcVal
      });

      renderTicketServiciosList();

      // Limpiar select de servicio y precio para permitir agregar el siguiente cómodamente
      if (srvSelect) srvSelect.selectedIndex = 0;
      if (prcInput) prcInput.value = '';
      resetVentaServicioCombobox();

      // Actualizar automáticamente el total cobrado con la suma de servicios
      const subtotal = currentTicketServicios.reduce((sum, item) => sum + (parseFloat(item.precio) || 0), 0);
      const totEl = document.getElementById('venta_total');
      if (totEl) totEl.value = subtotal.toFixed(2);

      if (!silent) {
        showToast(`✅ "${srvText || srvVal}" agregado al ticket (${currentTicketServicios.length})`, 'success');
      }
      return true;
    }

    document.getElementById('btn-add-servicio-ticket')?.addEventListener('click', () => {
      addCurrentServiceToTicket(false);
    });

    // Enlaces directos a configuración
    document.querySelectorAll('.btn-goto-config').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.configTab || 'servicios';
        if (!isConfigUnlocked) {
          openUnlockConfigModal(tab);
          return;
        }
        switchModule('configuracion');
        switchConfigTab(tab);
      });
    });

    // -----------------------------------------------------------------------
    // WIZARD DINÁMICO: REGISTRO DE VENTAS PASO A PASO
    // -----------------------------------------------------------------------
    let currentVentaStep = 1;

    function updateVentaSummary() {
      const fecha = document.getElementById('venta_fecha')?.value || '--';
      const clienta = document.getElementById('venta_clienta')?.value.trim() || 'Cliente Mostrador';
      const telefono = document.getElementById('venta_telefono')?.value.trim() || 'No especificado';
      
      const elFecha = document.getElementById('resumen-val-fecha');
      if (elFecha) elFecha.textContent = fecha;

      const elClienta = document.getElementById('resumen-val-clienta');
      if (elClienta) elClienta.textContent = clienta;

      const elTel = document.getElementById('resumen-val-telefono');
      if (elTel) elTel.textContent = telefono;

      const elSrv = document.getElementById('resumen-val-servicio');
      const elEst = document.getElementById('resumen-val-estacion');
      const elEsp = document.getElementById('resumen-val-especialista');
      const detWrap = document.getElementById('resumen-servicios-detallados-wrap');
      const detList = document.getElementById('resumen-servicios-detallados-list');

      if (currentTicketServicios.length === 1) {
        const item = currentTicketServicios[0];
        if (elSrv) elSrv.textContent = `${item.servicio} ($${parseFloat(item.precio || 0).toFixed(2)})`;
        if (elEst) elEst.textContent = item.estacion;
        if (elEsp) elEsp.textContent = item.especialista;
        if (detWrap) detWrap.style.display = 'none';
      } else if (currentTicketServicios.length > 1) {
        const srvNames = currentTicketServicios.map(s => s.servicio).join(' + ');
        const estNames = [...new Set(currentTicketServicios.map(s => s.estacion))].join(', ');
        const espNames = [...new Set(currentTicketServicios.map(s => s.especialista))].join(', ');

        if (elSrv) elSrv.innerHTML = `${escapeHtml(srvNames)} <span class="badge" style="background:#fef9c3; color:#854d0e; font-size:0.75rem; padding:2px 8px; border-radius:10px; font-weight:800; margin-left:4px;">${currentTicketServicios.length} servicios</span>`;
        if (elEst) elEst.textContent = estNames;
        if (elEsp) elEsp.textContent = espNames;

        if (detWrap) detWrap.style.display = 'block';
        if (detList) {
          detList.innerHTML = currentTicketServicios.map((s, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; font-size:0.85rem;">
              <div>
                <strong>#${i + 1} ${escapeHtml(s.servicio)}</strong>
                <span style="color:#64748b; font-size:0.75rem; margin-left:6px;">(🪞 ${escapeHtml(s.estacion)} &bull; 💅 ${escapeHtml(s.especialista)})</span>
              </div>
              <strong style="color:#15803d;">${formatCurrency(s.precio)}</strong>
            </div>
          `).join('');
        }
      } else {
        const srvSelect = document.getElementById('venta_servicio');
        const srvText = srvSelect && srvSelect.selectedIndex >= 0 && srvSelect.options[srvSelect.selectedIndex]?.value 
          ? srvSelect.options[srvSelect.selectedIndex].text 
          : '--';
        const estSelect = document.getElementById('venta_estacion');
        const estText = estSelect && estSelect.selectedIndex >= 0 && estSelect.options[estSelect.selectedIndex]?.value 
          ? estSelect.options[estSelect.selectedIndex].text 
          : '--';
        const espSelect = document.getElementById('venta_especialista');
        const espText = espSelect && espSelect.selectedIndex >= 0 && espSelect.options[espSelect.selectedIndex]?.value 
          ? espSelect.options[espSelect.selectedIndex].text 
          : '--';

        if (elSrv) elSrv.textContent = srvText;
        if (elEst) elEst.textContent = estText;
        if (elEsp) elEsp.textContent = espText;
        if (detWrap) detWrap.style.display = 'none';
      }

      const totVal = parseFloat(document.getElementById('venta_total')?.value) || 0;
      const metodoVal = document.getElementById('venta_metodo_pago')?.value || 'Efectivo';
      const statusVal = document.getElementById('venta_status_pago')?.value || 'Pagado completo';
      const notasVal = document.getElementById('venta_notas')?.value.trim();

      const elTot = document.getElementById('resumen-val-total');
      if (elTot) elTot.textContent = formatCurrency(totVal);

      const elMet = document.getElementById('resumen-val-metodo');
      const elChips = document.getElementById('resumen-desglose-chips');
      if (metodoVal === 'Mixto') {
        const efec = parseFloat(document.getElementById('pago_monto_efectivo')?.value) || 0;
        const tarj = parseFloat(document.getElementById('pago_monto_tarjeta')?.value) || 0;
        const transf = parseFloat(document.getElementById('pago_monto_transf')?.value) || 0;
        if (elMet) elMet.textContent = '🔀 Varios Medios';
        if (elChips) {
          let chips = '';
          if (efec > 0) chips += `<span class="chip-pago chip-efectivo">💵 ${formatCurrency(efec)}</span> `;
          if (tarj > 0) chips += `<span class="chip-pago chip-tarjeta">💳 ${formatCurrency(tarj)}</span> `;
          if (transf > 0) chips += `<span class="chip-pago chip-transf">📱 ${formatCurrency(transf)}</span> `;
          elChips.innerHTML = chips;
          elChips.style.display = 'flex';
        }
      } else {
        if (elChips) elChips.style.display = 'none';
        if (elMet) {
          let icon = '💵';
          if (metodoVal.toLowerCase().includes('tarj')) icon = '💳';
          else if (metodoVal.toLowerCase().includes('transf')) icon = '📱';
          elMet.textContent = `${icon} ${metodoVal}`;
        }
      }

      const elStat = document.getElementById('resumen-val-status');
      if (elStat) {
        let icon = '✅';
        if (statusVal.toLowerCase().includes('anticipo')) icon = '🟡';
        else if (statusVal.toLowerCase().includes('pendiente')) icon = '🔴';
        elStat.textContent = `${icon} ${statusVal}`;
      }

      const elNotas = document.getElementById('resumen-val-notas');
      if (elNotas) {
        elNotas.textContent = notasVal ? notasVal : '(Sin notas adicionales)';
        elNotas.style.fontStyle = notasVal ? 'normal' : 'italic';
      }
    }

    function recalcDesglosePagos() {
      const efec = parseFloat(document.getElementById('pago_monto_efectivo')?.value) || 0;
      const tarj = parseFloat(document.getElementById('pago_monto_tarjeta')?.value) || 0;
      const transf = parseFloat(document.getElementById('pago_monto_transf')?.value) || 0;
      const suma = efec + tarj + transf;
      let total = parseFloat(document.getElementById('venta_total')?.value) || 0;

      // Si total está vacío o en 0 pero se ingresaron montos en el desglose, sincronizar total
      if (total <= 0 && suma > 0) {
        document.getElementById('venta_total').value = suma.toFixed(2);
        total = suma;
      }

      const dif = total - suma;

      const elTotal = document.getElementById('lbl-desglose-total');
      if (elTotal) elTotal.textContent = formatCurrency(total);

      const elSuma = document.getElementById('lbl-desglose-suma');
      if (elSuma) elSuma.textContent = formatCurrency(suma);

      const elDif = document.getElementById('lbl-desglose-dif');
      const elDifWrap = document.getElementById('lbl-desglose-diferencia-wrap');
      const statusBadge = document.getElementById('desglose-status-badge');
      const quickAssign = document.getElementById('desglose-quick-assign');

      if (Math.abs(dif) < 0.005 && suma > 0) {
        if (elDifWrap) elDifWrap.style.display = 'none';
        if (statusBadge) {
          statusBadge.className = 'desglose-status-badge badge-cuadrado';
          statusBadge.textContent = '✅ Montos cuadrados perfectamente';
        }
        if (quickAssign) quickAssign.style.display = 'none';
      } else if (dif > 0.005) {
        if (elDifWrap) {
          elDifWrap.style.display = 'inline';
          if (elDif) elDif.textContent = `Faltan ${formatCurrency(dif)}`;
        }
        if (statusBadge) {
          statusBadge.className = 'desglose-status-badge badge-incompleto';
          statusBadge.textContent = `⚠️ Faltan ${formatCurrency(dif)} por asignar`;
        }
        if (quickAssign) quickAssign.style.display = 'flex';
      } else if (dif < -0.005) {
        if (elDifWrap) {
          elDifWrap.style.display = 'inline';
          if (elDif) elDif.textContent = `Exceso de ${formatCurrency(Math.abs(dif))}`;
        }
        if (statusBadge) {
          statusBadge.className = 'desglose-status-badge badge-exceso';
          statusBadge.textContent = `⚠️ Excede el total por ${formatCurrency(Math.abs(dif))}`;
        }
        if (quickAssign) quickAssign.style.display = 'none';
      } else {
        if (elDifWrap) elDifWrap.style.display = 'none';
        if (statusBadge) {
          statusBadge.className = 'desglose-status-badge badge-incompleto';
          statusBadge.textContent = '⚠️ Ingrese los montos';
        }
        if (quickAssign) quickAssign.style.display = 'none';
      }
    }

    function validateVentaStep(step) {
      if (step === 1) {
        const fecha = document.getElementById('venta_fecha')?.value;
        if (!fecha) {
          showToast('Por favor ingrese la fecha de la venta', 'warning');
          document.getElementById('venta_fecha')?.focus();
          return false;
        }
        return true;
      }
      if (step === 2) {
        // Si no hay ningún servicio agregado en la lista del ticket, intentar agregar el seleccionado actualmente
        if (currentTicketServicios.length === 0) {
          const added = addCurrentServiceToTicket(true);
          if (!added) {
            showToast('Por favor seleccione y agregue al menos un servicio al ticket', 'warning');
            return false;
          }
        } else {
          // Si ya hay servicios agregados y en los campos hay otro seleccionado, agregarlo también
          const srv = document.getElementById('venta_servicio')?.value;
          if (srv) {
            addCurrentServiceToTicket(true);
          }
        }

        // Actualizar el total sugerido para el Paso 3 si está vacío o en 0
        const subtotal = currentTicketServicios.reduce((sum, item) => sum + (parseFloat(item.precio) || 0), 0);
        const totEl = document.getElementById('venta_total');
        if (totEl && (!totEl.value || parseFloat(totEl.value) === 0)) {
          totEl.value = subtotal > 0 ? subtotal.toFixed(2) : '';
        }
        return true;
      }
      if (step === 3) {
        const tot = parseFloat(document.getElementById('venta_total')?.value);
        if (isNaN(tot) || tot <= 0) {
          showToast('Por favor ingrese un monto total cobrado válido', 'warning');
          document.getElementById('venta_total')?.focus();
          return false;
        }
        const metodo = document.getElementById('venta_metodo_pago')?.value;
        if (!metodo) {
          showToast('Por favor seleccione el método de pago', 'warning');
          return false;
        }
        if (metodo === 'Mixto') {
          const efec = parseFloat(document.getElementById('pago_monto_efectivo')?.value) || 0;
          const tarj = parseFloat(document.getElementById('pago_monto_tarjeta')?.value) || 0;
          const transf = parseFloat(document.getElementById('pago_monto_transf')?.value) || 0;
          const suma = efec + tarj + transf;
          if (suma <= 0) {
            showToast('Por favor ingrese los montos para cada medio de pago utilizado', 'warning');
            document.getElementById('pago_monto_efectivo')?.focus();
            return false;
          }
          if (Math.abs(suma - tot) > 0.01) {
            showToast(`La suma de los medios de pago (${formatCurrency(suma)}) no coincide con el Total Cobrado (${formatCurrency(tot)})`, 'warning');
            return false;
          }
        }
        const status = document.getElementById('venta_status_pago')?.value;
        if (!status) {
          showToast('Por favor seleccione el status del pago', 'warning');
          return false;
        }
        return true;
      }
      return true;
    }

    function goToVentaStep(targetStep) {
      if (targetStep < 1) targetStep = 1;
      if (targetStep > 4) targetStep = 4;

      currentVentaStep = targetStep;

      // Actualizar barra de progreso
      const progressFill = document.getElementById('ventas-progress-bar');
      if (progressFill) {
        const pct = (targetStep / 4) * 100;
        progressFill.style.width = `${pct}%`;
      }

      // Actualizar indicadores de pasos
      const stepTitles = [
        '',
        '📅 Fecha y Clienta',
        '✂️ Servicio y Estación',
        '💰 Cobro y Pago',
        '📋 Resumen y Confirmación'
      ];

      document.querySelectorAll('.stepper-step').forEach(btn => {
        const s = parseInt(btn.dataset.step, 10);
        btn.classList.remove('active', 'completed');
        if (s === targetStep) {
          btn.classList.add('active');
        } else if (s < targetStep) {
          btn.classList.add('completed');
        }
      });

      const mobilePill = document.getElementById('step-mobile-pill');
      if (mobilePill) mobilePill.textContent = `Paso ${targetStep} de 4`;

      const mobileTitle = document.getElementById('step-mobile-title');
      const pctValue = Math.round((targetStep / 4) * 100);
      if (mobileTitle) mobileTitle.textContent = `${pctValue}% completado`;

      // Alternar paneles de paso
      for (let i = 1; i <= 4; i++) {
        const pane = document.getElementById(`step-pane-${i}`);
        if (pane) {
          if (i === targetStep) {
            pane.style.display = 'block';
            pane.classList.add('active');
          } else {
            pane.style.display = 'none';
            pane.classList.remove('active');
          }
        }
      }

      // Si entramos al paso 4, refrescar resumen
      if (targetStep === 4) {
        updateVentaSummary();
      }

      // Registrar avance en auditoría si no es el paso 1 inicial
      if (targetStep > 1) {
        logAuditMovement({
          modulo: 'Ventas',
          accion: 'NAVEGACION_ASISTENTE',
          descripcion: `Avance en formulario de venta al Paso ${targetStep} de 4 (${stepTitles[targetStep] || ''})`,
          payload: { targetStep },
          reversible: false
        });
      }

      // En pantallas móviles, scroll suave al inicio de la tarjeta del asistente
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        const wizardCard = document.querySelector('.ventas-wizard-card');
        if (wizardCard) {
          wizardCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    // Navegación de botones
    document.getElementById('btn-step1-next')?.addEventListener('click', () => {
      if (validateVentaStep(1)) goToVentaStep(2);
    });

    document.getElementById('btn-step2-prev')?.addEventListener('click', () => {
      goToVentaStep(1);
    });
    document.getElementById('btn-step2-next')?.addEventListener('click', () => {
      if (validateVentaStep(2)) goToVentaStep(3);
    });

    document.getElementById('btn-step3-prev')?.addEventListener('click', () => {
      goToVentaStep(2);
    });
    document.getElementById('btn-step3-next')?.addEventListener('click', () => {
      if (validateVentaStep(3)) goToVentaStep(4);
    });

    document.getElementById('btn-step4-prev')?.addEventListener('click', () => {
      goToVentaStep(3);
    });

    // Botones de modificación directa en el resumen
    document.querySelectorAll('.btn-edit-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const tgt = parseInt(btn.dataset.targetStep, 10) || 1;
        goToVentaStep(tgt);
      });
    });

    // Clic en los botones de paso superior
    document.querySelectorAll('.stepper-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = parseInt(btn.dataset.step, 10);
        if (s === 1) {
          goToVentaStep(1);
        } else if (s === 2) {
          if (validateVentaStep(1)) goToVentaStep(2);
        } else if (s === 3) {
          if (validateVentaStep(1) && validateVentaStep(2)) goToVentaStep(3);
        } else if (s === 4) {
          if (validateVentaStep(1) && validateVentaStep(2) && validateVentaStep(3)) goToVentaStep(4);
        }
      });
    });

    // Control de tecla Enter en el formulario
    document.getElementById('form-nueva-venta')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        if (currentVentaStep === 1) {
          e.preventDefault();
          if (validateVentaStep(1)) goToVentaStep(2);
        } else if (currentVentaStep === 2) {
          e.preventDefault();
          if (validateVentaStep(2)) goToVentaStep(3);
        } else if (currentVentaStep === 3) {
          e.preventDefault();
          if (validateVentaStep(3)) goToVentaStep(4);
        }
      }
    });

    document.getElementById('form-nueva-venta')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Si por alguna razón no se agregó ningún servicio al ticket, intentar con los campos activos
      if (currentTicketServicios.length === 0) {
        addCurrentServiceToTicket(true);
      }

      const fecha = document.getElementById('venta_fecha').value;
      const telefono = document.getElementById('venta_telefono').value.trim(); // Opcional
      const clienta = document.getElementById('venta_clienta').value.trim();
      
      const srvCombined = currentTicketServicios.length > 0 
        ? currentTicketServicios.map(s => s.servicio).join(' + ')
        : (document.getElementById('venta_servicio')?.value || '');

      const estCombined = currentTicketServicios.length > 0
        ? [...new Set(currentTicketServicios.map(s => s.estacion))].join(', ')
        : (document.getElementById('venta_estacion')?.value || '');

      const espCombined = currentTicketServicios.length > 0
        ? [...new Set(currentTicketServicios.map(s => s.especialista))].join(', ')
        : (document.getElementById('venta_especialista')?.value || '');

      const metodoPago = document.getElementById('venta_metodo_pago').value;
      const totalCobrado = parseFloat(document.getElementById('venta_total').value) || 0;
      const statusPago = document.getElementById('venta_status_pago').value;
      const notas = document.getElementById('venta_notas').value.trim();

      // Validación obligatoria
      if (!fecha || !srvCombined || !estCombined || !espCombined || !metodoPago || isNaN(totalCobrado) || !statusPago) {
        showToast('Por favor llene todos los campos obligatorios marcados con *', 'warning');
        return;
      }

      let desglosePago = null;
      let montoEfectivo = 0;
      let montoTarjeta = 0;
      let montoTransferencia = 0;

      if (metodoPago === 'Mixto') {
        montoEfectivo = parseFloat(document.getElementById('pago_monto_efectivo')?.value) || 0;
        montoTarjeta = parseFloat(document.getElementById('pago_monto_tarjeta')?.value) || 0;
        montoTransferencia = parseFloat(document.getElementById('pago_monto_transf')?.value) || 0;
        desglosePago = {
          efectivo: montoEfectivo,
          tarjeta: montoTarjeta,
          transferencia: montoTransferencia
        };
      } else if (metodoPago === 'Tarjeta') {
        montoTarjeta = totalCobrado;
        desglosePago = { efectivo: 0, tarjeta: totalCobrado, transferencia: 0 };
      } else if (metodoPago === 'Transferencia') {
        montoTransferencia = totalCobrado;
        desglosePago = { efectivo: 0, tarjeta: 0, transferencia: totalCobrado };
      } else {
        montoEfectivo = totalCobrado;
        desglosePago = { efectivo: totalCobrado, tarjeta: 0, transferencia: 0 };
      }

      const venta = {
        fecha,
        telefono,
        clienta,
        servicio: srvCombined,
        servicios: currentTicketServicios.slice(),
        estacion: estCombined,
        especialista: espCombined,
        metodoPago,
        desglosePago,
        montoEfectivo,
        montoTarjeta,
        montoTransferencia,
        totalCobrado,
        statusPago,
        notas,
        createdAt: new Date().toISOString()
      };

      // 1. Abrir ventana emergente inmediatamente para garantizar que el navegador no la bloquee
      let ticketWin = null;
      try {
        const winFeatures = getTicketWindowFeatures();
        ticketWin = window.open('about:blank', 'TicketTotalBeauty_' + Date.now(), winFeatures);
        if (ticketWin && ticketWin.document) {
          ticketWin.document.open();
          ticketWin.document.write(getTicketLoadingHTML(venta));
          ticketWin.document.close();
        }
      } catch (winErr) {
        console.warn('No se pudo abrir ventana de forma preliminar:', winErr);
      }

      // 2. Guardar venta en Firebase
      await TB_FIREBASE.saveVenta(venta);
      const servCountStr = currentTicketServicios.length > 1 ? ` (${currentTicketServicios.length} servicios)` : '';
      showToast(`✅ Venta guardada en Firebase. Asegurando registro (esperando 3 segundos)...`, 'info');

      logAuditMovement({
        modulo: 'Ventas',
        accion: 'ALTA_VENTA',
        descripcion: `Venta cobrada: ${venta.servicio} (${venta.estacion}) por $${totalCobrado.toFixed(2)} - Clienta: ${venta.clienta || 'Público Mostrador'} - Método: ${venta.metodoPago}`,
        payload: { fecha: venta.fecha, id: venta.id, venta }
      });

      // 3. Esperar exactamente 3 segundos para asegurarse de que sí se guardó antes de mostrar el ticket final
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. Mostrar el ticket digital en la ventana externa listo para compartir por WhatsApp como imagen
      openVentaTicketExternalWindow(venta, ticketWin);

      // Limpiar formulario y vaciar lista del ticket
      currentTicketServicios = [];
      renderTicketServiciosList();

      document.getElementById('venta_telefono').value = '';
      document.getElementById('venta_clienta').value = '';
      document.getElementById('venta_servicio').value = '';
      resetVentaServicioCombobox();
      document.getElementById('venta_estacion').value = '';
      document.getElementById('venta_especialista').value = '';
      if (document.getElementById('venta_servicio_precio')) document.getElementById('venta_servicio_precio').value = '';
      document.getElementById('venta_total').value = '';
      document.getElementById('venta_notas').value = '';
      if (document.getElementById('pago_monto_efectivo')) document.getElementById('pago_monto_efectivo').value = '';
      if (document.getElementById('pago_monto_tarjeta')) document.getElementById('pago_monto_tarjeta').value = '';
      if (document.getElementById('pago_monto_transf')) document.getElementById('pago_monto_transf').value = '';
      if (document.getElementById('wrap-desglose-pagos-mixtos')) document.getElementById('wrap-desglose-pagos-mixtos').style.display = 'none';
      document.querySelectorAll('.btn-metodo-pill').forEach(b => b.classList.toggle('active', b.dataset.metodo === 'Efectivo'));
      document.querySelectorAll('.btn-status-pill').forEach(b => b.classList.toggle('active', b.dataset.status === 'Pagado completo'));
      if (document.getElementById('venta_metodo_pago')) document.getElementById('venta_metodo_pago').value = 'Efectivo';
      if (document.getElementById('venta_status_pago')) document.getElementById('venta_status_pago').value = 'Pagado completo';

      renderVentas(fecha);

      // Si la fecha coincide con la caja principal activa, actualizar ingresos
      if (fecha === document.getElementById('header_fecha')?.value) {
        syncVentasToCajaPrincipal(fecha, false);
      }
      renderCampanaActiva();

      // Regresar al Paso 1 del wizard de ventas
      goToVentaStep(1);

      // Cambiar de forma intuitiva al listado de ventas para ver el nuevo registro y enviar WhatsApp
      setVentasSectionMode('ver-ventas');
      showToast('✅ Venta registrada con éxito. Toca la venta en la lista para enviar el agradecimiento por WhatsApp.', 'success');
    });

    // -----------------------------------------------------------------------
    // EVENTOS: CONFIGURACIÓN GENERAL (CATÁLOGOS)
    // -----------------------------------------------------------------------
    document.querySelectorAll('.config-nav-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.cfgtab;
        if (tab) switchConfigTab(tab);
      });
    });

    // Alta de Servicio
    document.getElementById('form-nuevo-servicio')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cfg_serv_nombre').value.trim();
      const tipo = document.getElementById('cfg_serv_tipo').value;
      const estacion = document.getElementById('cfg_serv_estacion').value;
      const precio = parseFloat(document.getElementById('cfg_serv_precio').value) || 0;

      if (!nombre || !tipo || !estacion) {
        showToast('Complete todos los campos obligatorios (*)', 'warning');
        return;
      }

      const item = { id: `srv_${Date.now()}`, nombre, tipo, estacion, precio };
      catServicios.push(item);
      await TB_FIREBASE.saveCatalogo('servicios', catServicios);
      renderCatServiciosTable();
      populateSalesDropdowns();
      document.getElementById('form-nuevo-servicio').reset();
      showToast(`✅ Servicio/Producto "${nombre}" guardado en Firebase`, 'success');

      logAuditMovement({
        modulo: 'Configuración General',
        accion: 'ALTA_SERVICIO',
        descripcion: `Alta de ${tipo}: "${nombre}" (${estacion}) con precio base $${precio.toFixed(2)}`,
        payload: { item }
      });
    });

    // Alta de Estación (toma en cuenta meta quincenal)
    document.getElementById('form-nueva-estacion')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cfg_est_nombre').value.trim();
      const icono = document.getElementById('cfg_est_icono').value.trim() || '💈';
      const metaQuincenal = parseFloat(document.getElementById('cfg_est_meta').value) || 0;
      const clientesMeta = parseInt(document.getElementById('cfg_est_meta_clientes').value, 10) || 45;

      if (!nombre || metaQuincenal <= 0) {
        showToast('Ingrese el nombre de la estación y una meta quincenal válida', 'warning');
        return;
      }

      const item = { id: `est_${Date.now()}`, nombre, icono, metaQuincenal, clientesMeta };
      catEstaciones.push(item);
      await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
      await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());
      renderCatEstacionesTable();
      renderCatMetasTable();
      populateSalesDropdowns();
      populateConfigStationDropdowns();
      renderBalanceScoreStations();

      logAuditMovement({
        modulo: 'Configuración General',
        accion: 'ALTA_ESTACION',
        descripcion: `Alta de estación: "${nombre}" (${icono}) con meta quincenal $${metaQuincenal.toFixed(2)} (${clientesMeta} clientes)`,
        payload: { item }
      });

      document.getElementById('form-nueva-estacion').reset();
      document.getElementById('cfg_est_icono').value = '✨';
      document.getElementById('cfg_est_meta_clientes').value = '45';
      showToast(`✅ Estación "${nombre}" guardada e integrada a Metas y BalanceScore`, 'success');
    });

    // Alta de Especialista
    document.getElementById('form-nuevo-especialista')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cfg_esp_nombre').value.trim();
      const estacion = document.getElementById('cfg_esp_estacion').value;
      const telefono = document.getElementById('cfg_esp_telefono').value.trim();

      if (!nombre || !estacion) {
        showToast('Complete el nombre y seleccione la estación asignada (*)', 'warning');
        return;
      }

      const item = { id: `esp_${Date.now()}`, nombre, estacion, telefono };
      catEspecialistas.push(item);
      await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
      renderCatEspecialistasTable();
      populateSalesDropdowns();
      document.getElementById('form-nuevo-especialista').reset();
      showToast(`✅ Especialista "${nombre}" guardado(a) en Firebase`, 'success');

      logAuditMovement({
        modulo: 'Configuración General',
        accion: 'ALTA_ESPECIALISTA',
        descripcion: `Alta de especialista: "${nombre}" asignado(a) a "${estacion}"`,
        payload: { item }
      });
    });

    // -----------------------------------------------------------------------
    // BÚSQUEDA Y ACCIONES DEL CATÁLOGO DE SERVICIOS
    // -----------------------------------------------------------------------
    const servSearchInput = document.getElementById('cfg_serv_search');
    const btnClearServSearch = document.getElementById('btn-clear-serv-search');
    const modalEditServ = document.getElementById('modal-editar-servicio');

    if (servSearchInput) {
      servSearchInput.addEventListener('input', () => {
        renderCatServiciosTable();
      });
    }

    if (btnClearServSearch) {
      btnClearServSearch.addEventListener('click', () => {
        if (servSearchInput) {
          servSearchInput.value = '';
          btnClearServSearch.style.display = 'none';
          servSearchInput.focus();
          renderCatServiciosTable();
        }
      });
    }

    // Botón dentro de la tabla vacía para limpiar búsqueda
    document.addEventListener('click', (e) => {
      if (e.target.closest('#btn-reset-serv-search')) {
        if (servSearchInput) {
          servSearchInput.value = '';
          if (btnClearServSearch) btnClearServSearch.style.display = 'none';
          servSearchInput.focus();
          renderCatServiciosTable();
        }
      }
    });

    // Abrir modal de edición de servicio/producto
    document.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-edit-cfg-serv');
      if (btnEdit) {
        const id = btnEdit.dataset.id;
        const item = catServicios.find(s => s.id === id);
        if (!item) {
          showToast('No se encontró el servicio seleccionado', 'error');
          return;
        }

        const inputId = document.getElementById('edit_serv_id');
        const inputNom = document.getElementById('edit_serv_nombre');
        const selTipo = document.getElementById('edit_serv_tipo');
        const selEst = document.getElementById('edit_serv_estacion');
        const inputPrecio = document.getElementById('edit_serv_precio');

        if (inputId) inputId.value = item.id;
        if (inputNom) inputNom.value = item.nombre || '';
        if (selTipo) selTipo.value = item.tipo || 'Servicio';
        if (inputPrecio) inputPrecio.value = item.precio !== undefined ? item.precio : 0;

        if (selEst) {
          selEst.innerHTML = '';
          if (catEstaciones && catEstaciones.length > 0) {
            catEstaciones.forEach(est => {
              const opt = document.createElement('option');
              opt.value = est.nombre;
              opt.textContent = `${est.icono || '💈'} ${est.nombre}`;
              selEst.appendChild(opt);
            });
          }
          if (!catEstaciones.some(est => est.nombre === 'General')) {
            const optGen = document.createElement('option');
            optGen.value = 'General';
            optGen.textContent = '🏢 General';
            selEst.appendChild(optGen);
          }
          if (item.estacion && !catEstaciones.some(est => est.nombre === item.estacion) && item.estacion !== 'General') {
            const optCustom = document.createElement('option');
            optCustom.value = item.estacion;
            optCustom.textContent = `📍 ${item.estacion}`;
            selEst.appendChild(optCustom);
          }
          selEst.value = item.estacion || (catEstaciones[0]?.nombre || 'General');
        }

        if (modalEditServ) modalEditServ.style.display = 'flex';
      }
    });

    // Cerrar modal de edición
    document.getElementById('btn-close-edit-serv-modal')?.addEventListener('click', () => {
      if (modalEditServ) modalEditServ.style.display = 'none';
    });
    document.getElementById('btn-cancel-edit-serv')?.addEventListener('click', () => {
      if (modalEditServ) modalEditServ.style.display = 'none';
    });
    modalEditServ?.addEventListener('click', (e) => {
      if (e.target === modalEditServ) {
        modalEditServ.style.display = 'none';
      }
    });

    // Guardar formulario de edición de servicio
    document.getElementById('form-editar-servicio')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit_serv_id')?.value;
      const nombre = document.getElementById('edit_serv_nombre')?.value.trim();
      const tipo = document.getElementById('edit_serv_tipo')?.value;
      const estacion = document.getElementById('edit_serv_estacion')?.value;
      const precio = parseFloat(document.getElementById('edit_serv_precio')?.value);

      if (!id || !nombre || !tipo || !estacion || isNaN(precio) || precio < 0) {
        showToast('Complete todos los campos obligatorios (*)', 'warning');
        return;
      }

      const idx = catServicios.findIndex(s => s.id === id);
      if (idx === -1) {
        showToast('No se encontró el servicio a editar', 'error');
        return;
      }

      const itemAntes = { ...catServicios[idx] };
      catServicios[idx] = {
        ...catServicios[idx],
        nombre,
        tipo,
        estacion,
        precio
      };
      const itemDespues = { ...catServicios[idx] };

      try {
        await TB_FIREBASE.saveCatalogo('servicios', catServicios);
        renderCatServiciosTable();
        populateSalesDropdowns();
        if (modalEditServ) modalEditServ.style.display = 'none';
        showToast(`✅ Servicio/Producto "${nombre}" actualizado correctamente`, 'success');

        logAuditMovement({
          modulo: 'Configuración General',
          accion: 'EDICION_SERVICIO',
          descripcion: `Edición de ${tipo}: "${nombre}" (${estacion}) - Precio: $${precio.toFixed(2)} (Antes: "${itemAntes.nombre}", $${(itemAntes.precio || 0).toFixed(2)})`,
          payload: { antes: itemAntes, despues: itemDespues }
        });
      } catch (err) {
        console.error('Error al guardar edición de servicio:', err);
        showToast('Error al actualizar servicio en Firebase', 'error');
      }
    });

    // Eliminar ítems de catálogo
    document.addEventListener('click', async (e) => {
      const btnDelServ = e.target.closest('.btn-del-cfg-serv');
      if (btnDelServ) {
        const id = btnDelServ.dataset.id;
        const itemTarget = catServicios.find(s => s.id === id);
        const nomSrv = itemTarget?.nombre || id;
        if (confirm(`¿Está seguro de eliminar el servicio/producto "${nomSrv}" del catálogo?`)) {
          catServicios = catServicios.filter(s => s.id !== id);
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
          showToast(`Servicio "${nomSrv}" eliminado`, 'info');

          logAuditMovement({
            modulo: 'Configuración General',
            accion: 'BAJA_SERVICIO',
            descripcion: `Eliminación de servicio: "${nomSrv}" (${itemTarget?.estacion || 'General'})`,
            payload: { item: itemTarget }
          });
        }
      }
      if (e.target.matches('.btn-del-cfg-est')) {
        const id = e.target.dataset.id;
        if (confirm('¿Está seguro de eliminar esta estación de trabajo? Se actualizarán las metas y el BalanceScore.')) {
          const itemTarget = catEstaciones.find(st => st.id === id || st.nombre === id);
          catEstaciones = catEstaciones.filter(st => st.id !== id && st.nombre !== id);
          await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
          await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());
          renderCatEstacionesTable();
          renderCatMetasTable();
          populateSalesDropdowns();
          populateConfigStationDropdowns();
          renderBalanceScoreStations();
          showToast('Estación eliminada y sincronizada automáticamente', 'info');

          logAuditMovement({
            modulo: 'Configuración General',
            accion: 'BAJA_ESTACION',
            descripcion: `Eliminación de estación: "${itemTarget?.nombre || id}"`,
            payload: { item: itemTarget }
          });
        }
      }
      if (e.target.matches('.btn-del-cfg-esp')) {
        const id = e.target.dataset.id;
        if (confirm('¿Está seguro de eliminar este(a) especialista?')) {
          const itemTarget = catEspecialistas.find(esp => esp.id === id);
          catEspecialistas = catEspecialistas.filter(esp => esp.id !== id);
          await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
          renderCatEspecialistasTable();
          populateSalesDropdowns();
          showToast('Especialista eliminado', 'info');

          logAuditMovement({
            modulo: 'Configuración General',
            accion: 'BAJA_ESPECIALISTA',
            descripcion: `Eliminación de especialista: "${itemTarget?.nombre || id}"`,
            payload: { item: itemTarget }
          });
        }
      }
    });

    // Vaciar catálogos completos
    document.getElementById('btn-vaciar-servicios')?.addEventListener('click', async () => {
      if (catServicios.length === 0) {
        showToast('El catálogo de servicios ya está vacío', 'info');
        return;
      }
      if (confirm(`¿Está seguro de eliminar TODOS los (${catServicios.length}) servicios/productos del catálogo?`)) {
        const backup = [...catServicios];
        catServicios = [];
        await TB_FIREBASE.saveCatalogo('servicios', catServicios);
        renderCatServiciosTable();
        populateSalesDropdowns();
        showToast('Catálogo de servicios vaciado', 'info');

        logAuditMovement({
          modulo: 'Configuración General',
          accion: 'VACIAR_CATALOGO',
          descripcion: `Vaciado total de Servicios y Productos (${backup.length} eliminados)`,
          payload: { catalogType: 'servicios', items: backup }
        });
      }
    });

    document.getElementById('btn-vaciar-estaciones')?.addEventListener('click', async () => {
      if (catEstaciones.length === 0) {
        showToast('El catálogo de estaciones ya está vacío', 'info');
        return;
      }
      if (confirm(`¿Está seguro de eliminar TODAS las (${catEstaciones.length}) estaciones? Se actualizarán las metas y el BalanceScore.`)) {
        const backup = [...catEstaciones];
        catEstaciones = [];
        await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
        await TB_FIREBASE.saveCatalogo('metas', getActiveStationMetas());
        renderCatEstacionesTable();
        renderCatMetasTable();
        populateSalesDropdowns();
        populateConfigStationDropdowns();
        renderBalanceScoreStations();
        showToast('Catálogo de estaciones vaciado y sincronizado', 'info');

        logAuditMovement({
          modulo: 'Configuración General',
          accion: 'VACIAR_CATALOGO',
          descripcion: `Vaciado total de Estaciones de Trabajo (${backup.length} eliminadas)`,
          payload: { catalogType: 'estaciones', items: backup }
        });
      }
    });

    document.getElementById('btn-vaciar-especialistas')?.addEventListener('click', async () => {
      if (catEspecialistas.length === 0) {
        showToast('El catálogo de especialistas ya está vacío', 'info');
        return;
      }
      if (confirm(`¿Está seguro de eliminar TODOS los (${catEspecialistas.length}) especialistas?`)) {
        const backup = [...catEspecialistas];
        catEspecialistas = [];
        await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
        renderCatEspecialistasTable();
        populateSalesDropdowns();
        showToast('Catálogo de especialistas vaciado', 'info');

        logAuditMovement({
          modulo: 'Configuración General',
          accion: 'VACIAR_CATALOGO',
          descripcion: `Vaciado total de Especialistas (${backup.length} eliminados)`,
          payload: { catalogType: 'especialistas', items: backup }
        });
      }
    });

    document.getElementById('btn-limpiar-todo-config')?.addEventListener('click', async () => {
      if (catServicios.length === 0 && catEstaciones.length === 0 && catEspecialistas.length === 0) {
        showToast('Todos los catálogos ya están vacíos', 'info');
        return;
      }
      if (confirm('¿ADVERTENCIA: Está seguro de vaciar ABSOLUTAMENTE TODOS los catálogos (Servicios, Estaciones, Metas y Especialistas)?')) {
        const backupServ = [...catServicios];
        const backupEst = [...catEstaciones];
        const backupEsp = [...catEspecialistas];
        catServicios = [];
        catEstaciones = [];
        catEspecialistas = [];
        await Promise.all([
          TB_FIREBASE.saveCatalogo('servicios', []),
          TB_FIREBASE.saveCatalogo('estaciones', []),
          TB_FIREBASE.saveCatalogo('especialistas', []),
          TB_FIREBASE.saveCatalogo('metas', [])
        ]);
        loadAndRenderConfiguracion();
        populateSalesDropdowns();
        populateConfigStationDropdowns();
        renderBalanceScoreStations();
        showToast('Todos los catálogos han sido vaciados', 'info');

        logAuditMovement({
          modulo: 'Configuración General',
          accion: 'VACIAR_CATALOGO',
          descripcion: `Vaciado total de toda la Configuración General (${backupServ.length} servicios, ${backupEst.length} estaciones, ${backupEsp.length} especialistas)`,
          payload: { catalogType: 'todo', servicios: backupServ, estaciones: backupEst, especialistas: backupEsp }
        });
      }
    });



    document.getElementById('ventas_filtro_fecha')?.addEventListener('change', (e) => {
      renderVentas(e.target.value);
      logAuditMovement({
        modulo: 'Ventas',
        accion: 'FILTRO_FECHA_VENTAS',
        descripcion: `Consulta de ventas de la fecha: ${e.target.value}`,
        payload: { fecha: e.target.value },
        reversible: false
      });
    });

    document.getElementById('btn-ventas-hoy')?.addEventListener('click', () => {
      const today = getHidalgoDateStr();
      document.getElementById('ventas_filtro_fecha').value = today;
      renderVentas(today);
      logAuditMovement({
        modulo: 'Ventas',
        accion: 'FILTRO_FECHA_VENTAS',
        descripcion: `Consulta rápida de ventas de HOY (${today})`,
        payload: { fecha: today },
        reversible: false
      });
    });

    // Eventos de selección de modo en Registro Diario de Ventas
    document.getElementById('btn-choice-nueva-venta')?.addEventListener('click', () => {
      setVentasSectionMode('nueva-venta');
    });

    document.getElementById('btn-choice-ver-ventas')?.addEventListener('click', () => {
      setVentasSectionMode('ver-ventas');
    });

    document.getElementById('btn-wizard-goto-list')?.addEventListener('click', () => {
      setVentasSectionMode('ver-ventas');
    });

    document.getElementById('btn-quick-new-sale')?.addEventListener('click', () => {
      setVentasSectionMode('nueva-venta');
    });

    document.getElementById('btn-refresh-ventas')?.addEventListener('click', () => {
      const fecha = document.getElementById('ventas_filtro_fecha')?.value || getHidalgoDateStr();
      renderVentas(fecha);
      showToast('Ventas recargadas desde Firebase', 'info');
      logAuditMovement({
        modulo: 'Ventas',
        accion: 'RECARGAR_VENTAS',
        descripcion: `Sincronización manual de ventas de la fecha: ${fecha}`,
        payload: { fecha },
        reversible: false
      });
    });

    // Selectores interactivos de Método de Pago en Formulario
    document.querySelectorAll('.btn-metodo-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-metodo-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const metodo = btn.dataset.metodo;
        const sel = document.getElementById('venta_metodo_pago');
        if (sel) {
          sel.value = metodo;
          sel.dispatchEvent(new Event('change'));
        }
        const wrapDesglose = document.getElementById('wrap-desglose-pagos-mixtos');
        if (wrapDesglose) {
          if (metodo === 'Mixto') {
            wrapDesglose.style.display = 'block';
            recalcDesglosePagos();
          } else {
            wrapDesglose.style.display = 'none';
          }
        }
      });
    });

    // Eventos para el cálculo en vivo del desglose de pagos mixtos
    ['pago_monto_efectivo', 'pago_monto_tarjeta', 'pago_monto_transf', 'venta_total'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', recalcDesglosePagos);
    });

    // Botones rápidos para asignar restante en el pago mixto
    document.querySelectorAll('.btn-quick-fill').forEach(btn => {
      btn.addEventListener('click', () => {
        const fillTarget = btn.dataset.fill;
        const total = parseFloat(document.getElementById('venta_total')?.value) || 0;
        let e = parseFloat(document.getElementById('pago_monto_efectivo')?.value) || 0;
        let j = parseFloat(document.getElementById('pago_monto_tarjeta')?.value) || 0;
        let t = parseFloat(document.getElementById('pago_monto_transf')?.value) || 0;

        if (fillTarget === 'efectivo') {
          const rem = Math.max(0, total - (j + t));
          document.getElementById('pago_monto_efectivo').value = rem.toFixed(2);
        } else if (fillTarget === 'tarjeta') {
          const rem = Math.max(0, total - (e + t));
          document.getElementById('pago_monto_tarjeta').value = rem.toFixed(2);
        } else if (fillTarget === 'transferencia') {
          const rem = Math.max(0, total - (e + j));
          document.getElementById('pago_monto_transf').value = rem.toFixed(2);
        }
        recalcDesglosePagos();
      });
    });

    // Selectores interactivos de Status de Pago en Formulario
    document.querySelectorAll('.btn-status-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-status-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const st = btn.dataset.status;
        const sel = document.getElementById('venta_status_pago');
        if (sel) {
          sel.value = st;
          sel.dispatchEvent(new Event('change'));
        }
      });
    });

    // Botón Limpiar del formulario
    document.getElementById('btn-limpiar-form-venta')?.addEventListener('click', () => {
      document.querySelectorAll('.btn-metodo-pill').forEach(b => b.classList.toggle('active', b.dataset.metodo === 'Efectivo'));
      document.querySelectorAll('.btn-status-pill').forEach(b => b.classList.toggle('active', b.dataset.status === 'Pagado completo'));
      if (document.getElementById('venta_metodo_pago')) document.getElementById('venta_metodo_pago').value = 'Efectivo';
      if (document.getElementById('venta_status_pago')) document.getElementById('venta_status_pago').value = 'Pagado completo';
      resetVentaServicioCombobox();
    });

    // Switcher de Vista: Tabla vs Tarjetas
    document.getElementById('btn-view-tabla')?.addEventListener('click', () => {
      setVentasViewMode('tabla');
      logAuditMovement({
        modulo: 'Ventas',
        accion: 'CAMBIO_VISTA_VENTAS',
        descripcion: 'Cambio de vista en listado de ventas a Tabla Detallada',
        payload: { vista: 'tabla' },
        reversible: false
      });
    });

    document.getElementById('btn-view-tarjetas')?.addEventListener('click', () => {
      setVentasViewMode('tarjetas');
      logAuditMovement({
        modulo: 'Ventas',
        accion: 'CAMBIO_VISTA_VENTAS',
        descripcion: 'Cambio de vista en listado de ventas a Tarjetas Visuales',
        payload: { vista: 'tarjetas' },
        reversible: false
      });
    });

    // Filtro por término de búsqueda en lista con registro de auditoría
    let searchDebounceTimer = null;
    document.getElementById('ventas-search-input')?.addEventListener('input', (e) => {
      currentVentasSearchTerm = e.target.value;
      renderVentasFilteredList();
      clearTimeout(searchDebounceTimer);
      if (currentVentasSearchTerm.trim().length >= 2) {
        searchDebounceTimer = setTimeout(() => {
          logAuditMovement({
            modulo: 'Ventas',
            accion: 'BUSQUEDA_VENTAS',
            descripcion: `Búsqueda en listado de ventas: "${currentVentasSearchTerm.trim()}"`,
            payload: { term: currentVentasSearchTerm.trim() },
            reversible: false
          });
        }, 1200);
      }
    });

    // Filtros por chips de método en lista con registro de auditoría
    document.querySelectorAll('.ventas-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.ventas-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentVentasMetodoFilter = chip.dataset.metodoFilter || 'todos';
        renderVentasFilteredList();
        logAuditMovement({
          modulo: 'Ventas',
          accion: 'FILTRO_METODO_VENTAS',
          descripcion: `Filtro aplicado en ventas por método: ${currentVentasMetodoFilter}`,
          payload: { metodo: currentVentasMetodoFilter },
          reversible: false
        });
      });
    });

    // Eliminación de ventas: Requiere Clave Privada de Gerencia
    document.addEventListener('click', async (e) => {
      // Restablecer filtros si las ventas estaban ocultas
      const btnResetFilters = e.target.closest('.btn-reset-ventas-filters');
      if (btnResetFilters) {
        currentVentasSearchTerm = '';
        currentVentasMetodoFilter = 'todos';
        const searchInput = document.getElementById('ventas-search-input');
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.ventas-filter-chip').forEach(c => {
          c.classList.toggle('active', (c.dataset.metodoFilter || 'todos') === 'todos');
        });
        renderVentasFilteredList();
        showToast('Mostrando todas las ventas del día', 'info');
        return;
      }

      const btnDel = e.target.closest('.btn-del-venta');
      if (btnDel) {
        const id = btnDel.dataset.id;
        const fecha = btnDel.dataset.fecha;
        
        // Solicitar Clave Privada de Gerencia de forma confidencial
        const autorizado = await solicitarClaveGerencia('eliminar este registro de venta');
        if (!autorizado) return;

        const allVentasDia = await TB_FIREBASE.getVentasByFecha(fecha);
        const ventaBackup = Array.isArray(allVentasDia) ? allVentasDia.find(v => v.id === id) : allVentasDia?.[id];
        await TB_FIREBASE.deleteVenta(fecha, id);
        
        // Actualizar lista en memoria inmediatamente
        currentVentasList = currentVentasList.filter(v => v.id !== id);
        renderVentas(fecha, true);

        if (fecha === document.getElementById('header_fecha')?.value) {
          syncVentasToCajaPrincipal(fecha, false);
        }
        showToast('✅ Venta eliminada con autorización gerencial', 'success');

        logAuditMovement({
          modulo: 'Ventas',
          accion: 'BAJA_VENTA_AUTORIZADA',
          descripcion: `Eliminación de venta autorizada con clave gerencial: ${ventaBackup?.servicio || id} por $${parseFloat(ventaBackup?.totalCobrado || 0).toFixed(2)} (${ventaBackup?.clienta || 'Cliente'}) - Fecha: ${fecha}`,
          payload: { fecha, id, venta: ventaBackup }
        });
      }
    });

    // -----------------------------------------------------------------------
    // EVENTOS: INTERESADAS Y CIERRES (3 OPCIONES)
    // -----------------------------------------------------------------------
    document.querySelectorAll('.option-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const opt = btn.dataset.opt;
        if (opt) switchLeadOption(opt);
      });
    });

    // Formulario Opción 2: Nuevo Lead
    document.getElementById('form-nuevo-lead')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fecha = document.getElementById('lead_reg_fecha').value;
      const nombre = document.getElementById('lead_reg_nombre').value.trim();
      const telefono = document.getElementById('lead_reg_telefono').value.trim();
      const unidad = document.getElementById('lead_reg_unidad').value;
      const servicio = document.getElementById('lead_reg_servicio').value.trim();
      const canal = document.getElementById('lead_reg_canal').value;
      const tipificacion = document.getElementById('lead_reg_tipificacion').value;
      const notas = document.getElementById('lead_reg_notas').value.trim();
      const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Recepción Total Beauty';

      if (!fecha || !nombre || !telefono || !servicio) {
        showToast('Complete los campos obligatorios (*)', 'warning');
        return;
      }

      const lead = {
        fecha,
        nombre,
        telefono,
        unidad,
        servicio,
        canal,
        tipificacion,
        notas,
        historialSeguimiento: [
          {
            fechaHora: new Date().toISOString(),
            medio: canal || 'WhatsApp',
            accion: 'Registro inicial del prospecto',
            tipificacion,
            notas: notas || 'Contacto inicial recibido',
            usuario: userEmail
          }
        ],
        createdAt: new Date().toISOString()
      };

      const resLead = await TB_FIREBASE.saveLead(lead);
      showToast(`✅ ${nombre} guardada en Firebase Cloud`, 'success');

      logAuditMovement({
        modulo: 'Interesadas',
        accion: 'ALTA_LEAD',
        descripcion: `Nuevo prospecto: "${nombre}" (${telefono}) - Servicio: "${servicio}" [${tipificacion}]`,
        payload: { lead: { ...lead, id: resLead?.id || lead.id } }
      });

      // Limpiar formulario
      document.getElementById('form-nuevo-lead').reset();
      document.getElementById('lead_reg_fecha').value = getHidalgoDateStr();

      // Cambiar a la Opción 3 (Directorio de Seguimiento) para ver a la persona registrada
      switchLeadOption(3);
    });

    // Filtros de la Opción 3 (Directorio)
    document.getElementById('filtro_lead_tipif')?.addEventListener('change', renderLeadsDirectory);
    document.getElementById('filtro_lead_unidad')?.addEventListener('change', renderLeadsDirectory);
    document.getElementById('buscador_leads')?.addEventListener('input', renderLeadsDirectory);
    document.getElementById('btn-refresh-leads')?.addEventListener('click', () => {
      renderLeadsDirectory();
      showToast('Directorio de prospectos recargado', 'info');
    });

    // Modal de Detalle de Lead: Cerrar
    document.getElementById('btn-close-lead-modal')?.addEventListener('click', closeLeadDetailModal);
    document.getElementById('modal-lead-detalle')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-lead-detalle') closeLeadDetailModal();
    });

    // Guardar nuevo seguimiento y tipificación desde el modal
    document.getElementById('form-lead-nuevo-seguimiento')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeLeadId) return;

      const nuevaTipificacion = document.getElementById('mlead_new_tipif').value;
      const medio = document.getElementById('mlead_new_medio').value;
      const notas = document.getElementById('mlead_new_notas').value.trim();
      const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Recepción Total Beauty';

      if (!notas) {
        showToast('Por favor ingrese las notas del seguimiento', 'warning');
        return;
      }

      const nuevoSeguimiento = {
        medio,
        notas,
        tipificacion: nuevaTipificacion,
        usuario: userEmail,
        accion: `Seguimiento por ${medio}`
      };

      await TB_FIREBASE.updateLeadSeguimiento(activeLeadId, nuevoSeguimiento, nuevaTipificacion);
      showToast(`✅ Tipificación actualizada a: ${nuevaTipificacion}`, 'success');

      logAuditMovement({
        modulo: 'Interesadas',
        accion: 'UPDATE_LEAD',
        descripcion: `Nuevo seguimiento para prospecto ID: ${activeLeadId} - Tipificación: "${nuevaTipificacion}" (${medio}): "${notas}"`,
        payload: { id: activeLeadId, nuevoSeguimiento, nuevaTipificacion }
      });

      // Limpiar notas
      document.getElementById('mlead_new_notas').value = '';

      // Recargar modal con datos frescos
      await openLeadDetailModal(activeLeadId);

      // Actualizar el directorio y métricas de fondo
      renderLeadsDirectory();
      renderLeadsBalanceScore();
    });

    // -----------------------------------------------------------------------
    // EVENTOS: CAMPAÑA ACTIVA Y EVENTOS DEL MES
    // -----------------------------------------------------------------------
    document.getElementById('btn-toggle-config-campana')?.addEventListener('click', async () => {
      const wrap = document.getElementById('form-config-campana-wrap');
      const isVisible = wrap.style.display !== 'none';
      wrap.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        // Pre-cargar valores existentes si hay
        const campana = await TB_FIREBASE.getCampanaActiva();
        if (campana) {
          document.getElementById('cfg_campana_nombre').value = campana.nombre || '';
          document.getElementById('cfg_campana_inicio').value = campana.fechaInicio || '';
          document.getElementById('cfg_campana_fin').value = campana.fechaFin || '';
          document.getElementById('cfg_campana_meta_ingreso').value = campana.metaIngreso || '';
          document.getElementById('cfg_campana_meta_salon').value = campana.metaSalon || '';
          document.getElementById('cfg_campana_meta_academia').value = campana.metaAcademia || '';
          document.getElementById('cfg_campana_promociones').value = campana.promociones || '';
        }
      }
    });

    document.getElementById('btn-cancel-config-campana')?.addEventListener('click', () => {
      document.getElementById('form-config-campana-wrap').style.display = 'none';
    });

    document.getElementById('form-campana-activa')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const campana = {
        nombre: document.getElementById('cfg_campana_nombre').value.trim(),
        fechaInicio: document.getElementById('cfg_campana_inicio').value,
        fechaFin: document.getElementById('cfg_campana_fin').value,
        metaIngreso: parseFloat(document.getElementById('cfg_campana_meta_ingreso').value) || 0,
        metaSalon: parseInt(document.getElementById('cfg_campana_meta_salon').value, 10) || 0,
        metaAcademia: parseInt(document.getElementById('cfg_campana_meta_academia').value, 10) || 0,
        promociones: document.getElementById('cfg_campana_promociones').value.trim(),
        updatedAt: new Date().toISOString()
      };

      const prevCampana = await TB_FIREBASE.getCampanaActiva();
      await TB_FIREBASE.saveCampanaActiva(campana);
      showToast('✅ Campaña activa guardada en Firebase', 'success');

      logAuditMovement({
        modulo: 'Campaña',
        accion: 'CONFIG_CAMPANA',
        descripcion: `Configuración de campaña activa: "${campana.nombre}" (Vigencia: ${campana.fechaInicio} al ${campana.fechaFin})`,
        payload: { campana, prevCampana }
      });
      document.getElementById('form-config-campana-wrap').style.display = 'none';
      renderCampanaActiva();
    });

    // Eventos del mes
    document.getElementById('btn-toggle-nuevo-evento')?.addEventListener('click', () => {
      const wrap = document.getElementById('form-nuevo-evento-wrap');
      wrap.style.display = (wrap.style.display === 'none') ? 'block' : 'none';
      document.getElementById('ev_fecha').value = getHidalgoDateStr();
    });

    document.getElementById('btn-cancel-nuevo-evento')?.addEventListener('click', () => {
      document.getElementById('form-nuevo-evento-wrap').style.display = 'none';
    });

    document.getElementById('form-nuevo-evento')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const evento = {
        fecha: document.getElementById('ev_fecha').value,
        tipo: document.getElementById('ev_tipo').value,
        titulo: document.getElementById('ev_titulo').value.trim(),
        responsable: document.getElementById('ev_responsable').value.trim(),
        createdAt: new Date().toISOString()
      };

      const resEvento = await TB_FIREBASE.saveEvento(evento);
      showToast('Evento registrado con éxito', 'success');

      logAuditMovement({
        modulo: 'Campaña',
        accion: 'ALTA_EVENTO',
        descripcion: `Nuevo evento en calendario: [${evento.tipo}] "${evento.titulo}" (Fecha: ${evento.fecha})`,
        payload: { evento: { ...evento, id: resEvento?.id || evento.id } }
      });

      document.getElementById('form-nuevo-evento').reset();
      document.getElementById('form-nuevo-evento-wrap').style.display = 'none';
      renderEventosTimeline();
    });

    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-evento')) {
        const id = e.target.dataset.id;
        if (confirm('¿Eliminar este evento del calendario?')) {
          const localEventos = JSON.parse(localStorage.getItem('tb_eventos_db') || '{}');
          const eventoBackup = localEventos[id];
          await TB_FIREBASE.deleteEvento(id);
          renderEventosTimeline();
          showToast('Evento eliminado', 'info');

          logAuditMovement({
            modulo: 'Campaña',
            accion: 'BAJA_EVENTO',
            descripcion: `Eliminación de evento del calendario: "${eventoBackup?.titulo || id}"`,
            payload: { id, evento: eventoBackup }
          });
        }
      }
    });

    // -----------------------------------------------------------------------
    // EVENTOS: BALANCESCORE POR PERÍODOS (DÍA, SEMANA, QUINCENA, MES, RANGO)
    // -----------------------------------------------------------------------
    document.querySelectorAll('.bs-period-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.period;
        if (p) switchBsPeriodMode(p);
      });
    });

    // -----------------------------------------------------------------------
    // EVENTOS: MI META (AVANCE DE METAS POR ESTACIÓN)
    // -----------------------------------------------------------------------
    document.querySelectorAll('.mi-meta-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.period;
        if (p) switchMiMetaPeriodMode(p);
      });
    });

    document.getElementById('btn-refresh-mi-meta')?.addEventListener('click', async () => {
      showToast('Actualizando avance de metas por estación...', 'info');
      await renderMiMetaView();
      showToast('Avance de metas sincronizado con éxito', 'success');
    });

    // Botón Hoy en BalanceScore
    document.getElementById('btn-bs-dia-hoy')?.addEventListener('click', () => {
      const today = getHidalgoDateStr();
      const el = document.getElementById('bs_fecha_dia');
      if (el) el.value = today;
      renderBalanceScoreStations();
    });

    // Cambios en los controles de períodos
    document.getElementById('bs_fecha_dia')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_fecha_semana')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_quin_mes')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_quin_tipo')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_mes_val')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_mes_hasta_hoy')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_rango_desde')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('bs_rango_hasta')?.addEventListener('change', () => renderBalanceScoreStations());
    document.getElementById('btn-bs-consultar')?.addEventListener('click', () => {
      renderBalanceScoreStations();
      showToast('BalanceScore actualizado con ventas en tiempo real', 'info');
    });

    // Enlace a configuración de metas
    document.getElementById('btn-bs-config-metas')?.addEventListener('click', () => {
      if (!isConfigUnlocked) {
        openUnlockConfigModal('metas');
        return;
      }
      switchModule('configuracion');
      switchConfigTab('metas');
    });



    // Guardado manual de BalanceScore
    document.getElementById('btn-save-balancescore')?.addEventListener('click', async () => {
      const { fechaInicio, fechaFin, periodoTexto } = getBsActivePeriodRange();
      const payload = {
        periodo: periodoTexto,
        fechaInicio,
        fechaFin,
        metas: catMetas,
        scoreGlobal: document.getElementById('bs-overall-badge')?.textContent || '',
        totalVentas: document.getElementById('kpi-bs-ventas-total')?.textContent || '$0.00',
        metaTotal: document.getElementById('kpi-bs-meta-total')?.textContent || '$0.00',
        pctAvance: document.getElementById('kpi-bs-pct-total')?.textContent || '0%',
        savedAt: new Date().toISOString()
      };
      await TB_FIREBASE.saveBalanceScore(`${fechaInicio}_a_${fechaFin}`, payload);
      showToast(`BalanceScore (${periodoTexto}) guardado en Firebase`, 'success');
    });


    // -----------------------------------------------------------------------
    // EVENTOS: REPORTE DIARIO DE INGRESOS (SALÓN Y ACADEMIA)
    // -----------------------------------------------------------------------
    document.getElementById('rep_ingresos_fecha')?.addEventListener('change', () => {
      renderIngresosReport();
    });

    document.getElementById('btn-rep-dia-prev')?.addEventListener('click', () => {
      const el = document.getElementById('rep_ingresos_fecha');
      if (el && el.value) {
        const d = new Date(el.value + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        el.value = d.toISOString().split('T')[0];
        renderIngresosReport();
      }
    });

    document.getElementById('btn-rep-dia-next')?.addEventListener('click', () => {
      const el = document.getElementById('rep_ingresos_fecha');
      if (el && el.value) {
        const d = new Date(el.value + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        el.value = d.toISOString().split('T')[0];
        renderIngresosReport();
      }
    });

    document.getElementById('btn-rep-dia-hoy')?.addEventListener('click', () => {
      const el = document.getElementById('rep_ingresos_fecha');
      if (el) {
        el.value = getHidalgoDateStr();
        renderIngresosReport();
      }
    });

    document.getElementById('btn-sync-ingresos-arqueo')?.addEventListener('click', () => {
      renderIngresosReport();
      showToast('Reporte de ingresos actualizado en tiempo real', 'success');
    });

    document.getElementById('btn-export-pdf-ingresos')?.addEventListener('click', () => {
      openIngresosPdfViewer();
    });

    // Pestañas de filtro por unidad
    document.querySelectorAll('.rep-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rep-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        repActiveUnitFilter = btn.dataset.unit || 'todas';
        renderIngresosVentasDetalle();
      });
    });

    // Buscador en vivo
    document.getElementById('rep_ingresos_search')?.addEventListener('input', () => {
      renderIngresosVentasDetalle();
    });

    // Conmutador de vista (Tabla vs Tarjetas)
    document.getElementById('btn-rep-toggle-view')?.addEventListener('click', () => {
      const tablaView = document.getElementById('rep-tabla-view');
      const cardsView = document.getElementById('rep-cards-view');
      const iconEl = document.getElementById('btn-rep-view-icon');
      const textEl = document.getElementById('btn-rep-view-text');

      if (repActiveView === 'tabla') {
        repActiveView = 'cards';
        if (tablaView) tablaView.style.display = 'none';
        if (cardsView) cardsView.style.display = 'grid';
        if (iconEl) iconEl.textContent = '📋';
        if (textEl) textEl.textContent = 'Ver Tabla';
      } else {
        repActiveView = 'tabla';
        if (tablaView) tablaView.style.display = 'block';
        if (cardsView) cardsView.style.display = 'none';
        if (iconEl) iconEl.textContent = '📇';
        if (textEl) textEl.textContent = 'Ver Tarjetas';
      }
    });

    document.getElementById('btn-save-ingresos')?.addEventListener('click', async () => {
      const fecha = document.getElementById('rep_ingresos_fecha').value;
      const total = parseVal('kpi-ingreso-total');
      const payload = {
        total,
        efectivo: parseVal('rep_efectivo_val'),
        tarjeta: parseVal('rep_tarjeta_val'),
        transferencia: parseVal('rep_transf_val'),
        salon: parseVal('rep_salon_val'),
        academia: parseVal('rep_academia_val'),
        retail: parseVal('rep_retail_val'),
        operaciones: currentRepIngresosVentas.length,
        ticketPromedio: parseVal('kpi-ingreso-ticket')
      };
      await TB_FIREBASE.saveIngresosReport(fecha, payload);
      showToast('Reporte diario de ingresos guardado en Firebase', 'success');
    });

    // -----------------------------------------------------------------------
    // BOTÓN DE EJEMPLO (SOLO SI EL USUARIO LO SOLICITA)
    // -----------------------------------------------------------------------
    // Botón de datos de prueba eliminado (cero datos de prueba)

    // -----------------------------------------------------------------------
    // INICIALIZACIÓN LIMPIA PARA PRODUCCIÓN
    // -----------------------------------------------------------------------
    // INICIALIZACIÓN OFICIAL DE FECHA Y HORA (HIDALGO, MÉXICO - UTC-6)
    // -----------------------------------------------------------------------
    function updateLiveHidalgoClocks() {
      const tzNow = getHidalgoDateTime();
      const { fecha, hora } = tzNow;

      const elTime = document.getElementById('topbar-clock-time');
      const elDate = document.getElementById('topbar-clock-date');
      if (elTime) elTime.textContent = hora;
      if (elDate) {
        const parts = fecha.split('-');
        elDate.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      const elHeaderHora = document.getElementById('header_hora');
      const elValHora = document.getElementById('val_hora_cierre');
      const elChicaHora = document.getElementById('chica_hora');
      if (elHeaderHora) elHeaderHora.value = hora;
      if (elValHora) elValHora.value = hora;
      if (elChicaHora) elChicaHora.value = hora;
    }

    const tzInit = getHidalgoDateTime();
    const dStr = tzInit.fecha;
    const hmStr = tzInit.hora;

    if (document.getElementById('header_fecha')) document.getElementById('header_fecha').value = dStr;
    if (document.getElementById('header_hora')) document.getElementById('header_hora').value = hmStr;
    if (document.getElementById('val_hora_cierre')) document.getElementById('val_hora_cierre').value = hmStr;
    if (document.getElementById('val_hora_entrega')) document.getElementById('val_hora_entrega').value = '';

    if (document.getElementById('chica_fecha')) document.getElementById('chica_fecha').value = dStr;
    if (document.getElementById('chica_hora')) document.getElementById('chica_hora').value = hmStr;

    ['ventas_filtro_fecha', 'venta_fecha', 'header_fecha', 'chica_fecha', 'lead_reg_fecha', 'rep_ingresos_fecha', 'ev_fecha', 'bs_fecha_dia', 'bs_fecha_semana'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (!el.value || el.value > dStr) {
          el.value = dStr;
        }
      }
    });

    // Inicializar controles de período de BalanceScore
    if (document.getElementById('bs_fecha_dia')) document.getElementById('bs_fecha_dia').value = dStr;
    if (document.getElementById('bs_fecha_semana')) document.getElementById('bs_fecha_semana').value = dStr;
    const curMes = dStr.substring(0, 7);
    if (document.getElementById('bs_quin_mes')) document.getElementById('bs_quin_mes').value = curMes;
    if (document.getElementById('bs_mes_val')) document.getElementById('bs_mes_val').value = curMes;
    if (document.getElementById('bs_rango_desde')) document.getElementById('bs_rango_desde').value = `${curMes}-01`;
    if (document.getElementById('bs_rango_hasta')) document.getElementById('bs_rango_hasta').value = dStr;

    updateLiveHidalgoClocks();
    setInterval(updateLiveHidalgoClocks, 10000);

    recalculatePrincipal();
    recalculateChica();
    loadControlCajaData();

    // -----------------------------------------------------------------------
    // EVENTOS: REGISTRO DE AUDITORÍA Y LLAVE MAESTRA (0401)
    // -----------------------------------------------------------------------
    document.getElementById('filtro_audit_busqueda')?.addEventListener('input', () => {
      renderAuditoriaTable();
    });

    document.getElementById('filtro_audit_modulo')?.addEventListener('change', () => {
      renderAuditoriaTable();
    });

    document.getElementById('filtro_audit_estado')?.addEventListener('change', () => {
      renderAuditoriaTable();
    });

    document.getElementById('btn-refresh-audit')?.addEventListener('click', async () => {
      showToast('Recargando bitácora de auditoría...', 'info');
      await renderAuditoriaView();
      showToast('Bitácora actualizada desde Firebase', 'success');
    });

    // Delegación de clic para botones de Deshacer
    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn-undo-log')) {
        const id = e.target.dataset.id;
        const logItem = currentAuditLogs.find(l => l.id === id);
        if (logItem) {
          openMasterKeyModal(logItem);
        }
      }
    });

    // Modal de Llave Maestra
    document.getElementById('btn-cancel-master-key')?.addEventListener('click', () => {
      closeMasterKeyModal();
    });

    document.getElementById('btn-toggle-master-pwd')?.addEventListener('click', () => {
      const input = document.getElementById('input-master-key');
      const btn = document.getElementById('btn-toggle-master-pwd');
      if (input && btn) {
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        btn.textContent = isPwd ? '🙈' : '👁️';
      }
    });

    document.getElementById('btn-confirm-master-key')?.addEventListener('click', async () => {
      const input = document.getElementById('input-master-key');
      const errorBox = document.getElementById('modal-master-error');
      const keyVal = input ? input.value.trim() : '';

      if (keyVal !== MASTER_KEY) {
        if (errorBox) {
          errorBox.textContent = '❌ Llave maestra incorrecta. No tiene autorización para deshacer este movimiento.';
          errorBox.style.display = 'block';
        }
        if (input) {
          input.value = '';
          input.focus();
        }
        showToast('Acceso denegado: Llave maestra incorrecta', 'danger');
        return;
      }

      if (errorBox) errorBox.style.display = 'none';

      const logId = currentUndoLogId;
      const logItem = currentAuditLogs.find(l => l.id === logId);
      if (!logItem) {
        closeMasterKeyModal();
        return;
      }

      try {
        showToast('Deshaciendo movimiento en Firebase...', 'info');
        await executeUndoMovement(logItem);
        closeMasterKeyModal();
        showToast('✅ Movimiento deshecho exitosamente con Llave Maestra', 'success');
        renderAuditoriaTable();
      } catch (err) {
        console.error('Error al deshacer movimiento:', err);
        if (errorBox) {
          errorBox.textContent = `Error: ${err.message}`;
          errorBox.style.display = 'block';
        }
        showToast(`Error al deshacer: ${err.message}`, 'danger');
      }
    });

    document.getElementById('input-master-key')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-confirm-master-key')?.click();
      }
    });

    // =========================================================================
    // ACTUALIZACIÓN AUTOMÁTICA EN SEGUNDO PLANO (CADA 30 SEGUNDOS)
    // =========================================================================
    setInterval(async () => {
      try {
        const curFecha = document.getElementById('header_fecha')?.value || getHidalgoDateStr();
        if (currentModule === 'arqueo-principal') {
          await syncVentasToCajaPrincipal(curFecha, false);
          await loadControlCajaData();
        } else if (currentModule === 'ventas') {
          const vf = document.getElementById('ventas_filtro_fecha')?.value || curFecha;
          renderVentas(vf, true);
        }
      } catch (e) {
        console.warn('Sync en segundo plano:', e);
      }
    }, 30000);
    // Inicializar Sistema de Autenticación Firebase Auth
    // (La carga de catálogos y datos reales se dispara una vez validada la sesión con Firebase)
    initConfigSecurityAndRoles();
    initAuthSystem();
  });

  // =========================================================================
  // SISTEMA DE AUTENTICACIÓN FIREBASE AUTH (CORREO / CONTRASEÑA)
  // =========================================================================

  // =========================================================================
  // GESTIÓN DE ROLES, PERMISOS DE USUARIOS Y SEGURIDAD DE CONFIGURACIÓN
  // =========================================================================

  function hasModulePermission(modKey) {
    if (modKey === 'mi-meta') return true;
    const curUser = TB_FIREBASE.getCurrentUser();
    if (!curUser || !curUser.email) return false;
    const email = (curUser.email || '').toLowerCase().trim();
    if (email === 'francisco@totalb.com') return true;

    // Respaldo inmediato en localStorage si memoria aún no carga
    let roles = catUsuariosRoles;
    if (!Array.isArray(roles) || roles.length === 0) {
      try {
        const stored = localStorage.getItem('tb_cat_usuarios_roles');
        if (stored) {
          const parsed = JSON.parse(stored);
          roles = Array.isArray(parsed) ? parsed : (parsed?.items || []);
        }
      } catch (e) {}
    }

    const userCfg = (roles || []).find(u => (u.email || '').toLowerCase().trim() === email);
    if (!userCfg) {
      return ['ventas', 'mi-meta'].includes(modKey);
    }
    if (userCfg.isAdmin || userCfg.rol === 'Administrador') return true;
    return Array.isArray(userCfg.modulos) && userCfg.modulos.includes(modKey);
  }

  function getAllowedModulesForCurrentUser() {
    const curUser = TB_FIREBASE.getCurrentUser();
    const email = (curUser?.email || '').toLowerCase().trim();
    if (!email) return [];
    if (email === 'francisco@totalb.com') return ALL_MODULE_KEYS;

    let roles = catUsuariosRoles;
    if (!Array.isArray(roles) || roles.length === 0) {
      try {
        const stored = localStorage.getItem('tb_cat_usuarios_roles');
        if (stored) {
          const parsed = JSON.parse(stored);
          roles = Array.isArray(parsed) ? parsed : (parsed?.items || []);
        }
      } catch (e) {}
    }

    const cfg = (roles || []).find(u => (u.email || '').toLowerCase().trim() === email);
    let allowed = [];
    if (!cfg) allowed = ['ventas', 'mi-meta'];
    else if (cfg.isAdmin || cfg.rol === 'Administrador') allowed = [...ALL_MODULE_KEYS];
    else allowed = Array.isArray(cfg.modulos) ? [...cfg.modulos] : ['ventas', 'mi-meta'];

    if (!allowed.includes('mi-meta')) {
      allowed.push('mi-meta');
    }
    return allowed;
  }

  async function syncAndApplyUserPermissions(userEmail) {
    const email = (userEmail || '').toLowerCase().trim();
    if (!email) return;

    if (!Array.isArray(catUsuariosRoles) || catUsuariosRoles.length === 0) {
      try {
        const stored = localStorage.getItem('tb_cat_usuarios_roles');
        if (stored) {
          const parsed = JSON.parse(stored);
          catUsuariosRoles = Array.isArray(parsed) ? parsed : (parsed?.items || []);
        }
      } catch (e) {}
    }

    if (!Array.isArray(catUsuariosRoles)) catUsuariosRoles = [];
    let userEntry = catUsuariosRoles.find(u => (u.email || '').toLowerCase().trim() === email);
    const isFran = (email === 'francisco@totalb.com');

    if (!userEntry) {
      userEntry = {
        email: email,
        nombre: isFran ? 'Francisco (Admin Principal)' : email.split('@')[0],
        rol: isFran ? 'Administrador' : 'Recepción y Ventas',
        isAdmin: isFran,
        modulos: isFran ? [...ALL_MODULE_KEYS] : ['ventas', 'mi-meta', 'interesadas'],
        fechaAlta: new Date().toISOString(),
        ultimoAcceso: new Date().toISOString()
      };
      catUsuariosRoles.push(userEntry);
      await TB_FIREBASE.saveCatalogo('usuarios_roles', catUsuariosRoles);
    } else {
      if (isFran) {
        userEntry.rol = 'Administrador';
        userEntry.isAdmin = true;
        userEntry.modulos = [...ALL_MODULE_KEYS];
      }
      userEntry.ultimoAcceso = new Date().toISOString();
      await TB_FIREBASE.saveCatalogo('usuarios_roles', catUsuariosRoles);
    }

    applyUserPermissions(email);
  }

  function applyUserPermissions(userEmail) {
    const email = (userEmail || TB_FIREBASE.getCurrentUser()?.email || '').toLowerCase().trim();
    if (!email) {
      document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.style.display = 'none';
        li.classList.add('menu-item-hidden');
      });
      document.querySelectorAll('.sidebar-menu-category').forEach(catLi => {
        catLi.style.display = 'none';
        catLi.classList.add('category-hidden');
      });
      return;
    }

    const isFran = (email === 'francisco@totalb.com');

    // Respaldo de roles desde localStorage si la memoria está vacía
    if (!Array.isArray(catUsuariosRoles) || catUsuariosRoles.length === 0) {
      try {
        const cached = localStorage.getItem('tb_cat_usuarios_roles');
        if (cached) {
          const parsed = JSON.parse(cached);
          catUsuariosRoles = Array.isArray(parsed) ? parsed : (parsed?.items || []);
        }
      } catch (e) {}
    }

    let userCfg = (catUsuariosRoles || []).find(u => (u.email || '').toLowerCase().trim() === email);

    let allowed = [...ALL_MODULE_KEYS];
    if (!isFran) {
      if (userCfg && (userCfg.isAdmin || userCfg.rol === 'Administrador')) {
        allowed = [...ALL_MODULE_KEYS];
      } else if (userCfg && Array.isArray(userCfg.modulos)) {
        allowed = [...userCfg.modulos];
      } else {
        allowed = ['ventas', 'mi-meta'];
      }
    }

    if (!allowed.includes('mi-meta')) {
      allowed.push('mi-meta');
    }

    // 1. Filtrar enlaces de módulos en el menú lateral y aplicar clases estrictas
    document.querySelectorAll('.sidebar-menu a.menu-item-link').forEach(link => {
      const mod = link.dataset.module;
      const li = link.closest('li');
      if (!li) return;
      if (allowed.includes(mod)) {
        li.style.display = '';
        li.classList.remove('menu-item-hidden');
      } else {
        li.style.display = 'none';
        li.classList.add('menu-item-hidden');
      }
    });

    // 2. Ocultar categorías completas si todos sus módulos están ocultos
    document.querySelectorAll('.sidebar-menu-category').forEach(catLi => {
      let nextEl = catLi.nextElementSibling;
      let hasVisibleChild = false;
      while (nextEl && !nextEl.classList.contains('sidebar-menu-category')) {
        if (nextEl.style.display !== 'none' && !nextEl.classList.contains('menu-item-hidden')) {
          hasVisibleChild = true;
          break;
        }
        nextEl = nextEl.nextElementSibling;
      }
      if (hasVisibleChild) {
        catLi.style.display = '';
        catLi.classList.remove('category-hidden');
      } else {
        catLi.style.display = 'none';
        catLi.classList.add('category-hidden');
      }
    });

    // 3. Proteger todas las vistas en el DOM
    document.querySelectorAll('.module-view').forEach(view => {
      const vId = view.id.replace('view-', '');
      if (allowed.includes(vId)) {
        view.classList.remove('view-forbidden');
        if (view.classList.contains('active-view')) {
          view.style.removeProperty('display');
          view.style.display = 'block';
          view.style.visibility = 'visible';
          view.style.opacity = '1';
        }
      } else {
        view.classList.add('view-forbidden');
        view.classList.remove('active-view');
        view.style.display = 'none';
      }
    });

    // Ocultar botón de sincronizar con Caja Principal en Ventas si no tiene permisos
    const canCajaPrincipal = allowed.includes('arqueo-principal');
    const btnSyncCaja = document.getElementById('btn-sync-ventas-caja');
    if (btnSyncCaja) {
      btnSyncCaja.style.display = canCajaPrincipal ? 'inline-flex' : 'none';
    }

    // 4. Si el módulo activo quedó oculto o restringido, redirigir al primer módulo permitido
    if (!allowed.includes(currentModule)) {
      const fallback = allowed[0] || 'ventas';
      switchModule(fallback);
    }
  }

  function openUnlockConfigModal(targetTab) {
    pendingConfigTab = targetTab || 'servicios';
    const modal = document.getElementById('modal-unlock-configuracion');
    const input = document.getElementById('input-unlock-config-pwd');
    const errBox = document.getElementById('unlock-config-error');
    if (!modal) return;
    if (input) {
      input.value = '';
      input.type = 'password';
    }
    if (errBox) errBox.style.display = 'none';
    modal.style.display = 'flex';
    setTimeout(() => { if (input) input.focus(); }, 120);
  }

  function renderUserPermModuleCheckboxes(selectedModules = [], isEmailAdmin = false) {
    const container = document.getElementById('grid-user-modules-perms');
    if (!container) return;
    container.innerHTML = MODULE_DEFINITIONS.map(mod => {
      const isChecked = isEmailAdmin || selectedModules.includes(mod.id);
      const isDisabled = isEmailAdmin ? 'disabled' : '';
      return `
        <label for="chk-perm-${mod.id}" class="perm-module-card ${isChecked ? 'checked' : ''} ${isEmailAdmin ? 'disabled' : ''}">
          <div style="display:flex; align-items:flex-start; gap:8px;">
            <input type="checkbox" class="user-perm-check" value="${mod.id}" id="chk-perm-${mod.id}" ${isChecked ? 'checked' : ''} ${isDisabled} style="margin-top:3px; cursor:pointer;">
            <div style="flex:1;">
              <div style="font-weight:700; font-size:0.83rem; color:var(--dark);">
                ${mod.icono} ${mod.label}
              </div>
              <div style="font-size:0.71rem; color:var(--muted); line-height:1.25; margin-top:2px;">
                ${mod.desc}
              </div>
            </div>
          </div>
        </label>
      `;
    }).join('');

    container.querySelectorAll('.user-perm-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const card = chk.closest('.perm-module-card');
        if (card) {
          if (chk.checked) card.classList.add('checked');
          else card.classList.remove('checked');
        }
        updateRolPresetFromCheckboxes();
      });
    });
  }

  function applyRolePresetToCheckboxes(roleName) {
    const preset = ROLE_PRESETS[roleName];
    if (!preset) return;
    const container = document.getElementById('grid-user-modules-perms');
    if (!container) return;
    const modKeys = preset.modulos;
    container.querySelectorAll('.user-perm-check').forEach(chk => {
      if (chk.disabled) return;
      const shouldCheck = (roleName === 'Administrador') || modKeys.includes(chk.value);
      chk.checked = shouldCheck;
      const card = chk.closest('.perm-module-card');
      if (card) {
        if (shouldCheck) card.classList.add('checked');
        else card.classList.remove('checked');
      }
    });
  }

  function updateRolPresetFromCheckboxes() {
    const container = document.getElementById('grid-user-modules-perms');
    if (!container) return;
    const checkedVals = Array.from(container.querySelectorAll('.user-perm-check:checked')).map(c => c.value);
    const rolSelect = document.getElementById('cfg_user_rol_select');
    if (!rolSelect || rolSelect.disabled) return;

    if (checkedVals.length === ALL_MODULE_KEYS.length) {
      rolSelect.value = 'Administrador';
    } else {
      rolSelect.value = 'Personalizado';
    }
  }


  async function descargarUsuariosDeFirebase(showNotification = true) {
    const btnHeader = document.getElementById('btn-descargar-usuarios-fb');
    const btnTable = document.getElementById('btn-descargar-usuarios-fb-table');
    const spin = document.getElementById('spin-descargar-fb');
    const icon = document.getElementById('icon-descargar-fb');
    const text = document.getElementById('text-descargar-fb');

    if (spin) spin.style.display = 'inline-block';
    if (icon) icon.style.display = 'none';
    if (text) text.textContent = 'Descargando...';
    if (btnHeader) btnHeader.disabled = true;
    if (btnTable) btnTable.disabled = true;

    if (showNotification) {
      showToast('Descargando usuarios registrados en Firebase...', 'info');
    }

    try {
      const res = await TB_FIREBASE.downloadFirebaseUsers();
      if (res && res.success && Array.isArray(res.users)) {
        catUsuariosRoles = res.users;
        renderUsuariosRolesTable();
        if (showNotification) {
          showToast(`✅ Se descargaron ${catUsuariosRoles.length} usuarios registrados en Firebase`, 'success');
        }
        logAuditMovement({
          modulo: 'Configuración General',
          accion: 'DESCARGA_USUARIOS_FIREBASE',
          descripcion: `Sincronización y descarga de ${catUsuariosRoles.length} usuarios registrados en Firebase Authentication`,
          payload: { totalUsuarios: catUsuariosRoles.length },
          reversible: false
        });
      } else {
        if (showNotification) {
          showToast('No se pudieron descargar los usuarios: ' + (res?.error || 'Error de conexión'), 'error');
        }
      }
    } catch (e) {
      console.error('Error al descargar usuarios de Firebase:', e);
      if (showNotification) showToast('Error al conectar con Firebase', 'error');
    } finally {
      if (spin) spin.style.display = 'none';
      if (icon) icon.style.display = 'inline-block';
      if (text) text.textContent = 'Descargar Usuarios de Firebase';
      if (btnHeader) btnHeader.disabled = false;
      if (btnTable) btnTable.disabled = false;
    }
  }

  function renderUsuariosRolesTable() {
    const tbody = document.getElementById('tbody-usuarios-roles');
    const badgeCount = document.getElementById('badge-total-usuarios');
    const searchVal = (document.getElementById('cfg_user_search')?.value || '').trim().toLowerCase();
    if (badgeCount) badgeCount.textContent = `${catUsuariosRoles.length} Usuarios`;
    if (!tbody) return;

    let filtered = catUsuariosRoles || [];
    if (searchVal) {
      filtered = filtered.filter(u => {
        const em = (u.email || '').toLowerCase();
        const nom = (u.nombre || '').toLowerCase();
        const rol = (u.rol || '').toLowerCase();
        return em.includes(searchVal) || nom.includes(searchVal) || rol.includes(searchVal);
      });
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:24px; color:var(--muted);">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>`;
      return;
    }

    filtered.forEach(user => {
      const isFran = (user.email || '').toLowerCase().trim() === 'francisco@totalb.com';
      const tr = document.createElement('tr');
      if (isFran) {
        tr.style.background = '#f0fdf4';
      }

      let rolBadgeClass = 'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;';
      if (isFran || user.rol === 'Administrador') {
        rolBadgeClass = 'background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0;';
      } else if (user.rol === 'Encargado de Caja') {
        rolBadgeClass = 'background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd;';
      } else if (user.rol === 'Recepción y Ventas') {
        rolBadgeClass = 'background:#faf5ff; color:#7e22ce; border:1px solid #e9d5ff;';
      } else if (user.rol === 'Ventas y Crecimiento') {
        rolBadgeClass = 'background:#fffbeb; color:#b45309; border:1px solid #fde68a;';
      }

      const userModules = isFran ? ALL_MODULE_KEYS : (user.modulos || []);
      const hiddenCount = ALL_MODULE_KEYS.length - userModules.length;

      let modulesHtml = '';
      if (isFran || userModules.length === ALL_MODULE_KEYS.length) {
        modulesHtml = `<span class="module-chip chip-admin">🌟 Acceso Total (10 Módulos)</span>`;
      } else if (userModules.length === 0) {
        modulesHtml = `<span style="color:#ef4444; font-size:0.75rem; font-weight:700;">Sin módulos asignados</span>`;
      } else {
        modulesHtml = userModules.map(mId => {
          const def = MODULE_DEFINITIONS.find(d => d.id === mId);
          return `<span class="module-chip">${def ? def.icono + ' ' + def.label.split(' ')[0] : mId}</span>`;
        }).join(' ');
      }

      const hiddenHtml = (hiddenCount <= 0)
        ? `<span style="color:#059669; font-weight:700; font-size:0.75rem;">✓ 0 Ocultos</span>`
        : `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 8px; border-radius:10px; font-weight:700; font-size:0.75rem;">🚫 ${hiddenCount} Ocultos</span>`;

      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.15rem;">${isFran ? '👑' : '👤'}</span>
            <div>
              <div style="font-weight:800; color:var(--dark); font-size:0.88rem;">${user.email}</div>
              ${user.nombre ? `<div style="font-size:0.75rem; color:var(--muted);">${user.nombre}</div>` : ''}
              ${isFran ? `<span style="font-size:0.68rem; color:#b45309; font-weight:800; background:#fef3c7; border:1px solid #fde68a; padding:1px 6px; border-radius:4px; display:inline-block; margin-top:2px;">⭐ Super Administrador</span>` : ''}
            </div>
          </div>
        </td>
        <td>
          <span class="kpi-status-badge badge-cuadrada" style="${rolBadgeClass} font-size:0.78rem; padding:4px 10px; font-weight:700;">
            ${user.rol || 'Personalizado'}
          </span>
        </td>
        <td>
          <div style="display:flex; flex-wrap:wrap; gap:3px;">
            ${modulesHtml}
          </div>
        </td>
        <td style="text-align:center;">
          ${hiddenHtml}
        </td>
        <td style="text-align:center;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" class="btn btn-outline-primary btn-sm btn-edit-user-perms" data-email="${user.email}" title="Editar permisos" style="font-size:0.75rem; padding:4px 8px; font-weight:700;">
              ✏️ Editar
            </button>
            ${!isFran ? `
              <button type="button" class="btn-cat-del btn-del-user-perms" data-email="${user.email}" title="Eliminar usuario">
                🗑️
              </button>
            ` : `
              <span title="Usuario protegido" style="font-size:0.85rem; opacity:0.4; cursor:not-allowed;">🔒</span>
            `}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-edit-user-perms').forEach(btn => {
      btn.addEventListener('click', () => {
        editUserPermissions(btn.dataset.email);
      });
    });

    tbody.querySelectorAll('.btn-del-user-perms').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteUserPermissions(btn.dataset.email);
      });
    });
  }

  function editUserPermissions(email) {
    const user = catUsuariosRoles.find(u => (u.email || '').toLowerCase().trim() === email.toLowerCase().trim());
    if (!user) return;
    const isFran = (email.toLowerCase().trim() === 'francisco@totalb.com');

    const emailInput = document.getElementById('cfg_user_email');
    const nombreInput = document.getElementById('cfg_user_nombre');
    const rolSelect = document.getElementById('cfg_user_rol_select');
    const adminMsg = document.getElementById('msg-user-admin-fixed');
    const cancelBtn = document.getElementById('btn-cancel-user-edit');
    const formTitle = document.getElementById('cfg-user-form-title');
    const formIcon = document.getElementById('cfg-user-form-icon');
    const editIndex = document.getElementById('cfg_user_edit_index');

    if (editIndex) editIndex.value = email;
    if (emailInput) {
      emailInput.value = user.email;
      emailInput.readOnly = isFran;
    }
    if (nombreInput) nombreInput.value = user.nombre || '';
    if (rolSelect) {
      rolSelect.value = user.rol || 'Personalizado';
      rolSelect.disabled = isFran;
    }
    if (adminMsg) adminMsg.style.display = isFran ? 'block' : 'none';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (formTitle) formTitle.textContent = `Editar Permisos de: ${user.email}`;
    if (formIcon) formIcon.textContent = '✏️';

    renderUserPermModuleCheckboxes(isFran ? ALL_MODULE_KEYS : (user.modulos || []), isFran);
    document.getElementById('form-user-permissions')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetUserPermissionsForm() {
    const form = document.getElementById('form-user-permissions');
    if (form) form.reset();
    const editIndex = document.getElementById('cfg_user_edit_index');
    if (editIndex) editIndex.value = '-1';
    const emailInput = document.getElementById('cfg_user_email');
    if (emailInput) emailInput.readOnly = false;
    const rolSelect = document.getElementById('cfg_user_rol_select');
    if (rolSelect) {
      rolSelect.disabled = false;
      rolSelect.value = 'Recepción y Ventas';
    }
    const adminMsg = document.getElementById('msg-user-admin-fixed');
    if (adminMsg) adminMsg.style.display = 'none';
    const cancelBtn = document.getElementById('btn-cancel-user-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
    const formTitle = document.getElementById('cfg-user-form-title');
    if (formTitle) formTitle.textContent = 'Asignar o Modificar Permisos de Usuario';
    const formIcon = document.getElementById('cfg-user-form-icon');
    if (formIcon) formIcon.textContent = '➕';

    renderUserPermModuleCheckboxes(ROLE_PRESETS['Recepción y Ventas'].modulos, false);
  }

  async function handleUserPermissionsSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('cfg_user_email');
    const nombreInput = document.getElementById('cfg_user_nombre');
    const rolSelect = document.getElementById('cfg_user_rol_select');
    const chkCrearAuth = document.getElementById('chk-crear-en-auth');
    const pwdInput = document.getElementById('cfg_user_password');

    const email = (emailInput?.value || '').trim();
    const nombre = (nombreInput?.value || '').trim();
    const rol = rolSelect?.value || 'Personalizado';

    if (!email) {
      showToast('Por favor ingrese un correo válido de Firebase Auth', 'warning');
      return;
    }

    // Si se marcó crear en Firebase Authentication
    if (chkCrearAuth && chkCrearAuth.checked) {
      const pwd = (pwdInput?.value || '').trim();
      if (!pwd || pwd.length < 6) {
        showToast('La contraseña para Firebase Auth debe tener al menos 6 caracteres', 'warning');
        if (pwdInput) pwdInput.focus();
        return;
      }
      showToast('Registrando cuenta en Firebase Authentication...', 'info');
      const resAuth = await TB_FIREBASE.registerNewFirebaseUser(email, pwd, nombre);
      if (!resAuth.success) {
        if (!resAuth.error.includes('ya está registrado')) {
          showToast('Error al crear en Firebase Auth: ' + resAuth.error, 'error');
          return;
        } else {
          showToast('El correo ya existía en Firebase Auth. Se actualizarán sus permisos.', 'info');
        }
      } else {
        showToast(`✅ Cuenta ${email} creada exitosamente en Firebase Authentication`, 'success');
      }
    }

    const isFran = (email.toLowerCase() === 'francisco@totalb.com');
    let selectedModules = [];
    if (isFran || rol === 'Administrador') {
      selectedModules = [...ALL_MODULE_KEYS];
    } else {
      const chks = document.querySelectorAll('#grid-user-modules-perms .user-perm-check:checked');
      selectedModules = Array.from(chks).map(c => c.value);
    }

    let existingIndex = catUsuariosRoles.findIndex(u => (u.email || '').toLowerCase().trim() === email.toLowerCase().trim());
    if (existingIndex >= 0) {
      catUsuariosRoles[existingIndex].nombre = nombre;
      catUsuariosRoles[existingIndex].rol = isFran ? 'Administrador' : rol;
      catUsuariosRoles[existingIndex].isAdmin = isFran ? true : (rol === 'Administrador');
      catUsuariosRoles[existingIndex].modulos = isFran ? [...ALL_MODULE_KEYS] : selectedModules;
      catUsuariosRoles[existingIndex].updatedAt = new Date().toISOString();
    } else {
      catUsuariosRoles.push({
        email: email,
        nombre: nombre,
        rol: isFran ? 'Administrador' : rol,
        isAdmin: isFran ? true : (rol === 'Administrador'),
        modulos: isFran ? [...ALL_MODULE_KEYS] : selectedModules,
        fechaAlta: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    await TB_FIREBASE.saveCatalogo('usuarios_roles', catUsuariosRoles);
    showToast(`Permisos guardados para ${email}`, 'success');

    logAuditMovement({
      modulo: 'Configuración General',
      accion: 'MODIFICAR_PERMISOS_USUARIO',
      descripcion: `Configuración de permisos y rol para usuario: ${email} -> Rol: ${isFran ? 'Administrador' : rol} (${selectedModules.length} módulos)`,
      payload: { email, nombre, rol: isFran ? 'Administrador' : rol, modulos: selectedModules },
      reversible: false
    });

    const cur = TB_FIREBASE.getCurrentUser();
    if (cur && (cur.email || '').toLowerCase().trim() === email.toLowerCase().trim()) {
      applyUserPermissions(cur.email);
    }

    resetUserPermissionsForm();
    renderUsuariosRolesTable();
  }

  async function deleteUserPermissions(email) {
    if ((email || '').toLowerCase().trim() === 'francisco@totalb.com') {
      showToast('francisco@totalb.com es el Administrador Principal y no puede ser eliminado', 'error');
      return;
    }
    if (confirm(`¿Está seguro de eliminar los permisos configurados para ${email}?`)) {
      catUsuariosRoles = catUsuariosRoles.filter(u => (u.email || '').toLowerCase().trim() !== email.toLowerCase().trim());
      await TB_FIREBASE.saveCatalogo('usuarios_roles', catUsuariosRoles);
      logAuditMovement({
        modulo: 'Configuración General',
        accion: 'ELIMINAR_PERMISOS_USUARIO',
        descripcion: `Eliminación de permisos configurados para el usuario: ${email}`,
        payload: { email },
        reversible: false
      });
      renderUsuariosRolesTable();
      showToast(`Usuario ${email} eliminado de la configuración`, 'info');
    }
  }

  function renderUsuariosRolesView() {
    renderUsuariosRolesTable();
    const curEmailInForm = document.getElementById('cfg_user_email')?.value;
    if (!curEmailInForm) {
      renderUserPermModuleCheckboxes(ROLE_PRESETS['Recepción y Ventas'].modulos, false);
    }
  }

  function initConfigSecurityAndRoles() {
    const unlockModal = document.getElementById('modal-unlock-configuracion');
    const unlockForm = document.getElementById('form-unlock-configuracion');
    const unlockInput = document.getElementById('input-unlock-config-pwd');
    const unlockError = document.getElementById('unlock-config-error');
    const btnCancelUnlock = document.getElementById('btn-cancel-unlock-config');
    const btnToggleUnlock = document.getElementById('btn-toggle-unlock-config-pwd');
    const btnLockConfig = document.getElementById('btn-lock-config');

    unlockForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pwd = (unlockInput?.value || '').trim();
      if (pwd === '04012021') {
        isConfigUnlocked = true;
        sessionStorage.setItem('tb_cfg_unlocked', 'true');
        if (unlockModal) unlockModal.style.display = 'none';
        if (unlockError) unlockError.style.display = 'none';
        switchModule('configuracion');
        switchConfigTab(pendingConfigTab || 'servicios');
        pendingConfigTab = 'servicios';
        logAuditMovement({
          modulo: 'Seguridad',
          accion: 'DESBLOQUEO_CONFIGURACION',
          descripcion: `Desbloqueo exitoso de Configuración General con contraseña administrativa`,
          payload: {},
          reversible: false
        });
        showToast('🔓 Configuración General desbloqueada con éxito', 'success');
      } else {
        logAuditMovement({
          modulo: 'Seguridad',
          accion: 'INTENTO_ACCESO_FALLIDO',
          descripcion: `Intento de acceso denegado a Configuración General: Contraseña incorrecta`,
          payload: {},
          reversible: false
        });
        if (unlockError) {
          unlockError.textContent = 'Contraseña incorrecta.';
          unlockError.style.display = 'block';
        }
        if (unlockInput) {
          unlockInput.classList.add('shake');
          setTimeout(() => unlockInput.classList.remove('shake'), 400);
        }
      }
    });

    btnCancelUnlock?.addEventListener('click', () => {
      if (unlockModal) unlockModal.style.display = 'none';
    });

    btnToggleUnlock?.addEventListener('click', () => {
      if (unlockInput) {
        const isPwd = unlockInput.type === 'password';
        unlockInput.type = isPwd ? 'text' : 'password';
        btnToggleUnlock.textContent = isPwd ? '🙈' : '👁️';
      }
    });

    btnLockConfig?.addEventListener('click', () => {
      isConfigUnlocked = false;
      sessionStorage.removeItem('tb_cfg_unlocked');
      logAuditMovement({
        modulo: 'Seguridad',
        accion: 'BLOQUEO_CONFIGURACION',
        descripcion: `Bloqueo manual de Configuración General`,
        payload: {},
        reversible: false
      });
      showToast('🔒 Configuración General ha sido bloqueada', 'info');
      const allowed = getAllowedModulesForCurrentUser();
      const fallback = allowed.length > 0 ? allowed[0] : 'ventas';
      switchModule(fallback);
    });

    document.getElementById('cfg_user_rol_select')?.addEventListener('change', (e) => {
      applyRolePresetToCheckboxes(e.target.value);
    });

    document.getElementById('btn-perm-sel-all')?.addEventListener('click', () => {
      applyRolePresetToCheckboxes('Administrador');
      const sel = document.getElementById('cfg_user_rol_select');
      if (sel && !sel.disabled) sel.value = 'Administrador';
    });

    document.getElementById('btn-perm-desel-all')?.addEventListener('click', () => {
      const container = document.getElementById('grid-user-modules-perms');
      if (!container) return;
      container.querySelectorAll('.user-perm-check').forEach(chk => {
        if (chk.disabled) return;
        chk.checked = false;
        chk.closest('.perm-module-card')?.classList.remove('checked');
      });
      const sel = document.getElementById('cfg_user_rol_select');
      if (sel && !sel.disabled) sel.value = 'Personalizado';
    });

    document.getElementById('cfg_user_search')?.addEventListener('input', () => {
      renderUsuariosRolesTable();
    });

    document.getElementById('btn-cancel-user-edit')?.addEventListener('click', () => {
      resetUserPermissionsForm();
    });

    document.getElementById('form-user-permissions')?.addEventListener('submit', handleUserPermissionsSubmit);

    // Botones de descarga de usuarios desde Firebase
    document.getElementById('btn-descargar-usuarios-fb')?.addEventListener('click', () => {
      descargarUsuariosDeFirebase(true);
    });

    document.getElementById('btn-descargar-usuarios-fb-table')?.addEventListener('click', () => {
      descargarUsuariosDeFirebase(true);
    });

    // Toggle de creación en Firebase Auth
    document.getElementById('chk-crear-en-auth')?.addEventListener('change', (e) => {
      const wrap = document.getElementById('wrap-password-auth');
      if (wrap) wrap.style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('btn-toggle-new-user-pwd')?.addEventListener('click', () => {
      const inp = document.getElementById('cfg_user_password');
      if (inp) {
        inp.type = inp.type === 'password' ? 'text' : 'password';
      }
    });
  }

  function initAuthSystem() {
    const authOverlay = document.getElementById('auth-overlay');
    const authForm = document.getElementById('form-auth-login');
    const authEmail = document.getElementById('auth_email');
    const authPassword = document.getElementById('auth_password');
    const authRemember = document.getElementById('auth_remember');
    const authErrorBox = document.getElementById('auth-error-box');
    const authSuccessBox = document.getElementById('auth-success-box');
    const authSubmitBtn = document.getElementById('btn-auth-submit');
    const authSpinner = document.getElementById('btn-auth-spinner');
    const authText = document.getElementById('btn-auth-text');
    const btnTogglePwd = document.getElementById('btn-toggle-pwd');
    const linkForgotPwd = document.getElementById('link-forgot-pwd');

    const topbarUserBadge = document.getElementById('topbar-user-badge');
    const topbarUserEmail = document.getElementById('topbar-user-email');
    const sidebarUserCard = document.getElementById('sidebar-user-card');
    const sidebarUserEmail = document.getElementById('sidebar-user-email');

    function showError(msg) {
      if (authErrorBox) {
        authErrorBox.textContent = msg;
        authErrorBox.style.display = 'block';
      }
      if (authSuccessBox) authSuccessBox.style.display = 'none';
    }

    function showSuccess(msg) {
      if (authSuccessBox) {
        authSuccessBox.textContent = msg;
        authSuccessBox.style.display = 'block';
      }
      if (authErrorBox) authErrorBox.style.display = 'none';
    }

    async function onLoginSuccess(user, isFreshLogin = false) {
      showGlobalLoader('Iniciando Sesión...', 'Validando credenciales y permisos...');
      const email = (user.email || '').toLowerCase().trim();

      // 1. CARGA INMEDIATA DE ROLES Y PERMISOS DESDE MEMORIA / LOCALSTORAGE
      if (!Array.isArray(catUsuariosRoles) || catUsuariosRoles.length === 0) {
        try {
          const cached = localStorage.getItem('tb_cat_usuarios_roles');
          if (cached) {
            const parsed = JSON.parse(cached);
            catUsuariosRoles = Array.isArray(parsed) ? parsed : (parsed?.items || []);
          }
        } catch (e) {}
      }

      // Si los roles no están en memoria o no incluyen al usuario actual, sincronizar antes de abrir el portal
      if (!Array.isArray(catUsuariosRoles) || catUsuariosRoles.length === 0 || !catUsuariosRoles.some(u => (u.email || '').toLowerCase().trim() === email)) {
        await syncAndApplyUserPermissions(email);
      } else {
        applyUserPermissions(email);
      }

      // 3. ACTUALIZAR INSIGNIAS Y DATOS DEL HEADER
      if (topbarUserBadge) topbarUserBadge.style.display = 'inline-flex';
      if (topbarUserEmail) topbarUserEmail.textContent = user.email;
      if (sidebarUserCard) sidebarUserCard.style.display = 'block';
      if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;

      // 4. OCULTAR EL MODAL DE LOGIN Y DESBLOQUEAR APLICACIÓN SOLO DESPUÉS DE QUE LOS PERMISOS YA FUERON APLICADOS AL DOM
      const layoutWrapper = document.getElementById('app-layout-wrapper');
      if (layoutWrapper) {
        layoutWrapper.classList.remove('app-locked');
        layoutWrapper.style.removeProperty('display');
        layoutWrapper.style.display = 'flex';
      }
      if (authOverlay) authOverlay.classList.add('hidden');

      if (isFreshLogin) {
        showToast(`Bienvenido(a) ${user.email}`, 'success');
        logAuditMovement({
          modulo: 'Autenticación',
          accion: 'INICIO_SESION',
          descripcion: `Inicio de sesión exitoso con Firebase Authentication: ${user.email}`,
          payload: { email: user.email },
          reversible: false
        });
      }

      // Responsables obligatorios no editables fijados con el correo de inicio de sesión
      const respEl = document.getElementById('header_responsable');
      if (respEl) respEl.value = user.email;
      const respValEl = document.getElementById('val_responsable_nombre');
      if (respValEl) respValEl.value = user.email;
      const respChica = document.getElementById('chica_responsable');
      if (respChica) respChica.value = user.email;

      // 5. GESTIÓN INMEDIATA DE MÓDULO ACTIVO Y LANZADOR (SIN ESPERAR LA RED)
      const allowed = getAllowedModulesForCurrentUser();
      const savedMod = localStorage.getItem('tb_active_module');

      hideGlobalLoader(150);
      if (isFreshLogin) {
        openModuleLauncher();
      } else {
        let targetMod = savedMod;
        if (!targetMod || !hasModulePermission(targetMod)) {
          targetMod = allowed[0] || 'ventas';
        }
        switchModule(targetMod);
      }

      // 6. CARGAR DATOS FRESCOS DESDE FIREBASE EN SEGUNDO PLANO Y EN PARALELO
      Promise.all([
        loadControlCajaData(),
        loadCatalogsData(),
        syncAndApplyUserPermissions(user.email)
      ]).then(() => {
        refreshActiveModuleData();
      }).catch(err => {
        console.warn('Error sincronizando con Firebase:', err);
      });
    }

    function onLogoutSuccess() {
      closeModuleLauncher();
      isConfigUnlocked = false;
      sessionStorage.removeItem('tb_cfg_unlocked');

      // 1. BLOQUEAR Y OCULTAR COMPLETAMENTE LA APLICACIÓN AL CERRAR SESIÓN
      const layoutWrapper = document.getElementById('app-layout-wrapper');
      if (layoutWrapper) {
        layoutWrapper.classList.add('app-locked');
        layoutWrapper.style.display = 'none';
      }

      // Ocultar módulos del menú y vistas activas para proteger el sistema al salir
      document.querySelectorAll('.sidebar-menu li').forEach(li => {
        li.style.display = 'none';
        li.classList.add('menu-item-hidden');
      });
      document.querySelectorAll('.sidebar-menu-category').forEach(catLi => {
        catLi.style.display = 'none';
        catLi.classList.add('category-hidden');
      });
      document.querySelectorAll('.module-view').forEach(view => {
        view.classList.remove('active-view');
        view.style.display = 'none';
        view.classList.add('view-forbidden');
      });
      currentModule = null;

      logAuditMovement({
        modulo: 'Autenticación',
        accion: 'CIERRE_SESION',
        descripcion: `Cierre de sesión de la cuenta de usuario`,
        payload: {},
        reversible: false
      });

      if (authOverlay) authOverlay.classList.remove('hidden');
      if (topbarUserBadge) topbarUserBadge.style.display = 'none';
      if (sidebarUserCard) sidebarUserCard.style.display = 'none';
      if (authForm) authForm.reset();
      if (authErrorBox) authErrorBox.style.display = 'none';
      if (authSuccessBox) authSuccessBox.style.display = 'none';

      // Limpiar datos de sesión activa
      currentModule = null;
    }

    // Toggle ver contraseña
    btnTogglePwd?.addEventListener('click', () => {
      const isPwd = authPassword.type === 'password';
      authPassword.type = isPwd ? 'text' : 'password';
      btnTogglePwd.textContent = isPwd ? '🙈' : '👁️';
    });

    // Olvidé mi contraseña
    linkForgotPwd?.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = authEmail?.value?.trim() || prompt('Ingrese su correo para restablecer contraseña:');
      if (!email) return;
      showToast('Enviando enlace de restablecimiento...', 'info');
      const res = await TB_FIREBASE.sendPasswordReset(email);
      if (res.success) {
        showSuccess(res.message);
      } else {
        showError(res.error);
      }
    });

    // Envío del formulario de Inicio de Sesión
    authForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authEmail.value.trim();
      const password = authPassword.value;
      const remember = authRemember ? authRemember.checked : true;

      if (!email || !password) {
        showError('Por favor ingrese su correo electrónico y contraseña.');
        return;
      }

      if (authSpinner) authSpinner.style.display = 'inline-block';
      if (authText) authText.textContent = 'Verificando con Firebase...';
      if (authSubmitBtn) authSubmitBtn.disabled = true;
      if (authErrorBox) authErrorBox.style.display = 'none';

      const res = await TB_FIREBASE.login(email, password, remember);

      if (authSpinner) authSpinner.style.display = 'none';
      if (authText) authText.textContent = 'Iniciar Sesión';
      if (authSubmitBtn) authSubmitBtn.disabled = false;

      if (res.success) {
        onLoginSuccess(res.user, true); // true = inicio de sesión nuevo (muestra menú de selección)
      } else {
        showError(res.error);
      }
    });

    // Botones de Cerrar Sesión
    document.querySelectorAll('.btn-logout').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('¿Está seguro de cerrar sesión en Total Beauty?')) {
          TB_FIREBASE.logout();
          onLogoutSuccess();
          showToast('Sesión cerrada correctamente', 'info');
        }
      });
    });

    // Aplicación defensiva de permisos previos si existe usuario en sesión (sin mostrar contenido antes de verificar)
    try {
      const savedUserRaw = localStorage.getItem('tb_auth_user') || sessionStorage.getItem('tb_auth_user');
      if (savedUserRaw) {
        const savedUser = JSON.parse(savedUserRaw);
        if (savedUser && savedUser.email) {
          applyUserPermissions(savedUser.email);
        }
      }
    } catch (e) {}

    // Verificar si hay sesión previa activa (al recargar la página no salir de donde estaba)
    TB_FIREBASE.checkSession().then(res => {
      if (res && res.active && res.user) {
        onLoginSuccess(res.user, false); // false = recarga de página (permanece en su módulo activo)
      } else {
        onLogoutSuccess();
        if (res && res.expired) {
          showError(res.message || '🌙 La jornada laboral ha concluido (9:00 PM). La sesión se ha cerrado automáticamente por seguridad. Por favor inicie sesión nuevamente.');
        }
      }
    });

    // Escuchar expiración automática tras las 9:00 PM en tiempo real
    window.addEventListener('tb_session_expired', (e) => {
      onLogoutSuccess();
      showError(e.detail?.message || '🌙 La jornada laboral ha concluido (9:00 PM). La sesión se ha cerrado automáticamente por seguridad.');
      showToast('🌙 Sesión cerrada por fin de jornada (9:00 PM)', 'warning');
    });

    // Botones para abrir y cerrar el Menú de Selección de Módulos
    document.getElementById('btn-open-module-launcher')?.addEventListener('click', () => {
      hideGlobalLoader(300);
        openModuleLauncher();
    });

    document.getElementById('sidebar-launcher-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('app-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-backdrop')?.classList.remove('active');
      hideGlobalLoader(300);
        openModuleLauncher();
    });

    document.getElementById('btn-close-launcher')?.addEventListener('click', () => {
      closeModuleLauncher();
    });

    document.getElementById('modal-modulo-launcher')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-modulo-launcher') {
        closeModuleLauncher();
      }
    });
  }

})();
