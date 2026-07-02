<script setup lang="ts">
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)

function exportOffline() {
  toast.add({ title: '正在生成离线版...', color: 'primary' })
}
</script>

<template>
  <template v-if="tournament">
  <div class="space-y-6">
    <UCard>
      <template #header>
        <h2 class="text-base font-semibold text-white flex items-center gap-2">
          <UIcon name="i-lucide-download" class="w-4 h-4 text-white/40" /> 离线版导出
        </h2>
      </template>

      <div class="ui-panel space-y-4">
        <p class="text-sm text-white/80">
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

        <div class="mt-4 p-3 bg-white/5 border border-white/10 rounded text-xs text-white/50">
          导出的离线版将包含：计时器核心逻辑、所有已配置的视觉样式、背景图片、音效资源和赛事数据。
        </div>
      </div>
    </UCard>
  </div>
  </template>
</template>

<style scoped>
</style>
