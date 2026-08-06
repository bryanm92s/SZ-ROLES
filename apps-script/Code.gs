// ╔══════════════════════════════════════════════════════════════╗
// ║  Salome Zuluaga | SZ-ROLES                                   ║
// ║  + Roles (Administradora / Empleada)                         ║
// ║  + Reportes por usuario                                      ║
// ╚══════════════════════════════════════════════════════════════╝

const SECRET_TOKEN = 'CAMBIA_TU_TOKEN';

// Email de la Administradora — se detecta automáticamente como el dueño del script.
// Se usa como función para evitar errores al inicializar con ANYONE_ANONYMOUS.
function getAdminEmail() {
  try { return Session.getEffectiveUser().getEmail() || '' } catch(e) { return '' }
}

const SHEETS = {
  clients:      'Clientes',
  services:     'Servicios',
  appointments: 'Citas',
  expenses:     'Gastos',
  users:        'Usuarios',
  audit:        'Auditoría',
  priceHistory: 'HistorialPrecios',
};

const JS_KEYS = {
  clients:      ['id','name','phone','createdAt'],
  services:     ['id','name','price'],
  appointments: ['id','clientId','clientName','clientPhone',
                 'serviceIds','serviceNames','servicePrice','servicePrices',
                 'domicilio','domicilioPrice','totalPrice','address',
                 'date','time','createdAt','calendarCreated','calendarEventId','adminEventId','completed','assignedTo','createdBy'],
  expenses:     ['id','description','amount','category','date','createdBy'],
  priceHistory: ['serviceId','serviceName','price','changedAt'],
};

const HEADERS_ES = {
  clients:      ['ID','Nombre','Celular','Fecha Registro'],
  services:     ['ID','Nombre','Precio'],
  appointments: ['ID','ID Cliente','Nombre Cliente','Celular',
                 'IDs Servicios','Nombres Servicios','Precio Servicios','Precios x Servicio',
                 'Domicilio','Precio Domicilio','Total','Dirección',
                 'Fecha','Hora','Fecha Creación','Evento Creado','ID Evento Calendar','ID Evento Admin','Completada','Atendida Por','Creada Por'],
  expenses:     ['ID','Descripción','Monto','Categoría','Fecha','Creado Por'],
  priceHistory: ['ID Servicio','Nombre Servicio','Precio','Fecha Cambio'],
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

// Marca temporal ISO en hora LOCAL del script (America/Bogota, UTC-5)
// sin la 'Z'. Reemplaza a `new Date().toISOString()` (que emite UTC) para
// que los campos persistidos (Users.CreadoEn, Users.ResetExpiry) coincidan
// con el reloj colombiano que ven el frontend y los reportes de Excel.
// Mismo patrón que ya usa priceHistory.changedAt.
function localNowISO() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

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
      priceHistory: readSheet(ss,'priceHistory'),
    });
  } catch(ex) { return err('GET: '+ex.message); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.token !== SECRET_TOKEN) return err('No autorizado');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    initSheets(ss);

    // Sanitiza el payload: garantiza que los campos monetarios nunca
    // sean negativos (defensa en profundidad — el frontend ya acota con
    // Math.max(0,...), pero un cliente malicioso podría enviar rawData).
    // Si algo falla aquí no rompemos el flujo completo; el bloqueo de
    // los campos críticos es el efecto importante.
    try { sanitizePayload(b); } catch(_sanErr) {}

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
    if (b.services     !== undefined) {
      diffAndLog(ss,'services', b.services, user);
      if (b.resetPriceHistory) {
        const sh = ss.getSheetByName(SHEETS.priceHistory);
        if (sh) sh.clearContents();
        const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
        const phSh = ss.getSheetByName(SHEETS.priceHistory) || ss.insertSheet(SHEETS.priceHistory);
        phSh.getRange(1,1,1,4).setNumberFormat('@').setValues([HEADERS_ES.priceHistory]);
        if (b.services.length > 0) {
          const rows = b.services.map(s => [s.id, s.name, String(s.price), now]);
          phSh.getRange(2,1,rows.length,4).setNumberFormat('@').setValues(rows);
        }
      } else {
        trackPriceChanges(ss, b.services);
      }
      writeSheet(ss,'services', b.services);
    }
    if (b.appointments !== undefined) {
      const cl = findClientConflicts(b.appointments);
      if (cl) return err('Conflicto de cliente: el celular ' + cl.phone + ' tiene dos citas solapadas el ' + cl.date + ' (' + cl.first.time + ' y ' + cl.second.time + '). Un mismo cliente no puede tener dos citas que se crucen.');
      diffAndLog(ss,'appointments',b.appointments,user); writeSheet(ss,'appointments',b.appointments);
    }
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
   SANITIZACIÓN — prevención de valores negativos (backend)
   El frontend ya acota con Math.max(0,...) en cada input, pero el
   SECRET_TOKEN viaja en el bundle del frontend, así que cualquiera
   podría armar un payload raw con valores negativos. Acá aseguramos
   que los campos monetarios nunca se persistan < 0.
