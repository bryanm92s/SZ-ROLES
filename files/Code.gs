// ╔══════════════════════════════════════════════════════════════╗
// ║  Salome Zuluaga | Micropigmentación — Apps Script v8          ║
// ║  + Roles (Administradora / Empleada)                          ║
// ║  + Reportes por usuario                                       ║
// ╚══════════════════════════════════════════════════════════════╝

const SECRET_TOKEN = 'CAMBIA_ESTE_TOKEN';

// Email de la Administradora — se detecta automáticamente como el dueño del script.
// Se usa como función para evitar errores al inicializar con ANYONE_ANONYMOUS.
function getAdminEmail() {
  try { return Session.getEffectiveUser().getEmail() || '' } catch(e) { return '' }
}

const SHEETS = {
  clients:     'Clientes',
  services:    'Servicios',
  appointments:'Citas',
  expenses:    'Gastos',
  users:       'Usuarios',
  audit:       'Auditoría',
};

const JS_KEYS = {
  clients:      ['id','name','phone','createdAt'],
  services:     ['id','name','price'],
  appointments: ['id','clientId','clientName','clientPhone',
                 'serviceIds','serviceNames','servicePrice',
                 'domicilio','domicilioPrice','totalPrice','address',
                 'date','time','createdAt','calendarCreated','calendarEventId','adminEventId','completed','assignedTo','createdBy'],
  expenses:     ['id','description','amount','category','date','createdBy'],
};

const HEADERS_ES = {
  clients:      ['ID','Nombre','Celular','Fecha Registro'],
  services:     ['ID','Nombre','Precio'],
  appointments: ['ID','ID Cliente','Nombre Cliente','Celular',
                 'IDs Servicios','Nombres Servicios','Precio Servicios',
                 'Domicilio','Precio Domicilio','Total','Dirección',
                 'Fecha','Hora','Fecha Creación','Evento Creado','ID Evento Calendar','ID Evento Admin','Completada','Atendida Por','Creada Por'],
  expenses:     ['ID','Descripción','Monto','Categoría','Fecha','Creado Por'],
};

// Col: Email | PasswordHash | ResetToken | ResetExpiry | CreadoEn | Rol | Nombre
const USERS_HEADERS = ['Email','PasswordHash','ResetToken','ResetExpiry','CreadoEn','Rol','Nombre'];

const AUDIT_HEADERS = ['Fecha','Hora','Usuario','Módulo','Acción','ID','Descripción','Antes','Después'];

const AUDIT_LABEL = {
  clients:      r => r.name + ' | ' + r.phone,
  services:     r => r.name + ' | $' + Number(r.price||0).toLocaleString('es-CO'),
  appointments: r => r.clientName + ' | ' + r.serviceNames + ' | ' + r.date + ' ' + r.time,
  expenses:     r => r.description + ' | $' + Number(r.amount||0).toLocaleString('es-CO') + ' | ' + r.date,
};

const MODULE_NAMES = {
  clients:'Clientes', services:'Servicios', appointments:'Citas', expenses:'Gastos'
};

