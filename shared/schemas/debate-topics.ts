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
export const UpdateDebateTopicRequest = z.object({
  affirmative: z.string().min(1).optional(),
  negative: z.string().min(1).optional(),
  category: z.string().optional(),
  note: z.string().optional(),
}).partial()
export type UpdateDebateTopicRequest = z.infer<typeof UpdateDebateTopicRequest>

/** Import debate topics in bulk */
export const ImportDebateTopicsRequest = z.object({
  topics: z.array(z.object({
    affirmative: z.string().min(1),
    negative: z.string().min(1),
    category: z.string().optional(),
    note: z.string().optional(),
  })),
})
export type ImportDebateTopicsRequest = z.infer<typeof ImportDebateTopicsRequest>
