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
    set: (val) => {
      colorMode.preference = val
    },
  })

  // 当前实际应用的主题
  const resolvedTheme = computed(() => colorMode.value as 'light' | 'dark')

  // 仅在主题切换窗口内临时启用全局过渡（对应 main.css 的 .theme-transition 规则）：
  // 切换完成后移除该类，避免常驻 transition 的常态合成开销
  let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined
  const flashThemeTransition = () => {
    if (!import.meta.client || typeof document === 'undefined') return
    const el = document.documentElement
    el.classList.add('theme-transition')
    clearTimeout(themeTransitionTimer)
    themeTransitionTimer = setTimeout(() => {
      el.classList.remove('theme-transition')
    }, 350)
  }
  // 监听模式变化（含直接赋值 mode = 'x'），统一触发过渡窗口
  watch(
    () => mode.value,
    () => flashThemeTransition(),
  )

  // 切换主题：light → dark → system → light
  const toggleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const idx = order.indexOf(mode.value)
    // idx 为 -1（未知模式）时默认从 light 开始，保证索引始终有效
    mode.value = order[idx === -1 ? 0 : (idx + 1) % order.length]!
  }

  // 设置指定主题
  const setTheme = (newMode: ThemeMode) => {
    mode.value = newMode
  }

  return {
    mode, // 当前主题模式
    resolvedTheme, // 解析后的实际主题
    toggleTheme, // 切换主题
    setTheme, // 设置指定主题
  }
}
