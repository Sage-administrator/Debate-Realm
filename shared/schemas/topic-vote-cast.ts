/**
 * Topic vote cast schema (Batch A7)
 */
import { z } from 'zod'

/** Cast a vote */
export const CastVoteRequest = z.object({
  topicIndices: z.array(z.number().int().min(0)),
  voterName: z.string().optional(),
  voterType: z.string().optional(),
})
export type CastVoteRequest = z.infer<typeof CastVoteRequest>