/* ══════════════════════════════════════════════════════════════
   HTTP HANDLERS
══════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    if (e.parameter.token !== SECRET_TOKEN) return err('No autorizado');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);
    return ok({
      clients:      readSheet(ss,'clients'),
      services:     readSheet(ss,'services'),
      appointments: readSheet(ss,'appointments'),
      expenses:     readSheet(ss,'expenses'),
      users:        readPublicUsers(ss),
    });
  } catch(ex) { return err('GET: '+ex.message); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== SECRET_TOKEN) return err('No autorizado');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    // ── Auth ─────────────────────────────────────────────────
    if (b.action === 'auth_login')           return handleLogin(ss, b);
    if (b.action === 'auth_register')        return handleRegister(ss, b);
    if (b.action === 'auth_change_password') return handleChangePassword(ss, b);
    if (b.action === 'auth_request_reset')   return handleRequestReset(ss, b);
    if (b.action === 'auth_reset_password')  return handleResetPassword(ss, b);
    if (b.action === 'update_user_role')     return handleUpdateRole(ss, b);

    // ── Reportes ─────────────────────────────────────────────
    if (b.action === 'get_audit_report')     return handleAuditReport(ss, b);
    if (b.action === 'full_reset')           return handleFullReset(ss, b);

    // ── Calendar ──────────────────────────────────────────────
    if (b.action==='deleteCalendarEvent') return ok({calResult:deleteCalEvent(b.eventId)});
    if (b.action==='updateCalendarEvent') {
      if (b.calendarEvent && b.calendarEvent.assignedTo && !b.calendarEvent.assignedToName) {
        const u = findUser(ss, b.calendarEvent.assignedTo);
        if (u && u.name) b.calendarEvent.assignedToName = u.name;
      }
      const r1 = updateCalEvent(b.eventId, b.calendarEvent);
      const r2 = b.adminEventId ? updateCalEvent(b.adminEventId, b.calendarEvent) : null;
      return ok({ calResult: r1, adminCalResult: r2 });
    }

    // ── Data sync (con auditoría) ─────────────────────────────
    const user = b.userEmail || 'desconocido';
    if (b.clients      !== undefined) { diffAndLog(ss,'clients',     b.clients,     user); writeSheet(ss,'clients',     b.clients);      }
    if (b.services     !== undefined) { diffAndLog(ss,'services',    b.services,    user); writeSheet(ss,'services',    b.services);     }
    if (b.appointments !== undefined) { diffAndLog(ss,'appointments',b.appointments,user); writeSheet(ss,'appointments',b.appointments); }
    if (b.expenses     !== undefined) { diffAndLog(ss,'expenses',    b.expenses,    user); writeSheet(ss,'expenses',    b.expenses);     }

    let calResult=null;
    if (b.calendarEvent) {
      try {
        if (b.calendarEvent.assignedTo && !b.calendarEvent.assignedToName) {
          const assignedUser = findUser(ss, b.calendarEvent.assignedTo);
          if (assignedUser && assignedUser.name) b.calendarEvent.assignedToName = assignedUser.name;
        }
        calResult = createCalEvent(b.calendarEvent);
      } catch(calEx) {
        calResult = { ok: false, error: 'Calendar: ' + calEx.message };
      }
    }
    if (b.deleteAdminEventId) { try { deleteCalEvent(b.deleteAdminEventId); } catch(e) {} }
    return ok({saved:true,calResult});
  } catch(ex) { return err('POST: '+ex.message); }
}

/* ══════════════════════════════════════════════════════════════
   USUARIOS PÚBLICOS (sin contraseñas) para el frontend
══════════════════════════════════════════════════════════════ */
function readPublicUsers(ss) {
  const sh = ss.getSheetByName(SHEETS.users);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const email = String(data[i][0]||'').trim();
    if (!email) continue;
    result.push({
      email: email,
      role:  String(data[i][5]||'Empleada').trim(),
      name:  String(data[i][6]||'').trim(),
    });
  }
  return result;
}

/* ══════════════════════════════════════════════════════════════
   FULL RESET — borra clientes, citas, gastos y auditoría
   Conserva: Servicios y Usuarios
══════════════════════════════════════════════════════════════ */
function handleFullReset(ss, b) {
  // 1. Borrar eventos de Google Calendar de todas las citas
  try {
    const appts = readSheet(ss, 'appointments');
    appts.forEach(a => {
      if (a.calendarEventId) { try { deleteCalEvent(a.calendarEventId) } catch(e) {} }
      if (a.adminEventId)    { try { deleteCalEvent(a.adminEventId)    } catch(e) {} }
    });
  } catch(e) {}

  // 2. Borrar datos de las hojas (conservar encabezados)
  const sheetsToClear = [SHEETS.clients, SHEETS.appointments, SHEETS.expenses, SHEETS.audit];
  sheetsToClear.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
  });

  return ok({ reset: true, cleared: sheetsToClear });
}

