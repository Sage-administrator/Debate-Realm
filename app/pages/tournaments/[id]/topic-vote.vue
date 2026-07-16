<script setup lang="ts">
// 辩题投票公开投票页（无需登录即可访问，登录用户自动识别身份）
// 通过 query 参数 vote 指定具体投票 ID：/tournaments/[id]/topic-vote?vote=xxx
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { getTopicVote, castVote, getMyVoteRecord } = useTopicVote()

const tournamentId = computed(() => route.params.id as string)
const voteId = computed(() => (route.query.vote as string) || '')

// 初始为 true：SSR 阶段 vote 为 null，若 loading=false 会立即渲染"投票信息加载失败"
// 客户端 onMounted 加载完成后才会显示真实内容，避免首屏闪烁与 SEO 误导
const loading = ref(true)
// ponytail: 显式声明 topics 为 string[]，让 v-for 索引 idx 推断为 number
// 其余字段用 [key: string]: any 兼容服务端返回的动态结构
interface VoteData {
  topics: string[]
  [key: string]: any
}
const vote = ref<VoteData | null>(null)
const myRecord = ref<any>(null)
const submitting = ref(false)
const submitted = ref(false)

// ── 表单状态 ──
const selectedIndices = ref<number[]>([])
const voterName = ref('')
// 自报身份（仅未登录时使用，且 allowedVoters 允许时）
const selfVoterType = ref<string>('public')

// ── 投票者类型选项（自报身份用） ──
const voterTypeOptions = [
  { label: '公开投票', value: 'public' },
  { label: '我是评委', value: 'judge' },
  { label: '我是辩手', value: 'debater' },
]

// 是否已登录
const isLoggedIn = computed(() => !!authStore.user)

// 是否允许公开投票
const isPublicVote = computed(() => vote.value?.isPublic === true)

// 当前可见的投票者类型列表
const allowedVoterTypes = computed<string[]>(() => vote.value?.allowedVoterTypes || [])