══════════════════════════════════════════════════════════════ */
function clip0(v) {
  var n = Number(v);
  return (n !== n || n < 0) ? 0 : n; // NaN o negativo → 0
}

function sanitizeNumField(obj, key) {
  if (!obj || obj[key] === undefined || obj[key] === null) return;
  obj[key] = clip0(obj[key]);
}

function sanitizePayload(b) {
  // services → price (puede venir como array de {id,name,price})
  if (Array.isArray(b.services)) {
    b.services.forEach(function(s){ sanitizeNumField(s, 'price'); });
  }
  // expenses → amount
  if (Array.isArray(b.expenses)) {
    b.expenses.forEach(function(e){ sanitizeNumField(e, 'amount'); });
  }
  // appointments → servicePrice / domicilioPrice / totalPrice
  if (Array.isArray(b.appointments)) {
    b.appointments.forEach(function(a){
      sanitizeNumField(a, 'servicePrice');
      sanitizeNumField(a, 'domicilioPrice');
      sanitizeNumField(a, 'totalPrice');
      // servicePrices es un JSON string {"id":precio}; re-clipear valores
      if (a.servicePrices && typeof a.servicePrices === 'string') {
        try {
          var parsed = JSON.parse(a.servicePrices);
          var changed = false;
          Object.keys(parsed).forEach(function(k){
            var v = Number(parsed[k]);
            if (v !== v || v < 0) { parsed[k] = 0; changed = true; }
          });
          if (changed) a.servicePrices = JSON.stringify(parsed);
        } catch(_) {}
      }
    });
  }
  // calendarEvent → totalPrice / domicilioPrice
  if (b.calendarEvent && typeof b.calendarEvent === 'object') {
    sanitizeNumField(b.calendarEvent, 'totalPrice');
    sanitizeNumField(b.calendarEvent, 'domicilioPrice');
  }
}

