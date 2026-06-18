<!--
  skin.vue - 背景配置页面
  功能：
  - 左侧 TimerPreview 实时预览背景效果
  - 右侧配置背景样式（默认/纯色/渐变/图片）
  - 支持颜色选择器、背景图片上传
  - 配置修改实时同步到数据库（timer-config API）
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
const tournamentId = computed(() => route.params.id as string)

// 预览当前环节索引
const previewStageIndex = ref(0)

// 文件上传相关
const imageInput = ref<HTMLInputElement | null>(null)
const uploadedImagePreview = ref('') // 本地预览图片 URL（DataURL）

// 完整计时器配置（从后端加载并同步）
const fullConfig = ref<{
  name: string
  title: string
  positiveTopic: string
  negativeTopic: string
  teamPositiveName: string
  teamNegativeName: string
  uiConfig: Record<string, any>
  skinConfig: Record<string, any>
  audioConfig: Record<string, any>
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
  audioConfig: {},
  teamLogoConfig: {},
  stages: [],
})

// 便捷访问：背景配置（与 skinConfig 同步）
const skinConfig = computed({
  get: () => fullConfig.value.skinConfig || {},
  set: (val) => { fullConfig.value.skinConfig = val },
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
    fullConfig.value.name = tournament.value.name
    fullConfig.value.title = tournament.value.name

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
      fullConfig.value.skinConfig = cfg.skinConfig || {
        backgroundMode: 'default',
        backgroundColor: '#1F2937',
        gradientStart: '#1F2937',
        gradientEnd: '#374151',
        backgroundImage: '',
        imageOpacity: 1,
      }
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = cfg.teamLogoConfig || {}
      fullConfig.value.stages = cfg.stages || []

      // 初始化背景图片预览
      if (fullConfig.value.skinConfig.backgroundImage) {
        uploadedImagePreview.value = fullConfig.value.skinConfig.backgroundImage
      }
    } else {
      // 新配置，使用默认背景
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
      fullConfig.value.skinConfig = {
        backgroundMode: 'default',
        backgroundColor: '#1F2937',
        gradientStart: '#1F2937',
        gradientEnd: '#374151',
        backgroundImage: '',
        imageOpacity: 1,
      }
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
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

// ═══════════ 背景模式切换 ═══════════
function setBackgroundMode(mode: string) {
  fullConfig.value.skinConfig.backgroundMode = mode
}

// ═══════════ 背景图片上传 ═══════════
function triggerImageUpload() {
  if (imageInput.value) imageInput.value.click()
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // 生成 DataURL 用于本地预览（实时）
  const reader = new FileReader()
  reader.onload = (e) => {
    uploadedImagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)

  // 上传到服务器（持久化）
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'images')

    const res = await $fetch<any>('/api/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${authStore.token}` },
    })

    if (res?.data?.path) {
      // 保存相对路径到数据库
      fullConfig.value.skinConfig.backgroundImage = res.data.path
      uploadedImagePreview.value = res.data.path // 也使用服务器路径作为预览
      toast.add({ title: '背景图片已更新', color: 'success' })
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '上传失败', color: 'error' })
  }

  // 清空 input 以便重复选择同一文件
  target.value = ''
}

function removeBackgroundImage() {
  uploadedImagePreview.value = ''
  fullConfig.value.skinConfig.backgroundImage = ''
  fullConfig.value.skinConfig.backgroundMode = 'default'
}

// ═══════════ 生命周期 ═══════════
onMounted(() => loadConfig())

