export const SCENARIOS = [
  'default',
  'empty',
  'slow',
  'variable_latency',
  'out_of_order',
  'offline',
  'server_error',
  'flaky',
  'session_expired',
  'favorites_fail',
  'price_changed_at_checkout',
  'sold_out_at_checkout',
  'order_timeout',
  'payment_declined',
] as const

export type ScenarioName = (typeof SCENARIOS)[number]

const KEY = 'kurio:mock:scenario'

/** Efeitos de uso único: disparam uma vez e se desarmam sozinhos. */
const fired = new Set<string>()

let current: ScenarioName = 'default'

export function loadScenario(): ScenarioName {
  const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get('scenario')
  const stored = globalThis.localStorage?.getItem(KEY)
  const pick = (fromUrl ?? stored ?? 'default') as ScenarioName
  current = (SCENARIOS as readonly string[]).includes(pick) ? pick : 'default'
  if (fromUrl) globalThis.localStorage?.setItem(KEY, current)
  return current
}

export function getScenario(): ScenarioName {
  return current
}

export function setScenario(name: ScenarioName) {
  current = name
  fired.clear()
  callCounters.clear()
  try {
    globalThis.localStorage?.setItem(KEY, name)
  } catch {
    /* storage indisponível: o cenário vale só para esta sessão */
  }
}

/** true apenas na primeira chamada para (cenário, chave). */
export function once(key: string): boolean {
  const id = `${current}:${key}`
  if (fired.has(id)) return false
  fired.add(id)
  return true
}

const callCounters = new Map<string, number>()
export function nextCall(key: string): number {
  const n = (callCounters.get(key) ?? 0) + 1
  callCounters.set(key, n)
  return n
}

/** Latência determinística por cenário (ms). */
export function latencyFor(path: string): number {
  switch (current) {
    case 'slow':
      return 2500
    case 'variable_latency': {
      const n = nextCall('latency')
      return [120, 1400, 300, 900, 200][n % 5]
    }
    case 'out_of_order':
      // A 1ª busca de catálogo responde por último; as seguintes são rápidas.
      if (path.startsWith('/api/nfts') && !path.match(/\/api\/nfts\/[^/?]+/)) {
        return nextCall('nfts-list') % 2 === 1 ? 1600 : 80
      }
      return 60
    default:
      return 80
  }
}
