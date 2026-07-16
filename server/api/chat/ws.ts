// ════════════════════════════════════════════════════
// WebSocket /api/chat/ws — 赛事聊天室（队伍聊天室）实时通道
//
// 协议（客户端 → 服务端，JSON）：
//   { type: "auth", token, tournamentId }                 // 首次认证，服务端下发可进入的房间列表
//   { type: "history", room:{type,tournamentTeamId}, before?|after? }  // 拉取历史
//   { type: "send", room:{type,tournamentTeamId}, content?, imageUrl? } // 发送消息
//   { type: "mark_read", room:{type,tournamentTeamId}, messageId }       // 上报已读位置
//
// 协议（服务端 → 客户端，JSON）：
//   { type: "auth_ok", user, tournament, rooms:[{key,name,canSpeak,isGeneral}] }
//   { type: "auth_error", message }
//   { type: "history", room, messages, hasMore, recent?, receipts? }
//   { type: "message", room, message }
//   { type: "read_receipts", room, receipts:[{userId,lastReadMessageId,lastReadAt}] }
//   { type: "presence", room, users:[{id,name,side}] }
//   { type: "error", message }
//
// 房间 room 一律用 { type:'general'|'team', tournamentTeamId? } 标识。
// ════════════════════════════════════════════════════
import { defineWebSocketHandler } from 'h3'
import { verifyToken, type JWTPayload } from '../../lib/jwt'
import { prisma } from '../../lib/prisma'
import {
  canAccessChat,
  canSpeakRoom,
  isStaff,
  getAccessibleRooms,
  roomKeyString,
  roomKeyOf,
  type RoomKey,
  type ChatPrincipal,
} from '../../utils/chat-auth'

interface ChatPeerState {
  userId: string
  name: string
  principal: ChatPrincipal
  tournament: { id: string; teamId: string }
  // roomKeyString -> roomId
  rooms: Map<string, string>
}

// 模块级：roomKeyString -> 该房间内的 peer 集合
const roomPeers = new Map<string, Set<any>>()

function wsSend(peer: any, data: Record<string, unknown>, reqId?: string): void {
  if (reqId) (data as any).requestId = reqId
  try {
    peer.send(JSON.stringify(data))
  } catch {
    /* 发送失败忽略 */
  }
}

function wsError(peer: any, message: string, reqId?: string): void {
  wsSend(peer, { type: 'error', message }, reqId)
}

function presenceList(tournamentId: string, key: RoomKey): { id: string; name: string; side: string }[] {
  const set = roomPeers.get(roomKeyString(key))
  if (!set) return []
  const seen = new Map<string, { id: string; name: string; side: string }>()
  for (const peer of set) {
    const s = peer._chat as ChatPeerState | undefined
    if (!s) continue
    const isMember = !!(
      key.type === 'team' &&
      s.principal.tournamentTeamId &&
      key.tournamentTeamId &&
      s.principal.tournamentTeamId === key.tournamentTeamId
    )
    const side = isMember ? 'member' : 'staff'
    seen.set(s.userId, { id: s.userId, name: s.name, side })
  }
  return [...seen.values()]
}

function broadcastPresence(tournamentId: string, key: RoomKey): void {
  broadcast(tournamentId, key, {
    type: 'presence',
    room: key,
    users: presenceList(tournamentId, key),
  })
}

function broadcast(tournamentId: string, key: RoomKey, data: Record<string, unknown>): void {
  const set = roomPeers.get(roomKeyString(key))
  if (!set || set.size === 0) return
  const payload = JSON.stringify(data)
  for (const peer of [...set]) {
    try {
      peer.send(payload)
    } catch {
      set.delete(peer)
    }
  }
}

function serializeMessage(m: any) {
  return {
    id: m.id,
    roomId: m.roomId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderSide: m.senderSide,
    content: m.content,
    imageUrl: m.imageUrl,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
  }
}

function normalizeRoomKey(room: any): RoomKey | null {
  if (!room || typeof room !== 'object') return null
  if (room.type !== 'general' && room.type !== 'team') return null
  return roomKeyOf({ type: room.type, tournamentTeamId: room.tournamentTeamId ?? null })
}

