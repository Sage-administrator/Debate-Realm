/**
 * Internal API schemas (Batch A12)
 */
import { z } from 'zod'

/** Grant audience speak permission */
export const InternalAudienceGrantRequest = z.object({
  teamId: z.string().min(1),
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
  internalKey: z.string().min(1),
})
export type InternalAudienceGrantRequest = z.infer<typeof InternalAudienceGrantRequest>

/** Revoke audience speak permission */
export const InternalAudienceRevokeRequest = z.object({
  teamId: z.string().min(1),
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  internalKey: z.string().min(1),
})
export type InternalAudienceRevokeRequest = z.infer<typeof InternalAudienceRevokeRequest>

/** Switch round via internal API */
export const InternalRoundSwitchRequest = z.object({
  teamId: z.string().min(1),
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  targetSide: z.string().min(1),
  internalKey: z.string().min(1),
})
export type InternalRoundSwitchRequest = z.infer<typeof InternalRoundSwitchRequest>

/** Reset round via internal API */
export const InternalRoundResetRequest = z.object({
  teamId: z.string().min(1),
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  internalKey: z.string().min(1),
})
export type InternalRoundResetRequest = z.infer<typeof InternalRoundResetRequest>