/* ══════════════════════════════════════════════════════════════
   CONFLICTO DE CLIENTE — defensa en profundidad (backend)
   El frontend ya bloquea con grilla + aviso, pero el SECRET_TOKEN
   viaja en el bundle, así que un payload raw podría colar dos citas
   del mismo cliente solapadas. Acá revisamos el arreglo final que
   se va a persistir y rechazamos si existe el cruce.
   Regla: mismo clientPhone + misma fecha + |t1−t2| < 60 min.
══════════════════════════════════════════════════════════════ */
function findClientConflicts(appts) {
  if (!Array.isArray(appts)) return null;
  var DUR = 60;
  function normPhone(p){ return String(p||'').replace(/\D/g,''); }
  function tMin(t){
    var m = String(t||'').trim().match(/^(\d{1,2}):(\d{2})/);
    return m ? (Number(m[1])*60 + Number(m[2])) : NaN;
  }
  function normDate(d){
    var s = String(d||'').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }
  for (var i=0;i<appts.length;i++){
    var p = normPhone(appts[i].clientPhone), d = normDate(appts[i].date), t = tMin(appts[i].time);
    if (!p || !d || isNaN(t)) continue;
    for (var j=i+1;j<appts.length;j++){
      var p2 = normPhone(appts[j].clientPhone), d2 = normDate(appts[j].date), t2 = tMin(appts[j].time);
      if (p !== p2 || d !== d2 || isNaN(t2)) continue;
      if (Math.abs(t - t2) < DUR) {
        return { phone:p, date:d, first:{time:appts[i].time}, second:{time:appts[j].time} };
      }
    }
  }
  return null;
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

  // Reset priceHistory — wipe and reseed with current service prices
  try {
    const svcs = readSheet(ss, 'services');
    const phSh = ss.getSheetByName(SHEETS.priceHistory) || ss.insertSheet(SHEETS.priceHistory);
    phSh.clearContents();
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    phSh.getRange(1,1,1,4).setNumberFormat('@').setValues([HEADERS_ES.priceHistory]);
    if (svcs.length > 0) {
      const rows = svcs.map(s => [s.id, s.name, String(s.price), now]);
      phSh.getRange(2,1,rows.length,4).setNumberFormat('@').setValues(rows);
    }
  } catch(e) { console.error('priceHistory reset error: ' + e.message); }

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
      sh.getRange(i+1, 5).setValue(localNowISO());
      if (!data[i][5]) sh.getRange(i+1, 6).setValue('Empleada');
      if (b.name) sh.getRange(i+1, 7).setValue(b.name);
      return ok({ email, role: data[i][5] || 'Empleada', name: b.name || '' });
    }
  }
  return err('Este correo no está autorizado. Contacta a la administradora.');
}

