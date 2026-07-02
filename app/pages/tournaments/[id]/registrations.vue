<script setup lang="ts">
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const toast = useToast()
const {
  getRegistrations, reviewRegistration, updateRegistrationSettings,
  updateRegistrationFields, autoMatch, convertToTeams, createDebaterAccounts
} = useRegistration()

const tournament = inject<Ref<any>>('tournament')!
const tournamentId = computed(() => route.params.id as string)
const loading = ref(false)
const registrations = ref<any[]>([])

const activeTab = ref<'list' | 'settings' | 'fields'>('list')

const filterStatus = ref<string>('')
const filterType = ref<string>('')

const settingsForm = reactive({
  registrationOpen: false,
  registrationDeadline: '',
  isPublic: false,
  teamSize: 4,
  registrationInfo: '',
})
const savingSettings = ref(false)

const customFields = ref<any[]>([])
const savingFields = ref(false)

const showAutoMatch = ref(false)
const matchResult = ref<{ teams: any[]; unmatched: any[] } | null>(null)
const matching = ref(false)

const showAccounts = ref(false)
const accountResult = ref<any>(null)
const creatingAccounts = ref(false)

const reviewModal = ref(false)
const reviewTarget = ref<any>(null)
const reviewAction = ref<'approve' | 'reject'>('approve')
const reviewNote = ref('')

