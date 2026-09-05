<template>
  <div class="max-w-2xl mx-auto fade-in">
    <!-- 页头 -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-[var(--color-text-primary)]">账户设置</h1>
      <p class="text-[var(--color-text-secondary)] mt-2">管理你的个人信息和密码</p>
    </div>

    <!-- ══════════ 个人信息卡片 ══════════ -->
    <div class="glass-card p-6 mb-6">
      <h2
        class="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2"
      >
        <UIcon name="i-lucide-user-cog" class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        个人信息
      </h2>

      <!-- 头像预览 -->
      <div class="flex items-center gap-4 mb-6">
        <!-- 有头像 URL 时显示图片，否则显示用户名首字母 -->
        <div
          class="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shrink-0 ring-2 ring-white/20"
        >
          <img
            v-if="form.avatar"
            :src="form.avatar"
            :alt="form.username"
            class="w-full h-full object-cover"
            @error="onAvatarError"
          />
          <span v-else>{{ form.username?.charAt(0)?.toUpperCase() }}</span>
        </div>
        <div class="flex-1">
          <div class="text-sm text-[var(--color-text-muted)] mb-1">头像</div>
          <div class="text-xs text-[var(--color-text-muted)]">
            在下方「头像 URL」输入图片地址即可设置头像
          </div>
        </div>
      </div>

      <!-- 表单字段 -->
      <div class="space-y-5">
        <!-- 用户名 -->
        <div>
          <label class="dark-label"
            >用户名 <span class="text-red-500 dark:text-red-400">*</span></label
          >
          <input
            v-model="form.username"
            type="text"
            maxlength="30"
            placeholder="登录用户名"
            class="input-glass w-full"
          />
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            用于登录，修改后需使用新用户名登录
          </p>
        </div>

        <!-- 昵称 -->
        <div>
          <label class="dark-label">昵称</label>
          <input
            v-model="form.nickname"
            type="text"
            maxlength="30"
            placeholder="显示名称（可选）"
            class="input-glass w-full"
          />
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            展示用名称，不填则默认使用用户名
          </p>
        </div>

        <!-- 邮箱 -->
        <div>
          <label class="dark-label">邮箱</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="example@example.com"
            class="input-glass w-full"
          />
        </div>

        <!-- 头像 URL -->
        <div>
          <label class="dark-label">头像 URL</label>
          <input
            v-model="form.avatar"
            type="url"
            placeholder="https://example.com/avatar.png"
            class="input-glass w-full"
          />
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            输入图片地址，支持 JPG/PNG/GIF/WebP/SVG
          </p>
        </div>

        <!-- 行内错误提示 -->
        <p v-if="profileError" class="text-sm text-red-500 dark:text-red-400">{{ profileError }}</p>

        <!-- 保存按钮 -->
        <div class="flex items-center gap-3 pt-2">
          <button
            class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="savingProfile"
            @click="saveProfile"
          >
            <UIcon
              v-if="savingProfile"
              name="i-lucide-loader"
              class="w-4 h-4 mr-1.5 animate-spin inline"
            />
            <UIcon v-else name="i-lucide-save" class="w-4 h-4 mr-1.5 inline" />
            {{ savingProfile ? '保存中...' : '保存修改' }}
          </button>
          <button class="btn-ghost" :disabled="savingProfile" @click="resetForm">重置</button>
        </div>
      </div>
    </div>

    <!-- ══════════ 修改密码卡片 ══════════ -->
    <div class="glass-card p-6 mb-6">
      <h2
        class="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2"
      >
        <UIcon name="i-lucide-key" class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        修改密码
      </h2>

      <div class="space-y-5">
        <div>
          <label class="dark-label"
            >旧密码 <span class="text-red-500 dark:text-red-400">*</span></label
          >
          <input
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="当前密码"
            class="input-glass w-full"
          />
        </div>
        <div>
          <label class="dark-label"
            >新密码 <span class="text-red-500 dark:text-red-400">*</span></label
          >
          <input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="至少6位"
            class="input-glass w-full"
          />
        </div>
        <div>
          <label class="dark-label"
            >确认新密码 <span class="text-red-500 dark:text-red-400">*</span></label
          >
          <input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="再次输入新密码"
            class="input-glass w-full"
          />
        </div>

        <!-- 行内错误提示 -->
        <p v-if="passwordError" class="text-sm text-red-500 dark:text-red-400">
          {{ passwordError }}
        </p>

        <div class="pt-2">
          <button
            class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="savingPassword"
            @click="savePassword"
          >
            <UIcon
              v-if="savingPassword"
              name="i-lucide-loader"
              class="w-4 h-4 mr-1.5 animate-spin inline"
            />
            <UIcon v-else name="i-lucide-key-round" class="w-4 h-4 mr-1.5 inline" />
            {{ savingPassword ? '保存中...' : '修改密码' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════ 返回仪表盘 ══════════ -->
    <div class="flex justify-center">
      <NuxtLink to="/" class="btn-ghost flex items-center gap-2">
        <UIcon name="i-lucide-arrow-left" class="w-4 h-4" />
        返回仪表盘
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * settings.vue — 账户设置页
 * 支持修改：用户名、昵称、邮箱、头像 URL
 * 支持修改密码
 */
definePageMeta({
  // 使用默认布局（侧边栏）
})

const store = useAuthStore()
const { updateProfile, changePassword, logout } = useAuth()

// ── 个人信息表单 ──
const form = reactive({
  username: store.user?.username ?? '',
  nickname: store.user?.nickname ?? '',
  email: store.user?.email ?? '',
  avatar: store.user?.avatar ?? '',
})
const savingProfile = ref(false)
const profileError = ref('')

// ── 密码表单 ──
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const savingPassword = ref(false)
const passwordError = ref('')

// ── 头像加载失败处理 ──
function onAvatarError(e: Event) {
  // 图片加载失败时隐藏 img，显示首字母占位
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

// ── 保存个人信息 ──
async function saveProfile() {
  profileError.value = ''

  // 前端校验
  if (!form.username.trim()) {
    profileError.value = '用户名不能为空'
    return
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    profileError.value = '邮箱格式不正确'
    return
  }

  savingProfile.value = true
  try {
    await updateProfile({
      username: form.username.trim(),
      nickname: form.nickname.trim() || undefined,
      email: form.email.trim() || undefined,
      avatar: form.avatar.trim() || undefined,
    })
    // 成功提示
    showToast('个人信息已保存')
  } catch (e: any) {
    profileError.value = e?.data?.message || '保存失败，请重试'
  } finally {
    savingProfile.value = false
  }
}

// ── 重置表单为当前用户信息 ──
function resetForm() {
  form.username = store.user?.username ?? ''
  form.nickname = store.user?.nickname ?? ''
  form.email = store.user?.email ?? ''
  form.avatar = store.user?.avatar ?? ''
  profileError.value = ''
}

// ── 修改密码 ──
async function savePassword() {
  passwordError.value = ''

  if (!passwordForm.oldPassword) {
    passwordError.value = '请输入旧密码'
    return
  }
  if (passwordForm.newPassword.length < 6) {
    passwordError.value = '新密码长度至少6位'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  savingPassword.value = true
  try {
    await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    // 修改密码成功后会强制登出
    showToast('密码修改成功，请使用新密码重新登录')
    // 清空密码表单
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    // 延迟跳转登录页
    setTimeout(() => {
      logout()
    }, 1500)
  } catch (e: any) {
    passwordError.value = e?.data?.message || '修改密码失败'
  } finally {
    savingPassword.value = false
  }
}

// ── 简单 toast 提示（使用 Nuxt UI 的 useToast） ──
const toast = useToast()
function showToast(message: string) {
  toast.add({
    title: message,
    color: 'success' as const,
  })
}
</script>
