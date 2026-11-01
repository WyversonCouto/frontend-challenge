import { announcementKey, useAnnouncement } from '@/lib/announce'

/** Feedback acessível (role=status) para mutations e alterações em tempo real. */
export function LiveRegion() {
  const message = useAnnouncement()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" aria-live="polite" role="status">
      {message && (
        <p key={announcementKey()} className="pointer-events-auto max-w-md rounded-sm border border-accent bg-surface px-4 py-2 text-xs text-ink shadow-lg">
          {message}
        </p>
      )}
    </div>
  )
}
