<script setup lang="ts">
// ════════════════════════════════════════════════════
// MultiDeviceAlert — 多设备登录检测标准模态对话框
// - 半透明背景遮罩层
// - 多种关闭方式（关闭按钮 / 点击遮罩 / ESC 键）
// - 视口居中定位
// - 打开时锁定背景滚动
// - 平滑过渡动画（淡入淡出 + 缩放）
// - 响应式适配（移动端全宽 / 桌面端固定宽度）
// ════════════════════════════════════════════════════

import type { ExistingSessionInfo } from '~/composables/useAuth'

// ─── 状态管理 ───
const open = ref(false)                  // 弹窗是否显示
const otherSessions = ref<ExistingSessionInfo[]>([])  // 其他设备的会话列表
const currentSession = ref<ExistingSessionInfo | null>(null)  // 当前设备的会话信息
const terminating = ref(false)            // 操作中状态（强制下线进行中）
const toast = useToast()                 // 通知提示工具

// ─── 暴露给父组件的 API ───
function show(sessions: ExistingSessionInfo[], current: ExistingSessionInfo | null) {
  otherSessions.value = sessions
  currentSession.value = current
  openModal()
}

function dismiss() {
  closeModal()
}

defineExpose({ show, dismiss })

// ─── 模态打开 / 关闭 ───
function openModal() {
  open.value = true
  lockBodyScroll()
}

function closeModal() {
  open.value = false
  unlockBodyScroll()
}

// ─── 背景滚动锁定 ───
let savedBodyOverflow = ''

function lockBodyScroll() {
  if (import.meta.client) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockBodyScroll() {
  if (import.meta.client) {
    document.body.style.overflow = savedBodyOverflow || ''
  }
}

// ─── ESC 键关闭 ───
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    closeModal()
  }
}

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', handleKeydown)
    // 确保组件卸载时恢复滚动
    if (open.value) unlockBodyScroll()
  }
})

// ─── 工具函数：时间格式化 ───
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

