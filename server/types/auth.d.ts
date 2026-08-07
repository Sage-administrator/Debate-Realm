import type { JWTPayload } from '../lib/jwt'

declare module 'h3' {
  interface H3EventContext {
    /** auth 中间件注入的已认证用户信息，未认证时为 undefined */
    user?: JWTPayload
  }
}

export {}
