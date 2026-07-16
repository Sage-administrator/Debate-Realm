// ════════════════════════════════════════════════════
// useTheme.ts — 主题切换逻辑
// ponytail: 直接使用 Nuxt UI 内置的 useColorMode，避免重复造轮子
// Nuxt UI 的 color-mode 会在 <html> 上切换 .dark class
// ════════════════════════════════════════════════════

export type ThemeMode = 'light' | 'dark' | 'system'

export const useTheme = () => {
  // ponytail: 使用 Nuxt UI 内置的 color-mode，无需自定义状态管理
  const colorMode = useColorMode()

  // 当前模式（light/dark/system）
  const mode = computed<ThemeMode>({
    get: () => colorMode.preference as ThemeMode,
    set: (val) => { colorMode.preference = val },
  })

  // 当前实际应用的主题
  const resolvedTheme = computed(() => colorMode.value as 'light' | 'dark')

  // 切换主题：light → dark → system → light
  const toggleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const idx = order.indexOf(mode.value)
    mode.value = order[(idx + 1) % order.length]
  }

  // 设置指定主题
  const setTheme = (newMode: ThemeMode) => {
    mode.value = newMode
  }

  return {
    mode,           // 当前主题模式
    resolvedTheme,  // 解析后的实际主题
    toggleTheme,    // 切换主题
    setTheme,       // 设置指定主题
  }
}
