<!--
  ════════════════════════════════════════════════════
  登录页面 —— 严格限制多端登录
  - 检测到已有设备登录 → 弹出"不允许多端登录"对话框
  - 用户点击"继续登录" → 调用 confirm-login API 踢掉原设备
  - 用户点击"取消" → 关闭弹窗，不做操作
  ════════════════════════════════════════════════════
-->
<script setup lang="ts">
definePageMeta({ layout: false })

const { login, confirmLogin } = useAuth()
const route = useRoute()

// ── 登录表单状态 ──
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const kickedMessage = ref('')

// ── 多设备弹窗状态 ──
const showMultiDeviceDialog = ref(false)
const existingSessions = ref<any[]>([])
const newDevice = ref<any>(null)
const confirmLoading = ref(false)

// 检测是否从被踢下线跳转过来
if (route.query.reason === 'kicked') {
  kickedMessage.value = '您的账号已在其他设备登录，请重新登录'
}

/**
 * 提交登录表单
 */
async function handleLogin() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  try {
    const result = await login(username.value, password.value)

    // 检测到已有设备登录 → 弹出"不允许多端登录"对话框
    if (result.needConfirm) {
      existingSessions.value = result.existingSessions || []
      newDevice.value = result.newDevice || null
      showMultiDeviceDialog.value = true
    }
  } catch (e: any) {
    const statusMessage =
      e?.data?.statusMessage ||
      e?.data?.message ||
      e?.statusMessage ||
      e?.message ||
      ''
    error.value = statusMessage || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}

/**
 * 点击弹窗中的"继续登录" → 强制下线原设备，在当前设备登录
 */
async function handleForceLogin() {
  confirmLoading.value = true
  try {
    await confirmLogin(username.value, password.value)
    showMultiDeviceDialog.value = false
  } catch (e: any) {
    const statusMessage =
      e?.data?.statusMessage ||
      e?.data?.message ||
      e?.statusMessage ||
      e?.message ||
      ''
    error.value = statusMessage || '确认登录失败，请重试'
    showMultiDeviceDialog.value = false
  } finally {
    confirmLoading.value = false
  }
}

/**
 * 关闭多设备弹窗 → 不做任何操作
 */
function cancelMultiDevice() {
  if (!confirmLoading.value) {
    showMultiDeviceDialog.value = false
  }
}

