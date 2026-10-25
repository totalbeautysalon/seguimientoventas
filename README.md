# TOTAL BEAUTY SALÓN Y ACADEMIA
## Sistema Interactivo de Arqueo Diario de Caja y Exportación a PDF

Aplicación web diseñada específicamente para registrar, conciliar y validar el arqueo diario de caja de acuerdo con el formato oficial de **TOTAL BEAUTY SALÓN Y ACADEMIA** (`FORMATO DE ARQUEO DIARIO DE CAJA.pdf`).

---

### 🌟 Características Principales

1. **Cumplimiento al 100% del Formato Oficial**:
   - **Encabezado**: Fecha, Responsable de caja y Hora.
   - **1. Fondo Inicial de Caja**: Fondo inicial caja, fondo inicial caja chica y total disponible inicial.
   - **2. Ingresos del Día**: Desglose por concepto (Servicios de belleza, Anticipos de citas, Cursos de la academia, Venta de productos, Liquidación de saldos pendientes, Otros ingresos) y por método de pago (Efectivo, Transferencia, Tarjeta / otro). Totalización automática y número de operaciones.
   - **3. Salidas de Dinero de Caja Chica**: Compra de materiales, productos, gastos operativos, retiro de efectivo (para resguardo/depósito) y otros, con motivo, autorización e importe. Permite agregar filas adicionales dinámicamente.
   - **4. Conteo Físico del Efectivo**: Calculadora interactiva por denominación de billetes ($1,000, $500, $200, $100, $50, $20) y monedas ($10, $5, $2, $1, $0.50) con botones de incremento rápido (+/-) y subtotal automático.
   - **5. Conciliación de Caja**: Cálculo exacto del efectivo esperado frente al efectivo contado físicamente, detección automática de estado (**Caja cuadrada**, **Sobrante de efectivo** o **Faltante de efectivo**) y campo para explicación detallada.
   - **6. Control de Transferencias y Otros Pagos**: Comparativa entre importes registrados vs. importes verificados en cuentas bancarias/terminales con cálculo de diferencias. Botón para sincronizar desde ingresos con un solo clic.
   - **7. Anticipos y Saldos Pendientes**: Registro dinámico de anticipos por clienta/alumno con montos recibidos y saldos pendientes.
   - **8. Resumen Final del Día**: Consolidado automático de los 7 indicadores financieros clave, contador de servicios/anticipos/cursos y observaciones del día.
   - **9. Entrega y Validación**: Declaración formal de conformidad, pad interactivo para **firma digital**, registro de horas de cierre y entrega, persona que recibe, importe entregado y observaciones.

2. **Exportación a PDF Oficial**:
   - Genera el reporte oficial en formato PDF fiel al documento original de 3 páginas.
   - **Nombre de archivo automático**: `Arqueo_Caja_YYYY-MM-DD_[NombreResponsable].pdf` (ejemplo: `Arqueo_Caja_2026-10-25_Marbella_Rios.pdf`).
   - Funciona sin conexión a internet (librerías incluidas localmente).

3. **Funcionalidades de Productividad**:
   - **⚡ Datos de Ejemplo**: Permite cargar un arqueo completo realista con un clic para entrenamiento o pruebas.
   - **💾 Autoguardado Continuo**: No se pierden datos si se cierra accidentalmente la ventana o se refresca el navegador.
   - **🔄 Nuevo Arqueo**: Reinicia el formulario para una nueva jornada con confirmación previa.
   - **🖨️ Impresión Nativa**: Compatible con la función de impresión de cualquier navegador (`Ctrl + P`).

---

### 🚀 Cómo Iniciar la Aplicación

Hay tres formas muy sencillas de abrir y utilizar la herramienta:

#### Opción 1: Acceso Directo (Recomendado para el día a día)
Haga doble clic en el archivo:
```
Abrir_Arqueo_Caja.bat
```
Esto abrirá la aplicación en modo ventana limpia maximizada (utilizando Microsoft Edge o su navegador predeterminado).

#### Opción 2: Abrir en cualquier navegador
Haga doble clic directamente sobre:
```
index.html
```

#### Opción 3: Servidor Local (Para usar en tablets o celulares conectados a la red del salón)
Haga doble clic en:
```
Iniciar_Servidor_Local.bat
```
O ejecute en terminal:
```bash
python server.py
```
Le mostrará la dirección IP para abrir la pantalla en cualquier dispositivo móvil o tablet de la recepción.

---

### 📁 Estructura del Proyecto

```
ARQUEO DIARIO DE CAJA/
│
├── Abrir_Arqueo_Caja.bat         # Lanzador directo para Windows
├── Iniciar_Servidor_Local.bat    # Lanzador de servidor local
├── server.py                     # Servidor HTTP ligero en Python
├── index.html                    # Aplicación principal e interfaz interactiva
├── styles.css                    # Estilos visuales Total Beauty y formato de impresión
├── app.js                        # Lógica de cálculo, persistencia y exportación PDF
│
├── assets/
│   ├── logo.png                  # Logo institucional Total Beauty
│   ├── logoheader.png            # Logotipo de cabecera
│   └── logo_base64.js            # Representación Base64 para exportación PDF sin CORS
│
└── libs/
    └── html2pdf.bundle.min.js    # Motor de renderizado PDF local y autónomo
```