function handleUpdateRole(ss, b) {
  if (!b.targetEmail || !b.newRole) return err('Faltan datos');
  // ── Validación de permiso: solo una Administradora puede cambiar roles.
  // El frontend gating por `isAdmin` es cosmético; el backend DEBE
  // enforcear esto, porque el SECRET_TOKEN viaja en el bundle y
  // cualquier persona podría llamar al endpoint directamente.
  /////////////////////////////////////////////////////////////
  if (!b.userEmail) return err('No autorizado: falta identificar al solicitante');
  const requesterEmail = String(b.userEmail).trim().toLowerCase();
  const requester = findUser(ss, requesterEmail);
  if (!requester) return err('No autorizado: el solicitante no es un usuario registrado');
  if ((requester.role || 'Empleada') !== 'Administradora') {
    return err('No autorizado: solo la Administradora puede cambiar roles');
  }
  // Validación del rol destino
  const validRoles = ['Administradora','Empleada'];
  if (!validRoles.includes(b.newRole)) return err('Rol inválido');
  const email = String(b.targetEmail).trim().toLowerCase();
  const sh = ss.getSheetByName(SHEETS.users);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      // Anti-lockout: impedir que la última Administradora se quite el
      // rol a sí misma. Cuenta cuántas Administradoras quedarían.
      if (b.newRole !== 'Administradora' && String(data[i][0]).trim().toLowerCase() === requesterEmail) {
        const adminCount = data.slice(1).filter(r => (r[5] || '') === 'Administradora').length;
        if (adminCount <= 1) return err('No puedes quitarte el rol: eres la única Administradora');
      }
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
      // Expira a +1h desde ahora. Formato ISO LOCAL (sin 'Z') igual que el
      // resto de timestamps; la comparación `new Date() > new Date(storedExpiry)`
      // en handleResetPassword sigue siendo válida porque ambos extremos se
      // interpretan en la zona horaria local del script.
      const expiry = Utilities.formatDate(new Date(Date.now() + 60 * 60 * 1000), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
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
    '\n💳 Total: $' + clip0(Number(evt.totalPrice||0)).toLocaleString('es-CO') +
    (dom ? '\n🛵 Domicilio: $' + clip0(Number(evt.domicilioPrice||0)).toLocaleString('es-CO') +
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
    const defaultCal    = CalendarApp.getDefaultCalendar();
    const result = { ok: true };

    // Intentar obtener el calendario de la empleada
    const assignedCal = getCalendarForUser(assignedEmail);
    const usingFallback = assignedCal.getId() === defaultCal.getId();

    // Crear evento en el calendario de la empleada (o en el del admin si no tiene propio)
    const assignedEvent = assignedCal.createEvent(title, s, e, { description: desc, sendInvites: false });
    assignedEvent.setColor(CalendarApp.EventColor.MAUVE);
    result.eventId = assignedEvent.getId();

    // Solo crear copia admin si la empleada tiene su PROPIO calendario
    // (si usó fallback al calendar del admin, el evento ya está ahí → no duplicar)
    if (assignedEmail && assignedEmail !== adminEmail && !usingFallback) {
      try {
        const adminEvent = defaultCal.createEvent(title, s, e, { description: desc, sendInvites: false });
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
   RESPALDO AUTOMÁTICO DIARIO — Google Drive
   Se ejecuta todos los días a las 11:00 PM automáticamente.
   Guarda una copia de la Sheet en Drive → carpeta "Backups / [nombre]"
   Conserva los últimos 30 días y elimina los más antiguos.
══════════════════════════════════════════════════════════════ */

/**
 * Crea una copia de seguridad de la hoja activa en Google Drive.
 * Llamar manualmente la primera vez o dejar que el trigger lo haga.
 */
function createDailyBackup() {
  try {
    const ss         = SpreadsheetApp.getActiveSpreadsheet();
    const ssName     = ss.getName();
    const ssId       = ss.getId();
    const today      = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const backupName = ssName + ' — Backup ' + today;

    // Buscar o crear la carpeta PROYECTOS en Drive
    const proyectosIt = DriveApp.getFoldersByName('BACKUP-PROYECTO');
    const rootFolder  = proyectosIt.hasNext() ? proyectosIt.next() : DriveApp.createFolder('BACKUP-PROYECTO');

    // Buscar o crear la carpeta Backups dentro de BACKUP-PROYECTO
    const parentName = 'Backups';
    const parentIt   = rootFolder.getFoldersByName(parentName);
    const parentFolder = parentIt.hasNext() ? parentIt.next() : rootFolder.createFolder(parentName);

    // Buscar o crear la subcarpeta con el nombre del Spreadsheet
    const childIt = parentFolder.getFoldersByName(ssName);
    const backupFolder = childIt.hasNext() ? childIt.next() : parentFolder.createFolder(ssName);

    // Verificar si ya existe un backup de hoy (evitar duplicados)
    const existing = backupFolder.getFilesByName(backupName);
    if (existing.hasNext()) {
      console.log('Backup de hoy ya existe: ' + backupName);
      return;
    }

    // Copiar el archivo
    const original = DriveApp.getFileById(ssId);
    original.makeCopy(backupName, backupFolder);
    console.log('✅ Backup creado: ' + backupName);

    // Limpiar backups con más de 30 días
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const files = backupFolder.getFiles();
    let deleted = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated() < cutoff) {
        file.setTrashed(true);
        deleted++;
      }
    }
    if (deleted > 0) console.log('🗑️ Backups eliminados (>30 días): ' + deleted);

  } catch(ex) {
    console.error('❌ Error en backup: ' + ex.message);
  }
}

/**
 * Instala el trigger automático diario a las 11:00 PM.
 * Ejecutar UNA SOLA VEZ manualmente desde el editor de Apps Script.
 * Menú: Ejecutar → setupDailyBackupTrigger
 */
function setupDailyBackupTrigger() {
  // Eliminar triggers anteriores del mismo nombre para evitar duplicados
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'createDailyBackup') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Crear trigger diario a las 11:00 PM
  ScriptApp.newTrigger('createDailyBackup')
    .timeBased()
    .everyDays(1)
    .atHour(23)           // 11 PM hora del script
    .nearMinute(0)
    .create();

  console.log('✅ Trigger configurado: backup diario a las 11:00 PM en carpeta "Backups / ' +
    SpreadsheetApp.getActiveSpreadsheet().getName() + '"');
}

/**
 * Desactiva el trigger de backup (si ya no se necesita).
 */
function removeDailyBackupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'createDailyBackup') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  console.log(removed > 0 ? '✅ Trigger eliminado' : 'No se encontró el trigger');
}

