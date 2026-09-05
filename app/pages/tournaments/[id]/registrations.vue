<script setup lang="ts">
// 报名管理页面
// 功能：
// - 报名列表：查看所有报名记录，支持按状态/类型筛选，审核（通过/拒绝）报名
// - 报名问卷设置：配置报名开关、公开性、报名类型（个人/队伍/两者）、截止时间、队伍人数、报名须知
// - 报名问卷设计：使用拖拽式表单设计器配置报名问卷字段（系统字段 + 自定义字段统一管理）
// - 自动组队：根据个人报名按队伍人数自动匹配成队，确认后转为正式队伍
// - 创建辩手账号：为已通过的报名批量创建辩手登录账号，支持复制和 CSV 导出
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()
const {
  getRegistrations,
  reviewRegistration,
  updateRegistrationSettings,
  updateRegistrationFields,
  autoMatch,
  convertToTeams,
  createDebaterAccounts,
} = useRegistration()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)
const loading = ref(false)
const registrations = ref<any[]>([])

// 当前激活的 Tab：list 报名列表 / settings 报名问卷设置 / fields 报名问卷设计
const activeTab = ref<'list' | 'settings' | 'fields'>('list')

// 筛选条件
const filterStatus = ref<string>('all')
const filterType = ref<string>('all')

// 报名问卷设置表单
const settingsForm = reactive({
  registrationOpen: false,
  registrationDeadline: '',
  isPublic: false,
  registrationType: 'both' as 'individual' | 'team' | 'both',
  teamSize: 4,
  registrationInfo: '',
})
const savingSettings = ref(false)

// 报名问卷字段配置（系统字段 + 自定义字段）
const formFields = ref<any[]>([])
const savingFields = ref(false)

// 自动组队弹窗状态
const showAutoMatch = ref(false)
const matchResult = ref<{ teams: any[]; unmatched: any[] } | null>(null)
const matching = ref(false)

// 辩手账号创建弹窗状态
const showAccounts = ref(false)
const accountResult = ref<any>(null)
const creatingAccounts = ref(false)

// 报名审核弹窗状态
const reviewModal = ref(false)
const reviewTarget = ref<any>(null)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewNote = ref('')

