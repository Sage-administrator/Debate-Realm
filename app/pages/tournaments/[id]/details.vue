<!--
  details.vue - 界面元素配置页面
  功能：
  - 左侧 TimerPreview 实时预览界面效果
  - 右侧配置界面元素（标题、横幅显示、颜色、队伍标签等）
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
  // ⭐ 初始值设置：确保页面渲染时颜色选择器有正确的默认值
  uiConfig: {
    showTitle: true,
    showBanner: true,
    titleColor: '#FFFFFF',     // ⭐ 标题颜色默认白色
    positiveLabel: '正方',
    negativeLabel: '反方',
    teamNameColor: '#0369a1',  // ⭐ 队伍名称颜色默认深蓝色
  },
  skinConfig: {},
  audioConfig: {},
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
      // ⭐ 合并默认值：showTitle 和 showBanner 默认勾选，标题颜色白色，队伍名称颜色深蓝色
      fullConfig.value.uiConfig = {
        showTitle: true,
        showBanner: true,
        titleColor: '#FFFFFF',     // ⭐ 标题颜色默认白色
        positiveLabel: '正方',
        negativeLabel: '反方',
        teamNameColor: '#0369a1',  // ⭐ 队伍名称颜色默认深蓝色
        ...cfg.uiConfig, // 数据库值覆盖默认值
      }
      fullConfig.value.skinConfig = cfg.skinConfig || {}
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = cfg.teamLogoConfig || {}
      fullConfig.value.stages = cfg.stages || []
    } else {
      // 新配置，使用默认 UI
      fullConfig.value.name = tournament.value.name
      fullConfig.value.title = tournament.value.name
      fullConfig.value.uiConfig = {
        showTitle: true,
        showBanner: true,
        titleColor: '#FFFFFF',     // ⭐ 标题颜色默认白色
        positiveLabel: '正方',
        negativeLabel: '反方',
        teamNameColor: '#0369a1',  // ⭐ 队伍名称颜色默认深蓝色
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

// ═══════════ 生命周期 ═══════════
onMounted(() => loadConfig())

// 配置变化时自动保存（防抖）
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
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary tab-secondary--active">界面</NuxtLink>
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

          <!-- 右侧：界面配置区域（右8列，约2/3宽度） -->
          <div class="col-span-8 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div class="flex items-center gap-2 mb-5">
              <UIcon name="i-lucide-palette" class="w-5 h-5 text-indigo-600" />
              <h2 class="text-lg font-bold text-gray-900">界面元素设置</h2>
            </div>

            <!-- 比赛标题 -->
            <div class="mb-6">
              <label class="block text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                <UIcon name="i-lucide-type" class="w-4 h-4 text-gray-500" /> 比赛标题
              </label>
              <input
                v-model="fullConfig.title"
                type="text"
                class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="例如：2025年度校际辩论赛总决赛"
              />
            </div>

            <!-- 显示选项 -->
            <div class="mb-6 space-y-4">
              <label class="block text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <UIcon name="i-lucide-eye" class="w-4 h-4 text-gray-500" /> 显示选项
              </label>
              <div class="bg-gray-50 rounded-lg p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <label class="flex items-center gap-3 cursor-pointer flex-1">
                    <input type="checkbox" v-model="fullConfig.uiConfig.showTitle" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
                    <span class="text-sm text-gray-700">显示比赛标题</span>
                  </label>
                  <div class="flex items-center gap-2 ml-4">
                    <div class="relative">
                      <input
                        type="color"
                        v-model="fullConfig.uiConfig.titleColor"
                        class="w-11 h-11 rounded-lg cursor-pointer border border-gray-200 hover:border-gray-400 transition-colors"
                      />
                    </div>
                    <input
                      type="text"
                      v-model="fullConfig.uiConfig.titleColor"
                      class="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" v-model="fullConfig.uiConfig.showBanner" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
                  <span class="text-sm text-gray-700">显示横幅/辩题</span>
                </label>
              </div>
            </div>

            <!-- 队伍名称颜色 + 标签（三列并列） -->
            <div class="mb-6 grid grid-cols-3 gap-4">
              <!-- 队伍名称颜色 -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1.5">队伍名称颜色</label>
                <div class="flex items-center gap-2">
                  <div class="relative">
                    <input
                      type="color"
                      v-model="fullConfig.uiConfig.teamNameColor"
                      class="w-11 h-11 rounded-lg cursor-pointer border border-gray-200 hover:border-gray-400 transition-colors"
                    />
                  </div>
                  <input
                    type="text"
                    v-model="fullConfig.uiConfig.teamNameColor"
                    class="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="#0369a1"
                  />
                </div>
              </div>
              <!-- 正方标签 -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1.5">正方标签</label>
                <input
                  v-model="fullConfig.uiConfig.positiveLabel"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="正方"
                />
              </div>
              <!-- 反方标签 -->
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1.5">反方标签</label>
                <input
                  v-model="fullConfig.uiConfig.negativeLabel"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="反方"
                />
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
