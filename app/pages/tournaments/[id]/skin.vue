<!--
  skin.vue - 背景配置页面
  功能：
  - 左侧 TimerPreview 实时预览背景效果
  - 右侧配置背景样式（默认/纯色/渐变/图片）
  - 支持颜色选择器、背景图片 URL 输入
  - 配置修改实时同步到数据库（timer-config API）
-->
<script setup lang="ts">
definePageMeta({ layout: 'tournament' })

import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

// 皮肤/背景配置默认值：必须包含 solidColor / gradientStart / gradientEnd 等字段，
// 否则纯色/渐变模式因缺少颜色值而被 rootStyle 跳过（表现为“无法使用”）
const DEFAULT_SKIN_CONFIG = {
  backgroundType: 'default',
  solidColor: '#1F2937',
  gradientStart: '#1F2937',
  gradientEnd: '#374151',
  imageUrl: '',
  imageOpacity: 1,
}

const tournament = inject<Ref<any>>('tournament')!
const loading = ref(false)
const saving = ref(false)
const tournamentId = computed(() => route.params.id as string)

const previewStageIndex = ref(0)

// 背景图片 URL 输入（不再使用上传）
const backgroundImageUrl = ref('')

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
  skinConfig: { ...DEFAULT_SKIN_CONFIG },
  audioConfig: {},
  teamLogoConfig: {},
  stages: [],
})

const skinConfig = computed({
  get: () => fullConfig.value.skinConfig || {},
  set: (val) => { fullConfig.value.skinConfig = val },
})

