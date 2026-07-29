/**
 * useTimerConfig — 计时器配置的跨页面共享状态
 *
 * 解决痛点：
 * - 之前每个子页面都独立 $fetch 一次 timer-config
 * - 切换页面时重新请求，既慢又浪费
 *
 * 方案：useState 做全局共享缓存
 * - 首次 loadConfig 后缓存 loadedKey，同次会话内再次调用直接返回，零网络
 * - 任一页面修改 config 后，所有引用同一 useState 的组件立即同步
 * - 各页面保留各自的 1500ms 防抖保存（只影响落盘时间，不影响 UI）
 */
const DEFAULT_SKIN_CONFIG = {
  backgroundType: 'default',
  solidColor: '#1F2937',
  gradientStart: '#1F2937',
  gradientEnd: '#374151',
  imageUrl: '',
  imageOpacity: 1,
}

export const useTimerConfig = () => {
  const api = useApi()

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

  const loadedKey = useState('shared-timer-config-loaded-key', () => '')
  const loading = ref(false)
  const saving = ref(false)

  async function loadConfig(id: string, type: 'tournament' | 'standalone') {
    const key = `${type}:${id}`
    if (loadedKey.value === key) return

    loadedKey.value = ''
    loading.value = true
    try {
      const res
        = type === 'tournament'
          ? await api.tournaments.timer.config(id)
          : await api.standalone.timer.config(id)

      const cfg = (res as any)?.data ?? res

      if (cfg) {
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

  async function saveConfig(id: string, type: 'tournament' | 'standalone') {
    saving.value = true
    try {
      if (type === 'tournament') {
        await api.tournaments.timer.saveConfig(id, config.value as any)
      } else {
        await api.standalone.timer.saveConfig(id, config.value as any)
      }
    } finally {
      saving.value = false
    }
  }

  return { config, loading, saving, loadConfig, saveConfig }
}
