<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { login } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''

  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  try {
    await login(username.value, password.value)
    router.push('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">辩论计时器</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">登录以继续使用</p>
        </div>
      </template>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <UFormField label="用户名" required>
          <UInput
            v-model="username"
            placeholder="请输入用户名"
            size="lg"
            autocomplete="username"
            :disabled="loading"
          />
        </UFormField>

        <UFormField label="密码" required>
          <UInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            size="lg"
            autocomplete="current-password"
            :disabled="loading"
            :ui="{ trailing: 'pr-0.5' }"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :pressed="showPassword"
                aria-label="切换密码显示"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          class="text-sm"
        />

        <UButton
          type="submit"
          color="primary"
          size="lg"
          block
          :loading="loading"
        >
          {{ loading ? '登录中...' : '登录' }}
        </UButton>
      </form>

      <template #footer>
        <p class="text-xs text-center text-gray-400">
          系统管理员账号：system-admin
        </p>
      </template>
    </UCard>
  </div>
</template>
