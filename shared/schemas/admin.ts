/**
 * Admin schemas (Batch A9)
 */
import { z } from 'zod'
import { UserRole } from './common'

/** Admin create user */
export const AdminCreateUserRequest = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: UserRole,
  mode: z.string(),
  teamId: z.string().optional(),
})
export type AdminCreateUserRequest = z.infer<typeof AdminCreateUserRequest>