/* ══════════════════════════════════════════════════════════════
   REPORTES POR USUARIO
══════════════════════════════════════════════════════════════ */
function handleAuditReport(ss, b) {
  const month = b.month || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
  const ash = ss.getSheetByName(SHEETS.audit);
  if (!ash || ash.getLastRow() < 2) return ok({ month, users: [] });

  const data = ash.getDataRange().getValues();
  // Cols: 0=Fecha 1=Hora 2=Usuario 3=Módulo 4=Acción 5=ID 6=Desc 7=Antes 8=Después
  const report = {}; // { email: { citas:0, gastos:0, montoGastos:0 } }

  for (let i = 1; i < data.length; i++) {
    const row     = data[i];
    // La columna Fecha puede venir como Date o como string según Google Sheets
    let fecha = '';
    if (row[0] instanceof Date) {
      const d = row[0];
      fecha = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    } else {
      fecha = String(row[0]).trim();
    }
    const usuario = String(row[2]).trim();
    const modulo  = String(row[3]).trim();
    const accion  = String(row[4]).trim();

    if (!fecha.startsWith(month)) continue;
    if (accion !== 'CREAR') continue;
    if (!usuario || usuario === 'desconocido') continue;

    if (!report[usuario]) report[usuario] = { email:usuario, name:'', citas:0, gastos:0, montoGastos:0, _citaIds: new Set(), _gastoIds: new Set() };

    if (modulo === 'Citas') {
      const itemId = String(row[5]||'').trim();
      if (itemId && !report[usuario]._citaIds.has(itemId)) {
        report[usuario]._citaIds.add(itemId);
        report[usuario].citas++;
      } else if (!itemId) {
        report[usuario].citas++;
      }
    } else if (modulo === 'Gastos') {
      const itemId = String(row[5]||'').trim();
      if (itemId && !report[usuario]._gastoIds.has(itemId)) {
        report[usuario]._gastoIds.add(itemId);
        report[usuario].gastos++;
        try {
          const after = JSON.parse(String(row[8]));
          report[usuario].montoGastos += Number(after.amount || 0);
        } catch(e) {}
      } else if (!itemId) {
        report[usuario].gastos++;
        try {
          const after = JSON.parse(String(row[8]));
          report[usuario].montoGastos += Number(after.amount || 0);
        } catch(e) {}
      }
    }
  }

  // Enriquecer con nombres reales desde la hoja de usuarios
  const userRows = readPublicUsers(ss);
  userRows.forEach(u => {
    const key = String(u.email).trim().toLowerCase();
    if (report[key]) report[key].name = u.name || '';
  });

  // Limpiar sets internos antes de serializar
  Object.values(report).forEach(r => { delete r._citaIds; delete r._gastoIds; });

  return ok({ month, users: Object.values(report) });
}