// 配置变化时自动保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => fullConfig.value.skinConfig,
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
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary tab-secondary--active">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary">界面</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-secondary">提示音</NuxtLink>
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

          <!-- 右侧：背景配置区域（右8列，约2/3宽度） -->
          <div class="col-span-8 bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
                <UIcon name="i-lucide-palette" class="w-4 h-4 text-gray-400" />
                背景设置
              </h2>
            </div>

            <!-- 背景模式选择 -->
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-3">背景模式</label>
              <div class="grid grid-cols-4 gap-3">
                <!-- 默认 -->
                <button
                  @click="setBackgroundMode('default')"
                  :class="['config-option-btn', skinConfig.backgroundMode === 'default' ? 'config-option-btn--active' : '']"
                >
                  <div class="config-option-preview config-option-preview--default"></div>
                  <span class="text-sm font-medium mt-2">默认</span>
                </button>
                <!-- 纯色 -->
                <button
                  @click="setBackgroundMode('color')"
                  :class="['config-option-btn', skinConfig.backgroundMode === 'color' ? 'config-option-btn--active' : '']"
                >
                  <div
                    class="config-option-preview"
                    :style="{ backgroundColor: skinConfig.backgroundColor || '#1F2937' }"
                  ></div>
                  <span class="text-sm font-medium mt-2">纯色</span>
                </button>
                <!-- 渐变 -->
                <button
                  @click="setBackgroundMode('gradient')"
                  :class="['config-option-btn', skinConfig.backgroundMode === 'gradient' ? 'config-option-btn--active' : '']"
                >
                  <div
                    class="config-option-preview"
                    :style="{
                      background: `linear-gradient(135deg, ${skinConfig.gradientStart || '#1F2937'} 0%, ${skinConfig.gradientEnd || '#374151'} 100%)`
                    }"
                  ></div>
                  <span class="text-sm font-medium mt-2">渐变</span>
                </button>
                <!-- 图片 -->
                <button
                  @click="setBackgroundMode('image')"
                  :class="['config-option-btn', skinConfig.backgroundMode === 'image' ? 'config-option-btn--active' : '']"
                >
                  <div
                    class="config-option-preview"
                    :style="uploadedImagePreview ? {
                      backgroundImage: `url(${uploadedImagePreview})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    } : {}"
                  >
                    <span v-if="!uploadedImagePreview" class="text-xs text-gray-400">图片</span>
                  </div>
                  <span class="text-sm font-medium mt-2">图片</span>
                </button>
              </div>
            </div>

            <!-- 颜色配置：纯色模式 -->
            <div v-if="skinConfig.backgroundMode === 'color'" class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">背景颜色</label>
              <div class="flex items-center gap-3">
                <input
                  type="color"
                  v-model="skinConfig.backgroundColor"
                  class="w-12 h-10 rounded cursor-pointer border border-gray-200"
                />
                <input
                  type="text"
                  v-model="skinConfig.backgroundColor"
                  class="flex-1 px-3 py-2 border border-gray-200 rounded text-sm font-mono"
                  placeholder="#1F2937"
                />
              </div>
            </div>

            <!-- 颜色配置：渐变模式 -->
            <div v-if="skinConfig.backgroundMode === 'gradient'" class="mb-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">起始颜色</label>
                <div class="flex items-center gap-3">
                  <input
                    type="color"
                    v-model="skinConfig.gradientStart"
                    class="w-12 h-10 rounded cursor-pointer border border-gray-200"
                  />
                  <input
                    type="text"
                    v-model="skinConfig.gradientStart"
                    class="flex-1 px-3 py-2 border border-gray-200 rounded text-sm font-mono"
                    placeholder="#1F2937"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">结束颜色</label>
                <div class="flex items-center gap-3">
                  <input
                    type="color"
                    v-model="skinConfig.gradientEnd"
                    class="w-12 h-10 rounded cursor-pointer border border-gray-200"
                  />
                  <input
                    type="text"
                    v-model="skinConfig.gradientEnd"
                    class="flex-1 px-3 py-2 border border-gray-200 rounded text-sm font-mono"
                    placeholder="#374151"
                  />
                </div>
              </div>
            </div>

            <!-- 图片配置 -->
            <div v-if="skinConfig.backgroundMode === 'image'" class="mb-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">背景图片</label>
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors" @click="triggerImageUpload">
                  <div v-if="uploadedImagePreview" class="mb-3">
                    <img :src="uploadedImagePreview" class="max-h-32 mx-auto rounded shadow-sm" alt="背景预览" />
                  </div>
                  <UIcon v-else name="i-lucide-upload-cloud" class="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p class="text-sm text-gray-600">
                    {{ uploadedImagePreview ? '点击更换图片' : '点击上传背景图片' }}
                  </p>
                  <p class="text-xs text-gray-400 mt-1">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
                  <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
                </div>
                <button
                  v-if="uploadedImagePreview"
                  @click="removeBackgroundImage"
                  class="mt-3 text-sm text-red-600 hover:text-red-700 flex items-center justify-center gap-1 w-full"
                >
                  <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                  移除背景图片
                </button>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">图片透明度</label>
                <div class="flex items-center gap-3">
                  <input
                    type="range"
                    v-model.number="skinConfig.imageOpacity"
                    min="0"
                    max="1"
                    step="0.1"
                    class="flex-1"
                  />
                  <span class="text-sm text-gray-600 w-12 text-right">{{ (skinConfig.imageOpacity ?? 1) * 100 }}%</span>
                </div>
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

/* ═══════════ 配置选项按钮 ═══════════ */
.config-option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  border: 2px solid #E5E7EB;
  border-radius: 0.5rem;
  background: #FFFFFF;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 8rem;
}

.config-option-btn:hover {
  border-color: #9CA3AF;
  background: #F9FAFB;
}

.config-option-btn--active {
  border-color: #3B82F6;
  background: #EFF6FF;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.config-option-preview {
  width: 3rem;
  height: 3rem;
  border-radius: 0.375rem;
  border: 1px solid #E5E7EB;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.config-option-preview--default {
  background: linear-gradient(135deg, #1E3A5F 0%, #2D4A6B 50%, #1F2937 100%);
}
</style>
