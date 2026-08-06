import { useState } from 'react'
import { hashPassword, authLogin, authRegister, authRequestReset, authResetPassword } from './api.js'

/* ── palette (matches App.jsx) ── */
const P  = '#B85C6E'
const PL = '#FDF6F0'
const PB = '#F5D0D8'

const inp = {
  width:'100%', padding:'11px 14px', border:`1.5px solid ${PB}`,
  borderRadius:10, fontSize:15, fontFamily:'inherit',
  background:'white', outline:'none', boxSizing:'border-box',
  transition:'border .2s',
}
const btn = {
  width:'100%', padding:'13px', background:P, color:'white',
  border:'none', borderRadius:12, fontSize:15, fontWeight:700,
  cursor:'pointer', fontFamily:'inherit', marginTop:4,
  transition:'opacity .15s',
}
const link = {
  background:'none', border:'none', color:P, fontSize:13,
  cursor:'pointer', fontFamily:'inherit', fontWeight:600,
  textDecoration:'underline', padding:0,
}
const card = {
  background:'white', borderRadius:20, padding:'32px 28px',
  boxShadow:'0 4px 32px rgba(180,92,110,.13)',
  width:'100%', maxWidth:400, margin:'0 auto',
}

function Field({ label, type='text', value, onChange, placeholder }) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{marginBottom:14}}>
      <label style={{fontSize:12,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:5}}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{...inp, borderColor: focus ? P : PB}}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
      />
    </div>
  )
}

function ErrBox({ msg }) {
  if (!msg) return null
  return <div style={{background:'#FEE2E2',color:'#B91C1C',borderRadius:10,padding:'10px 14px',fontSize:13,marginBottom:14,fontWeight:500}}>{msg}</div>
}

function OkBox({ msg }) {
  if (!msg) return null
  return <div style={{background:'#D1FAE5',color:'#065F46',borderRadius:10,padding:'10px 14px',fontSize:13,marginBottom:14,fontWeight:500}}>{msg}</div>
}

function Header({ title, sub }) {
  return (
    <div style={{textAlign:'center',marginBottom:28}}>
      <div style={{fontSize:40,marginBottom:8}}>🌸</div>
      <div style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:700,color:P}}>{title}</div>
      {sub && <div style={{fontSize:13,color:'#999',marginTop:4}}>{sub}</div>}
    </div>
  )
}

/* ── LOGIN ── */
function LoginView({ onLogin, switchTo }) {
  const [email, setEmail] = useState('')
  const [pass,  setPass ] = useState('')
  const [err,   setErr  ] = useState('')
  const [busy,  setBusy ] = useState(false)

  async function submit() {
    setErr('')
    if (!email.trim() || !pass) return setErr('Completa todos los campos')
    setBusy(true)
    try {
      const hash = await hashPassword(pass)
      const data = await authLogin(email.trim().toLowerCase(), hash)
      onLogin(data.email, data.role || 'Empleada', data.name || '')
    } catch(e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={card}>
      <Header title="SZ Micropigmentación" sub="Inicia sesión para continuar" />
      <ErrBox msg={err} />
      <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
      <Field label="Contraseña" type="password" value={pass} onChange={setPass} placeholder="••••••••" />
      <button style={btn} onClick={submit} disabled={busy}>
        {busy ? 'Verificando…' : 'Iniciar sesión'}
      </button>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:18}}>
        <button style={link} onClick={()=>switchTo('register')}>Registrarme</button>
        <button style={link} onClick={()=>switchTo('forgot')}>Olvidé mi contraseña</button>
      </div>
    </div>
  )
}

