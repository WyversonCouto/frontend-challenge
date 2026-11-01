export interface AuthSearch {
  redirect?: string
  expired?: boolean
}

/** Só aceita retorno para caminhos internos (evita open redirect). */
export function safeRedirect(path?: string) {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

export function validateAuthSearch(s: Record<string, unknown>): AuthSearch {
  return {
    redirect: typeof s.redirect === 'string' ? safeRedirect(s.redirect) : undefined,
    expired: s.expired === true || s.expired === 'true' ? true : undefined,
  }
}
