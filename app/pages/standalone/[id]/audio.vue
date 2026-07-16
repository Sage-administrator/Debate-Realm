<!--
  audio.vue - 提示音设置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置提示音开关和自定义音频文件
  - 配置修改实时同步到数据库（timer-config API）
  - 支持音频文件上传到 public/uploads/audio 文件夹
-->
<script setup lang="ts">
definePageMeta({ layout: 'standalone' })

// ═══════════ 导入 ═══════════
import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

// ═══════════ 基础工具 ═══════════
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

// ═══════════ 数据模型 ═══════════
const tournament = inject<Ref<any>>('standaloneMatch')!
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const matchId = computed(() => route.params.id as string)

// 预览当前环节索引
const previewStageIndex = ref(0)

// 完整的计时器配置
const fullConfig = ref<{
  name: string
  title: string
  positiveTopic: string
  negativeTopic: string
  teamPositiveName: string
  teamNegativeName: string
  uiConfig: Record<string, any>
  skinConfig: Record<string, any>
  audioConfig: {
    enabled?: boolean
    startSound?: string
    endSound?: string
    warningSound?: string
  }
  teamLogoConfig: Record<string, any>
  stages: any[]
}>({
  name: '',
  title: '',
  positiveTopic: '',
  negativeTopic: '',
  teamPositiveName: '',
  teamNegativeName: '',
  uiConfig: {},
  skinConfig: {},
  audioConfig: {
    enabled: true,
    startSound: '',
    endSound: '',
    warningSound: '',
  },
  teamLogoConfig: {},
  stages: [],
})

