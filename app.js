/**
 * Total Beauty Salón y Academia - Portal Integral de Gestión
 * Arqueo Diario, Historial Firebase, BalanceScore, Ingresos, Leads y Campañas.
 */

(function () {
  'use strict';

  // --- ELEMENTOS GENERALES ---
  const form = document.getElementById('form-arqueo');
  const signaturePad = document.getElementById('signature-pad');
  let signatureCtx = null;
  let isDrawing = false;
  let signatureHasData = false;

  // Estado global de módulos
  let currentModule = 'arqueo';
  let currentLeadTab = 'salon'; // 'salon' o 'academia'

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

  // --- TOAST NOTIFICATIONS ---
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
    }, 3500);
  }

  // --- NAVEGACIÓN ENTRE MÓDULOS DEL MENÚ LATERAL ---
  const moduleTitles = {
    arqueo: {
      title: 'Arqueo Diario de Caja',
      desc: 'Registro oficial de apertura, movimientos, conteo y conciliación'
    },
    historial: {
      title: 'Reportes Diarios de Arqueo',
      desc: 'Consulta y descarga de reportes oficiales guardados en Firebase'
    },
    balancescore: {
      title: 'BalanceScore por Estaciones',
      desc: 'Medición de metas, cumplimiento de estándares y calidad por estación'
    },
    ingresos: {
      title: 'Reporte Diario de Ingresos',
      desc: 'Análisis de ventas por método de pago y unidad de negocio'
    },
    interesadas: {
      title: 'Reporte de Interesadas, Solo Preguntan y Cierres',
      desc: 'Embudo de conversión comercial independiente para Salón y Academia'
    },
    campana: {
      title: 'Campaña y Eventos del Mes',
      desc: 'Promociones activas, paquetes vigentes y calendario mensual'
    }
  };

  function switchModule(modKey) {
    currentModule = modKey;

    // Actualizar sidebar links
    document.querySelectorAll('.menu-item-link').forEach(link => {
      if (link.dataset.module === modKey) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Actualizar vistas
    document.querySelectorAll('.module-view').forEach(view => {
      view.classList.remove('active-view');
    });
    const targetView = document.getElementById(`view-${modKey}`);
    if (targetView) targetView.classList.add('active-view');

    // Actualizar títulos del header
    const info = moduleTitles[modKey] || { title: 'Total Beauty', desc: '' };
    document.getElementById('topbar-module-title').textContent = info.title;
    document.getElementById('topbar-module-desc').textContent = info.desc;

    // Cerrar sidebar en pantallas chicas
    document.getElementById('app-sidebar')?.classList.remove('open');

    // Inicializaciones específicas por módulo
    if (modKey === 'historial') {
      loadHistorial();
    } else if (modKey === 'balancescore') {
      renderBalanceScoreStations();
    } else if (modKey === 'ingresos') {
      renderIngresosReport();
    } else if (modKey === 'interesadas') {
      loadInteresadasData();
    } else if (modKey === 'campana') {
      renderCampanaEventos();
    }
  }

  // --- CANVAS DE FIRMA DIGITAL ---
  function initSignaturePad() {
    if (!signaturePad) return;
    signatureCtx = signaturePad.getContext('2d');
    signatureCtx.lineWidth = 2.5;
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    signatureCtx.strokeStyle = '#0f172a';

    function getCoords(e) {
      const rect = signaturePad.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = signaturePad.width / rect.width;
      const scaleY = signaturePad.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function startDraw(e) {
      e.preventDefault();
      isDrawing = true;
      signatureHasData = true;
      const { x, y } = getCoords(e);
      signatureCtx.beginPath();
      signatureCtx.moveTo(x, y);
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const { x, y } = getCoords(e);
      signatureCtx.lineTo(x, y);
      signatureCtx.stroke();
    }

    function stopDraw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      isDrawing = false;
      signatureCtx.closePath();
      triggerAutoSave();
    }

    signaturePad.addEventListener('mousedown', startDraw);
    signaturePad.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    signaturePad.addEventListener('touchstart', startDraw, { passive: false });
    signaturePad.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDraw);
    window.addEventListener('touchcancel', stopDraw);

    document.getElementById('btn-clear-signature')?.addEventListener('click', clearSignature);
  }

  function clearSignature() {
    if (!signaturePad || !signatureCtx) return;
    signatureCtx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    signatureHasData = false;
    triggerAutoSave();
  }

  // --- CÁLCULOS MATEMÁTICOS DE ARQUEO ---
  function recalculateAll() {
    // 1. Fondo Inicial
    const fCaja = parseVal('f_inicial_caja');
    const fChica = parseVal('f_inicial_chica');
    const fTotal = fCaja + fChica;
    setDisplay('f_total_inicial', fTotal);

    // 2. Ingresos del Día
    let totEfec = 0;
    let totTransf = 0;
    let totTarj = 0;

    const filasIng = ['servicios', 'anticipos', 'cursos', 'productos', 'saldos', 'otros'];
    filasIng.forEach(key => {
      const e = parseVal(`ing_${key}_efec`);
      const t = parseVal(`ing_${key}_transf`);
      const j = parseVal(`ing_${key}_tarj`);
      const rowTot = e + t + j;
      setDisplay(`ing_${key}_total`, rowTot);
      totEfec += e;
      totTransf += t;
      totTarj += j;
    });

    const granTotalIngresos = totEfec + totTransf + totTarj;
    setDisplay('ing_total_efectivo', totEfec);
    setDisplay('ing_total_transf', totTransf);
    setDisplay('ing_total_tarjeta', totTarj);
    setDisplay('ing_gran_total', granTotalIngresos);

    // 3. Salidas de Dinero
    let totSalidas = 0;
    let totRetiros = 0;
    let totGastosSinRetiro = 0;

    const salidaRows = document.querySelectorAll('.salida-row');
    salidaRows.forEach(row => {
      const impInput = row.querySelector('.salida-importe');
      const val = parseFloat(impInput?.value) || 0;
      totSalidas += val;
      if (row.classList.contains('is-retiro')) {
        totRetiros += val;
      } else {
        totGastosSinRetiro += val;
      }
    });
    setDisplay('salidas_total_efectivo', totSalidas);

    // 4. Conteo Físico
    const denominaciones = [
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
    denominaciones.forEach(item => {
      const qty = parseInt(document.getElementById(item.id)?.value, 10) || 0;
      const sub = qty * item.val;
      totalContado += sub;
      const subEl = document.getElementById(item.subId);
      if (subEl) subEl.textContent = formatCurrency(sub);
    });

    const conteoEl = document.getElementById('conteo_total_efectivo');
    if (conteoEl) conteoEl.textContent = formatCurrency(totalContado);

    // 5. Conciliación
    let concilFondo = parseVal('concil_fondo_inicial');
    if (concilFondo === 0 && fCaja > 0 && !document.getElementById('concil_fondo_inicial').dataset.manual) {
      concilFondo = fCaja;
      setDisplay('concil_fondo_inicial', concilFondo);
    }

    setDisplay('concil_ingresos_efectivo', totEfec);
    setDisplay('concil_salidas_gastos', totGastosSinRetiro);
    setDisplay('concil_retiros_resguardo', totRetiros);

    const efectivoEsperado = concilFondo + totEfec - totGastosSinRetiro - totRetiros;
    setDisplay('concil_efectivo_esperado', efectivoEsperado);
    setDisplay('concil_efectivo_contado', totalContado);

    const diferenciaCaja = totalContado - efectivoEsperado;
    setDisplay('concil_diferencia_caja', diferenciaCaja);

    // Radios resultado
    const radioCuadrada = document.getElementById('res_cuadrada');
    const radioSobrante = document.getElementById('res_sobrante');
    const radioFaltante = document.getElementById('res_faltante');

    const cardCuadrada = document.getElementById('card_res_cuadrada');
    const cardSobrante = document.getElementById('card_res_sobrante');
    const cardFaltante = document.getElementById('card_res_faltante');

    const kpiBadge = document.getElementById('kpi-status-badge');
    const difLabel = document.getElementById('concil_diferencia_label');

    cardCuadrada.className = 'resultado-radio-card';
    cardSobrante.className = 'resultado-radio-card';
    cardFaltante.className = 'resultado-radio-card';

    if (Math.abs(diferenciaCaja) < 0.005) {
      radioCuadrada.checked = true;
      cardCuadrada.classList.add('active-cuadrada');
      if (kpiBadge) {
        kpiBadge.textContent = 'Cuadrada';
        kpiBadge.className = 'kpi-status-badge badge-cuadrada';
      }
      if (difLabel) {
        difLabel.textContent = '✅ Caja cuadrada exacta';
        difLabel.style.color = 'var(--success)';
      }
    } else if (diferenciaCaja > 0.005) {
      radioSobrante.checked = true;
      cardSobrante.classList.add('active-sobrante');
      if (kpiBadge) {
        kpiBadge.textContent = `Sobrante: ${formatCurrency(diferenciaCaja)}`;
        kpiBadge.className = 'kpi-status-badge badge-sobrante';
      }
      if (difLabel) {
        difLabel.textContent = `🟡 Sobrante de ${formatCurrency(diferenciaCaja)}`;
        difLabel.style.color = 'var(--warning)';
      }
    } else {
      radioFaltante.checked = true;
      cardFaltante.classList.add('active-faltante');
      if (kpiBadge) {
        kpiBadge.textContent = `Faltante: ${formatCurrency(Math.abs(diferenciaCaja))}`;
        kpiBadge.className = 'kpi-status-badge badge-faltante';
      }
      if (difLabel) {
        difLabel.textContent = `🔴 Faltante de ${formatCurrency(Math.abs(diferenciaCaja))}`;
        difLabel.style.color = 'var(--danger)';
      }
    }

    // 6. Control Pagos
    const tReg = parseVal('ctrl_transf_reg');
    const tVer = parseVal('ctrl_transf_verif');
    const tDif = tVer - tReg;
    setDisplay('ctrl_transf_dif', tDif);

    const jReg = parseVal('ctrl_tarj_reg');
    const jVer = parseVal('ctrl_tarj_verif');
    const jDif = jVer - jReg;
    setDisplay('ctrl_tarj_dif', jDif);

    const oReg = parseVal('ctrl_otros_reg');
    const oVer = parseVal('ctrl_otros_verif');
    const oDif = oVer - oReg;
    setDisplay('ctrl_otros_dif', oDif);

    const totCtrlReg = tReg + jReg + oReg;
    const totCtrlVer = tVer + jVer + oVer;
    const totCtrlDif = totCtrlVer - totCtrlReg;
    setDisplay('ctrl_total_reg', totCtrlReg);
    setDisplay('ctrl_total_verif', totCtrlVer);
    setDisplay('ctrl_total_dif', totCtrlDif);

    // 7. Anticipos
    let totAntPago = 0;
    let totAntSaldo = 0;
    document.querySelectorAll('.anticipo-row').forEach(r => {
      const p = parseFloat(r.querySelector('.ant-pago')?.value) || 0;
      const s = parseFloat(r.querySelector('.ant-saldo')?.value) || 0;
      totAntPago += p;
      totAntSaldo += s;
    });
    setDisplay('ant_total_pago', totAntPago);
    setDisplay('ant_total_saldo', totAntSaldo);

    // 8. Resumen
    setDisplay('resumen_total_ingresos', granTotalIngresos);
    setDisplay('resumen_total_salidas', totSalidas);
    setDisplay('resumen_total_efectivo', totalContado);
    setDisplay('resumen_total_transf', tVer);
    setDisplay('resumen_total_tarjetas', jVer + oVer);
    setDisplay('resumen_total_retiros', totRetiros);
    setDisplay('resumen_diferencia_caja', diferenciaCaja);

    // Header sync
    const respHeader = document.getElementById('header_responsable')?.value || '';
    const valNombreInput = document.getElementById('val_responsable_nombre');
    if (valNombreInput && (!valNombreInput.value || valNombreInput.dataset.synced === 'true')) {
      valNombreInput.value = respHeader;
      valNombreInput.dataset.synced = 'true';
    }

    // Top KPIs
    setDisplay('kpi-ingresos', granTotalIngresos);
    setDisplay('kpi-salidas', totSalidas);
    setDisplay('kpi-efectivo-contado', totalContado);
    setDisplay('kpi-diferencia', diferenciaCaja);
  }

  // --- SERIALIZAR DATOS DE ARQUEO ---
  function serializeForm() {
    const data = {
      header: {
        fecha: document.getElementById('header_fecha')?.value || '',
        responsable: document.getElementById('header_responsable')?.value || '',
        hora: document.getElementById('header_hora')?.value || ''
      },
      fondoInicial: {
        caja: parseVal('f_inicial_caja'),
        chica: parseVal('f_inicial_chica'),
        total: parseVal('f_total_inicial')
      },
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
      salidas: [],
      conteo: {
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
        m050:  parseInt(document.getElementById('moneda_050')?.value, 10) || 0,
        total: parseVal('conteo_total_efectivo')
      },
      conciliacion: {
        fondoManual: document.getElementById('concil_fondo_inicial')?.dataset.manual === 'true',
        fondo: parseVal('concil_fondo_inicial'),
        esperado: parseVal('concil_efectivo_esperado'),
        contado: parseVal('concil_efectivo_contado'),
        diferencia: parseVal('concil_diferencia_caja'),
        resultado: document.querySelector('input[name="resultado_arqueo"]:checked')?.value || 'cuadrada',
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
      anticipos: [],
      resumen: {
        numServicios: document.getElementById('resumen_num_servicios')?.value || '',
        numAnticipos: document.getElementById('resumen_num_anticipos')?.value || '',
        numCursos: document.getElementById('resumen_num_cursos')?.value || '',
        obsDia: document.getElementById('resumen_observaciones_dia')?.value || ''
      },
      validacion: {
        responsableNombre: document.getElementById('val_responsable_nombre')?.value || '',
        horaCierre: document.getElementById('val_hora_cierre')?.value || '',
        horaEntrega: document.getElementById('val_hora_entrega')?.value || '',
        entregadoA: document.getElementById('val_entregado_a')?.value || '',
        importeEntregado: parseVal('val_importe_entregado'),
        observaciones: document.getElementById('val_observaciones')?.value || '',
        signatureData: signatureHasData && signaturePad ? signaturePad.toDataURL() : null
      }
    };

    document.querySelectorAll('.salida-row').forEach(r => {
      data.salidas.push({
        concepto: r.querySelector('.salida-concepto')?.value || '',
        motivo: r.querySelector('.salida-motivo')?.value || '',
        autorizo: r.querySelector('.salida-autorizo')?.value || '',
        importe: parseFloat(r.querySelector('.salida-importe')?.value) || 0,
        isRetiro: r.classList.contains('is-retiro')
      });
    });

    document.querySelectorAll('.anticipo-row').forEach(r => {
      data.anticipos.push({
        clienta: r.querySelector('.ant-clienta')?.value || '',
        concepto: r.querySelector('.ant-concepto')?.value || '',
        pago: parseFloat(r.querySelector('.ant-pago')?.value) || 0,
        saldo: parseFloat(r.querySelector('.ant-saldo')?.value) || 0
      });
    });

    return data;
  }

  function loadFormData(d) {
    if (!d) return;
    if (d.header) {
      document.getElementById('header_fecha').value = d.header.fecha || '';
      document.getElementById('header_responsable').value = d.header.responsable || '';
      document.getElementById('header_hora').value = d.header.hora || '';
    }
    if (d.fondoInicial) {
      document.getElementById('f_inicial_caja').value = (d.fondoInicial.caja || 0).toFixed(2);
      document.getElementById('f_inicial_chica').value = (d.fondoInicial.chica || 0).toFixed(2);
    }
    if (d.ingresos) {
      ['servicios', 'anticipos', 'cursos', 'productos', 'saldos', 'otros'].forEach(k => {
        if (d.ingresos[k]) {
          document.getElementById(`ing_${k}_efec`).value = (d.ingresos[k].e || 0).toFixed(2);
          document.getElementById(`ing_${k}_transf`).value = (d.ingresos[k].t || 0).toFixed(2);
          document.getElementById(`ing_${k}_tarj`).value = (d.ingresos[k].j || 0).toFixed(2);
        }
      });
      document.getElementById('ing_operaciones_cobradas').value = d.ingresos.operaciones || '';
    }

    if (d.conteo) {
      document.getElementById('billete_1000').value = d.conteo.b1000 || 0;
      document.getElementById('billete_500').value  = d.conteo.b500 || 0;
      document.getElementById('billete_200').value  = d.conteo.b200 || 0;
      document.getElementById('billete_100').value  = d.conteo.b100 || 0;
      document.getElementById('billete_50').value   = d.conteo.b50 || 0;
      document.getElementById('billete_20').value   = d.conteo.b20 || 0;
      document.getElementById('moneda_10').value    = d.conteo.m10 || 0;
      document.getElementById('moneda_5').value     = d.conteo.m5 || 0;
      document.getElementById('moneda_2').value     = d.conteo.m2 || 0;
      document.getElementById('moneda_1').value     = d.conteo.m1 || 0;
      document.getElementById('moneda_050').value   = d.conteo.m050 || 0;
    }

    if (d.conciliacion) {
      document.getElementById('concil_fondo_inicial').value = (d.conciliacion.fondo || 0).toFixed(2);
      document.getElementById('concil_explicacion').value = d.conciliacion.explicacion || '';
    }

    if (d.controlPagos) {
      document.getElementById('ctrl_transf_reg').value = (d.controlPagos.transfReg || 0).toFixed(2);
      document.getElementById('ctrl_transf_verif').value = (d.controlPagos.transfVer || 0).toFixed(2);
      document.getElementById('ctrl_tarj_reg').value = (d.controlPagos.tarjReg || 0).toFixed(2);
      document.getElementById('ctrl_tarj_verif').value = (d.controlPagos.tarjVer || 0).toFixed(2);
      document.getElementById('ctrl_otros_reg').value = (d.controlPagos.otrosReg || 0).toFixed(2);
      document.getElementById('ctrl_otros_verif').value = (d.controlPagos.otrosVer || 0).toFixed(2);
    }

    if (d.resumen) {
      document.getElementById('resumen_num_servicios').value = d.resumen.numServicios || '';
      document.getElementById('resumen_num_anticipos').value = d.resumen.numAnticipos || '';
      document.getElementById('resumen_num_cursos').value = d.resumen.numCursos || '';
      document.getElementById('resumen_observaciones_dia').value = d.resumen.obsDia || '';
    }

    if (d.validacion) {
      document.getElementById('val_responsable_nombre').value = d.validacion.responsableNombre || '';
      document.getElementById('val_hora_cierre').value = d.validacion.horaCierre || '';
      document.getElementById('val_hora_entrega').value = d.validacion.horaEntrega || '';
      document.getElementById('val_entregado_a').value = d.validacion.entregadoA || '';
      document.getElementById('val_importe_entregado').value = (d.validacion.importeEntregado || 0).toFixed(2);
      document.getElementById('val_observaciones').value = d.validacion.observaciones || '';

      if (d.validacion.signatureData && signaturePad && signatureCtx) {
        const img = new Image();
        img.onload = () => {
          signatureCtx.drawImage(img, 0, 0);
          signatureHasData = true;
        };
        img.src = d.validacion.signatureData;
      }
    }

    recalculateAll();
  }

  let autoSaveTimeout = null;
  function triggerAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('totalbeauty_arqueo_draft', JSON.stringify(serializeForm()));
      } catch (e) {}
    }, 800);
  }

  // --- GUARDAR EN FIREBASE ---
  async function saveToFirebaseAction() {
    const fecha = document.getElementById('header_fecha').value;
    const resp = document.getElementById('header_responsable').value.trim();

    if (!fecha) {
      showToast('Por favor ingrese la fecha del arqueo', 'warning');
      document.getElementById('header_fecha').focus();
      return;
    }
    if (!resp) {
      showToast('Por favor ingrese el responsable de caja', 'warning');
      document.getElementById('header_responsable').focus();
      return;
    }

    showToast('Guardando arqueo en Firebase...', 'info');

    const data = serializeForm();
    const result = await TB_FIREBASE.saveArqueo(data);

    if (result.success) {
      showToast(`¡Arqueo guardado exitosamente en ${result.source === 'firebase' ? 'Firebase Cloud' : 'Almacenamiento Local'}!`, 'success');
    } else {
      showToast('Error al guardar el arqueo', 'warning');
    }
  }

  // --- SINCRONIZAR REPORTE OFICIAL PDF ---
  function syncPrintableReport() {
    recalculateAll();

    const rawFecha = document.getElementById('header_fecha').value;
    let fechaTxt = '__ / __ / ____';
    let fileFecha = 'Sin_Fecha';
    if (rawFecha) {
      const parts = rawFecha.split('-');
      if (parts.length === 3) {
        fechaTxt = `${parts[2]} / ${parts[1]} / ${parts[0]}`;
        fileFecha = rawFecha;
      }
    }
    document.getElementById('p_fecha').textContent = fechaTxt;

    const respNombre = document.getElementById('header_responsable').value || '________________________';
    document.getElementById('p_responsable').textContent = respNombre;
    document.getElementById('p_hora').textContent = document.getElementById('header_hora').value || '______';

    // 1. Fondo Inicial
    document.getElementById('p_f_caja').textContent = formatCurrency(parseVal('f_inicial_caja'));
    document.getElementById('p_f_chica').textContent = formatCurrency(parseVal('f_inicial_chica'));
    document.getElementById('p_f_total').textContent = formatCurrency(parseVal('f_total_inicial'));

    // 2. Ingresos
    const rows = ['servicios', 'anticipos', 'cursos', 'productos', 'saldos', 'otros'];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      document.getElementById(`p_ing_${r}_e`).textContent = formatCurrency(parseVal(`ing_${r}_efec`));
      document.getElementById(`p_ing_${r}_t`).textContent = formatCurrency(parseVal(`ing_${r}_transf`));
      document.getElementById(`p_ing_${r}_j`).textContent = formatCurrency(parseVal(`ing_${r}_tarj`));
      document.getElementById(`p_ing_${r}_tot`).textContent = formatCurrency(parseVal(`ing_${r}_total`));
    }
    document.getElementById('p_ing_tot_e').textContent = formatCurrency(parseVal('ing_total_efectivo'));
    document.getElementById('p_ing_tot_t').textContent = formatCurrency(parseVal('ing_total_transf'));
    document.getElementById('p_ing_tot_j').textContent = formatCurrency(parseVal('ing_total_tarjeta'));
    document.getElementById('p_ing_tot_gran').textContent = formatCurrency(parseVal('ing_gran_total'));
    document.getElementById('p_operaciones').textContent = document.getElementById('ing_operaciones_cobradas').value || '0';

    // 3. Salidas
    const pTbodySalidas = document.getElementById('p_tbody_salidas');
    pTbodySalidas.innerHTML = '';
    document.querySelectorAll('.salida-row').forEach(row => {
      const c = row.querySelector('.salida-concepto')?.value || '';
      const m = row.querySelector('.salida-motivo')?.value || '';
      const a = row.querySelector('.salida-autorizo')?.value || '';
      const imp = parseFloat(row.querySelector('.salida-importe')?.value) || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c}</td><td>${m}</td><td>${a}</td><td class="amount">${formatCurrency(imp)}</td>`;
      pTbodySalidas.appendChild(tr);
    });
    document.getElementById('p_salidas_tot').textContent = formatCurrency(parseVal('salidas_total_efectivo'));

    // 4. Conteo Físico
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

    let totalContado = 0;
    denoms.forEach(item => {
      const q = parseInt(document.getElementById(item.id)?.value, 10) || 0;
      const sub = q * item.val;
      totalContado += sub;
      document.getElementById(item.qId).textContent = q > 0 ? q : '';
      document.getElementById(item.tId).textContent = formatCurrency(sub);
    });
    document.getElementById('p_conteo_tot').textContent = formatCurrency(totalContado);

    // 5. Conciliación
    document.getElementById('p_concil_fondo').textContent = formatCurrency(parseVal('concil_fondo_inicial'));
    document.getElementById('p_concil_ingresos').textContent = formatCurrency(parseVal('concil_ingresos_efectivo'));
    document.getElementById('p_concil_salidas').textContent = formatCurrency(parseVal('concil_salidas_gastos'));
    document.getElementById('p_concil_retiros').textContent = formatCurrency(parseVal('concil_retiros_resguardo'));
    document.getElementById('p_concil_esperado').textContent = formatCurrency(parseVal('concil_efectivo_esperado'));
    document.getElementById('p_concil_contado').textContent = formatCurrency(totalContado);
    document.getElementById('p_concil_diferencia').textContent = formatCurrency(parseVal('concil_diferencia_caja'));

    const res = document.querySelector('input[name="resultado_arqueo"]:checked')?.value || 'cuadrada';
    document.getElementById('p_box_cuadrada').textContent = res === 'cuadrada' ? '✓' : '';
    document.getElementById('p_box_sobrante').textContent = res === 'sobrante' ? '✓' : '';
    document.getElementById('p_box_faltante').textContent = res === 'faltante' ? '✓' : '';

    const expText = document.getElementById('concil_explicacion').value.trim();
    document.getElementById('p_explicacion').textContent = expText || 'Sin diferencias registradas.';

    // 6. Control Pagos
    document.getElementById('p_ctrl_transf_reg').textContent = formatCurrency(parseVal('ctrl_transf_reg'));
    document.getElementById('p_ctrl_transf_ver').textContent = formatCurrency(parseVal('ctrl_transf_verif'));
    document.getElementById('p_ctrl_transf_dif').textContent = formatCurrency(parseVal('ctrl_transf_dif'));

    document.getElementById('p_ctrl_tarj_reg').textContent = formatCurrency(parseVal('ctrl_tarj_reg'));
    document.getElementById('p_ctrl_tarj_ver').textContent = formatCurrency(parseVal('ctrl_tarj_verif'));
    document.getElementById('p_ctrl_tarj_dif').textContent = formatCurrency(parseVal('ctrl_tarj_dif'));

    document.getElementById('p_ctrl_otros_reg').textContent = formatCurrency(parseVal('ctrl_otros_reg'));
    document.getElementById('p_ctrl_otros_ver').textContent = formatCurrency(parseVal('ctrl_otros_verif'));
    document.getElementById('p_ctrl_otros_dif').textContent = formatCurrency(parseVal('ctrl_otros_dif'));

    document.getElementById('p_ctrl_tot_reg').textContent = formatCurrency(parseVal('ctrl_total_reg'));
    document.getElementById('p_ctrl_tot_ver').textContent = formatCurrency(parseVal('ctrl_total_verif'));
    document.getElementById('p_ctrl_tot_dif').textContent = formatCurrency(parseVal('ctrl_total_dif'));

    // 7. Anticipos
    const pTbodyAnt = document.getElementById('p_tbody_anticipos');
    pTbodyAnt.innerHTML = '';
    let hasAnyAnticipo = false;
    document.querySelectorAll('.anticipo-row').forEach(r => {
      const c = r.querySelector('.ant-clienta')?.value || '';
      const con = r.querySelector('.ant-concepto')?.value || '';
      const p = parseFloat(r.querySelector('.ant-pago')?.value) || 0;
      const s = parseFloat(r.querySelector('.ant-saldo')?.value) || 0;
      if (c || con || p > 0 || s > 0) {
        hasAnyAnticipo = true;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${c}</td><td>${con}</td><td class="amount">${formatCurrency(p)}</td><td class="amount">${formatCurrency(s)}</td>`;
        pTbodyAnt.appendChild(tr);
      }
    });

    if (!hasAnyAnticipo) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="color:#9ca3af; font-style:italic;">Ninguno</td><td></td><td class="amount">$0.00</td><td class="amount">$0.00</td>`;
      pTbodyAnt.appendChild(tr);
    }
    document.getElementById('p_ant_tot_pago').textContent = formatCurrency(parseVal('ant_total_pago'));
    document.getElementById('p_ant_tot_saldo').textContent = formatCurrency(parseVal('ant_total_saldo'));

    // 8. Resumen
    document.getElementById('p_res_ingresos').textContent = formatCurrency(parseVal('resumen_total_ingresos'));
    document.getElementById('p_res_salidas').textContent = formatCurrency(parseVal('resumen_total_salidas'));
    document.getElementById('p_res_contado').textContent = formatCurrency(parseVal('resumen_total_efectivo'));
    document.getElementById('p_res_transf').textContent = formatCurrency(parseVal('resumen_total_transf'));
    document.getElementById('p_res_tarjetas').textContent = formatCurrency(parseVal('resumen_total_tarjetas'));
    document.getElementById('p_res_retiros').textContent = formatCurrency(parseVal('resumen_total_retiros'));
    document.getElementById('p_res_diferencia').textContent = formatCurrency(parseVal('resumen_diferencia_caja'));
    document.getElementById('p_res_num_servicios').textContent = document.getElementById('resumen_num_servicios').value || '0';
    document.getElementById('p_res_num_anticipos').textContent = document.getElementById('resumen_num_anticipos').value || '0';
    document.getElementById('p_res_num_cursos').textContent = document.getElementById('resumen_num_cursos').value || '0';

    const obsDia = document.getElementById('resumen_observaciones_dia').value.trim();
    document.getElementById('p_obs_dia').textContent = obsDia || 'Sin observaciones registradas durante la jornada.';

    // 9. Validación
    const valNombre = document.getElementById('val_responsable_nombre').value || respNombre;
    document.getElementById('p_val_nombre').textContent = valNombre;

    const firmaImg = document.getElementById('p_val_firma_img');
    const firmaBlank = document.getElementById('p_val_firma_blank');
    if (signatureHasData && signaturePad) {
      firmaImg.src = signaturePad.toDataURL('image/png');
      firmaImg.style.display = 'block';
      firmaBlank.style.display = 'none';
    } else {
      firmaImg.style.display = 'none';
      firmaBlank.style.display = 'inline-block';
    }

    document.getElementById('p_val_hora_cierre').textContent = document.getElementById('val_hora_cierre').value || '______';
    document.getElementById('p_val_hora_entrega').textContent = document.getElementById('val_hora_entrega').value || '______';
    document.getElementById('p_val_entregado_a').textContent = document.getElementById('val_entregado_a').value || '________________________';
    document.getElementById('p_val_importe_entregado').textContent = formatCurrency(parseVal('val_importe_entregado'));

    const obsVal = document.getElementById('val_observaciones').value.trim();
    document.getElementById('p_val_observaciones').textContent = obsVal || 'Sin observaciones de entrega.';

    const cleanNombre = valNombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, '').trim().replace(/\s+/g, '_');
    return `Arqueo_Caja_${fileFecha}_${cleanNombre || 'Responsable'}.pdf`;
  }

  function exportToPDF() {
    const fecha = document.getElementById('header_fecha').value;
    const resp = document.getElementById('header_responsable').value.trim();

    if (!fecha) {
      showToast('Por favor ingrese la fecha del arqueo', 'warning');
      document.getElementById('header_fecha').focus();
      return;
    }
    if (!resp) {
      showToast('Por favor ingrese el responsable de caja', 'warning');
      document.getElementById('header_responsable').focus();
      return;
    }

    showToast('Generando reporte en PDF...', 'info');

    const pdfFileName = syncPrintableReport();
    const element = document.getElementById('printable-report');
    element.style.display = 'block';

    const opt = {
      margin:       [10, 12, 10, 12],
      filename:     pdfFileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    if (window.html2pdf) {
      window.html2pdf().set(opt).from(element).save().then(() => {
        element.style.display = 'none';
        showToast(`Reporte descargado: ${pdfFileName}`, 'success');
      }).catch(err => {
        console.error('Error generando PDF', err);
        element.style.display = 'none';
        window.print();
      });
    } else {
      element.style.display = 'none';
      window.print();
    }
  }

  // --- MÓDULO 2: HISTORIAL DE ARQUEOS ---
  async function loadHistorial(filterDate = null) {
    const container = document.getElementById('history-grid-container');
    const emptyState = document.getElementById('historial-empty-state');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--muted);">Cargando arqueos de Firebase...</div>';

    const list = await TB_FIREBASE.getArqueosList();
    const keys = Object.keys(list).sort().reverse();

    container.innerHTML = '';
    let filteredKeys = keys;
    if (filterDate) {
      filteredKeys = keys.filter(k => k.startsWith(filterDate));
    }

    if (filteredKeys.length === 0) {
      emptyState.style.display = 'block';
      return;
    } else {
      emptyState.style.display = 'none';
    }

    filteredKeys.forEach(k => {
      const item = list[k];
      const card = document.createElement('div');
      card.className = 'history-item-card';

      const resBadgeClass = item.conciliacion?.resultado === 'cuadrada' ? 'badge-cuadrada' :
                            (item.conciliacion?.resultado === 'sobrante' ? 'badge-sobrante' : 'badge-faltante');
      const resText = item.conciliacion?.resultado === 'cuadrada' ? 'Cuadrada' :
                      (item.conciliacion?.resultado === 'sobrante' ? 'Sobrante' : 'Faltante');

      card.innerHTML = `
        <div class="history-card-header">
          <div>
            <div class="history-date">📅 ${item.header?.fecha || 'Sin Fecha'}</div>
            <div class="history-responsable">👤 ${item.header?.responsable || 'Sin asignar'} (${item.header?.hora || ''})</div>
          </div>
          <span class="kpi-status-badge ${resBadgeClass}">${resText}</span>
        </div>
        <div class="history-metrics">
          <div class="history-metric-box">
            <div class="label">Ingresos Totales</div>
            <div class="val">${formatCurrency(item.ingresos?.totales?.granTotal || 0)}</div>
          </div>
          <div class="history-metric-box">
            <div class="label">Efectivo Contado</div>
            <div class="val">${formatCurrency(item.conteo?.total || 0)}</div>
          </div>
          <div class="history-metric-box">
            <div class="label">Salidas Caja</div>
            <div class="val">${formatCurrency(item.salidas?.reduce((acc, s) => acc + (s.importe || 0), 0) || 0)}</div>
          </div>
          <div class="history-metric-box">
            <div class="label">Diferencia</div>
            <div class="val" style="color:${Math.abs(item.conciliacion?.diferencia || 0) < 0.01 ? 'var(--success)' : 'var(--danger)'}">
              ${formatCurrency(item.conciliacion?.diferencia || 0)}
            </div>
          </div>
        </div>
        <div class="history-card-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-load-past" style="flex:1;">
            <span>✏️</span> Cargar en Arqueo
          </button>
          <button type="button" class="btn btn-primary btn-sm btn-pdf-past">
            <span>📄</span> PDF
          </button>
        </div>
      `;

      card.querySelector('.btn-load-past').addEventListener('click', () => {
        loadFormData(item);
        switchModule('arqueo');
        showToast(`Arqueo del ${item.header?.fecha} cargado en el formulario`, 'info');
      });

      card.querySelector('.btn-pdf-past').addEventListener('click', () => {
        loadFormData(item);
        exportToPDF();
      });

      container.appendChild(card);
    });
  }

  // --- MÓDULO 3: BALANCESCORE POR ESTACIONES ---
  const DEFAULT_STATIONS = [
    { id: 'cabello', name: 'Cabello & Colorimetría', icon: '💇‍♀️', meta: 2200, lograda: 2450, clientesMeta: 6, clientesReales: 7, ticket: 350, score: 98, checks: [true, true, true, true] },
    { id: 'unas', name: 'Uñas & Manicure', icon: '💅', meta: 1500, lograda: 1680, clientesMeta: 5, clientesReales: 6, ticket: 280, score: 95, checks: [true, true, true, true] },
    { id: 'maquillaje', name: 'Maquillaje Profesional', icon: '💄', meta: 1200, lograda: 1200, clientesMeta: 3, clientesReales: 3, ticket: 400, score: 92, checks: [true, true, false, true] },
    { id: 'pestanas', name: 'Lash & Brow Bar (Pestañas)', icon: '👁️', meta: 1000, lograda: 850, clientesMeta: 4, clientesReales: 3, ticket: 283, score: 85, checks: [true, true, true, false] },
    { id: 'pedicure', name: 'Pedicure & Spa de Pies', icon: '🦶', meta: 800, lograda: 920, clientesMeta: 4, clientesReales: 5, ticket: 184, score: 96, checks: [true, true, true, true] },
    { id: 'facial', name: 'Cabina Facial & Estética', icon: '✨', meta: 900, lograda: 750, clientesMeta: 3, clientesReales: 2, ticket: 375, score: 82, checks: [true, true, false, true] }
  ];

  function renderBalanceScoreStations() {
    const container = document.getElementById('stations-grid-container');
    container.innerHTML = '';

    const fechaEl = document.getElementById('bs_fecha');
    if (!fechaEl.value) {
      fechaEl.value = new Date().toISOString().split('T')[0];
    }

    let totalScore = 0;

    DEFAULT_STATIONS.forEach(st => {
      totalScore += st.score;
      const card = document.createElement('div');
      card.className = 'station-card';
      const pctLogrado = Math.min(100, Math.round((st.lograda / st.meta) * 100));

      card.innerHTML = `
        <div class="station-card-header">
          <div class="station-title">
            <span>${st.icon}</span>
            <span>${st.name}</span>
          </div>
          <span class="station-score-badge">${st.score}%</span>
        </div>
        <div class="station-card-body">
          <div class="station-progress-wrap">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700;">
              <span>Cumplimiento Financiero: ${pctLogrado}%</span>
              <span>${formatCurrency(st.lograda)} / ${formatCurrency(st.meta)}</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${pctLogrado}%; background:${pctLogrado >= 100 ? '#10b981' : (pctLogrado >= 80 ? '#f59e0b' : '#ef4444')}"></div>
            </div>
          </div>

          <div class="station-metrics-row">
            <div class="history-metric-box">
              <div class="label">Clientes Atendidos</div>
              <div class="val">${st.clientesReales} / Meta: ${st.clientesMeta}</div>
            </div>
            <div class="history-metric-box">
              <div class="label">Ticket Promedio</div>
              <div class="val">${formatCurrency(st.ticket)}</div>
            </div>
          </div>

          <div class="checklist-group">
            <span style="font-size:0.75rem; font-weight:700; color:var(--muted); text-transform:uppercase;">Estándares de Calidad:</span>
            <label class="checklist-item">
              <input type="checkbox" ${st.checks[0] ? 'checked' : ''}> Limpieza y sanitización de estación
            </label>
            <label class="checklist-item">
              <input type="checkbox" ${st.checks[1] ? 'checked' : ''}> Puntualidad en arranque de servicio
            </label>
            <label class="checklist-item">
              <input type="checkbox" ${st.checks[2] ? 'checked' : ''}> Protocolo y hospitalidad Total Beauty
            </label>
            <label class="checklist-item">
              <input type="checkbox" ${st.checks[3] ? 'checked' : ''}> Venta cruzada / producto de apoyo en casa
            </label>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    const avgScore = Math.round(totalScore / DEFAULT_STATIONS.length);
    const badge = document.getElementById('bs-overall-badge');
    badge.textContent = `Score General Salón: ${avgScore}%`;
  }

  // --- MÓDULO 4: REPORTE DIARIO DE INGRESOS ---
  function renderIngresosReport() {
    const fechaInput = document.getElementById('rep_ingresos_fecha');
    if (!fechaInput.value) {
      fechaInput.value = new Date().toISOString().split('T')[0];
    }

    const efec = parseVal('ing_total_efectivo');
    const transf = parseVal('ing_total_transf');
    const tarj = parseVal('ing_total_tarjeta');
    const total = efec + transf + tarj;

    const servTotal = parseVal('ing_servicios_total') + parseVal('ing_anticipos_total') + parseVal('ing_saldos_total');
    const acadTotal = parseVal('ing_cursos_total');
    const retailTotal = parseVal('ing_productos_total') + parseVal('ing_otros_total');

    // KPIs
    document.getElementById('kpi-ingreso-total').textContent = formatCurrency(total);
    const pctMeta = total > 0 ? Math.round((total / 5000) * 100) : 0;
    document.getElementById('kpi-ingreso-cumplimiento').textContent = `${pctMeta}%`;

    let pred = 'Efectivo';
    if (tarj > efec && tarj > transf) pred = 'Tarjeta';
    if (transf > efec && transf > tarj) pred = 'Transferencia';
    document.getElementById('kpi-ingreso-metodo').textContent = pred;

    // Métodos
    document.getElementById('rep_efectivo_val').textContent = formatCurrency(efec);
    document.getElementById('rep_efectivo_pct').textContent = total > 0 ? `${Math.round((efec / total) * 100)}%` : '0%';
    document.getElementById('rep_tarjeta_val').textContent = formatCurrency(tarj);
    document.getElementById('rep_tarjeta_pct').textContent = total > 0 ? `${Math.round((tarj / total) * 100)}%` : '0%';
    document.getElementById('rep_transf_val').textContent = formatCurrency(transf);
    document.getElementById('rep_transf_pct').textContent = total > 0 ? `${Math.round((transf / total) * 100)}%` : '0%';
    document.getElementById('rep_metodos_total').textContent = formatCurrency(total);

    // Unidades
    document.getElementById('rep_salon_val').textContent = formatCurrency(servTotal);
    document.getElementById('rep_salon_pct').textContent = total > 0 ? `${Math.round((servTotal / total) * 100)}%` : '0%';
    document.getElementById('rep_academia_val').textContent = formatCurrency(acadTotal);
    document.getElementById('rep_academia_pct').textContent = total > 0 ? `${Math.round((acadTotal / total) * 100)}%` : '0%';
    document.getElementById('rep_retail_val').textContent = formatCurrency(retailTotal);
    document.getElementById('rep_retail_pct').textContent = total > 0 ? `${Math.round((retailTotal / total) * 100)}%` : '0%';
    document.getElementById('rep_unidades_total').textContent = formatCurrency(total);
  }

  // --- MÓDULO 5: INTERESADAS, SOLO PREGUNTAN Y CIERRES ---
  const LEADS_DATA = {
    salon: { totales: 14, cierres: 5, motivos: '3 clientas querían sábado por la tarde (lleno), 2 se les hizo alto el precio de balayage.' },
    academia: { totales: 9, cierres: 3, motivos: '2 preguntaron si se podía en pagos semanales, 1 no tenía disponibilidad de horario vespertino.' }
  };

  function loadInteresadasData() {
    const fechaInput = document.getElementById('lead_fecha');
    if (!fechaInput.value) {
      fechaInput.value = new Date().toISOString().split('T')[0];
    }

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

  // --- MÓDULO 6: CAMPAÑA DEL MES Y EVENTOS ---
  const DEFAULT_EVENTS = [
    { day: '26', month: 'OCT', title: 'Apertura de Semana & Revisión de Metas', type: 'Recepción & Salón', resp: 'Marbella Ríos' },
    { day: '28', month: 'OCT', title: 'Inicio Curso Intensivo de Uñas Acrílicas', type: 'Academia', resp: 'Instructora Titular' },
    { day: '30', month: 'OCT', title: 'Viernes de Balayage & Promociones Express', type: 'Salón', resp: 'Equipo Estilistas' },
    { day: '31', month: 'OCT', title: 'Cierre de Mes, Arqueo General & Premiación', type: 'Dirección', resp: 'Administración' },
    { day: '05', month: 'NOV', title: 'Masterclass de Colorimetría y Efectos de Luz', type: 'Academia', resp: 'Master Guest' }
  ];

  function renderCampanaEventos() {
    const container = document.getElementById('events-timeline-container');
    container.innerHTML = '';

    DEFAULT_EVENTS.forEach((ev, idx) => {
      const card = document.createElement('div');
      card.className = 'event-item-card';
      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:14px;">
          <div class="event-date-badge">
            <div class="day">${ev.day}</div>
            <div class="month">${ev.month}</div>
          </div>
          <div>
            <div style="font-weight:700; color:var(--dark); font-size:0.95rem;">${ev.title}</div>
            <div style="font-size:0.8rem; color:var(--muted);">${ev.type} &bull; Responsable: <strong>${ev.resp}</strong></div>
          </div>
        </div>
        <span class="kpi-status-badge badge-cuadrada">Confirmado</span>
      `;
      container.appendChild(card);
    });
  }

  // --- EJEMPLO DE DATOS REALISTAS PARA ARQUEO ---
  function loadExampleData() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('header_fecha').value = today;
    document.getElementById('header_responsable').value = 'Marbella Ríos';
    document.getElementById('header_hora').value = '20:00';

    document.getElementById('f_inicial_caja').value = '1500.00';
    document.getElementById('f_inicial_chica').value = '500.00';

    document.getElementById('ing_servicios_efec').value = '3450.00';
    document.getElementById('ing_servicios_transf').value = '2200.00';
    document.getElementById('ing_servicios_tarj').value = '1800.00';

    document.getElementById('ing_anticipos_efec').value = '600.00';
    document.getElementById('ing_anticipos_transf').value = '400.00';

    document.getElementById('ing_cursos_efec').value = '1200.00';
    document.getElementById('ing_cursos_transf').value = '3500.00';

    document.getElementById('ing_productos_efec').value = '750.00';
    document.getElementById('ing_productos_transf').value = '250.00';
    document.getElementById('ing_productos_tarj').value = '300.00';

    document.getElementById('ing_saldos_efec').value = '500.00';
    document.getElementById('ing_operaciones_cobradas').value = '18';

    const rows = document.querySelectorAll('.salida-row');
    if (rows.length >= 5) {
      rows[0].querySelector('.salida-motivo').value = 'Tintes y peróxidos';
      rows[0].querySelector('.salida-autorizo').value = 'Marbella Ríos';
      rows[0].querySelector('.salida-importe').value = '450.00';

      rows[1].querySelector('.salida-motivo').value = 'Tratamientos capilares distribuidor';
      rows[1].querySelector('.salida-autorizo').value = 'Marbella Ríos';
      rows[1].querySelector('.salida-importe').value = '300.00';

      rows[2].querySelector('.salida-motivo').value = 'Garrafón y café recepción';
      rows[2].querySelector('.salida-autorizo').value = 'Recepción';
      rows[2].querySelector('.salida-importe').value = '120.00';

      rows[3].querySelector('.salida-motivo').value = 'Resguardo corte de caja medio día';
      rows[3].querySelector('.salida-autorizo').value = 'Dirección';
      rows[3].querySelector('.salida-importe').value = '4000.00';

      rows[4].querySelector('.salida-motivo').value = 'Propinas staff';
      rows[4].querySelector('.salida-autorizo').value = 'Recepción';
      rows[4].querySelector('.salida-importe').value = '80.00';
    }

    // Denominaciones (Esperado 3,050.00)
    document.getElementById('billete_1000').value = '2'; // 2000
    document.getElementById('billete_500').value  = '1'; // 500
    document.getElementById('billete_200').value  = '2'; // 400
    document.getElementById('billete_100').value  = '1'; // 100
    document.getElementById('billete_50').value   = '0';
    document.getElementById('billete_20').value   = '2'; // 40
    document.getElementById('moneda_10').value    = '1'; // 10

    document.getElementById('concil_fondo_inicial').value = '1500.00';
    document.getElementById('concil_explicacion').value = 'Caja entregada en perfecto orden sin diferencias.';

    document.getElementById('ctrl_transf_reg').value = '6350.00';
    document.getElementById('ctrl_transf_verif').value = '6350.00';
    document.getElementById('ctrl_tarj_reg').value = '2100.00';
    document.getElementById('ctrl_tarj_verif').value = '2100.00';

    document.getElementById('resumen_num_servicios').value = '12';
    document.getElementById('resumen_num_anticipos').value = '2';
    document.getElementById('resumen_num_cursos').value = '2';

    document.getElementById('val_responsable_nombre').value = 'Marbella Ríos';
    document.getElementById('val_hora_cierre').value = '20:15';
    document.getElementById('val_hora_entrega').value = '20:25';
    document.getElementById('val_entregado_a').value = 'Gerencia General';
    document.getElementById('val_importe_entregado').value = '3050.00';

    if (signaturePad && signatureCtx) {
      signatureCtx.clearRect(0, 0, signaturePad.width, signaturePad.height);
      signatureCtx.beginPath();
      signatureCtx.moveTo(80, 80);
      signatureCtx.bezierCurveTo(120, 20, 150, 100, 200, 50);
      signatureCtx.bezierCurveTo(240, 30, 270, 90, 340, 60);
      signatureCtx.moveTo(100, 95);
      signatureCtx.lineTo(360, 85);
      signatureCtx.stroke();
      signatureHasData = true;
    }

    recalculateAll();
    triggerAutoSave();
    showToast('Datos de ejemplo cargados en el arqueo', 'success');
  }

  function clearAllForm() {
    if (!confirm('¿Desea iniciar un nuevo arqueo de caja? Se limpiarán los datos actuales.')) return;
    localStorage.removeItem('totalbeauty_arqueo_draft');
    form.reset();
    clearSignature();

    const now = new Date();
    document.getElementById('header_fecha').value = now.toISOString().split('T')[0];
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    document.getElementById('header_hora').value = hm;
    document.getElementById('val_hora_cierre').value = hm;

    recalculateAll();
    showToast('Formulario de arqueo reiniciado', 'info');
  }

  // --- CONFIGURACIÓN DE EVENTOS AL CARGAR EL DOM ---
  document.addEventListener('DOMContentLoaded', () => {
    initSignaturePad();

    // Listeners del Sidebar Menu
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

    // Conexión Firebase status
    TB_FIREBASE.onConnectionChange((online, detail) => {
      const dot = document.getElementById('fb-status-dot');
      const text = document.getElementById('fb-status-text');
      if (dot) {
        dot.className = online ? 'status-dot' : 'status-dot offline';
      }
      if (text) {
        text.textContent = online ? 'Firebase Conectado' : 'Modo Local / Offline';
      }
    });

    // Eventos de inputs y cálculos en Arqueo
    document.addEventListener('input', (e) => {
      if (e.target.matches('.calc-trigger') || e.target.matches('.salida-importe') || e.target.matches('.ant-pago') || e.target.matches('.ant-saldo')) {
        if (e.target.id === 'concil_fondo_inicial') {
          e.target.dataset.manual = 'true';
        }
        recalculateAll();
        triggerAutoSave();
      }
      if (e.target.matches('.lead-calc-trigger')) {
        calculateLeadsFunnel();
      }
      if (e.target.id === 'header_responsable') {
        const valNombre = document.getElementById('val_responsable_nombre');
        if (valNombre) valNombre.value = e.target.value;
        triggerAutoSave();
      }
    });

    // Botones +/- en denominaciones
    document.querySelectorAll('.denom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.denomination-row');
        const input = row.querySelector('.denom-input');
        if (!input) return;
        let val = parseInt(input.value, 10) || 0;
        if (btn.dataset.action === 'inc') val += 1;
        if (btn.dataset.action === 'dec') val = Math.max(0, val - 1);
        input.value = val;
        recalculateAll();
        triggerAutoSave();
      });
    });

    // Agregar filas dinámicas
    document.getElementById('btn-add-salida')?.addEventListener('click', () => {
      const tbody = document.getElementById('tbody-salidas');
      const tr = document.createElement('tr');
      tr.className = 'salida-row';
      tr.innerHTML = `
        <td><input type="text" class="input-text salida-concepto" placeholder="Concepto..."></td>
        <td><input type="text" class="input-text salida-motivo" placeholder="Motivo..."></td>
        <td><input type="text" class="input-text salida-autorizo" placeholder="Autorizó..."></td>
        <td>
          <div class="currency-input-wrap"><span class="currency-prefix">$</span>
            <input type="number" step="0.01" min="0" class="input-currency calc-trigger salida-importe" value="0.00">
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-row" title="Eliminar fila">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
      recalculateAll();
    });

    document.getElementById('btn-add-anticipo')?.addEventListener('click', () => {
      const tbody = document.getElementById('tbody-anticipos');
      const tr = document.createElement('tr');
      tr.className = 'anticipo-row';
      tr.innerHTML = `
        <td><input type="text" class="input-text ant-clienta" placeholder="Nombre..."></td>
        <td><input type="text" class="input-text ant-concepto" placeholder="Servicio / curso..."></td>
        <td>
          <div class="currency-input-wrap"><span class="currency-prefix">$</span>
            <input type="number" step="0.01" min="0" class="input-currency calc-trigger ant-pago" value="0.00">
          </div>
        </td>
        <td>
          <div class="currency-input-wrap"><span class="currency-prefix">$</span>
            <input type="number" step="0.01" min="0" class="input-currency calc-trigger ant-saldo" value="0.00">
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-outline-danger btn-sm btn-del-row" title="Eliminar fila">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
      recalculateAll();
    });

    document.addEventListener('click', (e) => {
      if (e.target.matches('.btn-del-row') || e.target.closest('.btn-del-row')) {
        const btn = e.target.matches('.btn-del-row') ? e.target : e.target.closest('.btn-del-row');
        btn.closest('tr')?.remove();
        recalculateAll();
      }
    });

    // Botones de acción principales
    document.getElementById('btn-export-pdf')?.addEventListener('click', exportToPDF);
    document.getElementById('btn-export-pdf-bottom')?.addEventListener('click', exportToPDF);
    document.getElementById('btn-save-firebase')?.addEventListener('click', saveToFirebaseAction);
    document.getElementById('btn-save-firebase-bottom')?.addEventListener('click', saveToFirebaseAction);
    document.getElementById('btn-example-data')?.addEventListener('click', loadExampleData);
    document.getElementById('btn-clear-form')?.addEventListener('click', clearAllForm);

    document.getElementById('btn-sync-transf')?.addEventListener('click', () => {
      document.getElementById('ctrl_transf_reg').value = parseVal('ing_total_transf').toFixed(2);
      document.getElementById('ctrl_tarj_reg').value = parseVal('ing_total_tarjeta').toFixed(2);
      recalculateAll();
      showToast('Montos registrados sincronizados de Ingresos', 'success');
    });

    document.getElementById('btn-copy-entregado')?.addEventListener('click', () => {
      document.getElementById('val_importe_entregado').value = parseVal('concil_efectivo_contado').toFixed(2);
      showToast('Importe entregado copiado del conteo físico', 'info');
    });

    // Módulo Historial Filtro
    document.getElementById('historial_filtro_fecha')?.addEventListener('change', (e) => {
      loadHistorial(e.target.value);
    });

    document.getElementById('btn-historial-todos')?.addEventListener('click', () => {
      document.getElementById('historial_filtro_fecha').value = '';
      loadHistorial();
    });

    document.getElementById('btn-refresh-history')?.addEventListener('click', () => {
      loadHistorial(document.getElementById('historial_filtro_fecha')?.value || null);
      showToast('Historial sincronizado desde Firebase', 'success');
    });

    // Módulo BalanceScore
    document.getElementById('btn-save-balancescore')?.addEventListener('click', async () => {
      const fecha = document.getElementById('bs_fecha').value;
      const res = await TB_FIREBASE.saveBalanceScore(fecha, DEFAULT_STATIONS);
      showToast(`BalanceScore guardado en ${res.source === 'firebase' ? 'Firebase' : 'Local'}`, 'success');
    });

    // Módulo Ingresos
    document.getElementById('btn-sync-ingresos-arqueo')?.addEventListener('click', () => {
      renderIngresosReport();
      showToast('Reporte de ingresos sincronizado con el arqueo actual', 'success');
    });

    document.getElementById('btn-save-ingresos')?.addEventListener('click', async () => {
      const fecha = document.getElementById('rep_ingresos_fecha').value;
      const res = await TB_FIREBASE.saveIngresosReport(fecha, {
        total: parseVal('kpi-ingreso-total'),
        efectivo: parseVal('rep_efectivo_val'),
        tarjeta: parseVal('rep_tarjeta_val'),
        transferencia: parseVal('rep_transf_val')
      });
      showToast(`Reporte de ingresos guardado en ${res.source === 'firebase' ? 'Firebase' : 'Local'}`, 'success');
    });

    // Módulo Leads Subtabs
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
      const res = await TB_FIREBASE.saveInteresadas(fecha, currentLeadTab, LEADS_DATA[currentLeadTab]);
      showToast(`Embudo de ${currentLeadTab === 'salon' ? 'Salón' : 'Academia'} guardado en Firebase`, 'success');
    });

    // Módulo Campaña & Eventos
    document.getElementById('btn-edit-campana')?.addEventListener('click', () => {
      const newName = prompt('Nombre de la campaña del mes:', document.getElementById('campana-nombre-display').textContent);
      if (newName) {
        document.getElementById('campana-nombre-display').textContent = newName;
        showToast('Nombre de campaña actualizado', 'success');
      }
    });

    document.getElementById('btn-add-event')?.addEventListener('click', () => {
      const title = prompt('Título del evento o masterclass:');
      if (!title) return;
      const day = prompt('Día (ej. 15):', '15') || '15';
      const month = prompt('Mes (ej. NOV):', 'NOV') || 'NOV';
      const type = prompt('Tipo (Salón / Academia / Capacitación):', 'Academia') || 'Academia';
      DEFAULT_EVENTS.push({ day, month, title, type, resp: 'Coordinación' });
      renderCampanaEventos();
      showToast('Nuevo evento añadido al calendario', 'success');
    });

    // Restaurar borrador inicial
    try {
      const draft = localStorage.getItem('totalbeauty_arqueo_draft');
      if (draft) {
        loadFormData(JSON.parse(draft));
      } else {
        const now = new Date();
        document.getElementById('header_fecha').value = now.toISOString().split('T')[0];
        const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        document.getElementById('header_hora').value = hm;
        document.getElementById('val_hora_cierre').value = hm;
        recalculateAll();
      }
    } catch (e) {
      recalculateAll();
    }
  });

})();
