# TOTAL BEAUTY SALÓN Y ACADEMIA
## Portal Integral de Gestión: Arqueos, Ventas Diarias, Interesadas, Campaña y BalanceScore

Sistema web integral desarrollado específicamente para la operación diaria, conciliación de caja, auditoría y análisis de desempeño de **TOTAL BEAUTY SALÓN Y ACADEMIA**.

Conectado 100% a la nube de **Firebase Authentication** y **Firebase Realtime Database** (`totalbregis`), con exportación automática en PDF oficial y control de versiones en **GitHub**.

---

### 🔐 Inicio de Sesión Seguro (Firebase Authentication)
El sistema cuenta con una pantalla de inicio de sesión (*login barrier*) conectada directamente a Firebase Auth:
- **Acceso Exclusivo**: Acceso mediante correo electrónico y contraseña configurados en Firebase Authentication (`totalbregis`). No existe modo offline ni accesos locales.
- **Caducidad Obligatoria de 1 Hora**: Por directiva de seguridad, la sesión caduca estrictamente tras **1 hora (60 minutos)** de haber ingresado. Siempre que se entre a la página o transcurra 1 hora, el sistema bloqueará el acceso y solicitará obligatoriamente iniciar sesión de nuevo.
- **Temporizador Activo**: Monitoreo en vivo dentro de la aplicación para invalidar la sesión y mostrar la pantalla de bloqueo en el momento exacto en que se cumple 1 hora de uso continuo.
- **Recuperación**: Opción para enviar enlace oficial de restablecimiento de contraseña a la bandeja de entrada del usuario.
- **Perfil Activo**: El correo del usuario autenticado se muestra en la barra superior (*topbar*) y en el pie del menú lateral (*sidebar*), con botón para **Cerrar Sesión** en cualquier momento.
- **Protección**: Si el usuario no ha iniciado sesión o su sesión expiró, el portal permanece bloqueado. Todas las consultas y guardados en Realtime Database se envían autenticados.

---

### 🌟 Módulos del Sistema

El sistema cuenta con una barra lateral (*sidebar*) interactiva con acceso a todos los módulos:

#### 1. 💵 Arqueo Diario de Caja Principal
- **Fondo Inicial**: Efectivo base asignado para apertura y cambio.
- **Ingresos del Día**: Conectado automáticamente con las ventas diarias por método de pago (Efectivo, Tarjeta, Transferencias) para servicios, anticipos, cursos, productos y saldos.
- **Conteo Físico**: Calculadora por denominación de billetes ($1,000, $500, $200, $100, $50, $20) y monedas ($10, $5, $2, $1, $0.50).
- **Conciliación Matemática**: `Fondo inicial + Ingresos en efectivo - Retiros para resguardo = Efectivo esperado`. Detección automática de **Caja cuadrada**, **Sobrante** o **Faltante**.
- **Control de Transferencias y Tarjetas**: Registro vs. verificación bancaria.
- **Anticipos y Saldos Pendientes**: Desglose con clienta, servicio, anticipo recibido y saldo por cobrar.
- **Resumen Final y Validación**: Pad de **firma digital interactiva** y declaración legal.
- **Flujo Automático**: Al dar clic en **"Guardar en Firebase Cloud"**, se guarda en la base de datos, se descarga automáticamente el PDF oficial de 3 páginas y se limpian los campos para el siguiente registro.

#### 2. 🪙 Arqueo Diario de Caja Chica (Independiente)
- **Fondo Inicial Asignado**: Monto asignado para gastos operativos menores.
- **Salidas de Dinero de Caja Chica**: Registro con concepto (compra de materiales, productos, gastos operativos, otros), motivo, autorización e importe.
- **Conteo Físico**: Dinero físico restante en la caja chica.
- **Conciliación**: `Fondo inicial - Salidas autorizadas = Efectivo esperado`.
- **Firma Digital y Resguardo**: Firma digital del responsable y justificación de comprobantes.
- **Guardado y Descarga**: Guarda en Firebase, descarga el PDF oficial de 1 página de Caja Chica y limpia los campos.

