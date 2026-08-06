const URL   = import.meta.env.VITE_SCRIPT_URL
const TOKEN = import.meta.env.VITE_TOKEN

// SHA-256 hash in the browser (Web Crypto API)
export async function hashPassword(password) {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

async function authPost(action, payload) {
  if (!URL) throw new Error('VITE_SCRIPT_URL no configurado')
  const res = await fetch(URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body:    JSON.stringify({ token: TOKEN, action, ...payload }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Error de autenticación')
  return json.data
}

export const authLogin         = (email, passwordHash) => authPost('auth_login',          { email, passwordHash })
export const authRegister      = (email, passwordHash, name) => authPost('auth_register', { email, passwordHash, name })
export const authRequestReset  = (email)               => authPost('auth_request_reset',  { email })
export const authResetPassword = (email, code, newHash)=> authPost('auth_reset_password', { email, code, newHash })
export const authChangePassword= (email, currentHash, newHash) => authPost('auth_change_password', { email, currentHash, newHash })

export async function loadData() {
  if (!URL) throw new Error('VITE_SCRIPT_URL no configurado')
  const res  = await fetch(`${URL}?token=${encodeURIComponent(TOKEN)}&t=${Date.now()}`, { cache:'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error||'Error cargando datos')
  return json.data
}

export async function saveData(payload, userEmail) {
  if (!URL) throw new Error('VITE_SCRIPT_URL no configurado')
  const res = await fetch(URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body:    JSON.stringify({ token: TOKEN, ...(userEmail ? { userEmail } : {}), ...payload }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error||'Error guardando')
  return json.data
}

export async function getAuditReport(month, userEmail) {
  return saveData({ action: 'get_audit_report', month }, userEmail)
}

export async function updateUserRole(targetEmail, newRole, userEmail) {
  return saveData({ action: 'update_user_role', targetEmail, newRole }, userEmail)
}

export async function fullReset(userEmail) {
  return saveData({ action: 'full_reset' }, userEmail)
}
