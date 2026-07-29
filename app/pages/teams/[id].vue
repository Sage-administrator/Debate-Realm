<script setup lang="ts">
// ════════════════════════════════════════════════════
// 团队详情页 —— 管理员/系统管理员可访问
// - 展示团队基本信息（名称、模式、赛事数、成员数）
// - 编辑团队信息（包括 QQ 频道模式的 Bot 配置）
// - 管理团队成员：编辑信息、重置密码、移除、批量清理子账号
// - 展示团队下的赛事列表
// ════════════════════════════════════════════════════
const route = useRoute()
const toast = useToast()
const store = useAuthStore()
const { getTeam, updateTeam, getMembers, updateMember, resetMemberPassword, deleteMember, cleanupMembers } = useTeam()

const team = ref<any>(null)
const members = ref<any[]>([])
const loading = ref(true)

const isAdmin = computed(() => store.user?.role === 'admin' || store.user?.role === 'system_admin')
const teamId = computed(() => route.params.id as string)

// 成员过多时的限制显示
const MEMBER_DISPLAY_LIMIT = 50
const showAllMembers = ref(false)
const displayedMembers = computed(() => {
  if (showAllMembers.value || members.value.length <= MEMBER_DISPLAY_LIMIT) {
    return members.value
  }
  return members.value.slice(0, MEMBER_DISPLAY_LIMIT)
})

// 编辑模式
const editMode = ref(false)
const editForm = reactive({ name: '', botAppId: '', botAppSecret: '', botChannelId: '' })

// 编辑成员信息
const showEditMember = ref(false)
const editingMember = ref<any>(null)
const editMemberForm = reactive({
  username: '',
  nickname: '',
  email: '',
  avatar: '',
})
const savingMember = ref(false)

// 重置密码
const showResetPassword = ref(false)
const resettingMember = ref<any>(null)
const resetPasswordForm = reactive({ newPassword: '', confirmPassword: '' })
const resettingPassword = ref(false)

// 清理中
const cleaningMember = ref(false)

// 角色中文标签
function roleCN(role: string) {
  const m: Record<string, string> = { admin: '管理员', subaccount: '子账号', system_admin: '系统管理员', individual: '个人' }
  return m[role] || role
}

function roleColor(role: string): 'primary' | 'neutral' | 'info' | 'error' {
  const m: Record<string, 'primary' | 'neutral' | 'info' | 'error'> = { admin: 'primary', subaccount: 'info', system_admin: 'error', individual: 'neutral' }
  return m[role] || 'neutral'
}

// 显示名：优先昵称，回退用户名
function memberDisplayName(m: any): string {
  return m.nickname || m.username
}

async function loadTeam() {
  // 并发加载团队信息和成员列表，并初始化编辑表单（含 Bot 配置）
  loading.value = true
  try {
    const [teamData, membersData] = await Promise.all([
      getTeam(teamId.value),
      getMembers(teamId.value),
    ])
    team.value = teamData
    members.value = membersData
    // 初始化编辑表单
    editForm.name = teamData.name
    editForm.botAppId = teamData.botConfig?.botAppId ?? ''
    editForm.botAppSecret = ''
    editForm.botChannelId = teamData.botConfig?.botChannelId ?? ''
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function handleUpdateTeam() {
  try {
    await updateTeam(teamId.value, {
      name: editForm.name,
      botAppId: editForm.botAppId || null,
      botAppSecret: editForm.botAppSecret || null,
      botChannelId: editForm.botChannelId || null,
    })
    toast.add({ title: '更新成功', color: 'success' })
    editMode.value = false
    loadTeam()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '更新失败', color: 'error' })
  }
}

async function handleDeleteMember(userId: string, username: string) {
  if (!confirm(`确定要删除子账号「${username}」吗？`)) return
  try {
    await deleteMember(teamId.value, userId)
    toast.add({ title: '子账号已删除', color: 'success' })
    loadTeam()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '删除失败', color: 'error' })
  }
}