/* ══════════════════════════════════════════════════════════════
   ENVÍO SEMANAL DEL ÚLTIMO BACKUP — Sábados 9:00 AM
   Busca el backup más reciente en Drive y lo envía por correo.
══════════════════════════════════════════════════════════════ */

/**
 * Envía por correo el último backup de esta Sheet.
 * Se ejecuta automáticamente los sábados a las 9:00 AM.
 */
function sendWeeklyBackupEmail() {
  try {
    const ss         = SpreadsheetApp.getActiveSpreadsheet();
    const ssName     = ss.getName();
    const recipient  = 'bryanmorales8240@gmail.com';

    // ── Localizar la carpeta de backups ──────────────────────
    const proyectosIt = DriveApp.getFoldersByName('BACKUP-PROYECTO');
    if (!proyectosIt.hasNext()) throw new Error('Carpeta BACKUP-PROYECTO no encontrada.');
    const rootFolder = proyectosIt.next();

    const parentIt = rootFolder.getFoldersByName('Backups');
    if (!parentIt.hasNext()) throw new Error('Carpeta Backups no encontrada.');
    const parentFolder = parentIt.next();

    const childIt = parentFolder.getFoldersByName(ssName);
    if (!childIt.hasNext()) throw new Error('Carpeta de backups de "' + ssName + '" no encontrada.');
    const backupFolder = childIt.next();

    // ── Encontrar el backup más reciente ─────────────────────
    const files = backupFolder.getFiles();
    let latestFile = null;
    let latestDate = new Date(0);

    while (files.hasNext()) {
      const file = files.next();
      const created = file.getDateCreated();
      if (created > latestDate) {
        latestDate = created;
        latestFile = file;
      }
    }

    if (!latestFile) throw new Error('No se encontraron backups en la carpeta.');

    // ── Exportar como Excel real (.xlsx) ─────────────────────
    const exportUrl = 'https://docs.google.com/spreadsheets/d/' +
                      latestFile.getId() +
                      '/export?format=xlsx';

    const token    = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + token }
    });
    const blob = response.getBlob().setName(latestFile.getName() + '.xlsx');

    // ── Preparar y enviar el correo con el archivo adjunto ───
    const dateStr = Utilities.formatDate(latestDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const subject = '[BACKUP] ' + ssName + ' | ' + dateStr;
    const body =
      'Hola,<br><br>' +
      'Se adjunta el último backup disponible de la base de datos <b>' + ssName + '</b>.<br><br>' +
      '&#128196; Archivo: ' + latestFile.getName() + '<br>' +
      '&#128197; Fecha del backup: ' + dateStr + '<br><br>' +
      'Este correo se genera automáticamente cada sábado a las 9:00 AM.<br><br>' +
      '&#8212; Sistema de respaldo automático';

    GmailApp.sendEmail(recipient, subject, '', {
      htmlBody: body,
      attachments: [blob]
    });
    console.log('✅ Backup enviado a ' + recipient + ': ' + latestFile.getName());

  } catch(ex) {
    console.error('❌ Error al enviar backup: ' + ex.message);
  }
}

/**
 * Instala el trigger semanal los sábados a las 9:00 AM.
 * Ejecutar UNA SOLA VEZ manualmente desde el editor de Apps Script.
 */
function setupWeeklyEmailTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendWeeklyBackupEmail') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sendWeeklyBackupEmail')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SATURDAY)
    .atHour(9)
    .nearMinute(0)
    .create();

  console.log('✅ Trigger configurado: envío semanal los sábados a las 9:00 AM');
}

