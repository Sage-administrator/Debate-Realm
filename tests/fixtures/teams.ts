/**
 * 测试数据工厂：固定队伍数据
 * 供 bracket-generator、topic-vote、tournament-auth 等测试使用
 */
import type { TeamInput } from '../../server/utils/bracket-generator'

/** 标准 4 队（有种子） */
export const FOUR_TEAMS_SEEDED: TeamInput[] = [
  { name: '冠军队伍', seed: 1 },
  { name: '亚军队伍', seed: 2 },
  { name: '季军队伍', seed: 3 },
  { name: '殿军队伍', seed: 4 },
]

/** 标准 8 队（有种子） */
export const EIGHT_TEAMS_SEEDED: TeamInput[] = [
  { name: 'A队', seed: 1 },
  { name: 'B队', seed: 2 },
  { name: 'C队', seed: 3 },
  { name: 'D队', seed: 4 },
  { name: 'E队', seed: 5 },
  { name: 'F队', seed: 6 },
  { name: 'G队', seed: 7 },
  { name: 'H队', seed: 8 },
]

/** 3 队（非 2 的幂，测试 BYE） */
export const THREE_TEAMS: TeamInput[] = [
  { name: '甲队', seed: 1 },
  { name: '乙队', seed: 2 },
  { name: '丙队', seed: 3 },
]

/** 2 队（最小合法输入） */
export const TWO_TEAMS: TeamInput[] = [
  { name: '正方', seed: 1 },
  { name: '反方', seed: 2 },
]

/** 1 队（边界） */
export const ONE_TEAM: TeamInput[] = [{ name: '独苗队', seed: 1 }]

/** 0 队（边界） */
export const ZERO_TEAMS: TeamInput[] = []

/** 6 队（瑞士制测试） */
export const SIX_TEAMS: TeamInput[] = [
  { name: '一队', seed: 1 },
  { name: '二队', seed: 2 },
  { name: '三队', seed: 3 },
  { name: '四队', seed: 4 },
  { name: '五队', seed: 5 },
  { name: '六队', seed: 6 },
]

/** 5 队（奇数循环赛测试） */
export const FIVE_TEAMS: TeamInput[] = [
  { name: 'P队', seed: 1 },
  { name: 'Q队', seed: 2 },
  { name: 'R队', seed: 3 },
  { name: 'S队', seed: 4 },
  { name: 'T队', seed: 5 },
]
