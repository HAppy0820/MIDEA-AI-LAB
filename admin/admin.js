/* ─────────────────────────────────────────────────────────
   Midea AI Lab — Admin
   Vanilla JS, no build step. State is in memory + localStorage.
   ───────────────────────────────────────────────────────── */

const LS = {
  PW_HASH: 'mal_pw_hash',
  CFG: 'mal_cfg',          // {ghToken, ghOwner, ghRepo, ghBranch, ghPath, dsKey}
  DRAFT: 'mal_draft',      // last loaded data (TIMELINE/WEEKLY/ESSAYS) so reload survives
};

const DEFAULT_CFG = {
  ghToken: '',
  ghOwner: '',
  ghRepo: '',
  ghBranch: 'main',
  ghPath: 'ui_kits/claude_marketing/data.js',
  dsKey: '',
  dsModel: 'deepseek-chat',
  tavilyKey: '',
};

let state = {
  cfg: { ...DEFAULT_CFG },
  data: { TIMELINE: [], WEEKLY: { weekOf:'', updated:'', next:'', events:[] }, ESSAYS: [] },
  dirty: false,
  tab: 'weekly',
  loading: false,
};

/* ─── Tiny crypto for password (SHA-256 → hex) ─── */
async function sha256(s){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* ─── Toast ─── */
function toast(msg, kind='info', ms=3200){
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind==='success'?'success':kind==='error'?'error':'');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)'; setTimeout(()=>el.remove(), 260); }, ms);
}

/* ─── Login flow ─── */
async function initLogin(){
  document.getElementById('login-screen').style.display='flex';
  const hash = localStorage.getItem(LS.PW_HASH);
  if(!hash){
    document.getElementById('login-set').style.display='block';
  } else {
    document.getElementById('login-enter').style.display='block';
    document.getElementById('enter-pw').focus();
  }
  document.getElementById('btn-set-pw').onclick = async () => {
    const a = document.getElementById('set-pw1').value;
    const b = document.getElementById('set-pw2').value;
    if(a.length < 6) return toast('密码至少 6 位','error');
    if(a !== b) return toast('两次输入不一致','error');
    localStorage.setItem(LS.PW_HASH, await sha256(a));
    enterApp();
  };
  document.getElementById('btn-enter').onclick = async () => {
    const v = document.getElementById('enter-pw').value;
    const got = await sha256(v);
    if(got !== localStorage.getItem(LS.PW_HASH)) return toast('密码错误','error');
    enterApp();
  };
  document.getElementById('btn-reset-pw').onclick = () => {
    if(!confirm('这会清空本机所有配置（API key、GitHub token、密码），不会影响线上数据。确认？')) return;
    localStorage.removeItem(LS.PW_HASH);
    localStorage.removeItem(LS.CFG);
    localStorage.removeItem(LS.DRAFT);
    location.reload();
  };
  document.getElementById('enter-pw').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-enter').click(); });
  document.getElementById('set-pw2').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('btn-set-pw').click(); });
}

async function enterApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='grid';
  loadCfg();
  loadDraft();
  bindNav();
  document.getElementById('btn-logout').onclick = () => location.reload();
  // Auto-load existing data.js (locally bundled with this project)
  if(!state.data.TIMELINE.length){ await loadFromLocal(); }
  renderStatus();
  switchTab(state.tab);
}

function loadCfg(){
  try { state.cfg = { ...DEFAULT_CFG, ...JSON.parse(localStorage.getItem(LS.CFG)||'{}') }; }
  catch(e){ state.cfg = { ...DEFAULT_CFG }; }
}
function saveCfg(){ localStorage.setItem(LS.CFG, JSON.stringify(state.cfg)); renderStatus(); }
function loadDraft(){
  try {
    const d = JSON.parse(localStorage.getItem(LS.DRAFT)||'null');
    if(d) state.data = d;
  } catch(e){}
}
function saveDraft(){ localStorage.setItem(LS.DRAFT, JSON.stringify(state.data)); }
function markDirty(){ state.dirty = true; saveDraft(); document.getElementById('st-dirty').textContent = '有'; }
function clearDirty(){ state.dirty = false; document.getElementById('st-dirty').textContent = '0'; }

function renderStatus(){
  const gh = document.getElementById('st-gh');
  const ds = document.getElementById('st-ds');
  if(state.cfg.ghToken && state.cfg.ghOwner && state.cfg.ghRepo){
    gh.textContent = state.cfg.ghOwner + '/' + state.cfg.ghRepo;
    gh.className = 'ok';
  } else { gh.textContent = '未配置'; gh.className = 'warn'; }
  if(state.cfg.dsKey){ ds.textContent = '已配置'; ds.className = 'ok'; }
  else { ds.textContent = '未配置'; ds.className = 'warn'; }
}

/* ─── Load from local ../ui_kits/claude_marketing/data.js ─── */
async function loadFromLocal(){
  try {
    const res = await fetch('../ui_kits/claude_marketing/data.js?t=' + Date.now());
    const txt = await res.text();
    parseDataJs(txt);
    saveDraft();
    toast('已从本地 data.js 载入内容','success');
  } catch(e){ console.warn(e); toast('本地 data.js 载入失败：'+e.message,'error'); }
}

function parseDataJs(txt){
  // Strip then eval-as-window: wrap in a sandboxed function to extract window.X
  const sandbox = { TIMELINE: [], WEEKLY: {}, ESSAYS: [] };
  try {
    const fn = new Function('window', txt + '\n;return window;');
    const w = fn(sandbox);
    if(Array.isArray(w.TIMELINE)) state.data.TIMELINE = w.TIMELINE;
    if(w.WEEKLY) state.data.WEEKLY = w.WEEKLY;
    if(Array.isArray(w.ESSAYS)) state.data.ESSAYS = w.ESSAYS;
    if(Array.isArray(w.READINGS)) state.data.READINGS = w.READINGS;
  } catch(e){ throw new Error('解析 data.js 失败：'+e.message); }
}

/* ─── Serialize back to data.js ─── */
function serializeDataJs(){
  const T = JSON.stringify(state.data.TIMELINE, null, 2);
  const W = JSON.stringify(state.data.WEEKLY, null, 2);
  const E = JSON.stringify(state.data.ESSAYS, null, 2);
  const R = JSON.stringify(state.data.READINGS||[], null, 2);
  return `/* ─────────────────────────────────────────────────────────
   Content data — managed by /admin. Last save: ${new Date().toISOString()}
   ───────────────────────────────────────────────────────── */

/* ============================================================
   1. AI 技术发展史 · 时间树
   ============================================================ */
window.TIMELINE = ${T};

/* ============================================================
   2. 每周 AI 大事件
   ============================================================ */
window.WEEKLY = ${W};

/* ============================================================
   3. AI × 跨境电商 · 思考存档
   ============================================================ */
window.ESSAYS = ${E};

/* ============================================================
   4. MR.PP 论文带读
   ============================================================ */
window.READINGS = ${R};
`;
}

