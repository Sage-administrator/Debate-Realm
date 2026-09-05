<!--
  teams.vue - 队徽设置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置正反方队徽图片和显示开关
  - 配置修改实时同步到数据库（timer-config API）
  - 支持队徽图片上传到 public/uploads/images 文件夹
-->
<script setup lang="ts">
// ═══════════ 导入 ═══════════
import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

definePageMeta({ layout: 'tournament' })

// ═══════════ 基础工具 ═══════════
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()

// ═══════════ 数据模型 ═══════════
const tournament = inject<Ref<any>>('tournament')!
const { config, loadConfig: apiLoad, saveConfig: apiSave, loading } = useTimerConfig()
const saving = ref(false)
const uploading = ref(false)
const tournamentId = computed(() => route.params.id as string)

// 预览当前环节索引
const previewStageIndex = ref(0)

// ═══════════ 数据保存 ═══════════
async function savePageConfig() {
  saving.value = true
  try {
    await apiSave(tournamentId.value, 'tournament')
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
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
      body: formData,
    })

    if (uploadRes?.success && uploadRes?.data?.path) {
      // 保存上传文件的相对路径到配置中
      config.value.teamLogoConfig[field] = uploadRes.data.path
      toast.add({
        title: `已上传: ${uploadRes.data.originalName}`,
        color: 'success',
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
  config.value.teamLogoConfig[field] = ''
}

// ═══════════ 生命周期 ═══════════
onMounted(async () => {
  await apiLoad(tournamentId.value, 'tournament')
  // 从 injected tournament 补充名称
  if (tournament.value) {
    config.value.name = tournament.value.name
    config.value.title = tournament.value.name
  }
})

// 配置变化时自动保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => config.value.teamLogoConfig,
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!loading.value) savePageConfig()
    }, 1500)
  },
  { deep: true },
)
</script>

