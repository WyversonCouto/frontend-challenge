import { http } from '@/lib/api'
import type { Nft, NftListParams, NftPage } from '@/lib/types'

export const nftKeys = {
  list: (p: NftListParams) => ['nfts', p] as const,
  detail: (id: string) => ['nft', id] as const,
}

/** O signal cancela a requisição quando a chave muda: respostas obsoletas são descartadas. */
export const fetchNfts = (params: NftListParams, signal?: AbortSignal) =>
  http.get<NftPage>('/nfts', { params, signal }).then((r) => r.data)

export const fetchNft = (id: string, signal?: AbortSignal) =>
  http.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal }).then((r) => r.data)
