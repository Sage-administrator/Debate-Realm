/**
 * Topic votes schemas (Batch A6)
 */
import { z } from 'zod'
import { VoteStatus } from './common'

/** Create a topic vote */
export const CreateTopicVoteRequest = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  topics: z.array(z.any()),
  matchId: z.string().optional(),
  allowedVoters: z.array(z.string()).optional(),
  multipleChoice: z.boolean().optional(),
  deadline: z.string().optional(),
  showResults: z.boolean().optional(),
  status: VoteStatus.optional(),
})
export type CreateTopicVoteRequest = z.infer<typeof CreateTopicVoteRequest>

/** Update a topic vote */
export const UpdateTopicVoteRequest = CreateTopicVoteRequest.partial()
export type UpdateTopicVoteRequest = z.infer<typeof UpdateTopicVoteRequest>

// ── 响应类型（读取/统计用，与 TopicVote Prisma model + parseTopics 输出对齐） ──
/** 单个辩题投票条目（列表/详情响应中的元素）。字段多为 JSON 解析后的动态结构 */
export type TopicVoteInfo = {
  id: string
  tournamentId: string
  matchId: string | null
  match?: {
    id: string
    round: string | null
    teamA: string | null
    teamB: string | null
    topic: string | null
  } | null
  title: string
  description: string | null
  topics: any[]
  status: string
  allowedVoters: string[] | null
  multipleChoice: boolean | null
  deadline: string | null
  showResults: boolean | null
  [key: string]: any
}
/** topic-votes 列表响应：TopicVoteInfo[] */
export type TopicVoteListResult = TopicVoteInfo[]
/** 单个投票详情响应 */
export type TopicVoteDetail = TopicVoteInfo
/** 我的投票记录响应：{ record: {...} | null } */
export type MyVoteRecordResult = {
  record: { id: string; topicIndices: number[]; voterType: string | null; createdAt: string } | null
}
/** 投票统计响应：{ [key: string]: any }（computeVoteStats 动态结构） */
export type VoteStatsResult = { [key: string]: any }
