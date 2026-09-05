<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
definePageMeta({ layout: 'tournament' })

// 比赛信息页面
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { getTournament, updateTournament, createMatch, deleteTournament } = useTournament()
const { delete: deleteMatch, submitResult } = useMatchDetail()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)

// 该赛事是否已设计 match_score 评分问卷（决定「登记赛果」跳转目标）
// 有问卷 → 跳评分问卷填写处（评分决定胜负）；无问卷 → 兜底弹原弹窗登记比分
const hasScoreQuestionnaire = ref(false)
onMounted(async () => {
  try {
    const res = await fetch(
      `/api/tournaments/${tournamentId.value}/questionnaires?sourceType=match_score`,
      {
        headers: { Authorization: `Bearer ${authStore.token}` },
      },
    )
    const list = await res.json()
    hasScoreQuestionnaire.value = Array.isArray(list) && list.length > 0
  } catch {
    hasScoreQuestionnaire.value = false
  }
})

// ── 编辑状态 ──
const editingInfo = ref(false)
const infoForm = reactive({
  name: '',
  description: '',
  format: '',
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

// ── 初始化表单数据 ──
watchEffect(() => {
  if (tournament.value) {
    infoForm.name = tournament.value.name || ''
    infoForm.description = tournament.value.description || ''
    infoForm.format = tournament.value.format || ''
    infoForm.status = tournament.value.status || 'pending'
    infoForm.venue = tournament.value.venue || ''
  }
})

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
      format: infoForm.format || undefined,
      status: infoForm.status,
      venue: infoForm.venue.trim() || undefined,
    })
    toast.add({ title: '赛事信息已更新', color: 'success' })
    editingInfo.value = false
    // 刷新 tournament 数据
    const updated = await getTournament(tournamentId.value)
    tournament.value = updated
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
    matchForm.round = ''
    matchForm.orderNum = 1
    matchForm.teamA = ''
    matchForm.teamB = ''
    // 刷新 tournament 数据
    const updated = await getTournament(tournamentId.value)
    tournament.value = updated
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
  resultForm.winner = 'A'
  resultForm.scoreA = 0
  resultForm.scoreB = 0
  showResult.value = true
}

// 登记赛果入口：有评分问卷则跳转到评分问卷填写处（评分决定胜负），
// 未设计问卷时回退到原弹窗登记比分（兜底，避免无法登记赛果）
function handleRegisterResult(match: any) {
  if (hasScoreQuestionnaire.value) {
    navigateTo(`/tournaments/${tournamentId.value}/score-survey/${match.id}`)
  } else {
    openResult(match.id)
  }
}

async function handleSubmitResult() {
  try {
    await submitResult(
      resultMatchId.value,
      resultForm.winner,
      Number(resultForm.scoreA),
      Number(resultForm.scoreB),
    )
    toast.add({ title: '赛果提交成功', color: 'success' })
    showResult.value = false
    // 刷新 tournament 数据
    const updated = await getTournament(tournamentId.value)
    tournament.value = updated
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '提交失败', color: 'error' })
  }
}

// ── 工具函数 ──
const statusLabel = (s: string) =>
  ({ pending: '待开始', running: '进行中', finished: '已完成' })[s] || s
const statusColor = (s: string): any =>
  ({ pending: 'neutral', running: 'primary', finished: 'success' })[s] || 'neutral'
// 与 prisma/schema.prisma 中 Tournament.format 枚举保持一致
const formatOptions = [
  { label: '未设置', value: '' },
  { label: '单败淘汰赛', value: 'single_elimination' },
  { label: '双败淘汰赛', value: 'double_elimination' },
  { label: '循环赛', value: 'round_robin' },
  { label: '佩寄制', value: 'page_playoff' },
  { label: '瑞士制', value: 'swiss' },
  { label: '小组+淘汰赛', value: 'group_knockout' },
  { label: '手动编排', value: 'manual' },
]
const formatLabel = (f?: string | null) => {
  if (!f) return '未设置'
  return formatOptions.find((o) => o.value === f)?.label || f
}
</script>

