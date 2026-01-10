export type DraftPayload<T> = {
  data: T
  savedAt: number
}

export const loadDraft = <T>(key: string): DraftPayload<T> | null => {
  if (typeof localStorage === 'undefined') {
    return null
  }
  const raw = localStorage.getItem(key)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as DraftPayload<T>
  } catch {
    return null
  }
}

export const saveDraft = <T>(key: string, data: T) => {
  if (typeof localStorage === 'undefined') {
    return
  }
  const payload: DraftPayload<T> = {
    data,
    savedAt: Date.now(),
  }
  localStorage.setItem(key, JSON.stringify(payload))
}

export const clearDraft = (key: string) => {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(key)
}
