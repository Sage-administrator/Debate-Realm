/**
 * shared/schemas 边界验证测试
 * 验证 Zod Schema 的必填字段、类型约束、枚举值边界
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Import schemas
import { LoginRequest, ChangePasswordRequest, LoginResponse } from '../../../shared/schemas/auth'
import {
  CreateMatchRequest,
  SubmitResultRequest,
  SubmitScoreRequest,
} from '../../../shared/schemas/match'
import { CreateTournamentRequest } from '../../../shared/schemas/tournament'
import { CreateTimerProjectRequest, TimerStage } from '../../../shared/schemas/timer'
import {
  ID,
  UserRole,
  TournamentFormat,
  MatchStatus,
  StageType,
  RegistrationAllowedType,
  VoteStatus,
  QuestionnaireStatus,
  ApiResponse,
  PaginatedResponse,
} from '../../../shared/schemas/common'

// ===================== Common Enums =====================

describe('common schemas', () => {
  describe('UserRole', () => {
    it('should accept valid roles', () => {
      expect(UserRole.safeParse('system_admin').success).toBe(true)
      expect(UserRole.safeParse('admin').success).toBe(true)
      expect(UserRole.safeParse('subaccount').success).toBe(true)
      expect(UserRole.safeParse('debater').success).toBe(true)
      expect(UserRole.safeParse('individual').success).toBe(true)
    })

    it('should reject invalid role', () => {
      expect(UserRole.safeParse('super_admin').success).toBe(false)
      expect(UserRole.safeParse('').success).toBe(false)
    })
  })

  describe('TournamentFormat', () => {
    it('should accept all 7 formats', () => {
      const formats = [
        'single_elimination',
        'double_elimination',
        'round_robin',
        'page_playoff',
        'swiss',
        'group_knockout',
        'manual',
      ]
      for (const f of formats) {
        expect(TournamentFormat.safeParse(f).success).toBe(true)
      }
    })
  })

  describe('StageType', () => {
    it('should accept all 9 types', () => {
      const types = [
        'single_speech',
        'single_question',
        'summary',
        'bilateral_debate',
        'free_debate',
        'single_timer',
        'double_timer',
        'no_timer',
        'ppt_replace',
      ]
      for (const t of types) {
        expect(StageType.safeParse(t).success).toBe(true)
      }
    })
  })

  describe('ID', () => {
    it('should accept non-empty string', () => {
      expect(ID.safeParse('abc123').success).toBe(true)
    })

    it('should reject empty string', () => {
      expect(ID.safeParse('').success).toBe(false)
    })

    it('should reject non-string', () => {
      expect(ID.safeParse(123).success).toBe(false)
      expect(ID.safeParse(null).success).toBe(false)
    })
  })

  describe('ApiResponse', () => {
    it('should accept valid response shape', () => {
      const schema = ApiResponse(z.string())
      expect(schema.safeParse({ data: 'hello' }).success).toBe(true)
      expect(schema.safeParse({ code: 200, data: 'hello' }).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(true) // all optional
    })
  })

  describe('PaginatedResponse', () => {
    it('should require items array and pagination fields', () => {
      const schema = PaginatedResponse(z.string())
      const valid = { items: ['a'], total: 1, page: 1, pageSize: 20 }
      expect(schema.safeParse(valid).success).toBe(true)
    })

    it('should reject missing total', () => {
      const schema = PaginatedResponse(z.string())
      expect(schema.safeParse({ items: [], page: 1, pageSize: 20 }).success).toBe(false)
    })
  })
})

// ===================== Auth Schemas =====================

describe('auth schemas', () => {
  describe('LoginRequest', () => {
    it('should accept valid login', () => {
      expect(LoginRequest.safeParse({ username: 'test', password: '123456' }).success).toBe(true)
    })

    it('should reject empty username', () => {
      expect(LoginRequest.safeParse({ username: '', password: '123456' }).success).toBe(false)
    })

    it('should reject empty password', () => {
      expect(LoginRequest.safeParse({ username: 'test', password: '' }).success).toBe(false)
    })

    it('should reject missing fields', () => {
      expect(LoginRequest.safeParse({ username: 'test' }).success).toBe(false)
      expect(LoginRequest.safeParse({}).success).toBe(false)
    })
  })

  describe('ChangePasswordRequest', () => {
    it('should accept valid request', () => {
      expect(
        ChangePasswordRequest.safeParse({ oldPassword: 'old', newPassword: 'new123' }).success,
      ).toBe(true)
    })

    it('should reject newPassword shorter than 6', () => {
      expect(
        ChangePasswordRequest.safeParse({ oldPassword: 'old', newPassword: '12345' }).success,
      ).toBe(false)
    })
  })

  describe('LoginResponse (discriminated union)', () => {
    it('should parse needConfirm=false variant', () => {
      const result = LoginResponse.safeParse({
        needConfirm: false,
        token: 'jwt-token',
        user: {
          id: 'u1',
          username: 'test',
          nickname: null,
          role: 'admin',
          mode: 'qq_bot',
          teamId: null,
        },
      })
      expect(result.success).toBe(true)
    })

    it('should parse needConfirm=true variant', () => {
      const result = LoginResponse.safeParse({
        needConfirm: true,
        userId: 'u1',
        existingSessions: [
          { id: 's1', deviceInfo: 'Chrome', ipAddress: null, loggedInAt: '2024-01-01' },
        ],
        newDevice: { deviceInfo: 'Firefox', ipAddress: '1.2.3.4' },
      })
      expect(result.success).toBe(true)
    })

    it('should reject incompatible shape', () => {
      expect(LoginResponse.safeParse({ needConfirm: false, token: 'x' }).success).toBe(false)
    })
  })
})

// ===================== Match Schemas =====================

describe('match schemas', () => {
  describe('CreateMatchRequest', () => {
    it('should accept valid request', () => {
      const valid = { round: '第1轮', orderNum: 1 }
      expect(CreateMatchRequest.safeParse(valid).success).toBe(true)
    })

    it('should reject empty round', () => {
      expect(CreateMatchRequest.safeParse({ round: '', orderNum: 1 }).success).toBe(false)
    })

    it('should reject orderNum < 1', () => {
      expect(CreateMatchRequest.safeParse({ round: '第1轮', orderNum: 0 }).success).toBe(false)
    })

    it('should accept optional team fields', () => {
      const valid = {
        round: '第1轮',
        orderNum: 1,
        teamA: 'T1',
        teamB: 'T2',
        scheduledAt: '2024-01-01',
      }
      expect(CreateMatchRequest.safeParse(valid).success).toBe(true)
    })
  })

  describe('SubmitResultRequest', () => {
    it('should accept valid result', () => {
      expect(SubmitResultRequest.safeParse({ winner: 'T1', scoreA: 3, scoreB: 0 }).success).toBe(
        true,
      )
    })

    it('should reject empty winner', () => {
      expect(SubmitResultRequest.safeParse({ winner: '', scoreA: 3, scoreB: 0 }).success).toBe(
        false,
      )
    })
  })

  describe('SubmitScoreRequest', () => {
    it('should accept valid judge scores', () => {
      const valid = {
        matchId: 'm1',
        judgeName: '评委A',
        dimensions: [
          { name: '论点', score: 90 },
          { name: '表达', score: 85 },
        ],
        scoreTeamA: 175,
        scoreTeamB: 180,
        winner: 'T2',
      }
      expect(SubmitScoreRequest.safeParse(valid).success).toBe(true)
    })

    it('should reject negative score', () => {
      const invalid = {
        matchId: 'm1',
        judgeName: '评委A',
        dimensions: [{ name: '论点', score: -1 }],
        scoreTeamA: 175,
        scoreTeamB: 180,
        winner: 'T2',
      }
      expect(SubmitScoreRequest.safeParse(invalid).success).toBe(false)
    })
  })
})

// ===================== Tournament Schemas =====================

describe('tournament schemas', () => {
  describe('CreateTournamentRequest', () => {
    it('should accept valid request', () => {
      expect(CreateTournamentRequest.safeParse({ name: '辩论赛' }).success).toBe(true)
    })

    it('should reject empty name', () => {
      expect(CreateTournamentRequest.safeParse({ name: '' }).success).toBe(false)
    })

    it('should accept optional fields', () => {
      const valid = {
        name: '辩论赛',
        description: '描述',
        format: 'single_elimination' as const,
        scheduledAt: '2024-01-01',
        venue: '线上',
        teams: ['T1', 'T2'],
      }
      expect(CreateTournamentRequest.safeParse(valid).success).toBe(true)
    })

    it('should reject invalid format', () => {
      const invalid = { name: 'test', format: 'invalid_format' }
      expect(CreateTournamentRequest.safeParse(invalid).success).toBe(false)
    })
  })
})

// ===================== Timer Schemas =====================

describe('timer schemas', () => {
  describe('TimerStage', () => {
    it('should accept valid stage with required fields', () => {
      expect(
        TimerStage.safeParse({
          name: '立论',
          duration: 180,
          type: 'single_speech',
          orderIndex: 0,
        }).success,
      ).toBe(true)
    })

    it('should reject negative duration', () => {
      expect(
        TimerStage.safeParse({
          name: '立论',
          duration: -1,
          type: 'single_speech',
          orderIndex: 0,
        }).success,
      ).toBe(false)
    })

    it('should reject empty name', () => {
      expect(
        TimerStage.safeParse({
          name: '',
          duration: 180,
          type: 'single_speech',
          orderIndex: 0,
        }).success,
      ).toBe(false)
    })

    it('should accept optional fields', () => {
      expect(
        TimerStage.safeParse({
          name: '对辩',
          duration: 300,
          type: 'bilateral_debate',
          orderIndex: 1,
          positiveDuration: 240,
          negativeDuration: 240,
          speaker: '正方一辩',
        }).success,
      ).toBe(true)
    })
  })

  describe('CreateTimerProjectRequest', () => {
    it('should accept empty request (all optional)', () => {
      expect(CreateTimerProjectRequest.safeParse({}).success).toBe(true)
    })

    it('should accept partial fields', () => {
      expect(
        CreateTimerProjectRequest.safeParse({ name: 'My Project', title: '比赛' }).success,
      ).toBe(true)
    })
  })
})
