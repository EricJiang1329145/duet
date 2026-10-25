import { hashSeatWord, normalizeSeatWord } from "../../src/game/seatWord.js";

const MAX_WORD_LENGTH = 256;

const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout({ title, body }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<style>
  :root {
    color-scheme: light;
    --ink: #2d3b31;
    --muted: #657166;
    --line: rgba(58, 73, 60, 0.16);
    --paper: #fff9ee;
    --green: #334f40;
    --terracotta: #b96545;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 20px;
    background: #e7efdc;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
  main {
    width: min(560px, 100%);
    padding: 22px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--paper);
    box-shadow: 0 18px 48px rgba(47, 62, 46, 0.14);
  }
  .eyebrow {
    margin: 0;
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
  }
  h1 {
    margin: 4px 0 10px;
    font-size: 21px;
    letter-spacing: 0.03em;
  }
  p {
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 12.5px;
    line-height: 1.65;
  }
  form { display: grid; gap: 10px; margin: 16px 0 4px; }
  label { font-size: 11px; font-weight: 700; color: var(--green); }
  input {
    width: 100%;
    min-height: 46px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fff;
    color: var(--ink);
    font: inherit;
    font-size: 15px;
  }
  input:focus {
    outline: none;
    border-color: rgba(98, 128, 107, 0.55);
    box-shadow: 0 0 0 3px rgba(98, 128, 107, 0.13);
  }
  button {
    min-height: 44px;
    border: none;
    border-radius: 12px;
    background: var(--green);
    color: #fff8e9;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .result {
    margin: 16px 0;
    padding: 12px;
    border: 1px solid rgba(185, 101, 69, 0.22);
    border-radius: 12px;
    background: rgba(230, 183, 105, 0.14);
  }
  .result code {
    display: block;
    margin-top: 6px;
    color: var(--terracotta);
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 12px;
    line-height: 1.6;
    word-break: break-all;
    user-select: all;
  }
  .error {
    color: #8f3f2a;
    font-size: 12.5px;
    font-weight: 650;
  }
  .note {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(58, 73, 60, 0.1);
    font-size: 11.5px;
  }
  a { color: var(--green); }
  ul { margin: 8px 0 0; padding-left: 18px; }
  li { margin: 4px 0; font-size: 11.5px; line-height: 1.55; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function formPage({ error = "" } = {}) {
  return layout({
    title: "Duet · 生成密语摘要",
    body: `<p class="eyebrow">DUET · SEAT PASSHRASE</p>
<h1>生成密语摘要</h1>
<p>输入你和对方约定好的密语词，得到一段 64 位十六进制摘要。把<strong>摘要</strong>（不是原词）发给小院管理员，并注明这是 A 还是 B。</p>
<form method="post" action="/hash">
  <label for="word">密语词</label>
  <input
    id="word"
    name="word"
    type="text"
    maxlength="${MAX_WORD_LENGTH}"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    required
    placeholder="例如：moss-lantern-7"
  />
  <button type="submit">生成摘要</button>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
</form>
<div class="note">
  <p><strong>说明</strong></p>
  <ul>
    <li>摘要使用 SHA-256，原词不会被保存，也不能从摘要反推。</li>
    <li>首尾空格会被忽略，大小写敏感；同一密语在任何设备上得到同一摘要。</li>
    <li>请用至少 12 个字符、自己好记且不复用其他密码的短语。</li>
    <li>只把摘要发给对方或管理员，不要把原词发出去。</li>
  </ul>
</div>`
  });
}

function resultPage(hash) {
  return layout({
    title: "Duet · 密语摘要",
    body: `<p class="eyebrow">DUET · SEAT PASSHRASE</p>
<h1>你的密语摘要</h1>
<p>把下面这段摘要发给小院管理员，并注明这是 A 还是 B。不要发送原词。</p>
<div class="result">
  <label>SHA-256 摘要</label>
  <code>${escapeHtml(hash)}</code>
</div>
<p class="note"><a href="/hash">再生成一个</a></p>`
  });
}

export async function handleHashPage(request) {
  if (request.method === "GET") {
    return new Response(formPage(), { headers: PAGE_HEADERS });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, POST", "cache-control": "no-store" }
    });
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 4096) {
    return new Response("Payload Too Large", {
      status: 413,
      headers: { "cache-control": "no-store" }
    });
  }

  let word = "";
  try {
    const form = await request.formData();
    word = String(form.get("word") ?? "");
  } catch {
    return new Response(formPage({ error: "表单格式不对，请重试。" }), {
      status: 400,
      headers: PAGE_HEADERS
    });
  }

  if (!normalizeSeatWord(word)) {
    return new Response(formPage({ error: "密语词不能为空。" }), {
      status: 400,
      headers: PAGE_HEADERS
    });
  }
  if (word.length > MAX_WORD_LENGTH) {
    return new Response(formPage({ error: "密语词太长了。" }), {
      status: 400,
      headers: PAGE_HEADERS
    });
  }

  const hash = await hashSeatWord(word);
  return new Response(resultPage(hash), { headers: PAGE_HEADERS });
}
