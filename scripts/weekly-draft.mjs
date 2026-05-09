#!/usr/bin/env node
/**
 * Midea AI Lab · 每周草稿生成脚本
 *
 * 在 GitHub Actions 中每周日 22:00 (Asia/Shanghai) 自动触发。
 * 流程：
 *   1. 用 Tavily 搜索过去 7 天的 AI 重大事件
 *   2. 用 DeepSeek 整理为 5 条 weekly 卡片
 *   3. 把当前 WEEKLY 推入 WEEKLY_ARCHIVE 顶部
 *   4. 用新草稿替换 WEEKLY
 *   5. 改写 ui_kits/claude_marketing/data.js
 *   6. 输出元数据到 stdout 供 workflow 读取
 *
 * 邮件 + PR 由 workflow 在脚本之后发送。
 *
 * 需要的环境变量：
 *   TAVILY_API_KEY · DEEPSEEK_API_KEY
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'ui_kits/claude_marketing/data.js');

const TAVILY_KEY   = process.env.TAVILY_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

if (!TAVILY_KEY)   throw new Error('Missing TAVILY_API_KEY');
if (!DEEPSEEK_KEY) throw new Error('Missing DEEPSEEK_API_KEY');

/* ─── 时间工具 ─── */
function shanghaiNow() {
  const d = new Date();
  // UTC -> +8h
  return new Date(d.getTime() + 8 * 3600 * 1000);
}
function fmtDate(d, fmt) {
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  return fmt.replace('YYYY', yyyy).replace('MM', mm).replace('DD', dd);
}
function isoWeek(d) {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / (7 * 24 * 3600 * 1000));
}

const now = shanghaiNow();
const year = now.getUTCFullYear();
const week = isoWeek(now);
const weekId = `${year}-w${String(week).padStart(2, '0')}`;

// 本周一 → 周日 区间（按 ISO 周）
const monday = new Date(now);
const dow = (monday.getUTCDay() + 6) % 7; // Mon = 0
monday.setUTCDate(monday.getUTCDate() - dow);
const sunday = new Date(monday);
sunday.setUTCDate(monday.getUTCDate() + 6);

const weekOf  = `${year} · 第 ${week} 周 · ${monday.getUTCMonth() + 1} 月 ${monday.getUTCDate()} 日 — ${sunday.getUTCMonth() + 1} 月 ${sunday.getUTCDate()} 日`;
const updated = `更新于 ${fmtDate(now, 'YYYY.MM.DD')}`;
const nextDate = new Date(sunday);
nextDate.setUTCDate(sunday.getUTCDate() + 7);
const nextStr = `下次更新：${fmtDate(nextDate, 'YYYY.MM.DD')}（每周日晚）`;

console.error(`[weekly-draft] generating ${weekId}: ${weekOf}`);

/* ─── Tavily 搜索 ─── */
async function tavily(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      search_depth: 'advanced',
      max_results: 6,
      days: 8,
      include_domains: [],
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.results || [];
}

const SEARCH_QUERIES = [
  'AI model release this week (Anthropic OR OpenAI OR DeepSeek OR Google)',
  'open source AI agent release this week site:github.com OR site:huggingface.co',
  'AI research paper this week arxiv',
  'AI regulation policy this week (EU OR US OR China)',
  'AI ecommerce Shopify TikTok announcement this week',
];

console.error('[weekly-draft] running Tavily searches...');
const buckets = [];
for (const q of SEARCH_QUERIES) {
  try {
    const results = await tavily(q);
    buckets.push({ query: q, results });
  } catch (err) {
    console.error(`  · "${q}" failed: ${err.message}`);
    buckets.push({ query: q, results: [] });
  }
}

/* ─── 喂给 DeepSeek 整理 ─── */
const SYSTEM_PROMPT = `你是为 Midea AI Lab AI 周报筛选与撰写卡片的资深编辑。读者是中国跨境电商运营 + 技术团队。

输出契约：严格输出 JSON，不要 markdown，不要解释。结构：
{
  "events": [
    {
      "kind": "模型升级|开源项目|新概念|政策|公司动态",
      "title": "事件标题（中文，<= 30 字，含具体数字/版本号/品牌名）",
      "teaser": "一句话引导（中文，60-90 字，包含最具体的数字或事实）",
      "glyph": "pulse|branch|spark|shield|box",
      "body": [
        "正文段落 1（中文，对一段事实的展开，可包含 • 列表）",
        "正文段落 2",
        "正文段落 3（含对跨境电商的影响判断）"
      ]
    }
  ]
}

要求：
- 必须 5 条，5 个不同 kind 各一条（模型升级 / 开源项目 / 新概念 / 政策 / 公司动态）。如果某 kind 本周没有事件，从相邻 kind 里挑第二条好的，但 kind 标签要诚实标记，不要造假。
- 只挑过去 7 天里真实发生的事件。如果某个搜索结果是旧闻或博客综述，跳过。
- 每条卡片都必须有具体数字（参数量、价格、星数、罚款金额、用户数、百分比 等），数字必须来自搜索结果。
- "对跨境电商的影响"是必须输出的视角，但不要每条都强行扣帽子——找真有影响的角度写。
- glyph 与 kind 的对应：模型升级=pulse，开源项目=branch，新概念=spark，政策=shield，公司动态=box。
- body 段落 3-5 段，每段一个意思，可用 1-3 个 • 列表项。
- 引用具体公司/产品/作者全名，不要"某公司"。

风格：克制、编辑感、Stratechery / Anthropic Claude 的语调。不要营销腔，不要"震惊!""不可思议!"。`;

