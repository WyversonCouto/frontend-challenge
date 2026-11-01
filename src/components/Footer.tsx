import { StubLink } from './ui'
import { announce } from '@/lib/announce'

const columns: Array<[string, string[]]> = [
  ['Meu perfil', ['Meu perfil', 'Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse']],
  ['Central de ajuda', ['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item']],
  ['Coleções', ['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade']],
]

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface text-xs">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
        {[
          ['W', 'Segurança da carteira', 'Proteja sua carteira e colecione arte digital verificada com confiança.'],
          ['C', 'Criadores em destaque', 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.'],
          ['D', 'Alertas de lançamentos', 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.'],
        ].map(([letter, title, text]) => (
          <div key={title}>
            <div aria-hidden="true" className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg">
              {letter}
            </div>
            <h3 className="font-bold text-ink">{title}</h3>
            <p className="mt-1 text-muted">{text}</p>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            announce('O envio de newsletter não está disponível nesta demonstração.')
          }}
        >
          <h3 className="font-bold text-ink">Antecipe-se ao próximo lançamento</h3>
          <label htmlFor="newsletter" className="sr-only">
            Seu e-mail
          </label>
          <div className="mt-2 flex">
            <input id="newsletter" type="email" placeholder="digite seu e-mail..." className="min-w-0 flex-1 rounded-l-sm border border-border bg-bg px-2 py-1 text-ink placeholder:text-muted" />
            <button type="submit" className="rounded-r-sm bg-accent px-3 py-1 font-bold text-bg">
              Enviar
            </button>
          </div>
        </form>
      </div>
      <div className="border-t border-border bg-surface-2">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-10 gap-y-2 px-4 py-3 text-muted sm:px-8">
          <span className="font-bold tracking-widest text-ink">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <span>contato@email.com</span>
          <span>+55 11 4002 8922</span>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {columns.map(([title, links]) => (
          <div key={title}>
            <h3 className="mb-2 font-bold text-ink">{title}</h3>
            <ul className="space-y-1 text-muted">
              {links.map((l) => (
                <li key={l}>
                  <StubLink className="hover:text-ink">{l}</StubLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="mb-2 font-bold text-ink">Redes sociais</h3>
          <p className="text-muted">Instagram, X, YouTube e LinkedIn</p>
          <h3 className="mb-2 mt-4 font-bold text-ink">Carteiras compatíveis</h3>
          <p className="text-muted">MetaMask · WalletConnect · Coinbase</p>
        </div>
      </div>
      <p className="border-t border-border py-3 text-center text-muted">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
