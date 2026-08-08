---
name: debate-timer-sop
description: |
  Mandatory engineering collaboration SOP for the DebateTimer V3 project.
  Enforces Git commit-push discipline, CI pre-flight checks, branch strategy,
  test requirements, pre-task and post-task checklists, and engineering best practices.
  Must be loaded for EVERY code modification task in this workspace.
---

# DebateTimer V3 Engineering Collaboration SOP

## Purpose

This skill defines the compulsory engineering workflow for **DebateTimer V3** -- a Nuxt 4 full-stack debate timing & scoring system. Every code change, regardless of size, must follow the workflow defined here.

## When to Use

This skill triggers on **every task** in workspace `d:/Code/DebateTimer/DebateTimerV3`. No task is too small to skip the SOP.

## Project Context

| Item | Detail |
|------|--------|
| Framework | Nuxt 4 (SSR) |
| Frontend | Vue 3 + Pinia + @nuxt/ui |
| Backend | Nitro (server/) |
| Database | libsql via Prisma ORM |
| Language | TypeScript strict mode |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

Key directories: `app/` (frontend), `server/` (204 .ts files), `shared/` (9 .ts), `prisma/` (schema), `docs/`, `tests/`

Key scripts: `npm run dev` / `build` / `typecheck` / `test` / `test:watch` / `validate:templates`

## Mandatory Workflow

### Phase 1 -- PRE-TASK (before any code change)

Execute these steps in order. Do NOT skip any step.

1. **Sync code**: Run `git pull` to fetch the latest version.
2. **Understand context**: Read relevant files. Understand existing logic and code style.
3. **Clarify requirements**: If the requirement is ambiguous, ask the user before proceeding. Never assume.
4. **Assess impact**: Use `search_content` and `lsp` tools to find all affected files and references.
5. **Check for reuse**: Verify whether existing composables, utility functions, or components can be reused instead of writing new ones.

### Phase 2 -- DURING DEVELOPMENT

1. **Follow existing code style**: Match indentation, naming conventions, and file organization.
2. **Reuse first**: Prefer existing project utilities, composables, and components.
3. **Verify before writing**: Check database structures, API paths, and type definitions before coding.
4. **Minimize scope**: Only modify files necessary for the task. Avoid incidental refactoring.
5. **Maintain type safety**: Never introduce `any`. Use the TypeScript type system fully.
6. **Commit per logical unit**: Each commit must be a complete, independently revertible change.
   - Format: `<type>(<scope>): <description>`
   - Types: `feat` / `fix` / `refactor` / `perf` / `chore` / `style` / `docs`
   - Example: `feat(timer): add debate countdown pause feature`

### Phase 3 -- POST-TASK (after all code changes)

Execute these steps in order. Do NOT skip any step.

1. **Lint check**: Run `read_lints` on modified files. Fix all errors.
2. **Type check**: Run `npm run typecheck`. Ensure it passes.
3. **Clean up**: Delete any one-off scripts or temporary files created during development.
4. **Update docs**: If the change affects documented behavior, update the relevant files in `docs/`.
5. **Provide summary**: Tell the user what was changed, why, and any caveats.
6. **Git status check**: Run `git status` to confirm no untracked files remain that should be handled.

### Phase 4 -- COMMIT & PUSH

Execute after Phase 3 is fully complete and confirmed.

```bash
# Commit each logical unit separately
git add <related files only>
git commit -m "type(scope): description"

# Pull latest remote changes before pushing
git pull --rebase

# Push
git push origin master
```

**Commit rules:**
- One commit = one logical change (feat, fix, refactor, etc.)
- Never mix unrelated changes in a single commit
- Every commit must leave the project in a buildable, testable state

**Push rules:**
- Push after completing a group of related commits
- Push before ending a work session
- Push before switching devices
- Always `git pull --rebase` before pushing

### Phase 5 -- CI VERIFICATION

After pushing, verify CI passes on GitHub Actions:

1. Go to the repository's Actions tab.
2. Confirm all jobs pass: `typecheck`, `Prisma validate`, `unit tests`, `build check`.
3. If CI fails: read the logs, fix the issue locally, commit, and push again.

## Branch Strategy

```
master              <-- Always deployable stable version
  |-- feat/xxx      <-- Branch from master for new features
  |-- fix/xxx       <-- Branch from master for bug fixes
```

Standard flow: `branch -> develop -> commit -> push -> open PR -> CI passes -> merge to master`

## Testing Requirements

Current test coverage is critically low (1 test file vs ~286 source files). Add tests when:

| Priority | Scenario | Location |
|----------|----------|----------|
| High | Core business logic changes (timing, scoring, format calculation) | `tests/` |
| Medium | New API endpoint boundary cases | `tests/` |
| Low | Pure UI component rendering | Skip for now |

## Environment Variables

When adding or modifying environment variables, **always update `.env.example`** synchronously. Never hardcode secrets in source code.

## Prohibitions

- Do NOT modify code unrelated to the task without confirmation
- Do NOT introduce `any` types or weaken type safety
- Do NOT skip lint checks before committing
- Do NOT mix unrelated changes in a single commit
- Do NOT delete `.codebuddy/` directory or project configuration files
- Do NOT leave un-cleaned one-off scripts or temp files behind
- Do NOT skip `git pull --rebase` before pushing

## Version Rollback Reference

```bash
git log --oneline -20          # View recent commits
git revert <commit-hash>       # Rollback a commit safely
git diff <old>..<new>          # Compare two versions
git show --stat <commit-hash>  # See files in a commit
```

## Reference

For the full expanded SOP with detailed tables, examples, and rationale, see `references/sop-full.md`.