// 打开成员编辑弹窗：填充该成员当前的字段值
function openEditMember(m: any) {
  editingMember.value = m
  editMemberForm.username = m.username || ''
  editMemberForm.nickname = m.nickname || ''
  editMemberForm.email = m.email || ''
  editMemberForm.avatar = m.avatar || ''
  showEditMember.value = true
}

// 提交成员信息更新
async function handleUpdateMember() {
  if (!editingMember.value) return
  // 用户名必填校验
  if (!editMemberForm.username.trim()) {
    toast.add({ title: '用户名不能为空', color: 'error' })
    return
  }
  savingMember.value = true
  try {
    await updateMember(teamId.value, editingMember.value.userId, {
      username: editMemberForm.username.trim(),
      nickname: editMemberForm.nickname.trim() || null,
      email: editMemberForm.email.trim() || null,
      avatar: editMemberForm.avatar.trim() || null,
    })
    toast.add({ title: '成员信息已更新', color: 'success' })
    showEditMember.value = false
    editingMember.value = null
    loadTeam()
  } catch (e: any) {
    toast.add({ title: e?.data?.message || e.statusMessage || '更新失败', color: 'error' })
  } finally {
    savingMember.value = false
  }
}

// 打开重置密码弹窗
function openResetPassword(m: any) {
  resettingMember.value = m
  resetPasswordForm.newPassword = ''
  resetPasswordForm.confirmPassword = ''
  showResetPassword.value = true
}

// 提交重置密码
async function handleResetPassword() {
  if (!resettingMember.value) return
  if (!resetPasswordForm.newPassword) {
    toast.add({ title: '请输入新密码', color: 'error' })
    return
  }
  if (resetPasswordForm.newPassword.length < 6) {
    toast.add({ title: '密码长度至少6位', color: 'error' })
    return
  }
  if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
    toast.add({ title: '两次输入的密码不一致', color: 'error' })
    return
  }
  resettingPassword.value = true
  try {
    const res = await resetMemberPassword(
      teamId.value,
      resettingMember.value.userId,
      resetPasswordForm.newPassword,
    )
    toast.add({ title: res.message || '密码重置成功', color: 'success' })
    showResetPassword.value = false
    resettingMember.value = null
  } catch (e: any) {
    toast.add({ title: e?.data?.message || e.statusMessage || '重置失败', color: 'error' })
  } finally {
    resettingPassword.value = false
  }
}

// 清理所有子账号
async function handleCleanupMembers() {
  // 危险操作：批量删除团队下所有子账号及其数据，二次确认后执行
  if (!confirm(`⚠️ 确定要删除该团队的所有子账号吗？（共 ${members.value.filter((m: any) => m.role === 'subaccount').length} 个）\n\n此操作将删除所有子账号用户及其数据，不可撤销！`)) return
  cleaningMember.value = true
  try {
    const result = await cleanupMembers(teamId.value)
    toast.add({ title: `清理完成：${result.message}`, color: 'success' })
    loadTeam()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '清理失败', color: 'error' })
  } finally {
    cleaningMember.value = false
  }
}

onMounted(() => loadTeam())
</script>

