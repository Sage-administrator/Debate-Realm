<!--
  details.vue - 界面元素配置页面
  功能：
  - 左侧 TimerPreview 实时预览界面效果
  - 右侧配置界面元素（标题、横幅显示、颜色、队伍标签等）
  - 配置修改实时同步到数据库（timer-config API）
-->
<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'

definePageMeta({ layout: 'standalone' })

const route = useRoute()
const toast = useToast()
const { config, loadConfig, saveConfig: apiSave, loading } = useTimerConfig()

const tournament = inject<Ref<any>>('standaloneMatch')!
const matchId = computed(() => route.params.id as string)

const previewStageIndex = ref(0)

onMounted(() => loadConfig(matchId.value, 'standalone'))

let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => [
    config.value.uiConfig,
    config.value.title,
    config.value.positiveTopic,
    config.value.negativeTopic,
    config.value.teamPositiveName,
    config.value.teamNegativeName,
  ],
  () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      if (!loading.value) apiSave(matchId.value, 'standalone')
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
          v-model:stage-index="previewStageIndex"
          :full-config="config"
          :tournament-id="matchId"
          type="standalone"
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
            <label
              class="block text-sm font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5"
            >
              <UIcon name="i-lucide-type" class="w-4 h-4 text-[var(--color-text-muted)]" /> 比赛标题
            </label>
            <input
              v-model="config.title"
              type="text"
              class="input-glass w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="例如：2025年度校际辩论赛总决赛"
            />
          </div>

          <div class="mb-6 space-y-4">
            <label
              class="block text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5"
            >
              <UIcon name="i-lucide-eye" class="w-4 h-4 text-[var(--color-text-muted)]" /> 显示选项
            </label>
            <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 space-y-3">
              <div class="flex items-center justify-between">
                <label class="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    v-model="config.uiConfig.showTitle"
                    type="checkbox"
                    class="w-4 h-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                  />
                  <span class="text-sm text-[var(--color-text-primary)]">显示比赛标题</span>
                </label>
                <div class="flex items-center gap-2 ml-4">
                  <ColorPicker v-model="config.uiConfig.titleColor" />
                  <input
                    v-model="config.uiConfig.titleColor"
                    type="text"
                    class="input-glass h-11 w-28 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="#0369a1"
                  />
                </div>
              </div>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  v-model="config.uiConfig.showBanner"
                  type="checkbox"
                  class="w-4 h-4 rounded border-[var(--color-border)] text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <span class="text-sm text-[var(--color-text-primary)]">显示横幅/辩题</span>
              </label>
            </div>
          </div>

          <div class="mb-6 grid grid-cols-[auto_1fr_1fr] gap-4">
            <div>
              <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5"
                >队伍名称颜色</label
              >
              <div class="flex items-stretch gap-2">
                <ColorPicker v-model="config.uiConfig.teamNameColor" />
                <input
                  v-model="config.uiConfig.teamNameColor"
                  type="text"
                  class="input-glass w-28 h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5"
                >正方标签</label
              >
              <input
                v-model="config.uiConfig.positiveLabel"
                type="text"
                class="input-glass w-full h-11 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="正方"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5"
                >反方标签</label
              >
              <input
                v-model="config.uiConfig.negativeLabel"
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

<style scoped></style>
