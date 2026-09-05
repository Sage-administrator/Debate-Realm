<!--
  audio.vue - 提示音设置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置提示音开关和自定义音频文件
  - 配置修改实时同步到数据库（timer-config API）
  - 支持音频文件上传到 public/uploads/audio 文件夹
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
  await apiSave(tournamentId.value, 'tournament')
}

// ═══════════ 音频文件上传处理 ═══════════
async function onAudioSelect(
  event: Event,
  field: 'warningSound' | 'finalWarningSound' | 'timeUpSound',
) {
  const target = event.target as HTMLInputElement
  if (!target?.files?.[0]) return

  const file = target.files[0]
  uploading.value = true

  try {
    // 使用 FormData 上传文件到 /api/upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'audio')

    const uploadRes = await $fetch<any>('/api/upload', {
      method: 'POST',
      headers: {
        // multipart/form-data 由浏览器自动设置边界；带上鉴权 token（服务端校验 tokenVersion）
        ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
      },
      body: formData,
    })

    if (uploadRes?.success && uploadRes?.data?.path) {
      // 保存上传文件的相对路径到配置中
      config.value.audioConfig[field] = uploadRes.data.path
      toast.add({
        title: `已上传: ${uploadRes.data.originalName}`,
        color: 'success',
      })
    } else {
      toast.add({ title: '上传失败，请重试', color: 'error' })
    }
  } catch (e: any) {
    console.error('音频上传错误:', e)
    toast.add({ title: e?.data?.statusMessage || '上传失败', color: 'error' })
  } finally {
    uploading.value = false
    // 重置 input 以允许再次选择相同文件
    target.value = ''
  }
}

// ═══════════ 生命周期 ═══════════
onMounted(async () => {
  await apiLoad(tournamentId.value, 'tournament')
})

// 配置变化时自动保存（防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => config.value.audioConfig,
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

      <!-- 右侧：提示音配置（右8列，约2/3宽度） -->
      <div class="col-span-8 space-y-4">
        <UCard>
          <template #header>
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-volume-2" class="w-4 h-4 text-[var(--color-text-muted)]" />
              提示音设置
            </h2>
          </template>

          <!-- 启用提示音开关 -->
          <div
            class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded mb-4"
          >
            <div>
              <label class="text-sm text-[var(--color-text-primary)] font-medium">启用提示音</label>
              <p class="text-xs text-[var(--color-text-muted)]">控制是否在计时器中播放提示音</p>
            </div>
            <label class="toggle-switch">
              <input v-model="config.audioConfig.enabled" type="checkbox" />
              <span class="toggle-slider" />
            </label>
          </div>

          <!-- 声音方案选择 -->
          <div
            class="py-3 px-3 bg-[var(--color-bg-secondary)] rounded mb-4 border border-[var(--color-border)]"
          >
            <label class="text-sm text-[var(--color-text-primary)] font-medium">声音方案</label>
            <p class="text-xs text-[var(--color-text-muted)] mt-0.5 mb-2">
              正式比赛提示音使用钉钉响铃：剩余 30 秒与结束时各响一次，剩余 5 秒不响。
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded text-sm border transition-colors"
                :class="
                  config.audioConfig.scheme === 'formal'
                    ? 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
                    : 'border-[var(--color-accent-primary)] bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)] font-medium'
                "
                @click="config.audioConfig.scheme = 'default'"
              >
                默认提示音（30 / 5 / 0 秒）
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded text-sm border transition-colors"
                :class="
                  config.audioConfig.scheme === 'formal'
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)] font-medium'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]'
                "
                @click="config.audioConfig.scheme = 'formal'"
              >
                正式比赛提示音（钉钉响铃）
              </button>
            </div>
          </div>

          <!-- 提示音上传区 - 水平并行 -->
          <div class="flex gap-4 mb-4">
            <!-- 30秒提示音 -->
            <div class="space-y-2 flex-1">
              <label class="block text-sm text-[var(--color-text-primary)] font-medium"
                >30秒提示音</label
              >
              <div class="flex items-center gap-2">
                <label
                  class="px-3 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <UIcon name="i-lucide-upload" class="w-4 h-4" />
                  选择文件
                  <input
                    type="file"
                    accept="audio/*"
                    class="hidden"
                    @change="(e: Event) => onAudioSelect(e, 'warningSound')"
                  />
                </label>
                <span class="text-xs text-[var(--color-text-muted)] truncate max-w-[60%]">{{
                  config.audioConfig.warningSound || '未选择文件'
                }}</span>
              </div>
              <div v-if="config.audioConfig.warningSound" class="flex items-center gap-2">
                <audio
                  :src="config.audioConfig.warningSound"
                  controls
                  class="h-8 w-full max-w-xs"
                />
              </div>
            </div>

            <!-- 5秒提示音 -->
            <div
              class="space-y-2 flex-1"
              :class="config.audioConfig.scheme === 'formal' ? 'opacity-50' : ''"
            >
              <label class="block text-sm text-[var(--color-text-primary)] font-medium">
                5秒提示音
                <span
                  v-if="config.audioConfig.scheme === 'formal'"
                  class="text-xs text-[var(--color-warning)]"
                  >（正式方案下不播放）</span
                >
              </label>
              <div class="flex items-center gap-2">
                <label
                  class="px-3 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <UIcon name="i-lucide-upload" class="w-4 h-4" />
                  选择文件
                  <input
                    type="file"
                    accept="audio/*"
                    class="hidden"
                    @change="(e: Event) => onAudioSelect(e, 'finalWarningSound')"
                  />
                </label>
                <span class="text-xs text-[var(--color-text-muted)] truncate max-w-[60%]">{{
                  config.audioConfig.finalWarningSound || '未选择文件'
                }}</span>
              </div>
              <div v-if="config.audioConfig.finalWarningSound" class="flex items-center gap-2">
                <audio
                  :src="config.audioConfig.finalWarningSound"
                  controls
                  class="h-8 w-full max-w-xs"
                />
              </div>
            </div>

            <!-- 时间到提示音 -->
            <div class="space-y-2 flex-1">
              <label class="block text-sm text-[var(--color-text-primary)] font-medium"
                >时间到提示音</label
              >
              <div class="flex items-center gap-2">
                <label
                  class="px-3 py-2 border border-[var(--color-border)] rounded text-sm cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <UIcon name="i-lucide-upload" class="w-4 h-4" />
                  选择文件
                  <input
                    type="file"
                    accept="audio/*"
                    class="hidden"
                    @change="(e: Event) => onAudioSelect(e, 'timeUpSound')"
                  />
                </label>
                <span class="text-xs text-[var(--color-text-muted)] truncate max-w-[60%]">{{
                  config.audioConfig.timeUpSound || '未选择文件'
                }}</span>
              </div>
              <div v-if="config.audioConfig.timeUpSound" class="flex items-center gap-2">
                <audio :src="config.audioConfig.timeUpSound" controls class="h-8 w-full max-w-xs" />
              </div>
            </div>
          </div>

          <!-- 说明文字 -->
          <div class="pt-4 border-t border-[var(--color-border)]">
            <p
              v-if="config.audioConfig.scheme === 'formal'"
              class="text-xs text-[var(--color-warning)] mb-1"
            >
              注：当前为「正式比赛提示音」方案，5 秒提示音不会播放（仅 30 秒与结束时响铃）。
            </p>
            <p class="text-xs text-[var(--color-text-muted)]">
              提示：修改后会自动保存。支持格式 MP3、WAV、OGG，单个文件最大 10MB。
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
