<script setup lang="ts">
// 荣誉证书制作界面（赛后统计）
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const tournamentId = computed(() => route.params.id as string)

// useCertificate 接受 string，传 computed 的 .value
const cer = useCertificate(tournamentId.value)
const { config, standings, bestDebaters } = cer

const store = useAuthStore()
// 布局 provide 的赛事数据（reactive ref）
const tournamentRef = inject<any>('tournament')

// —— 工作台精确填满内容区（替代写死的 100vh - 256px 魔法数字）——
// 实测外壳相对视口顶部的位置，剩余空间全部给工作台；窗口/布局变化时重算。
// <lg 时退回自然文档流（画布固定高、编辑面板自然排布）。
const shellRef = ref<HTMLElement | null>(null)
const shellHeight = ref<string>('auto')
function fitShell() {
  const el = shellRef.value
  if (!el) return
  if (window.innerWidth < 1024) {
    shellHeight.value = 'auto'
    return
  }
  const rect = el.getBoundingClientRect()
  const avail = window.innerHeight - rect.top - 16 // 底部留 16px 呼吸
  shellHeight.value = `${Math.max(480, avail)}px`
}
onMounted(() => {
  fitShell()
  window.addEventListener('resize', fitShell)
})
onBeforeUnmount(() => window.removeEventListener('resize', fitShell))

async function loadStandings() {
  try {
    const res = await $fetch<any>(`/api/tournaments/${tournamentId.value}/standings`, {
      headers: store.token ? { Authorization: `Bearer ${store.token}` } : {},
    })
    const d = res?.data
    if (d) {
      cer.setTournamentInfo(
        d.tournament?.name || tournamentRef.value?.name || '',
        d.tournament?.organizer || '',
      )
      cer.setStandings(d.standings || [], d.bestDebaters || [])
    }
  } catch (e) {
    console.error('加载赛事数据失败:', e)
  }
}

onMounted(loadStandings)

function onExportPng() {
  cer.exportPng(2)
}
function onPrintPdf() {
  cer.printPdf()
}
function onReset() {
  if (confirm('确定重置为默认证书？当前编辑内容将丢失。')) cer.reset()
}
</script>

<template>
  <div class="cert-page">
    <!-- 一体化工作台：单面板外壳（标题栏 + 双栏） -->
    <div class="cert-shell" ref="shellRef" :style="{ height: shellHeight }">
      <!-- 顶部工具栏：标题 + 操作 -->
      <div class="cert-toolbar">
        <div class="cert-titles">
          <h1 class="cert-h1">荣誉证书</h1>
          <p class="cert-sub">赛后统计 · 电子荣誉证书制作与导出</p>
        </div>
        <div class="cert-actions">
          <UButton color="neutral" variant="outline" size="sm" @click="onReset">
            <UIcon name="i-lucide-rotate-ccw" class="mr-1" />重置
          </UButton>
          <UButton color="neutral" variant="outline" size="sm" @click="onPrintPdf">
            <UIcon name="i-lucide-printer" class="mr-1" />打印 / PDF
          </UButton>
          <UButton color="primary" size="sm" @click="onExportPng">
            <UIcon name="i-lucide-download" class="mr-1" />导出 PNG
          </UButton>
        </div>
      </div>

      <!-- 主体：画布 | 编辑面板（同一外壳内，共享边框/底色） -->
      <div class="cert-grid">
        <CertificateCanvas :config="config" />
        <CertificateEditor
          :config="config"
          :standings="standings"
          :best-debaters="bestDebaters"
          @apply-template="cer.applyTpl"
          @fill="cer.fill"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cert-page {
  display: block;
}
/* 一体化工作台外壳：替代原「大标题 + 悬浮双栏」的割裂结构 */
.cert-shell {
  display: flex;
  flex-direction: column;
  height: auto; /* 由 fitShell 实测赋值（≥lg 时填满内容区） */
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
}
.cert-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex: none;
}
.cert-titles {
  min-width: 0;
}
.cert-h1 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}
.cert-sub {
  margin: 2px 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.cert-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: none;
}
.cert-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: minmax(0, 1fr);
}
@media (min-width: 1024px) {
  .cert-grid {
    grid-template-columns: minmax(0, 1fr) 380px;
  }
}
/* <lg：工作台退为自然文档流，画布固定高、编辑面板自然排布 */
@media (max-width: 1023px) {
  .cert-shell {
    height: auto !important;
  }
  .cert-grid {
    grid-template-rows: auto;
  }
  .cert-canvas {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
}
</style>
