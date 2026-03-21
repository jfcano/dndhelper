export const THEME_STORAGE_KEY = 'dndhelper.theme'

export type ThemeId = 'dark' | 'light'

export function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dark'
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function applyThemeToDocument(theme: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
}
