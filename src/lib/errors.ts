/** Formato comum dos erros do Supabase (auth e banco) e de falhas de rede. */
export interface AppError { message?: string; code?: string | number; error_code?: string; status?: number; name?: string }

const NETWORK = /failed to fetch|networkerror|load failed|network request failed|fetch failed/i

export const isNetworkError = (e?: AppError | null): boolean => !!e && NETWORK.test(`${e.message ?? ''} ${e.name ?? ''}`)

/** Mensagem de erro de LOGIN/CADASTRO em português claro: o que houve e o que fazer. */
export function friendlyAuthError(e: AppError | null | undefined): string {
  if (!e) return 'Não foi possível concluir. Tente de novo.'
  const code = String(e.error_code ?? e.code ?? '').toLowerCase()
  const msg = e.message ?? ''
  if (isNetworkError(e)) return 'Sem conexão com o servidor. Confira a sua internet e tente de novo.'
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos. Confira os dois e tente de novo.'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return 'Seu e-mail ainda não foi confirmado. Abra o link que enviamos para a sua caixa de entrada (veja também o spam).'
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already been registered/i.test(msg)) return 'Já existe uma conta com este e-mail. Use a aba “Entrar” com a sua senha.'
  const min = msg.match(/at least (\d+) characters/i)
  if (code === 'weak_password' || min) return `A senha é muito fraca. Use pelo menos ${min?.[1] ?? 8} caracteres, misturando letras e números.`
  if (code === 'validation_failed' || /invalid format|unable to validate email/i.test(msg)) return 'Esse e-mail não parece válido. Confira se digitou certo.'
  if (/over_.*rate_limit|rate limit|too many requests|only request this after/i.test(`${code} ${msg}`) || e.status === 429) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.'
  if (code === 'signup_disabled' || /signups? (are |is )?(not allowed|disabled)/i.test(msg)) return 'O cadastro de novas contas está desativado no momento.'
  if (code === 'user_banned' || /banned/i.test(msg)) return 'Esta conta está bloqueada. Entre em contato com quem administra o app.'
  if (e.status && e.status >= 500) return 'O servidor está com problemas agora. Tente de novo em alguns minutos.'
  return 'Não foi possível concluir. Tente de novo; se o erro continuar, recarregue a página.'
}

/**
 * Mensagem de erro de uma AÇÃO no app (salvar, excluir…): diz o que não deu certo e por quê, sem jargão.
 * `action` completa a frase: "salvar a meta" → "Não foi possível salvar a meta. …".
 */
export function friendlyError(e: unknown, action = 'salvar'): string {
  const err = (e && typeof e === 'object' ? e : { message: String(e ?? '') }) as AppError
  if (typeof console !== 'undefined') console.error('[gastai]', e) // o detalhe técnico fica no console, para depuração
  const code = String(err.code ?? '')
  const msg = err.message ?? ''
  let why: string
  if (isNetworkError(err)) why = 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  else if (code === '23505') why = 'Esse item já existe.'
  else if (code === '23503') why = 'Ele está ligado a outros dados e não pode ser alterado assim.'
  else if (code === '23514') why = 'Algum valor está fora do permitido. Confira números e datas.'
  else if (code === '23502') why = 'Falta preencher um campo obrigatório.'
  else if (['22P02', '22007', '22003', '22008'].includes(code)) why = 'Algum valor está em formato inválido. Confira o que digitou.'
  else if (code === '42501' || /row-level security|permission denied/i.test(msg)) why = 'Você não tem permissão para isso. Saia e entre de novo; se continuar, a conta pode estar sem acesso.'
  else if (['PGRST301', 'PGRST303'].includes(code) || /jwt (expired|invalid)/i.test(msg)) why = 'Sua sessão expirou. Entre de novo para continuar.'
  else if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code)) why = 'Esta função ainda não está disponível no banco de dados (falta uma atualização).'
  else if (err.status && err.status >= 500) why = 'O servidor está com problemas agora. Tente de novo em alguns minutos.'
  else why = 'Ocorreu um erro inesperado. Tente de novo; se repetir, recarregue a página.'
  return `Não foi possível ${action}. ${why}`
}