// ─── 强制下线其他设备 ───
async function handleTerminateOthers() {
  terminating.value = true
  try {
    // 直接调用 API 强制终止其他会话
    const result = await $fetch<{ message?: string }>('/api/auth/terminate-sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore().token}` },
    })
    toast.add({
      title: '操作成功',
      description: result.message || '已强制下线其他设备',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    closeModal()
    otherSessions.value = []
  } catch (e: any) {
    const msg = e?.data?.statusMessage || '操作失败，请稍后重试'
    toast.add({
      title: '操作失败',
      description: msg,
      color: 'error',
      icon: 'i-lucide-x-circle',
    })
  } finally {
    terminating.value = false
  }
}
</script>

<template>
  <!--
    标准模态对话框结构：
    1. Teleport 到 body 末尾 → 避免被父元素样式/溢出影响
    2. v-if 确保关闭时从 DOM 移除，不残留
    3. 双层结构：遮罩层 + 对话框内容
  -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <!-- 半透明背景遮罩层：点击可关闭 -->
        <div
          class="modal-backdrop"
          @click.self="closeModal"
          aria-hidden="true"
        />

        <!-- 对话框内容容器：居中定位 + 过渡动画 -->
        <div class="modal-container">
          <Transition name="modal-content" appear>
            <div
              v-if="open"
              class="modal-dialog"
              role="document"
              @click.stop
            >
              <!-- 关闭按钮（右上角 X） -->
              <button
                type="button"
                class="modal-close-btn"
                @click="closeModal"
                aria-label="关闭弹窗"
              >
                <UIcon name="i-lucide-x" class="w-5 h-5" />
              </button>

              <!-- 弹窗头部：标题 + 警示图标 -->
              <div class="modal-header">
                <div class="flex items-center gap-2">
                  <UIcon
                    name="i-lucide-shield-alert"
                    class="w-5 h-5 text-amber-500"
                  />
                  <h3 id="modal-title" class="modal-title">
                    多设备登录检测
                  </h3>
                </div>
              </div>

              <!-- 弹窗主体内容 -->
              <div class="modal-body">
                <!-- 顶部警示说明 -->
                <div class="flex items-start gap-3 mb-4">
                  <UIcon
                    name="i-lucide-monitor-smartphone"
                    class="w-10 h-10 text-amber-500 flex-shrink-0 mt-1"
                  />
                  <div class="flex-1">
                    <p class="font-medium text-[var(--color-text-primary)]">
                      检测到您的账号同时在其他设备登录
                    </p>
                    <p
                      id="modal-description"
                      class="text-sm text-[var(--color-text-muted)] mt-1"
                    >
                      以下是其他设备的登录信息。您可以选择忽略，或强制下线其他设备以保障账号安全。
                    </p>
                  </div>
                </div>

                <!-- 当前设备信息（绿色标识） -->
                <div
                  v-if="currentSession"
                  class="session-card session-card-current"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon
                      name="i-lucide-check-circle-2"
                      class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                    />
                    <span class="session-card-label session-card-label-current">
                      当前设备
                    </span>
                  </div>
                  <div class="text-sm text-[var(--color-text-secondary)] pl-6 space-y-0.5">
                    <p>
                      <span class="text-[var(--color-text-muted)]">设备：</span>
                      {{ currentSession.deviceInfo }}
                    </p>
                    <p v-if="currentSession.ipAddress">
                      <span class="text-[var(--color-text-muted)]">IP：</span>
                      {{ currentSession.ipAddress }}
                    </p>
                    <p>
                      <span class="text-[var(--color-text-muted)]">登录时间：</span>
                      {{ formatTime(currentSession.loggedInAt) }}
                    </p>
                  </div>
                </div>

                <!-- 其他设备列表（黄色标识） -->
                <div
                  v-for="session in otherSessions"
                  :key="session.id"
                  class="session-card session-card-other"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon
                      name="i-lucide-alert-circle"
                      class="w-4 h-4 text-amber-600 dark:text-amber-400"
                    />
                    <span class="session-card-label session-card-label-other">
                      其他设备
                    </span>
                  </div>
                  <div class="text-sm text-[var(--color-text-secondary)] pl-6 space-y-0.5">
                    <p>
                      <span class="text-[var(--color-text-muted)]">设备：</span>
                      {{ session.deviceInfo }}
                    </p>
                    <p v-if="session.ipAddress">
                      <span class="text-[var(--color-text-muted)]">IP：</span>
                      {{ session.ipAddress }}
                    </p>
                    <p>
                      <span class="text-[var(--color-text-muted)]">登录时间：</span>
                      {{ formatTime(session.loggedInAt) }}
                    </p>
                    <p>
                      <span class="text-[var(--color-text-muted)]">最后活跃：</span>
                      {{ formatTime(session.lastSeenAt || '') }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- 弹窗底部：操作按钮 -->
              <div class="modal-footer">
                <button
                  type="button"
                  class="btn btn-outline"
                  :disabled="terminating"
                  @click="closeModal"
                >
                  允许登录（忽略）
                </button>

                <button
                  type="button"
                  class="btn btn-danger"
                  :disabled="terminating"
                  @click="handleTerminateOthers"
                >
                  <span
                    v-if="terminating"
                    class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2"
                  />
                  {{ terminating ? '处理中...' : '强制下线其他设备' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ─────────────────────────────────────────────
   模态对话框样式
   目标：标准、专业、响应式、流畅动画
   ───────────────────────────────────────────── */

/* 根容器：覆盖整个视口 */
.modal-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  isolation: isolate;
}

/* 半透明背景遮罩层 */
.modal-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

/* 对话框内容容器：flex 实现完美居中 */
.modal-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

/* 对话框主体 */
.modal-dialog {
  position: relative;
  width: 100%;
  max-width: 540px;
  max-height: calc(100vh - 2rem);
  background-color: rgba(30, 30, 62, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 0.75rem;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.3),
    0 10px 10px -5px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 暗色模式适配（已默认深色，此块可保留做额外调整） */
@media (prefers-color-scheme: dark) {
  .modal-dialog {
    background-color: rgba(30, 30, 62, 0.95);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.5),
      0 10px 10px -5px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.08);
  }
}

/* 右上角关闭按钮 */
.modal-close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: transparent;
  color: rgba(255,255,255,0.5);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  z-index: 10;
}

.modal-close-btn:hover {
  background-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7);
  border-color: rgba(255,255,255,0.15);
}

