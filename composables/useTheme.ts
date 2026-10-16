export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'ml-visualizer-theme'

export const useTheme = () => {
  const theme = useState<Theme>('app-theme', () => 'light')
  const isDark = computed(() => theme.value === 'dark')

  const applyThemeToDOM = (activeTheme: Theme) => {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', activeTheme)
      // Also update body or class if needed
      if (activeTheme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme
    if (import.meta.client) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme)
      } catch (e) {
        // Handle localStorage disabled/blocked
      }
      applyThemeToDOM(newTheme)
    }
  }

  const toggleTheme = () => {
    const nextTheme = theme.value === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  const initTheme = () => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
        if (stored === 'light' || stored === 'dark') {
          theme.value = stored
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          theme.value = 'dark'
        } else {
          theme.value = 'light'
        }
      } catch {
        theme.value = 'light'
      }
      applyThemeToDOM(theme.value)
    }
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
    initTheme
  }
}