#### 3. 💰 Registro Diario de Ventas (100% Interconectado)
Módulo para capturar cada venta u operación cobrada en recepción:
- **Campos Solicitados (* = obligatorios)**:
  - `fecha*` (Fecha de la venta)
  - `telefono` (Teléfono celular a 10 dígitos, **opcional**)
  - `nombre de la clienta` (Opcional)
  - `servicio o producto*` (Selector desplegable configurado en Configuración General; autocompleta estación y precio sugerido)
  - `estacion*` (Selector desplegable configurado en Configuración General)
  - `especialista*` (Selector desplegable configurado en Configuración General)
  - `metodo de pago*` (Efectivo, Tarjeta, Transferencia)
  - `total cobrado*` (Monto en pesos)
  - `status del pago*` (Pagado completo, Anticipo, Saldo pendiente)
  - `notas` (Detalles adicionales)
- **Interconexión Total**:
  - Al registrar una venta, alimenta en tiempo real la sección **INGRESOS DEL DÍA** en Caja Principal.
  - Alimenta los clientes y montos reales del **BalanceScore por Estaciones**.
  - Alimenta las métricas del **Reporte Diario de Ingresos**.
  - Alimenta el avance de ingresos de la **Campaña Activa**.
- **Contadores en Vivo**: Total cobrado en el día, desglose en efectivo, tarjeta y transferencia, y total de operaciones cobradas.
- Tabla con opción de eliminar ventas y botón de sincronización de 1 clic con Caja Principal.

#### 4. 📑 Reportes Diarios de Arqueo (Historial)
- Conmutador entre **Caja Principal** y **Caja Chica**.
- Filtro por fecha específica o visualización de todo el historial.
- Muestra estatus de cuadratura, ingresos, salidas y diferencias.

#### 5. 💈 BalanceScore por Estaciones y Cursos
- **Estaciones Dinámicas + Cursos**:
  - Obtiene todas las estaciones de trabajo de la configuración general e integra de forma nativa la dimensión de **🎓 Cursos & Talleres Academia**.
  - Separa y contabiliza automáticamente las ventas de cursos (inscripciones, talleres, diplomados) en su propia tarjeta y métricas.
- **Consultas y Filtros de Búsqueda Flexibles**:
  - 📅 **Por Día**: Evaluación de una fecha específica con meta prorrateada diaria.
  - 📆 **Por Semana**: Ventas acumuladas de los últimos 7 días con meta semanal.
  - 🌓 **Por Quincena**: Selección de 1ª Quincena (Días 1 al 15) o 2ª Quincena (Días 16 al 30/31) con meta quincenal base.
  - 🗓️ **Por Mes**: Visualización del mes completo (1 al 30/31) con meta mensual (2 quincenas), o **avance del día 1 a la fecha de hoy** para monitorear el progreso acumulado en tiempo real.
  - 🎯 **Rango Personalizado de Días**: Permite consultar cualquier lapso entre una fecha `Desde` y una fecha `Hasta` con cálculo exacto de días y metas proporcionales.
- **Actualización de Porcentajes Conforme el Avance**:
  - Barra de progreso interactiva con cambio dinámico de color (Verde $\ge 100\%$, Ámbar $75\%-99\%$, Rojo $< 75\%$).
  - Badge de *"🏆 ¡Meta Superada!"* al sobrepasar el 100%.
  - Comparativa de Clientes/Alumnas reales vs. Meta del período y cálculo del Ticket Promedio.
  - KPIs globales de período: Total de Ventas Acumuladas, Meta Global, % de Avance y Score ponderado.
  - Botón para guardar el snapshot del BalanceScore en Firebase.

#### 6. 📊 Reporte Diario de Ingresos
- Desglose porcentual y monetario por método de pago (Efectivo, Tarjeta, Transferencia).
- Desglose por unidad de negocio (Salón, Academia, Retail).
- Comparativa en tiempo real vs. Meta Diaria del salón ($5,000.00).

#### 7. 🎯 Interesadas y Cierres (3 Opciones Requeridas)
Pestañas segmentadas para gestionar el ciclo comercial:
- **Opción 1: Nuevo Registro & Tipificación**: Formulario para registrar prospectas con fecha, nombre, WhatsApp, unidad (Salón / Academia), servicio de interés, canal de captación y tipificación inicial (*Interesada, Solo pregunta, En seguimiento, Cierre - Agendada/Pagó, No interesada*).
- **Opción 2: Seguimiento en Tipificación**: Directorio con buscador y filtros para contactar por **WhatsApp directo (1 clic)** o llamada, y actualizar la tipificación en tiempo real en Firebase.
- **Opción 3: BalanceScore de Conversión**: Embudo visual interactivo, tasa de conversión comercial (%), comparativo Salón vs. Academia y efectividad por canal de captación (Instagram vs WhatsApp vs Facebook vs Recomendación).

