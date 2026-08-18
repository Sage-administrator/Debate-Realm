/**
 * Questionnaire submit schema (Batch A5)
 */
import { z } from 'zod'

/** Submit answers to a questionnaire */
export const SubmitQuestionnaireRequest = z.object({
  matchId: z.string().min(1),
  answers: z.record(z.string(), z.any()),
  respondentName: z.string().optional(),
})
export type SubmitQuestionnaireRequest = z.infer<typeof SubmitQuestionnaireRequest>
