<!--
  details.vue - 界面元素配置页面
  功能：
  - 左侧 TimerPreview 实时预览界面效果
  - 右侧配置界面元素（标题、横幅显示、颜色、队伍标签等）
  - 配置修改实时同步到数据库（timer-config API）
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
  teamLogoConfig: Record<string, any>
  stages: any[]
}>({
  name: '',
  title: '',
  positiveTopic: '',
  negativeTopic: '',
  teamPositiveName: '',
  teamNegativeName: '',
  uiConfig: {
    showTitle: true,
    showBanner: true,
    titleColor: '#0369a1',
    positiveLabel: '正方',
    negativeLabel: '反方',
    teamNameColor: '#FFFFFF',
  },
  skinConfig: {},
  audioConfig: {},
  teamLogoConfig: {},
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
      fullConfig.value.uiConfig = {
        showTitle: true,
        showBanner: true,
        titleColor: '#0369a1',
        positiveLabel: '正方',
        negativeLabel: '反方',
        teamNameColor: '#FFFFFF',
        ...cfg.uiConfig,
      }
      fullConfig.value.skinConfig = cfg.skinConfig || {}
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = cfg.teamLogoConfig || {}
      fullConfig.value.stages = cfg.stages || []
    } else {
      fullConfig.value.uiConfig = {
        showTitle: true,
        showBanner: true,
        titleColor: '#0369a1',
        positiveLabel: '正方',
        negativeLabel: '反方',
        teamNameColor: '#FFFFFF',
      }
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

onMounted(() => loadConfig())

let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => [fullConfig.value.uiConfig, fullConfig.value.title, fullConfig.value.positiveTopic, fullConfig.value.negativeTopic, fullConfig.value.teamPositiveName, fullConfig.value.teamNegativeName],
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
        :tournament-id="matchId"
        type="standalone"
        v-model:stage-index="previewStageIndex"
      />
    </div>

    <div class="col-span-8">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-palette" class="w-4 h-4 text-[var(--color-text-muted)]" />
            <h2 class="text-base font-semibold text-[var(--color-text-primary)]">界面元素设置</h2>
          </div>
        </template>

      <div class="mb-6">
        <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
          <UIcon name="i-lucide-type" class="w-4 h-4 text-[var(--color-text-muted)]" /> 比赛标题
        </label>
        <input
          v-model="fullConfig.title"
          type="text"
          class="input-glass w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          placeholder="例如：2025年度校际辩论赛总决赛"
        />
      </div>

      <div class="mb-6 space-y-4">
        <label class="block text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <UIcon name="i-lucide-eye" class="w-4 h-4 text-[var(--color-text-muted)]" /> 显示选项
        </label>
        <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-3 cursor-pointer flex-1">
              <input type="checkbox" v-model="fullConfig.uiConfig.showTitle" class="w-4 h-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
              <span class="text-sm text-[var(--color-text-primary)]">显示比赛标题</span>
            </label>
            <div class="flex items-center gap-2 ml-4">
              <ColorPicker v-model="fullConfig.uiConfig.titleColor" />
              <input
                type="text"
                v-model="fullConfig.uiConfig.titleColor"
                class="input-glass h-11 w-28 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="#0369a1"
              />
            </div>
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" v-model="fullConfig.uiConfig.showBanner" class="w-4 h-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
            <span class="text-sm text-[var(--color-text-primary)]">显示横幅/辩题</span>
          </label>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-[auto_1fr_1fr] gap-4">
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">队伍名称颜色</label>
          <div class="flex items-stretch gap-2">
            <ColorPicker v-model="fullConfig.uiConfig.teamNameColor" />
            <input
              type="text"
              v-model="fullConfig.uiConfig.teamNameColor"
              class="input-glass w-28 h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="#FFFFFF"
            />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">正方标签</label>
          <input
            v-model="fullConfig.uiConfig.positiveLabel"
            type="text"
            class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            placeholder="正方"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">反方标签</label>
          <input
            v-model="fullConfig.uiConfig.negativeLabel"
            type="text"
            class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            placeholder="反方"
          />
        </div>
      </div>

      </UCard>
    </div>
  </div>
  </template>
</template>

<style scoped>
</style>