#### 8. 🌟 Campaña Activa y Eventos del Mes
- **Monitoreo en Vivo ("Ver cómo está funcionando")**:
  - Compara la meta de ingresos vs. las **ventas reales acumuladas** registradas durante la vigencia de la campaña.
  - Barra de progreso dinámica porcentual.
  - Contador de días restantes de vigencia.
  - Conteo de clientas atendidas en salón y alumnas inscritas en academia en el período.
  - Despliegue de paquetes y promociones autorizadas.
- **Configurar / Editar Campaña Activa**: Formulario para definir nombre, fechas de vigencia, metas y paquetes.
- **Eventos del Mes**: Calendario de eventos con fechas, responsables y creación de nuevos eventos.

#### 9. ⚙️ Configuración General (Catálogos Dinámicos)
Módulo administrativo para gestionar los catálogos del negocio sincronizados con Firebase:
- **Servicios y Productos**:
  - Alta y administración con nombre, tipo (*Servicio Salón, Producto Retail, Curso Academia*), estación asignada y precio base sugerido.
  - Alimenta dinámicamente el selector del Registro Diario de Ventas.
- **Estaciones de Trabajo**:
  - Configuración de áreas operativas con nombre, icono/emoji, meta quincenal de ingresos ($) y meta quincenal de clientes.
  - Alimenta dinámicamente las estaciones del salón y los selectores de ventas.
- **Especialistas**:
  - Directorio del equipo operativo con nombre completo, especialidad/estación y teléfono.
  - Alimenta dinámicamente el selector de especialista en ventas.
- **🎯 Configuración de Metas Quincenales por Estación y Cursos**:
  - Toma directamente los datos de las **Estaciones de Trabajo** activas más la categoría de **Cursos**.
  - Permite ajustar las **Metas Quincenales en Ventas ($)** y **Metas Quincenales de Clientes / Alumnos**.
  - Calcula automáticamente en vivo el **Equivalente Mensual ($)** ($2 \times \text{Quincena}$) y el **Equivalente Diario ($)** ($\text{Quincena} / 15$).
  - **Auto-guardado Automático en Firebase**: Cada cambio realizado se guarda automáticamente en Firebase Cloud sin requerir botones manuales de sincronización.
- **Acceso Rápido**: Enlaces directos `⚙️ Configurar` junto a cada selector del formulario de ventas.

#### 10. 🛡️ Registro de Auditoría y Eventos del Sistema (Bitácora & Reversión)
Módulo administrativo de alta seguridad para supervisar cada acción y movimiento realizado en el portal:
- **Bitácora Cronológica en Tiempo Real**:
  - Registra automáticamente cada operación ejecutada en el sistema:
    - 💰 **Ventas**: Altas (`ALTA_VENTA`) y eliminaciones (`BAJA_VENTA`) de ventas cobradas.
    - 💵 **Caja Principal y Chica**: Cierres y arqueos guardados (`ALTA_ARQUEO_PRINCIPAL`, `ALTA_ARQUEO_CHICA`).
    - ⚙️ **Configuración General**: Altas y bajas de servicios, estaciones, especialistas y vaciados de catálogo (`ALTA_SERVICIO`, `BAJA_SERVICIO`, `ALTA_ESTACION`, `BAJA_ESTACION`, `ALTA_ESPECIALISTA`, `BAJA_ESPECIALISTA`, `VACIAR_CATALOGO`).
    - 🎯 **Interesadas**: Nuevos prospectos registrados, cambios de tipificación y eliminaciones (`ALTA_LEAD`, `UPDATE_LEAD`, `BAJA_LEAD`).
    - 🌟 **Campaña y Eventos**: Actualización de campaña activa, altas y bajas de eventos en calendario (`CONFIG_CAMPANA`, `ALTA_EVENTO`, `BAJA_EVENTO`).
  - **Identificación de Usuario y Temporalidad**: Registra con precisión el correo del usuario autenticado que ejecutó la acción, la fecha y hora exacta (`DD/MM/AAAA HH:MM:SS`), el módulo y una descripción detallada con montos y nombres.
  - **Filtros Avanzados**: Búsqueda en vivo por texto (usuario, descripción, acción) y filtrado por módulo o por estado (*Todos, Aplicados, Revertidos*).
  - **Persistencia en Firebase**: Cada evento se almacena de forma inmutable en el nodo `/auditoria_movimientos` de Firebase Realtime Database.

