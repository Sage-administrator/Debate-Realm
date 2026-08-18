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
