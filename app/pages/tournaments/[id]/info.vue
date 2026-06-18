<script setup lang="ts">
// 比赛信息页面
const route = useRoute()
const toast = useToast()
const { getTournament, updateTournament, createMatch, deleteTournament, deleteMatch, submitResult } = useTournament()

const tournament = ref<any>(null)
const loading = ref(true)
const tournamentId = computed(() => route.params.id as string)

// ── 编辑状态 ──
const editingInfo = ref(false)
const infoForm = reactive({
  name: '',
  description: '',
  format: 'knockout',
  status: 'pending',
  venue: '',
})
const savingInfo = ref(false)
const deleting = ref(false)

// ── 创建场次 ──
const showCreateMatch = ref(false)
const matchForm = reactive({ round: '', orderNum: 1, teamA: '', teamB: '' })

// ── 赛果登记 ──
const showResult = ref(false)
const resultMatchId = ref('')
const resultForm = reactive({ winner: 'A', scoreA: 0, scoreB: 0 })

// ── 数据加载 ──
async function loadTournament() {
  loading.value = true
  try {
    tournament.value = await getTournament(tournamentId.value)
    infoForm.name = tournament.value.name || ''
    infoForm.description = tournament.value.description || ''
    infoForm.format = tournament.value.format || 'knockout'
    infoForm.status = tournament.value.status || 'pending'
    infoForm.venue = tournament.value.venue || ''
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 更新赛事信息 ──
async function handleUpdateInfo() {
  if (!infoForm.name.trim()) {
    toast.add({ title: '赛事名称不能为空', color: 'error' })
    return
  }
  savingInfo.value = true
  try {
    await updateTournament(tournamentId.value, {
      name: infoForm.name.trim(),
      description: infoForm.description.trim(),
      format: infoForm.format,
      status: infoForm.status,
      venue: infoForm.venue.trim() || undefined,
    })
    toast.add({ title: '赛事信息已更新', color: 'success' })
    editingInfo.value = false
    loadTournament()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '更新失败', color: 'error' })
  } finally {
    savingInfo.value = false
  }
}

// ── 创建场次 ──
async function handleCreateMatch() {
  try {
    await createMatch(tournamentId.value, { ...matchForm })
    toast.add({ title: '场次创建成功', color: 'success' })
    showCreateMatch.value = false
    matchForm.round = ''; matchForm.orderNum = 1; matchForm.teamA = ''; matchForm.teamB = ''
    loadTournament()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '创建失败', color: 'error' })
  }
}

// ── 删除赛事 ──
async function handleDeleteTournament() {
  if (!confirm('确定要删除此赛事吗？此操作不可撤销。')) return
  deleting.value = true
  try {
    await deleteTournament(tournamentId.value)
    toast.add({ title: '赛事已删除', color: 'success' })
    tournament.value = null
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  } finally {
    deleting.value = false
  }
}

// ── 赛果登记 ──
function openResult(matchId: string) {
  resultMatchId.value = matchId
  resultForm.winner = 'A'; resultForm.scoreA = 0; resultForm.scoreB = 0
  showResult.value = true
}

async function handleSubmitResult() {
  try {
    await submitResult(resultMatchId.value, resultForm.winner, Number(resultForm.scoreA), Number(resultForm.scoreB))
    toast.add({ title: '赛果提交成功', color: 'success' })
    showResult.value = false
    loadTournament()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '提交失败', color: 'error' })
  }
}

// ── 工具函数 ──
const statusLabel = (s: string) => ({ pending: '待开始', running: '进行中', finished: '已完成' }[s] || s)
const statusColor = (s: string): any => ({ pending: 'neutral', running: 'primary', finished: 'success' }[s] || 'neutral')
const formatLabel = (f: string) => f === 'knockout' ? '淘汰赛' : '循环赛'

onMounted(() => loadTournament())
</script>

