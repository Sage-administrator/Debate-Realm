# Agent 协作规范 (Agent Prompt SOP)

> 本文档定义了 AI Agent 与 DebateTimer V3 项目协作时必须遵循的全部工程规范。
> Agent 在开始任何代码修改前，应首先阅读并遵循本文档。

---

## 1. 项目背景速览

| 项目 | 说明 |
|------|------|
| **名称** | DebateTimer V3 |
| **定位** | 辩论赛计时、评分、赛制管理全栈系统 |
| **框架** | Nuxt 4（SSR 全栈） |
| **前端** | Vue 3 + Pinia + @nuxt/ui |
| **后端** | Nitro（Nuxt server/） |
| **数据库** | libsql（通过 Prisma ORM） |
| **语言** | TypeScript（严格模式） |

### 关键目录速查

| 目录 | 用途 |
|------|------|
| `app/` | 前端页面与组件（82 个 .vue，28 个 .ts） |
| `server/` | 后端 API 与服务端逻辑（204 个 .ts） |
| `shared/` | 前后端共享的类型与工具（9 个 .ts） |
| `prisma/` | 数据库 Schema |
| `docs/` | 项目文档与架构说明 |
| `scripts/` | 辅助脚本（一次性工具、验证脚本等） |
| `tests/` | 测试文件 |
| `public/` | 静态资源 |

### 关键配置文件

| 文件 | 作用 |
|------|------|
| `nuxt.config.ts` | Nuxt 主配置 |
| `tsconfig.json` | TypeScript 配置 |
| `package.json` | 依赖与脚本 |
| `vitest.config.ts` | 测试配置 |
| `.github/workflows/ci.yml` | CI 流水线 |

### 可用 npm scripts

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行全部测试 |
| `npm run test:watch` | 测试监听模式 |
| `npm run validate:templates` | 验证辩论模板 |

---

## 2. Git 工作流程 SOP

### 2.1 提交时机

**按逻辑单元提交，而非按时间或文件数量。** 每个 commit 必须是一个完整、可独立回滚的变更。

| 触发时机 | 示例 |
|----------|------|
| 完成一个功能/特性 | `feat(timer): 添加暂停/恢复功能` |
| 修复一个 bug | `fix(auth): 修复 token 过期未刷新` |
| 完成一次重构 | `refactor(layout): 抽取公共 composable` |
| 达到阶段性稳定状态 | 当前代码可编译、测试通过 |

**原则：每个 commit 都能独立回滚，不会让项目处于"半成品"状态。**

### 2.2 推送时机

| 时机 | 说明 |
|------|------|
| **完成一组相关 commit 后** | 比如一个功能拆成 3 个 commit，全部完成后一起 push |
| **每天收工前** | 保证远程有备份 |
| **切换设备前** | 确保另一台设备能拉到最新 |
| **需要协作/分享时** | 别人需要看到你的改动 |

### 2.3 标准操作流程

```bash
# ========== 开始工作前 ==========
git pull                      # 同步最新代码

# ========== 开发过程中 ==========
# ... 编写代码 ...

git add <相关文件>             # 只 add 本次逻辑相关的文件
git commit -m "类型(范围): 描述"

# 如果有多个逻辑单元，重复上述 add + commit

# ========== 开发完成后 ==========
git pull --rebase             # 先拉取远程更新，避免冲突
git push origin master        # 推送
```

### 2.4 Commit 信息规范

```
类型(范围): 简短描述
```

| 类型 | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(timer): 添加辩论计时暂停功能` |
| `fix` | 修 bug | `fix(auth): 修复 token 过期未刷新问题` |
| `refactor` | 重构（不改变功能） | `refactor(api): 统一错误处理中间件` |
| `perf` | 性能优化 | `perf(tournaments): 使用 useAsyncData 预取` |
| `chore` | 杂项（配置、依赖等） | `chore: 更新 vitest 配置` |
| `style` | 代码风格（不影响逻辑） | `style: 统一缩进格式` |
| `docs` | 文档 | `docs: 添加 API 接口说明` |

### 2.5 分支策略

```
master              ← 始终可部署的稳定版本
  ├── feat/xxx      ← 从 master 切出，开发新功能
  └── fix/xxx       ← 从 master 切出，修 bug
```

**标准流程：** `切分支 → 开发 → commit → push → 提 PR → CI 通过 → 合并回 master`

---

## 3. CI 说明

### 3.1 什么是 CI

**CI（Continuous Integration，持续集成）** 是自动化验证流程。每次 `git push` 后，CI 系统自动运行检查，确保代码质量。

### 3.2 CI 与 Git 的关系

```
你本地开发 → git commit → git push → 触发 CI 自动运行
                                        ↓
                          跑测试、检查代码、构建项目
                                        ↓
                          通过 ✅ → 代码没问题
                          失败 ❌ → 通知你修复
```

Git 管"代码版本"，CI 管"代码质量"。

### 3.3 项目 CI 配置

配置文件：`.github/workflows/ci.yml`

| 检查项 | 命令 | 说明 |
|--------|------|------|
| Type Check | `npm run typecheck` | 确保 TypeScript 无类型错误 |
| Prisma Validate | `npx prisma validate` | 确保数据库 Schema 有效 |
| Unit Tests | `npm run test` | 确保已有功能未被破坏 |
| Build Check | `npm run build` | 确保项目能正常编译 |

触发条件：`push` 到 `master` 分支，或 `pull_request` 到 `master` 分支。

### 3.4 CI 失败处理

```
CI 失败 ❌
  → 查看 GitHub Actions 日志定位具体错误
  → 本地修复问题
  → git add + git commit + git push
  → CI 重新运行
  → 通过 ✅
