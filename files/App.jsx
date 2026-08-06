import { useState, useEffect, useCallback } from 'react'
import { loadData, saveData, fullReset } from './api.js'
import AuthShell, { ChangePasswordModal } from './Auth.jsx'
import ReportsTab from './ReportsTab.jsx'

const AUTH_KEY  = 'sz_auth_email'
const ROLE_KEY  = 'sz_auth_role'
const NAME_KEY  = 'sz_auth_name'

/* ══════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
══════════════════════════════════════════════════════════════ */
// 30-min time slots 07:00 → 20:30
const TIME_SLOTS = []
for (let h = 7; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
}

const DEF_CATS   = ['Insumos','Arriendo','Publicidad','Servicios','Transporte','Gasolina','Otros']
const CAT_COLORS = ['#C4827A','#7A9FC4','#82C494','#C4A87A','#A47AC4','#C4C47A','#7AC4C4','#C47AA4']

const uid        = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7)
const localDateStr= (d=new Date()) => { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
const todayStr    = () => localDateStr()
const tomorrowStr = () => { const d=new Date(); d.setDate(d.getDate()+1); return localDateStr(d) }
const toN        = v => { const n=Number(String(v).replace(/[^0-9.-]/g,'')); return isNaN(n)?0:n }
const capWords   = s => String(s||'').trim().replace(/\b\w/g, c=>c.toUpperCase())
const capFirst   = s => { const t=String(s||'').trim(); return t ? t.charAt(0).toUpperCase()+t.slice(1).toLowerCase() : t }
const bool       = v => v===true||v==='true'
const fmtM       = n => `$${toN(n).toLocaleString('es-CO')}`

const cleanDate = raw => {
  if (!raw) return ''
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  try { const d=new Date(s); if(isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  catch { return '' }
}

const fmtDate = raw => {
  const s = cleanDate(raw); if (!s) return '—'
  try { return new Date(s+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short',year:'numeric'}) }
  catch { return s }
}

const cleanTime = raw => {
  if (!raw) return ''
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${String(Number(m[1])).padStart(2,'0')}:${m[2]}`
  return ''
}

const fmtTime = raw => {
  const s = cleanTime(raw); if (!s) return '—'
  const [h,min] = s.split(':').map(Number)
  if (isNaN(h)) return '—'
  return `${h>12?h-12:h===0?12:h}:${String(min).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}

const isPastAppt = a => {
  const d=cleanDate(a.date), t=cleanTime(a.time), td=todayStr(), now=new Date()
  if (d<td) return true
  if (d===td) { const[h,m]=t.split(':').map(Number); const apt=new Date(); apt.setHours(h,m,0); return apt<now }
  return false
}

// Returns available time slots: filters taken + past-today + custom exclude
const getSlots = (date, takenApptIds, allAppts, excludeId=null, assignedTo=null) => {
  const now     = new Date()
  const isToday = date === todayStr()
  const taken   = allAppts
    .filter(a => {
      if (cleanDate(a.date) !== date) return false
      if (a.id === excludeId) return false
      // Si hay empleada asignada, solo bloquear las horas de esa empleada
      if (assignedTo) {
        return String(a.assignedTo||'').trim().toLowerCase() === String(assignedTo).trim().toLowerCase()
      }
      return true
    })
    .map(a => cleanTime(a.time))

  return TIME_SLOTS.map(t => {
    const t2 = cleanTime(t)
    const isTaken = taken.includes(t2)
    const isPast  = isToday && (() => {
      const [h,m] = t2.split(':').map(Number)
      const slot  = new Date(); slot.setHours(h,m,0,0)
      return slot <= now
    })()
    return { time:t, disabled: isTaken||isPast, reason: isPast?'Hora pasada':'Ocupada' }
  })
}

const DEFAULT_SERVICES = [
  {id:uid(),name:'Diseño de cejas',     price:35000},
  {id:uid(),name:'Lifting de pestañas', price:85000},
  {id:uid(),name:'Tinte de cejas',      price:25000},
  {id:uid(),name:'Laminado de cejas',   price:60000},
]

// WhatsApp with proper emoji encoding
const openWA = (phone, name, time, date, serviceNames, total, isDom, attendantName) => {
  const p     = ('57' + phone.replace(/\D/g, '')).replace(/^5757/, '57')
  const NAIL  = '\uD83D\uDC85'  // 💅
  const BLOOM = '\uD83C\uDF38'  // 🌸
  const MOTO  = '\uD83D\uDEF5'  // 🛵
  const SPARK = '\u2728'         // ✨
  const CAL   = '\uD83D\uDCC5'  // 📅
  const CARD  = '\uD83D\uDCB3'  // 💳
  const PERS  = '\uD83D\uDC69\u200D\uD83D\uDCBC' // 👩‍💼
  const end   = isDom ? 'Nos vemos pronto ' + NAIL : '\u00A1Te esperamos! ' + BLOOM
  const dom   = isDom ? '\n' + MOTO + ' *A domicilio*' : ''
  const lines = [
    'Hola ' + name + '! ' + SPARK + ' Te recordamos tu cita:',
    SPARK + ' *' + serviceNames + '*' + dom,
    CAL + ' *' + fmtDate(date) + '* a las *' + fmtTime(time) + '*',
    isDom ? (MOTO + ' *A domicilio*') : null,
    CARD + ' Total: *' + fmtM(total) + '*',
    attendantName ? (PERS + ' Ser\u00E1 atendido/a por: *' + attendantName + '*') : null,
    '',
    end,
  ].filter(l => l !== null)
  const msg = lines.join('\n')
  const url = 'https://api.whatsapp.com/send/?phone=' + p + '&text=' + encodeURIComponent(msg) + '&type=phone_number&app_absent=0'
  window.open(url, '_blank')
}

/* ══════════════════════════════════════════════════════════════
   BUSINESS CONFIG — from Vercel environment variables
══════════════════════════════════════════════════════════════ */
const BIZ_NAME     = import.meta.env.VITE_BIZ_NAME     || 'SZ Micropigmentación'
const BIZ_SUBTITLE = import.meta.env.VITE_BIZ_SUBTITLE || 'Micropigmentación'
const BIZ_EMOJI    = import.meta.env.VITE_BIZ_EMOJI    || '🌸'
const BIZ_LOGO     = import.meta.env.VITE_BIZ_LOGO     || ''

/* ══════════════════════════════════════════════════════════════
   THEME — PALETTES + DARK MODE
══════════════════════════════════════════════════════════════ */
const PALETTES = [
  { id:'fucsia',  name:'Fucsia',       emoji:'💗',
    primary:'#C04A82', pd:'#9A2D64', pl:'#FCE8F2',
    bg:'#FDF2F7',   card:'#FFFFFF', border:'#F0C0D8',
    t:'#2A0A1A',    t2:'#7A2A52' },
  { id:'rosa',    name:'Rosa Blush',   emoji:'🌸',
    primary:'#B5524A', pd:'#8E3E38', pl:'#FAEAE8',
    bg:'#F7F0EC',   card:'#FFFFFF', border:'#E8D0CC',
    t:'#1E0E0C',    t2:'#7A5E5A' },
  { id:'morado',  name:'Lavanda',      emoji:'💜',
    primary:'#7C5CBF', pd:'#5D3F9E', pl:'#EDE8F9',
    bg:'#F4F0FC',   card:'#FFFFFF', border:'#D8CFF0',
    t:'#1A0E2E',    t2:'#6B5E8A' },
  { id:'azul',    name:'Azul Sereno',  emoji:'💙',
    primary:'#3A6EA8', pd:'#2A5080', pl:'#E3EEF9',
    bg:'#EFF4FB',   card:'#FFFFFF', border:'#C0D4EC',
    t:'#0E1A2E',    t2:'#4A6080' },
  { id:'verde',   name:'Salvia',       emoji:'🌿',
    primary:'#4A8C6E', pd:'#316650', pl:'#E2F2EA',
    bg:'#EEF6F1',   card:'#FFFFFF', border:'#BCD9CB',
    t:'#0E1E16',    t2:'#4A6E5A' },
  { id:'dorado',  name:'Ámbar',        emoji:'✨',
    primary:'#C08A2A', pd:'#966A18', pl:'#FBF2DE',
    bg:'#FBF6EE',   card:'#FFFFFF', border:'#ECCFA0',
    t:'#2A1A08',    t2:'#7A6030' },
  { id:'coral',   name:'Coral',        emoji:'🧡',
    primary:'#C2664A', pd:'#A04830', pl:'#FAECEA',
    bg:'#FBF1EE',   card:'#FFFFFF', border:'#ECC8BC',
    t:'#2A0E08',    t2:'#7A4E40' },
  { id:'teal',    name:'Turquesa',     emoji:'🌊',
    primary:'#2A8A8A', pd:'#1E6A6A', pl:'#DEF2F2',
    bg:'#EEF7F7',   card:'#FFFFFF', border:'#B8DEDE',
    t:'#0A1E1E',    t2:'#3A6E6E' },
  { id:'carbon',  name:'Carbón',       emoji:'🖤',
    primary:'#5A5A7A', pd:'#3E3E5E', pl:'#EAEAF2',
    bg:'#F4F4F8',   card:'#FFFFFF', border:'#CCCCD8',
    t:'#0E0E18',    t2:'#5A5A6E' },
]

const DARK_VARS = {
  bg:'#141218', card:'#1E1B24', border:'#2E2A38',
  t:'#EDE8F6',  t2:'#9490A8',
}

const THEME_KEY   = 'sz_theme_palette'
const DARK_KEY    = 'sz_theme_dark'

function getPalette(id) { return PALETTES.find(p=>p.id===id) || PALETTES[0] }

function ThemeStyle({ paletteId, dark }) {
  const p = getPalette(paletteId)
  const bg     = dark ? DARK_VARS.bg     : p.bg
  const card   = dark ? DARK_VARS.card   : p.card
  const border = dark ? DARK_VARS.border : p.border
  const t      = dark ? DARK_VARS.t      : p.t
  const t2     = dark ? DARK_VARS.t2     : p.t2
  const inpBg  = dark ? '#2A2638' : 'white'
  const warnBg = dark ? '#3A3010' : '#FFF4DC'
  const warnT  = dark ? '#E8D080' : '#7A5000'
  return <style>{`:root{
    --primary:${p.primary};--primary-d:${p.pd};--primary-l:${p.pl};
    --bg:${bg};--card:${card};--border:${border};
    --t:${t};--t2:${t2};
    --inp-bg:${inpBg};
    --gold:#C49A1A;--green:#2E7D52;--red:#B03030;
    --warn-bg:${warnBg};--warn-t:${warnT};
  }
  html { color-scheme: ${dark ? 'dark' : 'light'}; }
  `}</style>
}


export default function App() {
  const [tab,   setTabRaw] = useState('dashboard')
  const [tabExtra, setTabExtra] = useState(null)
  const [clients,  setC]   = useState([])
  const [services, setS]   = useState([])
  const [appts,    setA]   = useState([])
  const [expenses, setE]   = useState([])
  const [users,    setU]   = useState([])
  const [status,   setSt]  = useState('loading')
  const [errMsg,   setEM]  = useState('')
  const [lastSync, setLS]  = useState(null)
  const [modal,    setModal] = useState(null)
  const [userEmail,   setUserEmail]  = useState(() => localStorage.getItem(AUTH_KEY) || null)
  const [userRole,    setUserRole]   = useState(() => localStorage.getItem(ROLE_KEY)  || 'Empleada')
  const [userName,    setUserName]   = useState(() => localStorage.getItem(NAME_KEY)   || '')
  const [showChangePw, setShowChangePw] = useState(false)
  const [userMenuOpen, setUserMenuOpen]  = useState(false)
  const [paletteId, setPaletteId] = useState(() => localStorage.getItem(THEME_KEY) || 'rosa')
  const [darkMode,  setDarkMode]  = useState(() => localStorage.getItem(DARK_KEY) === 'true')

  const savePalette = id  => { localStorage.setItem(THEME_KEY, id);      setPaletteId(id) }
  const saveDark    = val => { localStorage.setItem(DARK_KEY,  String(val)); setDarkMode(val) }

  const handleLogin  = (email, role='Empleada', name='') => { localStorage.setItem(AUTH_KEY, email); localStorage.setItem(ROLE_KEY, role); localStorage.setItem(NAME_KEY, name); setUserEmail(email); setUserRole(role); setUserName(name) }
  const handleLogout = () => { localStorage.removeItem(AUTH_KEY); localStorage.removeItem(ROLE_KEY); localStorage.removeItem(NAME_KEY); setUserEmail(null); setUserRole('Empleada'); setUserName('') }

  const setTab = (t, extra=null) => { setTabRaw(t); setTabExtra(extra) }

  const refresh = useCallback((silent=false) => {
    if (!import.meta.env.VITE_SCRIPT_URL) { setSt('noconfig'); return }
    if (!silent) setSt('loading')
    loadData().then(d => {
      setC(Array.isArray(d.clients)?d.clients:[])
      setS(Array.isArray(d.services)&&d.services.length?d.services:DEFAULT_SERVICES)
      setA(Array.isArray(d.appointments)?d.appointments:[])
      setE(Array.isArray(d.expenses)?d.expenses:[])
      setU(Array.isArray(d.users)?d.users:[])
      setSt('ok'); setLS(new Date())
    }).catch(e => {
      setEM(e.message); setSt('error')
      try {
        setC(JSON.parse(localStorage.getItem('sb_c')||'[]'))
        setS(JSON.parse(localStorage.getItem('sb_s')||'null')||DEFAULT_SERVICES)
        setA(JSON.parse(localStorage.getItem('sb_a')||'[]'))
        setE(JSON.parse(localStorage.getItem('sb_e')||'[]'))
      } catch {}
    })
  }, [])

  useEffect(() => { refresh() }, [])
  useEffect(() => { const i=setInterval(()=>refresh(true),30*1000); return()=>clearInterval(i) }, [refresh])

  const sync = useCallback(async (payload, setter, value) => {
    if (setter) setter(value)
    const km={clients:'sb_c',services:'sb_s',appointments:'sb_a',expenses:'sb_e'}
    Object.entries(payload).forEach(([k,v])=>{if(km[k])try{localStorage.setItem(km[k],JSON.stringify(v))}catch{}})
    setSt('saving')
    try {
      const r=await saveData(payload, userEmail)
      setSt('ok'); setLS(new Date())
      // Refresh silently after save so all clients see latest data
      setTimeout(()=>refresh(true), 800)
      return r
    }
    catch(e) { setEM(e.message); setSt('error'); setTimeout(()=>setSt('ok'),5000); return null }
  }, [userEmail])

  const SC = useCallback((v,x={})=>sync({clients:v,...x},     setC,v),[sync])
  const SS = useCallback((v,x={})=>sync({services:v,...x},    setS,v),[sync])
  const SA = useCallback((v,x={})=>sync({appointments:v,...x},setA,v),[sync])
  const SE = useCallback((v,x={})=>sync({expenses:v,...x},    setE,v),[sync])

  const confirm  = (msg, onOk) => setModal({type:'confirm', msg, onOk})
  const infoModal= (msg)       => setModal({type:'info', msg})

  const deleteAppt = useCallback(async appt => {
    const next = appts.filter(x=>x.id!==appt.id)
    SA(next)
    if (appt.calendarEventId && bool(appt.calendarCreated))
      saveData({action:'deleteCalendarEvent',eventId:appt.calendarEventId}).catch(()=>{})
    if (appt.adminEventId)
      saveData({action:'deleteCalendarEvent',eventId:appt.adminEventId}).catch(()=>{})
  }, [appts, SA])

  const isAdmin = userRole === 'Administradora'

  // Mapa email → nombre para mostrar nombres reales en lugar de derivar del correo
  const userNameMap = {}
  users.forEach(u => { if (u.email) userNameMap[u.email.trim().toLowerCase()] = u.name || '' })
  // También incluir el usuario actual en el mapa
  if (userEmail && userName) userNameMap[userEmail.trim().toLowerCase()] = userName

  // Empleada only sees her own expenses and her own appts
  const visibleExpenses = isAdmin ? expenses : expenses.filter(e => e.createdBy === userEmail)
  const visibleAppts    = isAdmin ? appts    : appts.filter(a => a.assignedTo === userEmail || a.createdBy === userEmail || (!a.assignedTo && !a.createdBy))

  const p = {clients,services,appts,visibleAppts,expenses,visibleExpenses,SC,SS,SA,SE,sync,deleteAppt,setTab,confirm,infoModal,tabExtra,userEmail,userRole,isAdmin,userName,users,userNameMap,paletteId,darkMode,savePalette,saveDark}

  if (status==='loading') return <Cent><div style={{fontSize:52,animation:'pulse 2s ease-in-out infinite'}}>{BIZ_EMOJI}</div></Cent>
  if (status==='noconfig') return <Cent><div style={{fontSize:36,marginBottom:8}}>⚙️</div><p style={{fontSize:16,fontWeight:600}}>Configura VITE_SCRIPT_URL y VITE_TOKEN en Vercel</p></Cent>

  return (
    <AuthShell onLogin={handleLogin} onLogout={handleLogout} userEmail={userEmail} userRole={userRole} userName={userName}>
      {showChangePw && <ChangePasswordModal email={userEmail} onClose={()=>setShowChangePw(false)}/>}
    <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",minHeight:'100vh',background:'var(--bg)',color:'var(--t)'}}>
      <GS/>
      <ThemeStyle paletteId={paletteId} dark={darkMode}/>
      {modal?.type==='confirm' && <Modal msg={modal.msg} onOk={()=>{modal.onOk();setModal(null)}} onCancel={()=>setModal(null)}/>}
      {modal?.type==='info'    && <Modal msg={modal.msg} onOk={()=>setModal(null)} okLabel="Entendido" cancelLabel={null}/>}

      <header style={{background:'var(--primary)',padding:'13px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 12px rgba(180,100,100,0.18)'}}>
        <div style={{display:'flex',alignItems:'center',gap:11}}>
          {BIZ_LOGO
            ? <img src={BIZ_LOGO} alt={BIZ_NAME} style={{width:38,height:38,borderRadius:10,objectFit:'cover',flexShrink:0}}/>
            : <div style={{fontSize:26}}>{BIZ_EMOJI}</div>
          }
          <div>
            <div style={{fontFamily:'Georgia,serif',fontSize:15,color:'white',fontWeight:700}}>{BIZ_NAME}</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.78)',letterSpacing:'0.14em',textTransform:'uppercase'}}>{BIZ_SUBTITLE}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={()=>refresh(true)} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 10px',color:'white',fontSize:14,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>↻</button>
          <SyncBadge status={status} lastSync={lastSync}/>
          <div style={{position:'relative'}}>
            <button onClick={()=>setUserMenuOpen(v=>!v)} style={{background:'rgba(255,255,255,0.18)',border:'none',borderRadius:20,padding:'5px 10px',color:'white',fontSize:13,cursor:'pointer',fontFamily:'inherit',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
              👤 <span style={{maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>{userName || (userEmail||'').split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
            </button>
            {userMenuOpen && (
              <div style={{position:'absolute',right:0,top:'calc(100% + 8px)',background:'var(--card)',borderRadius:12,boxShadow:'0 4px 24px rgba(0,0,0,.15)',padding:'8px',minWidth:180,zIndex:200}} onClick={()=>setUserMenuOpen(false)}>
                <div style={{fontSize:11,color:'var(--t2)',padding:'4px 10px 8px',borderBottom:'1px solid #f0e8e8',marginBottom:6}}>{userName && <strong style={{display:'block',color:'var(--t)',fontSize:12}}>{userName}</strong>}{userEmail}</div>
                <button onClick={()=>setShowChangePw(true)} style={{width:'100%',textAlign:'left',background:'none',border:'none',padding:'9px 12px',fontSize:14,cursor:'pointer',fontFamily:'inherit',borderRadius:8,color:'var(--t)',fontWeight:500}}>🔑 Cambiar contraseña</button>
                <button onClick={handleLogout} style={{width:'100%',textAlign:'left',background:'none',border:'none',padding:'9px 12px',fontSize:14,cursor:'pointer',fontFamily:'inherit',borderRadius:8,color:'#B85C6E',fontWeight:600}}>🚪 Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav style={{background:'var(--card)',borderBottom:'1px solid var(--border)',display:'flex',overflowX:'auto',padding:'0 2px',position:'sticky',top:58,zIndex:99,scrollbarWidth:'none'}}>
        {[
          ['dashboard',  'grid',   'Panel',        true],
          ['appointments','cal',   'Citas',         true],
          ['clients',    'people', 'Clientes',      true],
          ['services',   'stars',  'Servicios',     isAdmin],
          ['finances',   'chart',  'Finanzas',      isAdmin],
          ['reports',    'stats',  'Reportes',      isAdmin],
          ['my-expenses','wallet', 'Mis Gastos',    !isAdmin],
          ['settings',   'gear',   'Config',        true],
        ].filter(([,,, show])=>show).map(([id,ic,lb])=>(
          <button key={id} onClick={()=>setTab(id)} className={`nb${tab===id?' act':''}`}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,paddingTop:9,paddingBottom:9,paddingLeft:12,paddingRight:12}}>
            <NavIcon type={ic} active={tab===id}/>
            <span style={{fontSize:10,letterSpacing:'.02em'}}>{lb}</span>
          </button>
        ))}
      </nav>

      <main style={{padding:'16px 14px',maxWidth:680,margin:'0 auto'}}>
        {status==='error' && <div className="warn-box">⚠️ Modo sin conexión — {errMsg}</div>}
        {tab==='dashboard'     && <Dashboard      {...p}/>}
        {tab==='appointments'  && <ApptsTab       {...p}/>}
        {tab==='clients'       && <ClientsTab     {...p}/>}
        {tab==='services'      && <ServicesTab    {...p}/>}
        {tab==='finances'      && <FinancesTab    {...p}/>}
        {tab==='income-detail' && <IncomeDetail   {...p}/>}
        {tab==='expense-detail'  && <ExpenseDetail  {...p}/>}
        {tab==='client-history'  && <ClientHistory   {...p}/>}
        {tab==='comparison'      && <MonthComparison {...p}/>}
        {tab==='top-services'    && <TopServices     {...p}/>}
        {tab==='reports'         && isAdmin && <ReportsTab {...p}/>}
        {tab==='settings'        && <SettingsTab {...p}/>}
        {tab==='my-expenses'     && !isAdmin && <MyExpensesTab {...p}/>}
      </main>

      <footer style={{textAlign:'center',padding:'20px 14px 28px',borderTop:'1px solid var(--border)',marginTop:8,background:'var(--card)'}}>
        <span style={{fontSize:11,color:'var(--t2)',letterSpacing:'.03em',display:'inline-flex',alignItems:'center',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
          <span>{BIZ_EMOJI} {BIZ_NAME}</span>
          <span style={{color:'var(--border)'}}>|</span>
          <span>© {new Date().getFullYear()} Bryan Morales</span>
          <span style={{color:'var(--border)'}}>|</span>
          <svg width="20" height="14" viewBox="0 0 20 14" style={{verticalAlign:'middle',borderRadius:2,display:'inline-block',flexShrink:0}}>
            <rect width="20" height="14" fill="#FCD116"/>
            <rect y="7" width="20" height="7" fill="#003893"/>
            <rect y="9.33" width="20" height="4.67" fill="#CE1126"/>
          </svg>
        </span>
      </footer>
    </div>
    </AuthShell>
  )
}

/* ══════════════════════════════════════════════════════════════
   MY EXPENSES TAB — vista de empleada (solo sus gastos)
══════════════════════════════════════════════════════════════ */
function MyExpensesTab({expenses, visibleExpenses, SE, confirm, userEmail}) {
  const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7)
  const fmt = n => Number(n||0).toLocaleString('es-CO')
  const fmtM2 = n => '$'+Number(n||0).toLocaleString('es-CO')

  const today = localDateStr()
  const [desc, setD]     = useState('')
  const [amount, setA]   = useState('')
  const [cat, setCat]    = useState('Insumos')
  const [expDate, setED] = useState(today)
  const [editId, setEI]  = useState(null)
  const [editData, setED2] = useState({})
  const [month, setM]    = useState(today.slice(0,7))

  // Categorías: las fijas + las que ya existen en cualquier gasto (incluye las que creó la admin)
  const CATS = [...new Set([...DEF_CATS, ...(Array.isArray(expenses)?expenses:[]).map(e=>e.category).filter(Boolean)])]
  const safe = Array.isArray(visibleExpenses) ? visibleExpenses : []
  const allExpenses = Array.isArray(expenses) ? expenses : []
  const months = [...new Set([...safe.map(e=>cleanDate(e.date).slice(0,7)), today.slice(0,7)].filter(Boolean))].sort((a,b)=>b.localeCompare(a))
  const me = safe.filter(e=>cleanDate(e.date).slice(0,7)===month)
  const total = me.reduce((s,e)=>s+toN(e.amount||0),0)

  const add = () => {
    if (!desc.trim()||!amount) return
    SE([...allExpenses, {id:uid(),description:capFirst(desc),amount:Number(amount),category:capFirst(cat),date:expDate,createdBy:userEmail||''}])
    setD(''); setA('')
  }

  const saveEdit = () => {
    SE(allExpenses.map(e=>e.id===editId?{...e,...editData,description:capFirst(editData.description||'')}:e))
    setEI(null)
  }

  const delExpense = (e) => {
    confirm(`¿Eliminar el gasto "${e.description}"?`, ()=>SE(allExpenses.filter(x=>x.id!==e.id)))
  }

  const P = '#B85C6E', PL = '#FDF6F0', PB = '#F5D0D8'
  const monthLabel = m => new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})

  return (
    <div style={{padding:'0 16px 80px'}}>
      <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:'var(--t)',marginBottom:4}}>Mis Gastos</div>
      <div style={{fontSize:13,color:'var(--t2)',marginBottom:16}}>Solo ves y gestionas los gastos que tú registraste</div>

      {/* Selector de mes */}
      <div style={{marginBottom:14}}>
        <label className="lbl">Ver mes</label>
        <select className="inp" value={month} onChange={e=>setM(e.target.value)}>
          {months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* Total */}
      <div style={{background:PL,borderRadius:14,padding:'16px 20px',marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${PB}`}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em'}}>Total del mes</div>
          <div style={{fontSize:28,fontWeight:800,color:P,letterSpacing:'-1px'}}>{fmtM2(total)}</div>
        </div>
        <div style={{fontSize:11,color:'var(--t2)',textAlign:'right'}}>{me.length} gasto{me.length!==1?'s':''}</div>
      </div>

      {/* Formulario nuevo gasto */}
      <div className="card">
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>➕ Nuevo gasto</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div style={{gridColumn:'1/-1'}}>
            <label className="lbl">Descripción</label>
            <input className="inp" value={desc}
              onChange={e=>setD(capFirst(e.target.value))}
              placeholder="Ej: Cera depilatoria"/>
          </div>
          <div>
            <label className="lbl">Monto (COP)</label>
            <input className="inp" type="number" placeholder="20000" value={amount} onChange={e=>setA(e.target.value)}/>
          </div>
          <div>
            <label className="lbl">Fecha</label>
            <input type="date" className="inp" value={expDate} onChange={e=>setED(e.target.value)}/>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label className="lbl">Categoría</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:4}}>
              {CATS.map(c=>(
                <button key={c} onClick={()=>setCat(c)}
                  style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${cat===c?P:PB}`,
                    background:cat===c?P:'white',color:cat===c?'white':'#666',
                    fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .15s'}}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button className="btn" style={{width:'100%'}} onClick={add} disabled={!desc.trim()||!amount}>
          Registrar gasto
        </button>
      </div>

      {/* Lista */}
      {me.length===0 ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--t2)'}}>
          <div style={{fontSize:32,marginBottom:8}}>🧾</div>
          <div>No hay gastos en este mes</div>
        </div>
      ) : (
        <div className="card">
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>📋 Gastos del mes</div>
          {[...me].sort((a,b)=>cleanDate(a.date).localeCompare(cleanDate(b.date))).map(e=>{
            const isEdit = editId===e.id
            return (
              <div key={e.id} style={{padding:'10px 0',borderBottom:'1px solid #FBF0F3'}}>
                {isEdit ? (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{gridColumn:'1/-1'}}>
                      <label className="lbl">Descripción</label>
                      <input className="inp" value={editData.description||''}
                        onChange={ev=>setED2(d=>({...d,description:capFirst(ev.target.value)}))}
                        placeholder="Descripción"/>
                    </div>
                    <div><label className="lbl">Monto</label><input className="inp" type="number" value={editData.amount||''} onChange={ev=>setED2(d=>({...d,amount:ev.target.value}))}/></div>
                    <div><label className="lbl">Fecha</label><input type="date" className="inp" value={editData.date||''} onChange={ev=>setED2(d=>({...d,date:ev.target.value}))}/></div>
                    <div style={{gridColumn:'1/-1'}}>
                      <label className="lbl">Categoría</label>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:4}}>
                        {CATS.map(c=>(
                          <button key={c} onClick={()=>setED2(d=>({...d,category:c}))}
                            style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${(editData.category||cat)===c?P:PB}`,
                              background:(editData.category||cat)===c?P:'white',color:(editData.category||cat)===c?'white':'#666',
                              fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{gridColumn:'span 2',display:'flex',gap:8}}>
                      <button className="btn" style={{flex:1}} onClick={saveEdit}>Guardar</button>
                      <button className="btn-del" onClick={()=>setEI(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:13,color:'var(--t)',marginBottom:2}}>{e.description}</div>
                      <div style={{fontSize:11,color:'var(--t2)'}}>{e.category} · {fmtDate(e.date)}</div>
                    </div>
                    <span style={{fontWeight:700,color:P,fontSize:14,flexShrink:0}}>{fmtM2(e.amount)}</span>
                    <button className="btn-edit" onClick={()=>{setEI(e.id);setED2({...e})}}>✏️</button>
                    <button className="btn-del" onClick={()=>delExpense(e)}>✕</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Modal({msg, onOk, onCancel, okLabel='Eliminar', cancelLabel='Cancelar'}) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'var(--card)',borderRadius:20,padding:28,maxWidth:340,width:'100%',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:15,fontWeight:600,color:'var(--t)',marginBottom:18,lineHeight:1.5}}>{msg}</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          {cancelLabel && <button className="btn-o" style={{flex:1}} onClick={onCancel}>{cancelLabel}</button>}
          <button className="btn" style={{flex:1,background:okLabel==='Eliminar'?'#B03030':'var(--primary)'}} onClick={onOk}>{okLabel}</button>
        </div>
      </div>
    </div>
  )
}

const Cent = ({children}) => <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)',gap:8,padding:24}}>{children}</div>

/* ── NavIcon — crisp SVG icons for navigation ── */
function NavIcon({type, active}) {
  const c = active ? 'var(--primary)' : 'var(--t2)'
  const s = {display:'block', lineHeight:0}
  const icons = {
    grid: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="2" width="8" height="8" rx="2" fill={c} opacity={active?1:.7}/>
        <rect x="12" y="2" width="8" height="8" rx="2" fill={c} opacity={active?1:.5}/>
        <rect x="2" y="12" width="8" height="8" rx="2" fill={c} opacity={active?1:.5}/>
        <rect x="12" y="12" width="8" height="8" rx="2" fill={c} opacity={active?1:.7}/>
      </svg>
    ),
    cal: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="4" width="18" height="16" rx="3" stroke={c} strokeWidth="1.8" fill="none"/>
        <line x1="2" y1="9" x2="20" y2="9" stroke={c} strokeWidth="1.6"/>
        <line x1="7" y1="2" x2="7" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <line x1="15" y1="2" x2="15" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="7" cy="14" r="1.5" fill={c}/>
        <circle cx="11" cy="14" r="1.5" fill={c}/>
        <circle cx="15" cy="14" r="1.5" fill={c}/>
      </svg>
    ),
    people: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="8" cy="7" r="3.5" stroke={c} strokeWidth="1.8" fill="none"/>
        <path d="M2 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="16" cy="8" r="2.5" stroke={c} strokeWidth="1.6" fill="none" opacity=".7"/>
        <path d="M14 19c0-2.2 1.3-4.1 3-5" stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".7"/>
      </svg>
    ),
    stars: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M11 3l2 5h5l-4 3 1.5 5L11 13l-4.5 3L8 11 4 8h5z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" fill={active?c:'none'} fillOpacity={active?.25:0}/>
        <circle cx="17" cy="4" r="1.5" fill={c} opacity=".6"/>
        <circle cx="5" cy="17" r="1.2" fill={c} opacity=".5"/>
        <circle cx="19" cy="15" r="1" fill={c} opacity=".45"/>
      </svg>
    ),
    chart: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="14" width="4" height="6" rx="1.5" fill={c} opacity={active?1:.65}/>
        <rect x="9" y="9" width="4" height="11" rx="1.5" fill={c} opacity={active?1:.8}/>
        <rect x="16" y="5" width="4" height="15" rx="1.5" fill={c}/>
        <line x1="2" y1="20.5" x2="20" y2="20.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    stats: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8.5" stroke={c} strokeWidth="1.8" fill="none"/>
        <path d="M11 6v5l3 3" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="11" cy="11" r="1.5" fill={c}/>
      </svg>
    ),
    wallet: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="2" y="6" width="18" height="13" rx="2.5" stroke={c} strokeWidth="1.8" fill="none"/>
        <path d="M2 10h18" stroke={c} strokeWidth="1.5"/>
        <circle cx="15.5" cy="14" r="1.5" fill={c}/>
        <path d="M6 3h10" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity=".6"/>
      </svg>
    ),
    gear: (
      <svg style={s} width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="3" stroke={c} strokeWidth="1.8" fill="none"/>
        <path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.22 4.22l1.42 1.42M16.36 16.36l1.42 1.42M4.22 17.78l1.42-1.42M16.36 5.64l1.42-1.42" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity={active?1:.7}/>
      </svg>
    ),
  }
  return icons[type] || null
}

function SyncBadge({status,lastSync}) {
  const [ago,setAgo] = useState('')
  useEffect(()=>{
    if (!lastSync) return
    const t=()=>{const m=Math.floor((Date.now()-lastSync)/60000);setAgo(m===0?'ahora':m+'min')}
    t(); const i=setInterval(t,30000); return()=>clearInterval(i)
  },[lastSync])
  const c={ok:{bg:'rgba(255,255,255,0.18)',col:'white',l:ago?`✓ ${ago}`:'✓'},saving:{bg:'rgba(255,255,255,0.18)',col:'white',l:'⏳'},error:{bg:'rgba(220,80,80,0.4)',col:'white',l:'⚠️'}}[status]||{bg:'transparent',col:'transparent',l:''}
  return <div style={{background:c.bg,color:c.col,borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{c.l}</div>
}

/* ── Global CSS ── */
function GS() { return <style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  :root{
    --primary:#B5524A;--primary-d:#8E3E38;--primary-l:#FAEAE8;
    --bg:#F7F0EC;--card:#FFFFFF;--border:#E8D0CC;
    --t:#1E0E0C;--t2:#7A5E5A;--gold:#C49A1A;
    --green:#2E7D52;--red:#B03030;
    --warn-bg:#FFF4DC;--warn-t:#7A5000;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{-webkit-tap-highlight-color:transparent}
  .nb{background:none;border:none;border-bottom:2.5px solid transparent;padding:11px 12px;font-size:13px;font-weight:500;cursor:pointer;color:var(--t2);white-space:nowrap;font-family:inherit;transition:all .15s;flex-shrink:0}
  .nb.act{color:var(--primary);border-bottom-color:var(--primary);font-weight:700}
  .card{background:var(--card);border-radius:16px;border:1px solid var(--border);padding:18px;margin-bottom:12px}
  .inp{width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:15px;color:var(--t);background:var(--inp-bg);outline:none;font-family:inherit;transition:border-color .15s;-webkit-appearance:none}
  .inp:focus{border-color:var(--primary)}
  .lbl{display:block;font-size:11px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
  .btn{background:var(--primary);color:white;border:none;border-radius:10px;padding:12px 22px;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit;transition:background .15s}
  .btn:active{background:var(--primary-d)}.btn:disabled{opacity:.4;cursor:not-allowed}
  .btn-o{background:var(--card);color:var(--primary);border:1.5px solid var(--primary);border-radius:10px;padding:10px 18px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
  .btn-sm{background:var(--primary-l);color:var(--primary);border:none;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .btn-del{background:var(--primary-l);color:var(--red);border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
  .btn-del:active{background:var(--red);color:white}
  .btn-wa{background:#25D366;color:white;border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  .btn-edit{background:var(--primary-l);color:var(--primary-d);border:none;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
  .btn-check{background:var(--card);border:1.5px solid var(--border);color:var(--t2);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
  .btn-check.done{background:var(--primary-l);border-color:var(--green);color:var(--green)}
  .tag{display:inline-block;background:var(--primary-l);color:var(--primary);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
  .tag-g{display:inline-block;background:var(--primary-l);color:var(--green);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
  .tag-gold{display:inline-block;background:var(--primary-l);color:var(--gold);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
  .tag-past{display:inline-block;background:var(--border);color:var(--t2);border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600}
  .row{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border)}
  .row:last-child{border-bottom:none}
  .stat{background:var(--card);border-radius:14px;border:1px solid var(--border);padding:16px 12px;text-align:center;cursor:pointer;transition:transform .15s,box-shadow .15s}
  .stat:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(196,130,122,0.15)}
  .to{background:white;border:1.5px solid var(--border);border-radius:9px;padding:8px 2px;font-size:11px;font-weight:600;cursor:pointer;text-align:center;font-family:inherit;transition:all .12s;color:var(--t);line-height:1.2}
  .to:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}
  .to.sel{background:var(--primary);border-color:var(--primary);color:white}
  .to:disabled{background:#f8f8f8;border-color:#e8e8e8;color:#ccc;cursor:not-allowed}
  .so{background:white;border:1.5px solid var(--border);border-radius:12px;padding:13px 15px;cursor:pointer;text-align:left;width:100%;font-family:inherit;transition:all .12s;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
  .so.sel{border-color:var(--primary);background:var(--primary-l)}
  .warn-box{background:var(--warn-bg);border:1px solid #F0D870;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--warn-t)}
  .sugg-item{padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:14px;transition:background .12s}
  .sugg-item:last-child{border-bottom:none}
  .sugg-item:hover{background:var(--primary-l)}
  nav::-webkit-scrollbar{display:none}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
  @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .slide-in{animation:slideDown .18s ease forwards}
`}</style> }

/* ══════════════════════════════════════════════════════════════
   SETTINGS TAB — Paletas, modo oscuro, reset del sistema
══════════════════════════════════════════════════════════════ */
function SettingsTab({ paletteId, darkMode, savePalette, saveDark, SA, SC, SE, SS, sync, confirm, isAdmin, userEmail }) {
  const [resetInput, setResetInput] = useState('')
  const [resetDone,  setResetDone]  = useState(false)
  const [resetStep,  setResetStep]  = useState(0)
  const [resetError, setResetError] = useState('')
  const currentPalette = getPalette(paletteId)

  const doReset = async () => {
    setResetStep('loading')
    setResetError('')
    try {
      await fullReset(userEmail)
      SC([]); SA([]); SE([])
      ;['sb_c','sb_a','sb_e'].forEach(k => { try { localStorage.removeItem(k) } catch {} })
      setResetStep(2)
    } catch(e) {
      setResetError('Error: ' + (e.message || 'No se pudo conectar con el servidor'))
      setResetStep(1)
    }
    setResetInput('')
  }

  const P = 'var(--primary)'
  const sectionTitle = (emoji, title) => (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
      <span style={{fontSize:22}}>{emoji}</span>
      <div style={{fontFamily:'Georgia,serif',fontSize:18,fontWeight:700,color:'var(--t)'}}>{title}</div>
    </div>
  )

  return (
    <div style={{padding:'0 0 80px'}}>
      <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:'var(--t)',marginBottom:4}}>Configuración</div>
      <div style={{fontSize:13,color:'var(--t2)',marginBottom:20}}>Personaliza la apariencia del sistema</div>

      {/* ── MODO OSCURO/CLARO ── */}
      <div className="card" style={{marginBottom:12}}>
        {sectionTitle('🌗', 'Modo de visualización')}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[
            {val:false, label:'Modo claro', icon:'☀️', desc:'Fondo blanco'},
            {val:true,  label:'Modo oscuro', icon:'🌙', desc:'Fondo oscuro'},
          ].map(opt => (
            <button key={String(opt.val)} onClick={()=>saveDark(opt.val)}
              style={{
                padding:'16px 12px', borderRadius:14, border:`2px solid ${darkMode===opt.val?'var(--primary)':'var(--border)'}`,
                background: darkMode===opt.val ? 'var(--primary-l)' : 'var(--card)',
                cursor:'pointer', textAlign:'center', transition:'all .18s', fontFamily:'inherit',
              }}>
              <div style={{fontSize:28,marginBottom:6}}>{opt.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:darkMode===opt.val?'var(--primary)':'var(--t)'}}>{opt.label}</div>
              <div style={{fontSize:11,color:'var(--t2)',marginTop:2}}>{opt.desc}</div>
              {darkMode===opt.val && <div style={{fontSize:10,color:'var(--primary)',fontWeight:700,marginTop:6}}>✓ Activo</div>}
            </button>
          ))}
        </div>
      </div>

      {/* ── PALETAS DE COLOR ── */}
      <div className="card" style={{marginBottom:12}}>
        {sectionTitle('🎨', 'Paleta de colores')}
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
          {PALETTES.map(pal => {
            const active = paletteId === pal.id
            return (
              <button key={pal.id} onClick={()=>savePalette(pal.id)}
                style={{
                  padding:'14px 12px', borderRadius:14,
                  border:`2.5px solid ${active ? pal.primary : 'var(--border)'}`,
                  background: active ? (darkMode ? '#2A2638' : pal.pl) : 'var(--card)',
                  cursor:'pointer', fontFamily:'inherit', transition:'all .18s',
                  display:'flex', alignItems:'center', gap:10,
                }}>
                {/* Color swatch */}
                <div style={{
                  width:38, height:38, borderRadius:10, flexShrink:0,
                  background:`linear-gradient(135deg, ${pal.primary} 50%, ${pal.pd} 100%)`,
                  boxShadow: active ? `0 3px 10px ${pal.primary}55` : 'none',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:18,
                }}>{pal.emoji}</div>
                <div style={{textAlign:'left', minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color: active ? pal.primary : 'var(--t)'}}>{pal.name}</div>
                  <div style={{fontSize:10,color:'var(--t2)',marginTop:1}}>{pal.primary}</div>
                  {active && <div style={{fontSize:10,fontWeight:700,color:pal.primary,marginTop:2}}>✓ Activa</div>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Vista previa */}
        <div style={{marginTop:16,padding:'14px',borderRadius:14,border:'1px dashed var(--border)',background:'var(--bg)'}}>
          <div style={{fontSize:11,fontWeight:700,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>Vista previa — {currentPalette.name}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <button className="btn" style={{padding:'8px 16px',fontSize:13}}>Guardar</button>
            <button className="btn-o" style={{padding:'6px 14px',fontSize:13}}>Cancelar</button>
            <button className="btn-sm">Volver</button>
            <span className="tag">Servicio</span>
            <span className="tag-g">Completada</span>
            <div style={{display:'flex',gap:4,marginLeft:4}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:'var(--primary)'}}/>
              <div style={{width:20,height:20,borderRadius:'50%',background:'var(--primary-l)',border:'1.5px solid var(--primary)'}}/>
              <div style={{width:20,height:20,borderRadius:'50%',background:'var(--bg)',border:'1.5px solid var(--border)'}}/>
            </div>
          </div>
          <div style={{marginTop:10,padding:'10px 12px',borderRadius:10,background:'var(--card)',border:'1px solid var(--border)',fontSize:13,color:'var(--t)'}}>
            Ejemplo de tarjeta — <span style={{color:'var(--primary)',fontWeight:600}}>texto destacado</span> y <span style={{color:'var(--t2)'}}>texto secundario</span>
          </div>
        </div>
      </div>

      {/* ── RESET DEL SISTEMA — solo Administradora ── */}
      {isAdmin && (
      <div className="card" style={{border:'1.5px solid #FFCCCC',background: darkMode ? '#2A1A1A' : '#FFF8F8'}}>
        {sectionTitle('⚠️', 'Zona de peligro')}
        <div style={{background: darkMode ? '#3A2020' : '#FFF0F0', borderRadius:12, padding:'14px 16px', marginBottom:14, border:'1px solid #FFB8B8'}}>
          <div style={{fontWeight:700,fontSize:14,color:'#C03030',marginBottom:4}}>🗑️ Restablecer el sistema</div>
          <div style={{fontSize:13,color:darkMode?'#CC9090':'#7A3030',lineHeight:1.6}}>
            Esta acción elimina <strong>permanentemente</strong> todas las citas, clientes y gastos registrados. Los servicios y usuarios <strong>no</strong> se eliminan.
          </div>
        </div>

        {resetStep === 0 && (
          <button onClick={()=>setResetStep(1)}
            style={{width:'100%',padding:'12px',background:'#C03030',color:'white',border:'none',
              borderRadius:10,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            Restablecer sistema…
          </button>
        )}

        {resetStep === 'loading' && (
          <div style={{textAlign:'center',padding:'20px',color:'var(--t2)',fontSize:13}}>
            <div style={{fontSize:28,marginBottom:8,animation:'spin 1s linear infinite',display:'inline-block'}}>{BIZ_EMOJI}</div>
            <div>Borrando datos…</div>
          </div>
        )}

        {resetStep === 1 && (
          <div>
            <div style={{fontSize:13,color:'#C03030',fontWeight:600,marginBottom:8}}>
              Escribe <strong>CONFIRMAR</strong> para continuar:
            </div>
            {resetError && (
              <div style={{background:'#FEE2E2',color:'#B91C1C',borderRadius:8,padding:'8px 12px',fontSize:12,marginBottom:8}}>
                {resetError}
              </div>
            )}
            <input className="inp" value={resetInput}
              onChange={e=>setResetInput(e.target.value)}
              placeholder="CONFIRMAR"
              style={{marginBottom:10, border:'1.5px solid #FFB8B8', letterSpacing:'.1em', fontWeight:700}}
            />
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setResetStep(0);setResetInput('')}}
                style={{flex:1,padding:'11px',background:'var(--card)',color:'var(--t)',border:'1.5px solid var(--border)',borderRadius:10,fontFamily:'inherit',fontWeight:600,cursor:'pointer',fontSize:14}}>
                Cancelar
              </button>
              <button onClick={doReset} disabled={resetInput !== 'CONFIRMAR'}
                style={{flex:2,padding:'11px',background:resetInput==='CONFIRMAR'?'#C03030':'#E0A0A0',color:'white',border:'none',
                  borderRadius:10,fontFamily:'inherit',fontWeight:700,cursor:resetInput==='CONFIRMAR'?'pointer':'not-allowed',fontSize:14}}>
                Eliminar todo
              </button>
            </div>
          </div>
        )}

        {resetStep === 2 && (
          <div style={{textAlign:'center',padding:'16px',background:'#EDF7F0',borderRadius:12,border:'1px solid #B8DEC8'}}>
            <div style={{fontSize:28,marginBottom:6}}>✅</div>
            <div style={{fontWeight:700,color:'#2E7D52',fontSize:14}}>Sistema restablecido</div>
            <div style={{fontSize:12,color:'#4A8C6E',marginTop:4}}>Citas, clientes y gastos eliminados.</div>
            <button onClick={()=>setResetStep(0)} style={{marginTop:10,padding:'8px 18px',background:'#2E7D52',color:'white',border:'none',borderRadius:8,fontFamily:'inherit',fontWeight:600,cursor:'pointer',fontSize:13}}>
              Entendido
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

function Dashboard({clients,appts,visibleAppts,expenses,setTab,userEmail,isAdmin,userName}) {
  const [selMonth, setSelMonth] = useState(()=>localDateStr().slice(0,7))
  const [finTab,   setFinTab]   = useState('general')
  const td = todayStr()
  const dispA = isAdmin ? appts : (visibleAppts||appts)
  const ta = [...dispA].filter(a=>cleanDate(a.date)===td).sort((a,b)=>cleanTime(a.time).localeCompare(cleanTime(b.time)))
  const safeA = Array.isArray(appts)?appts:[]
  const safeE = Array.isArray(expenses)?expenses:[]

  const allDone  = safeA.filter(a=>bool(a.completed))
  const allNoShow= safeA.filter(a=>a.completed==='noshow')
  const allPend  = safeA.filter(a=>!bool(a.completed)&&a.completed!=='noshow'&&!isPastAppt(a))
  const gRevDone = allDone.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const gRevPend = allPend.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const gRevAll  = safeA.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const gExp     = safeE.reduce((s,e)=>s+toN(e.amount||0),0)
  const gNeto    = gRevDone - gExp

  const months   = [...new Set([...safeA.map(a=>cleanDate(a.date).slice(0,7)),...safeE.map(e=>cleanDate(e.date).slice(0,7)),localDateStr().slice(0,7)].filter(Boolean))].sort((a,b)=>b.localeCompare(a))
  const mA       = safeA.filter(a=>cleanDate(a.date).slice(0,7)===selMonth)
  const mE       = safeE.filter(e=>cleanDate(e.date).slice(0,7)===selMonth)
  const mDone    = mA.filter(a=>bool(a.completed))
  const mPend    = mA.filter(a=>!bool(a.completed)&&a.completed!=='noshow'&&!isPastAppt(a))
  const mRevDone = mDone.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const mRevPend = mPend.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const mRevAll  = mA.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const mExp     = mE.reduce((s,e)=>s+toN(e.amount||0),0)
  const mNeto    = mRevDone - mExp

  const isMonth  = finTab==='month'
  const aRevDone = isMonth?mRevDone:gRevDone
  const aRevPend = isMonth?mRevPend:gRevPend
  const aRevAll  = isMonth?mRevAll:gRevAll
  const aExp     = isMonth?mExp:gExp
  const aNeto    = isMonth?mNeto:gNeto
  const aDone    = isMonth?mDone:allDone
  const aPend    = isMonth?mPend:allPend
  const aNoShow  = isMonth?mA.filter(a=>a.completed==='noshow'):allNoShow
  const aAll     = isMonth?mA:safeA
  const netoPos  = aNeto>=0

  return <>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <div style={{fontFamily:'Georgia,serif',fontSize:21,fontWeight:600,color:'var(--t)'}}>
        Bienvenida, {userName || (userEmail||'').split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} {'\u2728'}
      </div>
      <div style={{fontSize:11,color:'var(--t2)'}}>{new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
      <div className="stat" onClick={()=>setTab('clients')}>
        <NavIcon type="people" active={false}/>
        <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,marginTop:6}}>{clients.length}</div>
        <div style={{fontSize:11,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginTop:2}}>Clientes</div>
        <div style={{fontSize:10,color:'var(--primary)',marginTop:3,fontWeight:600}}>Ver todas {'\u2192'}</div>
      </div>
      <div className="stat" onClick={()=>setTab('appointments')}>
        <NavIcon type="cal" active={false}/>
        <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,marginTop:6}}>{ta.length}</div>
        <div style={{fontSize:11,color:'var(--t2)',textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600,marginTop:2}}>Citas hoy</div>
        <div style={{fontSize:10,color:'var(--primary)',marginTop:3,fontWeight:600}}>Ver citas {'\u2192'}</div>
      </div>
    </div>

    {isAdmin && <div className="card" style={{marginBottom:14,padding:0,overflow:'hidden'}}>
      <div style={{background:netoPos?'linear-gradient(135deg,var(--primary),var(--primary-d))':'linear-gradient(135deg,var(--red),#843030)',padding:'16px 18px',cursor:'pointer'}} onClick={()=>setTab('finances')}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.8)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.09em'}}>
            {isMonth?'Balance \u2014 '+new Date(selMonth+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'}):'Balance Neto'}
          </div>
          <span style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>Ver finanzas {'\u2192'}</span>
        </div>
        <div style={{fontFamily:'Georgia,serif',fontSize:30,fontWeight:700,color:'white'}}>{fmtM(aNeto)}</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',marginTop:4}}>
          Recibido {fmtM(aRevDone)} {'\u2212'} Gastos {fmtM(aExp)}
        </div>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg)'}}>
        {[['general','General'],['month','Por mes']].map(([v,l])=>(
          <button key={v} onClick={()=>setFinTab(v)}
            style={{flex:1,background:'none',border:'none',borderBottom:`2.5px solid ${finTab===v?'var(--primary)':'transparent'}`,padding:'9px 0',fontSize:12,fontWeight:finTab===v?700:500,color:finTab===v?'var(--primary)':'var(--t2)',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
            {l}
          </button>
        ))}
      </div>

      {isMonth&&(
        <div style={{padding:'10px 16px 0',background:'var(--card)'}}>
          <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
            style={{width:'100%',border:'1.5px solid var(--border)',borderRadius:8,padding:'7px 12px',fontSize:13,fontFamily:'inherit',color:'var(--t)',background:'var(--card)',outline:'none',cursor:'pointer'}}>
            {months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>)}
          </select>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,padding:'14px 16px'}}>
        <div style={{textAlign:'center',background:'#EDF7F0',borderRadius:12,padding:'11px 6px',cursor:'pointer'}} onClick={()=>setTab('income-detail', {month:isMonth?selMonth:undefined, from:'dashboard'})}>
          <div style={{fontSize:10,color:'var(--green)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Recibido</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'var(--green)'}}>{fmtM(aRevDone)}</div>
          <div style={{fontSize:10,color:'var(--green)',marginTop:2}}>{aDone.length} citas</div>
        </div>
        <div style={{textAlign:'center',background:'#FFF8E6',borderRadius:12,padding:'11px 6px',cursor:'pointer'}} onClick={()=>setTab('income-detail', {filter:'pending', month:isMonth?selMonth:undefined, from:'dashboard'})}>
          <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Pendiente</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'var(--gold)'}}>{fmtM(aRevPend)}</div>
          <div style={{fontSize:10,color:'var(--gold)',marginTop:2}}>{aPend.length} {'\u2192'}</div>
        </div>
        <div style={{textAlign:'center',background:'var(--primary-l)',borderRadius:12,padding:'11px 6px'}}>
          <div style={{fontSize:10,color:'var(--primary)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Proyectado</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'var(--primary)'}}>{fmtM(aRevAll)}</div>
          <div style={{fontSize:10,color:'var(--primary)',marginTop:2}}>{aAll.length} citas</div>
        </div>
      </div>

      {aRevAll>aRevDone&&(
        <div style={{padding:'0 16px 14px'}}>
          <div style={{fontSize:12,color:'var(--t2)',background:'var(--bg)',borderRadius:10,padding:'8px 12px',lineHeight:1.5}}>
            {'\uD83D\uDCA1'} Te faltan <strong style={{color:'var(--gold)'}}>{fmtM(aRevAll-aRevDone)}</strong> por cobrar {isMonth?'este mes':'en total'} {'\u00B7'} Marca como <strong>Completadas {'\u2713'}</strong>
          </div>
        </div>
      )}
    </div>}

    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <span style={{fontWeight:700,fontSize:15}}>{'\uD83C\uDF38'} Citas de Hoy</span>
        <button className="btn" style={{fontSize:12,padding:'7px 14px'}} onClick={()=>setTab('appointments')}>+ Nueva cita</button>
      </div>
      {ta.length===0
        ?<div style={{textAlign:'center',padding:'16px 0',color:'var(--t2)',fontSize:14}}>No hay citas para hoy</div>
        :ta.map(a=><div key={a.id} className="row">
            <div style={{background:'var(--primary-l)',borderRadius:10,padding:'7px 10px',fontWeight:700,color:'var(--primary)',fontSize:12,minWidth:58,textAlign:'center',flexShrink:0}}>{fmtTime(a.time)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.clientName}</div>
              <div style={{fontSize:12,color:'var(--t2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.serviceNames}</div>
            </div>
            {bool(a.completed)&&<span className="tag-g" style={{flexShrink:0,fontSize:11}}>{'\u2713'}</span>}
            <div style={{fontWeight:700,color:'var(--primary)',fontSize:14,flexShrink:0,marginLeft:4}}>{fmtM(a.totalPrice||a.servicePrice)}</div>
          </div>)
      }
    </div>
  </>
}

/* ══════════════════════════════════════════════════════════════
   MONTHLY INCOME STATE (Dashboard widget)
══════════════════════════════════════════════════════════════ */
function MonthlyIncomeState({appts,selMonth,setSelMonth,setTab}) {
  const safe   = Array.isArray(appts)?appts:[]
  const months = [...new Set([
    ...safe.map(a=>cleanDate(a.date).slice(0,7)),
    localDateStr().slice(0,7),
  ].filter(Boolean))].sort((a,b)=>b.localeCompare(a))

  const ma       = safe.filter(a=>cleanDate(a.date).slice(0,7)===selMonth)
  const done     = ma.filter(a=>bool(a.completed))
  const pend     = ma.filter(a=>!bool(a.completed)&&!isPastAppt(a))
  const revDone  = done.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revPend  = pend.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revTotal = ma.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const label    = new Date(selMonth+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})

  return (
    <div className="card" style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:14}}>
          {'\uD83D\uDCCA'} Estado de ingresos por mes
        </span>
        <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
          style={{border:'1.5px solid var(--border)',borderRadius:8,padding:'4px 10px',fontSize:12,fontFamily:'inherit',color:'var(--t)',background:'var(--card)',outline:'none',cursor:'pointer'}}>
          {months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'short',year:'numeric'})}</option>)}
        </select>
      </div>
      <div style={{fontSize:11,color:'var(--t2)',marginBottom:10}}>
        {label}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
        <div style={{textAlign:'center',background:'#EDF7F0',borderRadius:12,padding:'12px 8px',cursor:'pointer'}} onClick={()=>setTab('income-detail',{month:selMonth})}>
          <div style={{fontSize:10,color:'var(--green)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Recibido</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'var(--green)'}}>{fmtM(revDone)}</div>
          <div style={{fontSize:10,color:'var(--green)',marginTop:2}}>{done.length} citas {'\u2713'}</div>
        </div>
        <div style={{textAlign:'center',background:'#FFF8E6',borderRadius:12,padding:'12px 8px',cursor:'pointer'}} onClick={()=>setTab('income-detail',{filter:'pending',month:selMonth})}>
          <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Pendiente</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'var(--gold)'}}>{fmtM(revPend)}</div>
          <div style={{fontSize:10,color:'var(--gold)',marginTop:2}}>{pend.length} citas {'\u2192'}</div>
        </div>
        <div style={{textAlign:'center',background:'var(--primary-l)',borderRadius:12,padding:'12px 8px'}}>
          <div style={{fontSize:10,color:'var(--primary)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Proyectado</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'var(--primary)'}}>{fmtM(revTotal)}</div>
          <div style={{fontSize:10,color:'var(--primary)',marginTop:2}}>{ma.length} citas</div>
        </div>
      </div>
      {revTotal>revDone && (
        <div style={{fontSize:12,color:'var(--t2)',background:'var(--bg)',borderRadius:10,padding:'8px 12px',lineHeight:1.5}}>
          {'\uD83D\uDCA1'} Has recibido <strong>{fmtM(revDone)}</strong> de <strong>{fmtM(revTotal)}</strong> proyectados. Te faltan <strong style={{color:'var(--gold)'}}>{fmtM(revTotal-revDone)}</strong>.
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MONTHLY BALANCE CARD (Dashboard widget)
══════════════════════════════════════════════════════════════ */
function MonthlyBalance({appts,expenses,selMonth,setSelMonth,setTab}) {
  const safeA = Array.isArray(appts)?appts:[]
  const safeE = Array.isArray(expenses)?expenses:[]

  // Build list of months that have data
  const months = [...new Set([
    ...safeA.map(a=>cleanDate(a.date).slice(0,7)),
    ...safeE.map(e=>cleanDate(e.date).slice(0,7)),
    localDateStr().slice(0,7),
  ].filter(Boolean))].sort((a,b)=>b.localeCompare(a))

  const ma = safeA.filter(a=>cleanDate(a.date).slice(0,7)===selMonth)
  const me = safeE.filter(e=>cleanDate(e.date).slice(0,7)===selMonth)

  const revDone  = ma.filter(a=>bool(a.completed)).reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revPend  = ma.filter(a=>!bool(a.completed)&&!isPastAppt(a)).reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revTotal = ma.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const gastos   = me.reduce((s,e)=>s+toN(e.amount||0),0)
  const neto     = revDone - gastos
  const netoPos  = neto >= 0

  const monthLabel = months.includes(selMonth)
    ? new Date(selMonth+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})
    : selMonth

  return (
    <div className="card" style={{marginBottom:14,background:'linear-gradient(160deg,#FBF0EE,#FAF5F0)',border:'1.5px solid var(--border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:14,color:'var(--t)'}}>📅 Balance por mes</span>
        <select value={selMonth} onChange={e=>setSelMonth(e.target.value)}
          style={{border:'1.5px solid var(--border)',borderRadius:8,padding:'4px 10px',fontSize:12,fontFamily:'inherit',color:'var(--t)',background:'var(--card)',outline:'none',cursor:'pointer'}}>
          {months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'short',year:'numeric'})}</option>)}
        </select>
      </div>

      {/* Net headline */}
      <div style={{background:netoPos?'linear-gradient(135deg,var(--green),#3d7a55)':'linear-gradient(135deg,var(--red),#a04040)',borderRadius:12,padding:'12px 16px',marginBottom:12,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:10,opacity:.8,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600}}>Neto {monthLabel}</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,marginTop:2}}>{fmtM(neto)}</div>
        </div>
        <div style={{fontSize:28,opacity:.85}}>{netoPos?'💚':'📉'}</div>
      </div>

      {/* 3 pills */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        <div style={{background:'#EDF7F0',borderRadius:10,padding:'10px 8px',textAlign:'center',cursor:'pointer'}} onClick={()=>setTab('income-detail',{month:selMonth})}>
          <div style={{fontSize:10,color:'var(--green)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Recibido</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'var(--green)'}}>{fmtM(revDone)}</div>
          <div style={{fontSize:10,color:'var(--green)',marginTop:1}}>{ma.filter(a=>bool(a.completed)).length} citas</div>
        </div>
        <div style={{background:'#FFF8E6',borderRadius:10,padding:'10px 8px',textAlign:'center',cursor:'pointer'}} onClick={()=>setTab('income-detail',{filter:'pending',month:selMonth})}>
          <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Pendiente</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'var(--gold)'}}>{fmtM(revPend)}</div>
          <div style={{fontSize:10,color:'var(--gold)',marginTop:1}}>{ma.filter(a=>!bool(a.completed)&&!isPastAppt(a)).length} citas</div>
        </div>
        <div style={{background:'var(--primary-l)',borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
          <div style={{fontSize:10,color:'var(--primary)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Proyectado</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:'var(--primary)'}}>{fmtM(revTotal)}</div>
          <div style={{fontSize:10,color:'var(--primary)',marginTop:1}}>{ma.length} citas</div>
        </div>
      </div>

      {gastos>0 && (
        <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'var(--t2)',paddingTop:10,borderTop:'1px solid var(--border)'}}>
          <span>Gastos del mes</span>
          <span style={{fontWeight:700,color:'var(--red)',cursor:'pointer'}} onClick={()=>setTab('expense-detail',{month:selMonth})}>{fmtM(gastos)} Ver →</span>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   APPOINTMENTS TAB — Fixed accordion (independent toggle)
══════════════════════════════════════════════════════════════ */
function ApptsTab({clients,services,appts,visibleAppts,SA,SC,sync,deleteAppt,confirm,infoModal,userEmail,isAdmin,userName,users,userNameMap,tabExtra,setTab}) {
  const [showNew,  setNew]  = useState(false)
  const [editAppt, setEdit] = useState(null)
  // Only "today" open by default — each group toggles independently
  const [open, setOpen] = useState({today:true, tomorrow:false, upcoming:false, noshow:false, past:false})
  const td = todayStr(), tm = tomorrowStr()
  const dispAppts = isAdmin ? appts : (visibleAppts||appts)

  const toggle = k => setOpen(p => ({...p, [k]: !p[k]}))

  // Groups — past includes today-past
  const groups = {
    today:    dispAppts.filter(a=>cleanDate(a.date)===td && !isPastAppt(a)),
    tomorrow: dispAppts.filter(a=>cleanDate(a.date)===tm),
    upcoming: dispAppts.filter(a=>{ const d=cleanDate(a.date); return d>tm }),
    past:     dispAppts.filter(a=>isPastAppt(a)&&a.completed!=='noshow'),
    noshow:   dispAppts.filter(a=>a.completed==='noshow')
  }

  const sortG = arr => [...arr].sort((a,b)=>`${cleanDate(a.date)}${cleanTime(a.time)}`.localeCompare(`${cleanDate(b.date)}${cleanTime(b.time)}`))

  const toggleCompleted = (a, newStatus) => {
    // cycle: pending -> done -> pending; noshow is a separate button
    const cur = a.completed==='noshow'?'noshow': bool(a.completed)?'done':'pending'
    let next_val
    if (newStatus==='done')   next_val = cur==='done'   ? false : true
    if (newStatus==='noshow') next_val = cur==='noshow' ? false : 'noshow'
    const next = appts.map(x=>x.id===a.id?{...x,completed:next_val}:x)
    SA(next)
  }

  if (showNew)  return <NewWizard  clients={clients} services={services} appts={appts} SA={SA} SC={SC} sync={sync} infoModal={infoModal} onClose={()=>setNew(false)} userEmail={userEmail} isAdmin={isAdmin} userName={userName} users={users} userNameMap={userNameMap}/>
  if (editAppt) return <EditAppt   appt={editAppt} services={services} appts={appts} SA={SA} sync={sync} onClose={()=>setEdit(null)} isAdmin={isAdmin} userEmail={userEmail} users={users} userNameMap={userNameMap}/>

  const AccGroup = ({label,color,gKey,items,canEdit=true,uMap=userNameMap}) => {
    if (items.length===0) return null
    const sum     = items.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
    const doneSum = items.filter(a=>bool(a.completed)&&a.completed!=='noshow').reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
    const isOpen  = open[gKey]
    return (
      <div style={{border:`1.5px solid ${color}28`,borderRadius:16,marginBottom:10,overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',cursor:'pointer',background:`${color}0E`,userSelect:'none'}} onClick={()=>toggle(gKey)}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:color,flexShrink:0}}/>
            <span style={{fontWeight:700,fontSize:14,color:'var(--t)'}}>{label}</span>
            <span style={{background:`${color}22`,color,borderRadius:20,padding:'2px 8px',fontSize:12,fontWeight:700}}>{items.length}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:13,fontWeight:700,color}}>{fmtM(doneSum>0?doneSum:sum)}</span>
            <span style={{color:'var(--t2)',fontSize:14,transition:'transform .2s',display:'inline-block',transform:isOpen?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
          </div>
        </div>
        {isOpen && (
          <div className="slide-in" style={{padding:'4px 12px 12px'}}>
            {sortG(items).map(a=>(
              <ApptCard key={a.id} appt={a} canEdit={canEdit} userNameMap={uMap}
                onToggle={(s)=>toggleCompleted(a,s)}
                onEdit={()=>setEdit(a)}
                onDelete={()=>confirm(`¿Eliminar la cita de ${a.clientName}? También se borrará el evento de Google Calendar.`,()=>deleteAppt(a))}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return <>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        {tabExtra?.from==='reports' && <button className="btn-sm" onClick={()=>setTab('reports')}>← Reportes</button>}
        <span style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:'var(--t)'}}>Citas</span>
      </div>
      <button className="btn" onClick={()=>setNew(true)}>+ Nueva cita</button>
    </div>
    <AccGroup label="Hoy"         color="#B5524A" gKey="today"    items={groups.today}    canEdit={true}/>
    <AccGroup label="Mañana"      color="#B8742A" gKey="tomorrow" items={groups.tomorrow} canEdit={true}/>
    <AccGroup label="Próximas"    color="#2E6EA6" gKey="upcoming" items={groups.upcoming} canEdit={true}/>
    <AccGroup label="No asistió"  color="#B03030" gKey="noshow"   items={groups.noshow}   canEdit={false}/>
    <AccGroup label="Pasadas"     color="#888888" gKey="past"     items={groups.past}     canEdit={false}/>
    {appts.length===0 && (
      <div className="card" style={{textAlign:'center',padding:30,color:'var(--t2)'}}>
        No hay citas {BIZ_EMOJI}<br/><br/>
        <button className="btn" onClick={()=>setNew(true)}>+ Nueva cita</button>
      </div>
    )}
  </>
}

function ApptCard({appt,canEdit,onToggle,onEdit,onDelete,userNameMap={}}) {
  const calOk  = bool(appt.calendarCreated)
  const dom    = bool(appt.domicilio)
  const status = appt.completed==='noshow' ? 'noshow' : bool(appt.completed) ? 'done' : 'pending'
  const past   = isPastAppt(appt)
  const bgMap  = {done:'var(--card)', noshow:'var(--card)', pending:'var(--card)'}
  const brdMap = {done:'var(--green)', noshow:'var(--red)', pending: 'var(--border)'}
  const resolvedCreatedBy = appt.createdBy
    ? (userNameMap[String(appt.createdBy).trim().toLowerCase()] || String(appt.createdBy).split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))
    : null
  const resolvedAtendida = appt.assignedTo
    ? (userNameMap[String(appt.assignedTo).trim().toLowerCase()] || String(appt.assignedTo).split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))
    : null
  return (
    <div style={{background:bgMap[status],borderRadius:12,border:`1.5px solid ${brdMap[status]}`,borderLeft:`4px solid ${brdMap[status]}`,padding:14,marginTop:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:1,color:'var(--t)'}}>{appt.clientName}</div>
          <div style={{fontSize:12,color:'var(--t2)'}}>📱 {appt.clientPhone}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:700,color:status==='done'?'var(--green)':status==='noshow'?'var(--red)':'var(--primary)',fontSize:14}}>
            {status==='noshow' ? <span style={{textDecoration:'line-through',opacity:.6}}>{fmtM(appt.totalPrice||appt.servicePrice)}</span> : fmtM(appt.totalPrice||appt.servicePrice)}
          </div>
          {dom && <div style={{fontSize:11,color:'var(--gold)'}}>🛵 +{fmtM(appt.domicilioPrice)}</div>}
          <div style={{fontSize:10,color:calOk?'var(--green)':'var(--t2)',marginTop:1}}>{calOk?'📅 Cal':'📅 —'}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
        <span className="tag" style={{fontSize:11}}>✨ {appt.serviceNames}</span>
        <span className="tag" style={{fontSize:11}}>📅 {fmtDate(appt.date)}</span>
        <span className="tag" style={{fontSize:11}}>🕐 {fmtTime(appt.time)}</span>
        {dom && <span className="tag-gold" style={{fontSize:11}}>🛵 Domicilio</span>}
        {status==='done'   && <span className="tag-g"    style={{fontSize:11}}>✓ Completada</span>}
        {status==='noshow' && <span style={{display:'inline-block',background:'var(--primary-l)',color:'var(--red)',borderRadius:20,padding:'2px 10px',fontSize:12,fontWeight:600}}>✗ No asistió</span>}
        {status==='pending'&& past && <span className="tag-past" style={{fontSize:11}}>● Pasada</span>}
      </div>
      {/* Creada por / Atendida por */}
      {(resolvedCreatedBy || resolvedAtendida) && (
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:8,padding:'6px 10px',background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)'}}>
          {resolvedCreatedBy && <span style={{fontSize:11,color:'var(--t2)'}}>✏️ <strong style={{color:'var(--t)'}}>Creada por:</strong> {resolvedCreatedBy}</span>}
          {resolvedAtendida  && <span style={{fontSize:11,color:'var(--t2)'}}>👩‍💼 <strong style={{color:'var(--t)'}}>Atendida por:</strong> {resolvedAtendida}</span>}
        </div>
      )}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        <button className={`btn-check${status==='done'?' done':''}`} onClick={()=>onToggle('done')}
          style={status==='done'?{}:{opacity: status==='noshow'?.5:1}}>
          {status==='done'?'✓ Completada':'✓ Completada'}
        </button>
        <button onClick={()=>onToggle('noshow')}
          style={{background:status==='noshow'?'var(--red)':'var(--primary-l)',color:status==='noshow'?'white':'var(--red)',border:`1.5px solid ${status==='noshow'?'var(--red)':'var(--border)'}`,borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all .15s',opacity: status==='done'?.5:1}}>
          ✗ No asistió
        </button>
        {status==='pending' && <button className="btn-wa" onClick={()=>openWA(appt.clientPhone,appt.clientName,appt.time,appt.date,appt.serviceNames,appt.totalPrice||appt.servicePrice,dom,resolvedAtendida)}>💬 Recordatorio</button>}
        {canEdit && status==='pending' && <button className="btn-edit" onClick={onEdit}>✏️ Editar</button>}
        {status==='pending' && <button className="btn-del" onClick={onDelete}>🗑️ Eliminar</button>}
      </div>
    </div>
  )
}

/* ── Edit Appointment — date, time AND services ── */
function EditAppt({appt,services,appts,SA,sync,onClose,isAdmin,userEmail,users,userNameMap}) {
  const safeSvcs = Array.isArray(services)?services:[]

  // Build originalIds + original price map from appt data
  const resolveInitialIds = () => {
    const ids = String(appt.serviceIds||'').split(',').map(s=>s.trim()).filter(Boolean)
    if (ids.length) {
      const validById = ids.filter(id=>safeSvcs.some(s=>s.id===id))
      if (validById.length) return validById
      const names = String(appt.serviceNames||'').split(',').map(s=>s.trim()).filter(Boolean)
      return safeSvcs.filter(s=>names.includes(s.name)).map(s=>s.id)
    }
    const names = String(appt.serviceNames||'').split(',').map(s=>s.trim()).filter(Boolean)
    return safeSvcs.filter(s=>names.includes(s.name)).map(s=>s.id)
  }

  const originalIds  = resolveInitialIds()
  // Per-service original price: original servicePrice split evenly among original services
  // (or use current price if we can't derive it — only for NEWLY added services)
  const origCount    = originalIds.length || 1
  const origSvcTotal = toN(appt.servicePrice) || toN(appt.totalPrice) - toN(appt.domicilioPrice)
  const pricePerSvc  = origCount > 0 ? origSvcTotal / origCount : 0
  // Map of svcId -> price to use: original price for original services, current price for new ones
  const getPriceFor  = id => {
    if (originalIds.includes(id)) return pricePerSvc  // keep original
    const svc = safeSvcs.find(s=>s.id===id)
    return svc ? toN(svc.price) : 0  // new service → use current price
  }

  const [date,    setDate]  = useState(cleanDate(appt.date)||todayStr())
  const [time,    setTime]  = useState(cleanTime(appt.time)||'')
  const [svcIds,  setSvcIds]= useState(originalIds)
  const [dom,     setDom]   = useState(bool(appt.domicilio))
  const [domP,    setDomP]  = useState(toN(appt.domicilioPrice)||10000)
  const [addr,    setAddr]  = useState(appt.address||'')
  const [loading, setL]     = useState(false)
  const [result,  setR]     = useState(null)
  const [assignedTo, setAssignedTo] = useState(appt.assignedTo||'')

  const slots    = getSlots(date, [], appts, appt.id, isAdmin ? assignedTo : null)
  const toggleSvc= id => setSvcIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  const selSvcs  = safeSvcs.filter(s=>svcIds.includes(s.id))
  // Price: original price for pre-existing services, current price for newly added
  const svcTotal = svcIds.reduce((s,id)=>s+getPriceFor(id),0)
  const grand    = svcTotal+(dom?toN(domP):0)

  // Conflicto: ¿la empleada asignada ya tiene cita en esa fecha y hora?
  const conflict = isAdmin && assignedTo && date && time
    ? (Array.isArray(appts)?appts:[]).find(a =>
        a.id !== appt.id &&
        String(a.assignedTo||'').trim().toLowerCase() === String(assignedTo).trim().toLowerCase() &&
        cleanDate(a.date) === cleanDate(date) &&
        cleanTime(a.time) === cleanTime(time)
      )
    : null
  const conflictName = conflict
    ? ((userNameMap||{})[String(assignedTo).trim().toLowerCase()] || String(assignedTo).split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))
    : ''

  const save = async () => {
    setL(true)
    const svcNames = selSvcs.map(s=>s.name).join(', ')
    const updated  = {
      ...appt, date, time:cleanTime(time)||time,
      serviceIds:selSvcs.map(s=>s.id).join(','), serviceNames:svcNames,
      servicePrice:svcTotal, domicilio:dom, domicilioPrice:dom?toN(domP):0,
      totalPrice:grand, address:dom?addr:'',
      assignedTo: isAdmin ? assignedTo : (appt.assignedTo||userEmail||'')
    }

    const assigneeChanged = isAdmin && appt.assignedTo && assignedTo &&
      String(appt.assignedTo).trim().toLowerCase() !== String(assignedTo).trim().toLowerCase()

    const next = appts.map(a=>a.id===appt.id?updated:a)
    await sync({appointments:next},null,null)
    SA(next)

    if (bool(appt.calendarCreated)) {
      try {
        if (assigneeChanged) {
          // Empleada cambió → borrar evento viejo, crear nuevo para la nueva empleada
          if (appt.calendarEventId) saveData({action:'deleteCalendarEvent',eventId:appt.calendarEventId}).catch(()=>{})
          if (appt.adminEventId)    saveData({action:'deleteCalendarEvent',eventId:appt.adminEventId}).catch(()=>{})
          // Crear nuevos eventos
          const calEvt = {date,time,serviceNames:svcNames,clientName:appt.clientName,clientPhone:appt.clientPhone,totalPrice:grand,domicilio:dom,domicilioPrice:dom?toN(domP):0,address:dom?addr:'',assignedTo}
          const r = await sync({appointments:next, calendarEvent:calEvt},null,null)
          if (r?.calResult?.ok) {
            const final = next.map(a=>a.id===appt.id?{...a,calendarEventId:r.calResult.eventId||'',adminEventId:r.calResult.adminEventId||''}:a)
            SA(final)
          }
          setR(r?.calResult||null)
        } else if (appt.calendarEventId) {
          // Misma empleada → actualizar evento
          const r = await saveData({
            action:'updateCalendarEvent',
            eventId:appt.calendarEventId,
            adminEventId:appt.adminEventId||'',
            calendarEvent:{date,time,serviceNames:svcNames,clientName:appt.clientName,clientPhone:appt.clientPhone,totalPrice:grand,domicilio:dom,domicilioPrice:dom?toN(domP):0,assignedTo}
          }).catch(e=>({calResult:{ok:false,error:e.message}}))
          setR(r?.calResult||null)
        }
      } catch(e) { setR({ok:false,error:e.message}) }
    } else setR({ok:null})
    setL(false)
  }

  return <div>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
      <button className="btn-sm" onClick={onClose}>← Volver</button>
      <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Editar Cita</span>
    </div>

    {/* Client summary */}
    <div style={{background:'var(--primary-l)',borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:15}}>{appt.clientName}</div>
      <div style={{fontSize:13,color:'var(--t2)',marginTop:2}}>📱 {appt.clientPhone}</div>
    </div>

    <div className="card">
      {/* Services */}
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>✨ Servicios</div>
      {safeSvcs.map(s=>(
        <button key={s.id} className={`so${svcIds.includes(s.id)?' sel':''}`} onClick={()=>toggleSvc(s.id)}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${svcIds.includes(s.id)?'var(--primary)':'#ccc'}`,background:svcIds.includes(s.id)?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {svcIds.includes(s.id)&&<span style={{color:'white',fontSize:11}}>✓</span>}
            </div>
            <span style={{fontWeight:600,fontSize:14}}>{s.name}</span>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <span style={{fontWeight:700,color:'var(--primary)',fontSize:14}}>{fmtM(getPriceFor(s.id))}</span>
            {originalIds.includes(s.id) && toN(s.price)!==getPriceFor(s.id) &&
              <div style={{fontSize:10,color:'var(--t2)',textDecoration:'line-through'}}>{fmtM(s.price)} actual</div>}
          </div>
        </button>
      ))}
      {/* Deleted services: show as disabled if they were in the original appointment */}
      {(() => {
        const deletedNames = String(appt.serviceNames||'').split(',').map(s=>s.trim()).filter(n=>n&&!safeSvcs.some(s=>s.name===n))
        return deletedNames.length>0 ? (
          <div style={{background:'#FBF0F3',borderRadius:10,padding:'10px 14px',marginBottom:8,fontSize:13,color:'var(--t2)'}}>
            <span style={{fontWeight:600}}>Servicios eliminados del catálogo:</span> {deletedNames.join(', ')} — solo aparecen en el historial, no se pueden re-seleccionar.
          </div>
        ) : null
      })()}

      {/* Domicilio */}
      <div style={{marginTop:4,background:'#FFFAF0',border:'1.5px solid #F0D898',borderRadius:12,padding:12,marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontWeight:700,fontSize:14}}>🛵 Domicilio</div>
          <button onClick={()=>setDom(!dom)} style={{background:dom?'var(--primary)':'white',color:dom?'white':'var(--primary)',border:'1.5px solid var(--primary)',borderRadius:20,padding:'5px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{dom?'Sí ✓':'No'}</button>
        </div>
        {dom && <div style={{marginTop:10}}>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            {[10000,20000].map(v=><button key={v} onClick={()=>setDomP(v)} style={{flex:1,background:domP===v?'var(--primary)':'white',color:domP===v?'white':'var(--primary)',border:'1.5px solid var(--primary)',borderRadius:10,padding:'8px 4px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{fmtM(v)}</button>)}
            <input className="inp" type="number" placeholder="Otro" style={{flex:1,padding:'8px 10px',fontSize:13}} value={![10000,20000].includes(domP)?domP:''} onChange={e=>setDomP(Number(e.target.value)||0)}/>
          </div>
          <input className="inp" placeholder="Dirección" value={addr} onChange={e=>setAddr(e.target.value)}/>
        </div>}
      </div>

      {/* Total preview */}
      {svcIds.length>0 && <div style={{background:'var(--primary-l)',borderRadius:10,padding:10,fontSize:14,marginBottom:14}}>
        {svcIds.map(id=>{ const s=safeSvcs.find(x=>x.id===id); if(!s)return null; const p=getPriceFor(id); return <div key={id} style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:'var(--t2)'}}>{s.name}{originalIds.includes(id)&&toN(s.price)!==p?<span style={{fontSize:10,color:'var(--t2)',marginLeft:4}}>(precio original)</span>:''}</span><span style={{fontWeight:600}}>{fmtM(p)}</span></div> })}
        {dom&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}><span style={{color:'var(--t2)'}}>Domicilio</span><span style={{fontWeight:600}}>{fmtM(domP)}</span></div>}
        <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',paddingTop:5,marginTop:4}}><span style={{fontWeight:700}}>Total</span><span style={{fontWeight:700,color:'var(--primary)',fontSize:16}}>{fmtM(grand)}</span></div>
      </div>}

      {/* Date */}
      <label className="lbl">Fecha</label>
      <input type="date" className="inp" value={date} min={todayStr()} onChange={e=>{setDate(e.target.value);setTime('')}} style={{marginBottom:14}}/>

      {/* Time */}
      <label className="lbl">Hora</label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
        {slots.map(({time:t,disabled,reason})=>{
          const t2=cleanTime(t), isSel=cleanTime(time)===t2
          return <button key={t} className={`to${isSel?' sel':''}`} disabled={disabled} title={disabled?reason:''} onClick={()=>!disabled&&setTime(t)}>
            {fmtTime(t)}
          </button>
        })}
      </div>
      {time && <div style={{background:'var(--primary-l)',borderRadius:10,padding:10,fontSize:13,marginBottom:14}}>✅ <strong>{fmtTime(time)}</strong> — {fmtDate(date)}</div>}

      {/* Atendida por */}
      <div style={{marginBottom:14}}>
        <label className="lbl">👩‍💼 Atendida por</label>
        {isAdmin ? (
          <select className="inp" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} style={{fontSize:13}}>
            {(users||[]).filter(u=>u.email).map(u=>(
              <option key={u.email} value={u.email}>
                {u.name || u.email.split('@')[0]} — {u.email}
              </option>
            ))}
            {/* Si el assignedTo actual no está en users, mostrarlo igual */}
            {assignedTo && !(users||[]).some(u=>u.email===assignedTo) && (
              <option value={assignedTo}>{assignedTo}</option>
            )}
          </select>
        ) : (
          <input className="inp" value={
            (userNameMap||{})[String(userEmail||'').trim().toLowerCase()] || userEmail || ''
          } disabled style={{fontSize:13,background:'#f5f5f5',color:'var(--t2)',cursor:'not-allowed'}}/>
        )}
      </div>


      {/* Aviso de conflicto de horario */}
      {conflict && (
        <div style={{background:'#FFF8E1',border:'1.5px solid #F6C90E',borderRadius:12,padding:'12px 14px',marginBottom:14,display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
          <div style={{fontSize:13,color:'#7A5C00',lineHeight:1.5}}>
            <strong>Conflicto de horario:</strong> el día <strong>{fmtDate(date)}</strong> a las <strong>{fmtTime(time)}</strong>, <strong>{conflictName}</strong> ya tiene una cita con <strong>{conflict.clientName}</strong>.
          </div>
        </div>
      )}

      {result!==null && <div style={{background:result.ok||result.ok===null?'#EDF7F0':'var(--warn-bg)',borderRadius:10,padding:10,fontSize:13,marginBottom:14,color:result.ok||result.ok===null?'var(--green)':'var(--warn-t)'}}>
        {result.ok===null?'✅ Cita actualizada':result.ok?'✅ Cita y Calendar actualizados':`✅ Cita guardada. Calendar: ${result.error}`}
      </div>}

      {result!==null
        ? <button className="btn" style={{width:'100%'}} onClick={onClose}>Listo</button>
        : <div style={{display:'flex',gap:8}}>
            <button className="btn-o" onClick={onClose}>Cancelar</button>
            <button className="btn" style={{flex:1}} onClick={save} disabled={!time||svcIds.length===0||loading||!!conflict}>{loading?'⏳ Guardando…':'Guardar cambios'}</button>
          </div>
      }
    </div>
  </div>
}

/* ══════════════════════════════════════════════════════════════
   NEW APPOINTMENT WIZARD
══════════════════════════════════════════════════════════════ */
function NewWizard({clients,services,appts,SA,SC,sync,infoModal,onClose,userEmail,isAdmin,userName,users,userNameMap}) {
  const [step,    setStep]  = useState(1)
  const [query,   setQ]     = useState('')
  const [suggs,   setSuggs] = useState([])
  const [fc,      setFc]    = useState(null)
  const [createM, setCM]    = useState(false)
  const [newName, setNN]    = useState('')
  const [newPhone,setNP]    = useState('')
  const [svcIds,  setSvcIds]= useState([])
  const [dom,     setDom]   = useState(false)
  const [domP,    setDomP]  = useState(10000)
  const [addr,    setAddr]  = useState('')
  const [date,    setDate]  = useState(todayStr())
  const [time,    setTime]  = useState('')
  const [loading, setL]     = useState(false)
  const [calR,    setCalR]  = useState(null)
  const [done,    setDone]  = useState(false)
  const [assignedTo, setAssignedTo] = useState(userEmail||'')

  const isPhoneQ = q => /^\d+$/.test(q.replace(/[^0-9]/g,''))

  const search = () => {
    const q = query.trim(); if (!q) return
    let found = []
    if (isPhoneQ(q)) {
      const clean = q.replace(/\D/g,'')
      found = clients.filter(c=>(c.phone||'').replace(/\D/g,'').includes(clean))
    } else {
      found = clients.filter(c=>(c.name||'').toLowerCase().includes(q.toLowerCase()))
    }
    if (found.length===0) {
      setCM(true)
      if (isPhoneQ(q)) setNP(q.replace(/\D/g,'').slice(0,10))
      else setNN(q)
      setSuggs([]); setStep(2)
    } else if (found.length===1) {
      setFc(found[0]); setCM(false); setSuggs([]); setStep(3)
    } else {
      setSuggs(found); setCM(false); setStep(2)
    }
  }

  const phoneValid = p => p.replace(/\D/g,'').length>=10
  const nameValid  = n => n.trim().length>=3

  const confirmClient = () => {
    const clean = newPhone.replace(/\D/g,'')
    const dup   = clients.find(c=>(c.phone||'').replace(/\D/g,'')===clean)
    if (dup) {
      infoModal(`Ya existe la clienta "${dup.name}" con el número ${newPhone}. No se puede duplicar.`)
      return
    }
    if (createM && nameValid(newName) && phoneValid(newPhone)) {
      const nc = {id:uid(),name:(newName||'').trim().toUpperCase(),phone:newPhone.trim(),createdAt:todayStr()}
      SC([...clients,nc]); setFc(nc)
    }
    setStep(3)
  }

  const toggleSvc = id => setSvcIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])
  const selSvcs   = (Array.isArray(services)?services:[]).filter(s=>svcIds.includes(s.id))
  const svcTotal  = selSvcs.reduce((s,x)=>s+toN(x.price),0)
  const grand     = svcTotal+(dom?toN(domP):0)
  const slots     = getSlots(date,[],appts,null, isAdmin ? assignedTo : null)

  // Conflicto: ¿la empleada asignada ya tiene cita en esa fecha y hora?
  const conflictNW = isAdmin && assignedTo && date && time
    ? (Array.isArray(appts)?appts:[]).find(a =>
        String(a.assignedTo||'').trim().toLowerCase() === String(assignedTo).trim().toLowerCase() &&
        cleanDate(a.date) === cleanDate(date) &&
        cleanTime(a.time) === cleanTime(time)
      )
    : null
  const conflictNWName = conflictNW
    ? ((userNameMap||{})[String(assignedTo).trim().toLowerCase()] || String(assignedTo).split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))
    : ''

  const confirm = async () => {
    setL(true)
    const svcNames = selSvcs.map(s=>s.name).join(', ')
    const appt = {
      id:uid(), clientId:fc.id||'', clientName:fc.name, clientPhone:fc.phone,
      serviceIds:selSvcs.map(s=>s.id).join(','), serviceNames:svcNames,
      servicePrice:svcTotal, domicilio:dom, domicilioPrice:dom?toN(domP):0,
      totalPrice:grand, address:dom?addr:'',
      date, time:cleanTime(time)||time,
      createdAt:new Date().toISOString(), calendarCreated:false, calendarEventId:'', completed:false,
      assignedTo: assignedTo||userEmail||'', createdBy: userEmail||''
    }
    const res = await sync({
      appointments:[...appts,appt],
      calendarEvent:{clientName:fc.name,clientPhone:fc.phone,serviceNames:svcNames,totalPrice:grand,domicilio:dom,domicilioPrice:dom?toN(domP):0,address:addr,date,time,assignedTo:assignedTo||userEmail||''}
    },null,null)
    if (res?.calResult?.ok) {
      appt.calendarCreated  = true
      appt.calendarEventId  = res.calResult.eventId||''
      appt.adminEventId     = res.calResult.adminEventId||''
    }
    SA([...appts,appt]); setCalR(res?.calResult||null); setL(false); setDone(true)
  }

  const Dots = () => <div style={{display:'flex',alignItems:'center',marginBottom:22,gap:4}}>
    {[1,2,3,4].map((s,i)=><div key={s} style={{display:'contents'}}>
      <div style={{width:27,height:27,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0,transition:'background .2s',background:step>s?'var(--primary)':step===s?'var(--primary)':'var(--border)',color:step>=s?'white':'var(--t2)'}}>{step>s?'✓':s}</div>
      {i<3&&<div style={{flex:1,height:2,transition:'background .3s',background:step>s?'var(--primary)':'var(--border)'}}/>}
    </div>)}
  </div>

  return <div>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
      <button className="btn-sm" onClick={onClose}>← Volver</button>
      <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Nueva Cita</span>
    </div>
    {!done&&!loading&&<Dots/>}

    {/* S1 — Buscar */}
    {step===1 && <div className="card">
      <div style={{fontFamily:'Georgia,serif',fontSize:18,marginBottom:14}}>Buscar cliente</div>
      <label className="lbl">Nombre o número de celular</label>
      <input className="inp" placeholder="Ej: Laura o 3001234567" value={query}
        onChange={e=>{setQ(e.target.value);setSuggs([])}}
        onKeyDown={e=>e.key==='Enter'&&query.trim()&&search()}
        style={{marginBottom:14}}/>
      <button className="btn" style={{width:'100%'}} onClick={search} disabled={!query.trim()}>Buscar cliente</button>
    </div>}

    {/* S2 — Multiple results */}
    {step===2 && suggs.length>0 && <div className="card">
      <div style={{fontFamily:'Georgia,serif',fontSize:18,marginBottom:14}}>Seleccionar cliente</div>
      <div style={{fontSize:13,color:'var(--t2)',marginBottom:12}}>Varios resultados para "<strong>{query}</strong>":</div>
      <div style={{borderRadius:12,border:'1px solid var(--border)',overflow:'hidden',marginBottom:14}}>
        {suggs.map(c=>{
          const n=appts.filter(a=>(a.clientPhone||'').replace(/\D/g,'')===(c.phone||'').replace(/\D/g,'')).length
          return <div key={c.id} className="sugg-item" onClick={()=>{setFc(c);setSuggs([]);setStep(3)}}>
            <div style={{fontWeight:600}}>{c.name}</div>
            <div style={{fontSize:12,color:'var(--t2)'}}>📱 {c.phone} · {n} cita{n!==1?'s':''}</div>
          </div>
        })}
      </div>
      <button className="btn-o" style={{width:'100%'}} onClick={()=>setStep(1)}>← Buscar de nuevo</button>
    </div>}

    {/* S2b — Create client */}
    {step===2 && createM && <div className="card">
      <div style={{fontFamily:'Georgia,serif',fontSize:18,marginBottom:6}}>Cliente no encontrada</div>
      <div style={{fontSize:13,color:'var(--t2)',marginBottom:14}}>Registra a esta clienta para continuar</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div>
          <label className="lbl">Nombre (mín. 3 caracteres)</label>
          <input className="inp" placeholder="Nombre completo" value={newName} onChange={e=>setNN(e.target.value)}
            style={{borderColor:newName&&!nameValid(newName)?'var(--red)':'var(--border)'}}/>
          {newName&&!nameValid(newName)&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>Mínimo 3 caracteres</div>}
        </div>
        <div>
          <label className="lbl">Celular (10 dígitos)</label>
          <input className="inp" type="tel" placeholder="3001234567" value={newPhone}
            onChange={e=>setNP(e.target.value.replace(/\D/g,'').slice(0,10))}
            style={{borderColor:newPhone&&!phoneValid(newPhone)?'var(--red)':'var(--border)'}}/>
          {newPhone&&!phoneValid(newPhone)&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>Mínimo 10 dígitos</div>}
        </div>
      </div>
      <button className="btn" style={{width:'100%'}} onClick={confirmClient} disabled={!nameValid(newName)||!phoneValid(newPhone)}>Crear y continuar</button>
      <button className="btn-o" style={{width:'100%',marginTop:8}} onClick={()=>{setStep(1);setCM(false)}}>Volver a buscar</button>
    </div>}

    {/* S3 — Services (with client name visible) */}
    {step===3 && <div className="card">
      {/* Client banner */}
      <div style={{background:'var(--primary-l)',borderRadius:10,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:34,height:34,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:15,flexShrink:0}}>
          {String(fc?.name||'?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>{fc?.name}</div>
          <div style={{fontSize:12,color:'var(--t2)'}}>📱 {fc?.phone}</div>
        </div>
      </div>

      <div style={{fontFamily:'Georgia,serif',fontSize:16,marginBottom:4}}>Seleccionar servicios</div>
      <div style={{fontSize:12,color:'var(--t2)',marginBottom:12}}>Puedes elegir uno o varios</div>
      {(Array.isArray(services)?services:[]).map(s=>(
        <button key={s.id} className={`so${svcIds.includes(s.id)?' sel':''}`} onClick={()=>toggleSvc(s.id)}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:20,height:20,borderRadius:4,border:`2px solid ${svcIds.includes(s.id)?'var(--primary)':'#ccc'}`,background:svcIds.includes(s.id)?'var(--primary)':'white',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {svcIds.includes(s.id)&&<span style={{color:'white',fontSize:13}}>✓</span>}
            </div>
            <span style={{fontWeight:600,fontSize:14}}>{s.name}</span>
          </div>
          <span style={{fontWeight:700,color:'var(--primary)',fontSize:14,flexShrink:0}}>{fmtM(s.price)}</span>
        </button>
      ))}

      {/* Domicilio */}
      <div style={{marginTop:4,background:'#FFFAF0',border:'1.5px solid #F0D898',borderRadius:12,padding:14}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div><div style={{fontWeight:700,fontSize:14}}>🛵 ¿A domicilio?</div><div style={{fontSize:12,color:'var(--t2)',marginTop:1}}>Se suma al total</div></div>
          <button onClick={()=>setDom(!dom)} style={{background:dom?'var(--primary)':'white',color:dom?'white':'var(--primary)',border:'1.5px solid var(--primary)',borderRadius:20,padding:'6px 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>{dom?'Sí ✓':'No'}</button>
        </div>
        {dom && <div style={{marginTop:12}}>
          <label className="lbl">Valor domicilio</label>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            {[10000,20000].map(v=><button key={v} onClick={()=>setDomP(v)} style={{flex:1,background:domP===v?'var(--primary)':'white',color:domP===v?'white':'var(--primary)',border:'1.5px solid var(--primary)',borderRadius:10,padding:'10px 4px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>{fmtM(v)}</button>)}
            <input className="inp" type="number" placeholder="Otro" style={{flex:1,padding:'10px 10px',fontSize:14}} value={![10000,20000].includes(domP)?domP:''} onChange={e=>setDomP(Number(e.target.value)||0)}/>
          </div>
          <label className="lbl">Dirección</label>
          <input className="inp" placeholder="Ej: Cra 15 #45-20, Apto 302" value={addr} onChange={e=>setAddr(e.target.value)}/>
        </div>}
      </div>

      {svcIds.length>0 && <div style={{marginTop:12,background:'var(--primary-l)',borderRadius:10,padding:12,fontSize:14}}>
        {selSvcs.map(s=><div key={s.id} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{color:'var(--t2)'}}>{s.name}</span><span style={{fontWeight:600}}>{fmtM(s.price)}</span></div>)}
        {dom&&<div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}><span style={{color:'var(--t2)'}}>Domicilio</span><span style={{fontWeight:600}}>{fmtM(domP)}</span></div>}
        <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid var(--border)',paddingTop:6,marginTop:4}}><span style={{fontWeight:700}}>Total</span><span style={{fontWeight:700,color:'var(--primary)',fontSize:16}}>{fmtM(grand)}</span></div>
      </div>}

      <button className="btn" style={{width:'100%',marginTop:14}} onClick={()=>setStep(4)} disabled={svcIds.length===0}>
        Siguiente {svcIds.length>0&&`(${svcIds.length} servicio${svcIds.length>1?'s':''})`}
      </button>
    </div>}

    {/* S4 — Date & Time */}
    {step===4 && <div className="card">
      {/* Client banner */}
      <div style={{background:'var(--primary-l)',borderRadius:10,padding:'8px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:28,height:28,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontWeight:700,fontSize:13,flexShrink:0}}>{String(fc?.name||'?').charAt(0).toUpperCase()}</div>
        <span style={{fontWeight:700,fontSize:14}}>{fc?.name}</span>
        <span style={{fontSize:12,color:'var(--t2)'}}>· {selSvcs.map(s=>s.name).join(', ')}</span>
      </div>

      <div style={{fontFamily:'Georgia,serif',fontSize:18,marginBottom:14}}>Fecha y hora</div>
      <label className="lbl">Fecha</label>
      <input type="date" className="inp" value={date} min={todayStr()} onChange={e=>{setDate(e.target.value);setTime('')}} style={{marginBottom:16}}/>
      <label className="lbl">Hora disponible</label>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:14}}>
        {slots.map(({time:t,disabled,reason})=>{
          const t2=cleanTime(t), isSel=cleanTime(time)===t2
          return <button key={t} className={`to${isSel?' sel':''}`} disabled={disabled} title={disabled?reason:''} onClick={()=>!disabled&&setTime(t)}>
            {fmtTime(t)}
          </button>
        })}
      </div>
      {time && <div style={{background:'var(--primary-l)',borderRadius:10,padding:10,fontSize:13,marginBottom:14}}>
        ✅ <strong>{fmtTime(time)}</strong> hasta aprox. <strong>{fmtTime(`${String(parseInt(time)+1).padStart(2,'0')}:${time.split(':')[1]}`)}</strong>
      </div>}
      <div style={{marginBottom:16}}>
        <label className="lbl">👩‍💼 Atendida por</label>
        {isAdmin ? (
          <select className="inp" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} style={{fontSize:13}}>
            {(users||[]).filter(u=>u.email).map(u=>(
              <option key={u.email} value={u.email}>
                {u.name || u.email.split('@')[0]} — {u.email}
              </option>
            ))}
            {assignedTo && !(users||[]).some(u=>u.email===assignedTo) && (
              <option value={assignedTo}>{assignedTo}</option>
            )}
          </select>
        ) : (
          <input className="inp"
            value={userName || (userEmail||'').split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
            disabled
            style={{fontSize:13, background:'#f5f5f5', color:'var(--t2)', cursor:'not-allowed'}}
          />
        )}
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn-o" onClick={()=>setStep(3)}>Atrás</button>
        {conflictNW && (
          <div style={{background:'#FFF8E1',border:'1.5px solid #F6C90E',borderRadius:12,padding:'12px 14px',marginBottom:14,display:'flex',gap:10,alignItems:'flex-start'}}>
            <span style={{fontSize:20,flexShrink:0}}>⚠️</span>
            <div style={{fontSize:13,color:'#7A5C00',lineHeight:1.5}}>
              <strong>Conflicto de horario:</strong> el día <strong>{fmtDate(date)}</strong> a las <strong>{fmtTime(time)}</strong>, <strong>{conflictNWName}</strong> ya tiene una cita con <strong>{conflictNW.clientName}</strong>.
            </div>
          </div>
        )}
        <button className="btn" style={{flex:1}} onClick={()=>setStep(4.5)} disabled={!time||!!conflictNW}>Ver resumen</button>
      </div>
    </div>}

    {/* S4.5 — Summary */}
    {step===4.5&&!loading&&!done && <div className="card">
      <div style={{fontFamily:'Georgia,serif',fontSize:18,marginBottom:16}}>Confirmar cita</div>
      {[['👤 Cliente',fc?.name],['📱 Teléfono',fc?.phone],['✨ Servicios',selSvcs.map(s=>s.name).join(', ')],['💳 Servicios',fmtM(svcTotal)],...(dom?[['🛵 Domicilio',fmtM(domP)],['📍 Dirección',addr||'—']]:[]),['👩‍💼 Atendida por', (userNameMap||{})[String(assignedTo||userEmail||'').trim().toLowerCase()] || (assignedTo||userEmail||'').split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())]]
        .map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #FBF0F3',fontSize:14}}><span style={{color:'var(--t2)'}}>{l}</span><span style={{fontWeight:600,maxWidth:'60%',textAlign:'right'}}>{v}</span></div>)
      }
      <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',fontSize:16}}><span style={{fontWeight:700}}>💎 Total</span><span style={{fontWeight:700,color:'var(--primary)',fontSize:18}}>{fmtM(grand)}</span></div>
      {[['📅 Fecha',fmtDate(date)],['🕐 Hora',fmtTime(time)]].map(([l,v])=>(
        <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:14}}><span style={{color:'var(--t2)'}}>{l}</span><span style={{fontWeight:600}}>{v}</span></div>
      ))}
      <div style={{marginTop:12,background:'#EDF7F0',borderRadius:10,padding:10,fontSize:13,color:'var(--green)',marginBottom:16}}>📅 Se creará automáticamente en Google Calendar</div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn-o" onClick={()=>setStep(4)}>Atrás</button>
        <button className="btn" style={{flex:1}} onClick={confirm}>Confirmar ✓</button>
      </div>
    </div>}

    {loading && <div className="card" style={{textAlign:'center',padding:40}}>
      <div style={{fontSize:38,display:'inline-block',animation:'spin 1s linear infinite'}}>{BIZ_EMOJI}</div>
      <div style={{fontFamily:'Georgia,serif',fontSize:16,color:'var(--primary)',marginTop:14}}>Guardando y creando evento en Calendar…</div>
    </div>}

    {done&&!loading && <div className="card" style={{textAlign:'center'}}>
      <div style={{fontSize:42,marginBottom:12}}>🎉</div>
      <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,marginBottom:10}}>¡Cita agendada!</div>
      <div style={{background:calR?.ok?'#EDF7F0':'var(--warn-bg)',borderRadius:10,padding:12,fontSize:13,color:calR?.ok?'var(--green)':'var(--warn-t)',marginBottom:14,textAlign:'left'}}>
        {calR?.ok?'📅 Evento creado en Google Calendar ✨':`⚠️ Cita guardada. Calendar: ${calR?.error||'error.'}`}
      </div>
      <div style={{background:'var(--primary-l)',borderRadius:12,padding:16,textAlign:'left',marginBottom:14,fontSize:14}}>
        <div style={{fontWeight:700,marginBottom:4}}>{fc?.name}</div>
        <div style={{color:'var(--t2)',marginBottom:2}}>{selSvcs.map(s=>s.name).join(' + ')}</div>
        {dom&&<div style={{color:'var(--gold)',marginBottom:2}}>🛵 {fmtM(domP)}{addr?` — ${addr}`:''}</div>}
        <div style={{color:'var(--primary)',fontWeight:700,marginBottom:2}}>💎 {fmtM(grand)}</div>
        <div style={{color:'var(--t2)'}}>{fmtDate(date)} · {fmtTime(time)}</div>
      </div>
      {/* WhatsApp note */}
      <div style={{background:'#E8F5E9',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#2E7D32',textAlign:'left'}}>
        <strong>💬 Sobre el recordatorio automático:</strong> WhatsApp no permite envíos automáticos desde web. Al dar clic en el botón se abre WhatsApp con el mensaje listo — solo tienes que presionar enviar.
      </div>
      <button className="btn-wa" style={{width:'100%',marginBottom:10}} onClick={()=>openWA(fc?.phone,fc?.name,time,date,selSvcs.map(s=>s.name).join(', '),grand,dom)}>
        💬 Abrir WhatsApp con mensaje listo
      </button>
      <button className="btn" style={{width:'100%'}} onClick={onClose}>Finalizar</button>
    </div>}
  </div>
}

/* ══════════════════════════════════════════════════════════════
   CLIENTS TAB — with duplicate phone check
══════════════════════════════════════════════════════════════ */
function ClientsTab({clients,appts,SC,confirm,infoModal,setTab}) {
  const [name,  setN]  = useState('')
  const [phone, setP]  = useState('')
  const [srch,  setSr] = useState('')
  const [editId,setEI] = useState(null)
  const [editData,setED]= useState({})
  const safe = Array.isArray(clients)?clients:[]

  const phoneValid = p => p.replace(/\D/g,'').length>=10
  const nameValid  = n => n.trim().length>=3

  const add = () => {
    const clean = phone.replace(/\D/g,'')
    const dup   = safe.find(c=>(c.phone||'').replace(/\D/g,'')===clean)
    if (dup) { infoModal(`Ya existe "${dup.name}" con ese número. No se puede duplicar.`); return }
    if (!nameValid(name)||!phoneValid(phone)) return
    SC([...safe,{id:uid(),name:(name||'').trim().toUpperCase(),phone:phone.trim(),createdAt:todayStr()}])
    setN(''); setP('')
  }

  const saveEdit = c => {
    const clean = editData.phone?.replace(/\D/g,'')||''
    const dup   = safe.find(x=>x.id!==c.id&&(x.phone||'').replace(/\D/g,'')===clean)
    if (dup) { infoModal(`Ya existe "${dup.name}" con ese número.`); return }
    SC(safe.map(x=>x.id===c.id?{...c,...editData,name:(editData.name||c.name||'').trim().toUpperCase()}:x)); setEI(null)
  }

  const filt = safe.filter(c=>String(c.name||'').toLowerCase().includes(srch.toLowerCase())||String(c.phone||'').includes(srch))

  return <>
    <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:'var(--t)',marginBottom:16}}>Clientes</div>
    <div className="card">
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>✨ Agregar cliente</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div>
          <label className="lbl">Nombre (mín. 3)</label>
          <input className="inp" placeholder="Nombre completo" value={name} onChange={e=>setN(e.target.value)}
            style={{borderColor:name&&!nameValid(name)?'var(--red)':'var(--border)'}}/>
          {name&&!nameValid(name)&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>Mínimo 3 caracteres</div>}
        </div>
        <div>
          <label className="lbl">Celular (10 dígitos)</label>
          <input className="inp" type="tel" placeholder="3001234567" value={phone}
            onChange={e=>setP(e.target.value.replace(/\D/g,'').slice(0,10))}
            style={{borderColor:phone&&!phoneValid(phone)?'var(--red)':'var(--border)'}}/>
          {phone&&!phoneValid(phone)&&<div style={{fontSize:11,color:'var(--red)',marginTop:3}}>Mínimo 10 dígitos</div>}
        </div>
      </div>
      <button className="btn" style={{width:'100%'}} onClick={add} disabled={!nameValid(name)||!phoneValid(phone)}>Agregar cliente</button>
    </div>
    <input className="inp" placeholder="🔍 Buscar…" value={srch} onChange={e=>setSr(e.target.value)} style={{marginBottom:14}}/>
    <div className="card">
      <div style={{fontWeight:700,marginBottom:4,fontSize:15}}>Registradas ({filt.length})</div>
      {filt.length===0
        ?<div style={{textAlign:'center',padding:20,color:'var(--t2)',fontSize:14}}>No hay clientes</div>
        :filt.map(c=>{
          const n=(Array.isArray(appts)?appts:[]).filter(a=>(a.clientPhone||'').replace(/\D/g,'')===(c.phone||'').replace(/\D/g,'')).length
          const isEdit=editId===c.id
          return <div key={c.id||c.phone} style={{padding:'12px 0',borderBottom:'1px solid #FBF0F3'}}>
            {isEdit
              ?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div><label className="lbl">Nombre</label><input className="inp" value={editData.name||''} onChange={x=>setED(p=>({...p,name:x.target.value}))}/></div>
                <div><label className="lbl">Celular</label><input className="inp" type="tel" value={editData.phone||''} onChange={x=>setED(p=>({...p,phone:x.target.value.replace(/\D/g,'').slice(0,10)}))}/></div>
                <div style={{gridColumn:'span 2',display:'flex',gap:8,marginTop:4}}>
                  <button className="btn" style={{flex:1}} onClick={()=>saveEdit(c)}>Guardar</button>
                  <button className="btn-del" onClick={()=>setEI(null)}>Cancelar</button>
                </div>
              </div>
              :<div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:38,height:38,borderRadius:'50%',background:'var(--primary-l)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:16,color:'var(--primary)',flexShrink:0}}>{String(c.name||'?').charAt(0).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{c.name}</div>
                  <div style={{fontSize:12,color:'var(--t2)'}}>📱 {c.phone} · {n} cita{n!==1?'s':''}</div>
                </div>
                <button className="btn-sm" style={{padding:'5px 8px',fontSize:11}} onClick={()=>setTab('client-history',{client:c})}>Historial</button>
                <button className="btn-edit" onClick={()=>{setEI(c.id);setED({name:c.name,phone:c.phone})}}>✏️</button>
                <button className="btn-del" onClick={()=>{
                  const pending=(Array.isArray(appts)?appts:[]).filter(a=>(a.clientPhone||'').replace(/\D/g,'')===(c.phone||'').replace(/\D/g,'')&&!bool(a.completed)&&!isPastAppt(a))
                  if(pending.length>0){infoModal(`No se puede eliminar a ${c.name}. Tiene ${pending.length} cita${pending.length>1?'s':''} pendiente${pending.length>1?'s':''}. Completa o elimina las citas primero.`);return}
                  confirm(`¿Eliminar a ${c.name}?`,()=>SC(safe.filter(x=>x.id!==c.id)))
                }}>🗑️</button>
              </div>
            }
          </div>
        })
      }
    </div>
  </>
}

/* ══════════════════════════════════════════════════════════════
   SERVICES TAB
══════════════════════════════════════════════════════════════ */
function ServicesTab({services,SS,confirm}) {
  const [name,setN]=useState(''), [price,setP]=useState(''), [editId,setEI]=useState(null), [eP,setEP]=useState('')
  const safe=Array.isArray(services)?services:[]
  const add=()=>{if(!name.trim()||!price)return;SS([...safe,{id:uid(),name:name.trim(),price:Number(price)}]);setN('');setP('')}
  return <>
    <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:'var(--t)',marginBottom:16}}>Servicios</div>
    <div className="card">
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>✨ Agregar servicio</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <div><label className="lbl">Nombre</label><input className="inp" placeholder="Ej: Diseño de cejas" value={name} onChange={e=>setN(e.target.value)}/></div>
        <div><label className="lbl">Precio (COP)</label><input className="inp" type="number" placeholder="35000" value={price} onChange={e=>setP(e.target.value)}/></div>
      </div>
      <button className="btn" style={{width:'100%'}} onClick={add} disabled={!name.trim()||!price}>Agregar servicio</button>
    </div>
    <div className="card">
      <div style={{fontWeight:700,marginBottom:14,fontSize:15}}>Servicios ({safe.length})</div>
      {safe.length===0?<div style={{textAlign:'center',padding:20,color:'var(--t2)'}}>No hay servicios</div>
        :safe.map(s=><div key={s.id} className="row">
          <div style={{fontSize:20,flexShrink:0}}>✨</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:14}}>{s.name}</div><div style={{fontSize:12,color:'var(--t2)'}}>~1 hora</div></div>
          {editId===s.id
            ?<div style={{display:'flex',alignItems:'center',gap:6}}>
              <input className="inp" type="number" value={eP} onChange={e=>setEP(e.target.value)} style={{width:100,padding:'6px 10px',fontSize:13}}/>
              <button className="btn" style={{padding:'6px 12px',fontSize:13}} onClick={()=>{SS(safe.map(x=>x.id===s.id?{...x,price:Number(eP)}:x));setEI(null)}}>✓</button>
              <button className="btn-del" onClick={()=>setEI(null)}>✕</button>
            </div>
            :<div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontWeight:700,color:'var(--primary)',fontSize:15}}>{fmtM(s.price)}</span>
              <button className="btn-edit" onClick={()=>{setEI(s.id);setEP(String(s.price))}}>✏️</button>
              <button className="btn-del" onClick={()=>confirm(`¿Eliminar el servicio "${s.name}"?`,()=>SS(safe.filter(x=>x.id!==s.id)))}>✕</button>
            </div>
          }
        </div>)
      }
    </div>
  </>
}

/* ══════════════════════════════════════════════════════════════
   FINANCES TAB
══════════════════════════════════════════════════════════════ */
function FinancesTab({appts,expenses,SE,setTab,confirm,userEmail,userNameMap={}}) {
  const [month,setM]=useState(localDateStr().slice(0,7))
  const [desc,setD]=useState(''), [amount,setA]=useState(''), [cat,setC]=useState('Insumos'), [expDate,setED]=useState(todayStr())
  const [editId,setEI]=useState(null), [editData,setEData]=useState({})
  const [customCat,setCC]=useState('')

  const safe=Array.isArray(expenses)?expenses:[]
  const safeA=Array.isArray(appts)?appts:[]
  const months=[...new Set([...safeA.map(a=>cleanDate(a.date).slice(0,7)),...safe.map(e=>cleanDate(e.date).slice(0,7)),localDateStr().slice(0,7)].filter(Boolean))].sort((a,b)=>b.localeCompare(a))
  const allCats=[...new Set([...DEF_CATS,...safe.map(e=>e.category).filter(Boolean)])]
  const [excludedCats, setExcludedCats] = useState([])
  const visibleCats = allCats.filter(c => !excludedCats.includes(c))
  const deleteCat = catName => {
    if (safe.some(e => e.category === catName)) return  // has expenses, can't delete
    if (cat === catName) setC(DEF_CATS[0])
    setExcludedCats(prev => [...prev, catName])
  }
  const ma=safeA.filter(a=>cleanDate(a.date).slice(0,7)===month)
  const me=safe.filter(e=>cleanDate(e.date).slice(0,7)===month)
  const revDone=ma.filter(a=>bool(a.completed)).reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revTotal=ma.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const tot=me.reduce((s,e)=>s+toN(e.amount||0),0)

  const add=()=>{
    if(!desc.trim()||!amount)return
    SE([...safe,{id:uid(),description:capFirst(desc),amount:Number(amount),category:capFirst(customCat||cat),date:expDate,createdBy:userEmail||''}])
    setD('');setA('');setCC('')
  }
  const saveEdit=()=>{SE(safe.map(e=>e.id===editId?{...e,...editData}:e));setEI(null)}

  return <>
    <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:600,color:'var(--t)',marginBottom:16}}>Finanzas</div>
    <div style={{marginBottom:14}}>
      <label className="lbl">Ver mes</label>
      <select className="inp" value={month} onChange={e=>setM(e.target.value)}>
        {months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>)}
      </select>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
      <div style={{background:'#EDF7F0',borderRadius:14,padding:'14px 10px',textAlign:'center',cursor:'pointer'}} onClick={()=>setTab('income-detail',{month})}>
        <div style={{fontSize:11,color:'var(--green)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>Recibido</div>
        <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'var(--green)'}}>{fmtM(revDone)}</div>
        <div style={{fontSize:10,color:'var(--green)',marginTop:2}}>Ver →</div>
      </div>
      <div style={{background:'#FFF0F0',borderRadius:14,padding:'14px 10px',textAlign:'center',cursor:'pointer'}} onClick={()=>setTab('expense-detail',{month})}>
        <div style={{fontSize:11,color:'var(--red)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>Gastos</div>
        <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:'var(--red)'}}>{fmtM(tot)}</div>
        <div style={{fontSize:10,color:'var(--red)',marginTop:2}}>Ver →</div>
      </div>
      <div style={{background:revDone-tot>=0?'#EDF7F0':'#FFF0F0',borderRadius:14,padding:'14px 10px',textAlign:'center',border:`1px solid ${revDone-tot>=0?'#B0DDB8':'#F5B0B0'}`}}>
        <div style={{fontSize:11,color:revDone-tot>=0?'var(--green)':'var(--red)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>Neto</div>
        <div style={{fontFamily:'Georgia,serif',fontSize:15,fontWeight:700,color:revDone-tot>=0?'var(--green)':'var(--red)'}}>{fmtM(revDone-tot)}</div>
      </div>
    </div>
    {revTotal>revDone&&<div style={{background:'var(--warn-bg)',borderRadius:12,padding:'10px 14px',marginBottom:14,fontSize:13,color:'var(--warn-t)',display:'flex',justifyContent:'space-between'}}>
      <span style={{cursor:'pointer'}} onClick={()=>setTab('income-detail',{month})}>💡 Proyectado este mes</span><span style={{fontWeight:700}}>{fmtM(revTotal)}</span>
    </div>}

    {/* Analytics shortcuts */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
      <div className="card" style={{marginBottom:0,cursor:'pointer',textAlign:'center',padding:'16px 12px'}} onClick={()=>setTab('comparison')}>
        <div style={{fontSize:26,marginBottom:6}}><svg width="28" height="22" viewBox="0 0 28 22" fill="none"><rect x="1" y="10" width="5" height="12" rx="1.5" fill="var(--primary)" opacity=".9"/><rect x="8" y="4" width="5" height="18" rx="1.5" fill="var(--primary)"/><rect x="15" y="7" width="5" height="15" rx="1.5" fill="var(--gold)" opacity=".9"/><rect x="22" y="1" width="5" height="21" rx="1.5" fill="var(--gold)"/></svg></div>
        <div style={{fontWeight:700,fontSize:13,color:'var(--t)'}}>Comparar meses</div>
        <div style={{fontSize:11,color:'var(--t2)',marginTop:3}}>Ver crecimiento →</div>
      </div>
      <div className="card" style={{marginBottom:0,cursor:'pointer',textAlign:'center',padding:'16px 12px'}} onClick={()=>setTab('top-services')}>
        <div style={{fontSize:26,marginBottom:6}}><svg width="28" height="22" viewBox="0 0 28 22" fill="none"><circle cx="14" cy="11" r="8" stroke="var(--primary)" strokeWidth="2" fill="none"/><path d="M14 7v4l3 2" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/><circle cx="5" cy="4" r="3" fill="var(--gold)" opacity=".7"/><circle cx="23" cy="4" r="2" fill="var(--gold)" opacity=".5"/></svg></div>
        <div style={{fontWeight:700,fontSize:13,color:'var(--t)'}}>Servicios rentables</div>
        <div style={{fontSize:11,color:'var(--t2)',marginTop:3}}>Ver ranking →</div>
      </div>
    </div>

    <div className="card">
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📤 Agregar gasto</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div><label className="lbl">Descripción</label><input className="inp" placeholder="Ej: Cera" value={desc} onChange={e=>setD(capFirst(e.target.value))}/></div>
        <div><label className="lbl">Monto (COP)</label><input className="inp" type="number" placeholder="20000" value={amount} onChange={e=>setA(e.target.value)}/></div>
        <div>
          <label className="lbl">Categoría</label>
          <select className="inp" value={customCat?'__c':cat} onChange={e=>{const v=e.target.value;if(v==='__c'){setCC('new')}else{setC(v);setCC('')}}}>
            {visibleCats.map(c=><option key={c}>{c}</option>)}
            <option value="__c">+ Nueva categoría</option>
          </select>
          {/* Eliminar categorías sin gastos */}
          <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:6}}>
            {visibleCats.map(catName => {
              const inUse = safe.some(e=>e.category===catName)
              return (
                <span key={catName} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:20,background:'var(--primary-l)',border:'1px solid var(--border)',fontSize:12}}>
                  <span style={{color:'var(--t)'}}>{catName}</span>
                  {!inUse && (
                    <button onClick={()=>deleteCat(catName)} title="Eliminar categoría"
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:13,lineHeight:1,padding:'0 2px',fontFamily:'inherit'}}>×</button>
                  )}
                </span>
              )
            })}
          </div>
        </div>
        {customCat&&<div><label className="lbl">Nueva cat.</label><input className="inp" placeholder="Ej: Equipos" value={customCat==='new'?'':customCat} onChange={e=>setCC(e.target.value)}/></div>}
        <div><label className="lbl">Fecha</label><input type="date" className="inp" value={expDate} onChange={e=>setED(e.target.value)}/></div>
      </div>
      <button className="btn" style={{width:'100%'}} onClick={add} disabled={!desc.trim()||!amount}>Agregar gasto</button>
    </div>

    {me.length>0&&<div className="card">
      <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>📋 Gastos del mes</div>
      {[...me].sort((a,b)=>cleanDate(a.date).localeCompare(cleanDate(b.date))).map(e=>{
        const isEdit=editId===e.id
        return <div key={e.id} style={{padding:'10px 0',borderBottom:'1px solid #FBF0F3'}}>
          {isEdit
            ?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><label className="lbl">Descripción</label><input className="inp" value={editData.description||''} onChange={x=>setEData(p=>({...p,description:capFirst(x.target.value)}))}/></div>
              <div><label className="lbl">Monto</label><input className="inp" type="number" value={editData.amount||''} onChange={x=>setEData(p=>({...p,amount:x.target.value}))}/></div>
              <div><label className="lbl">Cat.</label><input className="inp" list="cats-f" value={editData.category||''} onChange={x=>setEData(p=>({...p,category:x.target.value}))}/><datalist id="cats-f">{allCats.map(c=><option key={c} value={c}/>)}</datalist></div>
              <div><label className="lbl">Fecha</label><input type="date" className="inp" value={editData.date||''} onChange={x=>setEData(p=>({...p,date:x.target.value}))}/></div>
              <div style={{gridColumn:'span 2',display:'flex',gap:8}}><button className="btn" style={{flex:1}} onClick={saveEdit}>Guardar</button><button className="btn-del" onClick={()=>setEI(null)}>Cancelar</button></div>
            </div>
            :<div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{e.description}</div><div style={{fontSize:11,color:'var(--t2)'}}>{e.category} · {fmtDate(e.date)}{e.createdBy&&<span style={{color:'#B85C6E',marginLeft:6}}>· {userNameMap[String(e.createdBy).trim().toLowerCase()] || String(e.createdBy).split('@')[0]}</span>}</div></div>
              <span style={{fontWeight:700,color:'var(--red)',fontSize:13,flexShrink:0}}>{fmtM(e.amount)}</span>
              <button className="btn-edit" onClick={()=>{setEI(e.id);setEData({...e})}}>✏️</button>
              <button className="btn-del" onClick={()=>confirm(`¿Eliminar el gasto "${e.description}"?`,()=>SE(safe.filter(x=>x.id!==e.id)))}>✕</button>
            </div>
          }
        </div>
      })}
    </div>}
  </>
}

/* ══════════════════════════════════════════════════════════════
   CLIENT HISTORY
══════════════════════════════════════════════════════════════ */
function ClientHistory({appts,setTab,tabExtra,userNameMap={}}) {
  const client   = tabExtra?.client
  const safeAppts= Array.isArray(appts)?appts:[]
  if (!client) { return <div className="card" style={{textAlign:'center',padding:30,color:'var(--t2)'}}>Sin datos de cliente<br/><br/><button className="btn-sm" onClick={()=>setTab('clients')}>← Volver</button></div> }

  const phone = (client.phone||'').replace(/\D/g,'')
  const cAppts= [...safeAppts]
    .filter(a=>(a.clientPhone||'').replace(/\D/g,'')===phone)
    .sort((a,b)=>`${cleanDate(b.date)}${cleanTime(b.time)}`.localeCompare(`${cleanDate(a.date)}${cleanTime(a.time)}`))

  const done   = cAppts.filter(a=>bool(a.completed)&&a.completed!=='noshow')
  const noshow = cAppts.filter(a=>a.completed==='noshow')
  const pend   = cAppts.filter(a=>!bool(a.completed)&&a.completed!=='noshow'&&!isPastAppt(a))
  const totalSpent  = done.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const totalPend   = pend.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const lastVisit   = done.length ? done[0].date : null

  // Favourite services
  const svcCount = {}
  cAppts.forEach(a=>{
    String(a.serviceNames||'').split(',').forEach(s=>{
      const name = s.trim(); if (!name) return
      svcCount[name] = (svcCount[name]||0)+1
    })
  })
  const topSvcs = Object.entries(svcCount).sort(([,a],[,b])=>b-a).slice(0,3)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
        <button className="btn-sm" onClick={()=>setTab('clients')}>{'←'} Volver</button>
        <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Historial de cliente</span>
      </div>

      {/* Client card */}
      <div style={{background:'linear-gradient(135deg,var(--primary),var(--primary-d))',borderRadius:16,padding:'18px 20px',marginBottom:14,color:'white',display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,0.22)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',fontSize:24,fontWeight:700,flexShrink:0}}>
          {String(client.name||'?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{fontFamily:'Georgia,serif',fontSize:19,fontWeight:700}}>{client.name}</div>
          <div style={{fontSize:13,opacity:.8,marginTop:2}}>{'\uD83D\uDCF1'} {client.phone}</div>
          {client.createdAt&&<div style={{fontSize:11,opacity:.65,marginTop:3}}>Clienta desde {fmtDate(client.createdAt)}</div>}
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
        {[
          [cAppts.length,'Citas','var(--primary)','var(--primary-l)'],
          [done.length,'Completadas','var(--green)','#EDF7F0'],
          [noshow.length,'No asistió','var(--red)','#FFF4F0'],
          [pend.length,'Pendientes','var(--gold)','#FFF8E6'],
        ].map(([v,l,col,bg])=>(
          <div key={l} style={{background:bg,borderRadius:12,padding:'10px 6px',textAlign:'center'}}>
            <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:col}}>{v}</div>
            <div style={{fontSize:10,color:col,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Money summary */}
      <div className="card" style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>{'\uD83D\uDCB3'} Resumen financiero</div>
        {[
          ['Total gastado',fmtM(totalSpent),'var(--green)'],
          ['Pendiente por cobrar',fmtM(totalPend),'var(--gold)'],
          ['Última visita',lastVisit?fmtDate(lastVisit):'—','var(--t2)'],
        ].map(([l,v,col])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:13,color:'var(--t2)'}}>{l}</span>
            <span style={{fontSize:14,fontWeight:700,color:col}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Favourite services */}
      {topSvcs.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>{'\u2728'} Servicios frecuentes</div>
          {topSvcs.map(([name,cnt],i)=>(
            <div key={name} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<topSvcs.length-1?'1px solid var(--border)':'none'}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:'var(--primary-l)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,fontSize:13,fontWeight:600}}>{name}</div>
              <span style={{fontSize:12,color:'var(--t2)'}}>{cnt===1?'1 vez':`${cnt} veces`}</span>
            </div>
          ))}
        </div>
      )}

      {/* All appointments */}
      <div className="card">
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Todas las citas ({cAppts.length})</div>
        {cAppts.length===0
          ?<div style={{textAlign:'center',padding:20,color:'var(--t2)',fontSize:14}}>Sin citas registradas</div>
          :cAppts.map(a=>{
            const st = a.completed==='noshow'?'noshow':bool(a.completed)?'done':'pending'
            const stCfg = {done:{bg:'#EDF7F0',col:'var(--green)',lbl:'✓ Completada'},noshow:{bg:'#FFF4F0',col:'var(--red)',lbl:'✗ No asistió'},pending:{bg:'var(--primary-l)',col:'var(--primary)',lbl:'Pendiente'}}[st]
            return (
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 0',borderBottom:'1px solid var(--border)'}}>
                <div style={{textAlign:'center',flexShrink:0}}>
                  <div style={{fontWeight:700,fontSize:12,color:'var(--primary)'}}>{fmtTime(a.time)}</div>
                  <div style={{fontSize:10,color:'var(--t2)',marginTop:1}}>{fmtDate(a.date)}</div>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.serviceNames}</div>
                  {bool(a.domicilio)&&<div style={{fontSize:11,color:'var(--gold)'}}>🛵 Domicilio</div>}
                  {a.assignedTo&&<div style={{fontSize:11,color:'#B85C6E',marginTop:2}}>👩‍💼 {userNameMap[String(a.assignedTo).trim().toLowerCase()] || String(a.assignedTo).split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:stCfg.col,textDecoration:st==='noshow'?'line-through':''}}>{fmtM(a.totalPrice||a.servicePrice)}</div>
                  <div style={{background:stCfg.bg,color:stCfg.col,borderRadius:20,padding:'1px 8px',fontSize:10,fontWeight:700,marginTop:2}}>{stCfg.lbl}</div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MONTH COMPARISON
══════════════════════════════════════════════════════════════ */
function MonthComparison({appts,expenses,setTab}) {
  const safeA = Array.isArray(appts)?appts:[]
  const safeE = Array.isArray(expenses)?expenses:[]

  const allMonths = [...new Set([
    ...safeA.map(a=>cleanDate(a.date).slice(0,7)),
    ...safeE.map(e=>cleanDate(e.date).slice(0,7)),
    localDateStr().slice(0,7),
  ].filter(Boolean))].sort((a,b)=>b.localeCompare(a))

  const now  = localDateStr().slice(0,7)
  const prev = allMonths.find(m=>m<now) || allMonths[1] || now

  const [mA, setMA] = useState(now)
  const [mB, setMB] = useState(prev)

  const monthLabel = m => new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})

  const calcMonth = m => {
    const aptsM = safeA.filter(a=>cleanDate(a.date).slice(0,7)===m)
    const expM  = safeE.filter(e=>cleanDate(e.date).slice(0,7)===m)
    const recv  = aptsM.filter(a=>bool(a.completed)&&a.completed!=='noshow').reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
    const proj  = aptsM.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
    const exp   = expM.reduce((s,e)=>s+toN(e.amount||0),0)
    const neto  = recv - exp
    const citas = aptsM.length
    const noShow= aptsM.filter(a=>a.completed==='noshow').length
    return {recv,proj,exp,neto,citas,noShow}
  }

  const dA = calcMonth(mA)
  const dB = calcMonth(mB)

  const diff = (a,b) => { if (!b) return null; const pct=Math.round((a-b)/b*100); return {pct, up:pct>=0} }
  const Bar = ({valA,valB,colorA,colorB,label,fmt=fmtM}) => {
    const mx = Math.max(valA,valB,1)
    const wA = Math.round(valA/mx*100)
    const wB = Math.round(valB/mx*100)
    const d  = diff(valA,valB)
    return (
      <div style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:12,fontWeight:600,color:'var(--t)'}}>{label}</span>
          {d && <span style={{fontSize:11,fontWeight:700,color:d.up?'var(--green)':'var(--red)',background:d.up?'#EDF7F0':'#FFF0F0',borderRadius:20,padding:'2px 8px'}}>
            {d.up?'▲':'▼'} {Math.abs(d.pct)}%
          </span>}
        </div>
        <div style={{marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
            <div style={{width:8,height:8,borderRadius:2,background:colorA,flexShrink:0}}/>
            <div style={{flex:1,background:'#F0EAE8',borderRadius:4,height:10,overflow:'hidden'}}>
              <div style={{width:`${wA}%`,height:'100%',background:colorA,borderRadius:4,transition:'width .5s ease'}}/>
            </div>
            <span style={{fontSize:12,fontWeight:700,color:colorA,minWidth:70,textAlign:'right'}}>{fmt(valA)}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:2,background:colorB,opacity:.7,flexShrink:0}}/>
            <div style={{flex:1,background:'#F0EAE8',borderRadius:4,height:10,overflow:'hidden'}}>
              <div style={{width:`${wB}%`,height:'100%',background:colorB,borderRadius:4,opacity:.7,transition:'width .5s ease'}}/>
            </div>
            <span style={{fontSize:12,fontWeight:700,color:colorB,opacity:.8,minWidth:70,textAlign:'right'}}>{fmt(valB)}</span>
          </div>
        </div>
      </div>
    )
  }

  const pxFmt = n => n.toString()

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
        <button className="btn-sm" onClick={()=>setTab('finances')}>{'←'} Volver</button>
        <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Comparar meses</span>
      </div>

      {/* Month selectors */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div>
          <label className="lbl" style={{color:'var(--primary)'}}>Mes A</label>
          <select className="inp" value={mA} onChange={e=>setMA(e.target.value)} style={{borderColor:'var(--primary)'}}>
            {allMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" style={{color:'var(--gold)'}}>Mes B</label>
          <select className="inp" value={mB} onChange={e=>setMB(e.target.value)} style={{borderColor:'var(--gold)'}}>
            {allMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:16,marginBottom:16,padding:'8px 14px',background:'var(--bg)',borderRadius:10,fontSize:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,borderRadius:2,background:'var(--primary)'}}/><span style={{fontWeight:600,color:'var(--primary)'}}>{monthLabel(mA)}</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,borderRadius:2,background:'var(--gold)',opacity:.8}}/><span style={{fontWeight:600,color:'var(--gold)'}}>{monthLabel(mB)}</span></div>
      </div>

      <div className="card">
        <Bar label="Ingresos recibidos" valA={dA.recv}  valB={dB.recv}  colorA="var(--primary)" colorB="var(--gold)"/>
        <Bar label="Gastos"             valA={dA.exp}   valB={dB.exp}   colorA="var(--red)"    colorB="#C49A1A"/>
        <Bar label="Balance neto"       valA={Math.max(dA.neto,0)} valB={Math.max(dB.neto,0)} colorA="var(--green)" colorB="#3A8A50"/>
        <Bar label="Citas totales" valA={dA.citas} valB={dB.citas} colorA="var(--primary)" colorB="var(--gold)" fmt={pxFmt}/>
        <Bar label="No asistió"    valA={dA.noShow} valB={dB.noShow} colorA="var(--red)" colorB="#C49A1A" fmt={pxFmt}/>
      </div>

      {/* Net summary cards — explicit, no .map() to avoid key collision */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[
          {key:'cardA',m:mA,d:dA,col:'var(--primary)'},
          {key:'cardB',m:mB,d:dB,col:'var(--gold)'},
        ].map(({key,m,d,col})=>(
          <div key={key} style={{background:'var(--card)',borderRadius:14,border:`2px solid ${col}`,padding:'14px 12px'}}>
            <div style={{fontSize:10,color:col,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{monthLabel(m)}</div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--t2)'}}>Recibido</span><span style={{fontWeight:700,color:'var(--green)'}}>{fmtM(d.recv)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--t2)'}}>Gastos</span><span style={{fontWeight:700,color:'var(--red)'}}>{fmtM(d.exp)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--t2)'}}>Citas</span><span style={{fontWeight:700,color:'var(--t)'}}>{d.citas}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'6px 0',marginTop:2}}>
              <span style={{fontWeight:700}}>Neto</span>
              <span style={{fontWeight:700,color:d.neto>=0?'var(--green)':'var(--red)'}}>{fmtM(d.neto)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   TOP SERVICES
══════════════════════════════════════════════════════════════ */
function TopServices({appts,setTab}) {
  const safeA = Array.isArray(appts)?appts:[]
  const [period, setPeriod] = useState('all') // 'all' | '3m' | '6m' | 'year'

  const now = new Date()
  const cutoff = {
    all:  null,
    '3m': new Date(now.getFullYear(), now.getMonth()-2, 1).toISOString().slice(0,7),
    '6m': new Date(now.getFullYear(), now.getMonth()-5, 1).toISOString().slice(0,7),
    year: `${now.getFullYear()}-01`,
  }[period]

  const completedAppts = safeA.filter(a =>
    bool(a.completed) && a.completed!=='noshow' &&
    (!cutoff || cleanDate(a.date).slice(0,7) >= cutoff)
  )

  // Build service stats
  const stats = {}
  completedAppts.forEach(a => {
    const names = String(a.serviceNames||'').split(',').map(s=>s.trim()).filter(Boolean)
    const ids   = String(a.serviceIds||'').split(',').map(s=>s.trim()).filter(Boolean)
    const total = toN(a.servicePrice)
    const perSvc= names.length ? total/names.length : total
    names.forEach((name,i) => {
      if (!stats[name]) stats[name] = {name, revenue:0, count:0, id:ids[i]||''}
      stats[name].revenue += perSvc
      stats[name].count   += 1
    })
  })

  const ranked = Object.values(stats).sort((a,b)=>b.revenue-a.revenue)
  const totalRev = ranked.reduce((s,x)=>s+x.revenue,0)
  const maxRev   = ranked[0]?.revenue || 1

  const MEDALS = ['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49']
  const COLORS  = ['var(--primary)','var(--gold)','var(--green)','#7A9FC4','#A47AC4','#C47AA4']

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
        <button className="btn-sm" onClick={()=>setTab('finances')}>{'←'} Volver</button>
        <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>Servicios rentables</span>
      </div>

      {/* Period filter */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {[['all','Todo'],['3m','3 meses'],['6m','6 meses'],['year','Este año']].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            style={{background:period===v?'var(--primary)':'white',color:period===v?'white':'var(--t2)',border:'1.5px solid',borderColor:period===v?'var(--primary)':'var(--border)',borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Total summary */}
      <div style={{background:'linear-gradient(135deg,var(--primary),var(--primary-d))',borderRadius:14,padding:'14px 18px',marginBottom:14,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:10,opacity:.8,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600,marginBottom:4}}>Total generado</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:700}}>{fmtM(totalRev)}</div>
          <div style={{fontSize:11,opacity:.7,marginTop:2}}>{completedAppts.length} citas completadas · {ranked.length} servicios</div>
        </div>
        <div style={{fontSize:32}}>✨</div>
      </div>

      {ranked.length===0
        ?<div className="card" style={{textAlign:'center',padding:30,color:'var(--t2)'}}>Sin datos de citas completadas para este período</div>
        :<div className="card">
          {ranked.map((svc,i)=>{
            const pct     = totalRev>0 ? Math.round(svc.revenue/totalRev*100) : 0
            const barPct  = Math.round(svc.revenue/maxRev*100)
            const color   = COLORS[i%COLORS.length]
            return (
              <div key={svc.name} style={{padding:'14px 0',borderBottom:i<ranked.length-1?'1px solid var(--border)':'none'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                  <div style={{fontSize:20,flexShrink:0,lineHeight:1}}>{i<3?MEDALS[i]:<span style={{fontSize:14,fontWeight:700,color:'var(--t2)',minWidth:20,display:'inline-block',textAlign:'center'}}>{i+1}</span>}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:14,color:'var(--t)'}}>{svc.name}</span>
                      <span style={{fontWeight:800,fontSize:15,color}}>{fmtM(Math.round(svc.revenue))}</span>
                    </div>
                    <div style={{background:'var(--border)',borderRadius:4,height:8,overflow:'hidden',marginBottom:6}}>
                      <div style={{width:`${barPct}%`,height:'100%',background:color,borderRadius:4,transition:'width .6s ease'}}/>
                    </div>
                    <div style={{display:'flex',gap:14,fontSize:11,color:'var(--t2)'}}>
                      <span style={{fontWeight:600}}>{svc.count===1?'1 vez':`${svc.count} veces`}</span>
                      <span>{pct}% del total</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      }


    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   INCOME DETAIL — with pending filter via tabExtra
══════════════════════════════════════════════════════════════ */
function IncomeDetail({appts,setTab,tabExtra}) {
  const initFilter = tabExtra?.filter || 'all'
  const [month,setM] = useState(tabExtra?.month || localDateStr().slice(0,7))
  const [filter,setF]= useState(initFilter)
  const safe   = Array.isArray(appts)?appts:[]
  const months = [...new Set([...safe.map(a=>cleanDate(a.date).slice(0,7)),localDateStr().slice(0,7)].filter(Boolean))].sort((a,b)=>b.localeCompare(a))
  const ma     = [...safe].filter(a=>cleanDate(a.date).slice(0,7)===month).sort((a,b)=>cleanDate(a.date).localeCompare(cleanDate(b.date)))
  const done   = ma.filter(a=>bool(a.completed)&&a.completed!=='noshow')
  const noshow = ma.filter(a=>a.completed==='noshow')
  const pend   = ma.filter(a=>!bool(a.completed)&&a.completed!=='noshow')
  // "Todo" solo suma lo realmente recibido (completadas)
  const revDone   = done.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revPend   = pend.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
  const revNoShow = noshow.reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)

  const display= filter==='completed'?done : filter==='pending'?pend : filter==='noshow'?noshow : ma

  const byDay={}
  display.forEach(a=>{const d=cleanDate(a.date);if(!byDay[d])byDay[d]=[];byDay[d].push(a)})

  return <>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
      <button className="btn-sm" onClick={()=>setTab(tabExtra?.from||'finances')}>← Volver</button>
      <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>💚 Detalle Ingresos</span>
    </div>
    <select className="inp" value={month} onChange={e=>setM(e.target.value)} style={{marginBottom:12}}>
      {months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>)}
    </select>

    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,marginBottom:14}}>
      {[
        ['all',      'Recibido',   fmtM(revDone),   done.length,   'var(--green)', '#EDF7F0'],
        ['completed','Completadas',fmtM(revDone),   done.length,   'var(--green)', '#EDF7F0'],
        ['pending',  'Pendiente',  fmtM(revPend),   pend.length,   'var(--gold)',  '#FFF8E6'],
        ['noshow',   'No asistió', fmtM(revNoShow), noshow.length, 'var(--red)',   '#FFF4F0'],
      ].map(([v,l,val,cnt,col,bg])=>(
        <div key={v} onClick={()=>setF(v)} style={{background:filter===v?col:bg,borderRadius:12,padding:'12px 8px',textAlign:'center',cursor:'pointer',border:`2px solid ${filter===v?col:'transparent'}`,transition:'all .15s'}}>
          <div style={{fontSize:11,color:filter===v?'white':col,fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,fontWeight:700,color:filter===v?'white':col}}>{val}</div>
          <div style={{fontSize:10,color:filter===v?'rgba(255,255,255,0.8)':col,marginTop:2}}>{cnt} citas</div>
        </div>
      ))}
    </div>

    {filter==='pending' && pend.length>0 && (
      <div style={{background:'#FFF8E6',borderRadius:12,padding:'10px 14px',marginBottom:12,fontSize:13,color:'var(--warn-t)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>💡 Marca estas citas como <strong>Completadas</strong> para contarlas como recibidas</span>
        <button className="btn-sm" style={{marginLeft:8,whiteSpace:'nowrap'}} onClick={()=>setTab('appointments')}>Ir a citas</button>
      </div>
    )}
    {filter==='noshow' && noshow.length>0 && revNoShow>0 && (
      <div style={{background:'#FFF4F0',borderRadius:12,padding:'10px 14px',marginBottom:12,fontSize:13,color:'var(--red)',display:'flex',gap:8,alignItems:'center'}}>
        <span>😔 <strong>{fmtM(revNoShow)}</strong> que no se recibieron por no asistir</span>
      </div>
    )}

    {Object.keys(byDay).length===0
      ?<div className="card" style={{textAlign:'center',padding:30,color:'var(--t2)'}}>{filter==='pending'?'No hay citas pendientes 🎉':filter==='noshow'?'Sin inasistencias este mes 🎉':'Sin citas este mes'}</div>
      :Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a)).map(([day,items])=>{
        const dayReceived = items.filter(a=>bool(a.completed)&&a.completed!=='noshow').reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
        const dayNoShow   = items.filter(a=>a.completed==='noshow').reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
        const dayPend     = items.filter(a=>!bool(a.completed)&&a.completed!=='noshow').reduce((s,a)=>s+toN(a.totalPrice||a.servicePrice||0),0)
        return <div className="card" key={day} style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontWeight:700,fontSize:14}}>{fmtDate(day)}</span>
            <div style={{textAlign:'right'}}>
              {dayReceived>0&&<div style={{fontWeight:700,color:'var(--green)',fontSize:13}}>{fmtM(dayReceived)} recibido</div>}
              {dayPend>0   &&<div style={{fontSize:11,color:'var(--gold)'}}>({fmtM(dayPend)} pendiente)</div>}
              {dayNoShow>0 &&<div style={{fontSize:11,color:'var(--red)',textDecoration:'line-through',opacity:.7}}>{fmtM(dayNoShow)}</div>}
            </div>
          </div>
          {items.map(a=>{
            const isNoShow = a.completed==='noshow'
            const isDone   = bool(a.completed)&&!isNoShow
            const precio   = toN(a.totalPrice||a.servicePrice||0)
            return <div key={a.id} className="row" style={{fontSize:13,opacity:isNoShow?.7:1}}>
              <div style={{background:isNoShow?'#FFF0F0':'var(--primary-l)',borderRadius:8,padding:'5px 8px',fontWeight:700,color:isNoShow?'var(--red)':'var(--primary)',fontSize:12,flexShrink:0}}>{fmtTime(a.time)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:isNoShow?'line-through':'none',color:isNoShow?'#aaa':'inherit'}}>{a.clientName}</div>
                <div style={{fontSize:11,color:'var(--t2)'}}>{a.serviceNames}{bool(a.domicilio)?' 🛵':''}</div>
              </div>
              <div style={{flexShrink:0,textAlign:'right'}}>
                {isNoShow ? <>
                  <div style={{fontWeight:700,color:'var(--t2)',fontSize:13,textDecoration:'line-through'}}>{fmtM(precio)}</div>
                  <div style={{fontSize:10,color:'var(--red)',fontWeight:600}}>No asistió</div>
                </> : <>
                  <div style={{fontWeight:700,color:isDone?'var(--green)':'var(--gold)',fontSize:13}}>{fmtM(precio)}</div>
                  <div style={{fontSize:10,color:isDone?'var(--green)':'var(--gold)'}}>{isDone?'✓ Recibido':'Pendiente'}</div>
                </>}
              </div>
            </div>
          })}
        </div>
      })
    }
  </>
}

/* ══════════════════════════════════════════════════════════════
   EXPENSE DETAIL
══════════════════════════════════════════════════════════════ */
function ExpenseDetail({expenses,SE,setTab,tabExtra,confirm,userNameMap={}}) {
  const [month,setM]=useState(tabExtra?.month || localDateStr().slice(0,7))
  const [editId,setEI]=useState(null), [editData,setED]=useState({})
  const safe=Array.isArray(expenses)?expenses:[]
  const months=[...new Set([...safe.map(e=>cleanDate(e.date).slice(0,7)),localDateStr().slice(0,7)].filter(Boolean))].sort((a,b)=>b.localeCompare(a))
  const me=[...safe].filter(e=>cleanDate(e.date).slice(0,7)===month).sort((a,b)=>cleanDate(a.date).localeCompare(cleanDate(b.date)))
  const tot=me.reduce((s,e)=>s+toN(e.amount||0),0)
  const allCats=[...new Set([...DEF_CATS,...safe.map(e=>e.category).filter(Boolean)])]
  const byCat={}
  me.forEach(e=>{if(!byCat[e.category])byCat[e.category]=0;byCat[e.category]+=toN(e.amount)})
  const byDay={}
  me.forEach(e=>{const d=cleanDate(e.date);if(!byDay[d])byDay[d]=[];byDay[d].push(e)})
  const saveEdit=()=>{SE(safe.map(e=>e.id===editId?{...e,...editData}:e));setEI(null)}

  return <>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
      <button className="btn-sm" onClick={()=>setTab(tabExtra?.from||'finances')}>← Volver</button>
      <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:600}}>📤 Detalle Gastos</span>
    </div>
    <select className="inp" value={month} onChange={e=>setM(e.target.value)} style={{marginBottom:14}}>
      {months.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>)}
    </select>
    <div style={{background:'linear-gradient(135deg,var(--primary),var(--primary-d))',borderRadius:14,padding:'16px 18px',marginBottom:14,color:'white',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div><div style={{fontSize:11,opacity:.8,textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600}}>Total del mes</div><div style={{fontFamily:'Georgia,serif',fontSize:26,fontWeight:700,marginTop:3}}>{fmtM(tot)}</div></div>
      <div style={{fontSize:32}}>📊</div>
    </div>

    {Object.keys(byCat).length>0&&<div className="card">
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Por categoría</div>
      {Object.entries(byCat).sort(([,a],[,b])=>b-a).map(([cat,val],i)=>{
        const color=CAT_COLORS[i%CAT_COLORS.length]
        return <div key={cat} style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:13}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:10,height:10,borderRadius:2,background:color,flexShrink:0}}/>
              <span style={{fontWeight:600}}>{cat}</span>
            </div>
            <span style={{fontWeight:700,color}}>{fmtM(val)}</span>
          </div>
          <div style={{height:7,background:'#f0e8e6',borderRadius:4,overflow:'hidden'}}>
            <div style={{width:`${Math.round((val/tot)*100)}%`,height:'100%',background:color,borderRadius:4,transition:'width .4s ease'}}/>
          </div>
        </div>
      })}
    </div>}

    {Object.keys(byDay).length===0
      ?<div className="card" style={{textAlign:'center',padding:30,color:'var(--t2)'}}>Sin gastos este mes</div>
      :Object.entries(byDay).sort(([a],[b])=>b.localeCompare(a)).map(([day,items])=>{
        const dayTot=items.reduce((s,e)=>s+toN(e.amount||0),0)
        return <div className="card" key={day} style={{marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <span style={{fontWeight:700,fontSize:14}}>{fmtDate(day)}</span>
            <span style={{fontWeight:700,color:'var(--red)',fontSize:13}}>{fmtM(dayTot)}</span>
          </div>
          {items.map(e=>{
            const isEdit=editId===e.id
            return <div key={e.id} style={{padding:'8px 0',borderBottom:'1px solid #FBF0F3'}}>
              {isEdit
                ?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <div><label className="lbl">Descripción</label><input className="inp" value={editData.description||''} onChange={x=>setED(p=>({...p,description:capFirst(x.target.value)}))}/></div>
                  <div><label className="lbl">Monto</label><input className="inp" type="number" value={editData.amount||''} onChange={x=>setED(p=>({...p,amount:x.target.value}))}/></div>
                  <div><label className="lbl">Cat.</label><input className="inp" list="cats2-d" value={editData.category||''} onChange={x=>setED(p=>({...p,category:x.target.value}))}/><datalist id="cats2-d">{allCats.map(c=><option key={c} value={c}/>)}</datalist></div>
                  <div><label className="lbl">Fecha</label><input type="date" className="inp" value={editData.date||''} onChange={x=>setED(p=>({...p,date:x.target.value}))}/></div>
                  <div style={{gridColumn:'span 2',display:'flex',gap:8}}><button className="btn" style={{flex:1}} onClick={saveEdit}>Guardar</button><button className="btn-del" onClick={()=>setEI(null)}>Cancelar</button></div>
                </div>
                :<div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:13}}>{e.description}</div><div style={{fontSize:11,color:'var(--t2)'}}>{e.category}{e.createdBy && <span style={{marginLeft:6,color:'#B85C6E'}}>· {userNameMap[String(e.createdBy).trim().toLowerCase()] || String(e.createdBy).split('@')[0]}</span>}</div></div>
                  <span style={{fontWeight:700,color:'var(--red)',fontSize:13,flexShrink:0}}>{fmtM(e.amount)}</span>
                  <button className="btn-edit" onClick={()=>{setEI(e.id);setED({...e})}}>✏️</button>
                  <button className="btn-del" onClick={()=>confirm(`¿Eliminar el gasto "${e.description}"?`,()=>SE(safe.filter(x=>x.id!==e.id)))}>✕</button>
                </div>
              }
            </div>
          })}
        </div>
      })
    }
  </>
}
