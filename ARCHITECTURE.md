# Arquitetura — Kurio

## Camadas

```
UI (routes/, components/)  →  hooks de feature (features/*)  →  Axios (lib/api.ts)  →  MSW (mocks/)
                                     ↑                                              ↓
                              TanStack Query  ←  realtime.ts  ←  socket.io-client  ←  MSW ws
```

- **Router (TanStack Router, código):** a busca do catálogo vive na URL (`q, category, network, minPrice, maxPrice, sort, tab, page`), validada em `validateHomeSearch`. Mudar qualquer filtro reinicia `page`. Rotas privadas usam `beforeLoad` e voltam ao fluxo (`?redirect=`) depois do login.
- **Estado remoto (TanStack Query):** toda leitura é `useQuery` e toda escrita passa por mutation ou helper com rollback.
- **HTTP:** só Axios (`lib/api.ts`). Erros viram `ApiError` (status, código, campos, `retryable`, `network`).
- **Mocks:** só na camada de rede (`src/mocks`). Componentes, hooks e Axios não têm respostas fictícias nem caminhos alternativos.

## Sessão
Token opaco emitido pela API simulada, guardado em `localStorage` junto do usuário; senhas nunca ficam em claro (SHA-256 com salt, só no servidor simulado). `restoreSession()` revalida no boot. 401 `session_expired` em qualquer chamada: encerra a sessão, limpa o cache, fecha o socket e leva ao login com `?redirect=<rota atual>&expired=true`. Troca de usuário e logout chamam `queryClient.clear()` e fecham/reabrem o socket, então cache privado e subscriptions não passam de uma sessão para outra. Chaves de dados privados começam com `['user', userId, …]`.

## Carrinho
- **Visitante:** `localStorage` (`guestCart.ts`). **Autenticado:** API é a fonte da verdade, com atualização otimista e rollback.
- Ao autenticar, `mergeGuestCart()` mescla os itens do visitante (respeitando o estoque).
- O limite de quantidade vem do estoque atual do NFT (`editionsAvailable`).
- Preço, desconto, taxa e total vêm **sempre** de `POST /api/quote` (a cotação da API é a referência). Valores em ETH são strings decimais; contas em `lib/eth.ts` com BigInt (18 casas).

## Pedidos e idempotência
`POST /api/orders` exige `Idempotency-Key`. A chave é derivada do conteúdo (`intentKey` em `checkout.tsx`) e guardada em `sessionStorage`: repetir o envio com o mesmo conteúdo (clique repetido, timeout, refresh) recupera o mesmo pedido; conteúdo diferente com a mesma chave gera `409 idempotency_conflict`. O botão fica desabilitado enquanto há envio em andamento. Antes da revisão final o cliente refaz a cotação; o servidor valida de novo (`price_changed`/`sold_out` devolvem a cotação nova e exigem nova confirmação). O pedido nasce `pending`, reserva o estoque e termina `confirmed` ou `declined` (estados terminais). Só um pedido confirmado mostra o recibo, que reproduz o snapshot guardado no pedido.

## Política de cache e retries
- `staleTime` 30 s; `gcTime` 5 min; `refetchOnReconnect` ligado; `refetchOnWindowFocus` desligado.
- Leituras repetem até 2 vezes com backoff, **só** para falhas transitórias (rede, 5xx, 429). Mutations não repetem sozinhas.
- Catálogo: `placeholderData: keepPreviousData` e `signal` do Axios; respostas fora de ordem são descartadas porque cada resposta pertence à sua chave de consulta.
- Pedido pendente: `refetchInterval` de 3 s (cobre queda de conexão) além do evento `order.updated`.

## Tempo real (Socket.IO)
`socket.io-client` real, interceptado por `ws.link` do MSW com `@mswjs/socket.io-binding`. Eventos: `nft.updated` e `order.updated`, com `eventId` estável e `version`. O cliente (`features/realtime.ts`):
- ignora `eventId` já visto (duplicata) e eventos com `version` ≤ à do cache (antigos);
- atualiza catálogo, detalhe e invalida a cotação (resumo do carrinho e do checkout);
- só aceita `order.updated` do usuário da sessão atual; o servidor simulado também só entrega ao dono;
- ao reconectar, invalida tudo que está ativo (reconciliação com o REST);
- ao trocar de sessão, descarta o socket e o conjunto de eventos vistos.

**Limitações do ambiente de mocks:** só transporte `websocket` (sem long-polling); sem rooms/namespaces nativos (o roteamento por usuário é feito em `mocks/bus.ts`); o token de auth é lido do pacote CONNECT (`40{…}`); `@mswjs/socket.io-binding@0.2` exige `msw@^2` (a v3 conflita).

## Decisões de UX e desvios do Figma
- **Login/Cadastro:** o Figma mostra o modal sobre a vitrine; aqui o modal (`<dialog>` nativo, foco preso, Esc fecha) fica sobre um fundo simples. No mobile vira tela cheia.
- **Cadastro:** o Figma não tem campo de nome; usa-se o nome de usuário como nome.
- **Imagens:** as ilustrações do Figma não acompanham o enunciado. Cada NFT usa uma arte SVG determinística gerada em `mocks/db.ts` (sem rede, sem licença).
- **Pagamento:** os dados da carteira (endereço, tipo, ENS, código de indicação) vêm do cadastro e aparecem somente leitura; editáveis são nome de exibição, e-mail, rede e observação. A conexão da carteira é simulada (a Coinbase Wallet das fixtures sempre recusa).
- **Ações fora do escopo** (Criadores, Aprender, redes sociais, login social, newsletter, "Ver no Etherscan", compartilhar) só avisam que não fazem parte da demonstração; nunca aparentam sucesso.
- **Tokens de cor/tipografia** em `src/index.css` foram estimados dos prints e precisam ser conferidos no Figma.
