export type AuthMode = 'in' | 'up'
export const MIN_PASSWORD = 8

export interface AuthFields { email: string; password: string; confirm: string }
export type AuthFieldErrors = Partial<Record<keyof AuthFields, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Valida o formulário antes de falar com o servidor. No login só exige preenchimento; no cadastro, também a senha. */
export function validateAuth(mode: AuthMode, f: AuthFields): AuthFieldErrors {
  const out: AuthFieldErrors = {}
  const email = f.email.trim()
  if (!email) out.email = 'Informe o seu e-mail.'
  else if (!EMAIL.test(email)) out.email = 'Esse e-mail não parece válido. Exemplo: nome@email.com'
  if (!f.password) out.password = 'Informe a sua senha.'
  else if (mode === 'up' && f.password.length < MIN_PASSWORD) out.password = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`
  if (mode === 'up' && f.password && !out.password) {
    if (!f.confirm) out.confirm = 'Digite a senha de novo para confirmar.'
    else if (f.confirm !== f.password) out.confirm = 'As senhas não são iguais.'
  }
  return out
}
