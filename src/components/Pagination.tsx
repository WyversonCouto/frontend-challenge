export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
  const btn = 'min-w-8 rounded-sm border border-border px-2 py-1 text-xs hover:border-accent disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="mt-6 flex flex-wrap items-center justify-center gap-1">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
        ‹
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <button
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Página ${p}`}
            className={`${btn} ${p === page ? 'border-accent bg-accent text-bg' : 'text-ink'}`}
          >
            {p}
          </button>
        </span>
      ))}
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Próxima página">
        ›
      </button>
    </nav>
  )
}