/**
 * 格式化时间为本地友好格式
 */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <!-- 外层容器：不额外设置背景（body 已有深色渐变） -->
  <div class="min-h-screen flex items-center justify-center px-4">

    <!-- 登录卡片区域 -->
    <div class="w-full max-w-md">

      <!-- 玻璃拟态登录卡片 -->
      <div class="glass-card-strong p-6 sm:p-8">

        <!-- 顶部 Logo 与标题 -->
        <div class="text-center mb-6">
          <!-- 渐变圆角方块 Logo -->
          <div class="logo-icon mx-auto mb-4">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">辩境</h1>
          <p class="text-sm text-white/50 mt-1">辩论赛管理系统</p>
        </div>

        <!-- 分隔线 -->
        <div class="glass-divider my-5" />

        <!-- 登录表单 -->
        <form @submit.prevent="handleLogin" class="space-y-4">

          <!-- 被踢下线警告：黄色半透明背景 -->
          <div
            v-if="kickedMessage"
            class="p-3 rounded-lg bg-amber-500/15 border border-amber-400/20 text-sm text-amber-300 flex items-start gap-2"
          >
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{{ kickedMessage }}</span>
          </div>

          <!-- 用户名输入框 -->
          <div>
            <label class="block text-sm font-medium text-white/70 mb-1.5">
              用户名
            </label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              :disabled="loading"
              class="input-glass w-full"
              placeholder="请输入用户名"
            />
          </div>

          <!-- 密码输入框 -->
          <div>
            <label class="block text-sm font-medium text-white/70 mb-1.5">
              密码
            </label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :disabled="loading"
                class="input-glass w-full pr-10"
                placeholder="请输入密码"
              />
              <!-- 密码显示/隐藏按钮：白色半透明图标 -->
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 p-1 transition-colors"
                @click="showPassword = !showPassword"
                aria-label="切换密码显示"
              >
                <!-- 眼睛打开图标 -->
                <svg v-if="!showPassword" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <!-- 眼睛关闭图标 -->
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 错误提示：红色半透明背景 -->
          <div
            v-if="error"
            class="p-3 rounded-lg bg-red-500/15 border border-red-400/20 text-sm text-red-300"
          >
            {{ error }}
          </div>

          <!-- 登录按钮：渐变紫色主按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="btn-primary w-full py-2.5 px-4 text-sm font-medium rounded-xl flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
      </div>

      <!-- 底部提示文字：白色半透明 -->
      <p class="text-xs text-center text-white/30 mt-4">
        系统管理员账号：system-admin
      </p>
    </div>

    <!--
      ════════════════════════════════════════════════════
      "不允许多端登录" 独立弹窗（深色玻璃拟态风格）
      ════════════════════════════════════════════════════
    -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showMultiDeviceDialog"
          class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="multi-device-title"
        >
          <!-- 半透明遮罩层（点击可关闭） -->
          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
            @click.self="cancelMultiDevice"
            aria-hidden="true"
          />

          <!-- 弹窗内容（居中，玻璃拟态卡片） -->
          <Transition name="modal-content" appear>
            <div
              v-if="showMultiDeviceDialog"
              class="relative w-full max-w-lg glass-card-strong overflow-hidden"
            >
              <!-- 关闭按钮 -->
              <button
                type="button"
                class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                @click="cancelMultiDevice"
                :disabled="confirmLoading"
                aria-label="关闭"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <!-- 弹窗头部 -->
              <div class="px-6 py-4 border-b border-white/10 bg-white/5">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 id="multi-device-title" class="text-lg font-bold text-white">
                    不允许多端登录
                  </h2>
                </div>
              </div>

              <!-- 弹窗主体 -->
              <div class="p-6 space-y-4">
                <p class="text-white/70 text-sm leading-relaxed">
                  您的账号已在其他设备登录。若继续在此设备登录，将强制退出其他设备的登录状态。
                </p>

                <!-- 当前设备信息（新设备）：蓝色半透明背景 -->
                <div
                  v-if="newDevice"
                  class="p-3 rounded-lg bg-blue-500/15 border border-blue-400/20"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span class="text-sm font-medium text-blue-300">当前设备（此浏览器）</span>
                  </div>
                  <div class="text-sm text-white/60 pl-6 space-y-0.5">
                    <p><span class="text-white/40">设备：</span>{{ newDevice.deviceInfo }}</p>
                    <p v-if="newDevice.ipAddress"><span class="text-white/40">IP：</span>{{ newDevice.ipAddress }}</p>
                  </div>
                </div>

                <!-- 已有设备信息（原设备）：琥珀色半透明背景 -->
                <div
                  v-for="(session, idx) in existingSessions"
                  :key="session.id"
                  class="p-3 rounded-lg bg-amber-500/15 border border-amber-400/20"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span class="text-sm font-medium text-amber-300">
                      已登录设备 {{ existingSessions.length > 1 ? `#${idx + 1}` : '' }}
                    </span>
                  </div>
                  <div class="text-sm text-white/60 pl-6 space-y-0.5">
                    <p><span class="text-white/40">设备：</span>{{ session.deviceInfo }}</p>
                    <p v-if="session.ipAddress"><span class="text-white/40">IP：</span>{{ session.ipAddress }}</p>
                    <p><span class="text-white/40">登录时间：</span>{{ formatTime(session.loggedInAt) }}</p>
                  </div>
                </div>
              </div>

              <!-- 弹窗底部操作按钮 -->
              <div class="px-6 py-4 border-t border-white/10 bg-white/5 flex gap-3 justify-end">
                <!-- 取消按钮：幽灵按钮样式 -->
                <button
                  type="button"
                  class="btn-ghost px-4 py-2 text-sm font-medium rounded-xl"
                  :disabled="confirmLoading"
                  @click="cancelMultiDevice"
                >
                  取消
                </button>
                <!-- 继续登录按钮：主按钮样式（渐变紫色） -->
                <button
                  type="button"
                  class="btn-primary px-4 py-2 text-sm font-medium rounded-xl flex items-center gap-2"
                  :disabled="confirmLoading"
                  @click="handleForceLogin"
                >
                  <svg v-if="confirmLoading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {{ confirmLoading ? '处理中...' : '继续登录' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   玻璃拟态样式 —— 深色主题
   ════════════════════════════════════════ */

/* 玻璃卡片 —— 强效果（半透明白色背景 + 模糊 + 圆角 16px + 白色边框） */
.glass-card-strong {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* 玻璃输入框样式 */
.input-glass {
  padding: 0.625rem 0.75rem;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.input-glass::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.input-glass:focus {
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  background: rgba(255, 255, 255, 0.1);
}

.input-glass:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 主按钮样式 —— 渐变紫色 */
.btn-primary {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed, #6d28d9);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.35);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 幽灵按钮样式 —— 透明边框 */
.btn-ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.25);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 弹窗遮罩层样式 */
.modal-overlay {
  background: transparent; /* 遮罩已通过子元素实现 */
}

/* 玻璃分隔线 */
.glass-divider {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    rgba(255, 255, 255, 0.15),
    transparent
  );
}

/* Logo 图标 —— 渐变圆角方块 (48px) */
.logo-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #9333ea);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}

/* ════════════════════════════════════════
   弹窗动画
   ════════════════════════════════════════ */

/* 弹窗淡入淡出动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* 弹窗内容缩放动画 */
.modal-content-enter-active,
.modal-content-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.modal-content-enter-from,
.modal-content-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>