async function loadConfig() {
  loading.value = true
  try {
    if (tournament.value) {
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
    }

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
      // 合并默认值：保证 solidColor / gradientStart / gradientEnd 等字段始终存在，
      // 纯色/渐变模式才不会因缺色而失效
      fullConfig.value.skinConfig = { ...DEFAULT_SKIN_CONFIG, ...(cfg.skinConfig || {}) }
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = cfg.teamLogoConfig || {}
      fullConfig.value.stages = cfg.stages || []

      if (fullConfig.value.skinConfig.imageUrl) {
        backgroundImageUrl.value = fullConfig.value.skinConfig.imageUrl
      }
    } else {
      fullConfig.value.skinConfig = { ...DEFAULT_SKIN_CONFIG }
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

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

function setBackgroundType(type: string) {
  fullConfig.value.skinConfig.backgroundType = type
}

// 应用背景图片 URL
function applyBackgroundImageUrl() {
  const url = backgroundImageUrl.value.trim()
  if (!url) {
    removeBackgroundImage()
    return
  }
  fullConfig.value.skinConfig.imageUrl = url
  fullConfig.value.skinConfig.backgroundType = 'image'
  toast.add({ title: '背景图片已更新', color: 'success' })
}

function removeBackgroundImage() {
  backgroundImageUrl.value = ''
  fullConfig.value.skinConfig.imageUrl = ''
  fullConfig.value.skinConfig.backgroundType = 'default'
}

onMounted(() => loadConfig())

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
  <div class="py-6 grid grid-cols-12 gap-6">

    <div class="col-span-4">
      <TimerPreviewCard
        :full-config="fullConfig"
        :tournament-id="tournamentId"
        type="tournament"
        v-model:stage-index="previewStageIndex"
      />
    </div>

    <div class="col-span-8">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <UIcon name="i-lucide-palette" class="w-4 h-4 text-[var(--color-text-muted)]" />
              背景设置
            </h2>
          </div>
        </template>

      <div class="mb-6">
        <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-3">背景模式</label>
        <div class="grid grid-cols-4 gap-3">
          <button
            @click="setBackgroundType('default')"
            :class="['config-option-dark', skinConfig.backgroundType === 'default' ? 'config-option-dark--active' : '']"
          >
            <div class="config-option-preview config-option-preview--default"></div>
            <span class="text-sm font-medium mt-2">默认</span>
          </button>
          <button
            @click="setBackgroundType('solid')"
            :class="['config-option-dark', skinConfig.backgroundType === 'solid' ? 'config-option-dark--active' : '']"
          >
            <div
              class="config-option-preview"
              :style="{ backgroundColor: skinConfig.solidColor || '#1F2937' }"
            ></div>
            <span class="text-sm font-medium mt-2">纯色</span>
          </button>
          <button
            @click="setBackgroundType('gradient')"
            :class="['config-option-dark', skinConfig.backgroundType === 'gradient' ? 'config-option-dark--active' : '']"
          >
            <div
              class="config-option-preview"
              :style="{
                background: `linear-gradient(135deg, ${skinConfig.gradientStart || '#1F2937'} 0%, ${skinConfig.gradientEnd || '#374151'} 100%)`
              }"
            ></div>
            <span class="text-sm font-medium mt-2">渐变</span>
          </button>
          <button
            @click="setBackgroundType('image')"
            :class="['config-option-dark', skinConfig.backgroundType === 'image' ? 'config-option-dark--active' : '']"
          >
            <div
              class="config-option-preview"
              :style="skinConfig.imageUrl ? {
                backgroundImage: `url(${skinConfig.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}"
            >
              <span v-if="!skinConfig.imageUrl" class="text-xs text-[var(--color-text-muted)]">图片</span>
            </div>
            <span class="text-sm font-medium mt-2">图片</span>
          </button>
        </div>
      </div>

      <div v-if="skinConfig.backgroundType === 'solid'" class="mb-6">
        <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">背景颜色</label>
        <div class="flex items-center gap-3">
          <ColorPicker v-model="skinConfig.solidColor" />
          <input
            type="text"
            v-model="skinConfig.solidColor"
            class="input-glass flex-1 px-3 py-2 border border-[var(--color-border)] rounded text-sm font-mono"
            placeholder="#1F2937"
          />
        </div>
      </div>

      <div v-if="skinConfig.backgroundType === 'gradient'" class="mb-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">起始颜色</label>
          <div class="flex items-center gap-3">
            <ColorPicker v-model="skinConfig.gradientStart" />
            <input
              type="text"
              v-model="skinConfig.gradientStart"
              class="input-glass flex-1 px-3 py-2 border border-[var(--color-border)] rounded text-sm font-mono"
              placeholder="#1F2937"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">结束颜色</label>
          <div class="flex items-center gap-3">
            <ColorPicker v-model="skinConfig.gradientEnd" />
            <input
              type="text"
              v-model="skinConfig.gradientEnd"
              class="input-glass flex-1 px-3 py-2 border border-[var(--color-border)] rounded text-sm font-mono"
              placeholder="#374151"
            />
          </div>
        </div>
      </div>

      <div v-if="skinConfig.backgroundType === 'image'" class="mb-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">背景图片 URL</label>
          <div class="space-y-3">
            <input
              type="text"
              v-model="backgroundImageUrl"
              class="input-glass w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
              placeholder="请输入图片 URL，例如：https://example.com/bg.jpg"
              @keyup.enter="applyBackgroundImageUrl"
            />
            <button
              @click="applyBackgroundImageUrl"
              class="w-full px-4 py-2 bg-indigo-600 text-[var(--color-text-primary)] rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              应用图片
            </button>
            <p class="text-xs text-[var(--color-text-muted)]">支持 JPEG、PNG、GIF、WebP 格式，建议图片大小不超过 10MB，推荐 16:10 比例以获得最佳显示效果</p>
          </div>
          <div v-if="skinConfig.imageUrl" class="mt-3">
            <div class="relative rounded-lg overflow-hidden border border-[var(--color-border)]">
              <img :src="skinConfig.imageUrl" class="w-full h-32 object-cover" alt="背景预览" />
            </div>
            <button
              @click="removeBackgroundImage"
              class="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center justify-center gap-1 w-full"
            >
              <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
              移除背景图片
            </button>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2">图片透明度</label>
          <div class="flex items-center gap-3">
            <input
              type="range"
              v-model.number="skinConfig.imageOpacity"
              min="0"
              max="1"
              step="0.1"
              class="flex-1"
            />
            <span class="text-sm text-[var(--color-text-primary)] w-12 text-right">{{ (skinConfig.imageOpacity ?? 1) * 100 }}%</span>
          </div>
        </div>
      </div>

    </UCard>
    </div>
  </div>
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
