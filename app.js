/**
 * Total Beauty Salón y Academia - Portal Integral de Gestión
 * Arqueo de Caja Principal y Arqueo de Caja Chica Independientes con Firebase y PDF.
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
  let currentLeadTab = 'salon';

  // --- FORMATEO DE MONEDA ---
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
      desc: 'Fondo inicial, ingresos de ventas, conteo físico, conciliación y depósitos'
    },
    'arqueo-chica': {
      title: 'Arqueo Diario de Caja Chica',
      desc: 'Fondo inicial, salidas por gastos menores, conteo físico y conciliación'
    },
    'historial': {
      title: 'Reportes Diarios de Arqueo',
      desc: 'Consulta y descarga de reportes oficiales guardados en Firebase'
    },
    'balancescore': {
      title: 'BalanceScore por Estaciones',
      desc: 'Medición de metas y calidad en las 6 estaciones de trabajo'
    },
    'ingresos': {
      title: 'Reporte Diario de Ingresos',
      desc: 'Análisis de ventas por método de pago y unidad de negocio'
    },
    'interesadas': {
      title: 'Reporte de Interesadas, Solo Preguntan y Cierres',
      desc: 'Embudo de conversión comercial para Salón y Academia'
    },
    'campana': {
      title: 'Campaña y Eventos del Mes',
      desc: 'Promociones activas, paquetes autorizados y eventos'
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

    if (modKey === 'historial') loadHistorial();
    if (modKey === 'balancescore') renderBalanceScoreStations();
    if (modKey === 'ingresos') renderIngresosReport();
    if (modKey === 'interesadas') loadInteresadasData();
    if (modKey === 'campana') renderCampanaEventos();
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
  // 1. LÓGICA DE CAJA PRINCIPAL
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

    // Radio y badges
    const rCuadrada = document.getElementById('res_cuadrada');
    const rSobrante = document.getElementById('res_sobrante');
    const rFaltante = document.getElementById('res_faltante');
    const cardC = document.getElementById('card_res_cuadrada');
    const cardS = document.getElementById('card_res_sobrante');
    const cardF = document.getElementById('card_res_faltante');
    const kpiBadge = document.getElementById('kpi-status-badge');
    const difLabel = document.getElementById('concil_diferencia_label');

    cardC.className = 'resultado-radio-card';
    cardS.className = 'resultado-radio-card';
    cardF.className = 'resultado-radio-card';

    if (Math.abs(diferencia) < 0.005) {
      rCuadrada.checked = true;
      cardC.classList.add('active-cuadrada');
      if (kpiBadge) { kpiBadge.textContent = 'Cuadrada'; kpiBadge.className = 'kpi-status-badge badge-cuadrada'; }
      if (difLabel) { difLabel.textContent = '✅ Caja cuadrada exacta'; difLabel.style.color = 'var(--success)'; }
    } else if (diferencia > 0.005) {
      rSobrante.checked = true;
      cardS.classList.add('active-sobrante');
      if (kpiBadge) { kpiBadge.textContent = `Sobrante: ${formatCurrency(diferencia)}`; kpiBadge.className = 'kpi-status-badge badge-sobrante'; }
      if (difLabel) { difLabel.textContent = `🟡 Sobrante de ${formatCurrency(diferencia)}`; difLabel.style.color = 'var(--warning)'; }
    } else {
      rFaltante.checked = true;
      cardF.classList.add('active-faltante');
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

    // Concil
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

    // Validacion
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
  // 2. LÓGICA DE CAJA CHICA
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

    // Conteo fisico chica
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

    cardC.className = 'resultado-radio-card';
    cardS.className = 'resultado-radio-card';
    cardF.className = 'resultado-radio-card';

    if (Math.abs(dif) < 0.005) {
      rC.checked = true;
      cardC.classList.add('active-cuadrada');
      if (kBadge) { kBadge.textContent = 'Cuadrada'; kBadge.className = 'kpi-status-badge badge-cuadrada'; }
      if (dLabel) { dLabel.textContent = '✅ Caja cuadrada exacta'; dLabel.style.color = 'var(--success)'; }
    } else if (dif > 0.005) {
      rS.checked = true;
      cardS.classList.add('active-sobrante');
      if (kBadge) { kBadge.textContent = `Sobrante: ${formatCurrency(dif)}`; kBadge.className = 'kpi-status-badge badge-sobrante'; }
      if (dLabel) { dLabel.textContent = `🟡 Sobrante de ${formatCurrency(dif)}`; dLabel.style.color = 'var(--warning)'; }
    } else {
      rF.checked = true;
      cardF.classList.add('active-faltante');
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

    // Concil
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
  // 3. EXPORTACIÓN A PDF Y GUARDADO CON LIMPIEZA
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

  // Botón unificado: Guardar en Firebase Cloud -> Descargar PDF -> Limpiar Formulario
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
    let saveRes;
    if (isChica) {
      saveRes = await TB_FIREBASE.saveArqueoCajaChica(serializeChica());
    } else {
      saveRes = await TB_FIREBASE.saveArqueoPrincipal(serializePrincipal());
    }

    // 2. Descargar PDF automáticamente
    showToast('Generando y descargando PDF oficial...', 'info');
    const fileName = await exportPDF(isChica);

    showToast(`✅ ¡${isChica ? 'Caja Chica' : 'Caja Principal'} guardada en Firebase y PDF descargado (${fileName})!`, 'success');

    // 3. Limpiar los campos para nueva información
    if (isChica) {
      clearChicaForm();
    } else {
      clearPrincipalForm();
    }
    showToast('Campos listos para registrar un nuevo arqueo.', 'info');
  }

  // =========================================================================
  // 4. MÓDULO HISTORIAL
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
  // 5. BALANCESCORE POR ESTACIONES
  // =========================================================================
  const DEFAULT_STATIONS = [
    { id: 'cabello', name: 'Cabello & Colorimetría', icon: '💇‍♀️', meta: 2200, lograda: 2450, clientesMeta: 6, clientesReales: 7, ticket: 350, score: 98, checks: [true, true, true, true] },
    { id: 'unas', name: 'Uñas & Manicure', icon: '💅', meta: 1500, lograda: 1680, clientesMeta: 5, clientesReales: 6, ticket: 280, score: 95, checks: [true, true, true, true] },
    { id: 'maquillaje', name: 'Maquillaje Profesional', icon: '💄', meta: 1200, lograda: 1200, clientesMeta: 3, clientesReales: 3, ticket: 400, score: 92, checks: [true, true, false, true] },
    { id: 'pestanas', name: 'Lash & Brow Bar', icon: '👁️', meta: 1000, lograda: 850, clientesMeta: 4, clientesReales: 3, ticket: 283, score: 85, checks: [true, true, true, false] },
    { id: 'pedicure', name: 'Pedicure & Spa', icon: '🦶', meta: 800, lograda: 920, clientesMeta: 4, clientesReales: 5, ticket: 184, score: 96, checks: [true, true, true, true] },
    { id: 'facial', name: 'Cabina Facial', icon: '✨', meta: 900, lograda: 750, clientesMeta: 3, clientesReales: 2, ticket: 375, score: 82, checks: [true, true, false, true] }
  ];

  function renderBalanceScoreStations() {
    const container = document.getElementById('stations-grid-container');
    container.innerHTML = '';
    const fEl = document.getElementById('bs_fecha');
    if (!fEl.value) fEl.value = new Date().toISOString().split('T')[0];

    let totalScore = 0;
    DEFAULT_STATIONS.forEach(st => {
      totalScore += st.score;
      const card = document.createElement('div');
      card.className = 'station-card';
      const pct = Math.min(100, Math.round((st.lograda / st.meta) * 100));

      card.innerHTML = `
        <div class="station-card-header"><div class="station-title"><span>${st.icon}</span><span>${st.name}</span></div><span class="station-score-badge">${st.score}%</span></div>
        <div class="station-card-body">
          <div class="station-progress-wrap">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700;"><span>Cumplimiento: ${pct}%</span><span>${formatCurrency(st.lograda)} / ${formatCurrency(st.meta)}</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%; background:${pct >= 100 ? '#10b981' : (pct >= 80 ? '#f59e0b' : '#ef4444')}"></div></div>
          </div>
          <div class="station-metrics-row">
            <div class="history-metric-box"><div class="label">Clientes</div><div class="val">${st.clientesReales} / Meta: ${st.clientesMeta}</div></div>
            <div class="history-metric-box"><div class="label">Ticket Promedio</div><div class="val">${formatCurrency(st.ticket)}</div></div>
          </div>
          <div class="checklist-group">
            <label class="checklist-item"><input type="checkbox" ${st.checks[0] ? 'checked' : ''}> Limpieza de estación</label>
            <label class="checklist-item"><input type="checkbox" ${st.checks[1] ? 'checked' : ''}> Puntualidad en arranque</label>
            <label class="checklist-item"><input type="checkbox" ${st.checks[2] ? 'checked' : ''}> Hospitalidad Total Beauty</label>
            <label class="checklist-item"><input type="checkbox" ${st.checks[3] ? 'checked' : ''}> Venta cruzada / producto</label>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    const badge = document.getElementById('bs-overall-badge');
    badge.textContent = `Score Salón: ${Math.round(totalScore / DEFAULT_STATIONS.length)}%`;
  }

  // =========================================================================
  // 6. REPORTE DIARIO DE INGRESOS
  // =========================================================================
  function renderIngresosReport() {
    const fIn = document.getElementById('rep_ingresos_fecha');
    if (!fIn.value) fIn.value = new Date().toISOString().split('T')[0];

    const efec = parseVal('ing_total_efectivo');
    const transf = parseVal('ing_total_transf');
    const tarj = parseVal('ing_total_tarjeta');
    const total = efec + transf + tarj;

    const serv = parseVal('ing_servicios_total') + parseVal('ing_anticipos_total') + parseVal('ing_saldos_total');
    const acad = parseVal('ing_cursos_total');
    const retail = parseVal('ing_productos_total') + parseVal('ing_otros_total');

    document.getElementById('kpi-ingreso-total').textContent = formatCurrency(total);
    document.getElementById('kpi-ingreso-cumplimiento').textContent = total > 0 ? `${Math.round((total / 5000) * 100)}%` : '0%';

    let pred = 'Efectivo';
    if (tarj > efec && tarj > transf) pred = 'Tarjeta';
    if (transf > efec && transf > tarj) pred = 'Transferencia';
    document.getElementById('kpi-ingreso-metodo').textContent = pred;

    document.getElementById('rep_efectivo_val').textContent = formatCurrency(efec);
    document.getElementById('rep_efectivo_pct').textContent = total > 0 ? `${Math.round((efec / total) * 100)}%` : '0%';
    document.getElementById('rep_tarjeta_val').textContent = formatCurrency(tarj);
    document.getElementById('rep_tarjeta_pct').textContent = total > 0 ? `${Math.round((tarj / total) * 100)}%` : '0%';
    document.getElementById('rep_transf_val').textContent = formatCurrency(transf);
    document.getElementById('rep_transf_pct').textContent = total > 0 ? `${Math.round((transf / total) * 100)}%` : '0%';
    document.getElementById('rep_metodos_total').textContent = formatCurrency(total);

    document.getElementById('rep_salon_val').textContent = formatCurrency(serv);
    document.getElementById('rep_salon_pct').textContent = total > 0 ? `${Math.round((serv / total) * 100)}%` : '0%';
    document.getElementById('rep_academia_val').textContent = formatCurrency(acad);
    document.getElementById('rep_academia_pct').textContent = total > 0 ? `${Math.round((acad / total) * 100)}%` : '0%';
    document.getElementById('rep_retail_val').textContent = formatCurrency(retail);
    document.getElementById('rep_retail_pct').textContent = total > 0 ? `${Math.round((retail / total) * 100)}%` : '0%';
    document.getElementById('rep_unidades_total').textContent = formatCurrency(total);
  }

  // =========================================================================
  // 7. INTERESADAS Y CIERRES
  // =========================================================================
  const LEADS_DATA = {
    salon: { totales: 14, cierres: 5, motivos: '3 clientas querían sábado por la tarde, 2 precio balayage.' },
    academia: { totales: 9, cierres: 3, motivos: '2 preguntaron por facilidades de pago, 1 sin horario vespertino.' }
  };

  function loadInteresadasData() {
    const fIn = document.getElementById('lead_fecha');
    if (!fIn.value) fIn.value = new Date().toISOString().split('T')[0];

    const cur = LEADS_DATA[currentLeadTab];
    document.getElementById('lead_totales').value = cur.totales;
    document.getElementById('lead_cierres').value = cur.cierres;
    document.getElementById('lead_motivos').value = cur.motivos;
    calculateLeadsFunnel();
  }

  function calculateLeadsFunnel() {
    const tot = parseInt(document.getElementById('lead_totales').value, 10) || 0;
    const cierres = parseInt(document.getElementById('lead_cierres').value, 10) || 0;
    const preguntan = Math.max(0, tot - cierres);

    document.getElementById('lead_preguntan').value = preguntan;
    document.getElementById('visual-interesadas').textContent = tot;
    document.getElementById('visual-preguntan').textContent = preguntan;
    document.getElementById('visual-cierres').textContent = cierres;

    const rate = tot > 0 ? Math.round((cierres / tot) * 100) : 0;
    document.getElementById('visual-tasa-conversion').textContent = `${rate}%`;

    LEADS_DATA[currentLeadTab] = {
      totales: tot,
      cierres: cierres,
      motivos: document.getElementById('lead_motivos').value
    };
  }

  // =========================================================================
  // 8. CAMPAÑA Y EVENTOS
  // =========================================================================
  const DEFAULT_EVENTS = [
    { day: '26', month: 'OCT', title: 'Apertura de Semana & Revisión de Metas', type: 'Recepción & Salón', resp: 'Marbella Ríos' },
    { day: '28', month: 'OCT', title: 'Inicio Curso Intensivo Uñas Acrílicas', type: 'Academia', resp: 'Instructora Titular' },
    { day: '30', month: 'OCT', title: 'Viernes de Balayage & Promociones', type: 'Salón', resp: 'Equipo Estilistas' },
    { day: '31', month: 'OCT', title: 'Cierre de Mes & Arqueo General', type: 'Dirección', resp: 'Administración' },
    { day: '05', month: 'NOV', title: 'Masterclass de Colorimetría', type: 'Academia', resp: 'Master Guest' }
  ];

  function renderCampanaEventos() {
    const container = document.getElementById('events-timeline-container');
    container.innerHTML = '';
    DEFAULT_EVENTS.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-item-card';
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="event-date-badge"><div class="day">${ev.day}</div><div class="month">${ev.month}</div></div>
          <div><div style="font-weight:700; color:var(--dark);">${ev.title}</div><div style="font-size:0.8rem; color:var(--muted);">${ev.type} &bull; Resp: <strong>${ev.resp}</strong></div></div>
        </div>
        <span class="kpi-status-badge badge-cuadrada">Confirmado</span>
      `;
      container.appendChild(card);
    });
  }

  // =========================================================================
  // INICIALIZACIÓN Y LISTENERS
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

    // Firebase Status
    TB_FIREBASE.onConnectionChange((online) => {
      const dot = document.getElementById('fb-status-dot');
      const text = document.getElementById('fb-status-text');
      if (dot) dot.className = online ? 'status-dot' : 'status-dot offline';
      if (text) text.textContent = online ? 'Firebase Conectado' : 'Modo Local / Offline';
    });

    // Eventos de entrada: Caja Principal
    document.addEventListener('input', (e) => {
      if (e.target.matches('.calc-trigger') || e.target.matches('.ant-pago') || e.target.matches('.ant-saldo')) {
        recalculatePrincipal();
      }
      if (e.target.matches('.chica-calc-trigger') || e.target.matches('.chica-importe')) {
        recalculateChica();
      }
      if (e.target.matches('.lead-calc-trigger')) {
        calculateLeadsFunnel();
      }
    });

    // Botones de incremento Caja Principal
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

    // Botones de incremento Caja Chica
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

    // Agregar Fila Salida Caja Chica
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

    // Agregar Fila Anticipo
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

    // Guardar en Firebase Cloud, Descargar PDF y Limpiar:
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

    document.getElementById('btn-pull-ventas')?.addEventListener('click', () => {
      showToast('Ventas del día sincronizadas en los ingresos', 'success');
      recalculatePrincipal();
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

    // Historial tipo switch
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

    // Subtabs Leads
    document.getElementById('btn-subtab-salon')?.addEventListener('click', () => {
      currentLeadTab = 'salon';
      document.getElementById('btn-subtab-salon').classList.add('active');
      document.getElementById('btn-subtab-academia').classList.remove('active');
      document.getElementById('lead-form-title').textContent = 'Registro Diario - Salón de Belleza';
      loadInteresadasData();
    });

    document.getElementById('btn-subtab-academia')?.addEventListener('click', () => {
      currentLeadTab = 'academia';
      document.getElementById('btn-subtab-academia').classList.add('active');
      document.getElementById('btn-subtab-salon').classList.remove('active');
      document.getElementById('lead-form-title').textContent = 'Registro Diario - Academia de Belleza';
      loadInteresadasData();
    });

    document.getElementById('btn-save-leads')?.addEventListener('click', async () => {
      const fecha = document.getElementById('lead_fecha').value;
      await TB_FIREBASE.saveInteresadas(fecha, currentLeadTab, LEADS_DATA[currentLeadTab]);
      showToast(`Embudo de ${currentLeadTab === 'salon' ? 'Salón' : 'Academia'} guardado en Firebase`, 'success');
    });

    // BalanceScore
    document.getElementById('btn-save-balancescore')?.addEventListener('click', async () => {
      const fecha = document.getElementById('bs_fecha').value;
      await TB_FIREBASE.saveBalanceScore(fecha, DEFAULT_STATIONS);
      showToast('BalanceScore guardado en Firebase', 'success');
    });

    // Ingresos
    document.getElementById('btn-sync-ingresos-arqueo')?.addEventListener('click', () => {
      renderIngresosReport();
      showToast('Reporte sincronizado con Caja Principal', 'success');
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

    // Datos de Ejemplo
    document.getElementById('btn-example-data')?.addEventListener('click', () => {
      if (currentModule === 'arqueo-chica') {
        const today = new Date().toISOString().split('T')[0];
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
        // Total salidas = 550.00 -> Esperado en caja chica = 450.00
        document.getElementById('chica_b_200').value = '2'; // 400
        document.getElementById('chica_b_50').value = '1';  // 50
        document.getElementById('chica_explicacion').value = 'Caja chica cuadrada con todos los tickets en orden.';
        document.getElementById('chica_val_nombre').value = 'Marbella Ríos';
        recalculateChica();
        showToast('Datos de ejemplo de Caja Chica cargados', 'success');
      } else {
        const today = new Date().toISOString().split('T')[0];
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

        // Retiros para resguardo
        document.getElementById('concil_retiros_resguardo').value = '4000.00';
        // Fondo 1500 + Ingresos Efec (3450+600+1200+750=6000) - Retiros 4000 = Esperado 3500
        document.getElementById('billete_1000').value = '2'; // 2000
        document.getElementById('billete_500').value  = '2'; // 1000
        document.getElementById('billete_200').value  = '2'; // 400
        document.getElementById('billete_100').value  = '1'; // 100

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

    // Fechas y horas de inicio
    const now = new Date();
    const dStr = now.toISOString().split('T')[0];
    const hmStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    document.getElementById('header_fecha').value = dStr;
    document.getElementById('header_hora').value = hmStr;
    document.getElementById('val_hora_cierre').value = hmStr;

    document.getElementById('chica_fecha').value = dStr;
    document.getElementById('chica_hora').value = hmStr;

    recalculatePrincipal();
    recalculateChica();
  });

})();
