// ════════════════════════════════════════════════════
// 赛事聊天室（队伍聊天室）权限辅助函数
//
// 房间模型：
//   - type='general'           总聊天室：对所有赛事用户开放（读 + 写）
//   - type='team' + tournamentTeamId  某支参赛队伍(TournamentTeam)的专属房间
//       读：本队成员 + 组织者/系统管理员(staff)
//       写：仅本队成员（staff 只看不能发）
//
// 子账号：每支参赛队伍的每位队员各持一个 User(role='subaccount',
//         tournamentTeamId=该队id)，以本人子账号登录后在本队房间发言。
// ════════════════════════════════════════════════════
import type { PrismaClient, ChatRoom } from '../lib/generated/client'
import type { JWTPayload } from './auth'
import { canReadTournament } from './tournament-auth'

export type RoomType = 'general' | 'team'

export interface RoomKey {
  type: RoomType
  tournamentTeamId?: string | null
}

// 聊天主体（从 DB 取全，含 tournamentTeamId；JWT 不含该字段）
export interface ChatPrincipal {
  userId: string
  role: string
  teamId?: string | null
  tournamentTeamId?: string | null
}

export function roomKeyOf(room: { type: string; tournamentTeamId?: string | null }): RoomKey {
  return { type: room.type as RoomType, tournamentTeamId: room.tournamentTeamId ?? null }
}

export function roomKeyEquals(a: RoomKey, b: RoomKey): boolean {
  return a.type === b.type && (a.tournamentTeamId ?? null) === (b.tournamentTeamId ?? null)
}

export function roomKeyString(k: RoomKey): string {
  return `${k.type}:${k.tournamentTeamId ?? ''}`
}

/** 是否赛事组织者 / 系统管理员（可查看全部队伍房，但队房内仅可看不可发） */
export function isStaff(principal: ChatPrincipal, tournament: { teamId: string }): boolean {
  if (principal.role === 'system_admin') return true
  if (
    principal.role === 'admin' &&
    principal.teamId &&
    tournament.teamId &&
    principal.teamId === tournament.teamId
  ) {
    return true
  }
  return false
}

/** 入口权限：能否打开该赛事聊天室（沿用赛事读权限：组织者 / 参赛者子账号 等） */
export function canAccessChat(principal: ChatPrincipal, tournament: { teamId: string }): boolean {
  return canReadTournament(principal as unknown as JWTPayload, tournament)
}

/** 能否查看某房间 */
export function canViewRoom(principal: ChatPrincipal, tournament: { teamId: string }, room: RoomKey): boolean {
  if (room.type === 'general') return true
  if (
    principal.tournamentTeamId &&
    room.tournamentTeamId &&
    principal.tournamentTeamId === room.tournamentTeamId
  ) {
    return true
  }
  return isStaff(principal, tournament)
}

/** 能否在某房间发言 */
export function canSpeakRoom(principal: ChatPrincipal, tournament: { teamId: string }, room: RoomKey): boolean {
  if (room.type === 'general') return true // 总房对所有赛事用户开放发言
  // 队伍房：仅本队成员可发言；staff 仅可查看
  return !!(
    principal.tournamentTeamId &&
    room.tournamentTeamId &&
    principal.tournamentTeamId === room.tournamentTeamId
  )
}

/**
 * 取当前用户在该赛事下可访问的聊天室列表。
 * - 总聊天室：始终包含
 * - 普通队员：额外包含自己所属队伍房（可写）
 * - staff：额外包含全部队伍房（只读）
 */
