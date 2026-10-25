import {
  clearSessionCookie,
  getSessionSeat,
  matchSeat,
  sessionCookie,
  signSession
} from "./auth.js";
import { normalizeSeatWord } from "../../src/game/seatWord.js";

const MAX_WORD_LENGTH = 256;
const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
};

function safeNext(value) {
  const text = String(value ?? "");
  return text.startsWith("/") && !text.startsWith("//") ? text : "/";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page({ error = "", configured = true, next = "/" } = {}) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>Duet · 进入小院</title>
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
    width: min(420px, 100%);
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 22px;
    background: var(--paper);
    box-shadow: 0 18px 48px rgba(47, 62, 46, 0.14);
  }
  .eyebrow {
    margin: 0;
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
  }
  h1 { margin: 6px 0 8px; font-size: 23px; letter-spacing: 0.04em; }
  p { margin: 0 0 14px; color: var(--muted); font-size: 13px; line-height: 1.65; }
  form { display: grid; gap: 10px; margin-top: 18px; }
  label { font-size: 11px; font-weight: 700; color: var(--green); }
  input {
    width: 100%;
    min-height: 48px;
    padding: 10px 13px;
    border: 1px solid var(--line);
    border-radius: 13px;
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
    min-height: 46px;
    border: none;
    border-radius: 13px;
    background: var(--green);
    color: #fff8e9;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .error {
    margin-top: 12px;
    color: #8f3f2a;
    font-size: 12.5px;
    font-weight: 650;
  }
  .note {
    margin-top: 18px;
    padding-top: 13px;
    border-top: 1px solid rgba(58, 73, 60, 0.1);
    font-size: 11.5px;
    line-height: 1.6;
    color: var(--muted);
  }
  .note strong { color: var(--green); }
</style>
</head>
<body>
<main>
  <p class="eyebrow">DUET · PRIVATE GARDEN</p>
  <h1>进入小院</h1>
  <p>输入你的密语词。A和B的密语各自对应一个角色，不需要选择。</p>
  ${
    configured
      ? `<form method="post" action="/login?next=${encodeURIComponent(next)}">
    <label for="word">密语词</label>
    <input id="word" name="word" type="text" maxlength="${MAX_WORD_LENGTH}"
      autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
      inputmode="text" required autofocus />
    <button type="submit">进入小院</button>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  </form>`
      : `<p class="error">登录尚未配置，请管理员先设置密语摘要和会话密钥。</p>`
  }
  <div class="note">
    <strong>说明</strong><br />
    密语原词只用于服务端校验，不会保存、回显或写日志。登录状态保留一个月。
  </div>
</main>
</body>
</html>`;
}

function redirect(location, status = 303, extraHeaders = {}) {
  return new Response(null, {
    status,
    headers: {
      location,
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function isConfigured(env) {
  return Boolean(
    env?.SEAT_A_HASH &&
      env?.SEAT_B_HASH &&
      env?.SESSION_SECRET &&
      String(env.SESSION_SECRET).length >= 16
  );
}

export async function handleLoginPage(request, env) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const next = safeNext(url.searchParams.get("next"));

  if (request.method === "GET") {
    if (await getSessionSeat(request, env)) {
      return redirect(next, 302);
    }
    const configured = isConfigured(env);
    return new Response(page({ configured, next }), {
      status: configured ? 200 : 503,
      headers: PAGE_HEADERS
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, POST", "cache-control": "no-store" }
    });
  }

  if (!isConfigured(env)) {
    return new Response(page({ configured: false, next }), {
      status: 503,
      headers: PAGE_HEADERS
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
    return new Response(page({ error: "表单格式不对，请重试。", next }), {
      status: 400,
      headers: PAGE_HEADERS
    });
  }

  if (!normalizeSeatWord(word) || word.length > MAX_WORD_LENGTH) {
    return new Response(page({ error: "密语不正确。", next }), {
      status: 401,
      headers: PAGE_HEADERS
    });
  }

  const seat = await matchSeat(word, {
    A: env.SEAT_A_HASH,
    B: env.SEAT_B_HASH
  });
  if (!seat) {
    return new Response(page({ error: "密语不正确。", next }), {
      status: 401,
      headers: PAGE_HEADERS
    });
  }

  const token = await signSession(seat, env.SESSION_SECRET);
  if (!token) {
    return new Response(page({ configured: false, next }), {
      status: 503,
      headers: PAGE_HEADERS
    });
  }

  return redirect(next, 303, {
    "set-cookie": sessionCookie(token, { secure })
  });
}

export function handleLogout(request) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  return redirect("/login", 303, {
    "set-cookie": clearSessionCookie({ secure })
  });
}