/* ══════════════════════════════════════════════════════════════
   AUDITORÍA — DIFF Y LOG
══════════════════════════════════════════════════════════════ */
function diffAndLog(ss, key, newRows, userEmail) {
  try {
    const oldRows = readSheet(ss, key);
    const oldMap  = {};
    oldRows.forEach(r => { oldMap[r.id] = r; });
    const newMap  = {};
    (newRows||[]).forEach(r => { if(r.id) newMap[r.id] = r; });

    const entries = [];
    const labelFn = AUDIT_LABEL[key] || (r => r.id);
    const modName = MODULE_NAMES[key] || key;

    oldRows.forEach(old => {
      if (!newMap[old.id]) entries.push({ accion:'ELIMINAR', id:old.id, desc:labelFn(old), antes:JSON.stringify(old), despues:'' });
    });

    (newRows||[]).forEach(nw => {
      if (!nw.id) return;
      const old = oldMap[nw.id];
      if (!old) {
        entries.push({ accion:'CREAR', id:nw.id, desc:labelFn(nw), antes:'', despues:JSON.stringify(nw) });
      } else if (JSON.stringify(old) !== JSON.stringify(nw)) {
        entries.push({ accion:'EDITAR', id:nw.id, desc:labelFn(nw), antes:JSON.stringify(old), despues:JSON.stringify(nw) });
      }
    });

    if (entries.length === 0) return;

    const ash = ss.getSheetByName(SHEETS.audit);
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH:mm:ss');

    const rows = entries.map(e => [dateStr, timeStr, userEmail, modName, e.accion, e.id, e.desc, e.antes, e.despues]);

    if (ash.getLastRow() < 1) ash.getRange(1,1,1,AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    ash.insertRowsAfter(1, rows.length);
    ash.getRange(2, 1, rows.length, AUDIT_HEADERS.length).setValues(rows);

    rows.forEach((_, i) => {
      const accion = entries[i].accion;
      const bg    = accion==='CREAR'?'#D1FAE5':accion==='EDITAR'?'#FEF3C7':'#FEE2E2';
      const fg    = accion==='CREAR'?'#065F46':accion==='EDITAR'?'#78350F':'#7F1D1D';
      const row = ash.getRange(2+i, 1, 1, AUDIT_HEADERS.length);
      row.setBackground(bg);
      row.setFontColor(fg);
      // Action cell bold
      ash.getRange(2+i, 5).setFontWeight('bold');
    });
  } catch(ex) { console.error('Audit error: '+ex.message); }
}

/* ══════════════════════════════════════════════════════════════
   AUTH HANDLERS
══════════════════════════════════════════════════════════════ */
function handleLogin(ss, b) {
  if (!b.email || !b.passwordHash) return err('Faltan datos');
  const email = String(b.email).trim().toLowerCase();
  const row = findUser(ss, email);
  if (!row) return err('Correo no encontrado');
  if (!row.passwordHash) return err('Esta cuenta no tiene contraseña. Regístrate primero.');
  if (row.passwordHash !== b.passwordHash) return err('Contraseña incorrecta');
  return ok({ email: row.email, role: row.role || 'Empleada', name: row.name || '' });
}

function handleRegister(ss, b) {
  if (!b.email || !b.passwordHash) return err('Faltan datos');
  const email = String(b.email).trim().toLowerCase();
  const sh = ss.getSheetByName(SHEETS.users);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      if (data[i][1]) return err('Este correo ya tiene una cuenta. Inicia sesión.');
      sh.getRange(i+1, 2).setValue(b.passwordHash);
      sh.getRange(i+1, 5).setValue(new Date().toISOString());
      if (!data[i][5]) sh.getRange(i+1, 6).setValue('Empleada');
      if (b.name) sh.getRange(i+1, 7).setValue(b.name);
      return ok({ email, role: data[i][5] || 'Empleada', name: b.name || '' });
    }
  }
  return err('Este correo no está autorizado. Contacta a la administradora.');
}

function handleUpdateRole(ss, b) {
  if (!b.targetEmail || !b.newRole) return err('Faltan datos');
  const validRoles = ['Administradora','Empleada'];
  if (!validRoles.includes(b.newRole)) return err('Rol inválido');
  const email = String(b.targetEmail).trim().toLowerCase();
  const sh = ss.getSheetByName(SHEETS.users);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      sh.getRange(i+1, 6).setValue(b.newRole);
      return ok({ updated: true });
    }
  }
  return err('Usuario no encontrado');
}

