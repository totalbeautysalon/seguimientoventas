# TOTAL BEAUTY SALÓN Y ACADEMIA
## Portal Integral de Gestión: Arqueos, Ventas Diarias, Interesadas, Campaña y BalanceScore

Sistema web integral desarrollado específicamente para la operación diaria, conciliación de caja, auditoría y análisis de desempeño de **TOTAL BEAUTY SALÓN Y ACADEMIA**.

Conectado 100% a la nube de **Firebase Authentication** y **Firebase Realtime Database** (`totalbregis`), con exportación automática en PDF oficial y control de versiones en **GitHub**.

---

### 🔐 Inicio de Sesión Seguro (Firebase Authentication)
El sistema cuenta con una pantalla de inicio de sesión (*login barrier*) conectada directamente a Firebase Auth:
- **Método**: Correo electrónico y contraseña.
- **Seguridad**: Tokens seguros de sesión (`idToken`), persistencia de sesión ("Recordar sesión") y actualización automática de token (`refreshToken`).
- **Recuperación**: Opción para enviar enlace oficial de restablecimiento de contraseña a la bandeja de entrada del usuario.
- **Perfil Activo**: El correo del usuario autenticado se muestra en la barra superior (*topbar*) y en el pie del menú lateral (*sidebar*), con botón para **Cerrar Sesión** en cualquier momento.
- **Protección**: Si el usuario no ha iniciado sesión, el portal permanece bloqueado. Todas las consultas y guardados en Realtime Database se envían autenticados.

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
  - `telefono*` (Teléfono celular a 10 dígitos)
  - `nombre de la clienta` (Opcional)
  - `servicio o producto*` (Con sugerencias rápidas)
  - `estacion*` (Cabello, Uñas, Maquillaje, Pestañas, Pedicure, Facial, Academia, Retail)
  - `especialista*` (Nombre de quien atendió)
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

#### 5. 💈 BalanceScore por Estaciones
- Medición en tiempo real de las 6 estaciones de trabajo del salón:
  1. **Cabello & Colorimetría**
  2. **Uñas & Manicure**
  3. **Maquillaje Profesional**
  4. **Lash & Brow Bar (Pestañas/Cejas)**
  5. **Pedicure & Spa**
  6. **Cabina Facial**
- Toma las ventas registradas del día y calcula automáticamente el ingreso logrado vs. meta, clientes atendidos y ticket promedio.
- Checklists de estándares operativos (limpieza, puntualidad, hospitalidad, venta cruzada).
- Score general ponderado del salón.

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

---

### 🛡️ Cero Datos de Prueba (Producción Limpia)
El sistema inicia sin datos mock ni registros falsos. Todo inicia en blanco, listo para la operación real del salón y academia. Si se desea visualizar datos de demostración para capacitación, se puede presionar el botón **"⚡ Ejemplo"** en la barra superior.

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
- **Respaldo Offline**: Persistencia automática en `localStorage` ante fallos de conexión.

---

### 🐙 Sincronización con GitHub

El repositorio local está configurado en la rama `main`. Para sincronizar cambios con GitHub:
1. Ejecute el archivo:
   ```
   subir_a_github.bat
   ```
2. Ingrese la URL de su repositorio remoto cuando se le solicite (o presione ENTER si ya está configurado).
