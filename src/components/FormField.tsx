import type { ReactNode } from 'react'

export const inputClass = (error?: string, readOnly = false) =>
  `w-full rounded-sm border px-3 py-2 text-xs text-ink placeholder:text-muted ${error ? 'border-danger' : 'border-border'} ${readOnly ? 'bg-surface text-muted' : 'bg-bg'}`

export function FormField({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-accent">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-erro`} className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
