<!--
  audio.vue - 提示音设置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置提示音开关和自定义音频文件
  - 配置修改实时同步到数据库（timer-config API）
  - 支持音频文件上传到 public/uploads/audio 文件夹
-->
<script setup lang="ts">
// ═══════════ 导入 ═══════════
import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

// ═══════════ 基础工具 ═══════════
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

// ═══════════ 数据模型 ═══════════
const tournament = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const tournamentId = computed(() => route.params.id as string)

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
    // 加载赛事基本信息
    const tournRes = await $fetch<any>(`/api/tournaments/${tournamentId.value}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    tournament.value = tournRes.data || tournRes

    // 加载计时器配置
    const configRes = await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-config`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })

    if (configRes?.data) {
      const cfg = configRes.data
      fullConfig.value.name = cfg.name || tournament.value.name
      fullConfig.value.title = cfg.title || tournament.value.name
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
      // 新配置，使用赛事名称作为默认标题
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
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
    await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-config`, {
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
  <div class="min-h-screen" style="background-color: #F5F7FA;">
    <div class="max-w-[80rem] mx-auto px-6">

      <!-- ═══ 加载状态 ═══ -->
      <div v-if="loading" class="flex justify-center py-24">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-gray-400" />
      </div>

      <template v-else-if="tournament">
        <!-- ═══ 头部区域 ═══ -->
        <header class="flex items-end justify-between pt-10 pb-5">
          <div>
            <p class="text-xs text-gray-400 mb-1">
              赛事管理 / ID: {{ tournament.id }}
            </p>
            <h1 class="text-[1.75rem] font-bold text-gray-900 leading-tight">
              {{ tournament.name }}
            </h1>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="saving" class="text-xs text-gray-500">保存中...</span>
            <span v-if="uploading" class="text-xs text-gray-500">上传中...</span>
          </div>
        </header>

        <!-- ═══ 表格样式双层 Tab 导航 ═══ -->
        <div class="tab-table-row1">
          <span class="tab-primary">基础配置</span>
          <span class="tab-primary tab-primary--active">视听设计</span>
          <span class="tab-primary">进阶功能</span>
        </div>
        <div class="tab-table-row2">
          <NuxtLink :to="`/tournaments/${tournamentId}`" class="tab-secondary">概览</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="tab-secondary">比赛信息</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="tab-secondary">计时器环节</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary">界面</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-secondary tab-secondary--active">提示音</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/teams`" class="tab-secondary">队徽</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-secondary">赛程</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-secondary">离线版</NuxtLink>
        </div>

        <!-- ═══ 主内容：左侧预览 + 右侧配置（左1/3 + 右2/3） ═══ -->
        <main class="py-6 grid grid-cols-12 gap-6">

          <!-- 左侧：实时预览（左4列，约1/3宽度） -->
          <div class="col-span-4">
            <TimerPreviewCard
              :full-config="fullConfig"
              :tournament-id="tournamentId"
              v-model:stage-index="previewStageIndex"
            />
          </div>

          <!-- 右侧：提示音配置（右8列，约2/3宽度） -->
          <div class="col-span-8 space-y-4">
            <div class="bg-white rounded-lg shadow-sm p-6">
              <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UIcon name="i-lucide-volume-2" class="w-4 h-4 text-gray-400" />
                提示音设置
              </h2>

              <!-- 启用提示音开关 -->
              <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded mb-4">
                <div>
                  <label class="text-sm text-gray-700 font-medium">启用提示音</label>
                  <p class="text-xs text-gray-400">控制是否在计时器中播放提示音</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="fullConfig.audioConfig.enabled" class="sr-only peer">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>

              <!-- 30秒提示音 -->
              <div class="space-y-2 mb-4">
                <label class="block text-sm text-gray-700 font-medium">30秒提示音</label>
                <div class="flex items-center gap-2">
                  <label class="px-4 py-2 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <UIcon name="i-lucide-upload" class="w-4 h-4" />
                    选择文件
                    <input
                      type="file"
                      accept="audio/*"
                      class="hidden"
                      @change="(e: Event) => onAudioSelect(e, 'warningSound')"
                    >
                  </label>
                  <span class="text-xs text-gray-500 truncate max-w-[60%]">{{ fullConfig.audioConfig.warningSound || '未选择文件' }}</span>
                </div>
                <div v-if="fullConfig.audioConfig.warningSound" class="flex items-center gap-2">
                  <audio :src="fullConfig.audioConfig.warningSound" controls class="h-8 w-full max-w-xs"></audio>
                </div>
              </div>

              <!-- 5秒提示音 -->
              <div class="space-y-2 mb-4">
                <label class="block text-sm text-gray-700 font-medium">5秒提示音</label>
                <div class="flex items-center gap-2">
                  <label class="px-4 py-2 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <UIcon name="i-lucide-upload" class="w-4 h-4" />
                    选择文件
                    <input
                      type="file"
                      accept="audio/*"
                      class="hidden"
                      @change="(e: Event) => onAudioSelect(e, 'endSound')"
                    >
                  </label>
                  <span class="text-xs text-gray-500 truncate max-w-[60%]">{{ fullConfig.audioConfig.endSound || '未选择文件' }}</span>
                </div>
                <div v-if="fullConfig.audioConfig.endSound" class="flex items-center gap-2">
                  <audio :src="fullConfig.audioConfig.endSound" controls class="h-8 w-full max-w-xs"></audio>
                </div>
              </div>

              <!-- 时间到提示音 -->
              <div class="space-y-2 mb-4">
                <label class="block text-sm text-gray-700 font-medium">时间到提示音</label>
                <div class="flex items-center gap-2">
                  <label class="px-4 py-2 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <UIcon name="i-lucide-upload" class="w-4 h-4" />
                    选择文件
                    <input
                      type="file"
                      accept="audio/*"
                      class="hidden"
                      @change="(e: Event) => onAudioSelect(e, 'startSound')"
                    >
                  </label>
                  <span class="text-xs text-gray-500 truncate max-w-[60%]">{{ fullConfig.audioConfig.startSound || '未选择文件' }}</span>
                </div>
                <div v-if="fullConfig.audioConfig.startSound" class="flex items-center gap-2">
                  <audio :src="fullConfig.audioConfig.startSound" controls class="h-8 w-full max-w-xs"></audio>
                </div>
              </div>

              <!-- 说明文字 -->
              <div class="pt-4 border-t border-gray-100">
                <p class="text-xs text-gray-400">
                  提示：修改后会自动保存。支持格式 MP3、WAV、OGG，单个文件最大 10MB。
                </p>
              </div>
            </div>
          </div>
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════ 表格样式双层Tab导航 ═══════════ */
.tab-table-row1 {
  display: grid;
  grid-template-columns: 3fr 4fr 2fr;
  border: 1px solid #D1D5DB;
  border-bottom: none;
  background: #F9FAFB;
}

.tab-primary {
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  color: #6B7280;
  cursor: default;
  border-right: 1px solid #D1D5DB;
  pointer-events: none;
  user-select: none;
}

.tab-primary:last-child { border-right: none; }
.tab-primary--active { color: #1F2937; background: #FFFFFF; border-bottom: 2px solid #3B82F6; }

.tab-table-row2 {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  border: 1px solid #D1D5DB;
  border-top: none;
  background: #FFFFFF;
}

.tab-secondary {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: center;
  color: #6B7280;
  cursor: pointer;
  border-right: 1px solid #E5E7EB;
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.tab-secondary:last-child { border-right: none; }
.tab-secondary:hover { color: #374151; background: #F3F4F6; }
.tab-secondary--active { color: #3B82F6; background: #EFF6FF; font-weight: 600; }
</style>