/* ─── GitHub commit ─── */
async function pushToGitHub(message){
  const c = state.cfg;
  if(!c.ghToken || !c.ghOwner || !c.ghRepo) throw new Error('请先在「设置」页填好 GitHub 信息');
  const headers = {
    'Authorization': 'Bearer ' + c.ghToken,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const targets = [c.ghPath, 'ui_kits/claude_app/data.js'];
  const content = serializeDataJs();
  const b64 = btoa(unescape(encodeURIComponent(content)));
  for(const path of targets){
    // Get current SHA (may 404 if file doesn't exist)
    let sha;
    const getUrl = `https://api.github.com/repos/${c.ghOwner}/${c.ghRepo}/contents/${path}?ref=${encodeURIComponent(c.ghBranch)}`;
    const getRes = await fetch(getUrl, { headers });
    if(getRes.ok){ const j = await getRes.json(); sha = j.sha; }
    else if(getRes.status !== 404){ const j = await getRes.json().catch(()=>({})); throw new Error('GitHub 读取失败: '+(j.message||getRes.status)); }
    const putUrl = `https://api.github.com/repos/${c.ghOwner}/${c.ghRepo}/contents/${path}`;
    const body = { message: message || '后台更新内容', content: b64, branch: c.ghBranch };
    if(sha) body.sha = sha;
    const putRes = await fetch(putUrl, { method:'PUT', headers, body: JSON.stringify(body) });
    if(!putRes.ok){ const j = await putRes.json().catch(()=>({})); throw new Error('GitHub 写入失败: '+(j.message||putRes.status)); }
  }
  return true;
}

async function downloadDataJs(){
  const blob = new Blob([serializeDataJs()], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data.js'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* ─── Fetch article text via Tavily extract ─── */
async function fetchArticleText(url){
  const c = state.cfg;
  if(!c.tavilyKey) throw new Error('需要 Tavily Key 抓取原文');
  const res = await fetch('https://api.tavily.com/extract', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ api_key: c.tavilyKey, urls: [url], extract_depth: 'advanced' }),
  });
  if(!res.ok) throw new Error('抓取失败 HTTP '+res.status);
  const j = await res.json();
  const r = (j.results||[])[0];
  if(!r) throw new Error('抓取空结果');
  return (r.raw_content || r.content || '').slice(0, 16000);
}

/* ─── Tavily search API ─── */
async function tavilySearch(query, opts={}){
  const c = state.cfg;
  if(!c.tavilyKey) throw new Error('请先在「设置」页填入 Tavily API Key');
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: c.tavilyKey,
      query,
      search_depth: opts.depth || 'advanced',
      topic: opts.topic || 'news',
      days: opts.days ?? 7,
      max_results: opts.max_results ?? 10,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if(!res.ok){ const j = await res.json().catch(()=>({})); throw new Error('Tavily: '+(j.detail || j.error || res.status)); }
  const j = await res.json();
  return j.results || [];
}

/* ─── DeepSeek API ─── */
async function callDeepSeek(messages, opts={}){
  const c = state.cfg;
  if(!c.dsKey) throw new Error('请先在「设置」页填入 DeepSeek API Key');
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + c.dsKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: c.dsModel || 'deepseek-chat',
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.max_tokens ?? 4000,
      stream: false,
    }),
  });
  if(!res.ok){ const j = await res.json().catch(()=>({})); throw new Error('DeepSeek: '+(j.error?.message||res.status)); }
  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

/* ─── Tabs / Nav ─── */
function bindNav(){
  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => switchTab(el.dataset.tab);
  });
}
function switchTab(tab){
  state.tab = tab;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab===tab));
  const renderers = { weekly: renderWeekly, readings: renderReadings, essays: renderEssays, timeline: renderTimeline, settings: renderSettings };
  (renderers[tab]||renderWeekly)();
}

/* ─── HTML helpers ─── */
function h(tag, attrs={}, children=[]){
  const el = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') el.className=v;
    else if(k==='html') el.innerHTML=v;
    else if(k.startsWith('on') && typeof v==='function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if(v!=null) el.setAttribute(k, v);
  }
  for(const c of [].concat(children||[])){
    if(c==null||c===false) continue;
    el.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
  }
  return el;
}
function clearMain(){ document.getElementById('main').innerHTML=''; }
function pageHead(eyebrow, title, sub){
  const m = document.getElementById('main');
  const head = h('div',{class:'page-head'},[
    h('div',{class:'eyebrow'},eyebrow),
    h('h1',{},title),
    sub ? h('p',{},sub) : null,
  ]);
  m.appendChild(head);
}

/* ═══════════════════════════════════════════════════════════
   TAB · Weekly events
   ═══════════════════════════════════════════════════════════ */
function renderWeekly(){
  clearMain();
  pageHead('02 · WEEKLY', '每周 AI 大事件', '本周内 5 条事件，每周日更新一次。可点击下方「AI 整理草稿」让 DeepSeek 帮你把素材组织成卡片。');
  const m = document.getElementById('main');
  const W = state.data.WEEKLY;

  // Week meta
  const meta = h('div',{class:'card'},[
    h('div',{class:'card-head'},[ h('h3',{},'本周信息') ]),
    h('div',{class:'row3'},[
      field('周次说明', W.weekOf||'', v=>{ W.weekOf=v; markDirty(); }, '如「2026 · 第 19 周 · 5 月 4 日 — 5 月 8 日」'),
      field('更新时间', W.updated||'', v=>{ W.updated=v; markDirty(); }, '如「更新于 2026.05.08」'),
      field('下次更新', W.next||'', v=>{ W.next=v; markDirty(); }, '如「下次更新：2026.05.15」'),
    ]),
  ]);
  m.appendChild(meta);

  // AI helper
  const ai = h('div',{class:'ai-panel'},[
    h('h4',{},[h('span',{class:'dot'}), document.createTextNode('AI 整理草稿（DeepSeek）')]),
    h('p',{html:'把本周看到的 AI 新闻素材<strong>原样粘贴</strong>到下面（标题、链接、要点都行，多条用空行分隔）。点击按钮，DeepSeek 会自动整理成 5 条结构化卡片填入下方表格——你再审核 + 修改 + 保存。'}),
    textareaField('news-raw', '', null, 6, '示例：\nHN 热帖：Anthropic 发布 Sonnet 4.5，上下文 200K\nhttps://news.ycombinator.com/...\n\nDeepSeek R1 的 follow-up 模型 R2 论文上线 arxiv...\n\n欧盟 AI Act 新增 Agentic 系统补充指引...'),
    h('div',{style:'display:flex;gap:10px;flex-wrap:wrap;'},[
      h('button',{class:'btn primary', onclick: aiOrganizeWeekly},[
        h('span',{class:'spin', id:'ai-spin', style:'display:none;'}),
        document.createTextNode('  AI 整理为 5 条卡片'),
      ]),
      h('button',{class:'btn', onclick: aiAutoSearchWeekly},[
        h('span',{class:'spin', id:'auto-spin', style:'display:none;'}),
        document.createTextNode('  🌐 AI 自动搜索本周（Tavily）'),
      ]),
      h('button',{class:'btn ghost', onclick: ()=>{ document.getElementById('news-raw').value=''; }},'清空'),
    ]),
    h('div',{style:'margin-top:10px;'},[
      h('button',{class:'btn small', onclick: aiGenerateAllSvgs},'🎨 为所有事件批量生成配图'),
    ]),
  ]);
  m.appendChild(ai);

  // Events
  m.appendChild(eventsListUI());

  // Footer save
  m.appendChild(saveBar('保存到 GitHub（每周事件）'));
}

