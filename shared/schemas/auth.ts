/**
 * 认证相关 Schema — 前后端共享
 */
import { z } from 'zod'
import { UserRole, ID } from './common'

// ── 请求 ──

export const LoginRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof LoginRequest>

export const ConfirmLoginRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})
export type ConfirmLoginRequest = z.infer<typeof ConfirmLoginRequest>

export const ChangePasswordRequest = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6),
})
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>

export const UpdateProfileRequest = z.object({
  username: z.string().min(1).optional(),
  nickname: z.string().optional(),
  email: z.string().email().optional(),
  avatar: z.string().url().optional(),
}).partial()
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>

// ── 响应 ──

export const LoginResponse = z.discriminatedUnion('needConfirm', [
  z.object({
    needConfirm: z.literal(false),
    token: z.string(),
    user: z.object({
      id: ID, username: z.string(), nickname: z.string().nullable(),
      role: UserRole, mode: z.string(), teamId: z.string().nullable(),
    }),
  }),
  z.object({
    needConfirm: z.literal(true),
    existingSessions: z.array(z.object({
      deviceInfo: z.string(), ipAddress: z.string().nullable(), loggedInAt: z.string(),
    })),
  }),
])
export type LoginResponse = z.infer<typeof LoginResponse>

export const UserInfo = z.object({
  id: ID,
  username: z.string(),
  nickname: z.string().nullable(),
  email: z.string().nullable(),
  avatar: z.string().nullable(),
  role: UserRole,
  mode: z.string(),
  teamId: z.string().nullable(),
  team: z.object({ id: ID, name: z.string() }).nullable().optional(),
})
export type UserInfo = z.infer<typeof UserInfo>

export const LoginSession = z.object({
  id: ID, deviceInfo: z.string(), ipAddress: z.string().nullable(),
  isActive: z.boolean(), loggedInAt: z.string(), lastSeenAt: z.string(),
})
export type LoginSession = z.infer<typeof LoginSession>
