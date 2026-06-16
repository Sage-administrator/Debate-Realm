<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const store = useAuthStore()
const { getTeam, updateTeam, getTeamMembers, addTeamMember, deleteTeamMember, cleanupTeamMembers } = useTeam()

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

// 添加子账号
const showAddMember = ref(false)
const memberForm = reactive({ username: '', password: '' })

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

async function loadTeam() {
  loading.value = true
  try {
    const [teamData, membersData] = await Promise.all([
      getTeam(teamId.value),
      getTeamMembers(teamId.value),
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

async function handleAddMember() {
  try {
    await addTeamMember(teamId.value, memberForm.username, memberForm.password)
    toast.add({ title: '子账号添加成功', color: 'success' })
    showAddMember.value = false
    memberForm.username = ''
    memberForm.password = ''
    loadTeam()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '添加失败', color: 'error' })
  }
}

async function handleDeleteMember(userId: string, username: string) {
  if (!confirm(`确定要删除子账号「${username}」吗？`)) return
  try {
    await deleteTeamMember(teamId.value, userId)
    toast.add({ title: '子账号已删除', color: 'success' })
    loadTeam()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '删除失败', color: 'error' })
  }
}

// 清理所有子账号
async function handleCleanupMembers() {
  if (!confirm(`⚠️ 确定要删除该团队的所有子账号吗？（共 ${members.value.filter((m: any) => m.role === 'subaccount').length} 个）\n\n此操作将删除所有子账号用户及其数据，不可撤销！`)) return
  cleaningMember.value = true
  try {
    const result = await cleanupTeamMembers(teamId.value)
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
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto" />
    </div>

    <template v-else-if="team">
      <!-- 团队基本信息 -->
      <div class="flex items-start justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold">{{ team.name }}</h1>
          <div class="flex items-center gap-2 mt-2">
            <UBadge :label="team.mode === 'qq_bot' ? 'QQ频道' : '普通团队'" :color="team.mode === 'qq_bot' ? 'primary' : 'neutral'" size="sm" variant="soft" />
            <span class="text-sm text-gray-500">{{ team.tournaments?.length ?? 0 }} 个赛事 · {{ team.memberCount ?? 0 }} 个成员</span>
            <!-- 成员数量过多警告 -->
            <UBadge v-if="(team.memberCount ?? 0) > 100" color="warning" size="xs" variant="solid">
              成员过多
            </UBadge>
          </div>
        </div>
        <UButton v-if="isAdmin" color="neutral" variant="outline" size="sm" @click="editMode = !editMode">
          {{ editMode ? '取消编辑' : '编辑信息' }}
        </UButton>
      </div>

      <!-- 编辑团队信息 -->
      <UCard v-if="editMode" class="mb-6">
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
      </UCard>

      <!-- 团队信息展示 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- 团队成员 -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-bold">团队成员</h2>
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
                <UButton v-if="isAdmin" color="primary" size="xs" @click="showAddMember = true">
                  添加子账号
                </UButton>
              </div>
            </div>
          </template>

          <div v-if="members.length === 0" class="text-center py-4 text-gray-400">暂无成员</div>
          <div v-else class="divide-y">
            <div v-for="m in displayedMembers" :key="m.id" class="flex items-center justify-between py-2">
              <div>
                <div class="font-medium text-sm">{{ m.username }}</div>
                <div class="text-xs text-gray-500">
                  <UBadge :label="roleCN(m.role)" :color="roleColor(m.role)" size="xs" variant="soft" />
                  <span v-if="m.assignedMatches?.length">
                    · 分配 {{ m.assignedMatches.length }} 场
                  </span>
                </div>
              </div>
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
            <!-- 成员过多时显示展开按钮 -->
            <div v-if="members.length > MEMBER_DISPLAY_LIMIT && !showAllMembers" class="text-center py-3">
              <UButton color="neutral" variant="ghost" size="xs" @click="showAllMembers = true">
                展开全部 {{ members.length }} 个成员...
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- 赛事列表 -->
        <UCard>
          <template #header>
            <h2 class="font-bold">赛事列表</h2>
          </template>
          <div v-if="!team.tournaments?.length" class="text-center py-4 text-gray-400">
            暂无赛事
          </div>
          <div v-else class="divide-y">
            <div v-for="t in team.tournaments" :key="t.id" class="flex items-center justify-between py-2">
              <div>
                <div class="font-medium text-sm">{{ t.name }}</div>
              </div>
              <UBadge :label="t.status" size="xs" variant="soft" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- 添加子账号弹窗 -->
      <UModal v-model:open="showAddMember" title="添加子账号">
        <template #body>
          <div class="space-y-4">
            <UFormField label="用户名" required>
              <UInput v-model="memberForm.username" placeholder="如：辩论社-001" />
            </UFormField>
            <UFormField label="密码" required>
              <UInput v-model="memberForm.password" type="password" placeholder="至少6位" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showAddMember = false">取消</UButton>
            <UButton color="primary" @click="handleAddMember">添加</UButton>
          </div>
        </template>
      </UModal>
    </template>

    <div v-else class="text-center py-12 text-gray-400">
      团队不存在或已被删除
    </div>
  </div>
</template>