function eventsListUI(){
  const W = state.data.WEEKLY;
  const wrap = h('div',{},[]);
  W.events.forEach((ev, i) => {
    wrap.appendChild(eventCard(ev, i));
  });
  const addBtn = h('button',{class:'btn small', onclick:()=>{
    W.events.push({ kind:'模型升级', title:'', teaser:'', glyph:'pulse', body:[''] });
    markDirty(); renderWeekly();
  }},'+ 添加一条');
  wrap.appendChild(h('div',{style:'margin:8px 0 24px;'},[addBtn]));
  return wrap;
}

function eventCard(ev, i){
  const card = h('div',{class:'card'},[]);
  card.appendChild(h('div',{class:'card-head'},[
    h('h3',{},'事件 ' + (i+1)),
    h('div',{style:'display:flex;gap:8px;'},[
      h('button',{class:'btn small ghost', onclick:()=>{ if(i>0){[state.data.WEEKLY.events[i-1],state.data.WEEKLY.events[i]]=[state.data.WEEKLY.events[i],state.data.WEEKLY.events[i-1]];markDirty();renderWeekly();} }},'↑'),
      h('button',{class:'btn small ghost', onclick:()=>{ if(i<state.data.WEEKLY.events.length-1){[state.data.WEEKLY.events[i+1],state.data.WEEKLY.events[i]]=[state.data.WEEKLY.events[i],state.data.WEEKLY.events[i+1]];markDirty();renderWeekly();} }},'↓'),
      h('button',{class:'btn small danger', onclick:()=>{ if(confirm('删除这条事件？')){state.data.WEEKLY.events.splice(i,1);markDirty();renderWeekly();} }},'删除'),
    ]),
  ]));
  card.appendChild(h('div',{class:'row'},[
    selectField('类别', ev.kind, ['模型升级','开源项目','新概念','政策','公司动态','研究','行业'], v=>{ev.kind=v;markDirty();}),
    selectField('图标', ev.glyph||'pulse', ['pulse','branch','spark','shield','box','star','globe'], v=>{ev.glyph=v;markDirty();}),
  ]));
  card.appendChild(field('标题', ev.title, v=>{ev.title=v;markDirty();}));
  card.appendChild(field('一句话引导', ev.teaser, v=>{ev.teaser=v;markDirty();}));
  const bodyVal = (ev.body||[]).join('\n');
  card.appendChild(textareaField(null, bodyVal, v=>{ev.body=v.split('\n').filter(x=>x!==null); markDirty();}, 6, '正文，每行一段。可用空行分隔，前缀「• 」、「1. 」会保留。','正文'));
  // SVG illustration row
  const svgRow = h('div',{style:'margin-top:14px;border-top:1px dashed var(--border);padding-top:12px;'},[]);
  svgRow.appendChild(h('div',{style:'display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;'},[
    h('strong',{style:'font-size:13px;'},'AI 配图'),
    h('span',{class:'tag',style:ev.svg?'background:#e8f0e4;color:#3d5a32;':'background:#f3eee0;color:#7a7363;'}, ev.svg?'已生成':'未生成'),
    h('button',{class:'btn small', onclick:()=>aiGenerateOneSvg(i)}, ev.svg?'重新生成':'AI 生成配图'),
    ev.svg?h('button',{class:'btn small ghost', onclick:()=>{delete ev.svg;markDirty();renderWeekly();}},'清除'):null,
  ].filter(Boolean)));
  if(ev.svg){
    const prev = h('div',{style:'aspect-ratio:5/2.4;background:#FAF9F5;border:1px solid var(--border-faint);border-radius:6px;overflow:hidden;'},[]);
    prev.innerHTML = ev.svg;
    const s = prev.querySelector('svg'); if(s){ s.style.width='100%'; s.style.height='100%'; }
    svgRow.appendChild(prev);
  }
  card.appendChild(svgRow);
  return card;
}

/* ─── AI generate SVG illustration ─── */
const SVG_STYLE_PROMPT = `你是一位极简编辑设计师，为「美的 AI 实验室」每周 AI 大事件卡片生成 SVG 配图。**严格遵守以下设计规范**：

【画布】
- viewBox="0 0 500 240"，标准 5:2.4 横版
- 背景透明（不要画外框矩形）

【颜色（只能用这几个）】
- 珊瑚强调色 #cc785c（主要点睛，1-2 处）
- 深棕 #3d3729（标题文字、关键描边）
- 中性灰棕 #7a7363（次要文字）
- 浅灰 #a39e8d（标签文字）
- 米色边线 #d4cfbe（结构线）
- 极浅米 #e8e3d2（分割线）
- 背景白米 #faf9f5（仅作为元素填充背景）

【字体】
- 等宽: font-family="Source Code Pro,monospace" — 用于英文标签、数字、代码、metric
- 衬线: font-family="Noto Serif SC,serif" — 用于中文小标题、关键短语
- 字号 9-14px，标签字加 letter-spacing="1.5"

【构图原则】
- 一张图一个核心隐喻（不要堆砌）
- 大量留白，元素居中或左右对称
- 用细线（stroke-width=1.25 或 1.5）勾勒结构，不要粗线条
- 数字/数据要可读（"30%"、"200K"、"$0.03"等）
- 必须包含至少 1 个珊瑚色 #cc785c 元素作为视觉焦点
- 可以用简单的 <animate> 让一个元素动起来（fill 渐变、宽度增长、不透明度脉动），但不要过度
- 不要用渐变填充、阴影、滤镜
- 不要画卡通图标、emoji、人物
- 风格参考：Stripe Press / Pitchfork 排版插画 / 学术论文示意图

【常用元素库（可直接使用）】
- 进度条：<rect> 描边外框 + <rect> 珊瑚色填充
- 数据点矩阵：<circle r="2"> 网格，可加脉动动画
- 流程箭头：<path stroke-dasharray="3 3"> + <polygon> 三角箭头
- 节点树：<path> 折线连接 + <circle> 端点
- 数据卡片：<rect rx="4"> 米色描边 + 内部文字
- 五角星：M 0 -8 L 2 -2 L 8 -2 L 3 2 L 5 8 L 0 4 L -5 8 L -3 2 L -8 -2 L -2 -2 Z

【输出格式】
- 直接返回完整的 <svg>...</svg> 字符串，不要任何前后说明文字、不要 markdown 代码块
- viewBox 必须是 "0 0 500 240"
- 必须包含 xmlns="http://www.w3.org/2000/svg"

【内容要求】
- 图必须直接呼应这条新闻的具体数据/概念
- 至少出现一个具体数字或英文术语（从新闻里提取）
- 至少一行中文小字（4-10 字，从新闻关键词提取）`;

async function aiGenSvgForEvent(ev){
  const newsCtx = `类别：${ev.kind}\n标题：${ev.title}\n引导：${ev.teaser}\n正文：${(ev.body||[]).join(' ')}`;
  const out = await callDeepSeek([
    { role:'system', content: SVG_STYLE_PROMPT },
    { role:'user', content: '请为这条新闻生成 SVG 配图：\n\n' + newsCtx },
  ], { temperature: 0.4, max_tokens: 3500 });
  // Extract <svg>...</svg>
  const m = out.match(/<svg[\s\S]*?<\/svg>/i);
  if(!m) throw new Error('AI 未返回有效 SVG');
  return m[0];
}

