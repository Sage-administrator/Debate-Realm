/**
 * useTimerConfig — 计时器配置的跨页面共享状态
 *
 * 解决痛点：
 * - 之前每个子页面（skin/timer/timing/details/audio/teams）都独立 $fetch 一次 timer-config
 * - 切换页面时重新请求，既慢又浪费
 * - skin 页改了背景立刻切到 timer 页，1.5s 防抖还没存盘，timer 页读取旧数据
 *
 * 方案：useState 做全局共享缓存
 * - 首次 loadConfig 后缓存 loadedKey，同次会话内再次调用直接返回，零网络
 * - 任一页面修改 config 后，所有引用同一 useState 的组件立即同步
 * - 各页面保留各自的 1500ms 防抖保存（只影响落盘时间，不影响 UI）
 * - 切换不同赛事时（loadedKey 变化），自动重新 fetch
 */
// 皮肤默认值：保证 solidColor / gradientStart / gradientEnd 等字段始终存在，
// 否则纯色/渐变模式因缺少颜色值而被 TimerDisplay.rootStyle 跳过
const DEFAULT_SKIN_CONFIG = {
  backgroundType: 'default',
  solidColor: '#1F2937',
  gradientStart: '#1F2937',
  gradientEnd: '#374151',
  imageUrl: '',
  imageOpacity: 1,
}

export const useTimerConfig = () => {
  // ── 共享状态（跨页面/跨组件存活） ──
  const config = useState('shared-timer-config', () => ({
    name: '',
    title: '',
    positiveTopic: '',
    negativeTopic: '',
    teamPositiveName: '',
    teamNegativeName: '',
    uiConfig: {} as Record<string, any>,
    skinConfig: { ...DEFAULT_SKIN_CONFIG },
    audioConfig: {} as Record<string, any>,
    teamLogoConfig: {} as Record<string, any>,
    stages: [] as any[],
  }))

  // 缓存标识："tournament:<id>" 或 "standalone:<id>"
  // 同一个会话内再次访问同一赛事时跳过 fetch
  const loadedKey = useState('shared-timer-config-loaded-key', () => '')

  const loading = ref(false)
  const saving = ref(false)

  /**
   * 从 API 加载计时器配置（带缓存）
   * 如果已加载过同一 id+type，直接返回不请求
   */
  async function loadConfig(id: string, type: 'tournament' | 'standalone') {
    const key = `${type}:${id}`
    if (loadedKey.value === key) return

    loadedKey.value = '' // 加载中先清空，避免脏读
    loading.value = true
    try {
      const { token } = useAuthStore()
      const endpoint
        = type === 'tournament'
          ? `/api/tournaments/${id}/timer-config`
          : `/api/standalone-matches/${id}/timer-config`

      const res = await $fetch<any>(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res?.data) {
        const cfg = res.data
        config.value = {
          name: cfg.name || '',
          title: cfg.title || '',
          positiveTopic: cfg.positiveTopic || '',
          negativeTopic: cfg.negativeTopic || '',
          teamPositiveName: cfg.teamPositiveName || '',
          teamNegativeName: cfg.teamNegativeName || '',
          uiConfig: cfg.uiConfig || {},
          skinConfig: { ...DEFAULT_SKIN_CONFIG, ...(cfg.skinConfig || {}) },
          audioConfig: cfg.audioConfig || {},
          teamLogoConfig: cfg.teamLogoConfig || {},
          stages: cfg.stages || [],
        }
        loadedKey.value = key
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 保存配置到 API
   * 各页面仍保留各自的 1500ms 防抖 watch，saveConfig 只负责实际 HTTP 请求
   */
  async function saveConfig(id: string, type: 'tournament' | 'standalone') {
    saving.value = true
    try {
      const { token } = useAuthStore()
      const endpoint
        = type === 'tournament'
          ? `/api/tournaments/${id}/timer-config`
          : `/api/standalone-matches/${id}/timer-config`

      await $fetch(endpoint, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: { ...config.value },
      })
    } finally {
      saving.value = false
    }
  }

  return { config, loading, saving, loadConfig, saveConfig }
}