<template>
  <template v-if="tournament">
    <!-- ═══ 主内容：左侧预览 + 右侧配置（左1/3 + 右2/3） ═══ -->
    <div class="py-6 grid grid-cols-12 gap-6">
      <!-- 左侧：实时预览（左4列，约1/3宽度） -->
      <div class="col-span-4">
        <TimerPreviewCard
          v-model:stage-index="previewStageIndex"
          :full-config="config"
          :tournament-id="tournamentId"
        />
      </div>

      <!-- 右侧：队徽配置（右8列，约2/3宽度） -->
      <div class="col-span-8 space-y-4">
        <UCard>
          <template #header>
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-shield" class="w-4 h-4 text-[var(--color-text-muted)]" />
              队徽设置
            </h2>
          </template>

          <!-- 显示开关 -->
          <div
            class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded mb-4"
          >
            <div>
              <label class="text-sm text-[var(--color-text-primary)] font-medium"
                >在计时器中显示队徽</label
              >
              <p class="text-xs text-[var(--color-text-muted)]">控制队伍名称旁是否显示队徽</p>
            </div>
            <label class="toggle-switch">
              <input v-model="config.teamLogoConfig.showTeamLogo" type="checkbox" />
              <span class="toggle-slider" />
            </label>
          </div>

          <!-- 队徽大小和位置 -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >队徽大小 (px)</label
              >
              <input
                v-model.number="config.teamLogoConfig.logoSize"
                type="number"
                min="10"
                max="400"
                step="1"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <p class="text-xs text-[var(--color-text-muted)] mt-1">默认 57.6</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >水平位置 (左右, px)</label
              >
              <input
                v-model.number="config.teamLogoConfig.logoOffsetX"
                type="number"
                step="1"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <p class="text-xs text-[var(--color-text-muted)] mt-1">正数向右，负数向左</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-2"
                >垂直位置 (上下, px)</label
              >
              <input
                v-model.number="config.teamLogoConfig.logoOffsetY"
                type="number"
                step="1"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <p class="text-xs text-[var(--color-text-muted)] mt-1">正数向下，负数向上</p>
            </div>
          </div>

          <!-- 队徽设置（正反方并排） -->
          <div class="grid grid-cols-2 gap-4 mb-4">
            <!-- 正方队伍队徽 -->
            <div class="border border-[var(--color-border)] rounded-lg p-4">
              <label
                class="block text-sm font-medium text-[var(--color-text-primary)] mb-3 flex items-center gap-2"
              >
                <span class="inline-block w-3 h-3 rounded-full bg-red-500" />
                正方队伍队徽
              </label>
              <!-- 预览框和操作按钮上下排列 -->
              <div class="flex flex-col items-center gap-3">
                <!-- 预览框 -->
                <div
                  class="w-24 h-24 border-2 border-dashed border-[var(--color-border)] rounded-lg overflow-hidden flex items-center justify-center bg-[var(--color-bg-secondary)]"
                >
                  <img
                    v-if="config.teamLogoConfig.positiveLogoUrl"
                    :src="config.teamLogoConfig.positiveLogoUrl"
                    class="w-full h-full object-cover"
                    alt="正方队徽"
                  />
                  <div
                    v-else
                    class="flex flex-col items-center justify-center text-[var(--color-text-muted)]"
                  >
                    <UIcon name="i-lucide-image" class="w-8 h-8 mb-1" />
                    <span class="text-xs">暂无图片</span>
                  </div>
                </div>
                <!-- 操作按钮 -->
                <div class="flex gap-2">
                  <label
                    class="px-4 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2"
                  >
                    <UIcon name="i-lucide-upload" class="w-4 h-4" />
                    选择图片
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="(e: Event) => onLogoSelect(e, 'positiveLogoUrl')"
                    />
                  </label>
                  <button
                    v-if="config.teamLogoConfig.positiveLogoUrl"
                    class="px-4 py-2 text-sm text-red-500 dark:text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    @click="removeLogo('positiveLogoUrl')"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                    移除队徽
                  </button>
                </div>
              </div>
            </div>

            <!-- 反方队伍队徽 -->
            <div class="border border-[var(--color-border)] rounded-lg p-4">
              <label
                class="block text-sm font-medium text-[var(--color-text-primary)] mb-3 flex items-center gap-2"
              >
                <span class="inline-block w-3 h-3 rounded-full bg-blue-500" />
                反方队伍队徽
              </label>
              <!-- 预览框和操作按钮上下排列 -->
              <div class="flex flex-col items-center gap-3">
                <!-- 预览框 -->
                <div
                  class="w-24 h-24 border-2 border-dashed border-[var(--color-border)] rounded-lg overflow-hidden flex items-center justify-center bg-[var(--color-bg-secondary)]"
                >
                  <img
                    v-if="config.teamLogoConfig.negativeLogoUrl"
                    :src="config.teamLogoConfig.negativeLogoUrl"
                    class="w-full h-full object-cover"
                    alt="反方队徽"
                  />
                  <div
                    v-else
                    class="flex flex-col items-center justify-center text-[var(--color-text-muted)]"
                  >
                    <UIcon name="i-lucide-image" class="w-8 h-8 mb-1" />
                    <span class="text-xs">暂无图片</span>
                  </div>
                </div>
                <!-- 操作按钮 -->
                <div class="flex gap-2">
                  <label
                    class="px-4 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2"
                  >
                    <UIcon name="i-lucide-upload" class="w-4 h-4" />
                    选择图片
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="(e: Event) => onLogoSelect(e, 'negativeLogoUrl')"
                    />
                  </label>
                  <button
                    v-if="config.teamLogoConfig.negativeLogoUrl"
                    class="px-4 py-2 text-sm text-red-500 dark:text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    @click="removeLogo('negativeLogoUrl')"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                    移除队徽
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 说明文字 -->
          <div class="pt-4 border-t border-[var(--color-border)]">
            <p class="text-xs text-[var(--color-text-muted)]">
              提示：修改后会自动保存。支持 JPG、PNG、GIF，单个文件最大 10MB。建议使用 256x256
              以上的方形图片。
            </p>
          </div>
        </UCard>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* 深色玻璃拟态样式已由全局 main.css 中的 .tab-dark-* 类提供，此处无需额外 scoped 样式 */
</style>