- **🔐 Reversión de Movimientos con Llave Maestra Secreta (`0401`)**:
  - Cada movimiento activo cuenta con un botón directo `↩️ Deshacer`.
  - Al solicitar la reversión, el sistema despliega un modal protegido que exige ingresar la **Llave Maestra Secreta**: `0401`.
  - **Control de Acceso Estricto**:
    - Si se ingresa una clave distinta a `0401`, el sistema deniega el acceso terminantemente (*"Llave maestra incorrecta. No tiene autorización para deshacer este movimiento"*).
    - Al validar la llave `0401`, el sistema ejecuta la contra-operación en Firebase Realtime Database y en el estado de la aplicación:
      - Deshacer alta de venta -> Elimina la venta de Firebase y actualiza ingresos y BalanceScore.
      - Deshacer eliminación de venta -> Restaura la venta borrada en Firebase.
      - Deshacer alta/baja de catálogo -> Elimina o reinserta el servicio, estación o especialista en Firebase.
      - Deshacer vaciado de catálogo -> Reconstituye íntegramente los ítems eliminados.
      - Deshacer arqueo de caja -> Elimina el arqueo de Firebase y del historial.
      - Deshacer alta/baja/cambio de prospecto o evento -> Revierte al estado previo en Firebase.
  - **Trazabilidad de Reversión**: El movimiento revertido cambia su estatus a `⚪ Revertido`, registrando la fecha, hora y usuario ejecutor de la reversión, e insertando un nuevo registro de auditoría `REVERTIR_CON_LLAVE_MAESTRA` para total transparencia operativa.

---

### 🛡️ Persistencia Estricta en BD y Cero Datos de Prueba
- **Autoridad Total de la Base de Datos**: El sistema muestra **única y estrictamente lo que está almacenado en Firebase Realtime Database**. Si un elemento no está en la base de datos, no se muestra nada (listas limpias). Si se agrega un nuevo servicio, estación o especialista, se guarda de inmediato en Firebase y se muestra en adelante.
- **Eliminación Definitiva (Sin Resurrección de Datos)**: Al eliminar cualquier registro o catálogo en Configuración General, se elimina de Firebase y jamás se vuelve a inyectar ni a cambiar por datos no solicitados al iniciar sesión nuevamente.
- **Cero Inyección de Mocks**: Se eliminaron completamente todos los arreglos de prueba por defecto (`DEFAULT_SERVICIOS`, `DEFAULT_ESTACIONES`, `DEFAULT_ESPECIALISTAS`, etc.).
- **Herramientas de Limpieza de 1 Clic**: En Configuración General se incluyeron botones de vaciado rápido:
  - `🗑️ Vaciar Servicios`: Elimina en bloque los servicios en Firebase.
  - `🗑️ Vaciar Estaciones`: Elimina en bloque las estaciones y sincroniza metas en Firebase.
  - `🗑️ Vaciar Especialistas`: Elimina en bloque el catálogo de especialistas en Firebase.
  - `🧹 Limpiar Todo el Catálogo`: Permite borrar de una sola vez cualquier dato de prueba anterior para comenzar desde cero con los datos reales del negocio.

---

### 🔥 Conexión Firebase Cloud (totalbregis)
- **Proyecto**: `totalbregis`
- **Base de Datos**: `https://totalbregis-default-rtdb.firebaseio.com/`
- **Autenticación**: Firebase Authentication (Email / Password)
- **Nodos RTDB**:
  - `/ventas_diarias/{fecha}/{id}`: Registro diario de ventas.
  - `/arqueos_caja/{key}`: Arqueos de Caja Principal.
  - `/arqueos_caja_chica/{key}`: Arqueos de Caja Chica.
  - `/leads_seguimiento/{id}`: Interesadas y tipificaciones.
  - `/campana_activa`: Configuración y metas de la campaña activa.
  - `/eventos_mes/{id}`: Eventos y fechas clave.
  - `/balancescore/{fecha}`: Evaluaciones del BalanceScore.
  - `/reportes_ingresos/{fecha}`: Reportes diarios de ingresos.
  - `/configuracion/{servicios,estaciones,especialistas,metas}`: Catálogos maestros configurables.
- **Operación Exclusiva Cloud**: Todo flujo opera conectado directamente a Firebase Realtime Database sin modo offline.

---

### 🐙 Sincronización con GitHub

El repositorio local está configurado en la rama `main`. Para sincronizar cambios con GitHub:
1. Ejecute el archivo:
   ```
   subir_a_github.bat
   ```
2. Ingrese la URL de su repositorio remoto cuando se le solicite (o presione ENTER si ya está configurado).
