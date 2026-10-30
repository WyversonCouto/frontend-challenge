/**
 * Teste de fumaça da camada de mocks fora do navegador (Node + msw/node).
 * Valida REST e o caminho real socket.io-client -> MSW ws -> evento.
 * Rodar: npm run smoke
 */
import { setupServer } from 'msw/node'
import { controlHandlers, restHandlers } from '../src/mocks/handlers'
import { socketHandlers } from '../src/mocks/socket'
import { initDb } from '../src/mocks/db'
import { setScenario } from '../src/mocks/scenarios'

const BASE = 'http://localhost'
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FALHOU: ${msg}`)
  console.log(`ok  ${msg}`)
}
const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
  const { token, ...rest } = init
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(rest.headers ?? {}) },
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}

await initDb()
setScenario('default')
const server = setupServer(...controlHandlers, ...restHandlers, ...socketHandlers)
server.listen({ onUnhandledRequest: 'bypass' })

// --- REST ---
const login = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'ana@kurio.test', password: 'Kurio@123' }) })
assert(login.status === 200 && login.json.token, 'login com credenciais fictícias')
const token = login.json.token as string
const bad = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'ana@kurio.test', password: 'errada' }) })
assert(bad.status === 401, 'login com senha errada retorna 401')

const page1 = await call('/api/nfts?pageSize=9&page=1')
assert(page1.json.items.length === 9 && page1.json.totalPages > 1, 'listagem paginada')
const filtered = await call('/api/nfts?category=Música&sort=price_desc')
assert(filtered.json.items.every((n: any) => n.category === 'Música'), 'filtro por categoria')
assert((await call('/api/nfts/nao-existe')).status === 404, 'NFT inexistente retorna 404')

// --- Cotação, carrinho e pedido idempotente ---
const items = [{ nftId: 'nft-001', quantity: 2 }]
const quote = (await call('/api/quote', { method: 'POST', body: JSON.stringify({ items, coupon: 'KURIO10' }) })).json
assert(quote.subtotal === '2.38' && quote.discount === '0.238' && quote.total === '2.158', `cotação precisa (total ${quote.total})`)

const order = {
  items, coupon: 'KURIO10', walletId: 'wallet-ana-1', network: 'Ethereum',
  buyer: { displayName: 'Ana Souza', email: 'ana@kurio.test' },
  expectedTotal: quote.total, expectedFingerprint: quote.fingerprint,
}
const created = await call('/api/orders', { method: 'POST', token, headers: { 'Idempotency-Key': 'k1' }, body: JSON.stringify(order) })
assert(created.status === 201 && created.json.status === 'pending', 'pedido criado como pendente')
const retry = await call('/api/orders', { method: 'POST', token, headers: { 'Idempotency-Key': 'k1' }, body: JSON.stringify(order) })
assert(retry.json.id === created.json.id, 'mesma chave recupera o mesmo pedido')
const conflict = await call('/api/orders', { method: 'POST', token, headers: { 'Idempotency-Key': 'k1' }, body: JSON.stringify({ ...order, coupon: undefined }) })
assert(conflict.status === 409 && conflict.json.code === 'idempotency_conflict', 'mesma chave com outro conteúdo gera conflito')
const stale = await call('/api/orders', { method: 'POST', token, headers: { 'Idempotency-Key': 'k2' }, body: JSON.stringify({ ...order, expectedFingerprint: 'velho' }) })
assert(stale.status === 409 && stale.json.code === 'price_changed', 'cotação desatualizada bloqueia a compra')
assert((await call('/api/orders/' + created.json.id)).status === 401, 'pedido exige autenticação')

// --- Socket.IO real (socket.io-client) interceptado pelo MSW ---
// Em Node usamos o build UMD de navegador, que lê o WebSocket global. Ele precisa ser
// importado DEPOIS do server.listen(), senão captura o WebSocket original.
// @ts-ignore: sem tipos para o caminho dist
const sio = (await import('socket.io-client/dist/socket.io.js')).default as any
const io: typeof import('socket.io-client').io = sio.io ?? sio
const events: any[] = []
const sock = io(BASE, { path: '/socket.io/', transports: ['websocket'], auth: { token }, reconnection: false })
await new Promise<void>((resolve, reject) => {
  sock.on('connect', () => resolve())
  sock.on('connect_error', reject)
  setTimeout(() => reject(new Error('timeout ao conectar socket')), 4000)
})
assert(sock.connected, 'socket.io-client conectou pelo MSW')
sock.on('nft.updated', (e) => events.push(['nft', e]))
sock.on('order.updated', (e) => events.push(['order', e]))

await call('/__mock/nfts/nft-002', { method: 'POST', body: JSON.stringify({ price: '9.99' }) })
await new Promise((r) => setTimeout(r, 200))
const nftEvt = events.find((e) => e[0] === 'nft' && e[1].id === 'nft-002')
assert(nftEvt && nftEvt[1].price === '9.99' && nftEvt[1].version === 2, 'nft.updated chega com preço e versão')

await call(`/__mock/orders/${created.json.id}/settle`, { method: 'POST' })
await new Promise((r) => setTimeout(r, 200))
const ordEvt = events.find((e) => e[0] === 'order')
assert(ordEvt && ordEvt[1].status === 'confirmed', 'order.updated confirma o pedido pelo socket')

sock.disconnect()
server.close()
console.log('\nTodos os testes de fumaça passaram.')
process.exit(0)