.modal-close-btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

@media (prefers-color-scheme: dark) {
  .modal-close-btn {
    color: rgba(255,255,255,0.5);
  }
  .modal-close-btn:hover {
    background-color: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.15);
  }
}

/* 弹窗头部 */
.modal-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  background-color: rgba(255,255,255,0.05);
}

@media (prefers-color-scheme: dark) {
  .modal-header {
    border-bottom-color: rgba(255,255,255,0.15);
    background-color: rgba(255,255,255,0.05);
  }
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  margin: 0;
}

@media (prefers-color-scheme: dark) {
  .modal-title {
    color: rgba(255,255,255,0.9);
  }
}

/* 弹窗主体 */
.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* 会话卡片（当前 / 其他） */
.session-card {
  padding: 0.75rem;
  border-radius: 0.5rem;
  border-width: 1px;
  border-style: solid;
  margin-bottom: 0.75rem;
}

.session-card:last-child {
  margin-bottom: 0;
}

.session-card-current {
  background-color: rgba(7, 193, 96, 0.15);
  border-color: rgba(16, 185, 129, 0.35);
}

.session-card-other {
  background-color: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
}

.session-card-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.session-card-label-current {
  color: #34d399;
}

.session-card-label-other {
  color: #fbbf24;
}

@media (prefers-color-scheme: dark) {
  .session-card-current {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.35);
  }
  .session-card-other {
    background-color: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
  }
  .session-card-label-current {
    color: #34d399;
  }
  .session-card-label-other {
    color: #fbbf24;
  }
}

/* 弹窗底部 */
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.15);
  background-color: rgba(255,255,255,0.05);
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (prefers-color-scheme: dark) {
  .modal-footer {
    border-top-color: rgba(255,255,255,0.15);
    background-color: rgba(255,255,255,0.05);
  }
}

/* 按钮通用样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  border-width: 1px;
  border-style: solid;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 2.25rem;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* 次要按钮（取消/忽略） */
.btn-outline {
  background-color: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
  border-color: rgba(255,255,255,0.15);
}

.btn-outline:hover:not(:disabled) {
  background-color: rgba(255,255,255,0.15);
  border-color: rgba(255,255,255,0.25);
}

@media (prefers-color-scheme: dark) {
  .btn-outline {
    background-color: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.7);
    border-color: rgba(255,255,255,0.15);
  }
  .btn-outline:hover:not(:disabled) {
    background-color: rgba(255,255,255,0.15);
    border-color: rgba(255,255,255,0.25);
  }
}

/* 主要危险按钮（强制下线） */
.btn-danger {
  background-color: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}

.btn-danger:hover:not(:disabled) {
  background-color: #b91c1c;
  border-color: #b91c1c;
}

/* ─── 过渡动画 ─── */

/* 遮罩层淡入淡出 + 内容缩放 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-content-enter-active,
.modal-content-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.modal-content-enter-from,
.modal-content-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

/* ─── 响应式适配 ─── */

/* 小屏幕（手机）：最大化宽度、紧凑间距 */
@media (max-width: 640px) {
  .modal-container {
    padding: 0.5rem;
  }

  .modal-dialog {
    max-width: 100%;
    max-height: calc(100vh - 1rem);
    border-radius: 0.5rem;
  }

  .modal-header {
    padding: 0.75rem 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-footer {
    padding: 0.75rem 1rem;
    flex-direction: column-reverse;
  }

  .modal-footer .btn {
    width: 100%;
  }

  .modal-title {
    font-size: 1rem;
    padding-right: 2.5rem; /* 为关闭按钮留出空间 */
  }
}

/* 大屏幕（> 1440px）：稍微增大对话框 */
@media (min-width: 1440px) {
  .modal-dialog {
    max-width: 600px;
  }
}
</style>
