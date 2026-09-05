/**
 * Debate topics schemas (Batch A3)
 */
import { z } from 'zod'

/** Create a debate topic */
export const CreateDebateTopicRequest = z.object({
  affirmative: z.string().min(1),
  negative: z.string().min(1),
  category: z.string().optional(),
  note: z.string().optional(),
})
export type CreateDebateTopicRequest = z.infer<typeof CreateDebateTopicRequest>

/** Update a debate topic */
export const UpdateDebateTopicRequest = z
  .object({
    affirmative: z.string().min(1).optional(),
    negative: z.string().min(1).optional(),
    category: z.string().optional(),
    note: z.string().optional(),
  })
  .partial()
export type UpdateDebateTopicRequest = z.infer<typeof UpdateDebateTopicRequest>

/** Import debate topics in bulk */
export const ImportDebateTopicsRequest = z.object({
  topics: z.array(
    z.object({
      affirmative: z.string().min(1),
      negative: z.string().min(1),
      category: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
})
export type ImportDebateTopicsRequest = z.infer<typeof ImportDebateTopicsRequest>

/** Debate topic item（列表/读取响应用，与 DebateTopic Prisma model 对齐） */
export type DebateTopicInfo = {
  id: string
  tournamentId: string
  affirmative: string
  negative: string
  category: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}
/** Debate topic 列表接口响应：{ topics: DebateTopicInfo[] } */
export type DebateTopicListResult = { topics: DebateTopicInfo[] }
/** Debate topic 批量导入结果 */
export type DebateTopicImportResult = { created: number; skipped: number; total: number }
