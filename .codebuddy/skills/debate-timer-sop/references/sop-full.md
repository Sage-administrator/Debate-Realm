# DebateTimer V3 -- Full Engineering SOP Reference

> This document contains the expanded SOP with detailed tables, examples, and rationale.
> For the mandatory workflow and rules, refer to `SKILL.md`.

---

## Git Commit Guidelines (Expanded)

### When to Commit

Commit by **logical unit**, not by time or file count. Each commit must be a complete, independently revertible change.

| Trigger | Example |
|---------|---------|
| Feature completed | `feat(timer): add pause/resume` |
| Bug fixed | `fix(auth): fix token expiry not refreshing` |
| Refactoring done | `refactor(layout): extract shared composable` |
| Stable checkpoint reached | Code compiles, tests pass |

### Commit Message Format

```
type(scope): short description
```

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat(timer): add debate countdown pause` |
| `fix` | Bug fix | `fix(auth): fix token expiry not refreshing` |
| `refactor` | Refactor (no behavior change) | `refactor(api): unify error handling middleware` |
| `perf` | Performance optimization | `perf(tournaments): use useAsyncData prefetch` |
| `chore` | Misc (config, deps, etc.) | `chore: update vitest config` |
| `style` | Code style (no logic change) | `style: normalize indentation` |
| `docs` | Documentation | `docs: add API endpoint documentation` |

### When to Push

| When | Why |
|------|-----|
| After completing a group of related commits | E.g., 3 commits for one feature -> push together |
| End of work session | Ensure remote backup |
| Before switching devices | Ensure latest code on other device |
| When collaboration needed | Others need your changes |

---

## CI Pipeline Details

Configuration:
- `.github/workflows/ci.yml` — 7 个并行 Job 的 CI 流水线
- `.github/workflows/deploy.yml` — CD 部署流水线（staging 自动 + production 手动）

### CI Jobs（全部并行，总耗时 ≈ 最慢 Job = ~3min）

| Job | Command | Purpose |
|-----|---------|---------|
| Format & Lint | `npm run format:check` + `npm run lint` | 代码风格一致性 |
| Type Check | `npm run typecheck` | TypeScript 类型正确性 |
| Template Validate | `npm run validate:templates` | 辩论模板 Schema 对齐 |
| Prisma Validate | `npx prisma validate` | 数据库 Schema 有效性 |
| Security Audit | `npm audit --audit-level=high` | 已知漏洞扫描 |
| Unit Tests | `npm run test` (+ `--coverage`) | 现有功能未被破坏 |
| Build Check | `npm run build` | 项目可成功构建（依赖 typecheck 通过） |

Triggers: `push` to `master`, `pull_request` to `master`, `workflow_dispatch` (手动)。

并发控制: 同一分支/PR 的新 push 自动取消旧的进行中任务。

### CD Pipeline（部署）

| Job | 触发条件 | 目标 |
|-----|----------|------|
| deploy-staging | push to master 或 手动选择 staging | Staging 环境 |
| deploy-production | 手动触发 + 选择 production（需 environment 审批） | 生产环境 |

部署命令为占位模板，需根据实际服务器/Docker/云服务环境补充。

### GitHub Environments 配置

在 `Settings → Environments` 中创建 `staging` 和 `production` 两个 environment，分别配置：
- `STAGING_HOST` / `STAGING_PORT` (staging secrets)
- `PROD_HOST` / `PROD_PORT` (production secrets)
- `production` environment 建议开启 required reviewers 保护规则

### CI Failure Recovery

```
CI fails -> Check GitHub Actions logs -> Fix locally -> Commit + Push -> CI re-runs -> Pass [OK]
```

---

## Test Coverage Requirements (Expanded)

Current state: 1 test file vs. ~286 source files (critically low).

### What to Test (by priority)

| Priority | What | Risk if skipped |
|----------|------|-----------------|
| * High | Core business logic: timing, scoring, format calculation | Critical bugs in production |
| * Medium | API endpoint boundary cases | Edge case failures |
| * Low | Pure UI component rendering | Visual-only issues |

---

## Scripts Directory Management

- One-off scripts: clean up after use, or annotate purpose clearly
- `.bak` files: add to `.gitignore`
- Long-term useful scripts: keep with clear documentation

---

## Docs Maintenance

| Change Type | Doc to Update |
|-------------|---------------|
| Major feature | `docs/` relevant docs |
| New API | `API.md` |
| Architecture change | `docs/ARCHITECTURE.md` |
| Route change | `ROUTES.md` |

---

## Version History Tracing

### Git Commands

```bash
# View commit history
git log --oneline -20

# View specific commit diff
git diff <commit-hash>

# View file change history
git log --oneline -- <file-path>

# View files in a commit
git show --stat <commit-hash>

# Compare two versions
git diff <old-commit>..<new-commit>
```

### GitHub Tracing

- Repository -> Commits: All commit history
- Repository -> Actions: CI run history and logs
- Each commit and CI run has a unique identifier for precise backtracking

### Rollback

```bash
git revert <commit-hash>    # Safe rollback, preserves history
```

---

*This reference is part of the debate-timer-sop skill. Last updated: 2026-08-08*
