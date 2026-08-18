/**
 * Tournament settings schemas (Batch A2)
 */
import { z } from 'zod'
import { BestDebaterMode } from './common'

/** Update result settings */
export const ResultSettingsRequest = z.object({
  bestDebaterMode: BestDebaterMode,
})
export type ResultSettingsRequest = z.infer<typeof ResultSettingsRequest>

/** Update default registration fields */
export const DefaultFieldsRequest = z.object({
  fields: z.array(z.object({
    fieldKey: z.string().min(1),
    appliesTo: z.string(),
    required: z.boolean(),
  })),
})
export type DefaultFieldsRequest = z.infer<typeof DefaultFieldsRequest>
