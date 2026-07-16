<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore, type ChatMsg } from '~/stores/chat'
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const tid = computed(() => route.params.id as string)
const auth = useAuthStore()
const chat = useChatStore()

const scrollEl = ref<HTMLElement | null>(null)
const atBottom = ref(true)
const draft = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const showOnline = ref(false)
const uploading = ref(false)
const toast = ref('')

const rooms = computed(() => chat.roomOrder.map((k) => chat.rooms[k]).filter(Boolean))
const room = computed(() => chat.currentRoom)

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 渲染在 DOM 中的消息上限：超过后只保留最近 N 条，更早的可上滑 loadOlder 拉回
const MAX_MESSAGES = 200

// resize/scroll 同类节流：用 rAF 合并高频 scroll 事件，避免每次滚动都同步计算
let scrollRafHandle: number | null = null
function onScroll() {
  if (scrollRafHandle !== null) return
  scrollRafHandle = requestAnimationFrame(() => {
    scrollRafHandle = null
    const el = scrollEl.value
    if (!el) return
    atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (el.scrollTop < 48) chat.loadOlder()
  })
}

async function scrollToBottom(force = false) {
  await nextTick()
  const el = scrollEl.value
  if (!el) return
  if (force || atBottom.value) el.scrollTop = el.scrollHeight
}

watch(
  () => room.value?.messages.length,
  () => {
    // 位于底部时裁剪旧消息，限制 DOM 节点数（上滑仍可 loadOlder 拉回更早的）
    if (atBottom.value) chat.trimTo(MAX_MESSAGES)
    scrollToBottom()
  },
)
watch(
  () => chat.currentKey,
  () => {
    atBottom.value = true
    nextTick(() => scrollToBottom(true))
  },
)

function selectRoom(key: { type: 'general' | 'team'; tournamentTeamId?: string | null }) {
  chat.switchRoom(key)
  showOnline.value = false
}

function send() {
  const text = draft.value.trim()
  if (!text || !room.value?.canSpeak) return
  chat.sendMessage(text)
  draft.value = ''
  nextTick(() => scrollToBottom(true))
}

function onEnter(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function pickImage() {
  if (!room.value?.canSpeak) return
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    toast.value = '只允许发送图片'
    setTimeout(() => (toast.value = ''), 2500)
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'chat')
    const res: any = await $fetch('/api/upload', { method: 'POST', body: fd })
    const path = res?.data?.path
    if (!path) throw new Error('上传失败')
    chat.sendMessage('', path)
    nextTick(() => scrollToBottom(true))
  } catch (err: any) {
    toast.value = err?.message || '上传失败'
    setTimeout(() => (toast.value = ''), 2500)
  } finally {
    uploading.value = false
  }
}

function readLabel(m: ChatMsg): string {
  if (!room.value) return ''
  const n = chat.readCountFor(room.value, m)
  return n > 0 ? `已读 ${n}` : '送达'
}

onMounted(async () => {
  auth.loadFromStorage()
  if (auth.token && tid.value) chat.connect(tid.value, auth.token)
  await nextTick()
  scrollToBottom(true)
})
onBeforeUnmount(() => {
  if (scrollRafHandle !== null) cancelAnimationFrame(scrollRafHandle)
  chat.disconnect()
})
</script>