export async function getAccessibleRooms(
  prisma: PrismaClient,
  principal: ChatPrincipal,
  tournament: { id: string; teamId: string },
): Promise<{ key: RoomKey; roomId: string; name: string; canSpeak: boolean; isGeneral: boolean }[]> {
  const result: { key: RoomKey; roomId: string; name: string; canSpeak: boolean; isGeneral: boolean }[] = []

  // 总房
  const general = await prisma.chatRoom.upsert({
    where: { tournamentId_type_tournamentTeamId: { tournamentId: tournament.id, type: 'general', tournamentTeamId: null } },
    create: { tournamentId: tournament.id, type: 'general', tournamentTeamId: null, name: '总聊天室' },
    update: {},
  })
  result.push({
    key: { type: 'general', tournamentTeamId: null },
    roomId: general.id,
    name: general.name,
    canSpeak: true,
    isGeneral: true,
  })

  // 本队房间（普通队员）
  if (principal.tournamentTeamId) {
    const tt = await prisma.tournamentTeam.findUnique({
      where: { id: principal.tournamentTeamId },
      select: { id: true, name: true },
    })
    if (tt) {
      const room = await prisma.chatRoom.upsert({
        where: { tournamentId_type_tournamentTeamId: { tournamentId: tournament.id, type: 'team', tournamentTeamId: tt.id } },
        create: { tournamentId: tournament.id, type: 'team', tournamentTeamId: tt.id, name: tt.name },
        update: { name: tt.name },
      })
      result.push({
        key: { type: 'team', tournamentTeamId: tt.id },
        roomId: room.id,
        name: room.name,
        canSpeak: true,
        isGeneral: false,
      })
    }
  }

  // staff：额外看到全部队伍房（只读）
  if (isStaff(principal, tournament)) {
    const teams = await prisma.tournamentTeam.findMany({
      where: { tournamentId: tournament.id },
      select: { id: true, name: true },
    })
    for (const tt of teams) {
      const key: RoomKey = { type: 'team', tournamentTeamId: tt.id }
      if (result.some((r) => roomKeyEquals(r.key, key))) continue // 避免与本队房重复
      const room = await prisma.chatRoom.upsert({
        where: { tournamentId_type_tournamentTeamId: { tournamentId: tournament.id, type: 'team', tournamentTeamId: tt.id } },
        create: { tournamentId: tournament.id, type: 'team', tournamentTeamId: tt.id, name: tt.name },
        update: { name: tt.name },
      })
      result.push({ key, roomId: room.id, name: room.name, canSpeak: false, isGeneral: false })
    }
  }

  return result
}

/** 取（或按需创建）某房间的 ChatRoom 行 */
export async function getOrCreateRoom(
  prisma: PrismaClient,
  tournamentId: string,
  key: RoomKey,
): Promise<ChatRoom> {
  if (key.type === 'general') {
    return prisma.chatRoom.upsert({
      where: { tournamentId_type_tournamentTeamId: { tournamentId, type: 'general', tournamentTeamId: null } },
      create: { tournamentId, type: 'general', tournamentTeamId: null, name: '总聊天室' },
      update: {},
    })
  }
  const tt = await prisma.tournamentTeam.findUnique({
    where: { id: key.tournamentTeamId! },
    select: { id: true, name: true },
  })
  return prisma.chatRoom.upsert({
    where: { tournamentId_type_tournamentTeamId: { tournamentId, type: 'team', tournamentTeamId: key.tournamentTeamId! } },
    create: { tournamentId, type: 'team', tournamentTeamId: key.tournamentTeamId!, name: tt?.name ?? '队伍聊天室' },
    update: { name: tt?.name ?? '队伍聊天室' },
  })
}

/** 某房间的潜在读者总数（用于"已读 N / 总数"展示） */
export async function getRoomReaderCount(
  prisma: PrismaClient,
  tournamentId: string,
  key: RoomKey,
): Promise<number> {
  if (key.type === 'general') {
    const memberCount = await prisma.registrationMember.count({
      where: { registration: { tournamentId } },
    })
    return Math.max(memberCount, 1)
  }
  const ttId = key.tournamentTeamId
  if (!ttId) return 1
  const memberCount = await prisma.registrationMember.count({
    where: { registration: { convertedTeamId: ttId } },
  })
  return Math.max(memberCount, 1)
}
