// ════════════════════════════════════════════════════
// 赛事聊天室 Pinia store（队伍聊天室模型）
// 管理：多房间独立状态（消息 / 未读 / 在线 / 已读回执）、WebSocket 生命周期、
//       断线重连、历史分页、切换保持。
// 房间键 = `${type}:${tournamentTeamId ?? ''}`（general => 'general:'）
// ════════════════════════════════════════════════════
import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'

export interface ChatMsg {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderSide: 'member' | 'staff' | 'neutral'
  content: string | null
  imageUrl: string | null
  type: 'text' | 'image'
  createdAt: string
}

export interface RoomState {
  key: { type: 'general' | 'team'; tournamentTeamId?: string | null }
  name: string
  canSpeak: boolean
  isGeneral: boolean
  messages: ChatMsg[]
  unread: number
  online: { id: string; name: string; side: string }[]
  hasMore: boolean
  loading: boolean
  oldestId: string | null
  receipts: Record<string, { userId: string; lastReadMessageId: string; lastReadAt: string }>
  loaded: boolean
  // 已读人数缓存（避免模板里对每条消息 O(N·M) 重算）
  readCountCache: Record<string, number>
  readCountDirty: boolean
}

function rk(k: { type: string; tournamentTeamId?: string | null }): string {
  return `${k.type}:${k.tournamentTeamId ?? ''}`
}

