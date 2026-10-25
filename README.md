# TOTAL BEAUTY SALÓN Y ACADEMIA
## Portal Integral de Gestión: Arqueo de Caja, Firebase Cloud, BalanceScore y Reportes Comerciales

Sistema web integral desarrollado específicamente para la operación diaria, conciliación de caja, auditoría y análisis de desempeño de **TOTAL BEAUTY SALÓN Y ACADEMIA**.

---

### 🌟 Módulos del Menú de Navegación

El sistema cuenta con una barra lateral (*sidebar*) con accesos directos a todos los módulos:

#### 1. 📝 Arqueo Diario de Caja (Formato Oficial)
- Cumplimiento estricto al 100% del documento oficial **`FORMATO DE ARQUEO DIARIO DE CAJA.pdf`** de 3 páginas:
  - **Encabezado**: Fecha, Responsable de caja y Hora.
  - **1. Fondo Inicial**: Caja y caja chica.
  - **2. Ingresos del Día**: Servicios, anticipos, cursos, productos, saldos pendientes y otros por método de pago (Efectivo, Tarjeta, Transferencias).
  - **3. Salidas de Dinero de Caja Chica**: Desglose con motivo, autorización, importe y retiros de resguardo identificados.
  - **4. Conteo Físico del Efectivo**: Calculadora por denominaciones de billetes ($1,000, $500, $200, $100, $50, $20) y monedas ($10, $5, $2, $1, $0.50).
  - **5. Conciliación de Caja**: Fórmula automática en tiempo real, detección de estado (**Caja cuadrada**, **Sobrante** o **Faltante**) y campo de aclaraciones.
  - **6. Control de Transferencias y Tarjetas**: Importe registrado vs. verificado con botón de sincronización de 1 clic.
  - **7. Anticipos y Saldos Pendientes**: Control dinámico de pagos recibidos por adelantado.
  - **8. Resumen Final del Día**: Métricas financieras consolidadas y contador de servicios, anticipos y cursos.
  - **9. Entrega y Validación**: Declaración legal, pad interactivo para **firma digital con mouse/pantalla táctil**, horas y comprobación.
- **Exportación en PDF**: Genera el archivo oficial de 3 páginas con el nombre automático `Arqueo_Caja_YYYY-MM-DD_[NombreResponsable].pdf`.
- **Guardado en Firebase**: Sube el arqueo y su información estructurada a la nube de Firebase CRM (`total-beauty-crm`).

#### 2. 📑 Reportes Diarios de Arqueo (Historial)
- **Selector de Día / Calendario**: Permite elegir cualquier fecha para consultar el arqueo correspondiente.
- **Tarjetas de Resumen Histórico**: Visualiza ingresos, conteo físico, salidas y estatus de cuadratura de cada día.
- **Descarga de PDF Histórico**: Permite reabrir o descargar el PDF oficial de cualquier día archivado.
- **Cargar en Arqueo**: Permite cargar un arqueo pasado en el formulario para revisión o ajustes.

#### 3. 💈 BalanceScore por Estaciones
Evaluación del desempeño y control de calidad en las 6 estaciones de trabajo del salón:
1. **Cabello & Colorimetría** (Balayage, tintes, cortes, alisados)
2. **Uñas & Manicure** (Acrílico, gel semipermanente, diseños)
3. **Maquillaje Profesional & Peinado** (Social, novias, XV años)
4. **Lash & Brow Bar** (Pestañas, cejas, lifting, microblading)
5. **Pedicure & Spa de Pies** (Pedicure clínico y spa)
6. **Cabina Facial & Estética** (Limpiezas, aparatología facial)
- **Indicadores por Estación**: Meta financiera vs. Ingreso logrado, clientes atendidos vs. meta, ticket promedio y checklists de estándares (limpieza, puntualidad, hospitalidad, venta cruzada).
- Cálculo del porcentaje de cumplimiento y score general del salón con guardado en Firebase.

#### 4. 💰 Reporte Diario de Ingresos
- Desglose porcentual y monetario por método de pago:
  - 💵 Efectivo
  - 💳 Tarjeta / Terminal
  - 📱 Transferencia Bancaria