// 加载页面所有数据：报名列表 + 赛事配置（问卷设置、问卷字段）
async function loadData() {
  loading.value = true
  try {
    await loadRegistrations()
    settingsForm.registrationOpen = tournament.value.registrationOpen || false
    settingsForm.registrationDeadline = tournament.value.registrationDeadline
      ? new Date(tournament.value.registrationDeadline).toISOString().slice(0, 16)
      : ''
    settingsForm.isPublic = tournament.value.isPublic || false
    settingsForm.registrationType = tournament.value.registrationType || 'both'
    settingsForm.teamSize = tournament.value.teamSize || 4
    settingsForm.registrationInfo = tournament.value.registrationInfo || ''
    // 报名问卷字段：从 tournament.fields 加载
    // 仅加载自定义字段，过滤掉系统字段（姓名/电话/邮箱等由后端自动初始化）
    // 系统字段保留在数据库中供业务逻辑使用，但不在画布显示，让设计器从空状态开始
    formFields.value = Array.isArray(tournament.value.fields)
      ? tournament.value.fields.filter((f: any) => !f.systemField).map((f: any) => ({ ...f }))
      : []
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 按筛选条件加载报名列表
async function loadRegistrations() {
  try {
    const params: any = {}
    if (filterStatus.value && filterStatus.value !== 'all') params.status = filterStatus.value
    if (filterType.value && filterType.value !== 'all') params.type = filterType.value
    registrations.value = await getRegistrations(tournamentId.value, params)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载报名列表失败', color: 'error' })
  }
}

// 保存报名设置
async function saveSettings() {
  savingSettings.value = true
  try {
    await updateRegistrationSettings(tournamentId.value, {
      registrationOpen: settingsForm.registrationOpen,
      registrationDeadline: settingsForm.registrationDeadline || null,
      isPublic: settingsForm.isPublic,
      registrationType: settingsForm.registrationType,
      teamSize: settingsForm.teamSize || null,
      registrationInfo: settingsForm.registrationInfo || null,
    })
    toast.add({ title: '报名设置已保存', color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    savingSettings.value = false
  }
}

// 保存表单字段配置（仅自定义字段，系统字段由后端维护）
async function saveAllFields() {
  savingFields.value = true
  try {
    const result = await updateRegistrationFields(tournamentId.value, formFields.value)
    // 更新本地字段列表（后端返回的最新数据，包含 id）
    // 仅保留自定义字段，过滤系统字段，避免画布出现默认字段
    if (result?.fields) {
      formFields.value = result.fields
        .filter((f: any) => !f.systemField)
        .map((f: any) => ({ ...f }))
    }
    toast.add({ title: '字段配置已保存', color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    savingFields.value = false
  }
}

// addField 和 removeField 已由 FormDesigner 组件内部处理，这里不再需要

// 打开审核弹窗（通过/拒绝）
function openReview(reg: any, action: 'approve' | 'reject') {
  reviewTarget.value = reg
  reviewAction.value = action
  reviewNote.value = ''
  reviewModal.value = true
}

// 确认审核操作并刷新列表
async function confirmReview() {
  if (!reviewTarget.value) return
  try {
    await reviewRegistration(
      tournamentId.value,
      reviewTarget.value.id,
      reviewAction.value,
      reviewNote.value,
    )
    toast.add({ title: reviewAction.value === 'approve' ? '已通过' : '已拒绝', color: 'success' })
    reviewModal.value = false
    await loadRegistrations()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '操作失败', color: 'error' })
  }
}

// 自动组队：根据个人报名按 teamSize 自动匹配成队
async function handleAutoMatch() {
  matching.value = true
  try {
    matchResult.value = await autoMatch(tournamentId.value, settingsForm.teamSize)
    showAutoMatch.value = true
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '自动组队失败', color: 'error' })
  } finally {
    matching.value = false
  }
}

// 确认自动组队结果，将建议队伍转为正式队伍
async function handleConvert() {
  if (!matchResult.value) return
  try {
    const items = matchResult.value.teams.map((t: any, i: number) => ({
      name: t.suggestedName,
      registrationIds: t.members.map((m: any) => m.registrationId),
    }))
    await convertToTeams(tournamentId.value, items)
    toast.add({ title: `已创建 ${items.length} 支队伍`, color: 'success' })
    showAutoMatch.value = false
    matchResult.value = null
    await loadRegistrations()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '组队失败', color: 'error' })
  }
}

// 为已通过的报名批量创建辩手登录账号
async function handleCreateAccounts() {
  creatingAccounts.value = true
  try {
    const result = await createDebaterAccounts(tournamentId.value)
    accountResult.value = result
    showAccounts.value = true
    await loadRegistrations()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '创建账号失败', color: 'error' })
  } finally {
    creatingAccounts.value = false
  }
}

// 报名统计：按状态（待审核/已通过/已拒绝）和类型（个人/队伍）汇总
const stats = computed(() => {
  let pending = 0,
    approved = 0,
    rejected = 0,
    individual = 0,
    team = 0
  for (const r of registrations.value) {
    if (r.status === 'pending') pending++
    else if (r.status === 'approved') approved++
    else if (r.status === 'rejected') rejected++
    if (r.type === 'individual') individual++
    else if (r.type === 'team') team++
  }
  return {
    total: registrations.value.length,
    pending,
    approved,
    rejected,
    individual,
    team,
  }
})

// 公开报名链接
// 统一返回相对路径，避免 SSR 返回相对路径而客户端首帧返回绝对 URL 导致 hydration mismatch
// 用户复制链接时再拼接 origin（见 copyLink）
const registrationLink = computed(() => {
  return `/tournaments/${tournamentId.value}/register`
})

// 复制报名链接到剪贴板（拼接完整 URL，便于分享）
function copyLink() {
  if (import.meta.client) {
    const fullUrl = `${window.location.origin}${registrationLink.value}`
    navigator.clipboard.writeText(fullUrl)
    toast.add({ title: '报名链接已复制', color: 'success' })
  }
}

