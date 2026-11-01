import { useSyncExternalStore } from 'react'

/** Mensagens para a região viva (aria-live): mutations e alterações em tempo real. */
let message = ''
let seq = 0
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

export function announce(text: string) {
  message = text
  seq += 1
  listeners.forEach((l) => l())
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = ''
    listeners.forEach((l) => l())
  }, 6000)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useAnnouncement = () => useSyncExternalStore(subscribe, () => message, () => '')
export const announcementKey = () => seq
