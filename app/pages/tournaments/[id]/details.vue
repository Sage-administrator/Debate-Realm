<!--
  details.vue - 界面元素配置页面
  功能：
  - 左侧 TimerPreview 实时预览界面效果
  - 右侧配置界面元素（按元素分组：比赛标题 / 环节名称 / 横幅 / 队伍名称 / 计时器 / 总体设置）
  - 每个元素组内集中其「字体 / 字号 / 颜色」等可配置点，逻辑清晰
  - 配置修改实时同步到数据库（timer-config API）
-->
<script setup lang="ts">
definePageMeta({ layout: 'tournament' })

// ═══════════ 导入 ═══════════
import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

// ═══════════ Nuxt 组合式 API ═══════════
const route = useRoute()
const toast = useToast()
const { config, loadConfig, saveConfig: apiSave, loading } = useTimerConfig()

// ═══════════ 界面元素配置默认值（字体 / 字号 / 颜色 / 横幅 / 位置） ═══════════
// 集中定义，初始值与 loadConfig 合并共用，保证颜色选择器/输入框有正确初值
const defaultUiConfig = {
  showTitle: true,
  showBanner: true,
  titleColor: '#0369a1',
  positiveLabel: '正方',
  negativeLabel: '反方',
  teamNameColor: '#FFFFFF',
  // —— 字体族（空 = 默认宋体 / 计时器默认数码字体）——
  fontFamily: '',             // 全局默认字体（各元素未单独设置时生效）
  titleFontFamily: '',        // 比赛标题字体
  stageTitleFontFamily: '',   // 环节名称字体
  bannerFontFamily: '',       // 横幅（辩题 + 标签）字体
  teamNameFontFamily: '',     // 队伍名称字体
  timerFontFamily: '',        // 计时数字字体
  // —— 字号（px，基于 1280x720 设计基准）——
  eventFontSize: 50,        // 比赛标题
  bannerFontSize: 21,       // 横幅辩题文字
  teamNameFontSize: 21,     // 队伍名称
  stageTitleFontSize: 64,   // 环节名称
  timerFontSize: 200,       // 计时数字
  labelFontSize: 38,        // 正方/反方标签框
  // —— 颜色 ——
  stageTitleColor: '#FFFFFF',   // 环节名颜色
  timerColor: '#FFFFFF',        // 计时数字颜色（非告警态）
  dualTimerColorPos: 'rgb(169, 35, 35)',   // 双计时器正方数字颜色（红）
  dualTimerColorNeg: 'rgb(3, 105, 161)',   // 双计时器反方数字颜色（蓝）
  bannerColorPos: '#A92323',    // 横幅颜色·正方（红）
  bannerColorNeg: '#0369A1',    // 横幅颜色·反方（蓝）
  bannerFontColorPos: '#FFFFFF',// 横幅文字颜色·正方
  bannerFontColorNeg: '#FFFFFF',// 横幅文字颜色·反方
  // —— 横幅 ——
  bannerHeight: 5,          // 横幅厚度（红蓝条垂直内边距）
  bannerPos: 0,             // 横幅上下位置偏移（vh，负=上移）
  // —— 元素位置（px）——
  contentPaddingTop: 56,    // 主内容区顶部间距（标题/计时整体上下位置）
  titleMarginBottom: 12,    // 标题与环节名间距
  stageTimerGap: 10,        // 环节名与计时器间距
}