function handleChangePassword(ss, b) {
  if (!b.email || !b.currentHash || !b.newHash) return err('Faltan datos');
  const email = String(b.email).trim().toLowerCase();
  const sh = ss.getSheetByName(SHEETS.users);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      if (data[i][1] !== b.currentHash) return err('La contraseña actual es incorrecta');
      sh.getRange(i+1, 2).setValue(b.newHash);
      sh.getRange(i+1, 3).setValue('');
      sh.getRange(i+1, 4).setValue('');
      return ok({ changed: true });
    }
  }
  return err('Usuario no encontrado');
}

function handleRequestReset(ss, b) {
  if (!b.email) return err('Falta el correo');
  const email = String(b.email).trim().toLowerCase();
  const sh = ss.getSheetByName(SHEETS.users);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      if (!data[i][1]) return err('Esta cuenta no tiene contraseña aún. Regístrate primero.');
      const code   = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      sh.getRange(i+1, 3).setValue(code);
      sh.getRange(i+1, 4).setValue(expiry);
      try {
        GmailApp.sendEmail(email, '🌸 Código para recuperar tu contraseña — SZ Micropigmentación', '', {
          htmlBody:
            '<div style="font-family:sans-serif;max-width:460px;margin:0 auto;background:#FDF6F0;border-radius:16px;padding:32px;">' +
            '<div style="text-align:center;margin-bottom:24px;"><span style="font-size:40px;">🌸</span>' +
            '<h2 style="color:#B85C6E;margin:12px 0 4px;">SZ Micropigmentación</h2>' +
            '<p style="color:#999;font-size:13px;margin:0;">Recuperación de contraseña</p></div>' +
            '<p style="color:#555;font-size:15px;">Tu código de verificación es:</p>' +
            '<div style="background:white;border-radius:12px;padding:24px;text-align:center;margin:20px 0;border:2px solid #F5D0D8;">' +
            '<span style="font-size:42px;font-weight:700;letter-spacing:12px;color:#B85C6E;">' + code + '</span></div>' +
            '<p style="color:#999;font-size:13px;text-align:center;">Expira en <strong>1 hora</strong>. Si no lo solicitaste, ignora este mensaje.</p>' +
            '</div>'
        });
      } catch(emailErr) { return err('No se pudo enviar el correo: ' + emailErr.message); }
      return ok({ sent: true });
    }
  }
  return err('Correo no encontrado');
}

function handleResetPassword(ss, b) {
  if (!b.email || !b.code || !b.newHash) return err('Faltan datos');
  const email = String(b.email).trim().toLowerCase();
  const sh = ss.getSheetByName(SHEETS.users);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      const storedCode   = String(data[i][2]).trim();
      const storedExpiry = String(data[i][3]).trim();
      if (!storedCode) return err('No hay código activo. Solicita uno nuevo.');
      if (storedCode !== String(b.code).trim()) return err('Código incorrecto');
      if (new Date() > new Date(storedExpiry)) return err('El código ha expirado. Solicita uno nuevo.');
      sh.getRange(i+1, 2).setValue(b.newHash);
      sh.getRange(i+1, 3).setValue('');
      sh.getRange(i+1, 4).setValue('');
      return ok({ reset: true });
    }
  }
  return err('Correo no encontrado');
}

