<script setup lang="ts">
// 离线版导出页面
// 功能：将当前赛事的完整配置（计时器逻辑、视觉样式、背景图片、音效资源、赛事数据）
// 打包为可在无网络环境下独立运行的离线版本
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)

// 触发离线版导出（目前仅提示，后续可扩展为实际打包下载逻辑）
function exportOffline() {
  toast.add({ title: '正在生成离线版...', color: 'primary' })
}
</script>

<template>
  <template v-if="tournament">
  <div class="space-y-6">
    <UCard>
      <template #header>
        <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <UIcon name="i-lucide-download" class="w-4 h-4 text-[var(--color-text-muted)]" /> 离线版导出
        </h2>
      </template>

      <div class="ui-panel space-y-4">
        <p class="text-sm text-[var(--color-text-primary)]">
          导出当前赛事的完整离线版本，包含所有配置、样式和资源文件，可在无网络环境下独立运行。
        </p>

        <div class="flex items-center gap-2 pt-2">
          <button
            @click="exportOffline"
            class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <UIcon name="i-lucide-download" class="w-4 h-4" />
            导出离线版
          </button>
        </div>

        <div class="mt-4 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-muted)]">
          导出的离线版将包含：计时器核心逻辑、所有已配置的视觉样式、背景图片、音效资源和赛事数据。
        </div>
      </div>
    </UCard>
  </div>
  </template>
</template>

<style scoped>
</style>