// 字体族预设（value 为完整 CSS font-family）—— 用于 比赛标题 / 环节名称 / 横幅 / 队伍名称
const fontFamilyOptions = [
  { label: '宋体（默认）', value: '' },
  { label: '黑体', value: "'SourceHanSansCN-Heavy', 'SimHei', '黑体', sans-serif" },
  { label: '楷体', value: "'KaiTi', '楷体', serif" },
  { label: '微软雅黑', value: "'Microsoft YaHei', '微软雅黑', sans-serif" },
  { label: '系统无衬线', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
]
// 计时器专有字体预设：默认 = 数码字体（Digiface），其余为用户可选替代字体
const timerFontFamilyOptions = [
  { label: '数码字体（默认）', value: '' },
  { label: '黑体', value: "'SourceHanSansCN-Heavy', 'SimHei', '黑体', sans-serif" },
  { label: '楷体', value: "'KaiTi', '楷体', serif" },
  { label: '微软雅黑', value: "'Microsoft YaHei', '微软雅黑', sans-serif" },
  { label: '系统无衬线', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
]
// 横幅颜色预设（含历史红蓝）
const bannerColorPresets = ['#A92323', '#0369A1', '#DC2626', '#2563EB', '#DC2626', '#1D4ED8', '#FFFFFF', '#000000', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899']

// ═══════════ 数据模型 ═══════════
const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)

// 预览当前环节索引
const previewStageIndex = ref(0)

// ═══════════ 生命周期 ═══════════
onMounted(async () => {
  await loadConfig(tournamentId.value, 'tournament')
  // 首次打开或 uiConfig 为空时，用默认值补齐，确保颜色选择器/预览有正确初始值
  if (!config.value.uiConfig || Object.keys(config.value.uiConfig).length === 0) {
    config.value.uiConfig = { ...defaultUiConfig }
  } else {
    // 以默认值为底，已有配置值覆盖（保持兼容：用户未改的字段用默认值）
    config.value.uiConfig = { ...defaultUiConfig, ...config.value.uiConfig }
  }
})

// 配置变化时自动保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => [config.value.uiConfig, config.value.title, config.value.positiveTopic, config.value.negativeTopic, config.value.teamPositiveName, config.value.teamNegativeName],
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!loading.value) apiSave(tournamentId.value, 'tournament')
    }, 1500)
  },
  { deep: true }
)
</script>