```

---

## 4. 工程设计流程规范

### 4.1 善前工作（开始前）

每次开始修改代码前，Agent 必须：

- [ ] **同步代码**：`git pull` 获取最新版本
- [ ] **理解上下文**：阅读相关文件，理解现有逻辑和代码风格
- [ ] **确认需求**：如果需求不明确，先向用户确认，不自行假设
- [ ] **评估影响范围**：使用 `search_content` / `lsp` 查找所有受影响的文件和引用
- [ ] **检查现有实现**：确认是否有现成的 composable、工具函数、组件可复用

### 4.2 开发中规范

- **遵循现有代码风格**：缩进、命名、文件组织方式与项目保持一致
- **复用优先**：优先使用项目中已有的工具函数、composable、组件
- **不假设不确定的事**：数据库结构、API 路径、类型定义等，先查后写
- **最小化改动范围**：只修改必要的文件，避免不必要的重构
- **保持类型安全**：不引入 `any`，充分利用 TypeScript 类型系统
- **每个 commit 独立完整**：一个 commit 解决一个明确的问题

### 4.3 善后工作（完成后）

每次完成代码修改后，Agent 必须：

- [ ] **Lint 检查**：确保无 lint 错误（`read_lints` 工具）
- [ ] **类型检查**：确保 `npm run typecheck` 能通过（如可行）
- [ ] **清理临时文件**：删除开发过程中创建的一次性脚本或临时文件
- [ ] **更新文档**：如果功能变更影响现有文档，同步更新 `docs/` 目录
- [ ] **变更摘要**：向用户说明改了什么、为什么改、有无注意事项
- [ ] **Git 状态检查**：确认无遗留的未跟踪文件需要处理（`git status`）

### 4.4 测试要求

当前项目测试覆盖率严重不足（1 个测试文件 vs 286 个源文件）。Agent 在以下情况应补充测试：

| 优先级 | 场景 | 位置 |
|--------|------|------|
| 🔴 高 | 核心业务逻辑变更（计时、评分、赛制计算） | `tests/` 目录 |
| 🟡 中 | 新增 API 端点的边界情况 | `tests/` 目录 |
| 🟢 低 | 纯 UI 组件渲染 | 暂可跳过 |

### 4.5 环境变量

- 修改或新增环境变量时，**必须同步更新 `.env.example`**
- 不在代码中硬编码敏感信息

### 4.6 scripts 目录管理

- 一次性脚本用完后考虑清理，或标注用途
- `.bak` 等临时文件应加入 `.gitignore`
- 长期有用的脚本保留并注明功能

### 4.7 文档维护

- 重大功能变更 → 更新 `docs/` 下相关文档
- 新增 API → 更新 `API.md`
- 架构变更 → 更新 `docs/ARCHITECTURE.md`
- 路由变更 → 更新 `ROUTES.md`

---

## 5. 版本追溯

### 5.1 追溯历史变更

```bash
# 查看提交历史
git log --oneline -20

# 查看某次提交的具体改动
git diff <commit-hash>

# 查看某个文件的修改历史
git log --oneline -- <file-path>

# 查看某次提交包含的文件
git show --stat <commit-hash>

# 对比两个版本
git diff <old-commit>..<new-commit>
```

### 5.2 通过 GitHub 追溯

- GitHub 仓库 → Commits 页面：查看所有提交历史
- GitHub 仓库 → Actions 页面：查看 CI 运行历史和日志
- 每次 commit 和 CI 运行都有唯一标识，可精确回溯

### 5.3 回滚操作

```bash
# 回滚到某次提交（保留工作区）
git revert <commit-hash>

# 查看可回滚的提交
git log --oneline
```

---

## 6. Agent 协作总则

### 6.1 Agent 行为准则

1. **先查后写**：修改任何代码前，先阅读相关文件理解上下文
2. **不确定就问**：遇到不明确的需求，先向用户确认，不自行假设
3. **最小化改动**：只改必要的部分，不做无关重构
4. **变更可见**：每次完成后提供清晰的变更摘要
5. **遵守本 SOP**：commit 规范、善前善后流程必须严格执行

### 6.2 Agent 修改代码后的完整流程

```
1. 理解需求 → 确认范围
2. 阅读相关代码 → 查找受影响文件
3. 实施修改 → 确保类型安全
4. 检查 lint → 修复错误
5. 补充测试（如涉及核心逻辑）
6. 清理临时文件
7. 提供变更摘要给用户
8. 按本规范 commit + push
```

### 6.3 不要做的事

- ❌ 未经确认就修改与需求无关的代码
- ❌ 引入 `any` 类型或降低类型安全
- ❌ 跳过 lint 检查直接提交
- ❌ 在 commit 中混入不相关的改动
- ❌ 删除 `.codebuddy` 目录或项目配置文件
- ❌ 留下未清理的一次性脚本和临时文件

---

*本文档随项目演进持续更新。最后一次更新：2026-08-08*
