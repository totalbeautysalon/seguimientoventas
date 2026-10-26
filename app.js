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
  let currentHistTipo = 'principal'; // 'principal' o 'chica'
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
    'balancescore': {
      title: 'BalanceScore por Estaciones',
      desc: 'Medición de metas de ingresos y calidad operativa en las 6 estaciones de trabajo'
    },
    'ingresos': {
      title: 'Reporte Diario de Ingresos',
      desc: 'Análisis de ventas por método de pago y unidad de negocio'
    },
    'interesadas': {
      title: 'Interesadas, Solo Preguntan y Cierres',
      desc: '3 Opciones: Nuevo registro, Seguimiento por WhatsApp/Llamada y BalanceScore'
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
    currentModule = modKey;

    document.querySelectorAll('.menu-item-link').forEach(link => {
      if (link.dataset.module === modKey) link.classList.add('active');
      else link.classList.remove('active');
    });

    document.querySelectorAll('.module-view').forEach(view => {
      view.classList.remove('active-view');
    });
    const target = document.getElementById(`view-${modKey}`);
    if (target) target.classList.add('active-view');

    const info = moduleTitles[modKey] || { title: 'Total Beauty', desc: '' };
    document.getElementById('topbar-module-title').textContent = info.title;
    document.getElementById('topbar-module-desc').textContent = info.desc;

    document.getElementById('app-sidebar')?.classList.remove('open');

    // Carga de datos correspondientes
    if (modKey === 'ventas') {
      const vFecha = document.getElementById('ventas_filtro_fecha')?.value || new Date().toISOString().split('T')[0];
      renderVentas(vFecha);
    }
    if (modKey === 'historial') loadHistorial();
    if (modKey === 'balancescore') renderBalanceScoreStations();
    if (modKey === 'ingresos') renderIngresosReport();
    if (modKey === 'interesadas') loadInteresadasView();
    if (modKey === 'campana') {
      renderCampanaActiva();
      renderEventosTimeline();
    }
    if (modKey === 'configuracion') {
      loadAndRenderConfiguracion();
    }
    if (modKey === 'auditoria') {
      renderAuditoriaView();
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
  // 1. REGISTRO DIARIO DE VENTAS (100% INTERCONECTADO)
  // =========================================================================
  async function renderVentas(fecha) {
    if (!fecha) {
      fecha = document.getElementById('ventas_filtro_fecha')?.value || new Date().toISOString().split('T')[0];
    }
    const filterInput = document.getElementById('ventas_filtro_fecha');
    if (filterInput && !filterInput.value) filterInput.value = fecha;

    const vFechaInput = document.getElementById('venta_fecha');
    if (vFechaInput && !vFechaInput.value) vFechaInput.value = fecha;

    const tbody = document.getElementById('tbody-ventas');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:18px; color:var(--muted);">Cargando ventas...</td></tr>';

    const ventas = await TB_FIREBASE.getVentasByFecha(fecha);

    let totCobrado = 0;
    let totEfec = 0;
    let totTarj = 0;
    let totTransf = 0;

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      totCobrado += imp;
      const mp = (v.metodoPago || '').toLowerCase();
      if (mp.includes('efec')) totEfec += imp;
      else if (mp.includes('tarj')) totTarj += imp;
      else if (mp.includes('transf')) totTransf += imp;
      else totEfec += imp;
    });

    setDisplay('kpi-ventas-total', totCobrado);
    setDisplay('kpi-ventas-efectivo', totEfec);
    setDisplay('kpi-ventas-tarjeta', totTarj);
    setDisplay('kpi-ventas-transf', totTransf);
    setDisplay('tabla-ventas-gran-total', totCobrado);

    const opsBadge = document.getElementById('ventas-badge-operaciones');
    if (opsBadge) opsBadge.textContent = `${ventas.length} Operaciones`;

    tbody.innerHTML = '';
    if (ventas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="table-empty-notice">
            <span>📂</span>
            No hay ventas registradas para este día (${fecha}). Registre una nueva venta arriba.
          </td>
        </tr>
      `;
      return;
    }

    ventas.forEach((v, index) => {
      const tr = document.createElement('tr');
      const horaStr = v.hora || (v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');

      let statusBadgeClass = 'badge-cuadrada';
      if (v.statusPago === 'Anticipo') statusBadgeClass = 'badge-sobrante';
      if (v.statusPago === 'Saldo pendiente') statusBadgeClass = 'badge-faltante';

      tr.innerHTML = `
        <td><span style="font-size:0.8rem; color:var(--muted);">${horaStr}</span></td>
        <td><strong>${v.clienta || '<span style="color:var(--muted); font-style:italic;">Cliente Mostrador</span>'}</strong></td>
        <td><span style="font-family:monospace; font-size:0.82rem;">${v.telefono || 'Sin tel'}</span></td>
        <td>${v.servicio || '-'}</td>
        <td><span style="font-size:0.82rem; font-weight:600; color:var(--primary);">${v.estacion || '-'}</span></td>
        <td>${v.especialista || '-'}</td>
        <td><span style="font-size:0.82rem;">${v.metodoPago || 'Efectivo'}</span></td>
        <td><span class="kpi-status-badge ${statusBadgeClass}" style="font-size:0.75rem;">${v.statusPago || 'Pagado'}</span></td>
        <td class="text-right" style="font-weight:700;">${formatCurrency(v.totalCobrado)}</td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-venta" data-id="${v.id}" data-fecha="${v.fecha}" title="Eliminar Venta">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Interconexión: Sincronizar automáticamente las ventas del día a Caja Principal
  async function syncVentasToCajaPrincipal(fecha, autoAlert = true) {
    if (!fecha) fecha = document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0];
    const ventas = await TB_FIREBASE.getVentasByFecha(fecha);

    // Reiniciar contadores de ingresos (Solo Servicios de belleza, Cursos de academia y Venta de productos)
    const matrix = {
      servicios: { e: 0, t: 0, j: 0 },
      cursos:    { e: 0, t: 0, j: 0 },
      productos: { e: 0, t: 0, j: 0 }
    };

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const mp = (v.metodoPago || '').toLowerCase();
      const col = mp.includes('transf') ? 't' : (mp.includes('tarj') ? 'j' : 'e');

      const est = (v.estacion || '').toLowerCase();
      const serv = (v.servicio || '').toLowerCase();

      if (est.includes('academia') || serv.includes('curso') || serv.includes('taller')) {
        matrix.cursos[col] += imp;
      } else if (est.includes('retail') || serv.includes('producto') || serv.includes('shampoo')) {
        matrix.productos[col] += imp;
      } else {
        matrix.servicios[col] += imp;
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

    // Ingresos (Solo servicios, cursos y productos)
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

    // Conteo físico principal
    const denoms = [
      { id: 'billete_1000', subId: 'sub_1000', val: 1000 },
      { id: 'billete_500',  subId: 'sub_500',  val: 500 },
      { id: 'billete_200',  subId: 'sub_200',  val: 200 },
      { id: 'billete_100',  subId: 'sub_100',  val: 100 },
      { id: 'billete_50',   subId: 'sub_50',   val: 50 },
      { id: 'billete_20',   subId: 'sub_20',   val: 20 },
      { id: 'moneda_10',    subId: 'sub_10',   val: 10 },
      { id: 'moneda_5',     subId: 'sub_5',    val: 5 },
      { id: 'moneda_2',     subId: 'sub_2',    val: 2 },
      { id: 'moneda_1',     subId: 'sub_1',    val: 1 },
      { id: 'moneda_050',   subId: 'sub_050',  val: 0.50 }
    ];

    let totalContado = 0;
    denoms.forEach(item => {
      const q = parseInt(document.getElementById(item.id)?.value, 10) || 0;
      const sub = q * item.val;
      totalContado += sub;
      const subEl = document.getElementById(item.subId);
      if (subEl) subEl.textContent = formatCurrency(sub);
    });

    const conteoEl = document.getElementById('conteo_total_efectivo');
    if (conteoEl) conteoEl.textContent = formatCurrency(totalContado);
    setDisplay('kpi-efectivo-contado', totalContado);

    // Conciliación Caja Principal:
    // Efectivo esperado = Fondo inicial + Ingresos en efectivo
    setDisplay('concil_ingresos_efectivo', totEfec);
    setDisplay('concil_efectivo_contado', totalContado);

    const esperado = fCaja + totEfec;
    setDisplay('concil_efectivo_esperado', esperado);

    const diferencia = totalContado - esperado;
    setDisplay('concil_diferencia_caja', diferencia);
    setDisplay('kpi-diferencia', diferencia);

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

    // Control transferencias
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
    const today = (document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0]);
    const allEntregas = Object.values(controlCajaData.entregas || {});
    const entregasHoy = allEntregas.filter(e => e.fecha === today);
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
    const today = (document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0]);
    const allEntregas = Object.values(controlCajaData.entregas || {});
    const entregasHoy = allEntregas.filter(e => e.fecha === today);
    const totalEntregadoHoy = entregasHoy.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);
    const dif = parseVal('concil_diferencia_caja');
    const resArqueo = (Math.abs(dif) < 0.005) ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante');

    return {
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
        total: parseVal('conteo_total_efectivo')
      },
      conciliacion: {
        fondo: parseVal('f_inicial_caja'),
        ingresosEfec: parseVal('ing_total_efectivo'),
        esperado: parseVal('concil_efectivo_esperado'),
        contado: parseVal('conteo_total_efectivo'),
        diferencia: dif,
        resultado: resArqueo,
        explicacion: document.getElementById('concil_explicacion')?.value || ''
      },
      controlPagos: {
        transfVer: parseVal('ctrl_transf_verif'),
        tarjVer: parseVal('ctrl_tarj_verif')
      },
      resumen: {
        totalIngresos: parseVal('resumen_total_ingresos'),
        totalEfectivo: parseVal('resumen_total_efectivo'),
        totalTransf: parseVal('ctrl_transf_verif'),
        totalTarjetas: parseVal('ctrl_tarj_verif'),
        totalEntregado: totalEntregadoHoy,
        detalleEntregas: entregasHoy.map(e => `${e.recibe}: $${(parseFloat(e.cantidad)||0).toFixed(2)}`).join(', '),
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
        destinoEfectivo: document.getElementById('val_destino_efectivo')?.value || 'se_queda_en_caja',
        lugarResguardo: document.getElementById('val_efectivo_otro_lugar')?.value || '',
        importeEntregado: parseVal('val_importe_entregado'),
        signatureData: sigDataPrincipal && sigPadPrincipal ? sigPadPrincipal.toDataURL() : null
      }
    };
  }

  function clearPrincipalForm() {
    formPrincipal.reset();
    if (sigCtxPrincipal && sigPadPrincipal) {
      sigCtxPrincipal.clearRect(0, 0, sigPadPrincipal.width, sigPadPrincipal.height);
      sigDataPrincipal = false;
    }
    const now = new Date();
    const dStr = now.toISOString().split('T')[0];
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const userEmail = TB_FIREBASE.getCurrentUser()?.email || '';

    if (document.getElementById('header_responsable')) document.getElementById('header_responsable').value = userEmail;
    if (document.getElementById('val_responsable_nombre')) document.getElementById('val_responsable_nombre').value = userEmail;
    if (document.getElementById('header_fecha')) document.getElementById('header_fecha').value = dStr;
    if (document.getElementById('header_hora')) document.getElementById('header_hora').value = hm;
    if (document.getElementById('val_hora_cierre')) document.getElementById('val_hora_cierre').value = hm;
    if (document.getElementById('val_hora_entrega')) document.getElementById('val_hora_entrega').value = '';
    if (document.getElementById('wrap_efectivo_otro_lugar')) document.getElementById('wrap_efectivo_otro_lugar').style.display = 'none';

    loadControlCajaData();
    recalculatePrincipal();
  }

  function syncPrincipalPrintable() {
    recalculatePrincipal();
    const rawF = document.getElementById('header_fecha')?.value || '';
    if (document.getElementById('p_fecha')) document.getElementById('p_fecha').textContent = rawF || '__ / __ / ____';
    if (document.getElementById('p_responsable')) document.getElementById('p_responsable').textContent = document.getElementById('header_responsable')?.value || '________________';
    if (document.getElementById('p_hora')) document.getElementById('p_hora').textContent = document.getElementById('header_hora')?.value || '____';

    if (document.getElementById('p_f_caja')) document.getElementById('p_f_caja').textContent = formatCurrency(parseVal('f_inicial_caja'));

    ['servicios', 'cursos', 'productos'].forEach(r => {
      const elE = document.getElementById(`p_ing_${r}_e`);
      const elT = document.getElementById(`p_ing_${r}_t`);
      const elJ = document.getElementById(`p_ing_${r}_j`);
      const elTot = document.getElementById(`p_ing_${r}_tot`);
      if (elE) elE.textContent = formatCurrency(parseVal(`ing_${r}_efec`));
      if (elT) elT.textContent = formatCurrency(parseVal(`ing_${r}_transf`));
      if (elJ) elJ.textContent = formatCurrency(parseVal(`ing_${r}_tarj`));
      if (elTot) elTot.textContent = formatCurrency(parseVal(`ing_${r}_total`));
    });
    if (document.getElementById('p_ing_tot_e')) document.getElementById('p_ing_tot_e').textContent = formatCurrency(parseVal('ing_total_efectivo'));
    if (document.getElementById('p_ing_tot_t')) document.getElementById('p_ing_tot_t').textContent = formatCurrency(parseVal('ing_total_transf'));
    if (document.getElementById('p_ing_tot_j')) document.getElementById('p_ing_tot_j').textContent = formatCurrency(parseVal('ing_total_tarjeta'));
    if (document.getElementById('p_ing_tot_gran')) document.getElementById('p_ing_tot_gran').textContent = formatCurrency(parseVal('ing_gran_total'));
    if (document.getElementById('p_operaciones')) document.getElementById('p_operaciones').textContent = document.getElementById('ing_operaciones_cobradas')?.value || '0';

    // Conteo
    const denoms = [
      { id: 'billete_1000', qId: 'p_b_1000_q', tId: 'p_b_1000_tot', val: 1000 },
      { id: 'billete_500',  qId: 'p_b_500_q',  tId: 'p_b_500_tot',  val: 500 },
      { id: 'billete_200',  qId: 'p_b_200_q',  tId: 'p_b_200_tot',  val: 200 },
      { id: 'billete_100',  qId: 'p_b_100_q',  tId: 'p_b_100_tot',  val: 100 },
      { id: 'billete_50',   qId: 'p_b_50_q',   tId: 'p_b_50_tot',   val: 50 },
      { id: 'billete_20',   qId: 'p_b_20_q',   tId: 'p_b_20_tot',   val: 20 },
      { id: 'moneda_10',    qId: 'p_m_10_q',   tId: 'p_m_10_tot',   val: 10 },
      { id: 'moneda_5',     qId: 'p_m_5_q',    tId: 'p_m_5_tot',    val: 5 },
      { id: 'moneda_2',     qId: 'p_m_2_q',    tId: 'p_m_2_tot',    val: 2 },
      { id: 'moneda_1',     qId: 'p_m_1_q',    tId: 'p_m_1_tot',    val: 1 },
      { id: 'moneda_050',   qId: 'p_m_050_q',  tId: 'p_m_050_tot',  val: 0.50 }
    ];
    let tc = 0;
    denoms.forEach(d => {
      const q = parseInt(document.getElementById(d.id)?.value, 10) || 0;
      tc += q * d.val;
      const qEl = document.getElementById(d.qId);
      const tEl = document.getElementById(d.tId);
      if (qEl) qEl.textContent = q > 0 ? q : '';
      if (tEl) tEl.textContent = formatCurrency(q * d.val);
    });
    if (document.getElementById('p_conteo_tot')) document.getElementById('p_conteo_tot').textContent = formatCurrency(tc);

    // Conciliación
    if (document.getElementById('p_concil_fondo')) document.getElementById('p_concil_fondo').textContent = formatCurrency(parseVal('f_inicial_caja'));
    if (document.getElementById('p_concil_ingresos')) document.getElementById('p_concil_ingresos').textContent = formatCurrency(parseVal('ing_total_efectivo'));
    if (document.getElementById('p_concil_esperado')) document.getElementById('p_concil_esperado').textContent = formatCurrency(parseVal('concil_efectivo_esperado'));
    if (document.getElementById('p_concil_contado')) document.getElementById('p_concil_contado').textContent = formatCurrency(tc);
    if (document.getElementById('p_concil_diferencia')) document.getElementById('p_concil_diferencia').textContent = formatCurrency(parseVal('concil_diferencia_caja'));

    const dif = parseVal('concil_diferencia_caja');
    const res = (Math.abs(dif) < 0.005) ? 'cuadrada' : (dif > 0 ? 'sobrante' : 'faltante');
    if (document.getElementById('p_box_cuadrada')) document.getElementById('p_box_cuadrada').textContent = res === 'cuadrada' ? '✓' : '';
    if (document.getElementById('p_box_sobrante')) document.getElementById('p_box_sobrante').textContent = res === 'sobrante' ? '✓' : '';
    if (document.getElementById('p_box_faltante')) document.getElementById('p_box_faltante').textContent = res === 'faltante' ? '✓' : '';
    if (document.getElementById('p_explicacion')) document.getElementById('p_explicacion').textContent = document.getElementById('concil_explicacion')?.value?.trim() || 'Sin diferencias.';

    // Control de transferencias y tarjetas en PDF
    const tReg = parseVal('ctrl_transf_reg');
    const tVer = parseVal('ctrl_transf_verif');
    const jReg = parseVal('ctrl_tarj_reg');
    const jVer = parseVal('ctrl_tarj_verif');
    const oReg = parseVal('ctrl_otros_reg');
    const oVer = parseVal('ctrl_otros_verif');

    if (document.getElementById('p_ctrl_transf_reg')) document.getElementById('p_ctrl_transf_reg').textContent = formatCurrency(tReg);
    if (document.getElementById('p_ctrl_transf_ver')) document.getElementById('p_ctrl_transf_ver').textContent = formatCurrency(tVer);
    if (document.getElementById('p_ctrl_transf_dif')) document.getElementById('p_ctrl_transf_dif').textContent = formatCurrency(tVer - tReg);

    if (document.getElementById('p_ctrl_tarj_reg')) document.getElementById('p_ctrl_tarj_reg').textContent = formatCurrency(jReg);
    if (document.getElementById('p_ctrl_tarj_ver')) document.getElementById('p_ctrl_tarj_ver').textContent = formatCurrency(jVer);
    if (document.getElementById('p_ctrl_tarj_dif')) document.getElementById('p_ctrl_tarj_dif').textContent = formatCurrency(jVer - jReg);

    if (document.getElementById('p_ctrl_otros_reg')) document.getElementById('p_ctrl_otros_reg').textContent = formatCurrency(oReg);
    if (document.getElementById('p_ctrl_otros_ver')) document.getElementById('p_ctrl_otros_ver').textContent = formatCurrency(oVer);
    if (document.getElementById('p_ctrl_otros_dif')) document.getElementById('p_ctrl_otros_dif').textContent = formatCurrency(oVer - oReg);

    const totReg = tReg + jReg + oReg;
    const totVer = tVer + jVer + oVer;
    if (document.getElementById('p_ctrl_tot_reg')) document.getElementById('p_ctrl_tot_reg').textContent = formatCurrency(totReg);
    if (document.getElementById('p_ctrl_tot_ver')) document.getElementById('p_ctrl_tot_ver').textContent = formatCurrency(totVer);
    if (document.getElementById('p_ctrl_tot_dif')) document.getElementById('p_ctrl_tot_dif').textContent = formatCurrency(totVer - totReg);

    // Resumen Final en PDF
    const today = (document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0]);
    const allEntregas = Object.values(controlCajaData.entregas || {});
    const entregasHoy = allEntregas.filter(e => e.fecha === today);
    const totalEntregadoHoy = entregasHoy.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);

    if (document.getElementById('p_res_ingresos')) document.getElementById('p_res_ingresos').textContent = formatCurrency(parseVal('ing_gran_total'));
    if (document.getElementById('p_res_contado')) document.getElementById('p_res_contado').textContent = formatCurrency(tc);
    if (document.getElementById('p_res_transf')) document.getElementById('p_res_transf').textContent = formatCurrency(tVer);
    if (document.getElementById('p_res_tarjetas')) document.getElementById('p_res_tarjetas').textContent = formatCurrency(jVer + oVer);
    if (document.getElementById('p_res_retiros')) {
      const detalle = entregasHoy.length > 0 ? ` (${entregasHoy.map(e => e.recibe).join(', ')})` : '';
      document.getElementById('p_res_retiros').textContent = `${formatCurrency(totalEntregadoHoy)}${detalle}`;
    }
    if (document.getElementById('p_res_diferencia')) document.getElementById('p_res_diferencia').textContent = formatCurrency(dif);
    if (document.getElementById('p_res_num_servicios')) document.getElementById('p_res_num_servicios').textContent = document.getElementById('resumen_num_servicios')?.value || '0';
    if (document.getElementById('p_res_num_cursos')) document.getElementById('p_res_num_cursos').textContent = document.getElementById('resumen_num_cursos')?.value || '0';

    // Validación y entrega
    const valN = document.getElementById('val_responsable_nombre')?.value || document.getElementById('header_responsable')?.value || '';
    if (document.getElementById('p_val_nombre')) document.getElementById('p_val_nombre').textContent = valN;
    const firmaImg = document.getElementById('p_val_firma_img');
    const firmaBlank = document.getElementById('p_val_firma_blank');
    if (sigDataPrincipal && sigPadPrincipal) {
      if (firmaImg) {
        firmaImg.src = sigPadPrincipal.toDataURL('image/png');
        firmaImg.style.display = 'block';
      }
      if (firmaBlank) firmaBlank.style.display = 'none';
    } else {
      if (firmaImg) firmaImg.style.display = 'none';
      if (firmaBlank) firmaBlank.style.display = 'inline-block';
    }
    if (document.getElementById('p_val_hora_cierre')) document.getElementById('p_val_hora_cierre').textContent = document.getElementById('val_hora_cierre')?.value || '____';
    if (document.getElementById('p_val_hora_entrega')) document.getElementById('p_val_hora_entrega').textContent = document.getElementById('val_hora_entrega')?.value || '____';
    const dest = document.getElementById('val_destino_efectivo')?.value || 'se_queda_en_caja';
    let destTexto = '1.- Se queda en caja';
    if (dest === 'se_guarda_en_sobre') destTexto = '2.- Se guarda en sobre';
    else if (dest === 'se_resguarda_otro') {
      const lugar = document.getElementById('val_efectivo_otro_lugar')?.value.trim();
      destTexto = `3.- Se resguarda en otro lugar${lugar ? ': ' + lugar : ''}`;
    }
    if (document.getElementById('p_val_entregado_a')) document.getElementById('p_val_entregado_a').textContent = destTexto;
    if (document.getElementById('p_val_importe_entregado')) document.getElementById('p_val_importe_entregado').textContent = formatCurrency(parseVal('val_importe_entregado'));
    if (document.getElementById('p_obs_dia')) document.getElementById('p_obs_dia').textContent = document.getElementById('resumen_observaciones_dia')?.value?.trim() || 'Sin observaciones.';
    if (document.getElementById('p_val_observaciones')) document.getElementById('p_val_observaciones').textContent = document.getElementById('val_observaciones')?.value?.trim() || 'Ninguna.';

    const cln = valN.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim().replace(/\s+/g, '_');
    return `Arqueo_Caja_Principal_${rawF || 'Fecha'}_${cln || 'Responsable'}.pdf`;
  }

  // =========================================================================
  // 3. LÓGICA DE CAJA CHICA
  // =========================================================================
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

    // Badges caja chica
    const rC = document.getElementById('chica_res_cuadrada');
    const rS = document.getElementById('chica_res_sobrante');
    const rF = document.getElementById('chica_res_faltante');
    const cardC = document.getElementById('card_chica_cuadrada');
    const cardS = document.getElementById('card_chica_sobrante');
    const cardF = document.getElementById('card_chica_faltante');
    const kBadge = document.getElementById('kpi-chica-status-badge');
    const dLabel = document.getElementById('chica_diferencia_label');

    if (cardC) cardC.className = 'resultado-radio-card';
    if (cardS) cardS.className = 'resultado-radio-card';
    if (cardF) cardF.className = 'resultado-radio-card';

    if (Math.abs(dif) < 0.005) {
      if (rC) rC.checked = true;
      if (cardC) cardC.classList.add('active-cuadrada');
      if (kBadge) { kBadge.textContent = 'Cuadrada'; kBadge.className = 'kpi-status-badge badge-cuadrada'; }
      if (dLabel) { dLabel.textContent = '✅ Caja cuadrada exacta'; dLabel.style.color = 'var(--success)'; }
    } else if (dif > 0.005) {
      if (rS) rS.checked = true;
      if (cardS) cardS.classList.add('active-sobrante');
      if (kBadge) { kBadge.textContent = `Sobrante: ${formatCurrency(dif)}`; kBadge.className = 'kpi-status-badge badge-sobrante'; }
      if (dLabel) { dLabel.textContent = `🟡 Sobrante de ${formatCurrency(dif)}`; dLabel.style.color = 'var(--warning)'; }
    } else {
      if (rF) rF.checked = true;
      if (cardF) cardF.classList.add('active-faltante');
      if (kBadge) { kBadge.textContent = `Faltante: ${formatCurrency(Math.abs(dif))}`; kBadge.className = 'kpi-status-badge badge-faltante'; }
      if (dLabel) { dLabel.textContent = `🔴 Faltante de ${formatCurrency(Math.abs(dif))}`; dLabel.style.color = 'var(--danger)'; }
    }

    const respChica = document.getElementById('chica_responsable')?.value || '';
    const valNC = document.getElementById('chica_val_nombre');
    if (valNC && !valNC.value) valNC.value = respChica;
  }

  function serializeChica() {
    const salidas = [];
    document.querySelectorAll('.chica-salida-row').forEach(r => {
      salidas.push({
        concepto: r.querySelector('.chica-concepto')?.value || '',
        motivo: r.querySelector('.chica-motivo')?.value || '',
        autorizo: r.querySelector('.chica-autorizo')?.value || '',
        importe: parseFloat(r.querySelector('.chica-importe')?.value) || 0
      });
    });

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
      conciliacion: {
        fondo: parseVal('chica_fondo_inicial'),
        salidas: parseVal('chica_total_salidas'),
        esperado: parseVal('chica_concil_esperado'),
        contado: parseVal('chica_total_contado'),
        diferencia: parseVal('chica_concil_diferencia'),
        resultado: document.querySelector('input[name="chica_resultado"]:checked')?.value || 'cuadrada',
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
    const now = new Date();
    document.getElementById('chica_fecha').value = now.toISOString().split('T')[0];
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('chica_hora').value = hm;
    recalculateChica();
  }

  function syncChicaPrintable() {
    recalculateChica();
    const rawF = document.getElementById('chica_fecha').value;
    document.getElementById('pc_fecha').textContent = rawF || '__ / __ / ____';
    const resp = document.getElementById('chica_responsable').value || '________________';
    document.getElementById('pc_responsable').textContent = resp;
    document.getElementById('pc_hora').textContent = document.getElementById('chica_hora').value || '____';

    document.getElementById('pc_fondo_inicial').textContent = formatCurrency(parseVal('chica_fondo_inicial'));

    // Salidas
    const pcTbody = document.getElementById('pc_tbody_salidas');
    pcTbody.innerHTML = '';
    document.querySelectorAll('.chica-salida-row').forEach(row => {
      const c = row.querySelector('.chica-concepto')?.value || '';
      const m = row.querySelector('.chica-motivo')?.value || '';
      const a = row.querySelector('.chica-autorizo')?.value || '';
      const imp = parseFloat(row.querySelector('.chica-importe')?.value) || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c}</td><td>${m}</td><td>${a}</td><td class="amount">${formatCurrency(imp)}</td>`;
      pcTbody.appendChild(tr);
    });
    document.getElementById('pc_total_salidas').textContent = formatCurrency(parseVal('chica_total_salidas'));

    // Conteo
    const denoms = [
      { id: 'chica_b_1000', qId: 'pc_b_1000_q', tId: 'pc_b_1000_tot', val: 1000 },
      { id: 'chica_b_500',  qId: 'pc_b_500_q',  tId: 'pc_b_500_tot',  val: 500 },
      { id: 'chica_b_200',  qId: 'pc_b_200_q',  tId: 'pc_b_200_tot',  val: 200 },
      { id: 'chica_b_100',  qId: 'pc_b_100_q',  tId: 'pc_b_100_tot',  val: 100 },
      { id: 'chica_b_50',   qId: 'pc_b_50_q',   tId: 'pc_b_50_tot',   val: 50 },
      { id: 'chica_b_20',   qId: 'pc_b_20_q',   tId: 'pc_b_20_tot',   val: 20 },
      { id: 'chica_m_10',   qId: 'pc_m_10_q',   tId: 'pc_m_10_tot',   val: 10 },
      { id: 'chica_m_5',    qId: 'pc_m_5_q',    tId: 'pc_m_5_tot',    val: 5 },
      { id: 'chica_m_2',    qId: 'pc_m_2_q',    tId: 'pc_m_2_tot',    val: 2 },
      { id: 'chica_m_1',    qId: 'pc_m_1_q',    tId: 'pc_m_1_tot',    val: 1 },
      { id: 'chica_m_050',  qId: 'pc_m_050_q',  tId: 'pc_m_050_tot',  val: 0.50 }
    ];
    let tc = 0;
    denoms.forEach(d => {
      const q = parseInt(document.getElementById(d.id)?.value, 10) || 0;
      tc += q * d.val;
      document.getElementById(d.qId).textContent = q > 0 ? q : '';
      document.getElementById(d.tId).textContent = formatCurrency(q * d.val);
    });
    document.getElementById('pc_total_contado').textContent = formatCurrency(tc);

    // Conciliación
    document.getElementById('pc_concil_fondo').textContent = formatCurrency(parseVal('chica_fondo_inicial'));
    document.getElementById('pc_concil_salidas').textContent = formatCurrency(parseVal('chica_total_salidas'));
    document.getElementById('pc_concil_esperado').textContent = formatCurrency(parseVal('chica_concil_esperado'));
    document.getElementById('pc_concil_contado').textContent = formatCurrency(tc);
    document.getElementById('pc_concil_diferencia').textContent = formatCurrency(parseVal('chica_concil_diferencia'));

    const res = document.querySelector('input[name="chica_resultado"]:checked')?.value || 'cuadrada';
    document.getElementById('pc_box_cuadrada').textContent = res === 'cuadrada' ? '✓' : '';
    document.getElementById('pc_box_sobrante').textContent = res === 'sobrante' ? '✓' : '';
    document.getElementById('pc_box_faltante').textContent = res === 'faltante' ? '✓' : '';
    document.getElementById('pc_explicacion').textContent = document.getElementById('chica_explicacion').value.trim() || 'Sin observaciones.';

    const valN = document.getElementById('chica_val_nombre').value || resp;
    document.getElementById('pc_val_nombre').textContent = valN;
    const fImg = document.getElementById('pc_val_firma_img');
    const fBlank = document.getElementById('pc_val_firma_blank');
    if (sigDataChica && sigPadChica) {
      fImg.src = sigPadChica.toDataURL('image/png');
      fImg.style.display = 'inline-block';
      fBlank.style.display = 'none';
    } else {
      fImg.style.display = 'none';
      fBlank.style.display = 'inline-block';
    }

    const cln = valN.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim().replace(/\s+/g, '_');
    return `Arqueo_Caja_Chica_${rawF || 'Fecha'}_${cln || 'Responsable'}.pdf`;
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

    const fecha = document.getElementById(fechaId).value;
    const resp = document.getElementById(respId).value.trim();

    if (!fecha) {
      showToast('Por favor ingrese la fecha', 'warning');
      document.getElementById(fechaId).focus();
      return;
    }
    if (!resp) {
      showToast('Por favor ingrese el nombre del responsable', 'warning');
      document.getElementById(respId).focus();
      return;
    }

    showToast(`Guardando ${isChica ? 'Caja Chica' : 'Caja Principal'} en Firebase...`, 'info');

    // 1. Guardar en Firebase
    let saveResult = null;
    let savedData = null;
    if (isChica) {
      savedData = serializeChica();
      saveResult = await TB_FIREBASE.saveArqueoCajaChica(savedData);
      logAuditMovement({
        modulo: 'Caja Chica',
        accion: 'ALTA_ARQUEO_CHICA',
        descripcion: `Cierre Arqueo Caja Chica: Fecha ${fecha} por ${resp} - Fondo Final: $${parseFloat(savedData.totalFondoFinal || 0).toFixed(2)}`,
        payload: { arqueoKey: saveResult?.key || `${fecha}_${resp.replace(/[^a-zA-Z0-9]/g, '_')}`, fecha, data: savedData }
      });
    } else {
      savedData = serializePrincipal();
      saveResult = await TB_FIREBASE.saveArqueoPrincipal(savedData);
      logAuditMovement({
        modulo: 'Arqueo Principal',
        accion: 'ALTA_ARQUEO_PRINCIPAL',
        descripcion: `Cierre Arqueo Principal: Fecha ${fecha} por ${resp} - Total Ingresos: $${parseFloat(savedData.resumenFinal?.totalIngresosDia || 0).toFixed(2)} - Diferencia: $${parseFloat(savedData.conciliacion?.diferenciaCaja || 0).toFixed(2)}`,
        payload: { arqueoKey: saveResult?.key || `${fecha}_${resp.replace(/[^a-zA-Z0-9]/g, '_')}`, fecha, data: savedData }
      });
    }

    // 2. Descargar PDF automáticamente
    showToast('Generando y descargando PDF oficial...', 'info');
    const fileName = await exportPDF(isChica);

    showToast(`✅ ¡${isChica ? 'Caja Chica' : 'Caja Principal'} guardada en Firebase y PDF descargado (${fileName})!`, 'success');

    // 3. Limpiar los campos para introducir nueva información
    if (isChica) {
      clearChicaForm();
    } else {
      clearPrincipalForm();
    }
    showToast('Campos limpios y listos para nuevo registro.', 'info');
  }

  // =========================================================================
  // 5. MÓDULO HISTORIAL
  // =========================================================================
  async function loadHistorial(filterDate = null) {
    const container = document.getElementById('history-grid-container');
    const emptyState = document.getElementById('historial-empty-state');
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--muted);">Cargando de Firebase...</div>';

    let list = {};
    if (currentHistTipo === 'principal') {
      list = await TB_FIREBASE.getArqueosList();
    } else {
      list = await TB_FIREBASE.getArqueosChicaList();
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
      const item = list[k];
      const card = document.createElement('div');
      card.className = 'history-item-card';

      const resBadgeClass = item.conciliacion?.resultado === 'cuadrada' ? 'badge-cuadrada' :
                            (item.conciliacion?.resultado === 'sobrante' ? 'badge-sobrante' : 'badge-faltante');
      const resText = item.conciliacion?.resultado === 'cuadrada' ? 'Cuadrada' :
                      (item.conciliacion?.resultado === 'sobrante' ? 'Sobrante' : 'Faltante');

      if (currentHistTipo === 'principal') {
        card.innerHTML = `
          <div class="history-card-header">
            <div>
              <div class="history-date">📅 ${item.header?.fecha || 'Sin Fecha'}</div>
              <div class="history-responsable">👤 ${item.header?.responsable || 'Sin asignar'} (${item.header?.hora || ''})</div>
            </div>
            <span class="kpi-status-badge ${resBadgeClass}">${resText}</span>
          </div>
          <div class="history-metrics">
            <div class="history-metric-box"><div class="label">Ingresos Totales</div><div class="val">${formatCurrency(item.ingresos?.totales?.granTotal || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Efectivo Contado</div><div class="val">${formatCurrency(item.conteo?.total || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Retiros Resguardo</div><div class="val">${formatCurrency(item.conciliacion?.retiros || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Diferencia</div><div class="val" style="color:${Math.abs(item.conciliacion?.diferencia || 0) < 0.01 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(item.conciliacion?.diferencia || 0)}</div></div>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="history-card-header">
            <div>
              <div class="history-date">📅 ${item.header?.fecha || 'Sin Fecha'} (Caja Chica)</div>
              <div class="history-responsable">👤 ${item.header?.responsable || 'Sin asignar'} (${item.header?.hora || ''})</div>
            </div>
            <span class="kpi-status-badge ${resBadgeClass}">${resText}</span>
          </div>
          <div class="history-metrics">
            <div class="history-metric-box"><div class="label">Fondo Inicial</div><div class="val">${formatCurrency(item.fondoInicial || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Total Salidas</div><div class="val">${formatCurrency(item.totalSalidas || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Efectivo Contado</div><div class="val">${formatCurrency(item.conteoTotal || 0)}</div></div>
            <div class="history-metric-box"><div class="label">Diferencia</div><div class="val" style="color:${Math.abs(item.conciliacion?.diferencia || 0) < 0.01 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(item.conciliacion?.diferencia || 0)}</div></div>
          </div>
        `;
      }
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
    const today = new Date().toISOString().split('T')[0];
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

  function getActiveStationMetas() {
    // Toma directamente los datos de Estaciones de Trabajo + la dimensión de Cursos (SOLO lo guardado en Firebase)
    const estacionesList = (catEstaciones && catEstaciones.length > 0) ? catEstaciones.map(e => ({
      id: e.nombre,
      nombre: e.nombre,
      icono: e.icono || '💈',
      metaQuincenal: parseFloat(e.metaQuincenal || e.meta || 0),
      clientesMeta: parseInt(e.clientesMeta || e.metaClientes || 0, 10)
    })) : [];

    // Incluir Cursos si tiene meta configurada o si existen estaciones configuradas
    if (catCursosMeta && (catCursosMeta.metaQuincenal > 0 || catCursosMeta.clientesMeta > 0 || estacionesList.length > 0)) {
      return [...estacionesList, catCursosMeta];
    }
    return estacionesList;
  }

  async function renderBalanceScoreStations() {
    const container = document.getElementById('stations-grid-container');
    if (!container) return;
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--muted);">Cargando BalanceScore y ventas acumuladas...</div>';

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
      const avgBadge = document.getElementById('bs-general-avg-badge');
      if (avgBadge) { avgBadge.textContent = '0%'; avgBadge.className = 'summary-score-badge'; }
      const totalVentasEl = document.getElementById('bs-kpi-total-ventas');
      if (totalVentasEl) totalVentasEl.textContent = '$0.00';
      const totalMetaEl = document.getElementById('bs-kpi-total-meta');
      if (totalMetaEl) totalMetaEl.textContent = '$0.00';
      const totalClientesEl = document.getElementById('bs-kpi-total-clientes');
      if (totalClientesEl) totalClientesEl.textContent = '0';
      const cumplimientoEl = document.getElementById('bs-kpi-cumplimiento');
      if (cumplimientoEl) cumplimientoEl.textContent = '0%';
      return;
    }

    container.innerHTML = '';
    let totalScore = 0;
    let granTotalVentas = 0;
    let granTotalMeta = 0;
    let granTotalClientes = 0;

    activeMetas.forEach(st => {
      const isCursos = st.id === 'Cursos' || (st.nombre || '').toLowerCase().includes('curso');

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
          const est = (v.estacion || '').toLowerCase();
          const serv = (v.servicio || '').toLowerCase();
          const matchEst = est.includes(st.id.toLowerCase()) || est.includes((st.nombre || '').toLowerCase());
          // Evitar que cursos se cuenten en estaciones de servicio estándar
          const esCurso = est.includes('academia') || est.includes('curso') || serv.includes('curso') || serv.includes('taller');
          return matchEst && !esCurso;
        });
      }

      const lograda = ventasSt.reduce((sum, v) => sum + (parseFloat(v.totalCobrado) || 0), 0);
      const clientesReales = ventasSt.length;
      const ticket = clientesReales > 0 ? (lograda / clientesReales) : 0;

      // Calcular meta proporcional al período seleccionado
      const metaQuincenalBase = parseFloat(st.metaQuincenal) || 15000;
      const metaPeriodo = Math.round(metaQuincenalBase * factorPeriodo);
      const clientesMetaPeriodo = Math.max(1, Math.round((parseInt(st.clientesMeta, 10) || 15) * factorPeriodo));

      granTotalVentas += lograda;
      granTotalMeta += metaPeriodo;
      granTotalClientes += clientesReales;

      const pct = metaPeriodo > 0 ? Math.round((lograda / metaPeriodo) * 100) : (lograda > 0 ? 100 : 0);
      const score = Math.min(100, Math.round((Math.min(100, pct) * 0.6) + 40));
      totalScore += score;

      // Barra de progreso y colores
      let barColor = '#ef4444'; // Rojo < 75%
      if (pct >= 100) barColor = '#10b981'; // Verde >= 100%
      else if (pct >= 75) barColor = '#f59e0b'; // Ámbar 75-99%

      // Avance respecto al mes completo si aplica
      let avanceMensualHtml = '';
      if (esAvanceMes) {
        const metaMensualCompleta = metaQuincenalBase * 2;
        const pctMesCompleto = Math.round((lograda / metaMensualCompleta) * 100);
        avanceMensualHtml = `
          <div style="font-size:0.72rem; color:var(--muted); margin-top:2px; display:flex; justify-content:space-between;">
            <span>Avance vs Meta Mensual ($${formatCurrency(metaMensualCompleta)}):</span>
            <strong>${pctMesCompleto}%</strong>
          </div>
        `;
      }

      const card = document.createElement('div');
      card.className = 'station-card';
      card.innerHTML = `
        <div class="station-card-header" style="background:${isCursos ? 'linear-gradient(135deg, #065f46, #047857)' : 'linear-gradient(135deg, #1e293b, #0f172a)'}">
          <div class="station-title">
            <span>${st.icono || '💈'}</span>
            <span>${st.nombre}</span>
          </div>
          <span class="station-score-badge">${score}%</span>
        </div>
        <div class="station-card-body">
          <div class="station-progress-wrap">
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; font-weight:700;">
              <span>Avance del Período: ${pct}%</span>
              <span>${formatCurrency(lograda)} / ${formatCurrency(metaPeriodo)}</span>
            </div>
            <div class="progress-bar-bg" style="margin-top:4px;">
              <div class="progress-bar-fill" style="width:${Math.min(100, pct)}%; background:${barColor}"></div>
            </div>
            ${avanceMensualHtml}
            ${pct >= 100 ? '<div style="margin-top:4px;"><span class="badge-meta-superada">🏆 ¡Meta del Período Superada!</span></div>' : ''}
          </div>

          <div class="station-metrics-row">
            <div class="history-metric-box">
              <div class="label">${isCursos ? 'Alumnas Reales' : 'Clientes Reales'}</div>
              <div class="val">${clientesReales} / Meta: ${clientesMetaPeriodo}</div>
            </div>
            <div class="history-metric-box">
              <div class="label">Ticket Promedio</div>
              <div class="val">${formatCurrency(ticket)}</div>
            </div>
          </div>

          <div class="checklist-group">
            <label class="checklist-item"><input type="checkbox" checked> ${isCursos ? 'Inscripciones y temarios vigentes' : 'Limpieza y desinfección de estación'}</label>
            <label class="checklist-item"><input type="checkbox" checked> ${isCursos ? 'Asistencia y seguimiento académico' : 'Puntualidad en citas programadas'}</label>
            <label class="checklist-item"><input type="checkbox" checked> Experiencia Total Beauty de calidad</label>
            <label class="checklist-item"><input type="checkbox" checked> ${isCursos ? 'Venta de kits y cursos avanzados' : 'Sugerencia de producto y venta cruzada'}</label>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Actualizar KPIs de resumen global
    const overallScore = activeMetas.length > 0 ? Math.round(totalScore / activeMetas.length) : 0;
    const pctGlobal = granTotalMeta > 0 ? Math.round((granTotalVentas / granTotalMeta) * 100) : 0;

    const bBadge = document.getElementById('bs-overall-badge');
    if (bBadge) bBadge.textContent = `Score Salón & Cursos: ${overallScore}%`;

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
  // 7. REPORTE DIARIO DE INGRESOS (INTERCONECTADO)
  // =========================================================================
  async function renderIngresosReport() {
    const fIn = document.getElementById('rep_ingresos_fecha');
    if (!fIn.value) fIn.value = new Date().toISOString().split('T')[0];
    const fecha = fIn.value;

    const ventas = await TB_FIREBASE.getVentasByFecha(fecha);

    let totEfec = 0, totTarj = 0, totTransf = 0;
    let totSalon = 0, totAcad = 0, totRetail = 0;

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const mp = (v.metodoPago || '').toLowerCase();
      if (mp.includes('tarj')) totTarj += imp;
      else if (mp.includes('transf')) totTransf += imp;
      else totEfec += imp;

      const est = (v.estacion || '').toLowerCase();
      const serv = (v.servicio || '').toLowerCase();
      if (est.includes('academia') || serv.includes('curso')) totAcad += imp;
      else if (est.includes('retail') || serv.includes('producto')) totRetail += imp;
      else totSalon += imp;
    });

    const total = totEfec + totTarj + totTransf;

    document.getElementById('kpi-ingreso-total').textContent = formatCurrency(total);
    document.getElementById('kpi-ingreso-cumplimiento').textContent = total > 0 ? `${Math.round((total / 5000) * 100)}%` : '0%';

    let pred = 'Efectivo';
    if (totTarj > totEfec && totTarj > totTransf) pred = 'Tarjeta';
    if (totTransf > totEfec && totTransf > totTarj) pred = 'Transferencia';
    document.getElementById('kpi-ingreso-metodo').textContent = pred;

    document.getElementById('rep_efectivo_val').textContent = formatCurrency(totEfec);
    document.getElementById('rep_efectivo_pct').textContent = total > 0 ? `${Math.round((totEfec / total) * 100)}%` : '0%';
    document.getElementById('rep_tarjeta_val').textContent = formatCurrency(totTarj);
    document.getElementById('rep_tarjeta_pct').textContent = total > 0 ? `${Math.round((totTarj / total) * 100)}%` : '0%';
    document.getElementById('rep_transf_val').textContent = formatCurrency(totTransf);
    document.getElementById('rep_transf_pct').textContent = total > 0 ? `${Math.round((totTransf / total) * 100)}%` : '0%';
    document.getElementById('rep_metodos_total').textContent = formatCurrency(total);

    document.getElementById('rep_salon_val').textContent = formatCurrency(totSalon);
    document.getElementById('rep_salon_pct').textContent = total > 0 ? `${Math.round((totSalon / total) * 100)}%` : '0%';
    document.getElementById('rep_academia_val').textContent = formatCurrency(totAcad);
    document.getElementById('rep_academia_pct').textContent = total > 0 ? `${Math.round((totAcad / total) * 100)}%` : '0%';
    document.getElementById('rep_retail_val').textContent = formatCurrency(totRetail);
    document.getElementById('rep_retail_pct').textContent = total > 0 ? `${Math.round((totRetail / total) * 100)}%` : '0%';
    document.getElementById('rep_unidades_total').textContent = formatCurrency(total);
  }

  // =========================================================================
  // 8. INTERESADAS Y CIERRES (3 OPCIONES REQUERIDAS)
  // =========================================================================
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

    if (currentLeadOption === 2) renderLeadsDirectory();
    if (currentLeadOption === 3) renderLeadsBalanceScore();
  }

  function loadInteresadasView() {
    const fReg = document.getElementById('lead_reg_fecha');
    if (fReg && !fReg.value) fReg.value = new Date().toISOString().split('T')[0];
    switchLeadOption(currentLeadOption);
  }

  // Opción 2: Directorio de Seguimiento por Llamada o WhatsApp
  async function renderLeadsDirectory() {
    const tbody = document.getElementById('tbody-leads-seguimiento');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:18px; color:var(--muted);">Cargando prospectos...</td></tr>';

    const leads = await TB_FIREBASE.getLeadsAll();
    const filtroTipif = document.getElementById('filtro_lead_tipif')?.value || 'TODAS';
    const filtroUnidad = document.getElementById('filtro_lead_unidad')?.value || 'TODAS';
    const query = (document.getElementById('buscador_leads')?.value || '').toLowerCase().trim();

    const filtered = leads.filter(l => {
      if (filtroTipif !== 'TODAS' && l.tipificacion !== filtroTipif) return false;
      if (filtroUnidad !== 'TODAS' && l.unidad !== filtroUnidad) return false;
      if (query) {
        const nom = (l.nombre || '').toLowerCase();
        const tel = (l.telefono || '').toLowerCase();
        const serv = (l.servicio || '').toLowerCase();
        if (!nom.includes(query) && !tel.includes(query) && !serv.includes(query)) return false;
      }
      return true;
    });

    const badge = document.getElementById('lead-counter-badge');
    if (badge) badge.textContent = `${filtered.length} Registros`;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-empty-notice">
            <span>📭</span>
            No se encontraron interesadas con los filtros seleccionados. Use la Opción 1 para agregar nuevas prospectas.
          </td>
        </tr>
      `;
      return;
    }

    filtered.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).forEach(l => {
      const tr = document.createElement('tr');
      const cleanTel = (l.telefono || '').replace(/\D/g, '');
      const waMsg = encodeURIComponent(`Hola ${l.nombre || ''}, te saludamos de Total Beauty Salón y Academia ✨ Respecto a tu interés en ${l.servicio || 'nuestros servicios'}, ¿te gustaría agendar tu cita o resolver alguna duda?`);
      const waUrl = `https://wa.me/52${cleanTel}?text=${waMsg}`;

      tr.innerHTML = `
        <td><span style="font-size:0.8rem; color:var(--muted);">${l.fecha || 'Hoy'}</span></td>
        <td><strong>${l.nombre || 'Prospecto'}</strong></td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <a href="${waUrl}" target="_blank" class="btn-whatsapp" title="Enviar WhatsApp a ${l.telefono}">
              <span>💬</span> WhatsApp
            </a>
            <a href="tel:${cleanTel}" class="btn-call" title="Llamar">
              <span>📞</span>
            </a>
          </div>
        </td>
        <td>
          <div style="font-weight:600; color:var(--dark); font-size:0.85rem;">${l.servicio || '-'}</div>
          <span style="font-size:0.75rem; color:var(--muted);">${l.unidad || 'Salón'}</span>
        </td>
        <td><span style="font-size:0.8rem; color:var(--slate);">${l.canal || 'WhatsApp'}</span></td>
        <td>
          <select class="input-text lead-tipif-select" data-id="${l.id}" style="padding:4px 8px; font-size:0.82rem; font-weight:600;">
            <option value="Interesada" ${l.tipificacion === 'Interesada' ? 'selected' : ''}>🔵 Interesada</option>
            <option value="Solo pregunta" ${l.tipificacion === 'Solo pregunta' ? 'selected' : ''}>🟡 Solo pregunta</option>
            <option value="En seguimiento" ${l.tipificacion === 'En seguimiento' ? 'selected' : ''}>🟣 En seguimiento</option>
            <option value="Cierre" ${l.tipificacion === 'Cierre' ? 'selected' : ''}>🟢 Cierre (Agendada/Pagó)</option>
            <option value="No interesada" ${l.tipificacion === 'No interesada' ? 'selected' : ''}>⚪ No interesada</option>
          </select>
        </td>
        <td><span style="font-size:0.8rem; color:var(--muted);">${l.notas ? l.notas.substring(0, 45) + '...' : 'Sin notas'}</span></td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-lead" data-id="${l.id}" title="Eliminar registro">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Opción 3: BalanceScore de Conversión Comercial en Tiempo Real
  async function renderLeadsBalanceScore() {
    const leads = await TB_FIREBASE.getLeadsAll();

    const total = leads.length;
    const preguntan = leads.filter(l => l.tipificacion === 'Solo pregunta').length;
    const seguimiento = leads.filter(l => l.tipificacion === 'En seguimiento').length;
    const cierres = leads.filter(l => l.tipificacion === 'Cierre').length;

    const tasa = total > 0 ? Math.round((cierres / total) * 100) : 0;

    document.getElementById('kpi-bs-leads-total').textContent = total;
    document.getElementById('kpi-bs-leads-preguntan').textContent = preguntan;
    document.getElementById('kpi-bs-leads-seguimiento').textContent = seguimiento;
    document.getElementById('kpi-bs-leads-cierres').textContent = cierres;

    document.getElementById('visual-bs-interesadas').textContent = total;
    document.getElementById('visual-bs-preguntan').textContent = preguntan;
    document.getElementById('visual-bs-seguimiento').textContent = seguimiento;
    document.getElementById('visual-bs-cierres').textContent = cierres;
    document.getElementById('visual-bs-tasa').textContent = `${tasa}%`;

    // Comparativa Salón vs Academia
    const salonLeads = leads.filter(l => (l.unidad || '').includes('Salón'));
    const salonCierres = salonLeads.filter(l => l.tipificacion === 'Cierre').length;
    const salonTasa = salonLeads.length > 0 ? Math.round((salonCierres / salonLeads.length) * 100) : 0;

    const acadLeads = leads.filter(l => (l.unidad || '').includes('Academia'));
    const acadCierres = acadLeads.filter(l => l.tipificacion === 'Cierre').length;
    const acadTasa = acadLeads.length > 0 ? Math.round((acadCierres / acadLeads.length) * 100) : 0;

    document.getElementById('bs-salon-leads').textContent = salonLeads.length;
    document.getElementById('bs-salon-cierres').textContent = salonCierres;
    document.getElementById('bs-salon-tasa').textContent = `${salonTasa}%`;

    document.getElementById('bs-academia-leads').textContent = acadLeads.length;
    document.getElementById('bs-academia-cierres').textContent = acadCierres;
    document.getElementById('bs-academia-tasa').textContent = `${acadTasa}%`;

    // Desglose por Canal
    const canalCounts = {};
    leads.forEach(l => {
      const c = l.canal || 'WhatsApp';
      if (!canalCounts[c]) canalCounts[c] = { total: 0, cierres: 0 };
      canalCounts[c].total += 1;
      if (l.tipificacion === 'Cierre') canalCounts[c].cierres += 1;
    });

    const tbodyCanal = document.getElementById('tbody-bs-canales');
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
          <td><strong>${c}</strong></td>
          <td class="text-right">${inf.total}</td>
          <td class="text-right" style="font-weight:700; color:var(--success);">${inf.cierres}</td>
          <td class="text-right" style="font-weight:700;">${pct}%</td>
        `;
        tbodyCanal.appendChild(tr);
      });
    }
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

    ['servicios', 'estaciones', 'especialistas', 'metas'].forEach(k => {
      const el = document.getElementById(`config-subview-${k}`);
      if (el) el.style.display = (k === tabKey) ? 'block' : 'none';
    });
    if (tabKey === 'metas') renderCatMetasTable();
  }

  async function loadCatalogsData() {
    // CARGA ESTRICTA DESDE FIREBASE: Sin inyección de datos de prueba
    catEstaciones = await TB_FIREBASE.getCatalogo('estaciones');
    catEspecialistas = await TB_FIREBASE.getCatalogo('especialistas');
    catServicios = await TB_FIREBASE.getCatalogo('servicios');
    
    // Normalizar estaciones para asegurar metaQuincenal y clientesMeta
    catEstaciones.forEach(est => {
      if (est.metaQuincenal === undefined) est.metaQuincenal = parseFloat(est.meta) || 0;
      if (est.clientesMeta === undefined) est.clientesMeta = parseInt(est.metaClientes, 10) || 0;
    });

    const cursosStored = await TB_FIREBASE.getCatalogo('metas_cursos');
    if (cursosStored && cursosStored.length > 0 && cursosStored[0]) {
      catCursosMeta = {
        id: 'Cursos',
        nombre: 'Cursos & Talleres Academia',
        icono: '🎓',
        isCurso: true,
        metaQuincenal: parseFloat(cursosStored[0].metaQuincenal || 0),
        clientesMeta: parseInt(cursosStored[0].clientesMeta || 0, 10)
      };
    } else {
      catCursosMeta = {
        id: 'Cursos',
        nombre: 'Cursos & Talleres Academia',
        icono: '🎓',
        metaQuincenal: 0,
        clientesMeta: 0,
        isCurso: true
      };
    }

    populateSalesDropdowns();
    populateConfigStationDropdowns();
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

  function populateConfigStationDropdowns() {
    const s1 = document.getElementById('cfg_serv_estacion');
    const s2 = document.getElementById('cfg_esp_estacion');
    [s1, s2].forEach(sel => {
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
    if (badgeCount) badgeCount.textContent = `${allMetas.length} Estaciones y Cursos`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (allMetas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty-notice"><span>🎯</span>No hay estaciones configuradas en la base de datos. Agregue estaciones en la pestaña <strong>2. Estaciones de Trabajo</strong> para asignar metas.</td></tr>';
      return;
    }
    allMetas.forEach(m => {
      const tr = document.createElement('tr');
      const metaQ = parseFloat(m.metaQuincenal) || 0;
      const metaM = metaQ * 2;
      const metaD = Math.round(metaQ / 15);
      const isCurso = m.id === 'Cursos' || (m.nombre || '').toLowerCase().includes('curso');

      tr.innerHTML = `
        <td style="font-size:1.25rem; text-align:center;">${m.icono || '💈'}</td>
        <td>
          <strong>${m.nombre}</strong>
          ${isCurso ? '<span class="cat-badge-tipo cat-badge-curso" style="margin-left:6px;">Academia</span>' : '<span style="font-size:0.75rem; color:var(--muted); margin-left:6px;">(Estación de Trabajo)</span>'}
        </td>
        <td>
          <div class="currency-input-wrap">
            <span class="currency-prefix">$</span>
            <input type="number" step="100" min="0" class="input-currency input-meta-quincenal" data-id="${m.id}" value="${metaQ}">
          </div>
        </td>
        <td>
          <input type="number" min="1" class="table-input-meta input-meta-clientes" data-id="${m.id}" value="${m.clientesMeta || 15}">
        </td>
        <td class="text-right" style="font-weight:700; color:var(--primary);" id="meta-mensual-${m.id}">$${metaM.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td class="text-right" style="font-weight:600; color:var(--dark);" id="meta-diaria-${m.id}">$${metaD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      `;
      tbody.appendChild(tr);
    });

    // Escuchar cambios en los inputs para actualizar los cálculos en vivo y auto-guardar automáticamente
    tbody.querySelectorAll('.input-meta-quincenal').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        const val = parseFloat(e.target.value) || 0;
        const elM = document.getElementById(`meta-mensual-${id}`);
        const elD = document.getElementById(`meta-diaria-${id}`);
        if (elM) elM.textContent = `$${(val * 2).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        if (elD) elD.textContent = `$${Math.round(val / 15).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

        // Actualizar directamente en la estación o en Cursos
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
        const val = parseInt(e.target.value, 10) || 15;
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
    if (badge) badge.textContent = `${catServicios.length} Registros`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (catServicios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty-notice"><span>✨</span>No hay servicios configurados. Agregue uno arriba.</td></tr>';
      return;
    }

    catServicios.forEach(s => {
      const tr = document.createElement('tr');
      let badgeClass = 'cat-badge-servicio';
      if (s.tipo === 'Producto') badgeClass = 'cat-badge-producto';
      if (s.tipo === 'Curso') badgeClass = 'cat-badge-curso';

      tr.innerHTML = `
        <td><strong>${s.nombre}</strong></td>
        <td><span class="cat-badge-tipo ${badgeClass}">${s.tipo}</span></td>
        <td><span style="font-weight:600; color:var(--primary);">${s.estacion || 'General'}</span></td>
        <td class="text-right" style="font-weight:700;">$${parseFloat(s.precio || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-cfg-serv" data-id="${s.id}" title="Eliminar servicio">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderCatEstacionesTable() {
    const tbody = document.getElementById('tbody-cat-estaciones');
    const badge = document.getElementById('badge-total-estaciones');
    if (badge) badge.textContent = `${catEstaciones.length} Estaciones`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (catEstaciones.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty-notice"><span>💈</span>No hay estaciones configuradas. Agregue una arriba.</td></tr>';
      return;
    }

    catEstaciones.forEach(est => {
      const tr = document.createElement('tr');
      const metaQ = parseFloat(est.metaQuincenal || est.meta || 15000);
      const clientesQ = parseInt(est.clientesMeta || est.metaClientes || 45, 10);
      const metaD = Math.round(metaQ / 15);

      tr.innerHTML = `
        <td style="font-size:1.2rem; text-align:center;">${est.icono || '✨'}</td>
        <td><strong>${est.nombre}</strong></td>
        <td class="text-right" style="font-weight:700;">$${metaQ.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">${clientesQ} clientes</td>
        <td class="text-right" style="color:var(--muted);">$${metaD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-cfg-est" data-id="${est.id}" title="Eliminar estación">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderCatEspecialistasTable() {
    const tbody = document.getElementById('tbody-cat-especialistas');
    const badge = document.getElementById('badge-total-especialistas');
    if (badge) badge.textContent = `${catEspecialistas.length} Especialistas`;
    if (!tbody) return;

    tbody.innerHTML = '';
    if (catEspecialistas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty-notice"><span>👩‍🎨</span>No hay especialistas configurados.</td></tr>';
      return;
    }

    catEspecialistas.forEach(esp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esp.nombre}</strong></td>
        <td><span style="font-weight:600; color:var(--primary);">${esp.estacion || 'General'}</span></td>
        <td><span style="font-family:monospace; font-size:0.82rem;">${esp.telefono || 'Sin teléfono'}</span></td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-cfg-esp" data-id="${esp.id}" title="Eliminar especialista">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 11. INICIALIZACIÓN Y EVENT LISTENERS
  // =========================================================================
  // =========================================================================
  // CONTROL DE CAJA, FONDO INICIAL Y ENTREGAS DE DINERO (CON FOTOGRAFÍA)
  // =========================================================================
  async function loadControlCajaData() {
    try {
      controlCajaData = await TB_FIREBASE.getControlCaja();
      
      // Si el fondo base no está fijado, consultar el último arqueo cerrado
      if (!controlCajaData.fondoBase || controlCajaData.fondoBase === 0) {
        const list = await TB_FIREBASE.getArqueosList();
        const keys = Object.keys(list).sort().reverse();
        if (keys.length > 0) {
          const lastArqueo = list[keys[0]];
          const dest = lastArqueo.validacion?.destinoEfectivo;
          if (dest === 'se_queda_en_caja' || !dest) {
            controlCajaData.fondoBase = parseFloat(lastArqueo.conteo?.total || lastArqueo.conciliacion?.contado || 0) || 0;
          }
        }
      }

      renderControlCajaFondo();
    } catch (e) {
      console.warn('Error en loadControlCajaData:', e);
    }
  }

  function renderControlCajaFondo() {
    const today = (document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0]);
    const allEntregas = Object.values(controlCajaData.entregas || {});
    const entregasHoy = allEntregas.filter(e => e.fecha === today);

    const totalEntregadoHoy = entregasHoy.reduce((acc, curr) => acc + (parseFloat(curr.cantidad) || 0), 0);
    const fondoBase = parseFloat(controlCajaData.fondoBase || 0);
    const fondoDisponible = Math.max(0, fondoBase - totalEntregadoHoy);

    const fInput = document.getElementById('f_inicial_caja');
    if (fInput) fInput.value = fondoDisponible.toFixed(2);

    const lblBase = document.getElementById('lbl-fondo-base');
    const lblEntr = document.getElementById('lbl-total-entregado');
    const lblDisp = document.getElementById('lbl-fondo-disponible');
    const countBadge = document.getElementById('count-entregas-hoy');

    if (lblBase) lblBase.textContent = formatCurrency(fondoBase);
    if (lblEntr) lblEntr.textContent = formatCurrency(totalEntregadoHoy);
    if (lblDisp) lblDisp.textContent = formatCurrency(fondoDisponible);
    if (countBadge) countBadge.textContent = String(entregasHoy.length);

    recalculatePrincipal();
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

  async function logAuditMovement({ modulo, accion, descripcion, payload, reversible = true, meta = {} }) {
    try {
      const userEmail = TB_FIREBASE.getCurrentUser()?.email || 'Usuario';
      const logEntry = {
        fechaHora: new Date().toISOString(),
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
      const pad = n => String(n).padStart(2, '0');
      const dd = pad(d.getDate());
      const mm = pad(d.getMonth() + 1);
      const yyyy = d.getFullYear();
      const hh = pad(d.getHours());
      const min = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    } catch (e) {
      return isoString;
    }
  }

  function getModuleBadgeClass(modulo) {
    switch (modulo) {
      case 'Ventas': return 'audit-badge-ventas';
      case 'Arqueo Principal':
      case 'Caja Chica': return 'audit-badge-caja';
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
          await TB_FIREBASE.deleteArqueo('principal', payload.arqueoKey);
          loadHistorial();
        }
        break;

      case 'ALTA_ARQUEO_CHICA':
        if (payload.arqueoKey) {
          await TB_FIREBASE.deleteArqueo('chica', payload.arqueoKey);
          loadHistorial();
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
    // Configurar Canvas de Firmas
    sigCtxPrincipal = setupSignaturePad(sigPadPrincipal, () => { sigDataPrincipal = true; });
    sigCtxChica = setupSignaturePad(sigPadChica, () => { sigDataChica = true; });

    document.getElementById('btn-clear-signature')?.addEventListener('click', () => {
      if (sigCtxPrincipal && sigPadPrincipal) {
        sigCtxPrincipal.clearRect(0, 0, sigPadPrincipal.width, sigPadPrincipal.height);
        sigDataPrincipal = false;
      }
    });

    document.getElementById('btn-clear-chica-sig')?.addEventListener('click', () => {
      if (sigCtxChica && sigPadChica) {
        sigCtxChica.clearRect(0, 0, sigPadChica.width, sigPadChica.height);
        sigDataChica = false;
      }
    });

    // Menú Lateral
    document.querySelectorAll('.menu-item-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const mod = link.dataset.module;
        if (mod) switchModule(mod);
      });
    });

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('app-sidebar')?.classList.toggle('open');
    });

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

    document.querySelectorAll('.denom-btn-chica').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.denomination-row');
        const input = row.querySelector('.chica-denom-input');
        if (!input) return;
        let v = parseInt(input.value, 10) || 0;
        if (btn.dataset.action === 'inc') v += 1;
        if (btn.dataset.action === 'dec') v = Math.max(0, v - 1);
        input.value = v;
        recalculateChica();
      });
    });

    // Filas dinámicas en Caja Chica y Anticipos
    document.getElementById('btn-add-chica-salida')?.addEventListener('click', () => {
      const tbody = document.getElementById('tbody-chica-salidas');
      const tr = document.createElement('tr');
      tr.className = 'chica-salida-row';
      tr.innerHTML = `
        <td><input type="text" class="input-text chica-concepto" placeholder="Concepto..."></td>
        <td><input type="text" class="input-text chica-motivo" placeholder="Descripción..."></td>
        <td><input type="text" class="input-text chica-autorizo" placeholder="Nombre..."></td>
        <td><div class="currency-input-wrap"><span class="currency-prefix">$</span><input type="number" step="0.01" min="0" class="input-currency chica-calc-trigger chica-importe" value="0.00"></div></td>
        <td class="text-center"><button type="button" class="btn btn-outline-danger btn-sm btn-del-row">✕</button></td>
      `;
      tbody.appendChild(tr);
      recalculateChica();
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

    // Guardado con autenticación obligatoria (contraseña de la cuenta)
    document.getElementById('btn-save-firebase-bottom')?.addEventListener('click', () => {
      openAuthConfirmModal(false);
    });

    document.getElementById('btn-save-firebase-chica')?.addEventListener('click', () => {
      openAuthConfirmModal(true);
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

    // Control de destino de efectivo
    document.getElementById('val_destino_efectivo')?.addEventListener('change', (e) => {
      const wrap = document.getElementById('wrap_efectivo_otro_lugar');
      if (wrap) wrap.style.display = (e.target.value === 'se_resguarda_otro') ? 'block' : 'none';
    });

    // Control de Caja: Entrega de Dinero con Fotografía
    document.getElementById('btn-open-entrega-dinero')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-entrega-dinero');
      const form = document.getElementById('form-entrega-dinero');
      const prevWrap = document.getElementById('ent_preview_wrap');
      if (form) form.reset();
      if (prevWrap) prevWrap.style.display = 'none';
      fotoEntregaBase64 = null;
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
        showToast('Complete todos los campos obligatorios (*)', 'warning');
        return;
      }

      if (!fotoEntregaBase64) {
        showToast('Es obligatorio tomar o subir la fotografía de recepción del dinero', 'warning');
        return;
      }

      showToast('Guardando entrega de dinero...', 'info');
      const curUser = TB_FIREBASE.getCurrentUser();
      const now = new Date();
      const entrega = {
        id: `ent_${Date.now()}`,
        fechaHora: now.toISOString(),
        fecha: now.toISOString().split('T')[0],
        hora: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        recibe,
        cantidad,
        concepto,
        fotoBase64: fotoEntregaBase64,
        registradoPor: curUser?.email || 'Usuario'
      };

      await TB_FIREBASE.saveEntregaDinero(entrega);
      logAuditMovement({
        modulo: 'Arqueo Principal',
        accion: 'ENTREGA_DINERO',
        descripcion: `Entrega de dinero en efectivo: $${cantidad.toFixed(2)} a "${recibe}" por "${concepto}" (Con fotografía)`,
        payload: { entrega }
      });

      document.getElementById('modal-entrega-dinero').style.display = 'none';
      showToast(`✅ Entrega de $${cantidad.toFixed(2)} registrada y descontada de caja`, 'success');
      await loadControlCajaData();
    });

    // Ver entregas de hoy y lightbox de fotos
    document.getElementById('btn-ver-entregas-hoy')?.addEventListener('click', () => {
      const today = (document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0]);
      const allEntregas = Object.values(controlCajaData.entregas || {});
      const entregasHoy = allEntregas.filter(e => e.fecha === today);
      const tbody = document.getElementById('tbody-entregas-hoy');

      if (tbody) {
        tbody.innerHTML = '';
        if (entregasHoy.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--muted);">No hay entregas registradas hoy.</td></tr>';
        } else {
          entregasHoy.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><span style="font-family:monospace; font-weight:600;">${item.hora || '--:--'}</span></td>
              <td><strong>${item.recibe}</strong></td>
              <td>${item.concepto}</td>
              <td class="text-right"><strong style="color:#b91c1c;">$${parseFloat(item.cantidad).toFixed(2)}</strong></td>
              <td class="text-center">
                ${item.fotoBase64 ? `<img src="${item.fotoBase64}" class="btn-thumb-foto" data-id="${item.id}" title="Ver fotografía ampliada">` : '--'}
              </td>
              <td class="text-center">
                <button type="button" class="btn btn-outline-danger btn-sm btn-del-entrega" data-id="${item.id}" title="Eliminar registro">✕</button>
              </td>
            `;
            tbody.appendChild(tr);
          });
        }
      }

      document.getElementById('modal-lista-entregas').style.display = 'flex';
    });

    document.getElementById('btn-close-lista-entregas')?.addEventListener('click', () => {
      document.getElementById('modal-lista-entregas').style.display = 'none';
    });

    // Clic en thumbnail para lightbox de foto
    document.addEventListener('click', (e) => {
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
        if (confirm('¿Está seguro de eliminar este registro de entrega de dinero? El importe volverá al fondo disponible de caja.')) {
          TB_FIREBASE.deleteEntregaDinero(id).then(async () => {
            await loadControlCajaData();
            document.getElementById('btn-ver-entregas-hoy')?.click();
            showToast('Entrega eliminada', 'info');
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

    // -----------------------------------------------------------------------
    // EVENTOS: REGISTRO DIARIO DE VENTAS
    // -----------------------------------------------------------------------
    // Al seleccionar un servicio: autocompletar estación y precio sugerido
    document.getElementById('venta_servicio')?.addEventListener('change', (e) => {
      const selected = e.target.selectedOptions[0];
      if (selected) {
        const est = selected.dataset.estacion;
        const prc = selected.dataset.precio;
        if (est) {
          const estEl = document.getElementById('venta_estacion');
          if (estEl) estEl.value = est;
        }
        if (prc && parseFloat(prc) > 0) {
          const totEl = document.getElementById('venta_total');
          if (totEl) totEl.value = parseFloat(prc).toFixed(2);
        }
      }
    });

    // Enlaces directos a configuración
    document.querySelectorAll('.btn-goto-config').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.configTab || 'servicios';
        switchModule('configuracion');
        switchConfigTab(tab);
      });
    });

    document.getElementById('form-nueva-venta')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fecha = document.getElementById('venta_fecha').value;
      const telefono = document.getElementById('venta_telefono').value.trim(); // Opcional
      const clienta = document.getElementById('venta_clienta').value.trim();
      const servicio = document.getElementById('venta_servicio').value;
      const estacion = document.getElementById('venta_estacion').value;
      const especialista = document.getElementById('venta_especialista').value;
      const metodoPago = document.getElementById('venta_metodo_pago').value;
      const totalCobrado = parseFloat(document.getElementById('venta_total').value) || 0;
      const statusPago = document.getElementById('venta_status_pago').value;
      const notas = document.getElementById('venta_notas').value.trim();

      // Teléfono YA NO es obligatorio (los obligatorios son fecha, servicio, estación, especialista, método de pago, total, status)
      if (!fecha || !servicio || !estacion || !especialista || !metodoPago || isNaN(totalCobrado) || !statusPago) {
        showToast('Por favor llene todos los campos obligatorios marcados con *', 'warning');
        return;
      }

      const venta = {
        fecha,
        telefono,
        clienta,
        servicio,
        estacion,
        especialista,
        metodoPago,
        totalCobrado,
        statusPago,
        notas,
        createdAt: new Date().toISOString()
      };

      await TB_FIREBASE.saveVenta(venta);
      showToast(`✅ Venta de ${formatCurrency(totalCobrado)} guardada en Firebase`, 'success');

      logAuditMovement({
        modulo: 'Ventas',
        accion: 'ALTA_VENTA',
        descripcion: `Venta cobrada: ${venta.servicio} (${venta.estacion}) por $${totalCobrado.toFixed(2)} - Clienta: ${venta.clienta || 'Público Mostrador'} - Método: ${venta.metodoPago}`,
        payload: { fecha: venta.fecha, id: venta.id, venta }
      });

      // Limpiar formulario excepto la fecha
      document.getElementById('venta_telefono').value = '';
      document.getElementById('venta_clienta').value = '';
      document.getElementById('venta_servicio').value = '';
      document.getElementById('venta_estacion').value = '';
      document.getElementById('venta_especialista').value = '';
      document.getElementById('venta_total').value = '';
      document.getElementById('venta_notas').value = '';

      renderVentas(fecha);

      // Si la fecha coincide con la caja principal activa, actualizar ingresos
      if (fecha === document.getElementById('header_fecha')?.value) {
        syncVentasToCajaPrincipal(fecha, false);
      }
      renderCampanaActiva();
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

    // Eliminar ítems de catálogo
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-cfg-serv')) {
        const id = e.target.dataset.id;
        if (confirm('¿Está seguro de eliminar este servicio del catálogo?')) {
          const itemTarget = catServicios.find(s => s.id === id);
          catServicios = catServicios.filter(s => s.id !== id);
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
          showToast('Servicio eliminado', 'info');

          logAuditMovement({
            modulo: 'Configuración General',
            accion: 'BAJA_SERVICIO',
            descripcion: `Eliminación de servicio: "${itemTarget?.nombre || id}" (${itemTarget?.estacion || 'General'})`,
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
    });

    document.getElementById('btn-ventas-hoy')?.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('ventas_filtro_fecha').value = today;
      renderVentas(today);
    });

    document.getElementById('btn-refresh-ventas')?.addEventListener('click', () => {
      const fecha = document.getElementById('ventas_filtro_fecha')?.value || new Date().toISOString().split('T')[0];
      renderVentas(fecha);
      showToast('Ventas recargadas desde Firebase', 'info');
    });

    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-venta')) {
        const id = e.target.dataset.id;
        const fecha = e.target.dataset.fecha;
        if (confirm('¿Está seguro de eliminar esta venta?')) {
          const allVentasDia = await TB_FIREBASE.getVentasByFecha(fecha);
          const ventaBackup = allVentasDia ? allVentasDia[id] : null;
          await TB_FIREBASE.deleteVenta(fecha, id);
          renderVentas(fecha);
          if (fecha === document.getElementById('header_fecha')?.value) {
            syncVentasToCajaPrincipal(fecha, false);
          }
          showToast('Venta eliminada', 'info');

          logAuditMovement({
            modulo: 'Ventas',
            accion: 'BAJA_VENTA',
            descripcion: `Eliminación de venta: ${ventaBackup?.servicio || id} por $${parseFloat(ventaBackup?.totalCobrado || 0).toFixed(2)} (Fecha: ${fecha})`,
            payload: { fecha, id, venta: ventaBackup }
          });
        }
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

    // Formulario Opción 1: Nuevo Lead
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
          { fechaHora: new Date().toISOString(), accion: 'Contacto inicial', tipificacion }
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
      document.getElementById('lead_reg_fecha').value = new Date().toISOString().split('T')[0];

      // Cambiar a la Opción 2 para verla en la lista
      switchLeadOption(2);
    });

    // Filtros de la Opción 2
    document.getElementById('filtro_lead_tipif')?.addEventListener('change', renderLeadsDirectory);
    document.getElementById('filtro_lead_unidad')?.addEventListener('change', renderLeadsDirectory);
    document.getElementById('buscador_leads')?.addEventListener('input', renderLeadsDirectory);
    document.getElementById('btn-refresh-leads')?.addEventListener('click', () => {
      renderLeadsDirectory();
      showToast('Directorio de leads recargado', 'info');
    });

    // Cambio dinámico de tipificación en la tabla de seguimiento
    document.addEventListener('change', async (e) => {
      if (e.target.matches('.lead-tipif-select')) {
        const id = e.target.dataset.id;
        const newTipif = e.target.value;
        const localLeads = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');
        const leadBackup = localLeads[id] ? JSON.parse(JSON.stringify(localLeads[id])) : null;
        await TB_FIREBASE.updateLeadSeguimiento(id, { accion: 'Actualización en lista' }, newTipif);
        showToast(`Tipificación actualizada a: ${newTipif}`, 'success');

        logAuditMovement({
          modulo: 'Interesadas',
          accion: 'UPDATE_LEAD',
          descripcion: `Actualización de estatus de prospecto "${leadBackup?.nombre || id}" a: ${newTipif}`,
          payload: { id, leadBackup }
        });
      }
    });

    // Eliminar lead
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-lead')) {
        const id = e.target.dataset.id;
        if (confirm('¿Eliminar prospecto del directorio?')) {
          const localLeads = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');
          const leadBackup = localLeads[id];
          await TB_FIREBASE.deleteLead(id);
          renderLeadsDirectory();
          showToast('Registro eliminado', 'info');

          logAuditMovement({
            modulo: 'Interesadas',
            accion: 'BAJA_LEAD',
            descripcion: `Eliminación de prospecto: "${leadBackup?.nombre || id}" (${leadBackup?.servicio || 'General'})`,
            payload: { id, leadBackup }
          });
        }
      }
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
      document.getElementById('ev_fecha').value = new Date().toISOString().split('T')[0];
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

    // Botón Hoy en BalanceScore
    document.getElementById('btn-bs-dia-hoy')?.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
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


    document.getElementById('rep_ingresos_fecha')?.addEventListener('change', () => {
      renderIngresosReport();
    });

    document.getElementById('btn-sync-ingresos-arqueo')?.addEventListener('click', () => {
      renderIngresosReport();
      showToast('Reporte sincronizado con ventas del día', 'success');
    });

    document.getElementById('btn-save-ingresos')?.addEventListener('click', async () => {
      const fecha = document.getElementById('rep_ingresos_fecha').value;
      await TB_FIREBASE.saveIngresosReport(fecha, {
        total: parseVal('kpi-ingreso-total'),
        efectivo: parseVal('rep_efectivo_val'),
        tarjeta: parseVal('rep_tarjeta_val'),
        transferencia: parseVal('rep_transf_val')
      });
      showToast('Reporte de ingresos guardado en Firebase', 'success');
    });

    // -----------------------------------------------------------------------
    // BOTÓN DE EJEMPLO (SOLO SI EL USUARIO LO SOLICITA)
    // -----------------------------------------------------------------------
    // Botón de datos de prueba eliminado (cero datos de prueba)

    // -----------------------------------------------------------------------
    // INICIALIZACIÓN LIMPIA PARA PRODUCCIÓN
    // -----------------------------------------------------------------------
    const now = new Date();
    const dStr = now.toISOString().split('T')[0];
    const hmStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (document.getElementById('header_fecha')) document.getElementById('header_fecha').value = dStr;
    if (document.getElementById('header_hora')) document.getElementById('header_hora').value = hmStr;
    if (document.getElementById('val_hora_cierre')) document.getElementById('val_hora_cierre').value = hmStr;
    if (document.getElementById('val_hora_entrega')) document.getElementById('val_hora_entrega').value = '';

    if (document.getElementById('chica_fecha')) document.getElementById('chica_fecha').value = dStr;
    if (document.getElementById('chica_hora')) document.getElementById('chica_hora').value = hmStr;

    if (document.getElementById('ventas_filtro_fecha')) document.getElementById('ventas_filtro_fecha').value = dStr;
    if (document.getElementById('venta_fecha')) document.getElementById('venta_fecha').value = dStr;
    if (document.getElementById('lead_reg_fecha')) document.getElementById('lead_reg_fecha').value = dStr;
    if (document.getElementById('rep_ingresos_fecha')) document.getElementById('rep_ingresos_fecha').value = dStr;
    if (document.getElementById('ev_fecha')) document.getElementById('ev_fecha').value = dStr;

    // Inicializar controles de período de BalanceScore
    if (document.getElementById('bs_fecha_dia')) document.getElementById('bs_fecha_dia').value = dStr;
    if (document.getElementById('bs_fecha_semana')) document.getElementById('bs_fecha_semana').value = dStr;
    const curMes = dStr.substring(0, 7);
    if (document.getElementById('bs_quin_mes')) document.getElementById('bs_quin_mes').value = curMes;
    if (document.getElementById('bs_mes_val')) document.getElementById('bs_mes_val').value = curMes;
    if (document.getElementById('bs_rango_desde')) document.getElementById('bs_rango_desde').value = `${curMes}-01`;
    if (document.getElementById('bs_rango_hasta')) document.getElementById('bs_rango_hasta').value = dStr;

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
        const curFecha = document.getElementById('header_fecha')?.value || new Date().toISOString().split('T')[0];
        if (currentModule === 'arqueo-principal') {
          await syncVentasToCajaPrincipal(curFecha, false);
          await loadControlCajaData();
        } else if (currentModule === 'ventas') {
          const vf = document.getElementById('ventas_filtro_fecha')?.value || curFecha;
          renderVentas(vf);
        }
      } catch (e) {
        console.warn('Sync en segundo plano:', e);
      }
    }, 30000);
    // Inicializar Sistema de Autenticación Firebase Auth
    // (La carga de catálogos y datos reales se dispara una vez validada la sesión con Firebase)
    initAuthSystem();
  });

  // =========================================================================
  // SISTEMA DE AUTENTICACIÓN FIREBASE AUTH (CORREO / CONTRASEÑA)
  // =========================================================================
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

    async function onLoginSuccess(user) {
      if (authOverlay) authOverlay.classList.add('hidden');
      if (topbarUserBadge) topbarUserBadge.style.display = 'inline-flex';
      if (topbarUserEmail) topbarUserEmail.textContent = user.email;
      if (sidebarUserCard) sidebarUserCard.style.display = 'block';
      if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;

      showToast(`Bienvenido(a) ${user.email}`, 'success');

      // Responsables obligatorios no editables fijados con el correo de inicio de sesión
      const respEl = document.getElementById('header_responsable');
      if (respEl) respEl.value = user.email;
      const respValEl = document.getElementById('val_responsable_nombre');
      if (respValEl) respValEl.value = user.email;
      const respChica = document.getElementById('chica_responsable');
      if (respChica) respChica.value = user.email;

      // Cargar control de caja y fondo de caja de registros
      await loadControlCajaData();

      // CARGA ESTRICTA DESDE FIREBASE: Cargar catálogos reales con sesión activa
      await loadCatalogsData();
      if (currentModule === 'configuracion') loadAndRenderConfiguracion();
      else if (currentModule === 'balancescore') renderBalanceScoreStations();
      else if (currentModule === 'ventas') {
        const vf = document.getElementById('ventas_filtro_fecha')?.value || new Date().toISOString().split('T')[0];
        renderVentas(vf);
      }
      else if (currentModule === 'auditoria') {
        renderAuditoriaView();
      }
    }

    function onLogoutSuccess() {
      if (authOverlay) authOverlay.classList.remove('hidden');
      if (topbarUserBadge) topbarUserBadge.style.display = 'none';
      if (sidebarUserCard) sidebarUserCard.style.display = 'none';
      if (authForm) authForm.reset();
      if (authErrorBox) authErrorBox.style.display = 'none';
      if (authSuccessBox) authSuccessBox.style.display = 'none';

      // Limpiar datos en memoria y caches locales al cerrar sesión
      catServicios = [];
      catEstaciones = [];
      catEspecialistas = [];
      catCursosMeta = { id: 'Cursos', nombre: 'Cursos & Talleres Academia', icono: '🎓', metaQuincenal: 0, clientesMeta: 0, isCurso: true };
      ['servicios', 'estaciones', 'especialistas', 'metas_cursos', 'metas'].forEach(t => {
        localStorage.removeItem(`tb_cat_${t}`);
      });
      populateSalesDropdowns();
      populateConfigStationDropdowns();
      renderCatServiciosTable();
      renderCatEstacionesTable();
      renderCatEspecialistasTable();
      renderCatMetasTable();
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
        onLoginSuccess(res.user);
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

    // Verificar si hay sesión previa activa y validar límite estricto de 1 hora
    TB_FIREBASE.checkSession().then(res => {
      if (res && res.active && res.user) {
        onLoginSuccess(res.user);
      } else {
        onLogoutSuccess();
        if (res && res.expired) {
          showError(res.message || '⚠️ Por seguridad, la sesión caduca automáticamente después de 1 hora. Por favor inicie sesión nuevamente.');
        }
      }
    });

    // Escuchar expiración automática tras 1 hora en tiempo real
    window.addEventListener('tb_session_expired', (e) => {
      onLogoutSuccess();
      showError(e.detail?.message || '⚠️ Su sesión ha expirado tras 1 hora de acceso continuo. Por favor inicie sesión nuevamente.');
      showToast('Sesión expirada (límite de 1 hora)', 'warning');
    });
  }

})();
