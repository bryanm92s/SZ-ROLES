# 🌸 SZ Micropigmentación — Sistema de Gestión

> Aplicación web completa para la gestión de un estudio de micropigmentación y cejas. Construida con **React + Vite** en el frontend y **Google Apps Script + Google Sheets** como backend sin servidor.

---

## ✨ Funcionalidades

### 👩‍💼 Roles de usuario
| Característica | Administradora | Empleada |
|---|:---:|:---:|
| Ver y crear citas | ✅ (todas) | ✅ (propias) |
| Asignar cita a empleada | ✅ | ❌ |
| Reasignar cita existente | ✅ | ❌ |
| Gestión de clientes | ✅ | ✅ |
| Catálogo de servicios | ✅ | Solo lectura |
| Finanzas e ingresos | ✅ | ❌ |
| Gastos | ✅ (todos) | ✅ (propios) |
| Crear categorías de gasto | ✅ | ❌ |
| Reportes por empleada | ✅ | ❌ |
| Ver historial de clientes | ✅ | ✅ |

### 📅 Citas
- Agenda visual por día (Hoy / Mañana / Próximas / Pasadas)
- Slots de 30 minutos (07:00 – 20:30)
- **Detección de conflictos de horario por empleada** — bloquea guardar si la empleada asignada ya tiene cita en ese slot
- Servicio a domicilio con precio configurable
- Integración con **Google Calendar** (crear/editar/eliminar eventos automáticamente)
- Recordatorio por **WhatsApp** con un clic
- Marcado de citas como Completada / No asistió
- Historial de citas por cliente con empleada que atendió

### 💰 Finanzas
- Ingresos por mes con desglose de servicios
- Gastos por mes con categorías personalizables
- Comparación mes a mes
- Top servicios más demandados
- Cada gasto muestra quién lo registró

### 📊 Reportes (Administradora)
- Resumen mensual por empleada: citas creadas, gastos y montos
- Navegación directa desde tarjeta de empleada → citas o gastos → volver a reportes

### 🔐 Autenticación
- Login con email y contraseña (hash SHA-256)
- Registro solo para correos pre-autorizados en la hoja de Usuarios
- Cambio de contraseña desde la app
- Recuperación de contraseña por email (con token de 1 hora)

### 🗄️ Auditoría
- Registro automático de cada CREAR / EDITAR / ELIMINAR en una hoja de Google Sheets
- Incluye estado anterior y posterior de cada registro

---

## 🏗️ Arquitectura

```
┌─────────────────────┐        ┌──────────────────────────────┐
│   React + Vite      │  HTTP  │   Google Apps Script (API)   │
│   (Vercel / CDN)    │◄──────►│   doGet / doPost             │
│                     │        │   + token de seguridad       │
└─────────────────────┘        └──────────┬───────────────────┘
                                          │
                               ┌──────────▼───────────────────┐
                               │      Google Sheets           │
                               │  Clientes | Servicios        │
                               │  Citas | Gastos              │
                               │  Usuarios | Auditoría        │
                               └──────────────────────────────┘
                                          │
                               ┌──────────▼───────────────────┐
                               │     Google Calendar          │
                               │  (eventos automáticos)       │
                               └──────────────────────────────┘
```

---

## 🚀 Instalación y deploy

### Requisitos
- Node.js 18+
- Cuenta de Google (para Sheets + Apps Script)
- Cuenta de Vercel (gratuita)

### 1. Clonar y preparar

```bash
git clone https://github.com/TU_USUARIO/sz-micropigmentacion.git
cd sz-micropigmentacion
npm install
```

### 2. Configurar Google Sheets

1. Ir a [sheets.google.com](https://sheets.google.com) y crear una hoja nueva
2. Nombrarla `SZ Micropigmentación DB`
3. Copiar el **ID** de la URL:
   ```
   https://docs.google.com/spreadsheets/d/ ← ESTE_ID → /edit
   ```
   > Las hojas (`Clientes`, `Servicios`, `Citas`, `Gastos`, `Usuarios`, `Auditoría`) se crean automáticamente al primer uso.

### 3. Configurar Google Apps Script

1. Desde la hoja → **Extensiones → Apps Script**
2. Reemplazar todo el contenido con `apps-script/Code.gs`
3. Cambiar el token en la línea 7:
   ```js
   const SECRET_TOKEN = 'TuTokenUnico2024';
   ```
4. **Implementar → Nueva implementación**
   - Tipo: Aplicación web
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier usuario**
5. Copiar la URL generada (termina en `/exec`)

### 4. Variables de entorno

Crear `.env` local (o configurar en Vercel):

```env
VITE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
VITE_TOKEN=TuTokenUnico2024
```

> ⚠️ El token en `.env` **debe coincidir exactamente** con el `SECRET_TOKEN` de `Code.gs`.

### 5. Ejecutar en local

```bash
npm run dev
```

### 6. Deploy en Vercel

1. Subir el proyecto a GitHub
2. En [vercel.com](https://vercel.com) → New Project → importar repo
3. Agregar variables de entorno (`VITE_SCRIPT_URL` y `VITE_TOKEN`)
4. Deploy ✅

---

## 👥 Configurar usuarios

Los usuarios se gestionan **directamente en la hoja `Usuarios`** de Google Sheets. El sistema no permite registro público — solo correos pre-registrados pueden crear cuenta.

| Columna | Descripción |
|---|---|
| A — Email | Correo del usuario (minúsculas) |
| B — PasswordHash | Se llena automáticamente al registrarse |
| C — ResetToken | Uso interno (recuperación de contraseña) |
| D — ResetExpiry | Uso interno |
| E — CreadoEn | Fecha de registro |
| F — **Rol** | `Administradora` o `Empleada` |
| G — **Nombre** | Nombre completo que se muestra en la app |

**Para agregar una nueva usuaria:**
1. Abrir la hoja `Usuarios` en Google Sheets
2. Agregar una fila con el email y el rol (columnas A y F)
3. Escribir el nombre en columna G
4. La usuaria puede registrar su contraseña desde la pantalla de login → "Crear cuenta"

---

## 📁 Estructura del proyecto

```
sz-micropigmentacion/
│
├── apps-script/
│   ├── Code.gs              # Backend completo (API REST en Apps Script)
│   └── appsscript.json      # Configuración de permisos
│
├── src/
│   ├── App.jsx              # Componente principal + todos los módulos
│   ├── Auth.jsx             # Login, registro, recuperación de contraseña
│   ├── ReportsTab.jsx       # Tab de reportes por empleada
│   ├── api.js               # Funciones de fetch al Apps Script
│   ├── index.css            # Estilos globales (variables CSS + clases)
│   └── main.jsx             # Entry point React
│
├── .env.example             # Plantilla de variables de entorno
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── SETUP.md                 # Guía de configuración detallada
```

---

## 🔒 Seguridad

- Todas las peticiones al backend requieren el `SECRET_TOKEN`
- Las contraseñas se almacenan como hash SHA-256 (nunca en texto plano)
- Los tokens de recuperación de contraseña expiran en 1 hora
- El backend solo expone datos de usuarios sin contraseñas al frontend (`readPublicUsers`)
- El registro está cerrado: solo correos pre-autorizados en la hoja pueden crear cuenta

---

## 🛠️ Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Estilos | CSS custom properties (sin frameworks) |
| Backend | Google Apps Script (V8) |
| Base de datos | Google Sheets |
| Calendario | Google Calendar API (via Apps Script) |
| Deploy frontend | Vercel |
| Autenticación | Custom (hash SHA-256 + Google Sheets) |

---

## 📄 Licencia

© 2026 Bryan Morales — Uso privado.
