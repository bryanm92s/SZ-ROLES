<div align="center">

# 🌸 SZ Micropigmentación — Sistema de Gestión con Roles
### Plataforma multiusuario para estudios de micropigmentación y cejas

**Panel · Citas · Clientes · Servicios · Finanzas · Mis Gastos · Reportes · Calendario**

👑 Administradora &nbsp;·&nbsp; 👤 Empleada — cada quien ve solo lo que le corresponde

React 18 + Vite · Google Apps Script + Sheets + Calendar + Gmail · Deploy en Vercel

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Google_Apps_Script-34A853?logo=googleapps&logoColor=white)](https://script.google.com)
[![Auth](https://img.shields.io/badge/Auth-SHA--256-FF6B9D?logo=protonmail&logoColor=white)](#-autenticación-y-roles)

<img src="logo.png" alt="Logo SZ" width="120" />

</div>

---

## 📖 Acerca del proyecto

**SZ Micropigmentación** es una aplicación web **mobile-first** para gestionar un estudio
de micropigmentación y cejas. A diferencia de la versión base de un solo usuario, esta
variante implementa **roles de usuario (Administradora / Empleada)** con **autenticación
real por email y contraseña (hash SHA-256)**, soporte para **varias empleadas trabajando
a la vez**, asignación de citas a cada profesional y **auditoría** de todos los cambios.

Los datos persisten en una **hoja de Google Sheets** vía un **Web App de Google Apps
Script**, con **Google Calendar** para las citas y **Gmail** para el envío de códigos de
recuperación de contraseña. Cero servidores que mantener, cero costos de hosting de
base de datos.

> ✨ Diseñada para un estudio con varias esteticistas: cada empleada administra sus
> propias citas y gastos; la administradora ve y controla todo el negocio.

---

## 🆚 Diferencias con la versión base (SZ)

| Aspecto | **SZ** (base) | **SZ-ROLES** (esta) |
|---|---|---|
| Usuarios | Una sola operadora | **Multiusuario** con login |
| Roles | — | 👑 **Administradora** / 👤 **Empleada** |
| Autenticación | Ninguna (acceso directo) | **Email + contraseña** (SHA-256) |
| Recuperación de contraseña | — | Por **correo** (código de 1 h) |
| Citas | Globales | **Asignadas a una empleada** |
| Conflictos de agenda | 1 sola agenda | **1 agenda por empleada** (multi-agenda) |
| Finanzas | Globales | Admin = todo · Empleada = solo las suyas |
| Gastos | Globales | Admin = todos · Empleada = **"Mis Gastos"** |
| Reportes | Globales | Solo Admin, **por empleada** |
| Auditoría | — | Hoja **"Auditoría"** (estado anterior/posterior) |
| Gestión de usuarios | — | Solo Admin (cambiar roles, reset total) |

---

## 👩‍💼 Roles de usuario

| Característica | 👑 Administradora | 👤 Empleada |
|---|:---:|:---:|
| Iniciar sesión | ✅ | ✅ |
| Ver / crear / editar citas | ✅ **todas** | ✅ **solo las suyas** |
| Asignar cita a una empleada | ✅ | ❌ (se auto-asigna) |
| Reasignar cita entre empleadas | ✅ | ❌ |
| Gestión de clientes | ✅ | ✅ |
| Catálogo de servicios | ✅ editar | 🔒 solo lectura |
| Finanzas e ingresos | ✅ | ❌ |
| Gastos | ✅ **todos** | ✅ **solo los propios** ("Mis Gastos") |
| Crear categorías de gasto | ✅ | ❌ |
| Reportes por empleada | ✅ | ❌ |
| Ver historial de clientes | ✅ | ✅ |
| Calendario mensual | ✅ | ✅ |
| Gestión de usuarios / roles | ✅ | ❌ |
| Resetear todo el sistema | ✅ | ❌ |
| Auditoría | ✅ (reporte) | — (sistema la genera) |

### 👑 Administradora
Acceso total: ve a todas las empleadas, todas las citas y gastos, finanzas completas,
reportes por empleada, gestión de accesos (cambiar rol de cualquier usuario) y reset
total del sistema (con borrado de eventos de Calendar).

### 👤 Empleada
Solo ve y gestiona **lo suyo**: citas que le asignaron, sus propios gastos ("Mis
Gastos"), clientes en general y servicios en modo lectura. Al crear una cita se la
**auto-asigna** automáticamente. No puede ver finanzas, reportes ni los datos de
otras empleadas.

---

## ✨ Características principales

### 🔐 Autenticación y roles
- **Login con email + contraseña** — la contraseña se **hashea con SHA-256** en el
  navegador (Web Crypto API) y nunca viaja en texto plano.
- **Registro restringido**: solo correos **pre-autorizados** en la hoja *Usuarios*
  pueden registrarse (la administradora da de alta el correo; la persona luego crea
  su cuenta con su contraseña).
- **Recuperación de contraseña** por correo: se envía un **código de 6 dígitos** con
  validez de **1 hora** (vía Gmail) y se restablece con email + código + nueva
  contraseña.
- **Cambio de contraseña** desde dentro de la app (contraseña actual + nueva).
- El **rol** se asigna en la hoja *Usuarios* y la administradora puede cambiarlo desde
  la pestaña **Config → Gestión de accesos**.

### 🗓️ Citas con multi-agenda
- **Slots de 30 min** (07:00 → 20:30) con **bloqueo automático de horarios ocupados**.
- **Asignación a empleada** (`assignedTo`): la administradora elige quién atiende cada
  cita; la empleada siempre queda auto-asignada a sí misma.
- Doble capa anti-conflicto: **no se solapan citas de la misma empleada** *ni* dos
  citas del **mismo cliente** que se crucen en horario.
- **Cita a domicilio** con valor adicional y dirección.
- **Múltiples servicios por cita** (combo) con total automático.
- Estados: **Pendiente · Completada · No asistió** (las futuras no se pueden marcar).
- Agrupación en acordeón: **Hoy · Mañana · Próximas · No asistió · Pasadas**.
- Cada cita registra **quién la creó** y **quién la atiende** (para auditoría/reportes).
- **Integración con Google Calendar**: crea/actualiza/borra el evento por empleada;
  al reasignar, se borra el evento viejo y se crea el de la nueva empleada.
- **Recordatorios por WhatsApp en 1 clic** (mensajes pre-escritos con emoji, fecha,
  hora, total y modalidad).

### 👥 Clientes
- Base de clientes con **búsqueda por celular** (sufijo primero, luego subcadena).
- **Historial de cada cliente**: citas, montos, última visita y **quién lo atendió**.
- Compartido por todo el equipo (sin filtrado por rol).

### ✂️ Servicios
- Catálogo de servicios con precio.
- 🔒 **Solo la administradora** edita (crear/modificar/eliminar); la empleada ve.
- **Historial de precios**: al cambiar el precio se registra la fecha y las citas
  antiguas conservan el precio que regía en su momento.

### 💰 Finanzas (solo Administradora)
- **Balance neto** (ingresos recibidos − gastos) general y por mes.
- **Recibido · Pendiente · Proyectado** (cobrado vs. por cobrar).
- Gastos por **categoría** (Insumos, Arriendo, Publicidad…) con colores; cada gasto
  muestra **quién lo registró**.
- **Comparación mes a mes** y **Top servicios**.
- **Detalle de ingresos** y **detalle de gastos** con filtros.

### 💸 Mis Gastos (solo Empleada)
- La empleada registra y ve **únicamente sus propios gastos**.
- No puede crear categorías (usa las definidas por la administradora).

### 📊 Reportes (solo Administradora)
- **Resumen mensual por empleada**: citas creadas, gastos y montos.
- **Navegación directa**: tarjeta de empleada → sus citas → sus gastos → volver.
- **Exportación a Excel** (`.xlsx`).
- Reporte de **auditoría** (ver más abajo).

### 📅 Calendario (vista mensual)
- Vista de mes con las citas pintadas; toca un día para ver/abrir sus citas.

### 🗄️ Auditoría
- Cada **CREAR / EDITAR / ELIMINAR** queda registrado en la hoja **Auditoría**.
- Incluye **estado anterior y posterior** de cada registro.
- La administradora puede consultar la auditoría por mes desde **Reportes**.

### ⚙️ Config
- **Paletas de color** + **modo claro/oscuro**, guardados en el navegador.
- **Gestión de accesos** (solo admin): ver usuarios y cambiar roles.
- **Reset total** (solo admin): borra clientes, citas, gastos, auditoría y eventos de
  Calendar, con confirmación en pasos.
- **Cambio de contraseña** del usuario actual.

### 🔔 Extras de experiencia
- **Avisos de "cita por recordar"** en el Panel (≤ 60 min antes) con botón de WhatsApp.
- **Sincronización automática cada 30 s**, pausada cuando la pestaña no está visible.
- **Modo sin conexión**: respaldo en `localStorage` y sync automática al volver.
- **Branding dinámico** (nombre, subtítulo, emoji, logo) desde variables de entorno.

---

## 🛠️ Stack tecnológico

| Capa           | Tecnología                                                                          |
|----------------|-------------------------------------------------------------------------------------|
| Framework UI   | **React 18** + **Vite 5** (JSX, sin TypeScript)                                     |
| Autenticación  | **SHA-256** en navegador (Web Crypto) · tokens de reset de 1 h · sesión en `localStorage` |
| Estilos        | **CSS-in-JS** (inline styles + `<style>` global, sin librería de componentes)       |
| Export         | **xlsx (SheetJS)** para reportes Excel                                              |
| Backend        | **Google Apps Script** (`apps-script/Code.gs`) — Web App                             |
| Base de datos  | **Google Sheets** (7 hojas: Clientes, Servicios, Citas, Gastos, HistorialPrecios, **Usuarios**, **Auditoría**) |
| Agenda         | **Google Calendar API** (eventos por empleada)                                      |
| Email          | **Gmail API** (código de recuperación de contraseña)                                |
| Hosting        | **Vercel** (frontend estático)                                                      |
| Offline        | `localStorage` como respaldo de lectura/escritura                                   |

> Sin scheme de hashing con salt en servidor por simplicidad; pensado para un equipo
> pequeño de confianza. Si necesitas máxima seguridad, sirve un proxy/auth dedicado.

---

## 🏗️ Arquitectura

```
┌──────────────────────────────┐         HTTPS (token)          ┌────────────────────────────────┐
│   Vercel  (React SPA)       │  ────────────────────────────► │  Google Apps Script Web App   │
│                             │   ◄──────────────────────────  │  (apps-script/Code.gs)         │
│  • Login / Register / Reset │         JSON { ok, data }       │                                │
│  • Panel / Citas / Fin...   │                                │  • LockService (concurrencia)  │
│  • Roles (Admin/Empleada)   │                                │  • Hash SHA-256 verification   │
│  • WhatsApp reminders       │                                │  • Permisos por rol             │
│  • localStorage (sesión)     │                                │  • Auditoría (pre/post estado)  │
└──────────────┬──────────────┘                                │  • timezone America/Bogota      │
               │ │ session: email + role (localStorage)          └─────────────┬──────────────────┘
               │ │ + userEmail en cada saveData → para auditoría                 │
                                                          ┌──────────────────┴───────────┐
                                                          ▼                              ▼
                                          ┌────────────────────────┐         ┌───────────────────┐
                                          │   Google Sheets (BD)   │         │  Google Calendar   │
                                          │  • 7 hojas + Auditoría │         │   (eventos cita)  │
                                          │  • hoja Usuarios       │         └───────────────────┘
                                          └────────────────────────┘
                                                                       │
                                                                       ▼
                                                            ┌───────────────────┐
                                                            │     Gmail         │
                                                            │  (códigos reset)  │
                                                            └───────────────────┘
```

**Flujo con autenticación**: al loguearse, el email + rol se guardan en `localStorage`.
Cada `saveData` envía el `userEmail` en el payload; el backend valida permisos por rol
(p. ej., solo Administradora puede cambiar roles) y registra cada modificación en la
hoja **Auditoría** con estado anterior y posterior.

---

## 📁 Estructura del proyecto

```
SZ-ROLES/
├── index.html                 # HTML raíz (título + favicon emoji por defecto)
├── package.json               # Scripts y dependencias
├── vite.config.js             # Vite + plugin React
├── .env.example               # Plantilla de variables de entorno
├── SETUP.md                   # Guía de despliegue paso a paso (Apps Script)
├── MANUAL.md                  # 📖 Manual de usuario (operativa)
├── logo.png                   # Logo / apple-touch-icon
│
├── src/
│   ├── main.jsx               # Entry point de React
│   ├── App.jsx                # 🟡 App principal: todos los módulos
│   ├── Auth.jsx               # 🔐 Pantallas Login / Registro / Olvidé contraseña /
│   │                          #    Cambiar contraseña + <AuthShell>
│   ├── ReportsTab.jsx         # 📊 Pestaña de reportes (Excel + WhatsApp)
│   ├── api.js                # Auth (hash/post) + load/save + acciones admin
│   └── index.css              # Reset mínimo
│
└── apps-script/               # 🟢 Backend (desplegar en Google Apps Script)
    ├── Code.gs                # Lógica completa (auth, roles, auditoría, Sheets, Calendar, Gmail)
    └── appsscript.json        # Scopes (Sheets, Calendar, Gmail.send…)
```

> **Diferencia clave vs. SZ:** la lógica de UI está repartida en `App.jsx` + `Auth.jsx`
> + `ReportsTab.jsx` (en SZ todo va en un único `App.jsx`), y el `api.js` incluye las
> funciones de autenticación (hash/login/register/reset/role/audit).

---

## ✅ Prerrequisitos

- **Node.js 18+** y npm.
- Una **cuenta de Google** (gratis) para Sheets, Calendar, Apps Script y Gmail.
- Una cuenta de **GitHub** y **Vercel** (gratis) para el despliegue.

No necesitas Postgres, Redis ni ningún servidor.

---

## 🚀 Instalación y uso local

```bash
# 1. Clona el repositorio
git clone https://github.com/TU_USUARIO/SZ-ROLES.git
cd SZ-ROLES

# 2. Instala las dependencias
npm install

# 3. Copia el archivo de variables de entorno y completa los valores
cp .env.example .env
#   → Edita .env con VITE_SCRIPT_URL y VITE_TOKEN (ver sección Backend)

# 4. Arranca el servidor de desarrollo
npm run dev
```

Abre **http://localhost:5173**. Sin `VITE_SCRIPT_URL` la app no podrá loguearse ni
cargar datos; debes configurar el backend primero (ver siguiente sección).

### Scripts disponibles

| Script              | Acción                                       |
|---------------------|----------------------------------------------|
| `npm run dev`       | Servidor de desarrollo (Vite) con hot reload |
| `npm run build`     | Build de producción en `dist/`               |
| `npm run preview`   | Sirve el build de producción localmente     |

> **Nota:** esta variante **no incluye test suite** (a diferencia de la base SZ que
> tiene Vitest sobre helpers puros).

---

## 🟢 Configuración del backend (Google Apps Script)

Sigue `SETUP.md` para el detalle; aquí el resumen adaptado al sistema de roles:

1. **Crea un Spreadsheet** en [sheets.google.com](https://sheets.google.com) y copia su
   **ID** de la URL: `https://docs.google.com/spreadsheets/d/«ESTE_ES_EL_ID»/edit`
   *(las hojas se crean solas al primer uso: Clientes, Servicios, Citas, Gastos,
   HistorialPrecios, Usuarios y Auditoría).*

2. **Abre Apps Script** desde el menú **Extensiones → Apps Script** del Spreadsheet.

3. **Pega el contenido de `apps-script/Code.gs`** y cambia el token:
   ```js
   const SECRET_TOKEN = 'TuTokenSecreto2024';   // ← pon algo único
   ```

4. **(Importante) Crea el primer usuario Administradora**: en la hoja **Usuarios**,
   agrega una fila con tu correo y rol `Administradora` (ver la estructura de columnas
   más abajo). Sin este usuario nadie puede entrar como admin.
   - Para autorizar a más personas, agrega su correo en la hoja *Usuarios* (rol
     `Empleada`); ellas se registrarán solas desde la app y elegirán su contraseña.

5. **Revisa los scopes en `apps-script/appsscript.json`** — incluye:
   - `spreadsheets`, `calendar`, **`gmail.send`** (¡necesario para el reset por mail!)
   - `drive.file`, `script.external_request`, `script.scriptapp`, `userinfo.email`.

6. **Despliega como Web App** (*Implementar → Nueva implementación → Aplicación web*):
   - **Ejecutar como:** Yo (tu cuenta de Google, que tiene Gmail)
   - **Quién tiene acceso:** Cualquier usuario
   - Autoriza los permisos de **Sheets + Calendar + Gmail**.

7. **Copia la URL** del Web App: `https://script.google.com/macros/s/«…»/exec`.

> 🔄 Cada vez que edites `Code.gs`, vuelve a *Implementar → Gestionar → Nueva versión*.
> Los permisos de Gmail son obligatorios: sin ellos, el reset de contraseña por correo
> no funcionará.

---

## 👥 Configurar usuarios (hoja `Usuarios`)

Los usuarios se gestionan **directamente en la hoja `Usuarios`** de Google Sheets.
El sistema no permite registro público — solo correos pre-autorizados pueden crear
cuenta. La estructura de columnas es:

| Columna | Campo | Descripción |
|---|---|---|
| A | **Email** | Correo del usuario (en minúsculas) |
| B | PasswordHash | Se llena automáticamente al registrarse |
| C | ResetToken | Uso interno (recuperación de contraseña) |
| D | ResetExpiry | Uso interno |
| E | CreadoEn | Fecha de registro |
| F | **Rol** | `Administradora` o `Empleada` |
| G | **Nombre** | Nombre completo que se muestra en la app |

**Para agregar una nueva usuaria:**
1. Abre la hoja `Usuarios` en Google Sheets.
2. Agrega una fila con el **email** (col. A) y el **rol** (col. F).
3. Escribe el **nombre** en la columna G.
4. La usuaria puede registrar su contraseña desde la pantalla de login → **Crear cuenta**.

> ⚙️ La administradora también puede **cambiar roles** desde la app:
> **Config → Gestión de accesos** (sin tocar la hoja a mano).

---

## 🔐 Autenticación y roles

### Flujo de login
1. El usuario escribe email y contraseña en `Auth.jsx`.
2. La contraseña se **hashea con SHA-256** en el navegador (`crypto.subtle`).
3. Se envía `{ email, passwordHash }` al backend (acción `auth_login`).
4. El backend compara el hash con el guardado en la hoja *Usuarios* y devuelve
   `{ email, role, name }`.
5. La app guarda `email` + `role` + `name` en `localStorage` y muestra la UI según rol.

### Roles y permisos
- **Administradora** (`userRole === 'Administradora'`): acceso completo, ve todas las
  pestañas (Servicios, Finanzas, Reportes), gestiona usuarios y resetea el sistema.
- **Empleada** (por defecto `userRole === 'Empleada'`): ve Panel, Citas (solo las
  suyas), Clientes, **Mis Gastos**, Calendario y Config (parcial).

La aplicación filtra dinámicamente las pestañas de navegación y los datos según el rol
(`visibleAppts`, `visibleExpenses`), y el backend **vuelve a validar** permisos en cada
escritura (defensa en profundidad).

### Recuperación de contraseña
1. El usuario pide reset → el backend genera un **código de 6 dígitos** con validez de
   **1 hora** y lo envía por **Gmail** a su correo.
2. El usuario introduce el código + la nueva contraseña → `auth_reset_password`.
3. Si el código expiró o es incorrecto, el backend rechaza el cambio.

---

## 🗄️ Auditoría

El backend registra **cada operación de escritura** en la hoja **Auditoría**:
- **Quién** lo hizo (`userEmail`).
- **Qué** acción (crear / editar / eliminar).
- **Sobre qué entidad** (cliente, cita, gasto, etc.).
- **Estado anterior** y **estado posterior** del registro (cuando aplica).
- **Fecha y hora** (zona `America/Bogota`).

La administradora consulta la auditoría mensual desde **Reportes**.

---

## 🔒 Seguridad

- Todas las peticiones al backend requieren el `SECRET_TOKEN`.
- Las contraseñas se almacenan como **hash SHA-256** (nunca en texto plano).
- Los tokens de recuperación de contraseña **expiran en 1 hora**.
- El backend solo expone datos de usuarios **sin contraseñas** al frontend
  (`readPublicUsers`).
- El registro está **cerrado**: solo correos pre-autorizados en la hoja pueden crear
  cuenta.
- El backend **re-valida permisos por rol** en cada escritura (no confía solo en el
  frontend).

---

## 🔐 Variables de entorno

Copia `.env.example` a `.env` (local) o configúralas en
**Vercel → Settings → Environment Variables** (producción).

| Variable            | Obligatoria | Descripción                                                          |
|---------------------|:-----------:|----------------------------------------------------------------------|
| `VITE_SCRIPT_URL`   |     ✅      | URL del Web App de Apps Script (`…/exec`)                            |
| `VITE_TOKEN`        |     ✅      | Debe coincidir exactamente con `SECRET_TOKEN` en `Code.gs`          |
| `VITE_BIZ_NAME`     |     —       | Nombre del negocio (header + `<title>`). ⚠️ **sin emoji**            |
| `VITE_BIZ_SUBTITLE` |     —       | Subtítulo corto (p. ej. *Micropigmentación*)                         |
| `VITE_BIZ_EMOJI`    |     —       | Emoji del favicon (se inyecta en runtime, p. ej. `🌸`)              |
| `VITE_BIZ_LOGO`     |     —       | URL absoluta del logo (header + `apple-touch-icon`)                  |

> ⚠️ Sin `VITE_SCRIPT_URL` y `VITE_TOKEN` la app **no puede loguearse ni cargar datos**.
> ⚠️ `VITE_BIZ_NAME` **no debe incluir el emoji** — va por separado en `VITE_BIZ_EMOJI`
> (así evitamos artefactos de codificación en el `<title>`).

---

## ☁️ Despliegue en Vercel

1. Sube el repositorio a **GitHub**.
2. En [vercel.com](https://vercel.com) → **New Project** → importa el repo.
3. Framework: **Vite** (se detecta solo).
4. **Settings → Environment Variables** → agrega `VITE_SCRIPT_URL` y `VITE_TOKEN`
   (y las opcionales de branding).
5. **Deploy** ✅.

### ✅ Cómo verificar que quedó bien
- La pantalla de **Login** aparece (si no, revisa `VITE_SCRIPT_URL`).
- Loguéate con el usuario Administradora que creaste en la hoja *Usuarios*.
- La app debe mostrar las pestañas de admin (Servicios, Finanzas, Reportes).
- Agenda una cita → debe aparecer en **Google Calendar** y en la hoja *Citas*.
- Una fila nueva debe aparecer en la hoja **Auditoría** con tu email.
- Pide reset de contraseña desde otra cuenta → debe llegar un código por **Gmail**.

---

## 🧭 Guía rápida de uso (dentro de la app)

| Pestaña       | Rol            | Para qué sirve                                                             |
|---------------|----------------|----------------------------------------------------------------------------|
| **Panel**     | Todos          | Resumen del día: citas de hoy, recordatorios, balance (admin) o resumen (empleada). |
| **Citas**     | Todos          | Crear/editar/eliminar; admin asigna a empleada, empleada se auto-asigna.   |
| **Clientes**  | Todos          | Buscar y administrar; ver historial (con quién atendió).                    |
| **Servicios** | 🔒 Admin       | Catálogo y precios (historial de precios automático).                      |
| **Finanzas**  | 🔒 Admin       | Ingresos, gastos (todos), detalle, comparación y top servicios.            |
| **Mis Gastos**| 👤 Empleada    | Registra y ve **solo sus propios gastos**.                                 |
| **Reportes**  | 🔒 Admin       | Resumen por empleada + auditoría + exportación Excel.                      |
| **Calendario**| Todos          | Vista mensual de las citas.                                                |
| **Config**    | Todos (parcial)| Tema/paleta, cambio de contraseña; **gestión de accesos y reset solo admin**. |

> 📖 Para el detalle operativo (paso a paso para la operadora), consulta **`MANUAL.md`**.

---

## 🩹 Solución de problemas

| Síntoma | Solución |
|---|---|
| **No puedo entrar** (pantalla login no carga) | Revisa `VITE_SCRIPT_URL` en Vercel. El Web App debe estar desplegado como *Cualquier usuario*. |
| **"Este correo no está autorizado"** al registrarte | La administradora debe agregar **previamente** tu correo en la hoja *Usuarios* del Spreadsheet. |
| **No puedo loguearme como Admin** | Debiste crear a mano una fila `Administradora` en la hoja *Usuarios*. Sin ese primer admin, nadie puede gestionar accesos. |
| **No llegan los códigos de reset** | El Apps Script debe tener el scope **`gmail.send`** y el deploy debe ejecutarse **como tu cuenta** (la que tiene Gmail). Autoriza permisos reimplementando. |
| **El token no coincide** | `VITE_TOKEN` en Vercel debe ser **idéntico** a `SECRET_TOKEN` en `Code.gs`. |
| **El evento de Calendar no se crea** | Autoriza permisos de Calendar al reimplementar el Apps Script. |
| **Se ven citas/gastos de otra empleada** | Revisa el `assignedTo`/`createdBy` de los registros; el filtro por rol usa estos campos. |
| Horas desplazadas | Zona `America/Bogota` (UC-5) + `localNowISO`; no cambies la zona del script. |
| Build falla con *“URI malformed”* | No pongas emojis o `%` literal en atributos `href`/`src` del `index.html`. |

---

## 🗺️ Roadmap

- [ ] Recordatorios automáticos con triggers time-driven.
- [ ] Log/visita de sesiones por usuario.
- [ ] Exportación de auditoría a Excel.
- [ ] Salts por usuario en el hash de contraseña (mayor seguridad).
- [ ] Comisiones / reparto de ingresos por empleada.

---

## 📄 Licencia

© 2026 Bryan Morales — Uso privado.

---

<div align="center">

📘 **`MANUAL.md`** incluye el manual de usuario operativo.
📘 **`Manual_SZ_Micropigmentacion.docx`** es el manual exportado en Word.

Hecho con 💗 para estudios de micropigmentación con equipo.

</div>
