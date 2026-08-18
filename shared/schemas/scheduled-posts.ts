/**
 * Scheduled posts schemas (Batch A10)
 */
import { z } from 'zod'

/** Create a scheduled post */
export const CreateScheduledPostRequest = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  channelId: z.string().min(1),
  type: z.string().optional(),
  tags: z.string().optional(),
  pollOptions: z.array(z.string()).optional(),
  scheduleType: z.enum(['once', 'daily', 'weekly']),
  runAt: z.string().optional(),
  timeHHMM: z.string().optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  timezone: z.string().optional(),
})
export type CreateScheduledPostRequest = z.infer<typeof CreateScheduledPostRequest>

/** Update a scheduled post */
export const UpdateScheduledPostRequest = CreateScheduledPostRequest.partial().omit({ scheduleType: true }).extend({
  scheduleType: z.enum(['once', 'daily', 'weekly']).optional(),
})
export type UpdateScheduledPostRequest = z.infer<typeof UpdateScheduledPostRequest>

/** Toggle (pause/resume) a scheduled post */
export const ToggleScheduledPostRequest = z.object({
  paused: z.boolean(),
})
export type ToggleScheduledPostRequest = z.infer<typeof ToggleScheduledPostRequest>

/** Publish a post immediately */
export const PublishPostRequest = z.object({
  channelId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.string().optional(),
  tags: z.string().optional(),
  pollOptions: z.array(z.string()).optional(),
})
export type PublishPostRequest = z.infer<typeof PublishPostRequest>
