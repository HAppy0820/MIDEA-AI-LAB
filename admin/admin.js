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
  } catch(e){ throw new Error('解析 data.js 失败：'+e.message); }
}

/* ─── Serialize back to data.js ─── */
function serializeDataJs(){
  const T = JSON.stringify(state.data.TIMELINE, null, 2);
  const W = JSON.stringify(state.data.WEEKLY, null, 2);
  const E = JSON.stringify(state.data.ESSAYS, null, 2);
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
  const renderers = { weekly: renderWeekly, essays: renderEssays, timeline: renderTimeline, settings: renderSettings };
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
  return card;
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
      "glyph": "图标关键词，从这几个选：pulse / branch / spark / shield / box / star / globe",
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
    toast(`AI 已整理 ${json.events.length} 条卡片，请审核`, 'success');
  } catch(e){
    console.error(e);
    toast('AI 整理失败：'+e.message,'error');
  } finally {
    if(spin) spin.style.display='none';
  }
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
    selectField('模型', c.dsModel||'deepseek-chat', ['deepseek-chat','deepseek-reasoner'], v=>{c.dsModel=v;saveCfg();}),
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
