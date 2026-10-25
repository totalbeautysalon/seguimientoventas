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

    // Reiniciar contadores de ingresos
    const matrix = {
      servicios: { e: 0, t: 0, j: 0 },
      anticipos: { e: 0, t: 0, j: 0 },
      cursos:    { e: 0, t: 0, j: 0 },
      productos: { e: 0, t: 0, j: 0 },
      saldos:    { e: 0, t: 0, j: 0 },
      otros:     { e: 0, t: 0, j: 0 }
    };

    const anticiposList = [];

    ventas.forEach(v => {
      const imp = parseFloat(v.totalCobrado) || 0;
      const mp = (v.metodoPago || '').toLowerCase();
      const col = mp.includes('transf') ? 't' : (mp.includes('tarj') ? 'j' : 'e');

      const est = (v.estacion || '').toLowerCase();
      const serv = (v.servicio || '').toLowerCase();
      const st = (v.statusPago || '').toLowerCase();

      if (st.includes('anticipo')) {
        matrix.anticipos[col] += imp;
        anticiposList.push({
          clienta: v.clienta || 'Prospecto Cita',
          concepto: v.servicio || 'Anticipo',
          pago: imp,
          saldo: 0
        });
      } else if (st.includes('saldo')) {
        matrix.saldos[col] += imp;
      } else if (est.includes('academia') || serv.includes('curso') || serv.includes('taller')) {
        matrix.cursos[col] += imp;
      } else if (est.includes('retail') || serv.includes('producto') || serv.includes('shampoo')) {
        matrix.productos[col] += imp;
      } else {
        matrix.servicios[col] += imp;
      }
    });

    // Rellenar formulario de Caja Principal
    ['servicios', 'anticipos', 'cursos', 'productos', 'saldos', 'otros'].forEach(k => {
      const elE = document.getElementById(`ing_${k}_efec`);
      const elT = document.getElementById(`ing_${k}_transf`);
      const elJ = document.getElementById(`ing_${k}_tarj`);
      if (elE) elE.value = matrix[k].e.toFixed(2);
      if (elT) elT.value = matrix[k].t.toFixed(2);
      if (elJ) elJ.value = matrix[k].j.toFixed(2);
    });

    const opEl = document.getElementById('ing_operaciones_cobradas');
    if (opEl) opEl.value = ventas.length > 0 ? ventas.length : '';

    // Sincronizar anticipos si hay
    if (anticiposList.length > 0) {
      const tbodyAnt = document.getElementById('tbody-anticipos');
      if (tbodyAnt) {
        tbodyAnt.innerHTML = '';
        anticiposList.forEach(a => {
          const tr = document.createElement('tr');
          tr.className = 'anticipo-row';
          tr.innerHTML = `
            <td><input type="text" class="input-text ant-clienta" value="${a.clienta}"></td>
            <td><input type="text" class="input-text ant-concepto" value="${a.concepto}"></td>
            <td><div class="currency-input-wrap"><span class="currency-prefix">$</span><input type="number" step="0.01" min="0" class="input-currency calc-trigger ant-pago" value="${a.pago.toFixed(2)}"></div></td>
            <td><div class="currency-input-wrap"><span class="currency-prefix">$</span><input type="number" step="0.01" min="0" class="input-currency calc-trigger ant-saldo" value="${a.saldo.toFixed(2)}"></div></td>
            <td class="text-center"><button type="button" class="btn btn-outline-danger btn-sm btn-del-row">✕</button></td>
          `;
          tbodyAnt.appendChild(tr);
        });
      }
    }

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

    // Ingresos
    let totEfec = 0, totTransf = 0, totTarj = 0;
    ['servicios', 'anticipos', 'cursos', 'productos', 'saldos', 'otros'].forEach(k => {
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
    // Efectivo esperado = Fondo inicial + Ingresos efectivo - Retiros resguardo
    const retiros = parseVal('concil_retiros_resguardo');
    setDisplay('concil_ingresos_efectivo', totEfec);
    setDisplay('concil_efectivo_contado', totalContado);

    const esperado = fCaja + totEfec - retiros;
    setDisplay('concil_efectivo_esperado', esperado);

    const diferencia = totalContado - esperado;
    setDisplay('concil_diferencia_caja', diferencia);
    setDisplay('kpi-diferencia', diferencia);

    // Radios y badges
    const rCuadrada = document.getElementById('res_cuadrada');
    const rSobrante = document.getElementById('res_sobrante');
    const rFaltante = document.getElementById('res_faltante');
    const cardC = document.getElementById('card_res_cuadrada');
    const cardS = document.getElementById('card_res_sobrante');
    const cardF = document.getElementById('card_res_faltante');
    const kpiBadge = document.getElementById('kpi-status-badge');
    const difLabel = document.getElementById('concil_diferencia_label');

    if (cardC) cardC.className = 'resultado-radio-card';
    if (cardS) cardS.className = 'resultado-radio-card';
    if (cardF) cardF.className = 'resultado-radio-card';

    if (Math.abs(diferencia) < 0.005) {
      if (rCuadrada) rCuadrada.checked = true;
      if (cardC) cardC.classList.add('active-cuadrada');
      if (kpiBadge) { kpiBadge.textContent = 'Cuadrada'; kpiBadge.className = 'kpi-status-badge badge-cuadrada'; }
      if (difLabel) { difLabel.textContent = '✅ Caja cuadrada exacta'; difLabel.style.color = 'var(--success)'; }
    } else if (diferencia > 0.005) {
      if (rSobrante) rSobrante.checked = true;
      if (cardS) cardS.classList.add('active-sobrante');
      if (kpiBadge) { kpiBadge.textContent = `Sobrante: ${formatCurrency(diferencia)}`; kpiBadge.className = 'kpi-status-badge badge-sobrante'; }
      if (difLabel) { difLabel.textContent = `🟡 Sobrante de ${formatCurrency(diferencia)}`; difLabel.style.color = 'var(--warning)'; }
    } else {
      if (rFaltante) rFaltante.checked = true;
      if (cardF) cardF.classList.add('active-faltante');
      if (kpiBadge) { kpiBadge.textContent = `Faltante: ${formatCurrency(Math.abs(diferencia))}`; kpiBadge.className = 'kpi-status-badge badge-faltante'; }
      if (difLabel) { difLabel.textContent = `🔴 Faltante de ${formatCurrency(Math.abs(diferencia))}`; difLabel.style.color = 'var(--danger)'; }
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

    // Anticipos
    let totAntP = 0, totAntS = 0;
    document.querySelectorAll('.anticipo-row').forEach(r => {
      totAntP += parseFloat(r.querySelector('.ant-pago')?.value) || 0;
      totAntS += parseFloat(r.querySelector('.ant-saldo')?.value) || 0;
    });
    setDisplay('ant_total_pago', totAntP);
    setDisplay('ant_total_saldo', totAntS);

    // Resumen
    setDisplay('resumen_total_ingresos', granTotalIngresos);
    setDisplay('resumen_total_efectivo', totalContado);
    setDisplay('resumen_total_transf', tVer);
    setDisplay('resumen_total_tarjetas', jVer + oVer);
    setDisplay('resumen_total_retiros', retiros);
    setDisplay('resumen_diferencia_caja', diferencia);

    const respH = document.getElementById('header_responsable')?.value || '';
    const valN = document.getElementById('val_responsable_nombre');
    if (valN && (!valN.value || valN.dataset.synced === 'true')) {
      valN.value = respH;
      valN.dataset.synced = 'true';
    }
  }

  function serializePrincipal() {
    return {
      header: {
        fecha: document.getElementById('header_fecha')?.value || '',
        responsable: document.getElementById('header_responsable')?.value || '',
        hora: document.getElementById('header_hora')?.value || ''
      },
      fondoInicial: parseVal('f_inicial_caja'),
      ingresos: {
        servicios: { e: parseVal('ing_servicios_efec'), t: parseVal('ing_servicios_transf'), j: parseVal('ing_servicios_tarj') },
        anticipos: { e: parseVal('ing_anticipos_efec'), t: parseVal('ing_anticipos_transf'), j: parseVal('ing_anticipos_tarj') },
        cursos:    { e: parseVal('ing_cursos_efec'),    t: parseVal('ing_cursos_transf'),    j: parseVal('ing_cursos_tarj') },
        productos: { e: parseVal('ing_productos_efec'), t: parseVal('ing_productos_transf'), j: parseVal('ing_productos_tarj') },
        saldos:    { e: parseVal('ing_saldos_efec'),    t: parseVal('ing_saldos_transf'),    j: parseVal('ing_saldos_tarj') },
        otros:     { e: parseVal('ing_otros_efec'),     t: parseVal('ing_otros_transf'),     j: parseVal('ing_otros_tarj') },
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
        retiros: parseVal('concil_retiros_resguardo'),
        esperado: parseVal('concil_efectivo_esperado'),
        contado: parseVal('conteo_total_efectivo'),
        diferencia: parseVal('concil_diferencia_caja'),
        resultado: document.querySelector('input[name="resultado_arqueo"]:checked')?.value || 'cuadrada',
        explicacion: document.getElementById('concil_explicacion')?.value || ''
      },
      controlPagos: {
        transfVer: parseVal('ctrl_transf_verif'),
        tarjVer: parseVal('ctrl_tarj_verif')
      },
      resumen: {
        numServicios: document.getElementById('resumen_num_servicios')?.value || '',
        numAnticipos: document.getElementById('resumen_num_anticipos')?.value || '',
        numCursos: document.getElementById('resumen_num_cursos')?.value || '',
        obsDia: document.getElementById('resumen_observaciones_dia')?.value || ''
      },
      validacion: {
        responsable: document.getElementById('val_responsable_nombre')?.value || '',
        horaCierre: document.getElementById('val_hora_cierre')?.value || '',
        horaEntrega: document.getElementById('val_hora_entrega')?.value || '',
        entregadoA: document.getElementById('val_entregado_a')?.value || '',
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
    document.getElementById('header_fecha').value = now.toISOString().split('T')[0];
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('header_hora').value = hm;
    document.getElementById('val_hora_cierre').value = hm;
    recalculatePrincipal();
  }

  function syncPrincipalPrintable() {
    recalculatePrincipal();
    const rawF = document.getElementById('header_fecha').value;
    document.getElementById('p_fecha').textContent = rawF || '__ / __ / ____';
    document.getElementById('p_responsable').textContent = document.getElementById('header_responsable').value || '________________';
    document.getElementById('p_hora').textContent = document.getElementById('header_hora').value || '____';

    document.getElementById('p_f_caja').textContent = formatCurrency(parseVal('f_inicial_caja'));

    ['servicios', 'anticipos', 'cursos', 'productos', 'saldos', 'otros'].forEach(r => {
      document.getElementById(`p_ing_${r}_e`).textContent = formatCurrency(parseVal(`ing_${r}_efec`));
      document.getElementById(`p_ing_${r}_t`).textContent = formatCurrency(parseVal(`ing_${r}_transf`));
      document.getElementById(`p_ing_${r}_j`).textContent = formatCurrency(parseVal(`ing_${r}_tarj`));
      document.getElementById(`p_ing_${r}_tot`).textContent = formatCurrency(parseVal(`ing_${r}_total`));
    });
    document.getElementById('p_ing_tot_e').textContent = formatCurrency(parseVal('ing_total_efectivo'));
    document.getElementById('p_ing_tot_t').textContent = formatCurrency(parseVal('ing_total_transf'));
    document.getElementById('p_ing_tot_j').textContent = formatCurrency(parseVal('ing_total_tarjeta'));
    document.getElementById('p_ing_tot_gran').textContent = formatCurrency(parseVal('ing_gran_total'));
    document.getElementById('p_operaciones').textContent = document.getElementById('ing_operaciones_cobradas').value || '0';

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
      document.getElementById(d.qId).textContent = q > 0 ? q : '';
      document.getElementById(d.tId).textContent = formatCurrency(q * d.val);
    });
    document.getElementById('p_conteo_tot').textContent = formatCurrency(tc);

    // Conciliación
    document.getElementById('p_concil_fondo').textContent = formatCurrency(parseVal('f_inicial_caja'));
    document.getElementById('p_concil_ingresos').textContent = formatCurrency(parseVal('ing_total_efectivo'));
    document.getElementById('p_concil_retiros').textContent = formatCurrency(parseVal('concil_retiros_resguardo'));
    document.getElementById('p_concil_esperado').textContent = formatCurrency(parseVal('concil_efectivo_esperado'));
    document.getElementById('p_concil_contado').textContent = formatCurrency(tc);
    document.getElementById('p_concil_diferencia').textContent = formatCurrency(parseVal('concil_diferencia_caja'));

    const res = document.querySelector('input[name="resultado_arqueo"]:checked')?.value || 'cuadrada';
    document.getElementById('p_box_cuadrada').textContent = res === 'cuadrada' ? '✓' : '';
    document.getElementById('p_box_sobrante').textContent = res === 'sobrante' ? '✓' : '';
    document.getElementById('p_box_faltante').textContent = res === 'faltante' ? '✓' : '';
    document.getElementById('p_explicacion').textContent = document.getElementById('concil_explicacion').value.trim() || 'Sin diferencias.';

    // Validación y entrega
    const valN = document.getElementById('val_responsable_nombre').value || document.getElementById('header_responsable').value;
    document.getElementById('p_val_nombre').textContent = valN;
    const firmaImg = document.getElementById('p_val_firma_img');
    const firmaBlank = document.getElementById('p_val_firma_blank');
    if (sigDataPrincipal && sigPadPrincipal) {
      firmaImg.src = sigPadPrincipal.toDataURL('image/png');
      firmaImg.style.display = 'block';
      firmaBlank.style.display = 'none';
    } else {
      firmaImg.style.display = 'none';
      firmaBlank.style.display = 'inline-block';
    }
    document.getElementById('p_val_hora_cierre').textContent = document.getElementById('val_hora_cierre').value || '____';
    document.getElementById('p_val_hora_entrega').textContent = document.getElementById('val_hora_entrega').value || '____';
    document.getElementById('p_val_entregado_a').textContent = document.getElementById('val_entregado_a').value || '________________';
    document.getElementById('p_val_importe_entregado').textContent = formatCurrency(parseVal('val_importe_entregado'));

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
    if (isChica) {
      await TB_FIREBASE.saveArqueoCajaChica(serializeChica());
    } else {
      await TB_FIREBASE.saveArqueoPrincipal(serializePrincipal());
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
  // 6. BALANCESCORE POR ESTACIONES (INTERCONECTADO CON VENTAS)
  // =========================================================================
  const STATIONS_METAS = [
    { id: 'Cabello', name: 'Cabello & Colorimetría', icon: '💇‍♀️', meta: 2500, clientesMeta: 6 },
    { id: 'Uñas', name: 'Uñas & Manicure', icon: '💅', meta: 1800, clientesMeta: 6 },
    { id: 'Maquillaje', name: 'Maquillaje Profesional', icon: '💄', meta: 1200, clientesMeta: 3 },
    { id: 'Pestañas', name: 'Lash & Brow (Pestañas/Cejas)', icon: '👁️', meta: 1000, clientesMeta: 4 },
    { id: 'Pedicure', name: 'Pedicure & Spa', icon: '🦶', meta: 900, clientesMeta: 4 },
    { id: 'Facial', name: 'Cabina Facial', icon: '✨', meta: 900, clientesMeta: 3 }
  ];

  function getActiveStationMetas() {
    if (catEstaciones && catEstaciones.length > 0) {
      return catEstaciones.map(e => ({
        id: e.nombre,
        name: e.nombre,
        icon: e.icono || '💈',
        meta: parseFloat(e.meta) || 2000,
        clientesMeta: parseInt(e.metaClientes, 10) || 5
      }));
    }
    return STATIONS_METAS;
  }

  async function renderBalanceScoreStations() {
    const container = document.getElementById('stations-grid-container');
    container.innerHTML = '';
    const fEl = document.getElementById('bs_fecha');
    if (!fEl.value) fEl.value = new Date().toISOString().split('T')[0];
    const fecha = fEl.value;

    // Obtener ventas reales para calcular la recaudación exacta por estación
    const ventas = await TB_FIREBASE.getVentasByFecha(fecha);
    const activeStations = getActiveStationMetas();

    let totalScore = 0;
    activeStations.forEach(st => {
      // Filtrar ventas de esta estación
      const ventasSt = ventas.filter(v => (v.estacion || '').toLowerCase().includes(st.id.toLowerCase()));
      const lograda = ventasSt.reduce((sum, v) => sum + (parseFloat(v.totalCobrado) || 0), 0);
      const clientesReales = ventasSt.length;
      const ticket = clientesReales > 0 ? lograda / clientesReales : 0;

      const pct = Math.min(100, Math.round((lograda / st.meta) * 100));
      // Calificación: 60% por ventas + 40% por estándares
      const score = Math.round((pct * 0.6) + 40);
      totalScore += score;

      const card = document.createElement('div');
      card.className = 'station-card';
      card.innerHTML = `
        <div class="station-card-header">
          <div class="station-title"><span>${st.icon}</span><span>${st.name}</span></div>
          <span class="station-score-badge">${score}%</span>
        </div>
        <div class="station-card-body">
          <div class="station-progress-wrap">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700;">
              <span>Cumplimiento: ${pct}%</span>
              <span>${formatCurrency(lograda)} / ${formatCurrency(st.meta)}</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${pct}%; background:${pct >= 100 ? '#10b981' : (pct >= 80 ? '#f59e0b' : '#ef4444')}"></div>
            </div>
          </div>
          <div class="station-metrics-row">
            <div class="history-metric-box"><div class="label">Clientes Reales</div><div class="val">${clientesReales} / Meta: ${st.clientesMeta}</div></div>
            <div class="history-metric-box"><div class="label">Ticket Promedio</div><div class="val">${formatCurrency(ticket)}</div></div>
          </div>
          <div class="checklist-group">
            <label class="checklist-item"><input type="checkbox" checked> Limpieza y desinfección</label>
            <label class="checklist-item"><input type="checkbox" checked> Puntualidad en citas</label>
            <label class="checklist-item"><input type="checkbox" checked> Experiencia Total Beauty</label>
            <label class="checklist-item"><input type="checkbox" checked> Sugerencia de producto / venta cruzada</label>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    const overall = activeStations.length > 0 ? Math.round(totalScore / activeStations.length) : 0;
    const badge = document.getElementById('bs-overall-badge');
    if (badge) badge.textContent = `Score Salón: ${overall}%`;
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
  const DEFAULT_ESTACIONES = [
    { id: 'est_1', nombre: 'Cabello', icono: '💇‍♀️', meta: 2500, metaClientes: 6 },
    { id: 'est_2', nombre: 'Uñas', icono: '💅', meta: 1800, metaClientes: 6 },
    { id: 'est_3', nombre: 'Maquillaje', icono: '💄', meta: 1200, metaClientes: 3 },
    { id: 'est_4', nombre: 'Pestañas', icono: '👁️', meta: 1000, metaClientes: 4 },
    { id: 'est_5', nombre: 'Pedicure', icono: '🦶', meta: 900, metaClientes: 4 },
    { id: 'est_6', nombre: 'Facial', icono: '✨', meta: 900, metaClientes: 3 },
    { id: 'est_7', nombre: 'Academia', icono: '🎓', meta: 3500, metaClientes: 2 },
    { id: 'est_8', nombre: 'Retail', icono: '🛍️', meta: 1000, metaClientes: 5 }
  ];

  const DEFAULT_ESPECIALISTAS = [
    { id: 'esp_1', nombre: 'Marbella Ríos', estacion: 'Cabello', telefono: '5512345678' },
    { id: 'esp_2', nombre: 'Especialista Salón', estacion: 'Uñas', telefono: '' },
    { id: 'esp_3', nombre: 'Especialista Academia', estacion: 'Academia', telefono: '' }
  ];

  const DEFAULT_SERVICIOS = [
    { id: 'srv_1', nombre: 'Balayage Completo + Matiz', tipo: 'Servicio', estacion: 'Cabello', precio: 1800 },
    { id: 'srv_2', nombre: 'Tinte Global y Tratamiento', tipo: 'Servicio', estacion: 'Cabello', precio: 850 },
    { id: 'srv_3', nombre: 'Corte de Cabello y Planchado', tipo: 'Servicio', estacion: 'Cabello', precio: 350 },
    { id: 'srv_4', nombre: 'Uñas Esculturales Acrílicas', tipo: 'Servicio', estacion: 'Uñas', precio: 600 },
    { id: 'srv_5', nombre: 'Gelish Manos y Pies', tipo: 'Servicio', estacion: 'Uñas', precio: 300 },
    { id: 'srv_6', nombre: 'Maquillaje Profesional y Peinado', tipo: 'Servicio', estacion: 'Maquillaje', precio: 800 },
    { id: 'srv_7', nombre: 'Laminado de Cejas y Pestañas', tipo: 'Servicio', estacion: 'Pestañas', precio: 550 },
    { id: 'srv_8', nombre: 'Pedicure Spa Profundo', tipo: 'Servicio', estacion: 'Pedicure', precio: 450 },
    { id: 'srv_9', nombre: 'Limpieza Facial Hidratante', tipo: 'Servicio', estacion: 'Facial', precio: 700 },
    { id: 'srv_10', nombre: 'Inscripción Curso Uñas Academia', tipo: 'Curso', estacion: 'Academia', precio: 2500 },
    { id: 'srv_11', nombre: 'Inscripción Curso Colorimetría', tipo: 'Curso', estacion: 'Academia', precio: 3500 },
    { id: 'srv_12', nombre: 'Shampoo y Mascarilla Post-Color', tipo: 'Producto', estacion: 'Retail', precio: 450 }
  ];

  let currentConfigTab = 'servicios';
  let catServicios = [];
  let catEstaciones = [];
  let catEspecialistas = [];

  function switchConfigTab(tabKey) {
    currentConfigTab = tabKey;
    document.querySelectorAll('.config-nav-pill').forEach(btn => {
      if (btn.dataset.cfgtab === tabKey) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    ['servicios', 'estaciones', 'especialistas'].forEach(k => {
      const el = document.getElementById(`config-subview-${k}`);
      if (el) el.style.display = (k === tabKey) ? 'block' : 'none';
    });
  }

  async function loadCatalogsData() {
    catEstaciones = await TB_FIREBASE.getCatalogo('estaciones', DEFAULT_ESTACIONES);
    catEspecialistas = await TB_FIREBASE.getCatalogo('especialistas', DEFAULT_ESPECIALISTAS);
    catServicios = await TB_FIREBASE.getCatalogo('servicios', DEFAULT_SERVICIOS);

    populateSalesDropdowns();
    populateConfigStationDropdowns();
  }

  function populateSalesDropdowns() {
    // 1. Selector de Servicios en Venta
    const servSelect = document.getElementById('venta_servicio');
    if (servSelect) {
      const currentVal = servSelect.value;
      servSelect.innerHTML = '<option value="" disabled selected>Seleccione servicio o producto...</option>';
      
      const grupos = {
        'Servicios (Salón)': catServicios.filter(s => s.tipo === 'Servicio'),
        'Productos (Retail)': catServicios.filter(s => s.tipo === 'Producto'),
        'Cursos (Academia)': catServicios.filter(s => s.tipo === 'Curso')
      };

      Object.entries(grupos).forEach(([grpName, items]) => {
        if (items.length > 0) {
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
      if (currentVal) servSelect.value = currentVal;
    }

    // 2. Selector de Estaciones en Venta
    const estSelect = document.getElementById('venta_estacion');
    if (estSelect) {
      const currentVal = estSelect.value;
      estSelect.innerHTML = '<option value="" disabled selected>Seleccione la estación...</option>';
      catEstaciones.forEach(est => {
        const opt = document.createElement('option');
        opt.value = est.nombre;
        opt.textContent = `${est.icono || '💈'} ${est.nombre}`;
        estSelect.appendChild(opt);
      });
      if (currentVal) estSelect.value = currentVal;
    }

    // 3. Selector de Especialistas en Venta
    const espSelect = document.getElementById('venta_especialista');
    if (espSelect) {
      const currentVal = espSelect.value;
      espSelect.innerHTML = '<option value="" disabled selected>Seleccione especialista...</option>';
      catEspecialistas.forEach(esp => {
        const opt = document.createElement('option');
        opt.value = esp.nombre;
        opt.textContent = `${esp.nombre} (${esp.estacion || 'General'})`;
        espSelect.appendChild(opt);
      });
      if (currentVal) espSelect.value = currentVal;
    }
  }

  function populateConfigStationDropdowns() {
    const s1 = document.getElementById('cfg_serv_estacion');
    const s2 = document.getElementById('cfg_esp_estacion');
    [s1, s2].forEach(sel => {
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="" disabled selected>Seleccione estación...</option>';
      catEstaciones.forEach(est => {
        const opt = document.createElement('option');
        opt.value = est.nombre;
        opt.textContent = `${est.icono || '💈'} ${est.nombre}`;
        sel.appendChild(opt);
      });
      if (cur) sel.value = cur;
    });
  }

  async function loadAndRenderConfiguracion() {
    await loadCatalogsData();
    renderCatServiciosTable();
    renderCatEstacionesTable();
    renderCatEspecialistasTable();
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
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty-notice"><span>💈</span>No hay estaciones configuradas.</td></tr>';
      return;
    }

    catEstaciones.forEach(est => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:1.2rem; text-align:center;">${est.icono || '✨'}</td>
        <td><strong>${est.nombre}</strong></td>
        <td class="text-right" style="font-weight:700;">$${parseFloat(est.meta || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td class="text-right">${est.metaClientes || 5} clientes</td>
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
      if (text) text.textContent = online ? 'Firebase Conectado' : 'Modo Local / Offline';
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

    document.getElementById('btn-add-anticipo')?.addEventListener('click', () => {
      const tbody = document.getElementById('tbody-anticipos');
      const tr = document.createElement('tr');
      tr.className = 'anticipo-row';
      tr.innerHTML = `
        <td><input type="text" class="input-text ant-clienta" placeholder="Nombre..."></td>
        <td><input type="text" class="input-text ant-concepto" placeholder="Servicio / cita..."></td>
        <td><div class="currency-input-wrap"><span class="currency-prefix">$</span><input type="number" step="0.01" min="0" class="input-currency calc-trigger ant-pago" value="0.00"></div></td>
        <td><div class="currency-input-wrap"><span class="currency-prefix">$</span><input type="number" step="0.01" min="0" class="input-currency calc-trigger ant-saldo" value="0.00"></div></td>
        <td class="text-center"><button type="button" class="btn btn-outline-danger btn-sm btn-del-row">✕</button></td>
      `;
      tbody.appendChild(tr);
      recalculatePrincipal();
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

    // Guardado unificado: Firebase + Descargar PDF + Limpiar
    document.getElementById('btn-save-firebase-bottom')?.addEventListener('click', () => {
      saveFirebaseAndDownload(false);
    });

    document.getElementById('btn-save-firebase-chica')?.addEventListener('click', () => {
      saveFirebaseAndDownload(true);
    });

    document.getElementById('btn-save-firebase-top')?.addEventListener('click', () => {
      const isChica = (currentModule === 'arqueo-chica');
      saveFirebaseAndDownload(isChica);
    });

    document.getElementById('btn-export-pdf-top')?.addEventListener('click', () => {
      const isChica = (currentModule === 'arqueo-chica');
      exportPDF(isChica);
    });

    document.getElementById('btn-clear-active-form')?.addEventListener('click', () => {
      if (currentModule === 'arqueo-chica') clearChicaForm();
      else clearPrincipalForm();
      showToast('Formulario limpiado', 'info');
    });

    document.getElementById('header_fecha')?.addEventListener('change', (e) => {
      syncVentasToCajaPrincipal(e.target.value, false);
    });

    document.getElementById('btn-pull-ventas')?.addEventListener('click', () => {
      const fecha = document.getElementById('header_fecha')?.value;
      syncVentasToCajaPrincipal(fecha, true);
    });

    document.getElementById('btn-sync-ventas-caja')?.addEventListener('click', () => {
      const fecha = document.getElementById('ventas_filtro_fecha')?.value;
      syncVentasToCajaPrincipal(fecha, true);
      switchModule('arqueo-principal');
    });

    document.getElementById('btn-sync-transf')?.addEventListener('click', () => {
      document.getElementById('ctrl_transf_reg').value = parseVal('ing_total_transf').toFixed(2);
      document.getElementById('ctrl_tarj_reg').value = parseVal('ing_total_tarjeta').toFixed(2);
      recalculatePrincipal();
      showToast('Montos registrados sincronizados de Ingresos', 'success');
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
    });

    // Alta de Estación
    document.getElementById('form-nueva-estacion')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cfg_est_nombre').value.trim();
      const icono = document.getElementById('cfg_est_icono').value.trim() || '💈';
      const meta = parseFloat(document.getElementById('cfg_est_meta').value) || 0;
      const metaClientes = parseInt(document.getElementById('cfg_est_meta_clientes').value, 10) || 5;

      if (!nombre || meta <= 0) {
        showToast('Ingrese un nombre de estación y una meta diaria válida', 'warning');
        return;
      }

      const item = { id: `est_${Date.now()}`, nombre, icono, meta, metaClientes };
      catEstaciones.push(item);
      await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
      renderCatEstacionesTable();
      populateSalesDropdowns();
      populateConfigStationDropdowns();
      document.getElementById('form-nueva-estacion').reset();
      document.getElementById('cfg_est_icono').value = '✨';
      document.getElementById('cfg_est_meta_clientes').value = '5';
      showToast(`✅ Estación "${nombre}" guardada e integrada al BalanceScore`, 'success');
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
    });

    // Eliminar ítems de catálogo
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-cfg-serv')) {
        const id = e.target.dataset.id;
        if (confirm('¿Está seguro de eliminar este servicio del catálogo?')) {
          catServicios = catServicios.filter(s => s.id !== id);
          await TB_FIREBASE.saveCatalogo('servicios', catServicios);
          renderCatServiciosTable();
          populateSalesDropdowns();
          showToast('Servicio eliminado', 'info');
        }
      }
      if (e.target.matches('.btn-del-cfg-est')) {
        const id = e.target.dataset.id;
        if (confirm('¿Está seguro de eliminar esta estación de trabajo?')) {
          catEstaciones = catEstaciones.filter(st => st.id !== id);
          await TB_FIREBASE.saveCatalogo('estaciones', catEstaciones);
          renderCatEstacionesTable();
          populateSalesDropdowns();
          populateConfigStationDropdowns();
          showToast('Estación eliminada', 'info');
        }
      }
      if (e.target.matches('.btn-del-cfg-esp')) {
        const id = e.target.dataset.id;
        if (confirm('¿Está seguro de eliminar este(a) especialista?')) {
          catEspecialistas = catEspecialistas.filter(esp => esp.id !== id);
          await TB_FIREBASE.saveCatalogo('especialistas', catEspecialistas);
          renderCatEspecialistasTable();
          populateSalesDropdowns();
          showToast('Especialista eliminado', 'info');
        }
      }
    });

    // Botón de sincronizar catálogo
    document.getElementById('btn-sync-config')?.addEventListener('click', async () => {
      showToast('Sincronizando catálogos desde Firebase...', 'info');
      await loadAndRenderConfiguracion();
      showToast('Catálogos sincronizados con éxito', 'success');
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
          await TB_FIREBASE.deleteVenta(fecha, id);
          renderVentas(fecha);
          if (fecha === document.getElementById('header_fecha')?.value) {
            syncVentasToCajaPrincipal(fecha, false);
          }
          showToast('Venta eliminada', 'info');
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

      await TB_FIREBASE.saveLead(lead);
      showToast(`✅ ${nombre} guardada en Firebase Cloud`, 'success');

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
        await TB_FIREBASE.updateLeadSeguimiento(id, { accion: 'Actualización en lista' }, newTipif);
        showToast(`Tipificación actualizada a: ${newTipif}`, 'success');
      }
    });

    // Eliminar lead
    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-lead')) {
        const id = e.target.dataset.id;
        if (confirm('¿Eliminar prospecto del directorio?')) {
          const localLeads = JSON.parse(localStorage.getItem('tb_leads_db') || '{}');
          delete localLeads[id];
          localStorage.setItem('tb_leads_db', JSON.stringify(localLeads));
          try {
            await fetch(`${TB_FIREBASE.CONFIG.databaseURL}/leads_seguimiento/${id}.json`, { method: 'DELETE' });
          } catch (err) {}
          renderLeadsDirectory();
          showToast('Registro eliminado', 'info');
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

      await TB_FIREBASE.saveCampanaActiva(campana);
      showToast('✅ Campaña activa guardada en Firebase', 'success');
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

      await TB_FIREBASE.saveEvento(evento);
      showToast('Evento registrado con éxito', 'success');
      document.getElementById('form-nuevo-evento').reset();
      document.getElementById('form-nuevo-evento-wrap').style.display = 'none';
      renderEventosTimeline();
    });

    document.addEventListener('click', async (e) => {
      if (e.target.matches('.btn-del-evento')) {
        const id = e.target.dataset.id;
        if (confirm('¿Eliminar este evento del calendario?')) {
          const localEventos = JSON.parse(localStorage.getItem('tb_eventos_db') || '{}');
          delete localEventos[id];
          localStorage.setItem('tb_eventos_db', JSON.stringify(localEventos));
          try {
            await fetch(`${TB_FIREBASE.CONFIG.databaseURL}/eventos_mes/${id}.json`, { method: 'DELETE' });
          } catch (err) {}
          renderEventosTimeline();
          showToast('Evento eliminado', 'info');
        }
      }
    });

    // Guardado manual de BalanceScore e Ingresos
    document.getElementById('btn-save-balancescore')?.addEventListener('click', async () => {
      const fecha = document.getElementById('bs_fecha').value;
      await TB_FIREBASE.saveBalanceScore(fecha, STATIONS_METAS);
      showToast('BalanceScore guardado en Firebase', 'success');
    });

    document.getElementById('bs_fecha')?.addEventListener('change', () => {
      renderBalanceScoreStations();
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
    document.getElementById('btn-example-data')?.addEventListener('click', () => {
      const today = new Date().toISOString().split('T')[0];
      if (currentModule === 'arqueo-chica') {
        document.getElementById('chica_fecha').value = today;
        document.getElementById('chica_responsable').value = 'Marbella Ríos';
        document.getElementById('chica_hora').value = '19:30';
        document.getElementById('chica_fondo_inicial').value = '1000.00';

        const rows = document.querySelectorAll('.chica-salida-row');
        if (rows.length >= 4) {
          rows[0].querySelector('.chica-motivo').value = 'Peróxidos de emergencia';
          rows[0].querySelector('.chica-autorizo').value = 'Marbella';
          rows[0].querySelector('.chica-importe').value = '250.00';

          rows[1].querySelector('.chica-motivo').value = 'Tratamientos capilares';
          rows[1].querySelector('.chica-autorizo').value = 'Marbella';
          rows[1].querySelector('.chica-importe').value = '150.00';

          rows[2].querySelector('.chica-motivo').value = 'Café y agua de recepción';
          rows[2].querySelector('.chica-autorizo').value = 'Recepción';
          rows[2].querySelector('.chica-importe').value = '100.00';

          rows[3].querySelector('.chica-motivo').value = 'Propinas staff';
          rows[3].querySelector('.chica-autorizo').value = 'Recepción';
          rows[3].querySelector('.chica-importe').value = '50.00';
        }
        document.getElementById('chica_b_200').value = '2'; // 400
        document.getElementById('chica_b_50').value = '1';  // 50
        document.getElementById('chica_explicacion').value = 'Caja chica cuadrada con todos los tickets en orden.';
        document.getElementById('chica_val_nombre').value = 'Marbella Ríos';
        recalculateChica();
        showToast('Datos de ejemplo de Caja Chica cargados', 'success');
      } else {
        document.getElementById('header_fecha').value = today;
        document.getElementById('header_responsable').value = 'Marbella Ríos';
        document.getElementById('header_hora').value = '20:00';
        document.getElementById('f_inicial_caja').value = '1500.00';

        document.getElementById('ing_servicios_efec').value = '3450.00';
        document.getElementById('ing_servicios_transf').value = '2200.00';
        document.getElementById('ing_servicios_tarj').value = '1800.00';
        document.getElementById('ing_anticipos_efec').value = '600.00';
        document.getElementById('ing_cursos_efec').value = '1200.00';
        document.getElementById('ing_productos_efec').value = '750.00';
        document.getElementById('ing_operaciones_cobradas').value = '18';

        document.getElementById('concil_retiros_resguardo').value = '4000.00';
        document.getElementById('billete_1000').value = '2';
        document.getElementById('billete_500').value  = '2';
        document.getElementById('billete_200').value  = '2';
        document.getElementById('billete_100').value  = '1';

        document.getElementById('ctrl_transf_reg').value = '2200.00';
        document.getElementById('ctrl_transf_verif').value = '2200.00';
        document.getElementById('ctrl_tarj_reg').value = '1800.00';
        document.getElementById('ctrl_tarj_verif').value = '1800.00';

        document.getElementById('resumen_num_servicios').value = '12';
        document.getElementById('resumen_num_anticipos').value = '2';
        document.getElementById('resumen_num_cursos').value = '1';

        document.getElementById('val_responsable_nombre').value = 'Marbella Ríos';
        document.getElementById('val_hora_cierre').value = '20:15';
        document.getElementById('val_hora_entrega').value = '20:25';
        document.getElementById('val_entregado_a').value = 'Gerencia General';
        document.getElementById('val_importe_entregado').value = '3500.00';

        recalculatePrincipal();
        showToast('Datos de ejemplo de Caja Principal cargados', 'success');
      }
    });

    // -----------------------------------------------------------------------
    // INICIALIZACIÓN LIMPIA PARA PRODUCCIÓN
    // -----------------------------------------------------------------------
    const now = new Date();
    const dStr = now.toISOString().split('T')[0];
    const hmStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (document.getElementById('header_fecha')) document.getElementById('header_fecha').value = dStr;
    if (document.getElementById('header_hora')) document.getElementById('header_hora').value = hmStr;
    if (document.getElementById('val_hora_cierre')) document.getElementById('val_hora_cierre').value = hmStr;

    if (document.getElementById('chica_fecha')) document.getElementById('chica_fecha').value = dStr;
    if (document.getElementById('chica_hora')) document.getElementById('chica_hora').value = hmStr;

    if (document.getElementById('ventas_filtro_fecha')) document.getElementById('ventas_filtro_fecha').value = dStr;
    if (document.getElementById('venta_fecha')) document.getElementById('venta_fecha').value = dStr;
    if (document.getElementById('lead_reg_fecha')) document.getElementById('lead_reg_fecha').value = dStr;
    if (document.getElementById('bs_fecha')) document.getElementById('bs_fecha').value = dStr;
    if (document.getElementById('rep_ingresos_fecha')) document.getElementById('rep_ingresos_fecha').value = dStr;
    if (document.getElementById('ev_fecha')) document.getElementById('ev_fecha').value = dStr;

    recalculatePrincipal();
    recalculateChica();

    // Inicializar Catálogos Generales (Servicios, Estaciones, Especialistas)
    loadCatalogsData();

    // Inicializar Sistema de Autenticación Firebase Auth
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

    function onLoginSuccess(user) {
      if (authOverlay) authOverlay.classList.add('hidden');
      if (topbarUserBadge) topbarUserBadge.style.display = 'inline-flex';
      if (topbarUserEmail) topbarUserEmail.textContent = user.email;
      if (sidebarUserCard) sidebarUserCard.style.display = 'block';
      if (sidebarUserEmail) sidebarUserEmail.textContent = user.email;

      showToast(`Bienvenido(a) ${user.email}`, 'success');

      // Si no hay responsable escrito, sugerir nombre derivado del correo
      const respEl = document.getElementById('header_responsable');
      if (respEl && !respEl.value) {
        const username = user.email.split('@')[0].replace(/[._-]/g, ' ');
        const cap = username.charAt(0).toUpperCase() + username.slice(1);
        respEl.value = cap;
      }
      const respChica = document.getElementById('chica_responsable');
      if (respChica && !respChica.value) {
        const username = user.email.split('@')[0].replace(/[._-]/g, ' ');
        const cap = username.charAt(0).toUpperCase() + username.slice(1);
        respChica.value = cap;
      }
    }

    function onLogoutSuccess() {
      if (authOverlay) authOverlay.classList.remove('hidden');
      if (topbarUserBadge) topbarUserBadge.style.display = 'none';
      if (sidebarUserCard) sidebarUserCard.style.display = 'none';
      if (authForm) authForm.reset();
      if (authErrorBox) authErrorBox.style.display = 'none';
      if (authSuccessBox) authSuccessBox.style.display = 'none';
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

    // Verificar si hay sesión previa activa
    TB_FIREBASE.checkSession().then(user => {
      if (user) {
        onLoginSuccess(user);
      } else {
        onLogoutSuccess();
      }
    });
  }

})();
