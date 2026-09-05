<!--
  skin.vue - 背景配置页面
  功能：
  - 左侧 TimerPreview 实时预览背景效果
  - 右侧配置背景样式（默认/纯色/渐变/图片）
  - 支持颜色选择器、背景图片上传
  - 配置修改实时同步到数据库（timer-config API）
-->
<script setup lang="ts">
definePageMeta({ layout: 'standalone' })

import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

const route = useRoute()
const toast = useToast()
const tournament = inject<Ref<any>>('standaloneMatch')!
const matchId = computed(() => route.params.id as string)

const previewStageIndex = ref(0)

// 背景图片 URL 输入（不再使用上传）
const backgroundImageUrl = ref('')

// 使用共享配置（跨皮肤/计时器/环节等页面共享，避免重复 fetch + 跨页不一致）
const { config, loadConfig: loadShared, saveConfig: saveShared, loading } = useTimerConfig()
const skinConfig = computed({
  get: () => config.value.skinConfig || {},
  set: (val) => {
    config.value.skinConfig = val
  },
})

async function loadSkinConfig() {
  await loadShared(matchId.value, 'standalone')

  // 加载完成后同步背景图片 URL 到输入框
  if (config.value.skinConfig?.imageUrl) {
    backgroundImageUrl.value = config.value.skinConfig.imageUrl
  }
}

async function saveSkinConfig() {
  await saveShared(matchId.value, 'standalone')
}

function setBackgroundType(type: string) {
  config.value.skinConfig.backgroundType = type
}

// 应用背景图片 URL
function applyBackgroundImageUrl() {
  const url = backgroundImageUrl.value.trim()
  if (!url) {
    removeBackgroundImage()
    return
  }
  config.value.skinConfig.imageUrl = url
  config.value.skinConfig.backgroundType = 'image'
  toast.add({ title: '背景图片已更新', color: 'success' })
}

function removeBackgroundImage() {
  backgroundImageUrl.value = ''
  config.value.skinConfig.imageUrl = ''
  config.value.skinConfig.backgroundType = 'default'
}

onMounted(() => loadSkinConfig())

let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => config.value.skinConfig,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!loading.value) saveSkinConfig()
    }, 1500)
  },
  { deep: true },
)
</script>

<template>
  <template v-if="tournament">
    <div class="py-6 grid grid-cols-12 gap-6">
      <div class="col-span-4">
        <TimerPreviewCard
          :full-config="config"
          :tournament-id="matchId"
          type="standalone"
          v-model:stage-index="previewStageIndex"
        />
      </div>

      <div class="col-span-8">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2
                class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
              >
                <UIcon name="i-lucide-palette" class="w-4 h-4 text-[var(--color-text-muted)]" />
                背景设置
              </h2>
            </div>
          </template>

          <div class="mb-6">
            <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-3"
              >背景模式</label
            >
            <div class="grid grid-cols-4 gap-3">
              <button
                @click="setBackgroundType('default')"
                :class="[
                  'config-option-dark',
                  skinConfig.backgroundType === 'default' ? 'config-option-dark--active' : '',
                ]"
              >
                <div class="config-option-preview config-option-preview--default"></div>
                <span class="text-sm font-medium mt-2">默认</span>
              </button>
              <button
                @click="setBackgroundType('solid')"
                :class="[
                  'config-option-dark',
                  skinConfig.backgroundType === 'solid' ? 'config-option-dark--active' : '',
                ]"
              >
                <div
                  class="config-option-preview"
                  :style="{ backgroundColor: skinConfig.solidColor || '#1F2937' }"
                ></div>
                <span class="text-sm font-medium mt-2">纯色</span>
              </button>
              <button
                @click="setBackgroundType('gradient')"
                :class="[
                  'config-option-dark',
                  skinConfig.backgroundType === 'gradient' ? 'config-option-dark--active' : '',
                ]"
              >
                <div
                  class="config-option-preview"
                  :style="{
                    background: `linear-gradient(135deg, ${skinConfig.gradientStart || '#1F2937'} 0%, ${skinConfig.gradientEnd || '#374151'} 100%)`,
                  }"
                ></div>
                <span class="text-sm font-medium mt-2">渐变</span>
              </button>
              <button
                @click="setBackgroundType('image')"
                :class="[
                  'config-option-dark',
                  skinConfig.backgroundType === 'image' ? 'config-option-dark--active' : '',
                ]"
              >
                <div
                  class="config-option-preview"
                  :style="
                    skinConfig.imageUrl
                      ? {
                          backgroundImage: `url(${skinConfig.imageUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : {}
                  "
                >
                  <span v-if="!skinConfig.imageUrl" class="text-xs text-[var(--color-text-muted)]"
                    >图片</span
                  >
                </div>
                <span class="text-sm font-medium mt-2">图片</span>
              </button>
            </div>
          </div>

          <div v-if="skinConfig.backgroundType === 'solid'" class="mb-6">
            <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
              >背景颜色</label
            >
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
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >起始颜色</label
              >
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
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >结束颜色</label
              >
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
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >背景图片 URL</label
              >
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
                <p class="text-xs text-[var(--color-text-muted)]">
                  支持 JPEG、PNG、GIF、WebP 格式，建议图片大小不超过 10MB，推荐 16:10
                  比例以获得最佳显示效果
                </p>
              </div>
              <div v-if="skinConfig.imageUrl" class="mt-3">
                <div
                  class="relative rounded-lg overflow-hidden border border-[var(--color-border)]"
                >
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
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >图片透明度</label
              >
              <div class="flex items-center gap-3">
                <input
                  type="range"
                  v-model.number="skinConfig.imageOpacity"
                  min="0"
                  max="1"
                  step="0.1"
                  class="flex-1"
                />
                <span class="text-sm text-[var(--color-text-primary)] w-12 text-right"
                  >{{ (skinConfig.imageOpacity ?? 1) * 100 }}%</span
                >
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </template>
</template>

<style scoped>
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
  background: linear-gradient(135deg, #1e3a5f 0%, #2d4a6b 50%, #1f2937 100%);
}
</style>
