/**
 * Questionnaires schemas (Batch A4)
 */
import { z } from 'zod'
import { QuestionnaireStatus } from './common'

/** Save/create a questionnaire */
export const SaveQuestionnaireRequest = z.object({
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  status: QuestionnaireStatus.optional(),
  settings: z.any().optional(),
  questions: z.array(z.any()),
})
export type SaveQuestionnaireRequest = z.infer<typeof SaveQuestionnaireRequest>

/** Query questionnaires */
export const QueryQuestionnairesParams = z.object({
  sourceType: z.string().optional(),
  status: z.string().optional(),
})
export type QueryQuestionnairesParams = z.infer<typeof QueryQuestionnairesParams>
