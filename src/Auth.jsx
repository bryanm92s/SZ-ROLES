import { useState } from 'react'
import { hashPassword, authLogin, authRegister, authRequestReset, authResetPassword } from './api.js'

/* ── palette (matches App.jsx) ── */
const P  = '#B5524A'
const PD = '#8E3E38'
const PL = '#FAEAE8'
const BG = '#F7F0EC'

const inp = {
  width:'100%', padding:'12px 14px', border:'1.5px solid var(--border)',
  borderRadius:'var(--radius-md)', fontSize:15, fontFamily:'inherit',
  background:'white', outline:'none', boxSizing:'border-box',
  transition:'all .15s', boxShadow:'var(--neumorph-shadow-inset)',
}
const btn = {
  width:'100%', padding:'13px', background:'var(--primary)', color:'white',
  border:'none', borderRadius:'var(--radius-md)', fontSize:15, fontWeight:700,
  cursor:'pointer', fontFamily:'inherit', marginTop:4,
  transition:'all .15s', boxShadow:'0 2px 8px rgba(181,82,74,0.3)',
}
const link = {
  background:'none', border:'none', color:'var(--primary)', fontSize:13,
  cursor:'pointer', fontFamily:'inherit', fontWeight:600,
  textDecoration:'underline', padding:0,
}
const card = {
  background:'var(--card)', borderRadius:'var(--radius-xl)', padding:'32px 28px',
  boxShadow:'var(--flat-shadow)',
  width:'100%', maxWidth:400, margin:'0 auto',
  border:'1px solid var(--border)',
}

function Field({ label, type='text', value, onChange, placeholder }) {
  const [focus, setFocus] = useState(false)
  return (
    <div style={{marginBottom:16}}>
      <label className="lbl" style={{fontSize:11}}>{label}</label>
      <input
        type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        style={{...inp, borderColor: focus ? 'var(--primary)' : 'var(--border)'}}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
      />
    </div>
  )
}

function ErrBox({ msg }) {
  if (!msg) return null
  return <div className="warn-box" style={{background:'#FEE2E2',borderColor:'#FECACA',color:'#B91C1C'}}>{msg}</div>
}

function OkBox({ msg }) {
  if (!msg) return null
  return <div className="warn-box" style={{background:'#D1FAE5',borderColor:'#A7F3D0',color:'#065F46'}}>{msg}</div>
}

function Header({ title, sub }) {
  return (
    <div style={{textAlign:'center',marginBottom:28}}>
      <div style={{fontSize:44,marginBottom:10}}>🌸</div>
      <div style={{fontFamily:'Georgia,serif',fontSize:22,fontWeight:700,background:'var(--grad-header)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{title}</div>
      {sub && <div style={{fontSize:13,color:'var(--t2)',marginTop:4}}>{sub}</div>}
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
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px 16px'}}>
      <div style={{width:'100%',maxWidth:400}}>
        {view === 'login'    && <LoginView    onLogin={onLogin} switchTo={setView} />}
        {view === 'register' && <RegisterView onLogin={onLogin} switchTo={setView} />}
        {view === 'forgot'   && <ForgotView                     switchTo={setView} />}
      </div>
      <p style={{marginTop:24,fontSize:11,color:'var(--t2)',textAlign:'center'}}>
        SZ Micropigmentación © {new Date().getFullYear()}
      </p>
    </div>
  )

  return wrap
}