// ═══════════ 数据加载 ═══════════
async function loadConfig() {
  loading.value = true
  try {
    // 从 inject 的 tournament 中获取赛事基本信息
    if (tournament.value) {
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
    }

    // 加载计时器配置
    const configRes = await $fetch<any>(`/api/standalone-matches/${matchId.value}/timer-config`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })

    if (configRes?.data) {
      const cfg = configRes.data
      fullConfig.value.name = cfg.name || fullConfig.value.name
      fullConfig.value.title = cfg.title || fullConfig.value.title
      fullConfig.value.positiveTopic = cfg.positiveTopic || ''
      fullConfig.value.negativeTopic = cfg.negativeTopic || ''
      fullConfig.value.teamPositiveName = cfg.teamPositiveName || ''
      fullConfig.value.teamNegativeName = cfg.teamNegativeName || ''
      fullConfig.value.uiConfig = cfg.uiConfig || {}
      fullConfig.value.skinConfig = cfg.skinConfig || {}
      fullConfig.value.audioConfig = {
        enabled: true,
        startSound: '',
        endSound: '',
        warningSound: '',
        ...(cfg.audioConfig || {}),
      }
      fullConfig.value.teamLogoConfig = cfg.teamLogoConfig || {}
      fullConfig.value.stages = cfg.stages || []

      // 如果 stages 为空，使用默认环节
      if (fullConfig.value.stages.length === 0) {
        fullConfig.value.stages = getDefaultStages()
      }
    } else {
      // 新配置，使用默认环节
      fullConfig.value.stages = getDefaultStages()
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 获取默认环节
function getDefaultStages() {
  return [
    { id: 1, name: '开篇立论', duration: 180, type: 'speech', order: 1 },
    { id: 2, name: '攻辩', duration: 120, type: 'speech', order: 2 },
    { id: 3, name: '自由辩论', duration: 240, type: 'dual-timer', order: 3, positiveDuration: 120, negativeDuration: 120 },
    { id: 4, name: '总结陈词', duration: 180, type: 'speech', order: 4 },
  ]
}

// ═══════════ 数据保存 ═══════════
async function saveConfig() {
  saving.value = true
  try {
    await $fetch<any>(`/api/standalone-matches/${matchId.value}/timer-config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: {
        name: fullConfig.value.name,
        title: fullConfig.value.title,
        positiveTopic: fullConfig.value.positiveTopic,
        negativeTopic: fullConfig.value.negativeTopic,
        teamPositiveName: fullConfig.value.teamPositiveName,
        teamNegativeName: fullConfig.value.teamNegativeName,
        uiConfig: fullConfig.value.uiConfig,
        skinConfig: fullConfig.value.skinConfig,
        audioConfig: fullConfig.value.audioConfig,
        teamLogoConfig: fullConfig.value.teamLogoConfig,
        stages: fullConfig.value.stages,
      },
    })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ═══════════ 音频文件上传处理 ═══════════
async function onAudioSelect(event: Event, field: 'startSound' | 'endSound' | 'warningSound') {
  const target = event.target as HTMLInputElement
  if (!target?.files?.[0]) return

  const file = target.files[0]
  uploading.value = true

  try {
    // 使用 FormData 上传文件到 /api/upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'audio')

    const uploadRes = await $fetch<any>('/api/upload', {
      method: 'POST',
      headers: {
        // 注意：multipart/form-data 不应该显式设置 Content-Type，
        // 让浏览器自动设置边界
      },
      body: formData,
    })

    if (uploadRes?.success && uploadRes?.data?.path) {
      // 保存上传文件的相对路径到配置中
      fullConfig.value.audioConfig[field] = uploadRes.data.path
      toast.add({
        title: `已上传: ${uploadRes.data.originalName}`,
        color: 'success'
      })
    } else {
      toast.add({ title: '上传失败，请重试', color: 'error' })
    }
  } catch (e: any) {
    console.error('音频上传错误:', e)
    toast.add({ title: e?.data?.statusMessage || '上传失败', color: 'error' })
  } finally {
    uploading.value = false
    // 重置 input 以允许再次选择相同文件
    target.value = ''
  }
}

// ═══════════ 生命周期 ═══════════
onMounted(() => loadConfig())

// 配置变化时自动保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => fullConfig.value.audioConfig,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!loading.value) saveConfig()
    }, 1500)
  },
  { deep: true }
)
</script>

<template>
  <template v-if="tournament">
  <!-- ═══ 主内容：左侧预览 + 右侧配置（左1/3 + 右2/3） ═══ -->
  <main class="py-6 grid grid-cols-12 gap-6">

    <!-- 左侧：实时预览（左4列，约1/3宽度） -->
    <div class="col-span-4">
      <TimerPreviewCard
        :full-config="fullConfig"
        :tournament-id="matchId"
        type="standalone"
        v-model:stage-index="previewStageIndex"
      />
    </div>

    <!-- 右侧：提示音配置（右8列，约2/3宽度） -->
    <div class="col-span-8 space-y-4">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <UIcon name="i-lucide-volume-2" class="w-4 h-4 text-[var(--color-text-muted)]" />
            提示音设置
          </h2>
        </template>

        <!-- 启用提示音开关 -->
        <div class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded mb-4">
          <div>
            <label class="text-sm text-[var(--color-text-primary)] font-medium">启用提示音</label>
            <p class="text-xs text-[var(--color-text-muted)]">控制是否在计时器中播放提示音</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="fullConfig.audioConfig.enabled">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- 提示音上传区 - 水平并行 -->
        <div class="flex gap-4 mb-4">
          <!-- 30秒提示音 -->
          <div class="space-y-2 flex-1">
            <label class="block text-sm text-[var(--color-text-primary)] font-medium">30秒提示音</label>
            <div class="flex items-center gap-2">
              <label class="px-3 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2 whitespace-nowrap">
                <UIcon name="i-lucide-upload" class="w-4 h-4" />
                选择文件
                <input
                  type="file"
                  accept="audio/*"
                  class="hidden"
                  @change="(e: Event) => onAudioSelect(e, 'warningSound')"
                >
              </label>
              <span class="text-xs text-[var(--color-text-muted)] truncate max-w-[60%]">{{ fullConfig.audioConfig.warningSound || '未选择文件' }}</span>
            </div>
            <div v-if="fullConfig.audioConfig.warningSound" class="flex items-center gap-2">
              <audio :src="fullConfig.audioConfig.warningSound" controls class="h-8 w-full max-w-xs"></audio>
            </div>
          </div>

          <!-- 5秒提示音 -->
          <div class="space-y-2 flex-1">
            <label class="block text-sm text-[var(--color-text-primary)] font-medium">5秒提示音</label>
            <div class="flex items-center gap-2">
              <label class="px-3 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2 whitespace-nowrap">
                <UIcon name="i-lucide-upload" class="w-4 h-4" />
                选择文件
                <input
                  type="file"
                  accept="audio/*"
                  class="hidden"
                  @change="(e: Event) => onAudioSelect(e, 'endSound')"
                >
              </label>
              <span class="text-xs text-[var(--color-text-muted)] truncate max-w-[60%]">{{ fullConfig.audioConfig.endSound || '未选择文件' }}</span>
            </div>
            <div v-if="fullConfig.audioConfig.endSound" class="flex items-center gap-2">
              <audio :src="fullConfig.audioConfig.endSound" controls class="h-8 w-full max-w-xs"></audio>
            </div>
          </div>

          <!-- 时间到提示音 -->
          <div class="space-y-2 flex-1">
            <label class="block text-sm text-[var(--color-text-primary)] font-medium">时间到提示音</label>
            <div class="flex items-center gap-2">
              <label class="px-3 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2 whitespace-nowrap">
                <UIcon name="i-lucide-upload" class="w-4 h-4" />
                选择文件
                <input
                  type="file"
                  accept="audio/*"
                  class="hidden"
                  @change="(e: Event) => onAudioSelect(e, 'startSound')"
                >
              </label>
              <span class="text-xs text-[var(--color-text-muted)] truncate max-w-[60%]">{{ fullConfig.audioConfig.startSound || '未选择文件' }}</span>
            </div>
            <div v-if="fullConfig.audioConfig.startSound" class="flex items-center gap-2">
              <audio :src="fullConfig.audioConfig.startSound" controls class="h-8 w-full max-w-xs"></audio>
            </div>
          </div>
        </div>

        <!-- 说明文字 -->
        <div class="pt-4 border-t border-[var(--color-border)]">
          <p class="text-xs text-[var(--color-text-muted)]">
            提示：修改后会自动保存。支持格式 MP3、WAV、OGG，单个文件最大 10MB。
          </p>
        </div>
      </UCard>
    </div>
  </main>
  </template>
</template>

<style scoped>
/* 深色玻璃拟态样式已由全局 main.css 中的 .tab-dark-* 类提供，此处无需额外 scoped 样式 */
</style>
