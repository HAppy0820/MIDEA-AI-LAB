# Midea AI Lab · 部署指南

从 0 到上线，大约 30 分钟。零成本。

---

## 第一部分 · 建 GitHub 仓库（5 分钟）

### 1. 注册 / 登录 GitHub
- 打开 [github.com](https://github.com)，没账号就右上角 Sign up 注册
- 用户名建议短、英文、无空格。注册后这个名字就是你的 `owner`

### 2. 新建一个 repo
- 右上角 **+** → **New repository**
- 填：
  - **Repository name**: `midea-ai-lab`（或你喜欢的名字）
  - **Visibility**: Private（私有）就行，部署到 Vercel 一样能访问
  - 勾上 **Add a README file**
- 点绿色 **Create repository**

### 3. 把项目代码推上去
最简单的方法：直接在网页上传。

- 进入新建的 repo，点 **Add file → Upload files**
- 把整个项目文件夹拖进去（包括 `ui_kits/`、`admin/`、所有 HTML/CSS/JS）
- 滚到底部，点 **Commit changes**

---

## 第二部分 · 生成 GitHub Token（3 分钟）

后台需要这个 Token 才能自动提交。

1. 打开 [GitHub Settings → Developer settings → Personal access tokens (Fine-grained)](https://github.com/settings/personal-access-tokens/new)
2. 填：
   - **Token name**: `midea-ai-lab-admin`
   - **Expiration**: 1 year（一年后再换）
   - **Repository access** → **Only select repositories** → 选你刚建的 `midea-ai-lab`
   - **Permissions** → **Repository permissions** → 找到 **Contents** → 选 **Read and write**
3. 滚到底部点 **Generate token**
4. **复制 token**（只显示这一次！）。粘贴到后台「设置」页的 GitHub Token 字段。

---

## 第三部分 · 部署到 Vercel（5 分钟，免费）

### 1. 注册 Vercel
- 打开 [vercel.com](https://vercel.com) → **Sign Up** → 选 **Continue with GitHub**
- 授权 Vercel 访问你的 GitHub

### 2. Import 你的 repo
- 进入 Vercel Dashboard → **Add New... → Project**
- 找到 `midea-ai-lab` → **Import**
- 配置项保持默认，**Framework Preset** 选 **Other**
- 点 **Deploy**
- 等 1-2 分钟，绿色 ✓ 就上线了

### 3. 拿到你的网址
- 部署完成后，Vercel 会给你一个域名，类似：
  - `https://midea-ai-lab.vercel.app`
- 用户访问这个网址 + `/ui_kits/claude_marketing/index.html` 就是对外站点
- 后台地址：上面那个 + `/admin/index.html`

### 4.（可选）绑自己的域名
- 在 Vercel 项目设置里 → **Domains** → **Add** → 填你买的域名
- 按提示改 DNS 记录就行

---

## 第三点五部分 · Tavily 搜索 API（让 AI 真的能联网）

让"AI 抓取本周事件"按钮真正自己上网搜，而不是只整理你贴的素材。

1. 打开 [tavily.com](https://tavily.com) → **Get API Key**
2. 用 Google / GitHub 登录就行，免费额度每月 1000 次搜索（绝对够你每周用）
3. 进 dashboard，复制 API Key（`tvly-...` 开头）
4. 粘到后台「设置」页的 **Tavily Key** 字段（我下一版会加这个字段）

---

## 第三点六部分 · 半自动周更（推荐）

让 GitHub 每周日晚自己跑搜索 + 整理 + 推 PR + 发邮件给你审核。你周一早 8 点收到邮件，看一眼，点 Merge 就上线。

**前置：** Resend 账号（发邮件，免费 100 封/天）+ 已经有 Tavily Key + DeepSeek Key。

### 1. 注册 Resend
- 打开 [resend.com](https://resend.com) → Sign Up → 用 GitHub 登录就行
- 进 Dashboard → **API Keys** → **Create API Key** → 任意起名 → 复制 `re_xxx` 开头的 Key

### 2. 在 GitHub repo 设置 Secrets

进 repo → **Settings → Secrets and variables → Actions → New repository secret**，添加四个：

| Name | Value |
|---|---|
| `TAVILY_API_KEY`   | 你的 Tavily Key |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek Key |
| `RESEND_API_KEY`   | 上一步的 Resend Key |
| `NOTIFY_EMAIL`     | 你想接收草稿的邮箱（如 `you@qq.com`） |

### 3. 完成

`.github/workflows/weekly-draft.yml` 已经在 repo 里。下次周日 22:00（北京时间）GitHub 会自动：
1. 运行 `scripts/weekly-draft.mjs`：Tavily 搜过去 7 天 5 大类 AI 事件 → DeepSeek 整理为 5 条卡片 → 把当前 WEEKLY 推入 archive，写入新 WEEKLY
2. 自动开一条 PR，分支名 `weekly-draft-2026-w19`
3. 用 Resend 发一封邮件给 `NOTIFY_EMAIL`，含 PR 链接 + 5 条标题预览

### 4. 你的操作

周一早 8 点收到邮件 →

- **内容 OK** → 点邮件里的 PR 链接 → GitHub 上点 **Merge** → Vercel 1-2 分钟自动部署 → 上线
- **想改** → 直接打开后台 `/admin/index.html` 改完保存（推到 main，PR 自动失效）
- **不想发** → PR 里点 **Close**，本周跳过

### 5. 手动触发（测试用）

不想等到周日？进 repo → **Actions → Weekly Draft → Run workflow**，立即跑一次。

---

## 第四部分 · 每周更新流程

### 假设是周日晚上：

1. 打开后台 `https://你的域名/admin/index.html`
2. 输入你设的登录密码
3. 进「每周大事件」页
4. 选一种方式：
   - **A 方式（手动）**：把本周看到的新闻链接 + 摘要粘到顶部素材框 → 点「AI 整理为 5 条卡片」
   - **B 方式（自动，需 Tavily）**：直接点「AI 自动搜索本周」→ Tavily 联网搜 + DeepSeek 整理
5. 5 张卡片自动填好。审核 + 修改不准确的地方
6. 点底部 **保存到 GitHub**
7. 大约 30 秒后，Vercel 自动重新部署，线上更新完成

---

## 常见问题

**Q: GitHub Token 误泄露了怎么办？**
A: 立刻去 [Token 列表](https://github.com/settings/tokens?type=beta) 删除该 token，重新生成一个。

**Q: 想换电脑用后台？**
A: 在新电脑访问 `/admin/index.html`，重新设密码、重新填 GitHub Token / DeepSeek Key 就行。所有内容都从 GitHub 拉。

**Q: 误删了内容怎么办？**
A: GitHub 自动保存所有历史版本。进 repo → 点 `data.js` → **History** → 找到之前的版本 → 复制粘回去。

**Q: 想给同事看后台但不想给 token？**
A: 后台是纯前端，每个人在自己电脑上配自己的 token 就行。一份 token 不要共享。