const userMsg = `搜索结果（按查询分组）：

${buckets
  .map(
    (b) =>
      `### ${b.query}\n` +
      (b.results
        .map(
          (r, i) =>
            `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${(r.content || '').slice(0, 480)}`
        )
        .join('\n\n') || '(no results)')
  )
  .join('\n\n')}

时间窗口：${fmtDate(monday, 'YYYY.MM.DD')} — ${fmtDate(sunday, 'YYYY.MM.DD')}

请输出本周 5 条 weekly 卡片的 JSON。`;

console.error('[weekly-draft] calling DeepSeek...');
async function callDeepSeek(messages) {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.4,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

const raw = await callDeepSeek([
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userMsg },
]);

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error('[weekly-draft] DeepSeek returned non-JSON:\n', raw);
  throw err;
}
if (!parsed.events || !Array.isArray(parsed.events) || parsed.events.length === 0) {
  throw new Error('DeepSeek output missing events array');
}

const events = parsed.events.slice(0, 5).map((e) => ({
  kind: e.kind || '行业',
  title: e.title || '',
  teaser: e.teaser || '',
  glyph: e.glyph || 'pulse',
  body: Array.isArray(e.body) ? e.body : [String(e.body || '')],
}));

console.error(`[weekly-draft] got ${events.length} events from DeepSeek`);

/* ─── 改写 data.js ─── */
const original = await fs.readFile(DATA_PATH, 'utf8');

// 提取当前 WEEKLY 块
const weeklyRe = /(window\.WEEKLY\s*=\s*\{)([\s\S]*?)(\n\};)/m;
const m = original.match(weeklyRe);
if (!m) throw new Error('Cannot locate window.WEEKLY in data.js');

// 解析当前 WEEKLY 提取 weekOf / events 用于归档
const currentWeeklySource = `(${m[0].replace(/^window\.WEEKLY\s*=\s*/, '')})`;
let currentWeekly = null;
try {
  // eval as JS expression — content is hand-written, low risk in CI sandbox
  currentWeekly = new Function(`return ${currentWeeklySource};`)();
} catch (err) {
  console.error('[weekly-draft] failed to eval current WEEKLY:', err.message);
}

// 旧 weekly → archive entry
function buildArchiveEntry(prev) {
  if (!prev) return null;
  // 推断 weekId：从 prev.weekOf 里抓"第 NN 周"
  const wkMatch = (prev.weekOf || '').match(/第\s*(\d+)\s*周/);
  const yMatch  = (prev.weekOf || '').match(/(\d{4})/);
  const id = wkMatch && yMatch ? `${yMatch[1]}-w${String(wkMatch[1]).padStart(2, '0')}` : `archive-${Date.now()}`;
  // summary: 前 3 条 title 拼接
  const summary = (prev.events || []).slice(0, 3).map((e) => e.title).join('、') + '。';
  return {
    weekId: id,
    weekOf: prev.weekOf || '',
    summary,
    events: prev.events || [],
  };
}
const archiveEntry = buildArchiveEntry(currentWeekly);

/* JSON-stringify with indented format that matches the file's style */
function jsLiteral(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const pad2 = '  '.repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return (
      '[\n' +
      value.map((v) => pad2 + jsLiteral(v, indent + 1)).join(',\n') +
      '\n' + pad + ']'
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return (
      '{\n' +
      entries
        .map(([k, v]) => pad2 + (/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + jsLiteral(v, indent + 1))
        .join(',\n') +
      ',\n' + pad + '}'
    );
  }
  if (typeof value === 'string') {
    // single-quote with escapes — matches the file's style
    return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
  }
  return JSON.stringify(value);
}

const newWeekly = {
  weekOf,
  updated,
  next: nextStr,
  events,
};

const newWeeklyBlock =
  'window.WEEKLY = ' + jsLiteral(newWeekly, 0) + ';';

let updatedSource = original.replace(weeklyRe, newWeeklyBlock);

// 把 archiveEntry 插到 WEEKLY_ARCHIVE 数组的开头
if (archiveEntry) {
  const archiveRe = /(window\.WEEKLY_ARCHIVE\s*=\s*\[)/;
  if (archiveRe.test(updatedSource)) {
    const entryLiteral = jsLiteral(archiveEntry, 1);
    updatedSource = updatedSource.replace(archiveRe, (full) => `${full}\n  ${entryLiteral},`);
  }
}

await fs.writeFile(DATA_PATH, updatedSource, 'utf8');
console.error('[weekly-draft] wrote', DATA_PATH);

/* ─── 输出 metadata 给 workflow ─── */
const meta = {
  weekId,
  weekOf,
  branch: `weekly-draft-${weekId}`,
  events: events.map((e) => ({ kind: e.kind, title: e.title })),
};
console.log(JSON.stringify(meta));