/**
 * Desactiva el trigger de envío semanal (si ya no se necesita).
 */
function removeWeeklyEmailTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendWeeklyBackupEmail') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  console.log(removed > 0 ? '✅ Trigger de email eliminado' : 'No se encontró el trigger');
}

/* ══════════════════════════════════════════════════════════════
   REPORTE DIARIO POR CORREO (12:00 p.m. hora Colombia)
   Envía a la administradora el MISMO mensaje que se arma con el
   botón "💬 WhatsApp admin" de la pestaña Reportes (modo Mes),
   completo con emojis. Solo aplica al mes en curso.
   - Ejecutar setupDailyReportTrigger() UNA sola vez desde Apps Script
     para instalar el trigger diario a las 12 del mediodía.
   - Ejecutar removeDailyReportTrigger() para desactivarlo cuando se quiera.
══════════════════════════════════════════════════════════════ */
function _dailyReportFmtMonto(n) {
  n = Number(n) || 0;
  return '$' + n.toLocaleString('es-CO');
}

function _dailyReportMonthLabel(ym) {
  var NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var parts = String(ym).split('-');
  return NAMES[Number(parts[1]) - 1] + ' ' + parts[0];
}

function sendDailyReportEmail() {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var tz   = Session.getScriptTimeZone();
    var now  = new Date();
    var ym   = Utilities.formatDate(now, tz, 'yyyy-MM');
    var recipient = getAdminEmail() || 'bryanmorales8240@gmail.com';

    initSheets(ss);
    var appts   = readSheet(ss, 'appointments');
    var exps    = readSheet(ss, 'expenses');
    var users   = readPublicUsers(ss);

    // ── Helpers locales (réplica del ReportsTab.jsx) ─────────
    var toN = function(v){ var n = Number(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n; };
    var boolV = function(v){ return v === true || v === 'true'; };
    var cleanDate = function(raw){
      if(!raw) return '';
      var s = String(raw).trim();
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      try {
        var d = new Date(s);
        if(isNaN(d.getTime())) return '';
        var y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
        return y+'-'+m+'-'+dd;
      } catch(_) { return ''; }
    };
    var inPeriod = function(d){
      var x = cleanDate(d);
      if(!x) return false;
      return x.slice(0,7) === ym;
    };

    // ── Aggregate per-user (mismo criterio que el frontend) ──
    var userList = (users || []).map(function(u){
      var email = String(u.email||'').trim().toLowerCase();

      var citasCreadasArr = (appts || []).filter(function(a){
        return String(a.createdBy||'').trim().toLowerCase() === email && inPeriod(a.date);
      });
      var citasAtendidasArr = (appts || []).filter(function(a){
        return String(a.assignedTo||'').trim().toLowerCase() === email
          && inPeriod(a.date) && (a.completed === true || a.completed === 'true');
      });
      var domAtendidasArr = citasAtendidasArr.filter(function(a){ return boolV(a.domicilio); });
      var ingresos = citasAtendidasArr
        .filter(function(a){ return a.completed === true || a.completed === 'true'; })
        .reduce(function(s,a){ return s + toN(a.totalPrice || a.servicePrice || 0); }, 0);
      var gastosDelPeriodo = (exps || []).filter(function(e){
        return String(e.createdBy||'').trim().toLowerCase() === email && inPeriod(e.date);
      });
      var montoGastos = gastosDelPeriodo.reduce(function(s,e){ return s + toN(e.amount||0); }, 0);

      return {
        email: u.email,
        name: u.name || '',
        citasCreadas: citasCreadasArr.length,
        citasAtendidas: citasAtendidasArr.length,
        ingresos: ingresos,
        domAtendidas: domAtendidasArr.length,
        domAtendidasMonto: domAtendidasArr.reduce(function(s,a){ return s + toN(a.domicilioPrice||0); }, 0),
        gastos: gastosDelPeriodo.length,
        montoGastos: montoGastos
      };
    });

    // Solo activos en el período (igual que el frontend)
    userList = userList.filter(function(u){
      return u.citasCreadas > 0 || u.citasAtendidas > 0 || u.gastos > 0 || u.ingresos > 0;
    });

    // ── Totales ─────────────────────────────────────────────
    var totCreadas  = userList.reduce(function(s,u){ return s + u.citasCreadas;  }, 0);
    var totAtendidas= userList.reduce(function(s,u){ return s + u.citasAtendidas;}, 0);
    var totMonto    = userList.reduce(function(s,u){ return s + u.montoGastos;  }, 0);
    var totIngresos = userList.reduce(function(s,u){ return s + u.ingresos;     }, 0);
    var totDom      = userList.reduce(function(s,u){ return s + u.domAtendidas; }, 0);
    var totDomMonto = userList.reduce(function(s,u){ return s + u.domAtendidasMonto; }, 0);

    // ── Construir mensaje (réplica de sendWA de ReportsTab.jsx) ──
    var SPARK  = '\u2728';       // ✨
    var CAL    = '\uD83D\uDCC5'; // 📅
    var CHART  = '\uD83D\uDCCA'; // 📊
    var PEOPLE = '\uD83D\uDC65'; // 👥
    var MOTO   = '\uD83D\uDEF5'; // 🛵

    var lines = [];
    lines.push(SPARK + ' *Reporte de actividad del equipo*');
    lines.push(CAL + ' ' + _dailyReportMonthLabel(ym));
    lines.push('');
    lines.push(CHART + ' *Totales*');
    lines.push('• Citas creadas: *' + totCreadas + '*');
    lines.push('• Citas atendidas: *' + totAtendidas + '*');
    lines.push('• Ingresos: *' + _dailyReportFmtMonto(totIngresos) + '*');
    lines.push('• Gastos: *' + _dailyReportFmtMonto(totMonto) + '*');
    lines.push('• Neto: *' + _dailyReportFmtMonto(totIngresos - totMonto) + '*');
    lines.push('• Domicilios: *' + totDom + '* (' + _dailyReportFmtMonto(totDomMonto) + ')');

    if (userList.length > 0) {
      lines.push('', PEOPLE + ' *Por persona*');
      var sorted = userList.slice().sort(function(a,b){
        return (b.citasAtendidas + b.ingresos) - (a.citasAtendidas + a.ingresos);
      }).slice(0, 8);
      sorted.forEach(function(u){
        var quien = u.name || u.email.split('@')[0];
        var domTxt = u.domAtendidas > 0
          ? ' · ' + MOTO + ' ' + u.domAtendidas + ' domicilios (' + _dailyReportFmtMonto(u.domAtendidasMonto) + ')'
          : '';
        lines.push('• ' + quien + ': ' + u.citasCreadas + ' creadas · ' + u.citasAtendidas +
                   ' atendidas · ' + _dailyReportFmtMonto(u.ingresos) + ' · gastos ' +
                   _dailyReportFmtMonto(u.montoGastos) + domTxt);
      });
      if (userList.length > 8) lines.push('   …y ' + (userList.length - 8) + ' más');
    }
    lines.push('', '_Generado ' + Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss") + '_');

    var msg    = lines.join('\n');
    var stamp  = Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm");
    var subject = '[REPORTE DIARIO] Actividad del equipo — ' + _dailyReportMonthLabel(ym) + ' (' + stamp + ')';

    // Escape HTML de msg (en orden: & primero para no doble-escapar).
    // Se construyen las entidades con concatenacion de strings para evitar
    // que el editor normalice visualmente &/</> a sus caracteres.
    var AMP = '&' + 'amp;',
        LT  = '&' + 'lt;',
        GT  = '&' + 'gt;';
    var html = '<div style="font-family:monospace;white-space:pre-wrap;line-height:1.5">'
             + msg.replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/\n/g,'<br>')
             + '</div>'
             + '<br><br><small style="color:#888">Reporte automático diario — 12:00 p.m. (hora Colombia). '
             + 'Puedes activarlo/desactivarlo desde Apps Script con '
             + '<code>setupDailyReportTrigger()</code> / <code>removeDailyReportTrigger()</code>.</small>';

    GmailApp.sendEmail(recipient, subject, msg, { htmlBody: html });
    console.log('✅ Reporte diario enviado a ' + recipient);
  } catch(ex) {
    console.error('❌ Error al enviar reporte diario: ' + ex.message);
  }
}