function findUser(ss, email) {
  const sh = ss.getSheetByName(SHEETS.users);
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      return {
        email:        data[i][0],
        passwordHash: data[i][1],
        resetToken:   data[i][2],
        resetExpiry:  data[i][3],
        createdAt:    data[i][4],
        role:         data[i][5] || 'Empleada',
        name:         String(data[i][6]||'').trim(),
      };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   CALENDAR — por empleada + copia en admin
══════════════════════════════════════════════════════════════ */

// Obtiene el calendario de un usuario por email.
// Si es el usuario activo o no se puede acceder, usa el calendario por defecto.
function getCalendarForUser(email) {
  try {
    if (!email || email.trim().toLowerCase() === getAdminEmail().trim().toLowerCase()) {
      return CalendarApp.getDefaultCalendar();
    }
    // Busca si el usuario compartió su calendario con la cuenta del script
    const cals = CalendarApp.getAllCalendars();
    for (const c of cals) {
      if (c.getId().toLowerCase() === email.trim().toLowerCase()) return c;
    }
    return CalendarApp.getDefaultCalendar();
  } catch(ex) {
    return CalendarApp.getDefaultCalendar();
  }
}

function buildEventDesc(evt) {
  const dom = evt.domicilio === 'true' || evt.domicilio === true;
  const attendant = evt.assignedToName || evt.assignedTo || '';
  return '👤 ' + evt.clientName +
    '\n📱 ' + evt.clientPhone +
    '\n✨ ' + evt.serviceNames +
    '\n💳 Total: $' + Number(evt.totalPrice||0).toLocaleString('es-CO') +
    (dom ? '\n🛵 Domicilio: $' + Number(evt.domicilioPrice||0).toLocaleString('es-CO') +
           (evt.address ? '\n📍 ' + evt.address : '') : '') +
    (attendant ? '\n👩‍💼 Atendida por: ' + attendant : '');
}

function createCalEvent(evt) {
  try {
    const s = mkDate(evt.date, evt.time, 0), e = mkDate(evt.date, evt.time, 60);
    const title = '✨ ' + evt.serviceNames + ' — ' + evt.clientName;
    const desc  = buildEventDesc(evt);
    const assignedEmail = (evt.assignedTo || '').trim().toLowerCase();
    const adminEmail    = getAdminEmail().trim().toLowerCase();
    const result = { ok: true };

    // Crear en calendario del assignedTo
    const assignedCal = getCalendarForUser(assignedEmail);
    const assignedEvent = assignedCal.createEvent(title, s, e, { description: desc, sendInvites: false });
    assignedEvent.setColor(CalendarApp.EventColor.MAUVE);
    result.eventId = assignedEvent.getId();

    // Si el assignedTo NO es la admin, crear también en el calendario de la admin
    if (assignedEmail && assignedEmail !== adminEmail) {
      try {
        const adminCal   = CalendarApp.getDefaultCalendar();
        const adminEvent = adminCal.createEvent(title, s, e, { description: desc, sendInvites: false });
        adminEvent.setColor(CalendarApp.EventColor.MAUVE);
        result.adminEventId = adminEvent.getId();
      } catch(ex) { result.adminEventError = ex.message; }
    }

    return result;
  } catch(ex) { return { ok: false, error: ex.message }; }
}

function updateCalEvent(eventId, evt) {
  try {
    if (!eventId) return { ok: false, error: 'Sin ID' };
    const event = CalendarApp.getEventById(eventId);
    if (!event) return { ok: false, error: 'Evento no encontrado' };
    const s = mkDate(evt.date, evt.time, 0), e = mkDate(evt.date, evt.time, 60);
    event.setTime(s, e);
    if (evt.serviceNames || evt.clientName) {
      event.setTitle('✨ ' + (evt.serviceNames||'') + ' — ' + (evt.clientName||''));
    }
    if (evt.clientName) {
      event.setDescription(buildEventDesc(evt));
    }
    return { ok: true };
  } catch(ex) { return { ok: false, error: ex.message }; }
}

function deleteCalEvent(eventId) {
  try {
    if (!eventId) return { ok: false, error: 'Sin ID' };
    const event = CalendarApp.getEventById(eventId);
    if (!event) return { ok: true };
    event.deleteEvent();
    return { ok: true };
  } catch(ex) { return { ok: false, error: ex.message }; }
}
function mkDate(dateStr,timeStr,offsetMin) {
  const [y,m,d]=String(dateStr).split('-').map(Number);
  const [hh,mm]=String(timeStr).split(':').map(Number);
  const dt=new Date(y,m-1,d,hh,mm,0);
  dt.setMinutes(dt.getMinutes()+offsetMin);
  return dt;
}

/* ══════════════════════════════════════════════════════════════
   SHEETS INIT / READ / WRITE
══════════════════════════════════════════════════════════════ */
function initSheets(ss) {
  ['clients','services','appointments','expenses'].forEach(key => {
    if (!ss.getSheetByName(SHEETS[key])) ss.insertSheet(SHEETS[key]);
  });

  let ush = ss.getSheetByName(SHEETS.users);
  if (!ush) {
    ush = ss.insertSheet(SHEETS.users);
    ush.getRange(1,1,1,USERS_HEADERS.length).setValues([USERS_HEADERS]);
    const hdr = ush.getRange(1,1,1,USERS_HEADERS.length);
    hdr.setBackground('#FCE4EC'); hdr.setFontWeight('bold');
    ush.setColumnWidth(1,220); ush.setColumnWidth(2,200);
  } else {
    // Migrar: agregar col Rol si no existe
    const lastCol = ush.getLastColumn();
    if (lastCol < 6) {
      ush.getRange(1,6).setValue('Rol');
      const lastRow = ush.getLastRow();
      if (lastRow >= 2) ush.getRange(2,6).setValue('Administradora');
    }
    if (lastCol < 7) ush.getRange(1,7).setValue('Nombre');
  }

  let ash = ss.getSheetByName(SHEETS.audit);
  if (!ash) {
    ash = ss.insertSheet(SHEETS.audit);
    ash.getRange(1,1,1,AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    const hdr = ash.getRange(1,1,1,AUDIT_HEADERS.length);
    hdr.setBackground('#1E293B');
    hdr.setFontColor('#FFFFFF');
    hdr.setFontWeight('bold');
    hdr.setFontSize(11);
    [120,80,180,100,80,180,320,400,400].forEach((w,i)=>ash.setColumnWidth(i+1,w));
    ash.setFrozenRows(1);
    ash.setTabColor('#B85C6E');
  }
}

function readSheet(ss,key) {
  const sh=ss.getSheetByName(SHEETS[key]);
  const last=sh.getLastRow();
  if(last<2) return [];
  const nCols=JS_KEYS[key].length;
  const sCols=Math.min(nCols,sh.getLastColumn());
  const data=sh.getRange(1,1,last,sCols).getValues();
  const keys=JS_KEYS[key];
  return data.slice(1).filter(row=>row[0]!==''&&row[0]!==null&&row[0]!==undefined).map(row=>{
    const obj={};
    keys.forEach((k,i)=>{obj[k]=i<sCols?cellStr(row[i],k):'';});
    return obj;
  });
}
function writeSheet(ss,key,rows) {
  const sh=ss.getSheetByName(SHEETS[key]);
  const keys=JS_KEYS[key]; const headers=HEADERS_ES[key];
  sh.clearContents();
  const nCols=keys.length; const nRows=Math.max((rows||[]).length+1,2);
  sh.getRange(1,1,nRows,nCols).setNumberFormat('@');
  const data=[headers,...(rows||[]).map(r=>keys.map(k=>(r[k]!==null&&r[k]!==undefined)?String(r[k]):''))];
  sh.getRange(1,1,data.length,nCols).setValues(data);
}
function cellStr(v,key) {
  if(v instanceof Date){const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),d=String(v.getDate()).padStart(2,'0');return y+'-'+m+'-'+d;}
  if(typeof v==='number'&&v>=0&&v<1){const tot=Math.round(v*1440);return String(Math.floor(tot/60)).padStart(2,'0')+':'+String(tot%60).padStart(2,'0');}
  if(v===null||v===undefined) return '';
  return String(v);
}

function ok(data){return ContentService.createTextOutput(JSON.stringify({ok:true,data})).setMimeType(ContentService.MimeType.JSON);}
function err(msg){return ContentService.createTextOutput(JSON.stringify({ok:false,error:msg})).setMimeType(ContentService.MimeType.JSON);}