async function loadData() {
  loading.value = true
  try {
    await loadRegistrations()
    settingsForm.registrationOpen = tournament.value.registrationOpen || false
    settingsForm.registrationDeadline = tournament.value.registrationDeadline
      ? new Date(tournament.value.registrationDeadline).toISOString().slice(0, 16) : ''
    settingsForm.isPublic = tournament.value.isPublic || false
    settingsForm.teamSize = tournament.value.teamSize || 4
    settingsForm.registrationInfo = tournament.value.registrationInfo || ''
    customFields.value = Array.isArray(tournament.value.fields) ? tournament.value.fields.map((f: any) => ({ ...f })) : []
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function loadRegistrations() {
  try {
    const params: any = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (filterType.value) params.type = filterType.value
    registrations.value = await getRegistrations(tournamentId.value, params)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载报名列表失败', color: 'error' })
  }
}

async function saveSettings() {
  savingSettings.value = true
  try {
    await updateRegistrationSettings(tournamentId.value, {
      registrationOpen: settingsForm.registrationOpen,
      registrationDeadline: settingsForm.registrationDeadline || null,
      isPublic: settingsForm.isPublic,
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

async function saveFields() {
  savingFields.value = true
  try {
    await updateRegistrationFields(tournamentId.value, customFields.value)
    toast.add({ title: '自定义字段已保存', color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    savingFields.value = false
  }
}

function addField() {
  customFields.value.push({
    fieldName: '', fieldKey: '', fieldType: 'text',
    fieldOptions: '', required: false, sortOrder: customFields.value.length, appliesTo: 'both'
  })
}

function removeField(idx: number) {
  customFields.value.splice(idx, 1)
}

function openReview(reg: any, action: 'approve' | 'reject') {
  reviewTarget.value = reg
  reviewAction.value = action
  reviewNote.value = ''
  reviewModal.value = true
}

async function confirmReview() {
  if (!reviewTarget.value) return
  try {
    await reviewRegistration(tournamentId.value, reviewTarget.value.id, reviewAction.value, reviewNote.value)
    toast.add({ title: reviewAction.value === 'approve' ? '已通过' : '已拒绝', color: 'success' })
    reviewModal.value = false
    await loadRegistrations()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '操作失败', color: 'error' })
  }
}

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

async function handleConvert() {
  if (!matchResult.value) return
  try {
    const items = matchResult.value.teams.map((t: any, i: number) => ({
      name: t.suggestedName,
      registrationIds: t.members.map((m: any) => m.registrationId)
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

const stats = computed(() => {
  let pending = 0, approved = 0, rejected = 0, individual = 0, team = 0
  for (const r of registrations.value) {
    if (r.status === 'pending') pending++
    else if (r.status === 'approved') approved++
    else if (r.status === 'rejected') rejected++
    if (r.type === 'individual') individual++
    else if (r.type === 'team') team++
  }
  return {
    total: registrations.value.length,
    pending, approved, rejected, individual, team,
  }
})

const registrationLink = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}/tournaments/${tournamentId.value}/register`
  }
  return `/tournaments/${tournamentId.value}/register`
})

function copyLink() {
  if (import.meta.client) {
    navigator.clipboard.writeText(registrationLink.value)
    toast.add({ title: '报名链接已复制', color: 'success' })
  }
}

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

function downloadAccounts() {
  if (!accountResult.value?.accounts?.length) return
  const header = ['姓名', '用户名', '密码']
  const rows = accountResult.value.accounts.map((a: any) => [a.name, a.username, a.password])
  const escape = (v: any) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const csv = '\uFEFF' + [header, ...rows].map(r => r.map(escape).join(',')).join('\n')
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

function formatCustomData(data: any): string[] {
  if (!data) return []
  const obj = typeof data === 'string' ? safeParse(data) : data
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj).map(([k, v]) => `${k}: ${v}`)
}

function safeParse(s: string): any {
  try { return JSON.parse(s) } catch { return null }
}

const statusMeta: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'neutral' }> = {
  pending: { label: '待审核', color: 'warning' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
}
const typeMeta: Record<string, { label: string; icon: string }> = {
  individual: { label: '个人', icon: 'i-lucide-user' },
  team: { label: '队伍', icon: 'i-lucide-users' },
}

onMounted(() => loadData())
</script>

<template>
  <template v-if="tournament">
  <div class="space-y-6">
    <div class="flex gap-2">
      <button
        v-for="tab in [
          { key: 'list', label: '报名列表', icon: 'i-lucide-list' },
          { key: 'settings', label: '报名设置', icon: 'i-lucide-settings' },
          { key: 'fields', label: '自定义字段', icon: 'i-lucide-form-input' },
        ]"
        :key="tab.key"
        @click="activeTab = tab.key as any"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        :class="activeTab === tab.key
          ? 'bg-blue-600 text-white'
          : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'"
      >
        <UIcon :name="tab.icon" class="w-4 h-4" /> {{ tab.label }}
      </button>
    </div>

    <template v-if="activeTab === 'list'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">报名总数</p>
              <p class="text-2xl font-bold text-white mt-1">{{ stats.total }}</p>
            </div>
            <UIcon name="i-lucide-clipboard-list" class="w-8 h-8 text-blue-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">个人 {{ stats.individual }} · 队伍 {{ stats.team }}</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">待审核</p>
              <p class="text-2xl font-bold text-amber-400 mt-1">{{ stats.pending }}</p>
            </div>
            <UIcon name="i-lucide-clock" class="w-8 h-8 text-amber-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">需处理</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">已通过</p>
              <p class="text-2xl font-bold text-green-400 mt-1">{{ stats.approved }}</p>
            </div>
            <UIcon name="i-lucide-check-circle" class="w-8 h-8 text-green-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">已审核通过</p>
        </div>
        <div class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-white/50">已拒绝</p>
              <p class="text-2xl font-bold text-red-400 mt-1">{{ stats.rejected }}</p>
            </div>
            <UIcon name="i-lucide-x-circle" class="w-8 h-8 text-red-400/60" />
          </div>
          <p class="text-xs text-white/40 mt-2">未通过</p>
        </div>
      </div>

      <UCard>
        <div class="flex flex-wrap items-center gap-3">
          <select
            v-model="filterStatus"
            @change="loadRegistrations"
            class="px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
          >
            <option value="">全部状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          <select
            v-model="filterType"
            @change="loadRegistrations"
            class="px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
          >
            <option value="">全部类型</option>
            <option value="individual">个人</option>
            <option value="team">队伍</option>
          </select>

          <div class="flex-1" />

          <UButton
            color="primary"
            variant="outline"
            icon="i-lucide-link"
            @click="copyLink"
          >
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
          <UIcon name="i-lucide-link" class="w-4 h-4 text-white/40 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-xs text-white/50 mb-0.5">报名链接</p>
            <p class="text-sm text-white/80 truncate font-mono">{{ registrationLink }}</p>
          </div>
          <UButton size="xs" variant="ghost" icon="i-lucide-copy" @click="copyLink">复制</UButton>
        </div>
      </UCard>

      <div v-if="registrations.length === 0" class="glass-card-strong p-12 text-center">
        <UIcon name="i-lucide-inbox" class="w-16 h-16 text-white/30 mx-auto mb-4" />
        <h3 class="text-base font-semibold text-white mb-2">暂无报名记录</h3>
        <p class="text-sm text-white/50">分享报名链接，等待选手报名后此处将显示记录</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="reg in registrations"
          :key="reg.id"
          class="glass-card p-5 border border-white/10 hover:border-blue-500/40 transition-colors"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap mb-2">
                <UBadge
                  :icon="typeMeta[reg.type]?.icon || 'i-lucide-user'"
                  :color="(reg.type === 'team' ? 'primary' : 'neutral')"
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
                <span v-if="reg.teamName" class="text-sm font-semibold text-white">
                  {{ reg.teamName }}
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-white/70">
                <span class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-user" class="w-3.5 h-3.5 text-white/40" />
                  {{ reg.submitterName }}
                </span>
                <span v-if="reg.contactPhone" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-phone" class="w-3.5 h-3.5 text-white/40" />
                  {{ reg.contactPhone }}
                </span>
                <span v-if="reg.contactEmail" class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-mail" class="w-3.5 h-3.5 text-white/40" />
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

          <div v-if="reg.members?.length" class="mt-4 pt-4 border-t border-white/10">
            <p class="text-xs text-white/50 mb-2 flex items-center gap-1.5">
              <UIcon name="i-lucide-users" class="w-3.5 h-3.5" /> 成员（{{ reg.members.length }} 人）
            </p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(m, idx) in reg.members"
                :key="idx"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/80 bg-white/5 rounded-full"
              >
                {{ m.name }}
                <span v-if="m.preferredPosition" class="text-white/40">· {{ m.preferredPosition }}</span>
              </span>
            </div>
          </div>

          <div v-if="formatCustomData(reg.customData).length" class="mt-3">
            <p class="text-xs text-white/50 mb-1.5">附加信息</p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(line, idx) in formatCustomData(reg.customData)"
                :key="idx"
                class="px-2.5 py-1 text-xs text-white/70 bg-indigo-500/10 rounded"
              >
                {{ line }}
              </span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between gap-3 text-xs text-white/40">
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

          <div v-if="reg.reviewNote" class="mt-2 text-xs text-white/50">
            <span class="text-white/40">审核备注：</span>{{ reg.reviewNote }}
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="activeTab === 'settings'">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-white flex items-center gap-2">
            <UIcon name="i-lucide-settings" class="w-4 h-4 text-white/40" />
            报名设置
          </h2>
        </template>

        <div class="space-y-5">
          <div class="flex items-center justify-between py-2 px-3 bg-white/5 rounded">
            <div>
              <label class="text-sm text-white/80 font-medium">开启报名</label>
              <p class="text-xs text-white/40">关闭后，选手将无法提交报名</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settingsForm.registrationOpen" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div class="flex items-center justify-between py-2 px-3 bg-white/5 rounded">
            <div>
              <label class="text-sm text-white/80 font-medium">公开报名</label>
              <p class="text-xs text-white/40">允许未登录用户提交报名（无需账号）</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="settingsForm.isPublic" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-white/80 mb-1.5">报名截止时间</label>
            <input
              v-model="settingsForm.registrationDeadline"
              type="datetime-local"
              class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
            />
            <p class="text-xs text-white/40 mt-1">留空表示不设截止时间</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-white/80 mb-1.5">队伍人数</label>
            <input
              v-model.number="settingsForm.teamSize"
              type="number"
              min="1"
              class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
            />
            <p class="text-xs text-white/40 mt-1">用于自动组队时每队的人数上限</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-white/80 mb-1.5">报名须知</label>
            <textarea
              v-model="settingsForm.registrationInfo"
              rows="4"
              placeholder="例如：请如实填写个人信息，报名截止后将无法修改..."
              class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90 resize-y"
            />
          </div>
        </div>

        <div class="flex justify-end mt-6 pt-4 border-t border-white/10">
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
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white flex items-center gap-2">
              <UIcon name="i-lucide-form-input" class="w-4 h-4 text-white/40" />
              自定义字段
              <span class="text-xs font-normal text-white/40">（报名表单中除默认字段外的额外字段）</span>
            </h2>
            <UButton
              size="xs"
              variant="soft"
              color="primary"
              icon="i-lucide-plus"
              @click="addField"
            >
              添加字段
            </UButton>
          </div>
        </template>

        <div v-if="customFields.length === 0" class="text-center py-10">
          <UIcon name="i-lucide-form-input" class="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p class="text-sm text-white/50 mb-4">暂无自定义字段，点击下方按钮添加</p>
          <UButton color="primary" variant="outline" icon="i-lucide-plus" @click="addField">添加字段</UButton>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(field, idx) in customFields"
            :key="idx"
            class="border border-white/10 rounded-lg p-4 bg-white/5"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-white/60 mb-1">字段名称</label>
                <input
                  v-model="field.fieldName"
                  type="text"
                  placeholder="例如：学校"
                  class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
                />
              </div>
              <div>
                <label class="block text-xs text-white/60 mb-1">字段 Key（英文标识）</label>
                <input
                  v-model="field.fieldKey"
                  type="text"
                  placeholder="例如：school"
                  class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90 font-mono"
                />
              </div>
              <div>
                <label class="block text-xs text-white/60 mb-1">字段类型</label>
                <select
                  v-model="field.fieldType"
                  class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
                >
                  <option value="text">单行文本</option>
                  <option value="textarea">多行文本</option>
                  <option value="select">下拉选择</option>
                  <option value="checkbox">复选框</option>
                  <option value="radio">单选框</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-white/60 mb-1">应用对象</label>
                <select
                  v-model="field.appliesTo"
                  class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
                >
                  <option value="both">个人 + 队伍</option>
                  <option value="individual">仅个人</option>
                  <option value="team">仅队伍</option>
                </select>
              </div>
              <div class="md:col-span-2" v-if="['select', 'radio', 'checkbox'].includes(field.fieldType)">
                <label class="block text-xs text-white/60 mb-1">选项（逗号分隔）</label>
                <input
                  v-model="field.fieldOptions"
                  type="text"
                  placeholder="例如：大一,大二,大三,大四"
                  class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90"
                />
              </div>
            </div>

            <div class="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
              <label class="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="field.required"
                  class="rounded border-white/20 text-blue-500 focus:ring-blue-500"
                />
                <span class="text-sm text-white/70">必填</span>
              </label>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="removeField(idx)"
              >
                删除
              </UButton>
            </div>
          </div>
        </div>

        <div v-if="customFields.length > 0" class="flex justify-end mt-6 pt-4 border-t border-white/10">
          <UButton
            color="primary"
            icon="i-lucide-save"
            :loading="savingFields"
            @click="saveFields"
          >
            保存字段
          </UButton>
        </div>
      </UCard>
    </template>
  </div>

  <div v-if="reviewModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="reviewModal = false">
    <div class="glass-modal rounded-xl shadow-lg w-full max-w-md p-6">
      <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <UIcon
          :name="reviewAction === 'approve' ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
          class="w-5 h-5"
          :class="reviewAction === 'approve' ? 'text-green-400' : 'text-red-400'"
        />
        {{ reviewAction === 'approve' ? '通过报名' : '拒绝报名' }}
      </h3>
      <p class="text-sm text-white/50 mb-4">请确认操作，可填写审核备注</p>

      <div v-if="reviewTarget" class="bg-white/5 rounded-lg p-3 mb-4 text-sm space-y-1">
        <p class="text-white/80"><span class="text-white/40">提交人：</span>{{ reviewTarget.submitterName }}</p>
        <p v-if="reviewTarget.teamName" class="text-white/80"><span class="text-white/40">队伍：</span>{{ reviewTarget.teamName }}</p>
        <p v-if="reviewTarget.contactPhone" class="text-white/80"><span class="text-white/40">电话：</span>{{ reviewTarget.contactPhone }}</p>
        <p v-if="reviewTarget.members?.length" class="text-white/80">
          <span class="text-white/40">成员：</span>{{ reviewTarget.members.map((m: any) => m.name).join('、') }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-white/80 mb-1.5">审核备注（选填）</label>
        <textarea
          v-model="reviewNote"
          rows="3"
          placeholder="可填写审核说明..."
          class="w-full px-3 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/5 text-white/90 resize-y"
        />
      </div>

      <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
        <UButton color="neutral" variant="ghost" @click="() => { reviewModal = false }">取消</UButton>
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

  <div v-if="showAutoMatch" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showAutoMatch = false">
    <div class="glass-modal rounded-xl shadow-lg w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <UIcon name="i-lucide-shuffle" class="w-5 h-5 text-amber-400" />
        自动组队结果
      </h3>
      <p class="text-sm text-white/50 mb-4">系统已根据个人报名自动匹配成队，确认后将创建为正式队伍</p>

      <div v-if="matchResult" class="space-y-4">
        <div>
          <p class="text-sm font-semibold text-white mb-2">
            建议队伍（{{ matchResult.teams.length }} 支）
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="(team, idx) in matchResult.teams"
              :key="idx"
              class="border border-white/10 rounded-lg p-3 bg-white/5"
            >
              <p class="text-sm font-semibold text-white mb-2">{{ team.suggestedName }}</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(m, mIdx) in team.members"
                  :key="mIdx"
                  class="px-2 py-0.5 text-xs text-white/70 bg-blue-500/15 rounded-full"
                >
                  {{ m.name || m.submitterName }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="matchResult.unmatched.length > 0">
          <p class="text-sm font-semibold text-amber-400 mb-2">
            未匹配（{{ matchResult.unmatched.length }} 人，不足一队）
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(m, idx) in matchResult.unmatched"
              :key="idx"
              class="px-2 py-0.5 text-xs text-white/70 bg-amber-500/15 rounded-full"
            >
              {{ m.name || m.submitterName }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
        <UButton color="neutral" variant="ghost" @click="() => { showAutoMatch = false }">取消</UButton>
        <UButton
          color="primary"
          icon="i-lucide-check"
          @click="handleConvert"
        >
          确认创建队伍
        </UButton>
      </div>
    </div>
  </div>

  <div v-if="showAccounts" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showAccounts = false">
    <div class="glass-modal rounded-xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <UIcon name="i-lucide-user-plus" class="w-5 h-5 text-green-400" />
        辩手账号创建结果
      </h3>
      <p class="text-sm text-white/50 mb-4" v-if="accountResult">
        共创建 {{ accountResult.created }} 个账号，请妥善保存账号密码并下发给辩手
      </p>

      <div v-if="accountResult?.accounts?.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-white/60 border-b border-white/10">
              <th class="py-2 px-2 font-medium">姓名</th>
              <th class="py-2 px-2 font-medium">用户名</th>
              <th class="py-2 px-2 font-medium">密码</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(acc, idx) in accountResult.accounts"
              :key="idx"
              class="border-b border-white/5 text-white/80"
            >
              <td class="py-2 px-2">{{ acc.name }}</td>
              <td class="py-2 px-2 font-mono">{{ acc.username }}</td>
              <td class="py-2 px-2 font-mono">{{ acc.password }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
        <UButton color="neutral" variant="ghost" icon="i-lucide-copy" @click="copyAccounts">复制全部</UButton>
        <UButton color="primary" variant="outline" icon="i-lucide-download" @click="downloadAccounts">下载 CSV</UButton>
        <UButton color="primary" @click="() => { showAccounts = false }">完成</UButton>
      </div>
    </div>
  </div>
  </template>
</template>

<style scoped>
</style>
