#!/usr/bin/env node
/**
 * 给运营发本周草稿提醒邮件。
 * 由 workflow 在 PR 创建后调用，参数从环境变量传入。
 */

const KEY = process.env.RESEND_API_KEY;
const TO  = process.env.NOTIFY_EMAIL;
const PR_URL    = process.env.PR_URL;
const PR_NUMBER = process.env.PR_NUMBER;
const META_JSON = process.env.DRAFT_META || '{}';

if (!KEY) throw new Error('Missing RESEND_API_KEY');
if (!TO)  throw new Error('Missing NOTIFY_EMAIL');

const meta = JSON.parse(META_JSON);
const events = meta.events || [];

const eventsHtml = events
  .map(
    (e, i) =>
      `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e8e3d2;font-family:'Source Code Pro',monospace;color:#a39e8d;font-size:11px;letter-spacing:0.08em;width:30px;vertical-align:top;">${String(i + 1).padStart(2, '0')}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e8e3d2;vertical-align:top;">
          <div style="font-family:'Source Code Pro',monospace;font-size:10px;letter-spacing:0.12em;color:#cc785c;text-transform:uppercase;margin-bottom:4px;">${e.kind || ''}</div>
          <div style="font-family:'Noto Serif SC',serif;font-size:15px;color:#3d3729;line-height:1.45;">${e.title || ''}</div>
        </td>
      </tr>`
  )
  .join('');

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f0e8;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#faf9f5;border:1px solid #e8e3d2;">
    <div style="padding:32px 40px 8px;border-bottom:1px solid #e8e3d2;">
      <div style="font-family:'Source Code Pro',monospace;font-size:11px;color:#cc785c;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;">Midea AI Lab · Weekly Draft</div>
    </div>
    <div style="padding:24px 40px 8px;">
      <h1 style="font-family:'Noto Serif SC',serif;font-size:22px;color:#3d3729;font-weight:500;margin:0 0 6px;line-height:1.3;">本周草稿已生成</h1>
      <p style="font-family:'Source Code Pro',monospace;font-size:12px;color:#7a7363;margin:0 0 24px;letter-spacing:0.04em;">${meta.weekId || ''} · ${meta.weekOf || ''}</p>
      <p style="font-size:14px;color:#3d3729;line-height:1.7;margin:0 0 24px;">5 条候选大事件已自动整理。请打开 GitHub PR 审阅，确认无误后点击 <strong>Merge</strong>，Vercel 会在 1–2 分钟内自动部署上线。</p>
    </div>
    <div style="padding:0 40px 8px;">
      <table style="width:100%;border-collapse:collapse;">${eventsHtml}</table>
    </div>
    <div style="padding:32px 40px 40px;text-align:center;">
      <a href="${PR_URL}" style="display:inline-block;background:#3d3729;color:#faf9f5;padding:14px 36px;text-decoration:none;font-family:'Noto Serif SC',serif;font-size:15px;font-weight:500;letter-spacing:0.04em;border-radius:2px;">打开 PR #${PR_NUMBER} 审阅 →</a>
    </div>
    <div style="padding:24px 40px;background:#f4f0e8;border-top:1px solid #e8e3d2;font-size:12px;color:#a39e8d;line-height:1.6;">
      <strong style="color:#7a7363;">三个选项：</strong><br>
      ✓ 内容 OK → 在 PR 里点 <strong>Merge</strong>，自动上线<br>
      ✎ 想改 → 直接在后台 <code>/admin/index.html</code> 改完保存（会推到 main，跳过 PR）<br>
      ✗ 不想发 → 在 PR 里点 <strong>Close</strong>，本周不更新
    </div>
    <div style="padding:16px 40px;background:#3d3729;color:#a39e8d;font-size:10px;font-family:'Source Code Pro',monospace;letter-spacing:0.1em;text-align:center;">
      MIDEA AI LAB · AUTOMATED WEEKLY DRAFT · ${new Date().toISOString().slice(0, 10)}
    </div>
  </div>
</body>
</html>`;

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${KEY}`,
  },
  body: JSON.stringify({
    from: 'Midea AI Lab <onboarding@resend.dev>',
    to: [TO],
    subject: `[周草稿] ${meta.weekId || ''} · ${(events[0] && events[0].title) || '本周 5 条已生成'}`,
    html,
  }),
});

if (!res.ok) {
  console.error('Resend failed:', res.status, await res.text());
  process.exit(1);
}
const json = await res.json();
console.log('Email sent:', json.id);