async function aiGenerateOneSvg(idx){
  const ev = state.data.WEEKLY.events[idx];
  if(!ev){ return; }
  if(!state.cfg.dsKey){ toast('请先填 DeepSeek Key','error'); return; }
  toast(`正在为「${ev.title||'事件 '+(idx+1)}」生成配图...`,'info');
  try {
    const svg = await aiGenSvgForEvent(ev);
    ev.svg = svg;
    markDirty(); renderWeekly();
    toast('✓ 配图已生成','success');
  } catch(e){ console.error(e); toast('生成失败：'+e.message,'error'); }
}

async function aiGenerateAllSvgs(){
  if(!state.cfg.dsKey){ toast('请先填 DeepSeek Key','error'); return; }
  const evs = state.data.WEEKLY.events;
  if(!evs.length){ toast('当前没有事件','error'); return; }
  toast(`开始为 ${evs.length} 条事件生成配图（约 ${evs.length*6} 秒）...`,'info', 4000);
  let ok=0, fail=0;
  for(let i=0;i<evs.length;i++){
    try { evs[i].svg = await aiGenSvgForEvent(evs[i]); ok++; saveDraft(); }
    catch(e){ console.error(e); fail++; }
  }
  renderWeekly();
  toast(`完成：${ok} 张成功，${fail} 张失败`, ok>0?'success':'error', 5000);
}

/* ─── AI organize weekly ─── */
async function aiOrganizeWeekly(){
  const raw = document.getElementById('news-raw').value.trim();
  if(!raw){ toast('请先把本周新闻素材粘贴进来','error'); return; }
  const spin = document.getElementById('ai-spin'); spin.style.display='inline-block';
  try {
    const sys = `你是一位资深 AI 产业分析师，为美的集团跨境电商团队整理每周 AI 大事件简报。请把用户给你的原始素材整理成 5 条结构化卡片。

输出严格的 JSON（不要任何 markdown 代码块、不要前后多余文字），格式为：
{
  "weekOf": "如 2026 · 第 19 周 · 5 月 4 日 — 5 月 8 日",
  "updated": "如 更新于 2026.05.08",
  "next": "如 下次更新：YYYY.MM.DD",
  "events": [
    {
      "kind": "类别（从这几个选：模型升级 / 开源项目 / 新概念 / 政策 / 公司动态）",
      "title": "新闻标题（中文，简洁有力，<= 26 字）",
      "teaser": "一句话引导（中文，30-60 字，要让读者一眼想点开）",
      "glyph": "图标关键词，必须与 kind 严格对应：模型升级→pulse / 开源项目→branch / 新概念→spark / 研究→spark / 政策→shield / 公司动态→box / 行业→box",
      "body": [
        "正文段落 1（中文，2-4 句）",
        "正文段落 2",
        "...",
        "对跨境电商运营的具体影响（必须有这一段）"
      ]
    }
  ]
}

要求：
1. 必须 5 条事件，类别尽量多样
2. 每条都要有「对跨境电商运营的影响」段落
3. 风格参考 Stratechery / 机器之心，理性克制，不做营销腔
4. 没素材时不要硬编，宁缺勿滥`;
    const out = await callDeepSeek([
      { role:'system', content: sys },
      { role:'user', content: '本周原始素材：\n\n' + raw },
    ], { temperature: 0.3, max_tokens: 6000 });
    // Extract JSON
    let json;
    try { json = JSON.parse(out); }
    catch(e){
      const m = out.match(/\{[\s\S]*\}/);
      if(!m) throw new Error('AI 返回格式无法解析');
      json = JSON.parse(m[0]);
    }
    if(!json.events || !Array.isArray(json.events)) throw new Error('AI 返回缺少 events 字段');
    if(json.weekOf) state.data.WEEKLY.weekOf = json.weekOf;
    if(json.updated) state.data.WEEKLY.updated = json.updated;
    if(json.next) state.data.WEEKLY.next = json.next;
    state.data.WEEKLY.events = json.events.slice(0,8);
    markDirty();
    renderWeekly();
    toast(`AI 已整理 ${json.events.length} 条卡片，正在生成配图...`, 'success');
    // Auto-generate SVG illustrations for each event
    await aiGenerateAllSvgs();
  } catch(e){
    console.error(e);
    toast('AI 整理失败：'+e.message,'error');
  } finally {
    if(spin) spin.style.display='none';
  }
}

/* ─── AI generate inline SVG for a single weekly event ─── */
const SVG_STYLE_PROMPT_V2 = `你是为 Midea AI Lab AI 周报绘制示意图的编辑插画师，参考 Stratechery / Anthropic Claude 的克制审美。

输出契约（严格遵守）：
- 只输出一段 <svg>…</svg>，不要 markdown、不要解释、不要 <?xml> 头
- 根标签必须是 <svg viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg">，所有坐标在 0..500 × 0..240
- 不要写 width/height 属性；不要外部资源；不要 <script>/<style>/<foreignObject>/<image>
- 总长度 ≤ 1800 字符

调色板（只用这些颜色，不准引入其他颜色）：
- 珊瑚主色 #CC785C （opacity 0.12-0.18 用于填充淡色块；满色仅一处用于核心要素）
- 墨色 #3D3729 主线条与关键文字
- 次墨 #7A7363 次要文字
- 哑墨 #A39E8D 元信息/小标签
- 边框 #D4CFBE 中性描边
- 浅边框 #E8E3D2 背景分隔线
- 背景透明（卡片本身是 #FAF9F5 暖米色，不要画背景矩形）

字体（仅这两种）：
- 标题/数字：font-family="Noto Serif SC, serif" 13-15 号，#3D3729
- 代码标签/单位：font-family="Source Code Pro, monospace" 9-11 号，#A39E8D 或 #7A7363，letter-spacing="1.5" 到 "2"，英文大写

线条 1 到 1.5 px，stroke-linecap="round"；圆角 rx 4-10；可用 stroke-dasharray="3 3" 表示推断/流向。
布局：单一主体居中或偏左，左上一行小写英文大写 mono 上下文标签，底部 ~y=200 一行中文 serif 写一个具体事实/数字。负空间是特性。

可选动画：必要时用 <animate> 表达"扩张/对比/演化"，最多一个动画想法，不要闪烁。

按新闻类别选模式：
- 模型升级 → 增长的条/扩张的窗口/前后规格线
- 开源项目 → 分叉的树状节点 + 代码标签筹码 + 一颗星与数字
- 新概念/研究 → 多个小点经过箭头压缩为少数节点 + 流程图
- 政策 → 盾牌/文件/印章 + mono 元信息
- 公司动态/行业 → 手机或浏览器框 + 对话气泡 / 市场示意
- Agent/工具 → 中心节点 + 周围带标签的工具筹码

禁止：emoji、渐变、阴影、filter、3D/等距、灯泡/大脑/机器人/齿轮/火箭老套元素、纯装饰图形、超过一个满色珊瑚填充。每个元素必须映射到新闻里某个具体事实（数字、名称、对比）。`;

