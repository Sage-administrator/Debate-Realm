<!--
  teams.vue - 队徽设置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置正反方队徽图片和显示开关
  - 配置修改实时同步到数据库（timer-config API）
  - 支持队徽图片上传到 public/uploads/images 文件夹
-->
<script setup lang="ts">
definePageMeta({ layout: 'standalone' })

import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

const tournament = inject<Ref<any>>('standaloneMatch')!
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const matchId = computed(() => route.params.id as string)

const previewStageIndex = ref(0)

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
  teamLogoConfig: {
    positiveLogoUrl?: string
    negativeLogoUrl?: string
    showTeamLogo?: boolean
  }
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
  teamLogoConfig: {
    positiveLogoUrl: '',
    negativeLogoUrl: '',
    showTeamLogo: true,
  },
  stages: [],
})

async function loadConfig() {
  loading.value = true
  try {
    if (tournament.value) {
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
    }

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
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = {
        positiveLogoUrl: '',
        negativeLogoUrl: '',
        showTeamLogo: true,
        ...(cfg.teamLogoConfig || {}),
      }
      fullConfig.value.stages = cfg.stages || []

      if (fullConfig.value.stages.length === 0) {
        fullConfig.value.stages = getDefaultStages()
      }
    } else {
      fullConfig.value.stages = getDefaultStages()
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

function getDefaultStages() {
  return [
    { id: 1, name: '开篇立论', duration: 180, type: 'speech', order: 1 },
    { id: 2, name: '攻辩', duration: 120, type: 'speech', order: 2 },
    { id: 3, name: '自由辩论', duration: 240, type: 'dual-timer', order: 3, positiveDuration: 120, negativeDuration: 120 },
    { id: 4, name: '总结陈词', duration: 180, type: 'speech', order: 4 },
  ]
}

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

async function onLogoSelect(event: Event, field: 'positiveLogoUrl' | 'negativeLogoUrl') {
  const target = event.target as HTMLInputElement
  if (!target?.files?.[0]) return

  const file = target.files[0]
  uploading.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'images')

    const uploadRes = await $fetch<any>('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (uploadRes?.success && uploadRes?.data?.path) {
      fullConfig.value.teamLogoConfig[field] = uploadRes.data.path
      toast.add({
        title: `已上传: ${uploadRes.data.originalName}`,
        color: 'success'
      })
    } else {
      toast.add({ title: '上传失败，请重试', color: 'error' })
    }
  } catch (e: any) {
    console.error('队徽上传错误:', e)
    toast.add({ title: e?.data?.statusMessage || '上传失败', color: 'error' })
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function removeLogo(field: 'positiveLogoUrl' | 'negativeLogoUrl') {
  fullConfig.value.teamLogoConfig[field] = ''
}

onMounted(() => loadConfig())

let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => fullConfig.value.teamLogoConfig,
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
  <main class="py-6 grid grid-cols-12 gap-6">

    <div class="col-span-4">
      <TimerPreviewCard
        :full-config="fullConfig"
        :tournament-id="matchId"
        type="standalone"
        v-model:stage-index="previewStageIndex"
      />
    </div>

    <div class="col-span-8 space-y-4">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <UIcon name="i-lucide-shield" class="w-4 h-4 text-[var(--color-text-muted)]" />
            队徽设置
          </h2>
        </template>

        <div class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded mb-4">
          <div>
            <label class="text-sm text-[var(--color-text-primary)] font-medium">在计时器中显示队徽</label>
            <p class="text-xs text-[var(--color-text-muted)]">控制队伍名称旁是否显示队徽</p>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" v-model="fullConfig.teamLogoConfig.showTeamLogo">
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="border border-[var(--color-border)] rounded-lg p-4">
            <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              正方队伍队徽
            </label>
            <div class="flex flex-col items-center gap-3">
              <div class="w-24 h-24 border-2 border-dashed border-[var(--color-border)] rounded-lg overflow-hidden flex items-center justify-center bg-[var(--color-bg-secondary)]">
                <img v-if="fullConfig.teamLogoConfig.positiveLogoUrl" :src="fullConfig.teamLogoConfig.positiveLogoUrl" class="w-full h-full object-cover" alt="正方队徽" />
                <div v-else class="flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                  <UIcon name="i-lucide-image" class="w-8 h-8 mb-1" />
                  <span class="text-xs">暂无图片</span>
                </div>
              </div>
              <div class="flex gap-2">
                <label class="px-4 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2">
                  <UIcon name="i-lucide-upload" class="w-4 h-4" />
                  选择图片
                  <input type="file" accept="image/*" class="hidden" @change="(e: Event) => onLogoSelect(e, 'positiveLogoUrl')" />
                </label>
                <button
                  v-if="fullConfig.teamLogoConfig.positiveLogoUrl"
                  @click="removeLogo('positiveLogoUrl')"
                  class="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                  移除队徽
                </button>
              </div>
            </div>
          </div>

          <div class="border border-[var(--color-border)] rounded-lg p-4">
            <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
              反方队伍队徽
            </label>
            <div class="flex flex-col items-center gap-3">
              <div class="w-24 h-24 border-2 border-dashed border-[var(--color-border)] rounded-lg overflow-hidden flex items-center justify-center bg-[var(--color-bg-secondary)]">
                <img v-if="fullConfig.teamLogoConfig.negativeLogoUrl" :src="fullConfig.teamLogoConfig.negativeLogoUrl" class="w-full h-full object-cover" alt="反方队徽" />
                <div v-else class="flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                  <UIcon name="i-lucide-image" class="w-8 h-8 mb-1" />
                  <span class="text-xs">暂无图片</span>
                </div>
              </div>
              <div class="flex gap-2">
                <label class="px-4 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2">
                  <UIcon name="i-lucide-upload" class="w-4 h-4" />
                  选择图片
                  <input type="file" accept="image/*" class="hidden" @change="(e: Event) => onLogoSelect(e, 'negativeLogoUrl')" />
                </label>
                <button
                  v-if="fullConfig.teamLogoConfig.negativeLogoUrl"
                  @click="removeLogo('negativeLogoUrl')"
                  class="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                  移除队徽
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--color-border)]">
          <p class="text-xs text-[var(--color-text-muted)]">
            提示：修改后会自动保存。支持 JPG、PNG、GIF，单个文件最大 10MB。建议使用 256x256 以上的方形图片。
          </p>
        </div>
      </UCard>
    </div>
  </main>
  </template>
</template>

<style scoped>
</style>