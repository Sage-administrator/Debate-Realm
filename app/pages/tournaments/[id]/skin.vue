<!--
  skin.vue - 背景配置页面
  功能：
  - 左侧 TimerPreview 实时预览背景效果
  - 右侧配置背景样式（默认/纯色/渐变/图片）
  - 支持颜色选择器、背景图片上传
  - 配置修改实时同步到数据库（timer-config API）
-->
<script setup lang="ts">
definePageMeta({ layout: 'tournament' })

// ═══════════ 导入 ═══════════
import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

// ═══════════ 基础工具 ═══════════
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

// ═══════════ 数据模型 ═══════════
const tournament = inject<Ref<any>>('tournament')!
const loading = ref(false)
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
    // 从 inject 的 tournament 中获取赛事基本信息
    if (tournament.value) {
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
    }

    // 加载计时器配置
    const configRes = await $fetch<any>(`/api/tournaments/${tournamentId.value}/timer-config`, {
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
  <template v-if="tournament">
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
    <div class="col-span-8">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white flex items-center gap-2">
              <UIcon name="i-lucide-palette" class="w-4 h-4 text-white/40" />
              背景设置
            </h2>
          </div>
        </template>

      <!-- 背景模式选择 -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-white/80 mb-3">背景模式</label>
        <div class="grid grid-cols-4 gap-3">
          <!-- 默认 -->
          <button
            @click="setBackgroundMode('default')"
            :class="['config-option-dark', skinConfig.backgroundMode === 'default' ? 'config-option-dark--active' : '']"
          >
            <div class="config-option-preview config-option-preview--default"></div>
            <span class="text-sm font-medium mt-2">默认</span>
          </button>
          <!-- 纯色 -->
          <button
            @click="setBackgroundMode('color')"
            :class="['config-option-dark', skinConfig.backgroundMode === 'color' ? 'config-option-dark--active' : '']"
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
            :class="['config-option-dark', skinConfig.backgroundMode === 'gradient' ? 'config-option-dark--active' : '']"
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
            :class="['config-option-dark', skinConfig.backgroundMode === 'image' ? 'config-option-dark--active' : '']"
          >
            <div
              class="config-option-preview"
              :style="uploadedImagePreview ? {
                backgroundImage: `url(${uploadedImagePreview})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}"
            >
              <span v-if="!uploadedImagePreview" class="text-xs text-white/40">图片</span>
            </div>
            <span class="text-sm font-medium mt-2">图片</span>
          </button>
        </div>
      </div>

      <!-- 颜色配置：纯色模式 -->
      <div v-if="skinConfig.backgroundMode === 'color'" class="mb-6">
        <label class="block text-sm font-medium text-white/80 mb-2">背景颜色</label>
        <div class="flex items-center gap-3">
          <input
            type="color"
            v-model="skinConfig.backgroundColor"
            class="w-12 h-10 rounded cursor-pointer border border-white/10"
          />
          <input
            type="text"
            v-model="skinConfig.backgroundColor"
            class="input-glass flex-1 px-3 py-2 border border-white/10 rounded text-sm font-mono"
            placeholder="#1F2937"
          />
        </div>
      </div>

      <!-- 颜色配置：渐变模式 -->
      <div v-if="skinConfig.backgroundMode === 'gradient'" class="mb-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-white/80 mb-2">起始颜色</label>
          <div class="flex items-center gap-3">
            <input
              type="color"
              v-model="skinConfig.gradientStart"
              class="w-12 h-10 rounded cursor-pointer border border-white/10"
            />
            <input
              type="text"
              v-model="skinConfig.gradientStart"
              class="input-glass flex-1 px-3 py-2 border border-white/10 rounded text-sm font-mono"
              placeholder="#1F2937"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-white/80 mb-2">结束颜色</label>
          <div class="flex items-center gap-3">
            <input
              type="color"
              v-model="skinConfig.gradientEnd"
              class="w-12 h-10 rounded cursor-pointer border border-white/10"
            />
            <input
              type="text"
              v-model="skinConfig.gradientEnd"
              class="input-glass flex-1 px-3 py-2 border border-white/10 rounded text-sm font-mono"
              placeholder="#374151"
            />
          </div>
        </div>
      </div>

      <!-- 图片配置 -->
      <div v-if="skinConfig.backgroundMode === 'image'" class="mb-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-white/80 mb-2">背景图片</label>
          <div class="border-2 border-dashed border-white/15 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500/50 transition-colors" @click="triggerImageUpload">
            <div v-if="uploadedImagePreview" class="mb-3">
              <img :src="uploadedImagePreview" class="max-h-32 mx-auto rounded shadow-sm" alt="背景预览" />
            </div>
            <UIcon v-else name="i-lucide-upload-cloud" class="w-8 h-8 mx-auto mb-2 text-white/40" />
            <p class="text-sm text-white/80">
              {{ uploadedImagePreview ? '点击更换图片' : '点击上传背景图片' }}
            </p>
            <p class="text-xs text-white/40 mt-1">支持 JPG、PNG、GIF、WebP，最大 10MB</p>
            <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
          </div>
          <button
            v-if="uploadedImagePreview"
            @click="removeBackgroundImage"
            class="mt-3 text-sm text-red-400 hover:text-red-300 flex items-center justify-center gap-1 w-full"
          >
            <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
            移除背景图片
          </button>
        </div>
        <div>
          <label class="block text-sm font-medium text-white/80 mb-2">图片透明度</label>
          <div class="flex items-center gap-3">
            <input
              type="range"
              v-model.number="skinConfig.imageOpacity"
              min="0"
              max="1"
              step="0.1"
              class="flex-1"
            />
            <span class="text-sm text-white/80 w-12 text-right">{{ (skinConfig.imageOpacity ?? 1) * 100 }}%</span>
          </div>
        </div>
      </div>

    </UCard>
    </div>
  </main>
  </template>
</template>

<style scoped>
/* ═══════════ 配置选项预览块 ═══════════ */
.config-option-preview {
  width: 3rem;
  height: 3rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.config-option-preview--default {
  background: linear-gradient(135deg, #1E3A5F 0%, #2D4A6B 50%, #1F2937 100%);
}
/* config-option-dark 系列和 tab-dark-* 系列已由全局 main.css 定义 */
</style>
