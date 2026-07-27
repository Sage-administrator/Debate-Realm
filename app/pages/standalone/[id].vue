<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const { getStandaloneMatch, createStandaloneMatchMatch, deleteStandaloneMatch, submitResult } = useTournament()

const match = ref<any>(null)
const loading = ref(true)
const id = computed(() => route.params.id as string)

const showCreateMatch = ref(false)
const matchForm = reactive({ round: '', orderNum: 1, teamA: '', teamB: '' })

const showResult = ref(false)
const resultMatchId = ref('')
const resultForm = reactive({ winner: 'A', scoreA: 0, scoreB: 0 })

async function load() {
  loading.value = true
  try { match.value = await getStandaloneMatch(id.value) }
  catch (e: any) { toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' }) }
  finally { loading.value = false }
}

async function handleCreateMatch() {
  try {
    await createStandaloneMatchMatch(id.value, { ...matchForm })
    toast.add({ title: '场次创建成功', color: 'success' })
    showCreateMatch.value = false
    matchForm.round = ''; matchForm.orderNum = 1; matchForm.teamA = ''; matchForm.teamB = ''
    load()
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage || '创建失败', color: 'error' }) }
}

async function handleDelete() {
  if (!confirm('确定要删除吗？')) return
  try { await deleteStandaloneMatch(id.value); toast.add({ title: '已删除', color: 'success' }); await navigateTo('/standalone') }
  catch (e: any) { toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' }) }
}

function openResult(matchId: string) {
  resultMatchId.value = matchId; resultForm.winner = 'A'; resultForm.scoreA = 0; resultForm.scoreB = 0
  showResult.value = true
}

async function handleSubmitResult() {
  try {
    await submitResult(resultMatchId.value, resultForm.winner, Number(resultForm.scoreA), Number(resultForm.scoreB))
    toast.add({ title: '赛果提交成功', color: 'success' })
    showResult.value = false; load()
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage || '提交失败', color: 'error' }) }
}

const statusLabel = (s: string) => ({ pending: '待开始', running: '进行中', finished: '已完成' }[s] || s)

// 辅助函数：将 UTable 行转换为 any 以绕过模板类型检查
function r(row: any): any { return row }

onMounted(() => load())
</script>

<template>
  <!-- 最外层容器：页面背景 -->
  <div class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div v-if="loading" class="text-center py-12"><UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" /></div>

    <template v-else-if="match">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">{{ match.name }}</h1>
          <p v-if="match.description" class="text-sm text-white/50 mt-1">{{ match.description }}</p>
        </div>
        <UButton color="error" variant="outline" size="sm" @click="handleDelete">删除</UButton>
      </div>

      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">场次列表</h2>
        <UButton color="primary" size="sm" @click="void (showCreateMatch = true)">添加场次</UButton>
      </div>

      <div class="glass-card p-6">
        <div v-if="!match.matches?.length" class="text-center py-8 text-white/40">
          暂无场次，点击添加
        </div>
        <UTable v-else :rows="(match.matches as any)" :columns="[
          { accessorKey: 'round', header: '轮次' },
          { accessorKey: 'match', header: '对阵' },
          { accessorKey: 'score', header: '比分' },
          { accessorKey: 'status', header: '状态' },
          { accessorKey: 'actions', header: '操作' },
        ]">
          <template #match-data="{ row }">{{ r(row).teamA || '正方' }} vs {{ r(row).teamB || '反方' }}</template>
          <template #score-data="{ row }">
            <span v-if="r(row).status === 'finished'">{{ r(row).scoreA }} : {{ r(row).scoreB }}</span>
            <span v-else class="text-white/40">-</span>
          </template>
          <template #status-data="{ row }">
            <UBadge :label="statusLabel(r(row).status)" size="xs" variant="soft" />
          </template>
          <template #actions-data="{ row }">
            <div class="flex gap-1">
              <UButton v-if="r(row).status !== 'finished'" color="success" variant="ghost" size="xs" @click="openResult(r(row).id)">登记赛果</UButton>
              <UButton color="neutral" variant="ghost" size="xs" :to="`/timer/${r(row).id}`">计时器</UButton>
            </div>
          </template>
        </UTable>
      </div>
    </template>

    <!-- 创建场次弹窗 -->
    <UModal v-model:open="showCreateMatch" title="添加场次">
      <template #body>
        <div class="space-y-4">
          <UFormField label="轮次" required><UInput v-model="matchForm.round" placeholder="如：立论陈词" /></UFormField>
          <UFormField label="顺序" required><UInput v-model.number="matchForm.orderNum" type="number" placeholder="1" /></UFormField>
          <UFormField label="正方"><UInput v-model="matchForm.teamA" placeholder="正方" /></UFormField>
          <UFormField label="反方"><UInput v-model="matchForm.teamB" placeholder="反方" /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="void (showCreateMatch = false)">取消</UButton>
          <UButton color="primary" @click="handleCreateMatch">添加</UButton>
        </div>
      </template>
    </UModal>

    <!-- 赛果弹窗 -->
    <UModal v-model:open="showResult" title="登记赛果">
      <template #body>
        <div class="space-y-4">
          <UFormField label="获胜方">
            <USelect v-model="resultForm.winner" :items="[{ label: '正方胜', value: 'A' }, { label: '反方胜', value: 'B' }, { label: '平局', value: 'draw' }]" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="正方得分"><UInput v-model.number="resultForm.scoreA" type="number" /></UFormField>
            <UFormField label="反方得分"><UInput v-model.number="resultForm.scoreB" type="number" /></UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="void (showResult = false)">取消</UButton>
          <UButton color="primary" @click="handleSubmitResult">提交赛果</UButton>
        </div>
      </template>
    </UModal>
  </div>
  </div>
</template>
