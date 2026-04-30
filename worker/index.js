const SESSION_COOKIE = 'gpc_session';
const SESSION_MAX_AGE = 60 * 60 * 12;

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
  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const session = await readSession(request, env);
    return json({
      authenticated: Boolean(session),
      deviceAuthorized: Boolean(session?.deviceAuthorized),
      user: session ? { username: session.username, role: 'admin' } : null
    });
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJson(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const deviceId = normalizeDeviceId(body.deviceId);

    if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) {
      return json({ message: '后台登录密钥未配置，请先配置 Cloudflare Secrets' }, 503);
    }

    const expectedUsername = env.ADMIN_USERNAME || 'admin';
    const passwordOk = username === expectedUsername && await verifyPbkdf2(password, env.ADMIN_PASSWORD_HASH);
    if (!passwordOk || !deviceId) {
      return json({ message: '账号、密码或设备信息错误' }, 401);
    }

    const token = await signSession({
      username,
      deviceId,
      deviceAuthorized: false,
      exp: nowSeconds() + SESSION_MAX_AGE
    }, env.SESSION_SECRET);

    return json(
      { ok: true, requiresDeviceApproval: true },
      200,
      { 'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE) }
    );
  }

  if (url.pathname === '/api/auth/authorize-device' && request.method === 'POST') {
    const session = await readSession(request, env);
    if (!session) return json({ message: '登录已过期，请重新登录' }, 401);

    const body = await readJson(request);
    const approvalCode = String(body.approvalCode || '');
    const deviceId = normalizeDeviceId(body.deviceId);

    if (!env.DEVICE_APPROVAL_CODE_HASH || !env.SESSION_SECRET) {
      return json({ message: '设备授权密钥未配置，请先配置 Cloudflare Secrets' }, 503);
    }

    if (!deviceId || deviceId !== session.deviceId) {
      return json({ message: '设备信息不匹配，请重新登录' }, 403);
    }

    const codeOk = await verifyPbkdf2(approvalCode, env.DEVICE_APPROVAL_CODE_HASH);
    if (!codeOk) return json({ message: '设备授权码错误' }, 403);

    const token = await signSession({
      username: session.username,
      deviceId,
      deviceAuthorized: true,
      exp: nowSeconds() + SESSION_MAX_AGE
    }, env.SESSION_SECRET);

    return json(
      { ok: true, deviceAuthorized: true },
      200,
      { 'Set-Cookie': sessionCookie(token, SESSION_MAX_AGE) }
    );
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    });
  }

  return json({ message: 'Not found' }, 404);
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

async function verifyPbkdf2(password, storedHash) {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHash = parts[3];
  if (!Number.isFinite(iterations) || iterations < 100000 || !salt || !expectedHash) return false;

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