// 复制全部辩手账号信息到剪贴板（制表符分隔，便于粘贴到 Excel）
function copyAccounts() {
  if (!accountResult.value?.accounts?.length) return
  const text = accountResult.value.accounts
    .map((a: any) => `${a.name}\t${a.username}\t${a.password}`)
    .join('\n')
  if (import.meta.client) {
    navigator.clipboard.writeText(text)
    toast.add({ title: '账号信息已复制', color: 'success' })
  }
}

// 下载辩手账号 CSV 文件（含 UTF-8 BOM 防止中文乱码）
function downloadAccounts() {
  if (!accountResult.value?.accounts?.length) return
  const header = ['姓名', '用户名', '密码']
  const rows = accountResult.value.accounts.map((a: any) => [a.name, a.username, a.password])
  // CSV 字段转义：包含逗号、引号或换行符的字段需用双引号包裹
  const escape = (v: any) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n'))
      return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `辩手账号_${tournament.value?.name || ''}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 格式化自定义数据为可读字符串数组（用于列表展示）
function formatCustomData(data: any): string[] {
  if (!data) return []
  const obj = typeof data === 'string' ? safeParse(data) : data
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`)
}

// 安全的 JSON.parse（失败返回 null，不抛异常）
function safeParse(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// 报名状态元信息（标签文字与颜色）
const statusMeta: Record<
  string,
  { label: string; color: 'warning' | 'success' | 'error' | 'neutral' }
> = {
  pending: { label: '待审核', color: 'warning' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
}
// 报名类型元信息（标签文字与图标）
const typeMeta: Record<string, { label: string; icon: string }> = {
  individual: { label: '个人', icon: 'i-lucide-user' },
  team: { label: '队伍', icon: 'i-lucide-users' },
}

onMounted(() => loadData())
</script>

<template>
  <template v-if="tournament">
    <div class="space-y-6">
      <!-- 子 Tab 切换栏：报名列表 / 报名问卷设置 / 报名问卷设计 -->
      <div
        class="inline-flex gap-1 p-1 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
      >
        <button
          v-for="tab in [
            { key: 'list', label: '报名列表', icon: 'i-lucide-list' },
            { key: 'settings', label: '报名问卷设置', icon: 'i-lucide-settings' },
            { key: 'fields', label: '报名问卷设计', icon: 'i-lucide-form-input' },
          ]"
          :key="tab.key"
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5"
          :class="
            activeTab === tab.key
              ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
          "
          @click="
            () => {
              activeTab = tab.key as any
            }
          "
        >
          <UIcon :name="tab.icon" class="w-4 h-4" /> {{ tab.label }}
        </button>
      </div>

      <template v-if="activeTab === 'list'">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">报名总数</p>
                <p class="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                  {{ stats.total }}
                </p>
              </div>
              <UIcon
                name="i-lucide-clipboard-list"
                class="w-8 h-8 text-blue-600/60 dark:text-blue-400/60"
              />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">
              个人 {{ stats.individual }} · 队伍 {{ stats.team }}
            </p>
          </div>
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">待审核</p>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {{ stats.pending }}
                </p>
              </div>
              <UIcon name="i-lucide-clock" class="w-8 h-8 text-amber-600 dark:text-amber-400/60" />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">需处理</p>
          </div>
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">已通过</p>
                <p class="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {{ stats.approved }}
                </p>
              </div>
              <UIcon
                name="i-lucide-check-circle"
                class="w-8 h-8 text-green-600 dark:text-green-400/60"
              />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">已审核通过</p>
          </div>
          <div class="glass-card p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-[var(--color-text-muted)]">已拒绝</p>
                <p class="text-2xl font-bold text-red-500 dark:text-red-400 mt-1">
                  {{ stats.rejected }}
                </p>
              </div>
              <UIcon name="i-lucide-x-circle" class="w-8 h-8 text-red-500 dark:text-red-400/60" />
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-2">未通过</p>
          </div>
        </div>

        <UCard>
          <div class="flex flex-wrap items-center gap-3">
            <ClientOnly>
              <USelect
                v-model="filterStatus"
                @change="loadRegistrations"
                :items="[
                  { label: '全部状态', value: 'all' },
                  { label: '待审核', value: 'pending' },
                  { label: '已通过', value: 'approved' },
                  { label: '已拒绝', value: 'rejected' },
                ]"
                class="w-36"
                :ui="{ base: 'input-glass' }"
              />
              <template #fallback>
                <div class="w-36 h-9 rounded-lg bg-[var(--color-bg-secondary)]"></div>
              </template>
            </ClientOnly>
            <ClientOnly>
              <USelect
                v-model="filterType"
                @change="loadRegistrations"
                :items="[
                  { label: '全部类型', value: 'all' },
                  { label: '个人', value: 'individual' },
                  { label: '队伍', value: 'team' },
                ]"
                class="w-36"
                :ui="{ base: 'input-glass' }"
              />
              <template #fallback>
                <div class="w-36 h-9 rounded-lg bg-[var(--color-bg-secondary)]"></div>
              </template>
            </ClientOnly>

            <div class="flex-1" />

            <UButton color="primary" variant="outline" icon="i-lucide-link" @click="copyLink">
              复制报名链接
            </UButton>
            <UButton
              color="warning"
              variant="outline"
              icon="i-lucide-shuffle"
              :loading="matching"
              @click="handleAutoMatch"
            >
              自动组队
            </UButton>
            <UButton
              color="success"
              variant="outline"
              icon="i-lucide-user-plus"
              :loading="creatingAccounts"
              @click="handleCreateAccounts"
            >
              创建辩手账号
            </UButton>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-link" class="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-xs text-[var(--color-text-muted)] mb-0.5">报名链接</p>
              <p class="text-sm text-[var(--color-text-primary)] truncate font-mono">
                {{ registrationLink }}
              </p>
            </div>
            <UButton size="xs" variant="ghost" icon="i-lucide-copy" @click="copyLink">复制</UButton>
          </div>
        </UCard>

        <div v-if="registrations.length === 0" class="glass-card-strong p-12 text-center">
          <UIcon
            name="i-lucide-inbox"
            class="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4"
          />
          <h3 class="text-base font-semibold text-[var(--color-text-primary)] mb-2">
            暂无报名记录
          </h3>
          <p class="text-sm text-[var(--color-text-muted)]">
            分享报名链接，等待选手报名后此处将显示记录
          </p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="reg in registrations"
            :key="reg.id"
            class="glass-card p-5 border border-[var(--color-border)] hover:border-blue-500/40 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-2">
                  <UBadge
                    :icon="typeMeta[reg.type]?.icon || 'i-lucide-user'"
                    :color="reg.type === 'team' ? 'primary' : 'neutral'"
                    size="sm"
                    variant="soft"
                  >
                    {{ typeMeta[reg.type]?.label || reg.type }}
                  </UBadge>
                  <UBadge
                    :color="statusMeta[reg.status]?.color || 'neutral'"
                    size="sm"
                    variant="solid"
                  >
                    {{ statusMeta[reg.status]?.label || reg.status }}
                  </UBadge>
                  <UBadge
                    v-if="reg.convertedTeamId"
                    color="info"
                    size="sm"
                    variant="soft"
                    icon="i-lucide-check"
                  >
                    已转队伍
                  </UBadge>
                  <span
                    v-if="reg.teamName"
                    class="text-sm font-semibold text-[var(--color-text-primary)]"
                  >
                    {{ reg.teamName }}
                  </span>
                </div>

                <div
                  class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <span class="flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-user"
                      class="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                    />
                    {{ reg.submitterName }}
                  </span>
                  <span v-if="reg.contactPhone" class="flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-phone"
                      class="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                    />
                    {{ reg.contactPhone }}
                  </span>
                  <span v-if="reg.contactEmail" class="flex items-center gap-1.5">
                    <UIcon
                      name="i-lucide-mail"
                      class="w-3.5 h-3.5 text-[var(--color-text-muted)]"
                    />
                    {{ reg.contactEmail }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <UButton
                  v-if="reg.status === 'pending'"
                  color="success"
                  size="xs"
                  icon="i-lucide-check"
                  @click="openReview(reg, 'approve')"
                >
                  通过
                </UButton>
                <UButton
                  v-if="reg.status === 'pending'"
                  color="error"
                  size="xs"
                  variant="outline"
                  icon="i-lucide-x"
                  @click="openReview(reg, 'reject')"
                >
                  拒绝
                </UButton>
              </div>
            </div>

            <div v-if="reg.members?.length" class="mt-4 pt-4 border-t border-[var(--color-border)]">
              <p class="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5">
                <UIcon name="i-lucide-users" class="w-3.5 h-3.5" /> 成员（{{ reg.members.length }}
                人）
              </p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(m, idx) in reg.members"
                  :key="idx"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] rounded-full"
                >
                  {{ m.name }}
                  <span v-if="m.preferredPosition" class="text-[var(--color-text-muted)]"
                    >· {{ m.preferredPosition }}</span
                  >
                </span>
              </div>
            </div>

            <div v-if="formatCustomData(reg.customData).length" class="mt-3">
              <p class="text-xs text-[var(--color-text-muted)] mb-1.5">附加信息</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(line, idx) in formatCustomData(reg.customData)"
                  :key="idx"
                  class="px-2.5 py-1 text-xs text-[var(--color-text-secondary)] bg-indigo-500/10 rounded"
                >
                  {{ line }}
                </span>
              </div>
            </div>

            <div
              class="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]"
            >
              <span v-if="reg.notes" class="flex items-center gap-1.5 truncate">
                <UIcon name="i-lucide-sticky-note" class="w-3.5 h-3.5" />
                <span class="truncate">{{ reg.notes }}</span>
              </span>
              <span v-else />
              <span v-if="reg.createdAt" class="flex items-center gap-1.5 shrink-0">
                <UIcon name="i-lucide-clock" class="w-3.5 h-3.5" />
                {{ new Date(reg.createdAt).toLocaleString('zh-CN') }}
              </span>
            </div>

            <div v-if="reg.reviewNote" class="mt-2 text-xs text-[var(--color-text-muted)]">
              <span class="text-[var(--color-text-muted)]">审核备注：</span>{{ reg.reviewNote }}
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="activeTab === 'settings'">
        <UCard>
          <template #header>
            <h2
              class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
            >
              <UIcon name="i-lucide-settings" class="w-4 h-4 text-[var(--color-text-muted)]" />
              报名问卷设置
            </h2>
          </template>

          <div class="space-y-5">
            <div
              class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded"
            >
              <div>
                <label class="text-sm text-[var(--color-text-primary)] font-medium">开启报名</label>
                <p class="text-xs text-[var(--color-text-muted)]">
                  关闭后，选手将无法提交这份报名问卷
                </p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsForm.registrationOpen" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div
              class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded"
            >
              <div>
                <label class="text-sm text-[var(--color-text-primary)] font-medium">公开报名</label>
                <p class="text-xs text-[var(--color-text-muted)]">
                  允许未登录用户提交报名（无需账号）
                </p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="settingsForm.isPublic" />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- 报名问卷类型选择 -->
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >报名类型</label
              >
              <div class="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  class="rounded-lg border-2 p-3 transition-colors text-left"
                  :class="
                    settingsForm.registrationType === 'individual'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
                  "
                  @click="
                    () => {
                      settingsForm.registrationType = 'individual'
                    }
                  "
                >
                  <UIcon
                    name="i-lucide-user"
                    class="w-5 h-5 mb-1"
                    :class="
                      settingsForm.registrationType === 'individual'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-[var(--color-text-secondary)]'
                    "
                  />
                  <div class="text-sm font-medium text-[var(--color-text-primary)]">仅个人</div>
                  <div class="text-xs text-[var(--color-text-muted)]">只允许个人报名</div>
                </button>
                <button
                  type="button"
                  class="rounded-lg border-2 p-3 transition-colors text-left"
                  :class="
                    settingsForm.registrationType === 'team'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
                  "
                  @click="
                    () => {
                      settingsForm.registrationType = 'team'
                    }
                  "
                >
                  <UIcon
                    name="i-lucide-users"
                    class="w-5 h-5 mb-1"
                    :class="
                      settingsForm.registrationType === 'team'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-[var(--color-text-secondary)]'
                    "
                  />
                  <div class="text-sm font-medium text-[var(--color-text-primary)]">仅队伍</div>
                  <div class="text-xs text-[var(--color-text-muted)]">只允许队伍报名</div>
                </button>
                <button
                  type="button"
                  class="rounded-lg border-2 p-3 transition-colors text-left"
                  :class="
                    settingsForm.registrationType === 'both'
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
                  "
                  @click="
                    () => {
                      settingsForm.registrationType = 'both'
                    }
                  "
                >
                  <UIcon
                    name="i-lucide-user-plus"
                    class="w-5 h-5 mb-1"
                    :class="
                      settingsForm.registrationType === 'both'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-[var(--color-text-secondary)]'
                    "
                  />
                  <div class="text-sm font-medium text-[var(--color-text-primary)]">
                    个人 + 队伍
                  </div>
                  <div class="text-xs text-[var(--color-text-muted)]">两种方式均可</div>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >报名截止时间</label
              >
              <BaseDateTimePicker
                v-model="settingsForm.registrationDeadline"
                mode="datetime"
                placeholder="选择报名截止时间"
              />
              <p class="text-xs text-[var(--color-text-muted)] mt-1">留空表示不设截止时间</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >队伍人数</label
              >
              <input
                v-model.number="settingsForm.teamSize"
                type="number"
                min="1"
                class="input-glass w-full"
              />
              <p class="text-xs text-[var(--color-text-muted)] mt-1">
                用于自动组队时每队的人数上限
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
                >报名须知</label
              >
              <textarea
                v-model="settingsForm.registrationInfo"
                rows="4"
                placeholder="例如：请如实填写个人信息，报名截止后将无法修改..."
                class="input-glass w-full resize-y"
              />
            </div>
          </div>

          <div class="flex justify-end mt-6 pt-4 border-t border-[var(--color-border)]">
            <UButton
              color="primary"
              icon="i-lucide-save"
              :loading="savingSettings"
              @click="saveSettings"
            >
              保存设置
            </UButton>
          </div>
        </UCard>
      </template>

      <template v-else-if="activeTab === 'fields'">
        <!-- 拖拽式表单设计器（类似腾讯问卷/问卷星） -->
        <!-- FormDesigner 已自带顶部导航栏（含保存按钮占位），无需外层 UCard 包裹 -->
        <!-- 用 ClientOnly 包裹：FormDesigner 顶层 import vue-draggable-plus，该库强依赖 window/document，SSR 阶段直接渲染会抛错 -->
        <ClientOnly>
          <div class="h-[760px]">
            <LazyFormDesigner v-model="formFields" />
          </div>
          <template #fallback>
            <div
              class="h-[760px] flex items-center justify-center text-[var(--color-text-muted)] text-sm"
            >
              表单设计器加载中...
            </div>
          </template>
        </ClientOnly>
      </template>
    </div>

    <div
      v-if="reviewModal"
      class="fixed inset-0 bg-[var(--overlay-overlay)] flex items-center justify-center z-50"
      @click.self="reviewModal = false"
    >
      <div class="glass-modal rounded-xl shadow-lg w-full max-w-md p-6">
        <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-1 flex items-center gap-2">
          <UIcon
            :name="reviewAction === 'approve' ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
            class="w-5 h-5"
            :class="
              reviewAction === 'approve'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-500 dark:text-red-400'
            "
          />
          {{ reviewAction === 'approve' ? '通过报名' : '拒绝报名' }}
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">请确认操作，可填写审核备注</p>

        <div
          v-if="reviewTarget"
          class="bg-[var(--color-bg-secondary)] rounded-lg p-3 mb-4 text-sm space-y-1"
        >
          <p class="text-[var(--color-text-primary)]">
            <span class="text-[var(--color-text-muted)]">提交人：</span
            >{{ reviewTarget.submitterName }}
          </p>
          <p v-if="reviewTarget.teamName" class="text-[var(--color-text-primary)]">
            <span class="text-[var(--color-text-muted)]">队伍：</span>{{ reviewTarget.teamName }}
          </p>
          <p v-if="reviewTarget.contactPhone" class="text-[var(--color-text-primary)]">
            <span class="text-[var(--color-text-muted)]">电话：</span
            >{{ reviewTarget.contactPhone }}
          </p>
          <p v-if="reviewTarget.members?.length" class="text-[var(--color-text-primary)]">
            <span class="text-[var(--color-text-muted)]">成员：</span
            >{{ reviewTarget.members.map((m: any) => m.name).join('、') }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >审核备注（选填）</label
          >
          <textarea
            v-model="reviewNote"
            rows="3"
            placeholder="可填写审核说明..."
            class="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] resize-y"
          />
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--color-border)]">
          <UButton
            color="neutral"
            variant="ghost"
            @click="
              () => {
                reviewModal = false
              }
            "
            >取消</UButton
          >
          <UButton
            :color="reviewAction === 'approve' ? 'success' : 'error'"
            :icon="reviewAction === 'approve' ? 'i-lucide-check' : 'i-lucide-x'"
            @click="confirmReview"
          >
            确认{{ reviewAction === 'approve' ? '通过' : '拒绝' }}
          </UButton>
        </div>
      </div>
    </div>

    <div
      v-if="showAutoMatch"
      class="fixed inset-0 bg-[var(--overlay-overlay)] flex items-center justify-center z-50"
      @click.self="showAutoMatch = false"
    >
      <div
        class="glass-modal rounded-xl shadow-lg w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-1 flex items-center gap-2">
          <UIcon name="i-lucide-shuffle" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
          自动组队结果
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">
          系统已根据个人报名自动匹配成队，确认后将创建为正式队伍
        </p>

        <div v-if="matchResult" class="space-y-4">
          <div>
            <p class="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              建议队伍（{{ matchResult.teams.length }} 支）
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="(team, idx) in matchResult.teams"
                :key="idx"
                class="border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-bg-secondary)]"
              >
                <p class="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  {{ team.suggestedName }}
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(m, mIdx) in team.members"
                    :key="mIdx"
                    class="px-2 py-0.5 text-xs text-[var(--color-text-secondary)] bg-blue-500/15 rounded-full"
                  >
                    {{ m.name || m.submitterName }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="matchResult.unmatched.length > 0">
            <p class="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
              未匹配（{{ matchResult.unmatched.length }} 人，不足一队）
            </p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="(m, idx) in matchResult.unmatched"
                :key="idx"
                class="px-2 py-0.5 text-xs text-[var(--color-text-secondary)] bg-amber-500/15 rounded-full"
              >
                {{ m.name || m.submitterName }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--color-border)]">
          <UButton
            color="neutral"
            variant="ghost"
            @click="
              () => {
                showAutoMatch = false
              }
            "
            >取消</UButton
          >
          <UButton color="primary" icon="i-lucide-check" @click="handleConvert">
            确认创建队伍
          </UButton>
        </div>
      </div>
    </div>

    <div
      v-if="showAccounts"
      class="fixed inset-0 bg-[var(--overlay-overlay)] flex items-center justify-center z-50"
      @click.self="showAccounts = false"
    >
      <div
        class="glass-modal rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-1 flex items-center gap-2">
          <UIcon name="i-lucide-user-plus" class="w-5 h-5 text-green-600 dark:text-green-400" />
          辩手账号创建结果
        </h3>
        <p class="text-sm text-[var(--color-text-muted)] mb-4" v-if="accountResult">
          共创建 {{ accountResult.created }} 个账号，请妥善保存账号密码并下发给辩手
        </p>

        <div v-if="accountResult?.accounts?.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr
                class="text-left text-[var(--color-text-secondary)] border-b border-[var(--color-border)]"
              >
                <th class="py-2 px-2 font-medium">姓名</th>
                <th class="py-2 px-2 font-medium">用户名</th>
                <th class="py-2 px-2 font-medium">密码</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(acc, idx) in accountResult.accounts"
                :key="idx"
                class="border-b border-[var(--color-border-muted)] text-[var(--color-text-primary)]"
              >
                <td class="py-2 px-2">{{ acc.name }}</td>
                <td class="py-2 px-2 font-mono">{{ acc.username }}</td>
                <td class="py-2 px-2 font-mono">{{ acc.password }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-[var(--color-border)]">
          <UButton color="neutral" variant="ghost" icon="i-lucide-copy" @click="copyAccounts"
            >复制全部</UButton
          >
          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-download"
            @click="downloadAccounts"
            >下载 CSV</UButton
          >
          <UButton
            color="primary"
            @click="
              () => {
                showAccounts = false
              }
            "
            >完成</UButton
          >
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped></style>