/* ── REGISTER ── */
function RegisterView({ onLogin, switchTo }) {
  const [nombre, setNombre] = useState('')
  const [email,  setEmail ] = useState('')
  const [pass,   setPass  ] = useState('')
  const [pass2,  setPass2 ] = useState('')
  const [err,    setErr   ] = useState('')
  const [busy,   setBusy  ] = useState(false)

  async function submit() {
    setErr('')
    if (!nombre.trim()) return setErr('Ingresa tu nombre')
    if (!email.trim() || !pass || !pass2) return setErr('Completa todos los campos')
    if (pass.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres')
    if (pass !== pass2) return setErr('Las contraseñas no coinciden')
    setBusy(true)
    try {
      const hash = await hashPassword(pass)
      const cleanName = nombre.trim().replace(/\b\w/g, c => c.toUpperCase())
      const data = await authRegister(email.trim().toLowerCase(), hash, cleanName)
      onLogin(data.email, data.role || 'Empleada', data.name || cleanName)
    } catch(e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={card}>
      <Header title="Crear cuenta" sub="Solo correos autorizados pueden registrarse" />
      <ErrBox msg={err} />
      <Field label="Tu nombre completo" value={nombre} onChange={setNombre} placeholder="Ej: Salomé Zuluaga" />
      <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
      <Field label="Contraseña" type="password" value={pass} onChange={setPass} placeholder="Mínimo 8 caracteres" />
      <Field label="Confirmar contraseña" type="password" value={pass2} onChange={setPass2} placeholder="Repite la contraseña" />
      <button style={btn} onClick={submit} disabled={busy}>
        {busy ? 'Registrando…' : 'Crear cuenta'}
      </button>
      <div style={{textAlign:'center',marginTop:18}}>
        <button style={link} onClick={()=>switchTo('login')}>← Volver al login</button>
      </div>
    </div>
  )
}

/* ── FORGOT PASSWORD ── */
function ForgotView({ switchTo }) {
  const [step,    setStep   ] = useState('email') // email | code
  const [email,   setEmail  ] = useState('')
  const [code,    setCode   ] = useState('')
  const [pass,    setPass   ] = useState('')
  const [pass2,   setPass2  ] = useState('')
  const [err,     setErr    ] = useState('')
  const [ok,      setOk     ] = useState('')
  const [busy,    setBusy   ] = useState(false)

  async function sendCode() {
    setErr(''); setOk('')
    if (!email.trim()) return setErr('Ingresa tu correo')
    setBusy(true)
    try {
      await authRequestReset(email.trim().toLowerCase())
      setOk('✉️ Código enviado. Revisa tu correo (y la carpeta de spam).')
      setStep('code')
    } catch(e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function resetPass() {
    setErr(''); setOk('')
    if (!code.trim() || !pass || !pass2) return setErr('Completa todos los campos')
    if (pass.length < 8) return setErr('La contraseña debe tener al menos 8 caracteres')
    if (pass !== pass2) return setErr('Las contraseñas no coinciden')
    setBusy(true)
    try {
      const hash = await hashPassword(pass)
      await authResetPassword(email.trim().toLowerCase(), code.trim(), hash)
      setOk('✅ Contraseña actualizada. Ya puedes iniciar sesión.')
      setTimeout(() => switchTo('login'), 2000)
    } catch(e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={card}>
      <Header title="Recuperar contraseña" sub={step==='email' ? 'Te enviaremos un código a tu correo' : 'Ingresa el código que te enviamos'} />
      <ErrBox msg={err} />
      <OkBox  msg={ok}  />

      {step === 'email' ? <>
        <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
        <button style={btn} onClick={sendCode} disabled={busy}>{busy ? 'Enviando…' : 'Enviar código'}</button>
        <div style={{textAlign:'center',marginTop:18}}>
          <button style={link} onClick={()=>switchTo('login')}>← Volver al login</button>
        </div>
      </> : <>
        <div style={{background:PL,borderRadius:10,padding:'10px 14px',fontSize:13,color:'#555',marginBottom:14}}>
          Código enviado a <strong>{email}</strong>
        </div>
        <Field label="Código de 6 dígitos" value={code} onChange={setCode} placeholder="123456" />
        <Field label="Nueva contraseña" type="password" value={pass} onChange={setPass} placeholder="Mínimo 8 caracteres" />
        <Field label="Confirmar contraseña" type="password" value={pass2} onChange={setPass2} placeholder="Repite la contraseña" />
        <button style={btn} onClick={resetPass} disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:18}}>
          <button style={link} onClick={()=>setStep('email')}>Reenviar código</button>
          <button style={link} onClick={()=>switchTo('login')}>← Volver</button>
        </div>
      </>}
    </div>
  )
}

/* ── CHANGE PASSWORD MODAL (used inside the app) ── */
export function ChangePasswordModal({ email, onClose }) {
  const [current, setCurrent] = useState('')
  const [pass,    setPass   ] = useState('')
  const [pass2,   setPass2  ] = useState('')
  const [err,     setErr    ] = useState('')
  const [ok,      setOk     ] = useState('')
  const [busy,    setBusy   ] = useState(false)

  async function submit() {
    setErr(''); setOk('')
    if (!current || !pass || !pass2) return setErr('Completa todos los campos')
    if (pass.length < 8) return setErr('La contraseña nueva debe tener al menos 8 caracteres')
    if (pass !== pass2) return setErr('Las contraseñas nuevas no coinciden')
    if (current === pass) return setErr('La nueva contraseña debe ser diferente a la actual')
    setBusy(true)
    try {
      const { authChangePassword } = await import('./api.js')
      const curHash = await hashPassword(current)
      const newHash = await hashPassword(pass)
      await authChangePassword(email, curHash, newHash)
      setOk('✅ Contraseña cambiada exitosamente')
      setTimeout(onClose, 1800)
    } catch(e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{...card,maxWidth:380}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:17,fontWeight:700,color:P}}>Cambiar contraseña</div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#999'}}>✕</button>
        </div>
        <ErrBox msg={err} />
        <OkBox  msg={ok}  />
        <Field label="Contraseña actual"   type="password" value={current} onChange={setCurrent} placeholder="Tu contraseña actual" />
        <Field label="Nueva contraseña"    type="password" value={pass}    onChange={setPass}    placeholder="Mínimo 8 caracteres"  />
        <Field label="Confirmar contraseña" type="password" value={pass2}  onChange={setPass2}   placeholder="Repite la nueva"       />
        <button style={btn} onClick={submit} disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </div>
    </div>
  )
}

/* ── AUTH SHELL ── */
export default function AuthShell({ children, onLogin, onLogout, userEmail, userRole, userName }) {
  const [view, setView] = useState('login')

  // Already logged in — render the app
  if (userEmail) return children

  const wrap = (
    <div style={{minHeight:'100vh',background:PL,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 16px'}}>
      <div style={{width:'100%',maxWidth:400}}>
        {view === 'login'    && <LoginView    onLogin={onLogin} switchTo={setView} />}
        {view === 'register' && <RegisterView onLogin={onLogin} switchTo={setView} />}
        {view === 'forgot'   && <ForgotView                     switchTo={setView} />}
      </div>
      <p style={{marginTop:24,fontSize:11,color:'#ccc',textAlign:'center'}}>
        SZ Micropigmentación © {new Date().getFullYear()}
      </p>
    </div>
  )

  return wrap
}