/**
 * Instala el trigger diario a las 12:00 p.m. (hora del script = Colombia).
 * Ejecutar UNA sola vez manualmente desde el editor de Apps Script.
 * Idempotente: si ya existe, lo elimina y lo vuelve a crear (no duplica).
 */
function setupDailyReportTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t){
    if (t.getHandlerFunction() === 'sendDailyReportEmail') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sendDailyReportEmail')
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .nearMinute(0)
    .create();

  console.log('✅ Trigger de reporte diario instalado: se ejecutará cada día a las 12:00 p.m.');
}

/**
 * Desactiva el trigger del reporte diario.
 * Ejecutar manualmente cuando se quiera detener.
 */
function removeDailyReportTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  triggers.forEach(function(t){
    if (t.getHandlerFunction() === 'sendDailyReportEmail') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  console.log(removed > 0
    ? '✅ Trigger de reporte diario eliminado'
    : 'No se encontró el trigger del reporte diario');
}

/* ══════════════════════════════════════════════════════════════
   SHEETS INIT / READ / WRITE
══════════════════════════════════════════════════════════════ */
function trackPriceChanges(ss, newServices) {
  try {
    const current = readSheet(ss, 'services');
    const currentMap = {};
    current.forEach(s => { currentMap[s.id] = s; });

    const existingHistory = readSheet(ss, 'priceHistory');
    const historyIds = new Set(existingHistory.map(h => h.serviceId));

    const now    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    const before = Utilities.formatDate(new Date(new Date().getTime()-1000), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    const changes = [];

    newServices.forEach(s => {
      const prev = currentMap[s.id];
      if (!prev) {
        changes.push({ serviceId:s.id, serviceName:s.name, price:String(s.price), changedAt:now });
      } else if (String(prev.price) !== String(s.price)) {
        if (!historyIds.has(s.id)) {
          changes.push({ serviceId:s.id, serviceName:s.name, price:String(prev.price), changedAt:before });
        }
        changes.push({ serviceId:s.id, serviceName:s.name, price:String(s.price), changedAt:now });
      }
    });

    if (changes.length === 0) return;

    const phSh = ss.getSheetByName(SHEETS.priceHistory) || ss.insertSheet(SHEETS.priceHistory);
    const keys = JS_KEYS.priceHistory;
    if (phSh.getLastRow() === 0) {
      phSh.getRange(1,1,1,HEADERS_ES.priceHistory.length).setNumberFormat('@').setValues([HEADERS_ES.priceHistory]);
    }
    const rows = changes.map(c => keys.map(k => c[k] || ''));
    phSh.getRange(phSh.getLastRow()+1, 1, rows.length, keys.length).setNumberFormat('@').setValues(rows);
  } catch(ex) {
    console.error('trackPriceChanges error: ' + ex.message);
  }
}

function initSheets(ss) {
  ['clients','services','appointments','expenses','priceHistory'].forEach(key => {
    if (!ss.getSheetByName(SHEETS[key])) {
      const newSh = ss.insertSheet(SHEETS[key]);
      // Poner los headers si la hoja tiene definidos
      const headers = HEADERS_ES[key];
      if (headers) {
        newSh.getRange(1,1,1,headers.length).setNumberFormat('@').setValues([headers]);
        const hdr = newSh.getRange(1,1,1,headers.length);
        hdr.setBackground('#FCE4EC'); hdr.setFontWeight('bold');
      }
    }
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
  if(!sh) return [];  // null guard: hoja inexistente → vacío, no error
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