<template>
  <div class="min-h-screen" style="background-color: #F5F7FA;">
    <div class="max-w-[1200px] mx-auto px-6">

      <!-- ═══ 加载状态 ═══ -->
      <div v-if="loading" class="flex justify-center py-24">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin text-gray-400" />
      </div>

      <template v-else-if="tournament">
        <!-- ═══ 头部 ═══ -->
        <header class="flex items-end justify-between pt-10 pb-5">
          <div>
            <p class="text-xs text-gray-400 mb-1">
              赛事管理 / ID: {{ tournament.id }}
            </p>
            <h1 class="text-[1.75rem] font-bold text-gray-900 leading-tight">
              {{ tournament.name }}
            </h1>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="h-9 px-4 text-sm border border-gray-200 rounded-md bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              离线版下载
            </button>
            <button
              class="h-9 px-4 text-sm rounded-md text-white transition-colors"
              style="background-color: #1F2937;"
              @click="navigateTo(`/tournaments/${tournamentId}/timer`)"
            >
              打开在线版计时器
            </button>
          </div>
        </header>

        <!-- ═══ 表格样式双层Tab导航 ═══ -->
        <div class="tab-table-row1">
          <span class="tab-primary tab-primary--active">基础配置</span>
          <span class="tab-primary">视听设计</span>
          <span class="tab-primary">进阶功能</span>
        </div>
        <div class="tab-table-row2">
          <NuxtLink :to="`/tournaments/${tournamentId}`" class="tab-secondary">概览</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="tab-secondary tab-secondary--active">比赛信息</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="tab-secondary">计时器环节</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-secondary">背景</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-secondary">界面</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-secondary">提示音</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/teams`" class="tab-secondary">队徽</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-secondary">赛程</NuxtLink>
          <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-secondary">离线版</NuxtLink>
        </div>

        <!-- ═══ 比赛信息内容 ═══ -->
        <main class="py-6 space-y-6">
          <!-- 赛事信息编辑 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
                <UIcon name="i-lucide-file-text" class="w-4 h-4 text-gray-400" />
                比赛信息
              </h2>
              <button
                v-if="!editingInfo"
                class="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                @click="editingInfo = true"
              >
                <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />编辑
              </button>
            </div>

            <!-- 查看模式 -->
            <div v-if="!editingInfo" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs text-gray-400 mb-1">赛事名称</label>
                  <p class="text-sm text-gray-800">{{ tournament.name }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">赛制</label>
                  <p class="text-sm text-gray-800">{{ formatLabel(tournament.format) }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">状态</label>
                  <UBadge :label="statusLabel(tournament.status)" :color="statusColor(tournament.status)" size="xs" variant="soft" />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">举办地点</label>
                  <p class="text-sm text-gray-800">{{ tournament.venue || '未设置' }}</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">计划时间</label>
                  <p class="text-sm text-gray-800">
                    {{ tournament.scheduledAt ? new Date(tournament.scheduledAt).toLocaleDateString('zh-CN') : '未设置' }}
                  </p>
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">创建时间</label>
                  <p class="text-sm text-gray-800">{{ new Date(tournament.createdAt).toLocaleDateString('zh-CN') }}</p>
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">描述</label>
                <p class="text-sm text-gray-800">{{ tournament.description || '无' }}</p>
              </div>
            </div>

            <!-- 编辑模式 -->
            <div v-else class="space-y-4">
              <div>
                <label class="block text-sm text-gray-700 mb-1.5">赛事名称 <span class="text-red-500">*</span></label>
                <input
                  v-model="infoForm.name" type="text"
                  class="w-full h-10 px-3 text-sm border border-gray-300 rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
                />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-700 mb-1.5">赛制</label>
                  <select
                    v-model="infoForm.format"
                    class="w-full h-10 px-3 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
                  >
                    <option value="knockout">淘汰赛</option>
                    <option value="round_robin">循环赛</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-gray-700 mb-1.5">状态</label>
                  <select
                    v-model="infoForm.status"
                    class="w-full h-10 px-3 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
                  >
                    <option value="pending">待开始</option>
                    <option value="running">进行中</option>
                    <option value="finished">已完成</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-700 mb-1.5">举办地点</label>
                <input
                  v-model="infoForm.venue" type="text" placeholder="如：301教室"
                  class="w-full h-10 px-3 text-sm border border-gray-300 rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-700 mb-1.5">描述</label>
                <textarea
                  v-model="infoForm.description" rows="3" placeholder="赛事描述、扩展信息等"
                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors resize-none"
                />
              </div>
              <div class="flex gap-3 pt-2">
                <UButton color="primary" size="sm" :loading="savingInfo" @click="handleUpdateInfo">
                  <UIcon name="i-lucide-check" class="w-3.5 h-3.5 mr-1" />保存修改
                </UButton>
                <UButton color="neutral" variant="outline" size="sm" @click="editingInfo = false; loadTournament()">
                  取消
                </UButton>
              </div>
            </div>
          </div>

          <!-- 参赛队伍 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-users" class="w-4 h-4 text-gray-400" />
              参赛队伍
              <span class="text-xs font-normal text-gray-400">(创建时设置，暂不支持在线修改)</span>
            </h3>
            <div v-if="!tournament.teams?.length" class="text-sm text-gray-400 py-2">暂无队伍</div>
            <div v-else class="flex flex-wrap gap-2">
              <span v-for="t in tournament.teams" :key="t.id" class="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-full">
                {{ t.name }}
              </span>
            </div>
          </div>

          <!-- 评委 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UIcon name="i-lucide-gavel" class="w-4 h-4 text-gray-400" />
              评委
              <span class="text-xs font-normal text-gray-400">(创建时设置，暂不支持在线修改)</span>
            </h3>
            <div v-if="!tournament.judges?.length" class="text-sm text-gray-400 py-2">暂无评委</div>
            <div v-else class="flex flex-wrap gap-2">
              <span v-for="j in tournament.judges" :key="j.id" class="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded-full">
                {{ j.name }}
              </span>
            </div>
          </div>

          <!-- 场次列表 -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <UIcon name="i-lucide-list" class="w-4 h-4 text-gray-400" />
                场次管理
                <span class="text-xs font-normal text-gray-400">({{ tournament.matches?.length || 0 }} 场)</span>
              </h3>
              <button
                class="flex items-center gap-1 px-3 py-1.5 text-sm border border-green-300 rounded text-green-600 hover:bg-green-50 transition-colors"
                @click="showCreateMatch = true"
              >
                <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />添加场次
              </button>
            </div>
            <div v-if="!tournament.matches?.length" class="text-sm text-gray-400 py-8 text-center">
              暂未创建场次
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="m in tournament.matches"
                :key="m.id"
                class="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xs text-gray-500">{{ m.round }}</span>
                  <span class="text-sm text-gray-800">{{ m.teamA }} vs {{ m.teamB }}</span>
                  <UBadge
                    v-if="m.status !== 'pending'"
                    :label="m.status === 'running' ? '进行中' : '已完成'"
                    :color="m.status === 'running' ? 'primary' : 'success'"
                    size="xs" variant="soft"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="m.status !== 'finished'"
                    class="text-xs text-green-600 hover:text-green-700"
                    @click="openResult(m.id)"
                  >登记赛果</button>
                  <button
                    class="text-xs text-red-400 hover:text-red-500"
                    @click="async () => { await deleteMatch(m.id); loadTournament() }"
                  >删除</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 危险操作区 -->
          <div class="bg-white rounded-lg shadow-sm p-6 border border-red-100">
            <h3 class="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
              <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />危险操作
            </h3>
            <p class="text-xs text-gray-500 mb-3">删除赛事将同时删除所有关联的场次、队伍和评委数据，不可恢复。</p>
            <UButton color="error" size="sm" :loading="deleting" @click="handleDeleteTournament">
              {{ deleting ? '删除中...' : '删除此赛事' }}
            </UButton>
          </div>
        </main>
      </template>
    </div>
  </div>

  <!-- 创建场次弹窗 -->
  <UModal v-model:open="showCreateMatch" title="添加场次">
    <template #body>
      <div class="space-y-4">
        <UFormField label="轮次" required>
          <UInput v-model="matchForm.round" placeholder="如：第一轮、半决赛" />
        </UFormField>
        <UFormField label="顺序">
          <UInput v-model.number="matchForm.orderNum" type="number" placeholder="1" />
        </UFormField>
        <UFormField label="正方">
          <UInput v-model="matchForm.teamA" placeholder="正方队伍" />
        </UFormField>
        <UFormField label="反方">
          <UInput v-model="matchForm.teamB" placeholder="反方队伍" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="showCreateMatch = false">取消</UButton>
        <UButton color="primary" @click="handleCreateMatch">添加</UButton>
      </div>
    </template>
  </UModal>

  <!-- 赛果登记弹窗 -->
  <UModal v-model:open="showResult" title="登记赛果">
    <template #body>
      <div class="space-y-4">
        <USelect v-model="resultForm.winner" label="获胜方" :items="[
          { label: '正方胜', value: 'A' },
          { label: '反方胜', value: 'B' },
          { label: '平局', value: 'draw' },
        ]" />
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="正方得分">
            <UInput v-model.number="resultForm.scoreA" type="number" />
          </UFormField>
          <UFormField label="反方得分">
            <UInput v-model.number="resultForm.scoreB" type="number" />
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="showResult = false">取消</UButton>
        <UButton color="primary" @click="handleSubmitResult">提交赛果</UButton>
      </div>
    </template>
  </UModal>
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

.tab-primary:last-child {
  border-right: none;
}

.tab-primary--active {
  color: #1F2937;
  background: #FFFFFF;
  border-bottom: 2px solid #3B82F6;
}

.tab-table-row2 {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  border: 1px solid #D1D5DB;
  border-top: none;
  background: #FFFFFF;
}

.tab-secondary {
  padding: 0.5rem 0.75rem;       /* 与其他页面一致：8px 12px */
  font-size: 0.8125rem;          /* 与其他页面一致：13px */
  font-weight: 500;
  text-align: center;
  color: #6B7280;
  cursor: pointer;
  border-right: 1px solid #E5E7EB;
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.tab-secondary:last-child {
  border-right: none;
}

.tab-secondary:hover {
  color: #374151;
  background: #F3F4F6;
}

.tab-secondary--active {
  color: #3B82F6;
  background: #EFF6FF;
  font-weight: 600;
}
</style>