- Desglose por unidad de negocio:
  - 💇‍♀️ Salón de Belleza
  - 🎓 Academia Total Beauty
  - 🛍️ Retail / Venta de Productos
- Comparativo en tiempo real vs. Meta Diaria del salón ($5,000/día).
- Botón **"Sincronizar con Arqueo de Hoy"** para cargar datos con 1 clic y botón de guardado en Firebase.

#### 5. 🎯 Reporte de Interesadas, Solo Preguntan y Cierres (Embudo de Conversión)
Conmutador de dos pestañas independientes:
- 💇‍♀️ **Salón de Belleza** (Citas de belleza y servicios)
- 🎓 **Academia de Belleza** (Inscripciones a cursos y diplomados)
- **Métricas del Embudo**:
  - **Interesadas Totales**: Mensajes o prospectos atendidos por WhatsApp, llamadas, redes o mostrador.
  - **Solo Preguntan**: Prospectos que cotizaron pero no agendaron cita ni pagaron anticipo (cálculo automático: Interesadas - Cierres).
  - **Cierres Concretados**: Citas confirmadas con anticipo pagado o alumnas inscritas.
  - **Tasa de Conversión (%)**: Porcentaje de efectividad comercial.
  - **Desglose de Motivos**: Registro de objeciones (precios, horarios, etc.).
- Guardado en tiempo real en Firebase.

#### 6. 🌟 Campaña del Mes y Eventos del Mes
- **Campaña Activa**: Nombre de campaña, objetivos comerciales del mes y paquetes promocionales autorizados con precios especiales.
- **Eventos del Mes**: Calendario cronológico de fechas clave (inicio de diplomados, masterclasses, capacitaciones internas del staff y dinámicas promocionales).
- Posibilidad de agregar nuevos eventos dinámicamente y sincronizarlos en Firebase.

---

### 🔥 Conexión y Guardado en Firebase

El sistema está configurado y conectado al proyecto de Firebase oficial de Total Beauty:
- **Proyecto**: `total-beauty-crm`
- **Base de Datos**: `https://total-beauty-crm-default-rtdb.firebaseio.com/`
- **Colecciones / Nodos**:
  - `/arqueos_caja/{fecha}_{responsable}`: Registro completo de arqueos diarios.
  - `/balancescore/{fecha}`: Evaluaciones del BalanceScore por estación.
  - `/reportes_ingresos/{fecha}`: Concentrado diario de ingresos.
  - `/interesadas_cierres/{fecha}`: Registro del embudo de ventas para Salón y Academia.
  - `/campanas_eventos/{mes_año}`: Campaña mensual y eventos programados.
- **Respaldo Offline**: Incluye almacenamiento local redundante en `localStorage` para que la recepción nunca se detenga si la conexión a internet es inestable.

---

### 🐙 Sincronización con GitHub

El proyecto ya cuenta con su repositorio Git local inicializado en la rama `main` y su archivo `.gitignore`.

Para subirlo a su cuenta de GitHub:
1. Cree un nuevo repositorio vacío en [GitHub.com](https://github.com/new) (por ejemplo: `arqueo-diario-caja`).
2. Haga doble clic en el archivo:
   ```
   subir_a_github.bat
   ```
3. Ingrese la URL de su repositorio de GitHub cuando se lo solicite (ejemplo: `https://github.com/TU-USUARIO/arqueo-diario-caja.git`).
4. El script realizará automáticamente el commit y el `git push` a la rama `main`.

---

### 🚀 Cómo Ejecutar la Aplicación

1. **Acceso Rápido (1 clic)**:
   Haga doble clic en [`Abrir_Arqueo_Caja.bat`](Abrir_Arqueo_Caja.bat) para abrir la aplicación maximizada en Microsoft Edge o su navegador habitual.
2. **Servidor Local (para tablets o celulares en el salón)**:
   Haga doble clic en [`Iniciar_Servidor_Local.bat`](Iniciar_Servidor_Local.bat) para compartir la herramienta en la red Wi-Fi de recepción.