export const useChatStore = defineStore('chat', () => {
  const connected = ref(false)
  const connecting = ref(false)
  const tournamentId = ref<string | null>(null)
  const myId = ref('')
  const myName = ref('')
  const myRole = ref('')
  const rooms = reactive<Record<string, RoomState>>({})
  const roomOrder = ref<string[]>([])
  const currentKey = ref<string>('')

  let ws: any = null
  let authToken = ''
  let wantConnect = false
  let reconnectTimer: any = null
  let reqSeq = 0

  const currentRoom = computed<RoomState | null>(() =>
    currentKey.value ? rooms[currentKey.value] ?? null : null,
  )

  function ensureRoom(key: { type: 'general' | 'team'; tournamentTeamId?: string | null }, meta?: Partial<RoomState>): RoomState {
    const k = rk(key)
    if (!rooms[k]) {
      rooms[k] = {
        key,
        name: meta?.name ?? (key.type === 'general' ? '总聊天室' : '队伍聊天室'),
        canSpeak: meta?.canSpeak ?? false,
        isGeneral: meta?.isGeneral ?? key.type === 'general',
        messages: [],
        unread: 0,
        online: [],
        hasMore: true,
        loading: false,
        oldestId: null,
        receipts: {},
        loaded: false,
        readCountCache: {},
        readCountDirty: true,
      }
      roomOrder.value.push(k)
    } else if (meta) {
      if (meta.name) rooms[k].name = meta.name
      if (typeof meta.canSpeak === 'boolean') rooms[k].canSpeak = meta.canSpeak
    }
    return rooms[k]
  }

  function sendRaw(obj: Record<string, unknown>) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(obj))
      return true
    }
    return false
  }

  function handleMessage(data: any) {
    switch (data.type) {
      case 'auth_ok': {
        myId.value = data.user.id
        myName.value = data.user.name
        myRole.value = data.user.role
        // 重建房间列表
        for (const r of data.rooms) {
          ensureRoom(r.key, { name: r.name, canSpeak: r.canSpeak, isGeneral: r.isGeneral })
        }
        if (!currentKey.value && data.rooms.length) currentKey.value = rk(data.rooms[0].key)
        connected.value = true
        connecting.value = false
        // 拉取每个房间的初始历史（用于未读计数 + 最近消息）
        for (const k of roomOrder.value) {
          loadHistory(k, null)
        }
        break
      }
      case 'auth_error': {
        connecting.value = false
        connected.value = false
        console.error('[chat] auth_error:', data.message)
        break
      }
      case 'history': {
        const k = rk(data.room)
        const room = rooms[k]
        if (!room) break
        room.loading = false
        const incoming: ChatMsg[] = data.messages || []
        if (data.recent) {
          // 断线补齐：追加新消息
          const have = new Set(room.messages.map((m) => m.id))
          for (const m of incoming) if (!have.has(m.id)) room.messages.push(m)
          room.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        } else {
          // 向上翻页：前置旧消息
          room.messages = [...incoming, ...room.messages]
          room.hasMore = data.hasMore
          room.oldestId = incoming.length ? incoming[0].id : room.oldestId
        }
        room.loaded = true
        // 已读回执
        const myReceipt = (data.receipts || []).find((r: any) => r.userId === myId.value)
        // 初始未读：比我的已读位置更新的、非自己发的消息数
        if (myReceipt) {
          let unread = 0
          for (const m of room.messages) {
            if (m.senderId !== myId.value && m.createdAt > myReceipt.lastReadAt) unread++
          }
          room.unread = unread
        }
        // 记录回执
        for (const r of data.receipts || []) room.receipts[r.userId] = r
        room.readCountDirty = true
        break
      }
      case 'message': {
        const k = rk(data.room)
        const room = rooms[k]
        if (!room) break
        const m: ChatMsg = data.message
        if (!room.messages.find((x) => x.id === m.id)) {
          room.messages.push(m)
          if (k !== currentKey.value && m.senderId !== myId.value) room.unread++
        }
        room.readCountDirty = true
        break
      }
      case 'read_receipts': {
        const k = rk(data.room)
        const room = rooms[k]
        if (!room) break
        for (const r of data.receipts || []) room.receipts[r.userId] = r
        room.readCountDirty = true
        break
      }
      case 'presence': {
        const k = rk(data.room)
        const room = rooms[k]
        if (!room) break
        room.online = data.users || []
        break
      }
      case 'error': {
        console.warn('[chat] server error:', data.message)
        break
      }
    }
  }

  function connect(tid: string, token: string) {
    if (!import.meta.client) return
    tournamentId.value = tid
    authToken = token
    wantConnect = true
    if (ws && (ws.readyState === 1 || ws.readyState === 0)) return
    openWs()
  }

  function openWs() {
    if (!tournamentId.value) return
    connecting.value = true
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${location.host}/api/chat/ws`
    ws = new WebSocket(url)
    ws.onopen = () => {
      sendRaw({ type: 'auth', token: authToken, tournamentId: tournamentId.value })
    }
    ws.onmessage = (ev: MessageEvent) => {
      try {
        handleMessage(JSON.parse(ev.data))
      } catch (e) {
        console.error('[chat] parse error', e)
      }
    }
    ws.onclose = () => {
      connected.value = false
      if (wantConnect) {
        reconnectTimer = setTimeout(openWs, 2000)
      }
    }
    ws.onerror = (e: any) => {
      console.error('[chat] ws error', e)
    }
  }

  function disconnect() {
    wantConnect = false
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) {
      try {
        ws.close()
      } catch {
        /* noop */
      }
      ws = null
    }
    connected.value = false
  }

  function switchRoom(key: { type: 'general' | 'team'; tournamentTeamId?: string | null }) {
    const k = rk(key)
    currentKey.value = k
    const room = rooms[k]
    if (room) {
      room.unread = 0
      if (!room.loaded) loadHistory(k, null)
      else markReadLatest(k)
    }
  }

  function loadHistory(k: string, before: string | null) {
    const room = rooms[k]
    if (!room || room.loading) return
    room.loading = true
    sendRaw({ type: 'history', room: room.key, before: before ?? null, requestId: `h${++reqSeq}` })
  }

  function loadOlder() {
    const room = currentRoom.value
    if (!room || !room.hasMore || room.loading || !room.oldestId) return
    loadHistory(rk(room.key), room.oldestId)
  }

  function sendMessage(content: string, imageUrl?: string) {
    const room = currentRoom.value
    if (!room || !room.canSpeak) return
    sendRaw({
      type: 'send',
      room: room.key,
      content: content || '',
      imageUrl: imageUrl || '',
      requestId: `s${++reqSeq}`,
    })
  }

  function markReadLatest(k: string) {
    const room = rooms[k]
    if (!room || !room.messages.length) return
    const last = room.messages[room.messages.length - 1]
    if (last.senderId === myId.value) return
    sendRaw({ type: 'mark_read', room: room.key, messageId: last.id, requestId: `r${++reqSeq}` })
  }

  // 增量缓存：仅当 messages/receipts 变化（readCountDirty）时一次性重算 O(N·M)，
  // 之后模板每次渲染都是 O(1) 查表，避免滚动/重渲染时每条消息重复全量扫描
  function recomputeReadCounts(room: RoomState) {
    const cache: Record<string, number> = {}
    for (const m of room.messages) {
      let n = 0
      for (const uid in room.receipts) {
        if (uid === m.senderId) continue
        if (room.receipts[uid].lastReadAt >= m.createdAt) n++
      }
      cache[m.id] = n
    }
    room.readCountCache = cache
    room.readCountDirty = false
  }

  function readCountFor(room: RoomState, msg: ChatMsg): number {
    if (room.readCountDirty) recomputeReadCounts(room)
    return room.readCountCache[msg.id] ?? 0
  }

  // 限制渲染的 DOM 节点数：当消息数超过 max 时只保留最近的 max 条。
  // 同步把 oldestId 前移到剩余首条，保证上滑 loadOlder 仍能从正确位置续拉回被裁掉的更早消息。
  function trimTo(max: number) {
    const room = currentRoom.value
    if (!room) return
    if (room.messages.length > max) {
      room.messages = room.messages.slice(room.messages.length - max)
      if (room.messages.length) room.oldestId = room.messages[0].id
      room.readCountDirty = true
    }
  }

  return {
    connected,
    connecting,
    tournamentId,
    myId,
    myName,
    myRole,
    rooms,
    roomOrder,
    currentKey,
    currentRoom,
    connect,
    disconnect,
    switchRoom,
    loadHistory,
    loadOlder,
    sendMessage,
    markReadLatest,
    readCountFor,
    trimTo,
  }
})
