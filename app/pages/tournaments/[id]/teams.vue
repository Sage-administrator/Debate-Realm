<!--
  teams.vue - 队徽设置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置正反方队徽图片和显示开关
  - 配置修改实时同步到数据库（timer-config API）
  - 支持队徽图片上传到 public/uploads/images 文件夹
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
      fullConfig.value.skinConfig = cfg.skinConfig || {}
      fullConfig.value.audioConfig = cfg.audioConfig || {}
      fullConfig.value.teamLogoConfig = {
        positiveLogoUrl: '',
        negativeLogoUrl: '',
        showTeamLogo: true,
        ...(cfg.teamLogoConfig || {}),
      }
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

// ═══════════ 队徽图片上传处理 ═══════════
async function onLogoSelect(event: Event, field: 'positiveLogoUrl' | 'negativeLogoUrl') {
  const target = event.target as HTMLInputElement
  if (!target?.files?.[0]) return

  const file = target.files[0]
  uploading.value = true

  try {
    // 使用 FormData 上传文件到 /api/upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'images')

    const uploadRes = await $fetch<any>('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (uploadRes?.success && uploadRes?.data?.path) {
      // 保存上传文件的相对路径到配置中
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
    // 重置 input 以允许再次选择相同文件
    target.value = ''
  }
}

// ═══════════ 移除队徽 ═══════════
function removeLogo(field: 'positiveLogoUrl' | 'negativeLogoUrl') {
  fullConfig.value.teamLogoConfig[field] = ''
}

// ═══════════ 生命周期 ═══════════
onMounted(() => loadConfig())

// 配置变化时自动保存（防抖）
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

    <!-- 右侧：队徽配置（右8列，约2/3宽度） -->
    <div class="col-span-8 space-y-4">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-white flex items-center gap-2">
            <UIcon name="i-lucide-shield" class="w-4 h-4 text-white/40" />
            队徽设置
          </h2>
        </template>

        <!-- 显示开关 -->
        <div class="flex items-center justify-between py-2 px-3 bg-white/5 rounded mb-4">
          <div>
            <label class="text-sm text-white/80 font-medium">在计时器中显示队徽</label>
            <p class="text-xs text-white/40">控制队伍名称旁是否显示队徽</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="fullConfig.teamLogoConfig.showTeamLogo" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        <!-- 队徽设置（正反方并排） -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <!-- 正方队伍队徽 -->
          <div class="border border-white/10 rounded-lg p-4">
            <label class="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-full bg-red-500"></span>
              正方队伍队徽
            </label>
            <!-- 预览框和操作按钮上下排列 -->
            <div class="flex flex-col items-center gap-3">
              <!-- 预览框 -->
              <div class="w-24 h-24 border-2 border-dashed border-white/15 rounded-lg overflow-hidden flex items-center justify-center bg-white/5">
                <img v-if="fullConfig.teamLogoConfig.positiveLogoUrl" :src="fullConfig.teamLogoConfig.positiveLogoUrl" class="w-full h-full object-cover" alt="正方队徽" />
                <div v-else class="flex flex-col items-center justify-center text-white/40">
                  <UIcon name="i-lucide-image" class="w-8 h-8 mb-1" />
                  <span class="text-xs">暂无图片</span>
                </div>
              </div>
              <!-- 操作按钮 -->
              <div class="flex gap-2">
                <label class="px-4 py-2 border border-white/15 rounded text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2">
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

          <!-- 反方队伍队徽 -->
          <div class="border border-white/10 rounded-lg p-4">
            <label class="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
              反方队伍队徽
            </label>
            <!-- 预览框和操作按钮上下排列 -->
            <div class="flex flex-col items-center gap-3">
              <!-- 预览框 -->
              <div class="w-24 h-24 border-2 border-dashed border-white/15 rounded-lg overflow-hidden flex items-center justify-center bg-white/5">
                <img v-if="fullConfig.teamLogoConfig.negativeLogoUrl" :src="fullConfig.teamLogoConfig.negativeLogoUrl" class="w-full h-full object-cover" alt="反方队徽" />
                <div v-else class="flex flex-col items-center justify-center text-white/40">
                  <UIcon name="i-lucide-image" class="w-8 h-8 mb-1" />
                  <span class="text-xs">暂无图片</span>
                </div>
              </div>
              <!-- 操作按钮 -->
              <div class="flex gap-2">
                <label class="px-4 py-2 border border-white/15 rounded text-sm cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2">
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

        <!-- 说明文字 -->
        <div class="pt-4 border-t border-white/10">
          <p class="text-xs text-white/40">
            提示：修改后会自动保存。支持 JPG、PNG、GIF，单个文件最大 10MB。建议使用 256x256 以上的方形图片。
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