async function aiGenerateSvgFor(event){
  const userMsg = `请为下面这条 AI 新闻卡片生成示意图：
类别：${event.kind}
标题：${event.title}
引导：${event.teaser}
正文要点：${(event.body||[]).slice(0,3).join(' / ')}

抓取一个最具体的数字或事实作为画面焦点（例如上下文长度、模型版本号、星标数、罚款额、参与方），以此组织构图。`;
  const out = await callDeepSeek([
    { role:'system', content: SVG_STYLE_PROMPT_V2 },
    { role:'user', content: userMsg },
  ], { temperature: 0.4, max_tokens: 2400 });
  // Extract <svg>…</svg>
  const m = out.match(/<svg[\s\S]*?<\/svg>/i);
  if(!m) throw new Error('SVG 未在返回中找到');
  let svg = m[0];
  // Sanity guardrails
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi,'');
  svg = svg.replace(/on[a-z]+="[^"]*"/gi,'');
  if(svg.length > 6000) throw new Error('SVG 超长');
  return svg;
}

async function aiGenerateAllSvgs(){
  const events = state.data.WEEKLY.events || [];
  if(!events.length){ toast('没有事件卡片，先填内容','error'); return; }
  if(!state.cfg.dsKey){ toast('请先在「设置」填 DeepSeek Key','error'); return; }
  let ok = 0, fail = 0;
  for(let i=0;i<events.length;i++){
    try {
      toast(`正在生成第 ${i+1}/${events.length} 张配图…`, 'info', 1800);
      events[i].svg = await aiGenerateSvgFor(events[i]);
      ok++;
      // Re-render so user sees progress
      if(state.tab === 'weekly') renderWeekly();
    } catch(e){ console.warn('SVG 生成失败 #'+(i+1), e); fail++; }
  }
  markDirty();
  toast(`配图生成完成 · 成功 ${ok} · 失败 ${fail}`, fail?'error':'success');
}

async function aiGenerateOneSvg(idx){
  const ev = state.data.WEEKLY.events[idx];
  if(!ev) return;
  if(!state.cfg.dsKey){ toast('请先在「设置」填 DeepSeek Key','error'); return; }
  try {
    toast('正在生成配图…','info');
    ev.svg = await aiGenerateSvgFor(ev);
    markDirty(); renderWeekly();
    toast('配图已生成','success');
  } catch(e){ toast('生成失败：'+e.message,'error'); }
}

/* ─── AI auto-search weekly via Tavily + DeepSeek ─── */
async function aiAutoSearchWeekly(){
  if(!state.cfg.tavilyKey){ toast('请先在「设置」填 Tavily API Key','error'); return; }
  if(!state.cfg.dsKey){ toast('请先在「设置」填 DeepSeek API Key','error'); return; }
  const spin = document.getElementById('auto-spin'); spin.style.display='inline-block';
  try {
    toast('🌐 正在搜索本周 AI 新闻...','info');
    const queries = [
      'AI model release this week (Anthropic, OpenAI, Google, DeepSeek, Meta)',
      'AI agentic systems and tools breakthrough this week',
      'AI ecommerce cross-border product news this week',
      'AI policy regulation EU US China this week',
      'open source AI model release github trending this week',
    ];
    const all = [];
    for(const q of queries){
      try {
        const rs = await tavilySearch(q, { days: 7, max_results: 6 });
        all.push(...rs);
      } catch(e){ console.warn('搜索失败:', q, e); }
    }
    if(!all.length) throw new Error('Tavily 没返回结果');
    // Dedup by URL
    const seen = new Set();
    const uniq = all.filter(r => { if(seen.has(r.url)) return false; seen.add(r.url); return true; });
    const raw = uniq.slice(0, 25).map(r => `【${r.title}】\n${r.url}\n${r.content||''}`).join('\n\n---\n\n');
    document.getElementById('news-raw').value = raw;
    toast(`✓ 搜到 ${uniq.length} 条，正在让 DeepSeek 整理...`,'success');
    await aiOrganizeWeekly();
  } catch(e){ console.error(e); toast('自动搜索失败：'+e.message,'error'); }
  finally { spin.style.display='none'; }
}

/* ═══════════════════════════════════════════════════════════
   TAB · Readings (MR.PP 论文带读 · 一周一更)
   ═══════════════════════════════════════════════════════════ */
function renderReadings(){
  clearMain();
  pageHead('04 · READINGS', 'MR.PP 论文带读', '每周一更。粘贴一个原文链接 → DeepSeek 自动抓取 + 按精读 schema 输出，你审核 + 保存。');
  const m = document.getElementById('main');
  if(!state.data.READINGS) state.data.READINGS = window.READINGS || [];

  // AI helper — single article
  m.appendChild(h('div',{class:'ai-panel'},[
    h('h4',{},[h('span',{class:'dot'}), document.createTextNode('MR.PP · 自动解读单篇文章')]),
    h('p',{html:'粘贴一个 AI 博客 / 论文链接（Anthropic、OpenAI、DeepMind、机器之心英文版等）。<strong>需要先在设置里配好 Tavily 和 DeepSeek</strong>。'}),
    field('原文 URL', '', v=>{ window._mrUrl=v.trim(); }, '如 https://www.anthropic.com/research/...'),
    h('div',{class:'row'},[
      selectField('来源', 'ANTHROPIC', ['ANTHROPIC','OPENAI','DEEPMIND','DEEPSEEK','META','OTHER'], v=>{ window._mrSource=v; }),
      field('本周次', `第 ${currentWeekNum()} 周 · ${todayYYYYMM()}`, v=>{ window._mrWeek=v; }),
    ]),
    h('div',{style:'display:flex;gap:10px;flex-wrap:wrap;'},[
      h('button',{class:'btn primary', onclick: aiGenerateReading},[
        h('span',{class:'spin', id:'reading-spin', style:'display:none;'}),
        document.createTextNode('  MR.PP 自动解读'),
      ]),
      h('button',{class:'btn', onclick: aiAutoFindAndRead},[
        h('span',{class:'spin', id:'auto-find-spin', style:'display:none;'}),
        document.createTextNode('  🌐 自动搜本周热门 + 解读'),
      ]),
    ]),
  ]));

  // List existing
  (state.data.READINGS||[]).forEach((r, i) => m.appendChild(readingCard(r, i)));
  m.appendChild(saveBar('保存到 GitHub（论文带读）'));
}