// ── 加载投票详情 ──
async function loadData() {
  if (!voteId.value) {
    toast.add({ title: '缺少投票 ID 参数', color: 'error' })
    loading.value = false
    return
  }
  try {
    vote.value = await getTopicVote(tournamentId.value, voteId.value)
    // 已登录用户查询是否已投票
    if (isLoggedIn.value) {
      try {
        const res = await getMyVoteRecord(tournamentId.value, voteId.value)
        myRecord.value = res.record
      } catch {
        myRecord.value = null
      }
    }
    // 预填登录用户名
    if (authStore.user?.username) {
      voterName.value = authStore.user.username
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载投票失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ── 切换选择辩题 ──
function toggleTopic(idx: number) {
  if (myRecord.value || submitted.value) return
  // 单选
  if (!vote.value?.multipleChoice) {
    selectedIndices.value = [idx]
    return
  }
  // 多选
  const i = selectedIndices.value.indexOf(idx)
  if (i >= 0) {
    selectedIndices.value.splice(i, 1)
  } else {
    selectedIndices.value.push(idx)
  }
}

// ── 提交投票 ──
async function handleSubmit() {
  if (selectedIndices.value.length === 0) {
    toast.add({ title: '请至少选择一个辩题', color: 'warning' })
    return
  }
  // 未登录公开投票需填写昵称
  if (!isLoggedIn.value && isPublicVote.value && !voterName.value.trim()) {
    toast.add({ title: '请填写您的昵称', color: 'warning' })
    return
  }

  submitting.value = true
  try {
    await castVote(tournamentId.value, voteId.value, {
      topicIndices: selectedIndices.value,
      voterName: voterName.value.trim() || undefined,
      voterType: !isLoggedIn.value ? selfVoterType.value : undefined,
    })
    submitted.value = true
    toast.add({ title: '投票成功', color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '投票失败', color: 'error' })
  } finally {
    submitting.value = false
  }
}

// ── 工具函数 ──
const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '未设置'

const voterTypeLabel: Record<string, string> = {
  debater: '辩手',
  judge: '评委',
  admin: '管理员',
  public: '公开',
}

onMounted(() => loadData())
</script>

<template>
  <div class="min-h-screen">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- ═══ 投票不存在 ═══ -->
      <div v-if="!vote" class="glass-card p-8 mt-10 text-center">
        <UIcon name="i-lucide-alert-circle" class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
        <p class="text-[var(--color-text-secondary)] text-sm">投票信息加载失败</p>
      </div>

      <!-- ═══ 投票未开放 ═══ -->
      <div v-else-if="vote.status !== 'open'" class="glass-card p-8 mt-10 text-center">
        <UIcon name="i-lucide-lock" class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">投票未开放</h2>
        <p class="text-sm text-[var(--color-text-muted)]">该投票当前状态：{{ vote.status === 'draft' ? '草稿' : '已关闭' }}</p>
      </div>

      <!-- ═══ 投票已截止 ═══ -->
      <div
        v-else-if="vote.deadline && new Date(vote.deadline) < new Date()"
        class="glass-card p-8 mt-10 text-center"
      >
        <UIcon name="i-lucide-calendar-x" class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">投票已截止</h2>
        <p class="text-sm text-[var(--color-text-muted)]">截止时间为 {{ formatDate(vote.deadline) }}</p>
      </div>

      <!-- ═══ 已投票（登录用户） ═══ -->
      <div v-else-if="myRecord" class="glass-card-strong p-10 mt-10 text-center">
        <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-lucide-check" class="w-9 h-9 text-green-400" />
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">您已参与过此投票</h2>
        <p class="text-sm text-[var(--color-text-secondary)] mb-6">您的选择：</p>
        <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 mb-6 text-left max-w-sm mx-auto space-y-2">
          <div
            v-for="idx in myRecord.topicIndices"
            :key="idx"
            class="flex items-center gap-2 text-sm text-[var(--color-text-primary)]"
          >
            <UIcon name="i-lucide-check-circle-2" class="w-4 h-4 text-green-400" />
            {{ vote.topics[idx] }}
          </div>
        </div>
        <UButton color="primary" variant="outline" @click="() => { navigateTo('/') }">
          返回首页
        </UButton>
      </div>

      <!-- ═══ 提交成功 ═══ -->
      <div v-else-if="submitted" class="glass-card-strong p-10 mt-10 text-center">
        <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-lucide-check" class="w-9 h-9 text-green-400" />
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">投票成功</h2>
        <p class="text-sm text-[var(--color-text-secondary)] mb-6">感谢您的参与！</p>
        <UButton color="primary" variant="outline" @click="() => { navigateTo('/') }">
          返回首页
        </UButton>
      </div>

      <!-- ═══ 投票表单 ═══ -->
      <template v-else>
        <!-- 头部 -->
        <header class="pt-6 pb-5">
          <p class="dark-page-breadcrumb text-xs mb-1">
            辩题投票 / {{ vote.matchId ? '场次级' : '赛事级' }}
          </p>
          <h1 class="text-white text-[1.75rem] font-bold leading-tight">
            {{ vote.title }}
          </h1>
          <!-- 元信息 -->
          <div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-users" class="w-3.5 h-3.5" />
              {{ allowedVoterTypes.map(t => voterTypeLabel[t] || t).join(' / ') }}
            </span>
            <span v-if="vote.multipleChoice" class="flex items-center gap-1">
              <UIcon name="i-lucide-check-square" class="w-3.5 h-3.5" />
              多选
            </span>
            <span v-else class="flex items-center gap-1">
              <UIcon name="i-lucide-circle" class="w-3.5 h-3.5" />
              单选
            </span>
            <span v-if="vote.deadline" class="flex items-center gap-1">
              <UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
              截止 {{ formatDate(vote.deadline) }}
            </span>
          </div>
          <!-- 关联比赛信息 -->
          <div v-if="vote.match" class="mt-3 px-3 py-2 bg-[var(--color-bg-secondary)] rounded-lg flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <UIcon name="i-lucide-swords" class="w-3.5 h-3.5" />
            第 {{ vote.match.round }} 轮：{{ vote.match.teamA || '?' }} vs {{ vote.match.teamB || '?' }}
          </div>
          <!-- 说明 -->
          <div v-if="vote.description" class="mt-4 glass-card p-4">
            <p class="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />投票说明
            </p>
            <p class="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{{ vote.description }}</p>
          </div>
        </header>

        <!-- 投票主体 -->
        <main class="space-y-6 pb-12">
          <!-- 登录状态提示 -->
          <div v-if="!isLoggedIn" class="glass-card p-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <UIcon name="i-lucide-info" class="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              当前为公开投票，请填写昵称后提交。
              <NuxtLink to="/login" class="text-indigo-400 hover:underline">登录</NuxtLink>
              后可自动识别辩手/管理员身份。
            </span>
          </div>

          <!-- 候选辩题列表 -->
          <UCard>
            <template #header>
              <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <UIcon name="i-lucide-message-circle-question" class="w-4 h-4 text-[var(--color-text-muted)]" />
                选择辩题
                <span class="text-xs font-normal text-[var(--color-text-muted)]">
                  （{{ vote.multipleChoice ? '可多选' : '单选' }}）
                </span>
              </h2>
            </template>

            <div class="space-y-2">
              <div
                v-for="(topic, idx) in vote.topics"
                :key="idx"
                class="cursor-pointer rounded-lg border-2 p-4 transition-colors flex items-start gap-3"
                :class="selectedIndices.includes(idx)
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border)]'"
                @click="toggleTopic(idx)"
              >
                <!-- 选择标识 -->
                <div
                  class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                  :class="selectedIndices.includes(idx)
                    ? 'border-indigo-500 bg-indigo-500'
                    : 'border-white/30'"
                >
                  <UIcon
                    v-if="selectedIndices.includes(idx)"
                    name="i-lucide-check"
                    class="w-3 h-3 text-white"
                  />
                </div>
                <!-- 辩题文本 -->
                <div class="flex-1">
                  <p class="text-sm text-[var(--color-text-primary)] leading-relaxed">{{ topic }}</p>
                </div>
                <!-- 序号 -->
                <span class="text-xs text-[var(--color-text-muted)] shrink-0">#{{ idx + 1 }}</span>
              </div>
            </div>
          </UCard>

          <!-- 未登录用户：昵称与身份 -->
          <UCard v-if="!isLoggedIn">
            <template #header>
              <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <UIcon name="i-lucide-user" class="w-4 h-4 text-[var(--color-text-muted)]" />
                投票者信息
              </h2>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">昵称 <span class="text-red-500">*</span></label>
                <UInput
                  v-model="voterName"
                  placeholder="请输入您的昵称"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />
              </div>
              <div v-if="allowedVoterTypes.includes('judge') || allowedVoterTypes.includes('debater')">
                <label class="block text-xs text-[var(--color-text-muted)] mb-1">身份（选填）</label>
                <!-- USelect 为客户端组件，且 items 依赖 allowedVoterTypes（运行时才有数据），用 ClientOnly 包裹 -->
                <ClientOnly>
                  <USelect
                    v-model="selfVoterType"
                    :items="[
                      { label: '公开投票', value: 'public' },
                      ...(allowedVoterTypes.includes('judge') ? [{ label: '我是评委', value: 'judge' }] : []),
                      ...(allowedVoterTypes.includes('debater') ? [{ label: '我是辩手', value: 'debater' }] : []),
                    ]"
                    class="w-full"
                    :ui="{ base: 'input-glass' }"
                  />
                  <template #fallback>
                    <div class="w-full h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"></div>
                  </template>
                </ClientOnly>
              </div>
            </div>
          </UCard>

          <!-- 实时结果（若 showResults=true） -->
          <UCard v-if="vote.stats && vote.showResults && vote.stats.results.length > 0">
            <template #header>
              <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <UIcon name="i-lucide-bar-chart-3" class="w-4 h-4 text-[var(--color-text-muted)]" />
                实时统计
                <span class="text-xs font-normal text-[var(--color-text-muted)]">（共 {{ vote.stats.total }} 票）</span>
              </h2>
            </template>
            <div class="space-y-3">
              <div
                v-for="r in vote.stats.results"
                :key="r.index"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm text-[var(--color-text-primary)] flex-1 truncate">{{ r.topic }}</span>
                  <span class="text-sm text-indigo-400 ml-2">{{ r.count }} 票 ({{ r.percent }}%)</span>
                </div>
                <div class="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all"
                    :style="{ width: r.percent + '%' }"
                  />
                </div>
              </div>
            </div>
          </UCard>

          <!-- 提交按钮 -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="outline" @click="() => { navigateTo('/') }">
              取消
            </UButton>
            <UButton
              color="primary"
              size="lg"
              :loading="submitting"
              class="btn-primary"
              @click="handleSubmit"
            >
              <UIcon name="i-lucide-send" class="w-4 h-4 mr-1" />
              {{ submitting ? '提交中...' : '提交投票' }}
            </UButton>
          </div>
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 深色玻璃拟态样式由全局 main.css 提供 */
</style>
