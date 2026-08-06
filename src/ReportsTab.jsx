import { useState } from 'react'

const localDateStr = (d=new Date()) => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${dd}`
}

const P  = '#B85C6E'
const PL = '#FDF6F0'
const PB = '#F5D0D8'

const fmt = n => Number(n||0).toLocaleString('es-CO')
const monthLabel = m => {
  const [y, mo] = m.split('-')
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${names[parseInt(mo)-1]} ${y}`
}
/* ── Colores por usuario ── */
const USER_COLORS = ['#B85C6E','#6366F1','#0891B2','#059669','#D97706','#7C3AED']
const userColor = email => USER_COLORS[
  [...email].reduce((a,c)=>a+c.charCodeAt(0),0) % USER_COLORS.length
]
const userInitial = user => {
  const display = (typeof user === 'object' ? user.name : null) || (typeof user === 'string' ? user : '')
  return (display||'?')[0].toUpperCase()
}

/* ── Helpers de fechas / números (espejo de App.jsx) ── */
const cleanDate = raw => {
  if (!raw) return ''
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  try { const d=new Date(s); if(isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  catch { return '' }
}
const cleanTime = raw => {
  if (!raw) return ''
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/)
  return m ? `${String(Number(m[1])).padStart(2,'0')}:${m[2]}` : ''
}
const fmtDate = raw => {
  const s = cleanDate(raw); if (!s) return '—'
  try { return new Date(s+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) }
  catch { return s }
}
const toN  = v => { const n=Number(String(v).replace(/[^0-9.-]/g,'')); return isNaN(n)?0:n }
const fmtM = n => `$${toN(n).toLocaleString('es-CO')}`
const bool = v => v===true || v==='true'

// Convierte el `createdAt` de una cita a 'YYYY-MM-DD HH:MM:SS' en hora
// local Colombia (America/Bogota, UTC-5).
//   - Citas antiguas: vienen como ISO UTC con 'Z' (ej: 2026-08-06T14:03:09.123Z)
//     → se parsean con Date() y se emiten en zona horaria Bogotá.
//   - Citas nuevas: ya vienen como ISO local sin 'Z' (YYYY-MM-DDTHH:mm:ss)
//     → se toman literalmente para evitar un doble desfase.
const localTS = raw => {
  if (!raw) return ''
  const s = String(raw).trim()
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s)
    if (isNaN(d.getTime())) return ''
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/Bogota', year:'numeric', month:'2-digit',
      day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    }).formatToParts(d)
    const g = t => p.find(x => x.type === t)?.value || ''
    return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`
  }
  return s.slice(0,19).replace('T',' ')
}

const ADMIN_WA = '3223992340'   // WhatsApp de la administradora (sin +57)

/* ── Stat card ── */
function StatCard({ label, value, sub, color='#B85C6E' }) {
  return (
    <div style={{background:'var(--card)',borderRadius:14,padding:'16px 18px',boxShadow:'0 2px 12px rgba(180,92,110,.08)',flex:1,minWidth:130}}>
      <div style={{fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:26,fontWeight:800,color,letterSpacing:'-1px'}}>{value}</div>
      {sub && <div style={{fontSize:12,color:'var(--t2)',marginTop:3}}>{sub}</div>}
    </div>
  )
}

/* ── Tarjeta de usuario ── */
function UserCard({ user, color, isCurrentUser, onGoCitas, onGoGastos, netLabelWord }) {
  const neto = (user.ingresos||0) - (user.montoGastos||0)
  const netoPos = neto >= 0
  const domCount = user.domAtendidas||0
  const domMonto = user.domAtendidasMonto||0
  return (
    <div style={{
      background:'var(--card)', borderRadius:16, padding:'20px',
      boxShadow:'0 2px 16px rgba(0,0,0,.06)',
      border: isCurrentUser ? `2px solid ${color}` : '2px solid transparent',
    }}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
        <div style={{
          width:42,height:42,borderRadius:'50%',background:color,
          color:'white',display:'flex',alignItems:'center',justifyContent:'center',
          fontWeight:800,fontSize:18,flexShrink:0,
        }}>{userInitial(user)}</div>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:'var(--t)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {user.name || user.email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
          </div>
          <div style={{fontSize:11,color:'var(--t2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
        </div>
        {isCurrentUser && <span style={{marginLeft:'auto',background:PL,color:P,fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,flexShrink:0}}>Tú</span>}
      </div>

      {/* Citas y Gastos — clickeables */}
      {/* Citas creadas / atendidas */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        <div onClick={onGoCitas}
          style={{background:PL,borderRadius:10,padding:'10px',textAlign:'center',cursor:onGoCitas?'pointer':'default',transition:'opacity .15s'}}
          onMouseEnter={e=>{if(onGoCitas)e.currentTarget.style.opacity='.75'}}
          onMouseLeave={e=>{e.currentTarget.style.opacity='1'}}>
          <div style={{fontSize:24,fontWeight:800,color:P}}>{user.citasCreadas}</div>
          <div style={{fontSize:10,color:'var(--t2)',fontWeight:600}}>✏️ Creadas {onGoCitas&&<span style={{color:P}}>→</span>}</div>
        </div>
        <div style={{background:'#EDF7F0',borderRadius:10,padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:24,fontWeight:800,color:'var(--green)'}}>{user.citasAtendidas}</div>
          <div style={{fontSize:10,color:'var(--t2)',fontWeight:600}}>👩‍💼 Atendidas</div>
        </div>
      </div>
      {/* Gastos */}
      {/* Gastos e Ingresos */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
        <div onClick={onGoGastos}
          style={{background:'var(--primary-l)',borderRadius:10,padding:'10px',textAlign:'center',cursor:onGoGastos?'pointer':'default',transition:'opacity .15s'}}
          onMouseEnter={e=>{if(onGoGastos)e.currentTarget.style.opacity='.75'}}
          onMouseLeave={e=>{e.currentTarget.style.opacity='1'}}>
          <div style={{fontSize:24,fontWeight:800,color:'var(--gold)'}}>{user.gastos}</div>
          <div style={{fontSize:11,fontWeight:800,color:'var(--gold)'}}>${fmt(user.montoGastos||0)}</div>
          <div style={{fontSize:10,color:'var(--t2)',fontWeight:600,marginTop:2}}>🧾 Gastos {onGoGastos&&<span style={{color:'var(--gold)'}}>→</span>}</div>
        </div>
        <div style={{background:'var(--primary-l)',borderRadius:10,padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:800,color:'var(--green)'}}>${fmt(user.ingresos||0)}</div>
          <div style={{fontSize:10,color:'var(--green)',fontWeight:600,marginTop:2}}>💰 Ingresos</div>
          <div style={{fontSize:9,color:'var(--t2)',marginTop:1}}>citas completadas</div>
        </div>
      </div>

      {/* Domicilios (solo si la persona atendió algún domicilio en el período) */}
      {domCount > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div style={{background:'#F1EAF9',borderRadius:10,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:800,color:'#7C5C9E'}}>{domCount}</div>
            <div style={{fontSize:10,color:'var(--t2)',fontWeight:600}}>🛵 Domicilios</div>
          </div>
          <div style={{background:'#F1EAF9',borderRadius:10,padding:'10px',textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:800,color:'#7C5C9E'}}>${fmt(domMonto)}</div>
            <div style={{fontSize:10,color:'#7C5C9E',fontWeight:600,marginTop:2}}>💲 Total domicilios</div>
          </div>
        </div>
      )}

      {/* Neto */}
      {(user.ingresos > 0 || user.montoGastos > 0) && (
        <div style={{
          borderRadius:10, padding:'9px 14px',
          background: netoPos ? '#EDF7F0' : '#FFF0F0',
          border: `1px solid ${netoPos ? '#B8DEC8' : '#FFCCCC'}`,
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <span style={{fontSize:11,fontWeight:700,color:netoPos?'#4A8C6E':'#B03030'}}>
            {netoPos ? `📈 Neto del ${netLabelWord}` : `📉 Neto del ${netLabelWord}`}
          </span>
          <span style={{fontSize:14,fontWeight:800,color:netoPos?'#2E7D52':'#B03030'}}>
            {netoPos?'+':'-'}${fmt(Math.abs(neto))}
          </span>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   REPORTS TAB
══════════════════════════════════════════════════════════════ */
export default function ReportsTab({ userEmail, userRole, sync, expenses, clients, appts, SE, setTab, users: allUsers }) {
  // Modo de período: 'month' (mes del dropdown) | 'day' (un día puntual) | 'range' (rango desde–hasta)
  const [periodMode, setPeriodMode] = useState('month')
  const today = localDateStr()
  const [month, setMonth] = useState(today.slice(0,7))
  const [day,  setDay]    = useState(today)
  const [from, setFrom]  = useState(today)
  const [to,   setTo]    = useState(today)

  const safeExpenses = Array.isArray(expenses) ? expenses : []
  const safeAppts    = Array.isArray(appts)    ? appts    : []
  const safeUsers    = Array.isArray(allUsers) ? allUsers : []

  // Predicado de pertenencia al período activo — se aplica a la fecha de la cita/gasto
  const inPeriod = d => {
    const x = cleanDate(d)
    if (!x) return false
    if (periodMode === 'month') return x.slice(0,7) === month
    if (periodMode === 'day')   return x === day
    // range
    return x >= from && x <= to
  }

  // Etiqueta legible del período activo
  const periodLabel = () =>
    periodMode === 'month' ? monthLabel(month)
    : periodMode === 'day' ? fmtDate(day)
    : (from === to ? fmtDate(from) : `${fmtDate(from)} — ${fmtDate(to)}`)

  // Palabra corta para 'Neto del {día|mes|rango}' — se pasa a cada UserCard
  const netLabelWord = periodMode === 'month' ? 'mes'
                     : periodMode === 'day'   ? 'día'
                     : 'rango'

  // Build month list from actual data (includes past AND future months with activity)
  const months = [...new Set([
    today.slice(0,7),                                       // always include current month
    ...safeExpenses.map(e=>String(e.date||'').slice(0,7)),
    ...safeAppts.map(a=>String(a.date||'').slice(0,7)),
  ].filter(m=>/^\d{4}-\d{2}$/.test(m)))].sort((a,b)=>b.localeCompare(a))

  // Calcular todo desde datos en vivo — no desde auditoría
  // Así aparecen todos los usuarios aunque no hayan creado nada ese período
  const users = safeUsers.map(u => {
    const email = String(u.email||'').trim().toLowerCase()

    // Citas creadas: donde esta persona la guardó en el sistema
    const citasCreadasArr = safeAppts.filter(a =>
      String(a.createdBy||'').trim().toLowerCase() === email && inPeriod(a.date)
    )
    const citasCreadas = citasCreadasArr.length

    // Citas atendidas: completadas que atendió esta persona (mismo filtro que ingresos)
    const citasAtendidasArr = safeAppts.filter(a =>
      String(a.assignedTo||'').trim().toLowerCase() === email
      && inPeriod(a.date)
      && (a.completed === true || a.completed === 'true')
    )

    // Domicilios: citas con flag `domicilio` verdadero que atendió esta
    // persona y caen en el período. Se cuenta por ATTENDED (igual que los
    // ingresos) para reflejar el trabajo de cada empleada/administradora.
    const domAtendidasArr   = citasAtendidasArr.filter(a => bool(a.domicilio))
    const domAtendidas      = domAtendidasArr.length
    const domAtendidasMonto = domAtendidasArr.reduce((s,a) => s + toN(a.domicilioPrice||0), 0)

    // Ingresos: citas completadas que atendió esta persona
    const ingresos = citasAtendidasArr
      .filter(a => a.completed === true || a.completed === 'true')
      .reduce((s,a) => s + toN(a.totalPrice||a.servicePrice||0), 0)

    // Gastos: los que creó esta persona y caen en el período
    const gastosDelPeriodo = safeExpenses.filter(e =>
      String(e.createdBy||'').trim().toLowerCase() === email && inPeriod(e.date)
    )
    const gastos      = gastosDelPeriodo.length
    const montoGastos = gastosDelPeriodo.reduce((s,e) => s + toN(e.amount||0), 0)

    return {
      email: u.email, name: u.name||'',
      citasCreadas, citasAtendidas: citasAtendidasArr.length,
      citasCreadasArr, citasAtendidasArr, ingresos,
      domAtendidas, domAtendidasMonto, domAtendidasArr,
      gastos, montoGastos, gastosDelPeriodo,
    }
  }).filter(u => u.citasCreadas > 0 || u.citasAtendidas > 0 || u.gastos > 0 || u.ingresos > 0)

  const totCreadas   = users.reduce((s,u)=>s+u.citasCreadas,0)
  const totAtendidas = users.reduce((s,u)=>s+u.citasAtendidas,0)
  const totGastos    = users.reduce((s,u)=>s+u.gastos,0)
  const totMonto     = users.reduce((s,u)=>s+u.montoGastos,0)
  const totIngresos  = users.reduce((s,u)=>s+u.ingresos,0)
  const totDom       = users.reduce((s,u)=>s+u.domAtendidas,0)
  const totDomMonto  = users.reduce((s,u)=>s+u.domAtendidasMonto,0)

  // ═══ Exportar a Excel (.xlsx) — 3 hojas: Resumen / Citas / Gastos ═══
  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen — totales del equipo + desglose por usuario
    const resumen = [
      ['REPORTE DE ACTIVIDAD DEL EQUIPO'],
      ['Período', periodLabel()],
      ['Generado', new Date().toLocaleString('es-CO')],
      [''],
      ['──── TOTALES ────'],
      ['Citas creadas',    totCreadas],
      ['Citas atendidas',  totAtendidas],
      ['Total en gastos',  totMonto],
      ['Total ingresos',   totIngresos],
      ['Total domicilios #',  totDom],
      ['Total domicilios $',  totDomMonto],
      ['Neto',             totIngresos - totMonto],
      [''],
      ['──── DESGLOSE POR USUARIO ────'],
      ['Usuario','Correo','Citas creadas','Citas atendidas','Ingresos','Gastos #','Gastos $','Domicilios #','Domicilios $','Neto'],
      ...users.slice().sort((a,b)=>(b.citasAtendidas+b.ingresos)-(a.citasAtendidas+a.ingresos)).map(u => [
        u.name || u.email.split('@')[0],
        u.email,
        u.citasCreadas,
        u.citasAtendidas,
        u.ingresos,
        u.gastos,
        u.montoGastos,
        u.domAtendidas,
        u.domAtendidasMonto,
        u.ingresos - u.montoGastos,
      ]),
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(resumen)
    ws1['!cols'] = [{wch:24},{wch:28},{wch:14},{wch:16},{wch:14},{wch:10},{wch:14},{wch:14},{wch:14},{wch:14}]
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

    // Hoja 2: Citas — union de citas creadas y atendidas (sin duplicar)
    const detailSet = new Map()
    users.forEach(u => {
      u.citasCreadasArr.forEach(a => detailSet.set(a.id, a))
      u.citasAtendidasArr.forEach(a => detailSet.set(a.id, a))
    })
    const citasRows = [['Fecha','Hora','Cliente','Teléfono','Servicios','Total','Estado','Atendida por','Creada por','Creada el']]
    Array.from(detailSet.values()).slice().sort((a,b)=>cleanDate(a.date).localeCompare(cleanDate(b.date))).forEach(a => {
      const status = a.completed==='noshow' ? 'No asistió'
                   : (a.completed === true || a.completed === 'true') ? 'Completada'
                   : 'Pendiente'
      citasRows.push([
        cleanDate(a.date), cleanTime(a.time),
        a.clientName||'', a.clientPhone||'',
        a.serviceNames||'', toN(a.totalPrice||a.servicePrice||0),
        status,
        a.assignedTo||'', a.createdBy||'',
        localTS(a.createdAt),
      ])
    })
    const ws2 = XLSX.utils.aoa_to_sheet(citasRows)
    ws2['!cols'] = [{wch:10},{wch:6},{wch:20},{wch:14},{wch:30},{wch:10},{wch:12},{wch:22},{wch:22},{wch:20}]
    XLSX.utils.book_append_sheet(wb, ws2, 'Citas')

    // Hoja 3: Gastos del período
    const gastosRows = [['Fecha','Descripción','Categoría','Monto','Creado por']]
    users.forEach(u => u.gastosDelPeriodo.forEach(e => {
      gastosRows.push([
        cleanDate(e.date), e.description||'', e.category||'',
        toN(e.amount||0), e.createdBy||'',
      ])
    }))
    if (totMonto > 0) gastosRows.push(['','','TOTAL', totMonto,''])
    const ws3 = XLSX.utils.aoa_to_sheet(gastosRows)
    ws3['!cols'] = [{wch:10},{wch:30},{wch:18},{wch:12},{wch:22}]
    XLSX.utils.book_append_sheet(wb, ws3, 'Gastos')

    const stamp = periodMode==='month' ? month
                : periodMode==='day'   ? day
                : `${from}_${to}`
    XLSX.writeFile(wb, `reporte_equipo_${stamp}.xlsx`)
  }

  // ═══ Enviar resumen por WhatsApp a la administradora ═══
  const sendWA = () => {
    const p = ('57' + ADMIN_WA.replace(/\D/g, '')).replace(/^5757/, '57')
    const SPARK = '\u2728'        // ✨
    const MONEY = '\uD83D\uDCB0'  // 💰
    const CAL   = '\uD83D\uDCC5'  // 📅
    const CHART = '\uD83D\uDCCA'  // 📊
    const PEOPLE= '\uD83D\uDC65'  // 👥
    const lines = [
      `${SPARK} *Reporte de actividad del equipo*`,
      `${CAL} ${periodLabel()}`,
      '',
      `${CHART} *Totales*`,
      `• Citas creadas: *${totCreadas}*`,
      `• Citas atendidas: *${totAtendidas}*`,
      `• Ingresos: *${fmtM(totIngresos)}*`,
      `• Gastos: *${fmtM(totMonto)}*`,
      `• Neto: *${fmtM(totIngresos - totMonto)}*`,
      `• Domicilios: *${totDom}* (${fmtM(totDomMonto)})`,
    ]
    if (users.length > 0) {
      lines.push('', `${PEOPLE} *Por persona*`)
      users.slice().sort((a,b)=>(b.citasAtendidas+b.ingresos)-(a.citasAtendidas+a.ingresos)).slice(0,8).forEach(u => {
        const quien = u.name || u.email.split('@')[0]
        const domTxt = u.domAtendidas > 0 ? ` · 🛵 ${u.domAtendidas} domicilios (${fmtM(u.domAtendidasMonto)})` : ''
        lines.push(`• ${quien}: ${u.citasCreadas} creadas · ${u.citasAtendidas} atendidas · ${fmtM(u.ingresos)} · gastos ${fmtM(u.montoGastos)}${domTxt}`)
      })
      if (users.length > 8) lines.push(`   …y ${users.length - 8} más`)
    }
    lines.push('', `_Generado ${new Date().toLocaleString('es-CO')}_`)
    const msg = lines.join('\n')
    const url = 'https://api.whatsapp.com/send/?phone=' + p + '&text=' + encodeURIComponent(msg) + '&type=phone_number&app_absent=0'
    window.open(url, '_blank')
  }

  const hasData = totCreadas > 0 || totAtendidas > 0 || totGastos > 0 || totIngresos > 0

  return (
    <div style={{padding:'0 0 80px'}}>

      {/* ── REPORTES ── */}
      <div style={{padding:'0 16px'}}>
          {/* Título + toggle de modo de período */}
          <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:'var(--t)',marginBottom:12}}>
            Actividad del equipo
          </div>

          {/* Chips: Mes / Día / Rango */}
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            {[['month','🗓️ Mes'],['day','📅 Día'],['range','📆 Rango']].map(([id,lb])=>(
              <button key={id} onClick={()=>setPeriodMode(id)}
                style={{flex:1,background:periodMode===id?P:'white',color:periodMode===id?'white':'var(--t2)',
                  border:`1.5px solid ${periodMode===id?P:'var(--border)'}`,borderRadius:20,
                  padding:'8px 12px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                  transition:'all .15s'}}>
                {lb}
              </button>
            ))}
          </div>

          {/* Selector según el modo */}
          {periodMode==='month'
            ? <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <label className="lbl" style={{margin:0}}>Mes</label>
                <select value={month} onChange={e=>setMonth(e.target.value)}
                  style={{flex:1,border:'1.5px solid var(--border)',borderRadius:10,padding:'8px 12px',fontFamily:'inherit',fontSize:13,color:'var(--t)',background:'var(--card)',outline:'none',cursor:'pointer'}}>
                  {months.map(m=>(
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
              </div>
            : periodMode==='day'
            ? <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                <label className="lbl" style={{margin:0}}>Día</label>
                <input type="date" className="inp" value={day} max={today} onChange={e=>setDay(e.target.value)} style={{flex:1}}/>
              </div>
            : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <label className="lbl" style={{margin:0}}>Desde</label>
                  <input type="date" className="inp" value={from} max={today} onChange={e=>setFrom(e.target.value)} style={{flex:1}}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <label className="lbl" style={{margin:0}}>Hasta</label>
                  <input type="date" className="inp" value={to} max={today} onChange={e=>setTo(e.target.value)} style={{flex:1}}/>
                </div>
              </div>
          }

          {/* Período activo */}
          <div style={{background:'var(--primary-l)',borderRadius:12,padding:'10px 14px',marginBottom:16,fontSize:13,color:'var(--primary)',fontWeight:600}}>
            🗓️ {periodLabel()}
          </div>

          <>
              {/* Resumen total */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
                <StatCard label="Citas creadas"    value={totCreadas}             color={P}/>
                <StatCard label="Citas atendidas"  value={totAtendidas}           color='#059669'/>
                <StatCard label="Total en gastos"  value={`$${fmt(totMonto)}`}    color='#B03030' sub={periodLabel()}/>
                <StatCard label="Total ingresos"   value={`$${fmt(totIngresos)}`} color='#2E7D52' sub="citas completadas"/>
                <StatCard label="Total domicilios" value={totDom}                 color='#7C5C9E' sub={`$${fmt(totDomMonto)} recaudado`}/>
              </div>

              {users.length === 0 ? (
                <div style={{textAlign:'center',padding:'48px 20px',color:'var(--t2)'}}>
                  <div style={{fontSize:36,marginBottom:12}}>📭</div>
                  <div style={{fontSize:14}}>Sin actividad registrada en {periodLabel()}</div>
                  <div style={{fontSize:12,marginTop:4,color:'var(--t2)'}}>Los movimientos se registran automáticamente desde la app</div>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
                  {users
                    .sort((a,b)=>(b.citasCreadas+b.gastos)-(a.citasCreadas+a.gastos))
                    .map(u=>(
                      <UserCard
                        key={u.email}
                        user={u}
                        color={userColor(u.email)}
                        isCurrentUser={u.email===userEmail}
                        netLabelWord={netLabelWord}
                        onGoCitas={setTab ? ()=>setTab('appointments',{from:'reports'}) : undefined}
                        onGoGastos={setTab ? ()=>setTab('expense-detail',{from:'reports'}) : undefined}
                      />
                    ))
                  }
                </div>
              )}

              {/* Botones de exportación / envío */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:18,marginBottom:8}}>
                <button onClick={exportExcel} disabled={!hasData}
                  style={{padding:'14px 12px',border:'none',borderRadius:12,fontSize:14,fontWeight:700,fontFamily:'inherit',cursor:hasData?'pointer':'not-allowed',
                    background:hasData?'#0F766E':'#E5E0E0',color:'white'}}>
                  📊 Exportar Excel
                </button>
                <button onClick={sendWA} disabled={!hasData}
                  style={{padding:'14px 12px',border:'none',borderRadius:12,fontSize:14,fontWeight:700,fontFamily:'inherit',cursor:hasData?'pointer':'not-allowed',
                    background:hasData?'#25D366':'#E5E0E0',color:'white'}}>
                  💬 WhatsApp admin
                </button>
              </div>
              {!hasData && <div style={{textAlign:'center',fontSize:12,color:'var(--t2)',marginBottom:8}}>No hay datos en este período para exportar.</div>}
              {hasData && <div style={{textAlign:'center',fontSize:11,color:'var(--t2)',marginBottom:8}}>
                El reporte por WhatsApp se envía al admin: 📱 {ADMIN_WA}
              </div>}
          </>
        </div>
    </div>
  )
}