export default defineWebSocketHandler({
  open() {
    // 等待客户端发送 auth
  },

  async message(peer, message) {
    try {
      const data = JSON.parse(message.text())
      const state = peer._chat as ChatPeerState | undefined

      // ── 认证 ──
      if (data.type === 'auth') {
        if (!data.token || !data.tournamentId) {
          wsError(peer, '缺少认证信息')
          return
        }
        const payload = verifyToken(data.token) as JWTPayload | null
        if (!payload) {
          wsSend(peer, { type: 'auth_error', message: '无效或过期的认证令牌' })
          return
        }
        // 校验会话版本（被踢下线检测）
        const dbUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            tokenVersion: true,
            nickname: true,
            username: true,
            role: true,
            teamId: true,
            tournamentTeamId: true,
          },
        })
        if (!dbUser || dbUser.tokenVersion !== payload.tokenVersion) {
          wsSend(peer, { type: 'auth_error', message: '账号已在其他设备登录，请重新登录' })
          return
        }
        const tournament = await prisma.tournament.findUnique({
          where: { id: data.tournamentId },
          select: { id: true, teamId: true },
        })
        if (!tournament) {
          wsSend(peer, { type: 'auth_error', message: '赛事不存在' })
          return
        }
        const principal: ChatPrincipal = {
          userId: payload.userId,
          role: dbUser.role,
          teamId: dbUser.teamId,
          tournamentTeamId: dbUser.tournamentTeamId,
        }
        if (!canAccessChat(principal, tournament)) {
          wsSend(peer, { type: 'auth_error', message: '无权限访问该赛事聊天室' })
          return
        }

        const accessible = await getAccessibleRooms(prisma, principal, tournament)
        const roomsMap = new Map<string, string>()
        for (const r of accessible) roomsMap.set(roomKeyString(r.key), r.roomId)

        const peerState: ChatPeerState = {
          userId: payload.userId,
          name: dbUser.nickname || payload.username,
          principal,
          tournament,
          rooms: roomsMap,
        }
        peer._chat = peerState

        // 加入各房间 presence
        for (const r of accessible) {
          const k = roomKeyString(r.key)
          if (!roomPeers.has(k)) roomPeers.set(k, new Set())
          roomPeers.get(k)!.add(peer)
        }

        // 回包：房间列表
        wsSend(peer, {
          type: 'auth_ok',
          user: { id: peerState.userId, name: peerState.name, role: dbUser.role },
          tournament: { id: tournament.id, teamId: tournament.teamId },
          rooms: accessible.map((r) => ({
            key: r.key,
            name: r.name,
            canSpeak: r.canSpeak,
            isGeneral: r.isGeneral,
          })),
        })

        for (const r of accessible) broadcastPresence(tournament.id, r.key)
        return
      }

      if (!state) {
        wsError(peer, '请先认证')
        return
      }

      // ── 拉取历史 ──
      if (data.type === 'history') {
        const key = normalizeRoomKey(data.room)
        if (!key) {
          wsError(peer, '非法的房间标识', data.requestId)
          return
        }
        const rk = roomKeyString(key)
        const roomId = state.rooms.get(rk)
        if (!roomId) {
          wsError(peer, '无权访问该聊天室', data.requestId)
          return
        }
        const limit = 30

        // 断线补齐：拉取 after 之后（更新的）消息
        if (data.after) {
          const anchor = await prisma.chatMessage.findUnique({
            where: { id: data.after },
            select: { createdAt: true, id: true },
          })
          const where: any = { roomId }
          if (anchor) {
            where.OR = [
              { createdAt: { gt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { gt: anchor.id } },
            ]
          }
          const msgs = await prisma.chatMessage.findMany({
            where,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: limit,
          })
          wsSend(
            peer,
            {
              type: 'history',
              room: key,
              recent: true,
              messages: msgs.map(serializeMessage),
              hasMore: false,
              receipts: [],
            },
            data.requestId,
          )
          return
        }

        // 向上翻页：拉取 before 之前（更旧的）消息
        const where: any = { roomId }
        if (data.before) {
          const anchor = await prisma.chatMessage.findUnique({
            where: { id: data.before },
            select: { createdAt: true, id: true },
          })
          if (anchor) {
            where.OR = [
              { createdAt: { lt: anchor.createdAt } },
              { createdAt: anchor.createdAt, id: { lt: anchor.id } },
            ]
          }
        }
        const msgs = await prisma.chatMessage.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
        })
        const hasMore = msgs.length > limit
        const page = hasMore ? msgs.slice(0, limit) : msgs
        const list = page.reverse().map(serializeMessage)

        const receipts = await prisma.chatReadReceipt.findMany({
          where: { roomId },
          select: { userId: true, lastReadMessageId: true, lastReadAt: true },
        })

        wsSend(
          peer,
          {
            type: 'history',
            room: key,
            messages: list,
            hasMore,
            receipts: receipts.map((r) => ({
              userId: r.userId,
              lastReadMessageId: r.lastReadMessageId,
              lastReadAt: r.lastReadAt.toISOString(),
            })),
          },
          data.requestId,
        )
        return
      }

      // ── 发送消息 ──
      if (data.type === 'send') {
        const key = normalizeRoomKey(data.room)
        if (!key) {
          wsError(peer, '非法的房间标识', data.requestId)
          return
        }
        const rk = roomKeyString(key)
        const roomId = state.rooms.get(rk)
        if (!roomId) {
          wsError(peer, '无权在该聊天室发言', data.requestId)
          return
        }
        if (!canSpeakRoom(state.principal, state.tournament, key)) {
          wsError(peer, '您没有在该聊天室发言的权限', data.requestId)
          return
        }
        const content = typeof data.content === 'string' ? data.content.trim() : ''
        let imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl.trim() : ''
        const isImage = !!imageUrl

        if (isImage) {
          // 图片白名单：仅允许本系统上传目录下的图片，禁止任意 URL / 文件
          if (!imageUrl.startsWith('/uploads/chat/')) {
            wsError(peer, '非法的图片地址', data.requestId)
            return
          }
        }
        if (!content && !isImage) {
          wsError(peer, '消息内容不能为空', data.requestId)
          return
        }
        if (content.length > 2000) {
          wsError(peer, '消息过长（最多 2000 字）', data.requestId)
          return
        }

        const isMember =
          key.type === 'team' &&
          state.principal.tournamentTeamId &&
          key.tournamentTeamId &&
          state.principal.tournamentTeamId === key.tournamentTeamId
        const senderSide = isMember ? 'member' : isStaff(state.principal, state.tournament) ? 'staff' : 'member'

        const msg = await prisma.chatMessage.create({
          data: {
            roomId,
            tournamentId: state.tournament.id,
            senderId: state.userId,
            senderName: state.name,
            senderSide,
            content: content || null,
            imageUrl: imageUrl || null,
            type: isImage ? 'image' : 'text',
          },
        })

        const payload = serializeMessage(msg)
        broadcast(state.tournament.id, key, { type: 'message', room: key, message: payload })

        // 发送者自动已读自己发出的消息
        await prisma.chatReadReceipt.upsert({
          where: { roomId_userId: { roomId, userId: state.userId } },
          create: { roomId, userId: state.userId, lastReadMessageId: msg.id, lastReadAt: msg.createdAt },
          update: { lastReadMessageId: msg.id, lastReadAt: msg.createdAt },
        })
        return
      }

      // ── 上报已读 ──
      if (data.type === 'mark_read') {
        const key = normalizeRoomKey(data.room)
        if (!key) return
        const rk = roomKeyString(key)
        const roomId = state.rooms.get(rk)
        if (!roomId) return
        const messageId = data.messageId as string
        if (!messageId) return
        const anchor = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          select: { createdAt: true },
        })
        if (!anchor) return
        const receipt = await prisma.chatReadReceipt.upsert({
          where: { roomId_userId: { roomId, userId: state.userId } },
          create: { roomId, userId: state.userId, lastReadMessageId: messageId, lastReadAt: anchor.createdAt },
          update: { lastReadMessageId: messageId, lastReadAt: anchor.createdAt },
        })
        broadcast(state.tournament.id, key, {
          type: 'read_receipts',
          room: key,
          receipts: [
            {
              userId: state.userId,
              lastReadMessageId: receipt.lastReadMessageId,
              lastReadAt: receipt.lastReadAt.toISOString(),
            },
          ],
        })
        return
      }

      wsError(peer, `未知指令类型: ${data.type}`, data.requestId)
    } catch (err: unknown) {
      console.error('[Chat WS] 消息处理异常:', err)
      wsError(peer, err instanceof Error ? err.message : '处理消息时发生未知错误')
    }
  },

  close(peer) {
    const state = peer._chat as ChatPeerState | undefined
    if (state) {
      for (const [rk, roomId] of state.rooms) {
        const set = roomPeers.get(rk)
        if (set) {
          set.delete(peer)
          if (set.size === 0) roomPeers.delete(rk)
          // 还原 roomKey 广播在线列表
          const [type, ttId] = rk.split(':')
          broadcastPresence(state.tournament.id, { type: type as any, tournamentTeamId: ttId || null })
        }
      }
      delete peer._chat
    }
  },

  error(peer, error) {
    console.error('[Chat WS] WebSocket 错误:', error)
  },
})
