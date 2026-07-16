<script setup lang="ts">
// ════════════════════════════════════════════════════
// 个人团队详情页 —— 仅系统管理员可访问
// - 展示系统中所有「个人模式」用户列表
// - 显示每个个人用户的独立赛事和比赛场次统计
// - 支持重置个人用户密码、删除个人用户
// ════════════════════════════════════════════════════
const store = useAuthStore()
const toast = useToast()
const router = useRouter()
const { getIndividualUsers, deleteUser, resetUserPassword } = useTeam()

// 数据
const individualUsers = ref<any[]>([])
const loading = ref(true)

// 重置密码弹窗
const showResetPasswordModal = ref(false)
const selectedUserId = ref('')
const selectedUsername = ref('')
const newPassword = ref('')

// 检查权限：只有系统管理员可以访问此页面
const isSystemAdmin = computed(() => store.user?.role === 'system_admin')

async function loadData() {
  loading.value = true
  try {
    individualUsers.value = await getIndividualUsers()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

function openResetPassword(userId: string, username: string) {
  selectedUserId.value = userId
  selectedUsername.value = username
  newPassword.value = ''
  showResetPasswordModal.value = true
}

async function handleResetPassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    toast.add({ title: '密码至少6位', color: 'warning' })
    return
  }
  try {
    await resetUserPassword(selectedUserId.value, newPassword.value)
    toast.add({ title: '密码已重置', color: 'success' })
    showResetPasswordModal.value = false
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '重置失败', color: 'error' })
  }
}

async function handleDeleteUser(userId: string, username: string) {
  if (!confirm(`确定要删除个人用户「${username}」吗？此操作不可撤销。`)) return
  try {
    await deleteUser(userId)
    toast.add({ title: '用户已删除', color: 'success' })
    loadData()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '删除失败', color: 'error' })
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

onMounted(() => {
  if (!isSystemAdmin.value) {
    toast.add({ title: '无权限访问', color: 'error' })
    router.push('/')
    return
  }
  loadData()
})
</script>

<template>
  <!-- 最外层容器 -->
  <div v-if="isSystemAdmin" class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
    <!-- 页面头部 -->
    <div class="mb-8">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors text-[var(--color-text-secondary)]">
          <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">个人团队详情</h1>
          <p class="text-[var(--color-text-muted)] mt-1">管理系统中的所有个人用户及其独立赛事</p>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto text-indigo-400" />
      <p class="text-[var(--color-text-muted)] mt-2">加载中...</p>
    </div>

    <template v-else>
      <!-- 统计卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="glass-card-strong p-6 text-center">
          <div class="text-2xl font-bold text-indigo-400">{{ individualUsers.length }}</div>
          <div class="text-sm text-[var(--color-text-muted)]">个人用户总数</div>
        </div>
        <div class="glass-card-strong p-6 text-center">
          <div class="text-2xl font-bold text-indigo-400">
            {{ individualUsers.reduce((sum, u) => sum + u.standaloneMatchCount, 0) }}
          </div>
          <div class="text-sm text-[var(--color-text-muted)]">独立赛事总数</div>
        </div>
        <div class="glass-card-strong p-6 text-center">
          <div class="text-2xl font-bold text-indigo-400">
            {{ individualUsers.reduce((sum, u) => sum + u.standaloneMatches.reduce((s: number, m: any) => s + m.matchCount, 0), 0) }}
          </div>
          <div class="text-sm text-[var(--color-text-muted)]">比赛场次总数</div>
        </div>
      </div>

      <!-- 个人用户列表 -->
      <div class="glass-card p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-[var(--color-text-primary)]">个人用户列表</h2>
          <span class="text-sm text-[var(--color-text-muted)]">共 {{ individualUsers.length }} 位个人用户</span>
        </div>

        <div v-if="individualUsers.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
          暂无个人用户
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="user in individualUsers"
            :key="user.id"
            class="border border-[var(--color-border)] rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {{ user.username.charAt(0) }}
                </div>
                <div>
                  <div class="font-medium text-[var(--color-text-primary)]">{{ user.username }}</div>
                  <div class="text-sm text-[var(--color-text-muted)]">注册于 {{ formatDate(user.createdAt) }}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UButton color="neutral" variant="ghost" size="xs" @click="openResetPassword(user.id, user.username)">重置密码</UButton>
                <UButton color="error" variant="ghost" size="xs" @click="handleDeleteUser(user.id, user.username)">删除</UButton>
              </div>
            </div>

            <!-- 用户的独立赛事列表 -->
            <div v-if="user.standaloneMatches.length > 0" class="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div class="text-sm font-medium text-[var(--color-text-primary)] mb-2">独立赛事（{{ user.standaloneMatchCount }} 个）</div>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="match in user.standaloneMatches"
                  :key="match.id"
                  class="px-3 py-1.5 bg-[var(--color-bg-secondary)] rounded-lg text-sm"
                >
                  <span class="font-medium text-[var(--color-text-primary)]">{{ match.name }}</span>
                  <span class="text-[var(--color-text-muted)] ml-2">
                    <UBadge :label="({ pending: '待开始', running: '进行中', finished: '已完成' } as Record<string,string>)[match.status] || match.status"
                      :color="(({ pending: 'neutral', running: 'primary', finished: 'success' } as Record<string,string>)[match.status] || 'neutral') as any"
                      size="xs" variant="soft" />
                  </span>
                  <span class="text-[var(--color-text-muted)] ml-1">({{ match.matchCount }}场)</span>
                </div>
              </div>
            </div>

            <div v-else class="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div class="text-sm text-[var(--color-text-muted)]">暂无独立赛事</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 提示信息 -->
      <UAlert color="info" variant="soft" title="关于个人团队"
        description="个人团队是系统中的虚拟团队，包含所有注册为个人模式的用户。这些用户可以创建和管理自己的独立赛事，不受团队限制。" />
    </template>
  </div>
  </div>

  <!-- 重置密码弹窗 -->
  <UModal v-model:open="showResetPasswordModal" :title="`重置 ${selectedUsername} 的密码`">
    <template #body>
      <UFormField label="新密码" required>
        <UInput v-model="newPassword" type="password" placeholder="至少6位" />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="() => { showResetPasswordModal = false }">取消</UButton>
        <UButton color="primary" @click="handleResetPassword">确认重置</UButton>
      </div>
    </template>
  </UModal>
</template>
