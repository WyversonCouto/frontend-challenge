# Auditoria Lighthouse

Mediana de 3 medições por página e perfil.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | **88** ⚠ | 97 | 96 | 92 | 773 ms | 0 | 485 ms |
| detalhe | mobile | **82** ⚠ | 97 | 96 | 92 | 3126 ms | 0 | 469 ms |
| inicio | desktop | 100 | 97 | 96 | 92 | 671 ms | 0.01 | 16 ms |
| detalhe | desktop | 100 | 97 | 96 | 92 | 686 ms | 0 | 12 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

## Ambiente

- **lighthouse:** 13.6.0
- **chrome:** Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36
- **node:** v24.20.0
- **os:** Windows_NT 10.0.19045 (x64)
- **cpu:** Intel(R) Xeon(R) CPU E5-2689 0 @ 2.60GHz x16
- **memoryGB:** 17
- **date:** 2026-11-01T16:07:15.750Z
- **conditions:** Build otimizado (vite preview), cenário padrão dos mocks (MSW), Chrome novo e sem cache por medição, throttling padrão do Lighthouse (mobile: 4G simulada + CPU 4x; desktop: preset desktop).

## Medições individuais (Performance)

- inicio / mobile: 88, 88, 85
- detalhe / mobile: 82, 76, 82
- inicio / desktop: 100, 100, 100
- detalhe / desktop: 100, 100, 100

Relatórios HTML/JSON da execução mediana: `lighthouse/reports/`. Todas as execuções: `lighthouse/raw/`.