<template>
  <template v-if="tournament">
    <!-- ═══ 比赛信息内容 ═══ -->
    <div class="py-6 space-y-6">
      <!-- 赛事信息编辑 -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-file-text" class="w-4 h-4 text-[var(--color-text-muted)]" />
              比赛信息
            </h2>
            <button
              v-if="!editingInfo"
              class="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              @click="
                () => {
                  editingInfo = true
                }
              "
            >
              <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />编辑
            </button>
          </div>
        </template>

        <!-- 查看模式 -->
        <div v-if="!editingInfo" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-[var(--color-text-muted)] mb-1">赛事名称</label>
              <p class="text-sm text-[var(--color-text-primary)]">{{ tournament.name }}</p>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-muted)] mb-1">赛制</label>
              <p class="text-sm text-[var(--color-text-primary)]">
                {{ formatLabel(tournament.format) }}
              </p>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-muted)] mb-1">状态</label>
              <UBadge
                :label="statusLabel(tournament.status)"
                :color="statusColor(tournament.status)"
                size="xs"
                variant="soft"
              />
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-muted)] mb-1">举办地点</label>
              <p class="text-sm text-[var(--color-text-primary)]">
                {{ tournament.venue || '未设置' }}
              </p>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-muted)] mb-1">计划时间</label>
              <p class="text-sm text-[var(--color-text-primary)]">
                {{
                  tournament.scheduledAt
                    ? new Date(tournament.scheduledAt).toLocaleDateString('zh-CN')
                    : '未设置'
                }}
              </p>
            </div>
            <div>
              <label class="block text-xs text-[var(--color-text-muted)] mb-1">创建时间</label>
              <p class="text-sm text-[var(--color-text-primary)]">
                {{ new Date(tournament.createdAt).toLocaleDateString('zh-CN') }}
              </p>
            </div>
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">描述</label>
            <p class="text-sm text-[var(--color-text-primary)]">
              {{ tournament.description || '无' }}
            </p>
          </div>
        </div>

        <!-- 编辑模式 -->
        <div v-else class="space-y-4">
          <div>
            <label class="block text-sm text-[var(--color-text-primary)] mb-1.5"
              >赛事名称 <span class="text-red-500">*</span></label
            >
            <input
              v-model="infoForm.name"
              type="text"
              class="input-glass w-full h-10 px-3 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">赛制</label>
              <p class="text-sm text-[var(--color-text-primary)] py-2">
                {{ formatLabel(tournament.format) }}
              </p>
            </div>
            <div>
              <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">状态</label>
              <USelect
                v-model="infoForm.status"
                :items="[
                  { label: '待开始', value: 'pending' },
                  { label: '进行中', value: 'running' },
                  { label: '已完成', value: 'finished' },
                ]"
                class="w-full"
                :ui="{ base: 'input-glass' }"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">举办地点</label>
            <input
              v-model="infoForm.venue"
              type="text"
              placeholder="如：301教室"
              class="input-glass w-full h-10 px-3 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
            />
          </div>
          <div>
            <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">描述</label>
            <textarea
              v-model="infoForm.description"
              rows="3"
              placeholder="赛事描述、扩展信息等"
              class="input-glass w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors resize-none"
            />
          </div>
          <div class="flex gap-3 pt-2">
            <UButton color="primary" size="sm" :loading="savingInfo" @click="handleUpdateInfo">
              <UIcon name="i-lucide-check" class="w-3.5 h-3.5 mr-1" />保存修改
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              size="sm"
              @click="
                () => {
                  editingInfo = false
                }
              "
            >
              取消
            </UButton>
          </div>
        </div>
      </UCard>

      <!-- 参赛队伍 -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-users" class="w-4 h-4 text-[var(--color-text-muted)]" />
              参赛队伍
              <span class="text-xs font-normal text-[var(--color-text-muted)]"
                >(赛程页设置，支持在线添加/删除)</span
              >
            </h3>
            <NuxtLink
              :to="`/tournaments/${tournamentId}/schedule`"
              class="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
            >
              前往设置
              <UIcon name="i-lucide-arrow-right" class="w-3 h-3" />
            </NuxtLink>
          </div>
        </template>
        <!-- 兼容字符串数组和对象数组 -->
        <div
          v-if="!(Array.isArray(tournament.teams) && tournament.teams.length > 0)"
          class="text-sm text-[var(--color-text-muted)] py-2"
        >
          暂无队伍
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <span
            v-for="(t, idx) in tournament.teams"
            :key="typeof t === 'string' ? t : (t.id ?? t.name ?? idx)"
            class="px-3 py-1 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded-full"
          >
            {{ typeof t === 'string' ? t : t.name }}
          </span>
        </div>
      </UCard>

      <!-- 评委 -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-gavel" class="w-4 h-4 text-[var(--color-text-muted)]" />
              评委
              <span class="text-xs font-normal text-[var(--color-text-muted)]"
                >(赛程页设置，支持在线添加/删除)</span
              >
            </h3>
            <NuxtLink
              :to="`/tournaments/${tournamentId}/schedule`"
              class="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
            >
              前往设置
              <UIcon name="i-lucide-arrow-right" class="w-3 h-3" />
            </NuxtLink>
          </div>
        </template>
        <div
          v-if="!(Array.isArray(tournament.judges) && tournament.judges.length > 0)"
          class="text-sm text-[var(--color-text-muted)] py-2"
        >
          暂无评委
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <span
            v-for="(j, idx) in tournament.judges"
            :key="typeof j === 'string' ? j : (j.id ?? j.name ?? idx)"
            class="px-3 py-1 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded-full"
          >
            {{ typeof j === 'string' ? j : j.name }}
          </span>
        </div>
      </UCard>

      <!-- 场次列表 -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h3
              class="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-list" class="w-4 h-4 text-[var(--color-text-muted)]" />
              场次管理
              <span class="text-xs font-normal text-[var(--color-text-muted)]"
                >({{ tournament.matches?.length || 0 }} 场)</span
              >
            </h3>
            <button
              class="flex items-center gap-1 px-3 py-1.5 text-sm border border-green-500/30 rounded text-green-600 dark:text-green-400 hover:bg-green-500/10 transition-colors"
              @click="
                () => {
                  showCreateMatch = true
                }
              "
            >
              <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />添加场次
            </button>
          </div>
        </template>
        <div
          v-if="!tournament.matches?.length"
          class="text-sm text-[var(--color-text-muted)] py-8 text-center"
        >
          暂未创建场次
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="m in tournament.matches"
            :key="m.id"
            class="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded"
          >
            <div class="flex items-center gap-3">
              <span class="text-xs text-[var(--color-text-muted)]">{{ m.round }}</span>
              <span class="text-sm text-[var(--color-text-primary)]"
                >{{ m.teamA }} vs {{ m.teamB }}</span
              >
              <UBadge
                v-if="m.status !== 'pending'"
                :label="m.status === 'running' ? '进行中' : '已完成'"
                :color="m.status === 'running' ? 'primary' : 'success'"
                size="xs"
                variant="soft"
              />
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="m.status !== 'finished'"
                class="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                @click="handleRegisterResult(m)"
              >
                登记赛果
              </button>
              <button
                class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                @click="
                  async () => {
                    await deleteMatch(m.id)
                    const updated = await getTournament(tournamentId)
                    tournament.value = updated
                  }
                "
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </UCard>

      <!-- 危险操作区 -->
      <UCard class="mb-6 border border-red-500/30">
        <template #header>
          <h3 class="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />危险操作
          </h3>
        </template>
        <p class="text-xs text-[var(--color-text-muted)] mb-3">
          删除赛事将同时删除所有关联的场次、队伍和评委数据，不可恢复。
        </p>
        <UButton color="error" size="sm" :loading="deleting" @click="handleDeleteTournament">
          {{ deleting ? '删除中...' : '删除此赛事' }}
        </UButton>
      </UCard>
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
          <UButton
            color="neutral"
            variant="outline"
            @click="
              () => {
                showCreateMatch = false
              }
            "
            >取消</UButton
          >
          <UButton color="primary" @click="handleCreateMatch">添加</UButton>
        </div>
      </template>
    </UModal>

    <!-- 赛果登记弹窗 -->
    <UModal v-model:open="showResult" title="登记赛果">
      <template #body>
        <div class="space-y-4">
          <USelect
            v-model="resultForm.winner"
            label="获胜方"
            :items="[
              { label: '正方胜', value: 'A' },
              { label: '反方胜', value: 'B' },
              { label: '平局', value: 'draw' },
            ]"
          />
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
          <UButton
            color="neutral"
            variant="outline"
            @click="
              () => {
                showResult = false
              }
            "
            >取消</UButton
          >
          <UButton color="primary" @click="handleSubmitResult">提交赛果</UButton>
        </div>
      </template>
    </UModal>
  </template>
</template>

<style scoped>
/* 深色玻璃拟态样式已由全局 main.css 中的 .tab-dark-* 类提供，此处无需额外 scoped 样式 */
</style>
