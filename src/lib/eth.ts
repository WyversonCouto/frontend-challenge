/**
 * Aritmética de ETH com precisão fixa de 18 casas, usando BigInt.
 * Valores trafegam como strings decimais ("1.19") e nunca como number.
 */
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)

export type Eth = string

export function toWei(value: Eth): bigint {
  const v = value.trim()
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`Valor ETH inválido: "${value}"`)
  const [int, frac = ''] = v.split('.')
  const padded = (frac + '0'.repeat(DECIMALS)).slice(0, DECIMALS)
  return BigInt(int) * SCALE + BigInt(padded)
}

export function fromWei(wei: bigint): Eth {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? '.' + frac : ''}`
}

export const addEth = (a: Eth, b: Eth): Eth => fromWei(toWei(a) + toWei(b))
export const subEth = (a: Eth, b: Eth): Eth => fromWei(toWei(a) - toWei(b))
export const mulEthInt = (a: Eth, qty: number): Eth => fromWei(toWei(a) * BigInt(qty))

/** Percentual em pontos-base (1000 = 10%). Arredonda para baixo. */
export const pctEth = (a: Eth, basisPoints: number): Eth =>
  fromWei((toWei(a) * BigInt(basisPoints)) / 10000n)

export const cmpEth = (a: Eth, b: Eth): number => {
  const x = toWei(a)
  const y = toWei(b)
  return x === y ? 0 : x > y ? 1 : -1
}

export const sumEth = (values: Eth[]): Eth => fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))

/** Apresentação: arredonda só na tela; o valor exato continua guardado em string. */
export function formatEth(value: Eth, minFraction = 2, maxFraction = 3): string {
  const wei = toWei(value)
  const unit = 10n ** BigInt(DECIMALS - maxFraction)
  const rounded = ((wei + unit / 2n) / unit) * unit
  const [int, frac = ''] = fromWei(rounded).split('.')
  return `${int},${frac.padEnd(minFraction, '0')} ETH`
}