<template>
  <template v-if="tournament">
  <!-- ═══ 主内容：左侧预览 + 右侧配置（左1/3 + 右2/3） ═══ -->
  <div class="py-6 grid grid-cols-12 gap-6">

    <!-- 左侧：实时预览（左4列，约1/3宽度） -->
    <div class="col-span-4">
      <TimerPreviewCard
        :full-config="config"
        :tournament-id="tournamentId"
        v-model:stage-index="previewStageIndex"
      />
    </div>

    <!-- 右侧：界面配置区域（右8列，约2/3宽度） -->
    <div class="col-span-8">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-palette" class="w-4 h-4 text-[var(--color-text-muted)]" />
            <h2 class="text-base font-semibold text-[var(--color-text-primary)]">界面元素设置</h2>
          </div>
        </template>

        <!-- ════════ 1. 比赛标题 ════════ -->
        <div class="mb-6">
          <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5 cursor-pointer">
            <UIcon name="i-lucide-type" class="w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="checkbox" v-model="config.uiConfig.showTitle" class="w-4 h-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
            <span>比赛标题</span>
          </label>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-4">
            <input
              v-model="config.title"
              type="text"
              class="input-glass w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="例如：2025年度校际辩论赛总决赛"
            />
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">颜色</label>
                <div class="flex items-center gap-2">
                  <ColorPicker v-model="config.uiConfig.titleColor" />
                  <input
                    type="text"
                    v-model="config.uiConfig.titleColor"
                    class="input-glass h-11 flex-1 min-w-0 px-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="#0369a1"
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字体</label>
                <select
                  v-model="config.uiConfig.titleFontFamily"
                  class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option v-for="opt in fontFamilyOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字号（px）</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="10" max="200" v-model.number="config.uiConfig.eventFontSize" class="range-bar flex-1" />
                  <input type="number" min="10" max="200" v-model.number="config.uiConfig.eventFontSize" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ════════ 2. 环节名称 ════════ -->
        <div class="mb-6">
          <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
            <UIcon name="i-lucide-heading" class="w-4 h-4 text-[var(--color-text-muted)]" /> 环节名称
          </label>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">颜色</label>
              <div class="flex items-center gap-2">
                <ColorPicker v-model="config.uiConfig.stageTitleColor" />
                <input type="text" v-model="config.uiConfig.stageTitleColor" class="input-glass h-11 flex-1 min-w-0 px-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="#FFFFFF" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字体</label>
              <select
                v-model="config.uiConfig.stageTitleFontFamily"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option v-for="opt in fontFamilyOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字号（px）</label>
              <div class="flex items-center gap-3">
                <input type="range" min="10" max="300" v-model.number="config.uiConfig.stageTitleFontSize" class="range-bar flex-1" />
                <input type="number" min="10" max="300" v-model.number="config.uiConfig.stageTitleFontSize" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
              </div>
            </div>
          </div>
        </div>

        <!-- ════════ 3. 横幅 / 辩题 ════════ -->
        <div class="mb-6">
          <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5 cursor-pointer">
            <UIcon name="i-lucide-rectangle-horizontal" class="w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="checkbox" v-model="config.uiConfig.showBanner" class="w-4 h-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
            <span>横幅 / 辩题</span>
          </label>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div class="col-span-2">
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字体（辩题 + 标签）</label>
                <select
                  v-model="config.uiConfig.bannerFontFamily"
                  class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option v-for="opt in fontFamilyOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">辩题文字字号（px）</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="8" max="80" v-model.number="config.uiConfig.bannerFontSize" class="range-bar flex-1" />
                  <input type="number" min="8" max="80" v-model.number="config.uiConfig.bannerFontSize" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">正方/反方标签字号（px）</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="10" max="120" v-model.number="config.uiConfig.labelFontSize" class="range-bar flex-1" />
                  <input type="number" min="10" max="120" v-model.number="config.uiConfig.labelFontSize" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">横幅厚度（宽窄）</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="0" max="60" v-model.number="config.uiConfig.bannerHeight" class="range-bar flex-1" />
                  <input type="number" min="0" max="60" v-model.number="config.uiConfig.bannerHeight" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">横幅上下位置（负=上移）</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="-5" max="5" step="0.5" v-model.number="config.uiConfig.bannerPos" class="range-bar flex-1" />
                  <input type="number" step="0.5" min="-5" max="5" v-model.number="config.uiConfig.bannerPos" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>

            <!-- 颜色分组：正方/反方横幅色 + 文字色，整齐 2×2 排列 -->
            <div class="pt-1">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1">横幅颜色·正方</label>
                  <div class="flex items-center gap-2">
                    <ColorPicker v-model="config.uiConfig.bannerColorPos" :preset-colors="bannerColorPresets" />
                    <input type="text" v-model="config.uiConfig.bannerColorPos" class="input-glass h-11 w-28 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="#A92323" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1">横幅颜色·反方</label>
                  <div class="flex items-center gap-2">
                    <ColorPicker v-model="config.uiConfig.bannerColorNeg" :preset-colors="bannerColorPresets" />
                    <input type="text" v-model="config.uiConfig.bannerColorNeg" class="input-glass h-11 w-28 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="#0369A1" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1">横幅文字颜色·正方</label>
                  <div class="flex items-center gap-2">
                    <ColorPicker v-model="config.uiConfig.bannerFontColorPos" />
                    <input type="text" v-model="config.uiConfig.bannerFontColorPos" class="input-glass h-11 w-28 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="#FFFFFF" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-[var(--color-text-secondary)] mb-1">横幅文字颜色·反方</label>
                  <div class="flex items-center gap-2">
                    <ColorPicker v-model="config.uiConfig.bannerFontColorNeg" />
                    <input type="text" v-model="config.uiConfig.bannerFontColorNeg" class="input-glass h-11 w-28 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="#FFFFFF" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ════════ 4. 队伍名称 ════════ -->
        <div class="mb-6">
          <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
            <UIcon name="i-lucide-users" class="w-4 h-4 text-[var(--color-text-muted)]" /> 队伍名称
          </label>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">颜色</label>
              <div class="flex items-stretch gap-2">
                <ColorPicker v-model="config.uiConfig.teamNameColor" />
                <input
                  type="text"
                  v-model="config.uiConfig.teamNameColor"
                  class="input-glass w-28 h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字体</label>
              <select
                v-model="config.uiConfig.teamNameFontFamily"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option v-for="opt in fontFamilyOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字号（px）</label>
              <div class="flex items-center gap-3">
                <input type="range" min="8" max="80" v-model.number="config.uiConfig.teamNameFontSize" class="range-bar flex-1" />
                <input type="number" min="8" max="80" v-model.number="config.uiConfig.teamNameFontSize" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">正方标签</label>
              <input
                v-model="config.uiConfig.positiveLabel"
                type="text"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="正方"
              />
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">反方标签</label>
              <input
                v-model="config.uiConfig.negativeLabel"
                type="text"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="反方"
              />
            </div>
          </div>
        </div>

        <!-- ════════ 5. 计时器 ════════ -->
        <div class="mb-6">
          <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
            <UIcon name="i-lucide-timer" class="w-4 h-4 text-[var(--color-text-muted)]" /> 计时器
          </label>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">单计时器颜色（非告警态）</label>
              <div class="flex items-center gap-2">
                <ColorPicker v-model="config.uiConfig.timerColor" />
                <input type="text" v-model="config.uiConfig.timerColor" class="input-glass h-11 flex-1 min-w-0 px-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="#FFFFFF" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">双计时器正方数字</label>
              <div class="flex items-center gap-2">
                <ColorPicker v-model="config.uiConfig.dualTimerColorPos" :preset-colors="bannerColorPresets" />
                <input type="text" v-model="config.uiConfig.dualTimerColorPos" class="input-glass h-11 flex-1 min-w-0 px-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="rgb(169, 35, 35)" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">双计时器反方数字</label>
              <div class="flex items-center gap-2">
                <ColorPicker v-model="config.uiConfig.dualTimerColorNeg" :preset-colors="bannerColorPresets" />
                <input type="text" v-model="config.uiConfig.dualTimerColorNeg" class="input-glass h-11 flex-1 min-w-0 px-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" placeholder="rgb(3, 105, 161)" />
              </div>
            </div>
          </div>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字体（留空=数码字体）</label>
              <select
                v-model="config.uiConfig.timerFontFamily"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option v-for="opt in timerFontFamilyOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字号（px）</label>
              <div class="flex items-center gap-3">
                <input type="range" min="40" max="400" v-model.number="config.uiConfig.timerFontSize" class="range-bar flex-1" />
                <input type="number" min="40" max="400" v-model.number="config.uiConfig.timerFontSize" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
              </div>
            </div>
          </div>
        </div>

        <!-- ════════ 6. 总体设置（默认字体 + 元素位置） ════════ -->
        <div class="mb-6">
          <label class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
            <UIcon name="i-lucide-align-vertical-space-around" class="w-4 h-4 text-[var(--color-text-muted)]" /> 总体设置
          </label>
          <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-3">
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">默认字体（各元素未单独设置时生效）</label>
              <select
                v-model="config.uiConfig.fontFamily"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option v-for="opt in fontFamilyOptions" :key="opt.label" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3">
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">主内容顶部间距（标题/计时整体上下位置）</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="0" max="300" v-model.number="config.uiConfig.contentPaddingTop" class="range-bar flex-1" />
                  <input type="number" min="0" max="300" v-model.number="config.uiConfig.contentPaddingTop" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">标题与环节名间距</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="0" max="200" v-model.number="config.uiConfig.titleMarginBottom" class="range-bar flex-1" />
                  <input type="number" min="0" max="200" v-model.number="config.uiConfig.titleMarginBottom" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label class="block text-xs text-[var(--color-text-secondary)] mb-1">环节名与计时器间距</label>
                <div class="flex items-center gap-3">
                  <input type="range" min="0" max="200" v-model.number="config.uiConfig.stageTimerGap" class="range-bar flex-1" />
                  <input type="number" min="0" max="200" v-model.number="config.uiConfig.stageTimerGap" class="input-glass h-9 w-16 px-2 text-center border border-[var(--color-border)] rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </UCard>
    </div>
  </div>
  </template>
</template>

<style scoped>
/* 深色玻璃拟态样式已由全局 main.css 中的 .tab-dark-* 类提供，此处无需额外 scoped 样式 */

/* 间距滑块：条状调节 + 右侧小块数字 */
.range-bar {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 9999px;
  background: var(--color-border);
  outline: none;
  cursor: pointer;
}
.range-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.range-bar::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
</style>