<template>
  <div class="flex h-full flex-col bg-gray-50">
    <!-- 顶栏 -->
    <div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div class="flex items-center gap-2">
        <h1 class="text-base font-semibold text-gray-800">赛事聊天室</h1>
        <span
          class="inline-block h-2 w-2 rounded-full"
          :class="chat.connected ? 'bg-green-500' : 'bg-gray-300'"
          :title="chat.connected ? '已连接' : '连接中…'"
        />
      </div>
      <button
        class="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 md:hidden"
        @click="showOnline = !showOnline"
      >
        在线 ({{ room?.online.length || 0 }})
      </button>
    </div>

    <!-- 房间切换标签 -->
    <div class="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2">
      <button
        v-for="r in rooms"
        :key="r.key.type + ':' + (r.key.tournamentTeamId ?? '')"
        class="relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition"
        :class="
          chat.currentKey === r.key.type + ':' + (r.key.tournamentTeamId ?? '')
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        "
        @click="selectRoom(r.key)"
      >
        <span>{{ r.name }}</span>
        <span
          v-if="r.unread > 0"
          class="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-medium text-white"
        >
          {{ r.unread > 99 ? '99+' : r.unread }}
        </span>
      </button>
      <div v-if="!rooms.length" class="px-2 py-1.5 text-sm text-gray-400">暂无可用聊天室</div>
    </div>

    <!-- 主体 -->
    <div class="flex min-h-0 flex-1">
      <!-- 消息区 -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div ref="scrollEl" class="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 md:px-6" @scroll="onScroll">
          <div v-if="!room" class="flex h-full items-center justify-center text-gray-400">请选择聊天室</div>

          <template v-else>
            <div v-if="room.hasMore" class="text-center text-xs text-gray-400">上滑加载更早的消息…</div>
            <div v-if="!room.messages.length" class="flex h-full items-center justify-center text-sm text-gray-400">
              还没有消息，开始聊天吧
            </div>

            <div
              v-for="m in room.messages"
              :key="m.id"
              class="flex"
              :class="m.senderId === chat.myId ? 'justify-end' : 'justify-start'"
            >
              <div class="max-w-[78%] md:max-w-[65%]">
                <div
                  v-if="m.senderId !== chat.myId"
                  class="mb-0.5 px-1 text-xs text-gray-500"
                >
                  {{ m.senderName }}
                  <span v-if="m.senderSide === 'staff'" class="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">管理</span>
                </div>
                <div
                  class="rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm"
                  :class="
                    m.senderId === chat.myId
                      ? 'rounded-br-sm bg-blue-600 text-white'
                      : 'rounded-bl-sm bg-white text-gray-800'
                  "
                >
                  <img
                    v-if="m.type === 'image' && m.imageUrl"
                    :src="m.imageUrl"
                    class="max-h-60 w-auto rounded-lg"
                    alt="图片"
                  />
                  <span v-else style="white-space: pre-wrap; word-break: break-word">{{ m.content }}</span>
                </div>
                <div
                  class="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-gray-400"
                  :class="m.senderId === chat.myId ? 'justify-end' : 'justify-start'"
                >
                  <span>{{ fmtTime(m.createdAt) }}</span>
                  <span v-if="m.senderId === chat.myId" class="text-gray-400">{{ readLabel(m) }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 输入区 -->
        <div class="border-t border-gray-200 bg-white px-3 py-2.5 md:px-6">
          <div v-if="room && !room.canSpeak" class="mb-2 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            您是观察者，仅队伍成员可在此房间发言
          </div>
          <div class="flex items-end gap-2">
            <button
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              :disabled="!room?.canSpeak || uploading"
              title="发送图片"
              @click="pickImage"
            >
              <span v-if="!uploading">🖼️</span>
              <span v-else class="text-xs">…</span>
            </button>
            <textarea
              v-model="draft"
              rows="1"
              class="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-gray-100"
              :disabled="!room?.canSpeak"
              placeholder="输入消息，Enter 发送，Shift+Enter 换行"
              @keydown="onEnter"
            />
            <button
              class="h-10 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white enabled:hover:bg-blue-700 disabled:opacity-40"
              :disabled="!room?.canSpeak || !draft.trim()"
              @click="send"
            >
              发送
            </button>
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
        </div>
      </div>

      <!-- 在线列表（桌面侧栏） -->
      <aside class="hidden w-56 shrink-0 border-l border-gray-200 bg-white md:block">
        <div class="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
          在线 ({{ room?.online.length || 0 }})
        </div>
        <div class="space-y-1 overflow-y-auto px-2 py-2">
          <div v-if="!room?.online.length" class="px-2 py-3 text-center text-xs text-gray-400">暂无人在线</div>
          <div
            v-for="u in room?.online"
            :key="u.id"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
          >
            <span class="truncate text-gray-700">{{ u.name }}{{ u.id === chat.myId ? '(我)' : '' }}</span>
            <span
              class="ml-1 shrink-0 rounded px-1 text-[10px]"
              :class="u.side === 'staff' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
            >
              {{ u.side === 'staff' ? '管理' : '队员' }}
            </span>
          </div>
        </div>
      </aside>
    </div>

    <!-- 在线列表（移动抽屉） -->
    <div
      v-if="showOnline"
      class="fixed inset-0 z-40 bg-black/30 md:hidden"
      @click="showOnline = false"
    >
      <div class="absolute right-0 top-0 h-full w-64 bg-white shadow-xl" @click.stop>
        <div class="flex items-center justify-between border-b px-4 py-3 text-sm font-medium">
          在线 ({{ room?.online.length || 0 }})
          <button class="text-gray-400" @click="showOnline = false">✕</button>
        </div>
        <div class="space-y-1 overflow-y-auto px-2 py-2">
          <div v-if="!room?.online.length" class="px-2 py-3 text-center text-xs text-gray-400">暂无人在线</div>
          <div
            v-for="u in room?.online"
            :key="u.id"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-sm"
          >
            <span class="truncate">{{ u.name }}{{ u.id === chat.myId ? '(我)' : '' }}</span>
            <span
              class="ml-1 rounded px-1 text-[10px]"
              :class="u.side === 'staff' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
            >
              {{ u.side === 'staff' ? '管理' : '队员' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 轻提示 -->
    <div
      v-if="toast"
      class="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-md bg-gray-800 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ toast }}
    </div>
  </div>
</template>