function readingCard(r, i){
  const card = h('div',{class:'card'},[]);
  card.appendChild(h('div',{class:'card-head'},[
    h('h3',{},'#'+(i+1)+' · '+(r.titleCn||r.title||'')),
    h('button',{class:'btn small danger', onclick:()=>{ if(confirm('删除这篇带读？')){state.data.READINGS.splice(i,1);markDirty();renderReadings();} }},'删除'),
  ]));
  card.appendChild(h('div',{class:'row3'},[
    field('id', r.id||'', v=>{r.id=v;markDirty();}),
    field('来源', r.source||'', v=>{r.source=v;markDirty();}),
    field('周次', r.week||'', v=>{r.week=v;markDirty();}),
  ]));
  card.appendChild(field('标题（中文）', r.titleCn||'', v=>{r.titleCn=v;markDirty();}));
  card.appendChild(field('标题（英文）', r.title||'', v=>{r.title=v;markDirty();}));
  card.appendChild(field('原文 URL', r.sourceUrl||'', v=>{r.sourceUrl=v;markDirty();}));
  card.appendChild(textareaField(null, r.tldr||'', v=>{r.tldr=v;markDirty();}, 3, '一句话总结','TLDR'));
  card.appendChild(textareaField(null, JSON.stringify(r.pyramid||{},null,2), v=>{ try{r.pyramid=JSON.parse(v);markDirty();}catch(e){} }, 8, '金字塔结构 JSON','Pyramid (JSON)'));
  card.appendChild(textareaField(null, JSON.stringify(r.sections||[],null,2), v=>{ try{r.sections=JSON.parse(v);markDirty();}catch(e){} }, 14, '5 节正文 JSON。每节字段：h, en, cn, note, demoId?, think?, quiz?, compare?','Sections (JSON)'));
  card.appendChild(textareaField(null, JSON.stringify(r.glossary||[],null,2), v=>{ try{r.glossary=JSON.parse(v);markDirty();}catch(e){} }, 6, '术语表 JSON','Glossary (JSON)'));
  card.appendChild(textareaField(null, JSON.stringify(r.further||[],null,2), v=>{ try{r.further=JSON.parse(v);markDirty();}catch(e){} }, 5, '延伸阅读 JSON','Further (JSON)'));
  return card;
}

async function aiGenerateReading(){
  const url = window._mrUrl;
  if(!url){ toast('请先填 URL','error'); return; }
  const skill = window.READING_SKILL;
  if(!skill){ toast('skill 未加载','error'); return; }
  const spin = document.getElementById('reading-spin'); spin.style.display='inline-block';
  try {
    toast('🌐 抓取原文中...','info');
    const json = await skill.generate(
      url,
      callDeepSeek,
      fetchArticleText,
      { source: window._mrSource||'OTHER', week: window._mrWeek||'', date: new Date().toISOString().slice(0,10) },
    );
    json.sourceUrl = url;
    if(!state.data.READINGS) state.data.READINGS = [];
    state.data.READINGS.unshift(json);
    markDirty();
    renderReadings();
    toast('✓ MR.PP 解读完成，请审核','success');
  } catch(e){ console.error(e); toast('解读失败：'+e.message,'error',5000); }
  finally { spin.style.display='none'; }
}

async function aiAutoFindAndRead(){
  if(!state.cfg.tavilyKey){ toast('请先填 Tavily Key','error'); return; }
  const skill = window.READING_SKILL;
  const spin = document.getElementById('auto-find-spin'); spin.style.display='inline-block';
  try {
    toast('🌐 搜本周热门 AI 博客...','info');
    const all = [];
    for(const q of skill.weeklySearchQueries.slice(0,3)){
      try { const rs = await tavilySearch(q, { days: 7, max_results: 5, topic: 'general' }); all.push(...rs); }
      catch(e){ console.warn(e); }
    }
    const seen = new Set(); const uniq = all.filter(r=>{ if(seen.has(r.url)) return false; seen.add(r.url); return true; });
    if(!uniq.length) throw new Error('没搜到候选文章');
    // Let user pick
    const chosen = prompt(`搜到 ${uniq.length} 篇，请输入要解读的编号（1-${Math.min(uniq.length,8)}）：\n\n` +
      uniq.slice(0,8).map((r,i)=>`${i+1}. ${r.title}\n   ${r.url}`).join('\n\n'));
    const idx = parseInt(chosen,10)-1;
    if(isNaN(idx) || !uniq[idx]) return;
    window._mrUrl = uniq[idx].url;
    const u = new URL(uniq[idx].url);
    window._mrSource = (u.hostname.includes('anthropic')?'ANTHROPIC':u.hostname.includes('openai')?'OPENAI':u.hostname.includes('deepmind')?'DEEPMIND':u.hostname.includes('deepseek')?'DEEPSEEK':u.hostname.includes('meta')?'META':'OTHER');
    window._mrWeek = `第 ${currentWeekNum()} 周 · ${todayYYYYMM()}`;
    await aiGenerateReading();
  } catch(e){ console.error(e); toast('自动搜索失败：'+e.message,'error'); }
  finally { spin.style.display='none'; }
}