<template>
  <!-- 最外层容器 -->
  <div class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
    </div>

    <template v-else-if="team">
      <!-- 团队基本信息 -->
      <div class="flex items-start justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">{{ team.name }}</h1>
          <div class="flex items-center gap-2 mt-2">
            <UBadge :label="team.mode === 'qq_bot' ? 'QQ频道' : '普通团队'" :color="team.mode === 'qq_bot' ? 'primary' : 'neutral'" size="sm" variant="soft" />
            <span class="text-sm text-[var(--color-text-muted)]">{{ team.tournaments?.length ?? 0 }} 个赛事 · {{ team.memberCount ?? 0 }} 个成员</span>
            <!-- 成员数量过多警告 -->
            <UBadge v-if="(team.memberCount ?? 0) > 100" color="warning" size="xs" variant="solid">
              成员过多
            </UBadge>
          </div>
        </div>
        <UButton v-if="isAdmin" color="neutral" variant="outline" size="sm" @click="() => { editMode = !editMode }">
          {{ editMode ? '取消编辑' : '编辑信息' }}
        </UButton>
      </div>

      <!-- 编辑团队信息 -->
      <div v-if="editMode" class="glass-card p-6 mb-6">
        <div class="space-y-4">
          <UFormField label="团队名称" required>
            <UInput v-model="editForm.name" />
          </UFormField>
          <template v-if="team.mode === 'qq_bot'">
            <UFormField label="Bot App ID">
              <UInput v-model="editForm.botAppId" placeholder="QQ机器人 App ID" />
            </UFormField>
            <UFormField label="Bot App Secret">
              <UInput v-model="editForm.botAppSecret" type="password" placeholder="输入新密钥" />
            </UFormField>
            <UFormField label="频道 ID">
              <UInput v-model="editForm.botChannelId" placeholder="QQ频道 ID" />
            </UFormField>
          </template>
          <UButton color="primary" @click="handleUpdateTeam">保存修改</UButton>
        </div>
      </div>

      <!-- 团队信息展示 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- 团队成员 -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-[var(--color-text-primary)]">团队成员</h2>
            <div class="flex gap-2">
              <!-- 成员过多时显示清理按钮 -->
              <UButton
                v-if="isAdmin && members.filter((m: any) => m.role === 'subaccount').length > 0"
                color="warning"
                variant="ghost"
                size="xs"
                :loading="cleaningMember"
                @click="handleCleanupMembers"
              >
                清理子账号
              </UButton>
            </div>
          </div>

          <div v-if="members.length === 0" class="text-center py-4 text-[var(--color-text-muted)]">暂无成员</div>
          <div v-else class="divide-y divide-white/10">
            <div v-for="m in displayedMembers" :key="m.id" class="flex items-center justify-between py-2 gap-3">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <!-- 头像：有 URL 时显示图片，否则显示首字母 -->
                <div class="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden border border-[var(--color-border)]">
                  <img
                    v-if="m.avatar"
                    :src="m.avatar"
                    :alt="memberDisplayName(m)"
                    class="w-full h-full object-cover"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <span v-else class="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    {{ memberDisplayName(m).charAt(0).toUpperCase() }}
                  </span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm text-[var(--color-text-primary)] truncate">{{ memberDisplayName(m) }}</span>
                    <!-- 昵称与用户名不同时显示用户名（@xxx） -->
                    <span v-if="m.nickname && m.nickname !== m.username" class="text-xs text-[var(--color-text-muted)] truncate">
                      @{{ m.username }}
                    </span>
                  </div>
                  <div class="text-xs text-[var(--color-text-muted)] flex items-center gap-1 flex-wrap">
                    <UBadge :label="roleCN(m.role)" :color="roleColor(m.role)" size="xs" variant="soft" />
                    <span v-if="m.email">· {{ m.email }}</span>
                    <span v-if="m.assignedMatches?.length">
                      · 分配 {{ m.assignedMatches.length }} 场
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex gap-1 flex-shrink-0">
                <!-- 重置密码（仅管理员可见，不可重置自己） -->
                <UButton
                  v-if="isAdmin && m.userId !== store.user?.id"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-key"
                  @click="openResetPassword(m)"
                >
                  重置密码
                </UButton>
                <!-- 编辑成员信息（仅管理员可见） -->
                <UButton
                  v-if="isAdmin"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-pencil"
                  @click="openEditMember(m)"
                >
                  编辑
                </UButton>
                <UButton
                  v-if="isAdmin && m.role !== 'admin'"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="handleDeleteMember(m.userId, m.username)"
                >
                  移除
                </UButton>
              </div>
            </div>
            <!-- 成员过多时显示展开按钮 -->
            <div v-if="members.length > MEMBER_DISPLAY_LIMIT && !showAllMembers" class="text-center py-3">
              <UButton color="neutral" variant="ghost" size="xs" @click="() => { showAllMembers = true }">
                展开全部 {{ members.length }} 个成员...
              </UButton>
            </div>
          </div>
        </div>

        <!-- 赛事列表 -->
        <div class="glass-card p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-[var(--color-text-primary)]">赛事列表</h2>
          </div>
          <div v-if="!team.tournaments?.length" class="text-center py-4 text-[var(--color-text-muted)]">
            暂无赛事
          </div>
          <div v-else class="divide-y divide-white/10">
            <div v-for="t in team.tournaments" :key="t.id" class="flex items-center justify-between py-2">
              <div>
                <div class="font-medium text-sm text-[var(--color-text-primary)]">{{ t.name }}</div>
              </div>
              <UBadge :label="t.status" size="xs" variant="soft" />
            </div>
          </div>
        </div>
      </div>

      <!-- 编辑成员信息弹窗：修改用户名/昵称/邮箱/头像 URL -->
      <UModal v-model:open="showEditMember" :title="editingMember ? `编辑成员 - ${memberDisplayName(editingMember)}` : '编辑成员'">
        <template #body>
          <div class="space-y-4">
            <!-- 头像预览 -->
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden border border-[var(--color-border)]">
                <img
                  v-if="editMemberForm.avatar"
                  :src="editMemberForm.avatar"
                  alt="头像预览"
                  class="w-full h-full object-cover"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span v-else class="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                  {{ (editMemberForm.nickname || editMemberForm.username).charAt(0).toUpperCase() }}
                </span>
              </div>
              <div class="text-xs text-[var(--color-text-muted)]">
                填写图片 URL 作为头像，留空显示首字母
              </div>
            </div>
            <UFormField label="头像 URL" hint="支持任意图片链接">
              <UInput v-model="editMemberForm.avatar" placeholder="https://..." />
            </UFormField>
            <UFormField label="用户名" required hint="登录账号，唯一">
              <UInput v-model="editMemberForm.username" placeholder="登录用户名" />
            </UFormField>
            <UFormField label="昵称" hint="展示用名，留空回退到用户名">
              <UInput v-model="editMemberForm.nickname" placeholder="如：张三" />
            </UFormField>
            <UFormField label="邮箱" hint="可留空">
              <UInput v-model="editMemberForm.email" type="email" placeholder="user@example.com" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="() => { showEditMember = false }">取消</UButton>
            <UButton color="primary" :loading="savingMember" @click="handleUpdateMember">保存</UButton>
          </div>
        </template>
      </UModal>

      <!-- 重置成员密码弹窗 -->
      <UModal v-model:open="showResetPassword" :title="resettingMember ? `重置密码 - ${memberDisplayName(resettingMember)}` : '重置密码'">
        <template #body>
          <div class="space-y-4">
            <p class="text-sm text-[var(--color-text-secondary)]">
              重置后该成员将被强制退出登录，需使用新密码重新登录。
            </p>
            <UFormField label="新密码" required hint="至少6位">
              <UInput v-model="resetPasswordForm.newPassword" type="password" placeholder="请输入新密码" />
            </UFormField>
            <UFormField label="确认新密码" required>
              <UInput v-model="resetPasswordForm.confirmPassword" type="password" placeholder="再次输入新密码" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="() => { showResetPassword = false }">取消</UButton>
            <UButton color="primary" :loading="resettingPassword" @click="handleResetPassword">确认重置</UButton>
          </div>
        </template>
      </UModal>
    </template>

    <div v-else class="text-center py-12 text-[var(--color-text-muted)]">
      团队不存在或已被删除
    </div>
  </div>
  </div>
</template>
