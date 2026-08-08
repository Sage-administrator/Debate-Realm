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

Configuration: `.github/workflows/ci.yml`

### CI Checks

| Check | Command | Purpose |
|-------|---------|---------|
| Type Check | `npm run typecheck` | No TypeScript type errors |
| Prisma Validate | `npx prisma validate` | Valid database schema |
| Unit Tests | `npm run test` | Existing functionality not broken |
| Build Check | `npm run build` | Project compiles successfully |

Triggers: `push` to `master`, `pull_request` to `master`.

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