function currentWeekNum(){
  const now = new Date(); const start = new Date(now.getFullYear(),0,1);
  return Math.ceil((((now-start)/86400000)+start.getDay()+1)/7);
}
function todayYYYYMM(){ const d = new Date(); return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0'); }

/* ═══════════════════════════════════════════════════════════
   TAB · Essays
   ═══════════════════════════════════════════════════════════ */
function renderEssays(){
  clearMain();
  pageHead('03 · ESSAYS', '跨境电商思考', '每周新增一篇。短的可以是观察，长的可以是研究。');
  const m = document.getElementById('main');

  // AI helper for essay
  const ai = h('div',{class:'ai-panel'},[
    h('h4',{},[h('span',{class:'dot'}), document.createTextNode('AI 起草新文章（DeepSeek）')]),
    h('p',{html:'写一句话主题，DeepSeek 会按现有文章的风格起草一篇。生成后你<strong>仍要修改 + 加入个人观察</strong>，否则会很套路化。'}),
    textareaField('essay-topic', '', null, 3, '示例：当 Agent 能直接写广告投放策略时，跨境电商的投放团队会发生什么变化？'),
    h('div',{style:'display:flex;gap:10px;'},[
      h('button',{class:'btn primary', onclick: aiDraftEssay},[
        h('span',{class:'spin', id:'essay-spin', style:'display:none;'}),
        document.createTextNode('  AI 起草新文章'),
      ]),
    ]),
  ]);
  m.appendChild(ai);

  state.data.ESSAYS.forEach((es, i) => m.appendChild(essayCard(es, i)));
  m.appendChild(h('div',{style:'margin:8px 0 24px;'},[
    h('button',{class:'btn small', onclick:()=>{
      state.data.ESSAYS.unshift({ id:'essay-'+Date.now(), week:'', eyebrow:'', title:'', deck:'', paragraphs:[''] });
      markDirty(); renderEssays();
    }},'+ 添加新文章'),
  ]));
  m.appendChild(saveBar('保存到 GitHub（电商思考）'));
}

function essayCard(es, i){
  const card = h('div',{class:'card'},[]);
  card.appendChild(h('div',{class:'card-head'},[
    h('h3',{},'文章 ' + (i+1) + (es.title? ' · '+es.title : '')),
    h('button',{class:'btn small danger', onclick:()=>{ if(confirm('删除这篇文章？')){state.data.ESSAYS.splice(i,1);markDirty();renderEssays();} }},'删除'),
  ]));
  card.appendChild(h('div',{class:'row'},[
    field('ID（短横线，唯一）', es.id, v=>{es.id=v;markDirty();}),
    field('周次', es.week||'', v=>{es.week=v;markDirty();}, '如「第 19 周 · 2026.05」'),
  ]));
  card.appendChild(field('眉头标签 (eyebrow)', es.eyebrow||'', v=>{es.eyebrow=v;markDirty();}, '如「AGENTIC LISTING」'));
  card.appendChild(field('标题', es.title, v=>{es.title=v;markDirty();}));
  card.appendChild(textareaField(null, es.deck||'', v=>{es.deck=v;markDirty();}, 2, '一句话副标题，文章列表中显示','副标题'));
  const bodyVal = (es.paragraphs||[]).join('\n\n');
  card.appendChild(textareaField(null, bodyVal, v=>{es.paragraphs=v.split(/\n\n+/);markDirty();}, 14, '正文，段落之间用空行分隔。**粗体** 会渲染为强调。','正文'));
  return card;
}

async function aiDraftEssay(){
  const topic = document.getElementById('essay-topic').value.trim();
  if(!topic){ toast('请先填一个主题','error'); return; }
  const spin = document.getElementById('essay-spin'); spin.style.display='inline-block';
  try {
    const sample = state.data.ESSAYS[0]?.paragraphs?.join('\n\n') || '';
    const sys = `你是美的集团跨境电商团队的 AI 产品经理，为团队内部博客写一篇专业、克制、有具体洞察的文章。

风格要点：
- 理性、第一人称、有个人观察、不夸张、不营销
- 用具体数据和场景，少用形容词
- 段落之间用空行分隔
- 重点词用 **粗体** 标注（用 markdown 语法）
- 长度 800-1500 字

输出严格 JSON（不要 markdown 代码块）：
{
  "id": "短横线连接的英文 id",
  "week": "如 第 X 周 · YYYY.MM",
  "eyebrow": "全大写英文标签，如 AGENTIC LISTING",
  "title": "标题",
  "deck": "一句话副标题，30-50 字",
  "paragraphs": ["第一段", "第二段", "..."]
}`;
    const userMsg = `请就这个主题起草一篇：\n\n${topic}\n\n${sample? '参考已有文章风格：\n\n'+sample.slice(0,1500) : ''}`;
    const out = await callDeepSeek([
      { role:'system', content: sys },
      { role:'user', content: userMsg },
    ], { temperature: 0.6, max_tokens: 4000 });
    let json;
    try { json = JSON.parse(out); }
    catch(e){ const m = out.match(/\{[\s\S]*\}/); json = JSON.parse(m[0]); }
    state.data.ESSAYS.unshift(json);
    markDirty();
    document.getElementById('essay-topic').value='';
    renderEssays();
    toast('草稿已生成，请审核修改','success');
  } catch(e){ console.error(e); toast('生成失败：'+e.message,'error'); }
  finally { spin.style.display='none'; }
}

/* ═══════════════════════════════════════════════════════════
   TAB · Timeline
   ═══════════════════════════════════════════════════════════ */
function renderTimeline(){
  clearMain();
  pageHead('01 · TIMELINE', '时间树节点', '一般不常改。新增节点需要同步更新前端的位置坐标（在 index.html 里）。');
  const m = document.getElementById('main');
  state.data.TIMELINE.forEach((n, i) => m.appendChild(timelineCard(n, i)));
  m.appendChild(saveBar('保存到 GitHub（时间树）'));
}
function timelineCard(n, i){
  const card = h('div',{class:'card'},[]);
  card.appendChild(h('div',{class:'card-head'},[
    h('h3',{},'节点 ' + (i+1) + ' · ' + (n.year||'') + ' · ' + (n.title||'')),
    h('div',{},''),
  ]));
  card.appendChild(h('div',{class:'row3'},[
    field('年份', n.year, v=>{n.year=parseInt(v,10)||v;markDirty();}),
    field('阶段（era）', n.era||'', v=>{n.era=v;markDirty();}),
    selectField('Tag', n.tag||'里程碑', ['理论','里程碑','突破','革命','当下'], v=>{n.tag=v;markDirty();}),
  ]));
  card.appendChild(field('标题', n.title, v=>{n.title=v;markDirty();}));
  card.appendChild(field('副标题', n.subtitle||'', v=>{n.subtitle=v;markDirty();}));
  card.appendChild(textareaField(null, n.summary||'', v=>{n.summary=v;markDirty();}, 3, '一句话客观描述','这是什么 (summary)'));
  card.appendChild(textareaField(null, n.plain||'', v=>{n.plain=v;markDirty();}, 5, '可用 <strong>...</strong>、<br>','背景与故事 (plain)'));
  card.appendChild(textareaField(null, n.analogy||'', v=>{n.analogy=v;markDirty();}, 5, '可用 HTML','打个比方 (analogy)'));
  card.appendChild(textareaField(null, n.mechanism||'', v=>{n.mechanism=v;markDirty();}, 5, '可用 HTML','技术原理 (mechanism)'));
  card.appendChild(textareaField(null, n.impact||'', v=>{n.impact=v;markDirty();}, 4, '','社会反响 (impact)'));
  return card;
}

/* ═══════════════════════════════════════════════════════════
   TAB · Settings
   ═══════════════════════════════════════════════════════════ */
function renderSettings(){
  clearMain();
  pageHead('⚙ · SETTINGS', '设置', '所有 Key 和 Token 都只存在你这台电脑的 localStorage，不会上传 GitHub、不会出现在网页源码里。');
  const m = document.getElementById('main');
  const c = state.cfg;

  // GitHub
  m.appendChild(h('div',{class:'card'},[
    h('div',{class:'card-head'},[ h('h3',{},'GitHub（保存目标）'), h('span',{class:'tag'},'B2 自动提交') ]),
    h('p',{class:'field-hint',style:'margin-bottom:14px;', html:'• 在 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank">GitHub Fine-grained Token</a> 生成 Token，权限只勾选目标 repo 的 <code>Contents: Read and write</code>。<br>• 第一次需要把整个项目推到一个 repo——如果你还没建，告诉我我帮你写步骤。'}),
    h('div',{class:'row'},[
      field('GitHub 用户名 / 组织 (owner)', c.ghOwner, v=>{c.ghOwner=v.trim();saveCfg();}, '如「pengyupu」'),
      field('仓库名 (repo)', c.ghRepo, v=>{c.ghRepo=v.trim();saveCfg();}, '如「midea-ai-lab-site」'),
    ]),
    h('div',{class:'row'},[
      field('分支 (branch)', c.ghBranch, v=>{c.ghBranch=v.trim()||'main';saveCfg();}, '默认 main'),
      field('data.js 路径', c.ghPath, v=>{c.ghPath=v.trim();saveCfg();}, '默认 ui_kits/claude_marketing/data.js'),
    ]),
    field('Personal Access Token', c.ghToken, v=>{c.ghToken=v.trim();saveCfg();}, '只存本机；填好后下面会同时写两个 data.js 文件（marketing + app）', 'password'),
    h('button',{class:'btn small', onclick: testGitHub, style:'margin-top:8px;'},'测试连接'),
  ]));

  // DeepSeek
  m.appendChild(h('div',{class:'card'},[
    h('div',{class:'card-head'},[ h('h3',{},'DeepSeek API'), h('span',{class:'tag'},'D1 AI 抓取') ]),
    h('p',{class:'field-hint',style:'margin-bottom:14px;', html:'• 在 <a href="https://platform.deepseek.com/api_keys" target="_blank">DeepSeek 控制台</a> 申请 API Key。<br>• <strong>注意</strong>：DeepSeek API 本身不能联网搜索。"AI 整理"是把你<strong>粘贴的素材</strong>整理成卡片——你需要自己先收集本周新闻（网页、Twitter、YouTube 摘要），粘进去后让 AI 帮你格式化。'}),
    field('API Key', c.dsKey, v=>{c.dsKey=v.trim();saveCfg();}, '以 sk- 开头', 'password'),
    selectField('模型', c.dsModel||'deepseek-chat', ['deepseek-chat','deepseek-v4','deepseek-v4-pro','deepseek-reasoner'], v=>{c.dsModel=v;saveCfg();}),
    h('button',{class:'btn small', onclick: testDeepSeek, style:'margin-top:8px;'},'测试连接'),
  ]));

  // Tavily
  m.appendChild(h('div',{class:'card'},[
    h('div',{class:'card-head'},[ h('h3',{},'Tavily 搜索 API'), h('span',{class:'tag'},'D1 联网搜索') ]),
    h('p',{class:'field-hint',style:'margin-bottom:14px;', html:'• 在 <a href="https://tavily.com" target="_blank">tavily.com</a> 用 Google/GitHub 登录，免费额度每月 1000 次搜索。<br>• 配置后，每周大事件页会出现「🌐 AI 自动搜索本周」按钮——点一下就联网搜本周 AI 新闻 + DeepSeek 整理成 5 条卡片。'}),
    field('Tavily API Key', c.tavilyKey, v=>{c.tavilyKey=v.trim();saveCfg();}, '以 tvly- 开头', 'password'),
    h('button',{class:'btn small', onclick: testTavily, style:'margin-top:8px;'},'测试连接'),
  ]));

  // Reload data.js
  m.appendChild(h('div',{class:'card'},[
    h('div',{class:'card-head'},[ h('h3',{},'内容同步') ]),
    h('p',{class:'field-hint',style:'margin-bottom:12px;'},'从本地或 GitHub 重新载入 data.js（会覆盖未保存的草稿）。'),
    h('div',{style:'display:flex;gap:10px;'},[
      h('button',{class:'btn small', onclick: async ()=>{ await loadFromLocal(); switchTab(state.tab); }},'从本地 data.js 重新载入'),
      h('button',{class:'btn small', onclick: pullFromGitHub},'从 GitHub 重新载入'),
      h('button',{class:'btn small ghost', onclick: downloadDataJs},'下载当前 data.js'),
    ]),
  ]));
}

async function pullFromGitHub(){
  try {
    const c = state.cfg;
    if(!c.ghToken) throw new Error('请先填 GitHub Token');
    const url = `https://api.github.com/repos/${c.ghOwner}/${c.ghRepo}/contents/${c.ghPath}?ref=${encodeURIComponent(c.ghBranch)}`;
    const res = await fetch(url, { headers: { 'Authorization':'Bearer '+c.ghToken, 'Accept':'application/vnd.github.raw' }});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const txt = await res.text();
    parseDataJs(txt);
    saveDraft();
    switchTab(state.tab);
    toast('已从 GitHub 载入','success');
  } catch(e){ toast('载入失败：'+e.message,'error'); }
}

async function testGitHub(){
  try {
    const c = state.cfg;
    if(!c.ghToken || !c.ghOwner || !c.ghRepo) throw new Error('请先填完 owner、repo、token');
    const r = await fetch(`https://api.github.com/repos/${c.ghOwner}/${c.ghRepo}`, { headers: {'Authorization':'Bearer '+c.ghToken,'Accept':'application/vnd.github+json'}});
    if(!r.ok) throw new Error('HTTP '+r.status+'（检查 owner/repo/token 权限）');
    const j = await r.json();
    toast('✓ GitHub 连接成功：'+j.full_name, 'success');
  } catch(e){ toast('GitHub 测试失败：'+e.message,'error'); }
}
async function testTavily(){
  try {
    const rs = await tavilySearch('AI news today', { days: 1, max_results: 2 });
    toast('✓ Tavily 连接成功，搜到 '+rs.length+' 条','success');
  } catch(e){ toast('Tavily 测试失败：'+e.message,'error'); }
}
async function testDeepSeek(){
  try {
    const out = await callDeepSeek([{role:'user',content:'回复"OK"两个字'}], { max_tokens: 10 });
    toast('✓ DeepSeek 连接成功：'+out.slice(0,30), 'success');
  } catch(e){ toast('DeepSeek 测试失败：'+e.message,'error'); }
}

/* ═══════════════════════════════════════════════════════════
   Save bar
   ═══════════════════════════════════════════════════════════ */
function saveBar(label){
  const wrap = h('div',{class:'card', style:'background:var(--canvas-soft);position:sticky;bottom:16px;z-index:10;'},[
    h('div',{style:'display:flex;align-items:center;gap:12px;flex-wrap:wrap;'},[
      h('div',{style:'flex:1;min-width:200px;'},[
        h('div',{style:'font-size:13px;font-weight:500;color:var(--ink-800);'},'保存改动'),
        h('div',{class:'mono', style:'color:var(--ink-500);margin-top:3px;'},'写入两个文件：marketing/data.js 和 app/data.js'),
      ]),
      h('button',{class:'btn ghost', onclick: downloadDataJs},'下载文件'),
      h('button',{class:'btn primary', onclick: ()=>doSave(label), id:'btn-save'},[
        h('span',{class:'spin', id:'save-spin', style:'display:none;'}),
        document.createTextNode('  保存到 GitHub'),
      ]),
    ]),
  ]);
  return wrap;
}
async function doSave(label){
  const spin = document.getElementById('save-spin'); spin.style.display='inline-block';
  try {
    await pushToGitHub(label || '后台更新');
    clearDirty();
    toast('✓ 已保存到 GitHub。线上几分钟内生效（取决于部署设置）','success', 4500);
  } catch(e){ console.error(e); toast('保存失败：'+e.message,'error',5000); }
  finally { spin.style.display='none'; }
}

/* ═══════════════════════════════════════════════════════════
   Form helpers
   ═══════════════════════════════════════════════════════════ */
function field(label, value, onChange, hint, type='text'){
  const wrap = h('div',{class:'field'},[]);
  if(label) wrap.appendChild(h('label',{class:'field-label'}, label));
  const input = h('input',{class:'input', type, value: value||''});
  input.addEventListener('input', e => onChange && onChange(e.target.value));
  wrap.appendChild(input);
  if(hint) wrap.appendChild(h('div',{class:'field-hint',html:hint}));
  return wrap;
}
function textareaField(id, value, onChange, rows=4, hint, label){
  const wrap = h('div',{class:'field'},[]);
  if(label) wrap.appendChild(h('label',{class:'field-label'}, label));
  const ta = h('textarea',{class:'textarea body', rows});
  if(id) ta.id=id;
  ta.value = value||'';
  if(onChange) ta.addEventListener('input', e => onChange(e.target.value));
  wrap.appendChild(ta);
  if(hint) wrap.appendChild(h('div',{class:'field-hint',style:'white-space:pre-wrap;'}, hint));
  return wrap;
}
function selectField(label, value, options, onChange){
  const wrap = h('div',{class:'field'},[]);
  if(label) wrap.appendChild(h('label',{class:'field-label'}, label));
  const sel = h('select',{class:'select'},
    options.map(o => h('option',{value:o, selected: o===value? '': null}, o))
  );
  // selected attribute fix
  Array.from(sel.options).forEach(opt => { if(opt.value===value) opt.selected=true; });
  sel.addEventListener('change', e => onChange && onChange(e.target.value));
  wrap.appendChild(sel);
  return wrap;
}

/* Bootstrap */
initLogin();
