# 📖 Manual de Usuario — SZ Micropigmentación
### Sistema de Gestión de Citas, Clientes y Finanzas

---

## Tabla de contenido

1. [Acceso al sistema](#1-acceso-al-sistema)
2. [Roles de usuario](#2-roles-de-usuario)
3. [Panel principal](#3-panel-principal)
4. [Citas](#4-citas)
5. [Clientes](#5-clientes)
6. [Servicios](#6-servicios)
7. [Finanzas](#7-finanzas--solo-administradora)
8. [Mis Gastos](#8-mis-gastos--empleada)
9. [Reportes](#9-reportes--solo-administradora)
10. [Configuración](#10-configuración)
11. [Preguntas frecuentes](#11-preguntas-frecuentes)

---

## 1. Acceso al sistema

### Iniciar sesión
1. Abre el enlace de la aplicación en tu navegador o celular
2. Escribe tu correo y contraseña
3. Toca **Ingresar**

### Crear cuenta (primera vez)
Solo puedes registrarte si la administradora ya agregó tu correo en el sistema.

1. En la pantalla de login, toca **Crear cuenta**
2. Escribe tu correo, nombre completo y contraseña
3. Toca **Registrarme**

> Si aparece *"Este correo no está autorizado"*, contacta a la administradora para que agregue tu correo en Google Sheets.

### Recuperar contraseña
1. Toca **¿Olvidaste tu contraseña?**
2. Escribe tu correo
3. Recibirás un código de 6 dígitos al correo — válido por **1 hora**
4. Ingresa el código y escribe tu nueva contraseña

### Cerrar sesión
Toca tu nombre en la esquina superior derecha → **🚪 Cerrar sesión**

---

## 2. Roles de usuario

| Función | Administradora | Empleada |
|---|:---:|:---:|
| Ver todas las citas | ✅ | ❌ Solo propias |
| Crear citas y asignar empleada | ✅ | ✅ Solo para sí misma |
| Reasignar citas | ✅ | ❌ |
| Gestión de clientes | ✅ | ✅ |
| Catálogo de servicios | ✅ | Solo lectura |
| Finanzas e ingresos | ✅ | ❌ |
| Gastos | ✅ Todos | ✅ Solo propios |
| Crear/eliminar categorías de gasto | ✅ | ❌ |
| Reportes del equipo | ✅ | ❌ |
| Configuración visual | ✅ | ✅ |
| Restablecer el sistema | ✅ | ❌ |

---

## 3. Panel principal

**Administradora:** ingresos del mes, gastos, neto, citas pendientes hoy y accesos rápidos.

**Empleada:** sus citas del día, próximas y acceso rápido a nueva cita.

---

## 4. Citas

### Grupos de la agenda

| Grupo | Descripción |
|---|---|
| 🔴 Hoy | Citas del día |
| 🟠 Mañana | Citas de mañana |
| 🔵 Próximas | Desde pasado mañana |
| ⚫ No asistió | Marcadas como no show |
| 🩶 Pasadas | Anteriores sin completar |

---

### Crear una nueva cita

Toca **+ Nueva cita** y sigue los 5 pasos:

**Paso 1 — Cliente**
Busca por nombre o celular. Si no existe, toca **+ Nuevo cliente**.

**Paso 2 — Servicio(s)**
Selecciona uno o más. El total se calcula automáticamente.

> 💡 Para **descuentos o promociones**, crea el servicio con precio promocional (ej: "Lifting - Promo"). Al terminar la promo puedes eliminarlo del catálogo — las citas y reportes conservan el precio histórico.

**Paso 3 — Domicilio (opcional)**
Activa si es a domicilio, escribe la dirección y el costo adicional.

**Paso 4 — Fecha y hora**
Selecciona fecha y elige un horario disponible.

**Reglas de disponibilidad:**
- Cada servicio dura **1 hora** — el sistema bloquea los 60 minutos siguientes
- Cita a las 7:30 PM → bloquea 7:00, 7:30 y 8:00 PM
- El slot 8:30 PM queda libre (empieza exactamente cuando termina la anterior)
- La validación es **por empleada** — cada quien maneja su propio horario independiente

**Paso 4.5 — Atendida por** *(solo Administradora)*
Selecciona la empleada. Si ya tiene cita en ese horario, el slot queda bloqueado.

**Paso 5 — Confirmar**
Revisa el resumen y toca **Confirmar cita**.

---

### Editar una cita

1. Toca la cita para expandirla → ✏️ **Editar**
2. Modifica los datos
3. Toca **Guardar cambios**

> Al cambiar la empleada asignada, el evento de Calendar se elimina del calendario anterior y se crea en el de la nueva empleada.

---

### Marcar estado

| Botón | Efecto |
|---|---|
| ✅ Completada | Suma a ingresos y reportes |
| ✗ No asistió | No suma a ingresos |

Toca el mismo botón para desmarcar. El cambio se guarda inmediatamente.

---

### Recordatorio por WhatsApp

Toca 💬 en cualquier cita pendiente. Se abre WhatsApp con el mensaje preparado que incluye:
- Servicio, fecha y hora
- Total a pagar
- 👩‍💼 Será atendida por: [nombre]
- Indicación de domicilio si aplica

---

### Eliminar una cita

Expande la cita → 🗑️ → Confirma. El evento de Google Calendar se elimina automáticamente.

---

### Google Calendar

Cada cita genera automáticamente:
- Evento en el calendario de la **empleada que la atiende**
- Copia en el calendario de la **administradora**

Al reasignar, el evento se mueve al calendario correspondiente.
Al eliminar, el evento desaparece de todos los calendarios.

---

## 5. Clientes

### Buscar y agregar
- Buscador por nombre o celular en la pestaña Clientes
- **+ Nuevo cliente** → nombre y celular → Guardar

### Historial
Toca **Historial** en la tarjeta del cliente para ver todas sus citas con estado y quién la atendió.

### Editar / Eliminar
Botones ✏️ y 🗑️ en cada tarjeta. No se puede eliminar un cliente con citas activas.

---

## 6. Servicios

*(Solo Administradora puede gestionar)*

### Agregar
**+ Nuevo servicio** → nombre y precio → Guardar.

### Editar precio
Toca ✏️. El nuevo precio aplica solo a citas futuras — las existentes conservan el precio original.

### Eliminar
Toca 🗑️. Las citas y reportes existentes conservan el nombre y precio histórico.

---

## 7. Finanzas *(solo Administradora)*

### Resumen del mes
Ingresos · Gastos · Neto. Usa el selector para ver meses anteriores.

### Ingresos
Citas completadas del mes con detalle de servicios y montos.

### Gastos
Todos los gastos del mes (de todas las usuarias), con quién los registró.

**Agregar gasto:**
1. Descripción (primera letra en mayúscula automáticamente)
2. Monto y fecha
3. Categoría — o crea una nueva con **+ Nueva categoría**
4. **Registrar gasto**

**Categorías disponibles:** Insumos · Arriendo · Publicidad · Servicios · Transporte · Gasolina · Otros

**Eliminar una categoría:**
Aparecen como chips con **×**. El × solo se activa si ningún gasto usa esa categoría actualmente.

### Comparación mensual
Gráfico de ingresos vs gastos de los últimos meses.

### Servicios rentables

Dos vistas con botón toggle:

**💰 Por ingresos** — ordena por dinero generado. Muestra el total acumulado histórico respetando el precio de cada cita.

Ejemplo: 2 Lifting a $85.000 = $170.000. Luego precio sube a $90.000 y se hace 1 más = $170.000 + $90.000 = **$260.000 en 3 servicios**.

**🔥 Por demanda** — ordena por veces realizado. Muestra cuántas veces se hizo y el total generado.

Filtra por período: Todo / 3 meses / 6 meses / Este año.

---

## 8. Mis Gastos *(Empleada)*

Solo se ven y gestionan los gastos propios.

**Registrar gasto:**
1. Descripción, monto y fecha
2. Categoría de la lista *(no se pueden crear nuevas — las crea la administradora)*
3. **Registrar gasto**

Usa el selector de mes para ver el historial.

---

## 9. Reportes *(solo Administradora)*

Los datos se calculan **en tiempo real** desde citas y gastos actuales.

### Tarjeta por usuaria

| Indicador | Descripción |
|---|---|
| ✏️ Citas creadas | Citas que esa persona ingresó al sistema |
| 👩‍💼 Citas atendidas | Citas que esa persona completó (marcadas ✅) |
| 🧾 Gastos | Cantidad y monto total de gastos del mes |
| 💰 Ingresos | Suma de citas completadas que atendió |
| Neto del mes | Ingresos − Gastos (verde positivo, rojo negativo) |

### Navegación
- Toca **Citas creadas** → va a la lista de Citas → botón **← Reportes** para volver
- Toca **Gastos** → va al Detalle de Gastos → botón **← Volver** regresa a Reportes

### Selector de mes
Muestra todos los meses con actividad — incluyendo meses futuros si hay citas o gastos con fecha adelantada.

### Gestión de accesos *(pestaña Accesos)*

Para cambiar el rol de una usuaria:
1. Escribe su correo
2. Selecciona **👑 Administradora** o **👤 Empleada**
3. **Actualizar rol**

> Para autorizar a una nueva usuaria, primero agrega su correo en la hoja **Usuarios** de Google Sheets, luego asígnale el rol aquí.

---

## 10. Configuración

Accesible para todas las usuarias desde el ícono ⚙️ (última opción en la barra de navegación).

### 🌗 Modo de visualización
**☀️ Modo claro** o **🌙 Modo oscuro** — se guarda por dispositivo. Cada usuaria elige su preferencia independientemente.

### 🎨 Paleta de colores

| Paleta | | Paleta | |
|---|---|---|---|
| 💗 Fucsia | `#C04A82` | 🌿 Salvia | `#4A8C6E` |
| 🌸 Rosa Blush | `#B5524A` | ✨ Ámbar | `#C08A2A` |
| 💜 Lavanda | `#7C5CBF` | 🧡 Coral | `#C2664A` |
| 💙 Azul Sereno | `#3A6EA8` | 🌊 Turquesa | `#2A8A8A` |
| 🖤 Carbón | `#5A5A7A` | | |

Al seleccionar una paleta aparece una **vista previa en tiempo real**. Los cambios aplican instantáneamente a toda la app incluyendo modo oscuro.

### ⚠️ Restablecer el sistema *(solo Administradora)*

Elimina permanentemente: clientes, citas, gastos, auditoría y eventos de Google Calendar.
**Conserva:** servicios y usuarios.

**Pasos:**
1. Toca **Restablecer sistema…**
2. Escribe exactamente `CONFIRMAR`
3. Toca **Eliminar todo**

> Esta acción **no se puede deshacer**.

---

## 11. Preguntas frecuentes

**¿Por qué un horario aparece bloqueado?**
Los servicios duran 1 hora. Cita a las 7:30 PM → bloquea 7:00, 7:30 y 8:00 PM. El slot 8:30 PM está libre. La validación es por empleada: cada quien tiene su propia disponibilidad.

---

**¿Por qué no puedo guardar al editar?**
Si la empleada asignada ya tiene cita en ese horario, el botón "Guardar" se desactiva. El aviso amarillo ⚠️ indica el conflicto. Cambia la hora o la empleada.

---

**¿La empleada ve los horarios ocupados de la administradora?**
No. Al crear una cita, cada usuaria ve bloqueados únicamente sus propios horarios. La administradora ve la disponibilidad de la empleada que seleccione en "Atendida por".

---

**¿Por qué el precio histórico no cambia en reportes?**
Cada cita guarda el precio al momento de crearla. Cambiar el precio del catálogo no afecta citas pasadas. "Servicios rentables" suma los valores reales de cada cita.

---

**¿Cómo manejo descuentos?**
Crea el servicio con precio promocional (ej: "Lifting - Promo 50%"). Al terminar la promo, elimínalo. Las citas y reportes conservan el historial intacto. En reportes aparecerá como servicio separado con su propio total.

---

**¿El recordatorio de WhatsApp se envía automáticamente?**
No. Se envía manualmente tocando 💬. La app prepara el mensaje completo pero tú decides cuándo enviarlo.

---

**¿Los datos se guardan en tiempo real?**
Sí. Cada acción se guarda inmediatamente. La app se actualiza en segundo plano cada 30 segundos. Si hay un guardado en curso, el auto-refresh espera para evitar conflictos.

---

**¿Puedo usar la app desde el celular?**
Sí. Para mejor experiencia, agrégala a la pantalla de inicio:
- **iOS:** ícono compartir → "Agregar a pantalla de inicio"
- **Android:** tres puntos → "Agregar a pantalla de inicio"

---

**¿Cómo agrego una nueva empleada?**
1. Abre la hoja **Usuarios** en Google Sheets
2. Agrega una fila: correo (col A) · rol `Empleada` (col F) · nombre (col G)
3. La empleada registra su contraseña desde el login → "Crear cuenta"

---

*Manual actualizado: mayo 2026 — SZ Micropigmentación*
