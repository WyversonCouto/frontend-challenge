# Kurio — Marketplace de NFTs

Desafio Frontend: React + TypeScript, TanStack Router/Query, Axios, Socket.IO, Tailwind, shadcn/ui, MSW, Playwright e Lighthouse.

> Estado atual: telas de início, detalhe, carrinho, pagamento, confirmação, login, cadastro, perfil e carteiras (desktop e mobile),
> sobre contratos tipados e a camada MSW (REST + Socket.IO). Testes Playwright e auditoria Lighthouse: próximos passos.

## Setup

```bash
npm install
npm run dev          # desenvolvimento, com mocks ligados
npm run typecheck
npm run lint
npm run build && npm run preview
npm run smoke        # valida REST + Socket.IO da camada de mocks fora do navegador
npm run test:e2e     # Playwright (sobe build + preview sozinho)
npm run test:e2e:update  # cria/atualiza as baselines da regressão visual
npm run e2e:report   # abre o relatório HTML
```

Variável de ambiente: `VITE_ENABLE_MOCKS` (padrão ligada; `false` desliga o MSW).

## Credenciais fictícias

| Usuário | E-mail | Senha | Carteiras |
| --- | --- | --- | --- |
| Ana | ana@kurio.test | Kurio@123 | principal (MetaMask) e secundária (Coinbase Wallet, **sempre recusa conexão**) |
| Bruno | bruno@kurio.test | Kurio@123 | nenhuma |

Cupons: `KURIO10` (10%), `LANCAMENTO5` (5%), `EXPIRADO` (expirado). Qualquer outro é inválido.

## Cenários de mock

Escolha por `?scenario=<nome>` na URL (fica salvo no navegador) ou `POST /__mock/scenario {"name": "..."}`.
`POST /__mock/reset` restaura o cenário conhecido (dados, sessões e cenário).

| Cenário | Efeito |
| --- | --- |
| `default` | sucesso, latência baixa |
| `empty` | catálogo sem resultados |
| `slow` | 2,5 s em toda resposta |
| `variable_latency` | latência variável e determinística |
| `out_of_order` | a 1ª busca do catálogo responde por último |
| `offline` | falha de conexão em tudo |
| `server_error` | HTTP 503 em `GET /api/nfts` |
| `flaky` | a 1ª chamada de cada busca falha; a repetição funciona |
| `session_expired` | a próxima chamada autenticada devolve 401 `session_expired` |
| `favorites_fail` | mutations de favoritos falham (503) |
| `price_changed_at_checkout` | o preço muda ao criar o pedido (409 `price_changed`) |
| `sold_out_at_checkout` | a edição esgota ao criar o pedido (409 `sold_out`) |
| `order_timeout` | o pedido é criado, mas a resposta se perde; repetir com a mesma `Idempotency-Key` recupera o mesmo pedido |
| `payment_declined` | o pedido termina como recusado |

## Controle do ambiente simulado (demo e testes)

Chamados pelo `fetch` da própria página (o MSW intercepta no navegador):

- `POST /__mock/nfts/:id` `{price?, editionsAvailable?}` altera o NFT e emite `nft.updated` pelo Socket.IO
- `POST /__mock/socket/emit` `{event, payload}` entrega um evento como recebido (duplicata, versão antiga, outro usuário)
- `POST /__mock/socket/disconnect` derruba as conexões (reconexão e reconciliação)
- `POST /__mock/orders/:id/settle` resolve um pedido pendente na hora

## Deploy

`vercel.json` já reescreve rotas para `index.html` (refresh e acesso direto) e preserva `mockServiceWorker.js`.

## Testes E2E (Playwright)

```bash
npx playwright install chromium     # uma vez
npm run test:e2e:update             # 1ª vez: gera as baselines visuais (e2e/visual.spec.ts-snapshots/)
npm run test:e2e
npm run e2e:report                  # relatório HTML; traces das falhas ficam em test-results/
```

- Roda contra o build otimizado com o MSW ativo. Cada teste abre um contexto novo: o "banco" simulado vive no `localStorage` do contexto, então todo teste começa de um estado conhecido.
- Projetos: `desktop` (1440×900, todos os testes), `mobile` (390×844: compra, autenticação, carrinho e responsividade) e `tablet` (768×1024: responsividade).
- REST passa pelos handlers MSW; tempo real passa pelo `socket.io-client` real (eventos disparados por `/__mock/...`, nunca por setters na UI).
- Latência e falhas são controladas pelos cenários (`?scenario=...`), então os testes sensíveis a tempo não dependem de relógio real.

> **Regressão visual:** as capturas de referência dependem do sistema operacional (o Playwright acrescenta `-win32`, `-linux` ou `-darwin` ao nome). Gere as do seu ambiente com `npm run test:e2e:update` antes de rodar `npm run test:e2e`. Se a máquina for lenta, use `-- --workers=2`.
