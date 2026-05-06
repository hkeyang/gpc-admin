const SESSION_COOKIE = 'gpc_session';
const SESSION_MAX_AGE = 60 * 60 * 12;
const DEFAULT_PRODUCTS = [];

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

      if (isTrustedDevice(user, deviceId)) {
        return json({ ok: true, approved: true, user: publicUser(user), deviceId });
      }

      const requests = await this.state.storage.list({ prefix: 'login_request:' });
      for (const loginRequest of requests.values()) {
        if (
          loginRequest.username === username &&
          loginRequest.deviceId === deviceId &&
          loginRequest.status === 'pending'
        ) {
          return json({ ok: true, approved: false, requestId: loginRequest.id, message: '已提交登录申请，等待超级管理员批准' });
        }
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
      await trustDevice(this.state, user, loginRequest.deviceId);
      return json({ approved: true, user: publicUser(user), deviceId: loginRequest.deviceId });
    }

    if (url.pathname === '/users' && request.method === 'GET') {
      const users = [];
      const entries = await this.state.storage.list({ prefix: 'user:' });
      for (const user of entries.values()) users.push(adminUser(user));
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
        initialPassword: role === 'partner_admin' ? password : undefined,
        trustedDeviceIds: [],
        createdAt: new Date().toISOString()
      };
      await this.state.storage.put(`user:${username}`, user);
      return json({ user: adminUser(user) }, 201);
    }

    const userMatch = url.pathname.match(/^\/users\/([^/]+)$/);
    if (userMatch && request.method === 'GET') {
      const username = decodeURIComponent(userMatch[1]);
      const user = await this.state.storage.get(`user:${username}`);
      if (!user) return json({ message: '账号不存在' }, 404);
      return json({ user: publicUser(user) });
    }

    const statusMatch = url.pathname.match(/^\/users\/([^/]+)\/status$/);
    if (statusMatch && request.method === 'PATCH') {
      const username = decodeURIComponent(statusMatch[1]);
      const body = await readJson(request);
      const status = body.status === 'active' ? 'active' : 'disabled';
      const user = await this.state.storage.get(`user:${username}`);
      if (!user) return json({ message: '账号不存在' }, 404);
      if (user.role === 'super_admin') return json({ message: '不能停用超级管理员账号' }, 400);
      user.status = status;
      user.updatedAt = new Date().toISOString();
      await this.state.storage.put(`user:${username}`, user);
      return json({ user: adminUser(user) });
    }

    if (userMatch && request.method === 'DELETE') {
      const username = decodeURIComponent(userMatch[1]);
      const user = await this.state.storage.get(`user:${username}`);
      if (!user) return json({ message: '账号不存在' }, 404);
      if (user.role === 'super_admin') return json({ message: '不能删除超级管理员账号' }, 400);
      await this.state.storage.delete(`user:${username}`);
      return json({ ok: true });
    }

    if (url.pathname === '/products' && request.method === 'GET') {
      return json({ products: await this.listProducts() });
    }

    if (url.pathname === '/products' && request.method === 'POST') {
      const body = await readJson(request);
      return json({ product: await this.saveProduct(body) }, 201);
    }

    if (url.pathname === '/products' && request.method === 'DELETE') {
      const deleted = await this.clearProducts();
      return json({ ok: true, deleted });
    }

    const productMatch = url.pathname.match(/^\/products\/([^/]+)$/);
    if (productMatch && request.method === 'PUT') {
      const id = decodeURIComponent(productMatch[1]);
      const existing = await this.state.storage.get(`product:${id}`);
      if (!existing) return json({ message: '产品不存在' }, 404);
      const body = await readJson(request);
      return json({ product: await this.saveProduct({ ...existing, ...body, id }, id) });
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
      const user = await this.state.storage.get(`user:${loginRequest.username}`);
      if (user) {
        await trustDevice(this.state, user, loginRequest.deviceId);
      }
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

  async ensureDefaultProducts() {
    const seeded = await this.state.storage.get('products_seeded');
    if (seeded) return;
    if (DEFAULT_PRODUCTS.length) {
      const entries = await this.state.storage.list({ prefix: 'product:' });
      for (const product of DEFAULT_PRODUCTS) {
        await this.state.storage.put(`product:${product.id}`, sanitizeProduct(product, product.id));
      }
    }
    await this.state.storage.put('products_seeded', true);
  }

  async listProducts() {
    await this.ensureDefaultProducts();
    await this.cleanupDuplicateProducts();
    const entries = await this.state.storage.list({ prefix: 'product:' });
    return [...entries.values()].sort((a, b) => {
      const dateCompare = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      return dateCompare || Number(b.id || 0) - Number(a.id || 0);
    });
  }

  async cleanupDuplicateProducts() {
    const entries = await this.state.storage.list({ prefix: 'product:' });
    const groups = new Map();

    for (const [key, product] of entries) {
      const duplicateKey = productDuplicateKey(product);
      if (!duplicateKey) continue;
      const group = groups.get(duplicateKey) || [];
      group.push({ key, product });
      groups.set(duplicateKey, group);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => compareProductIds(a.product.id, b.product.id));
      const [canonical, ...duplicates] = sorted;
      const merged = duplicates.reduce((current, item) => mergeDuplicateProduct(current, item.product), canonical.product);

      await this.state.storage.put(canonical.key, merged);
      await Promise.all(duplicates.map((item) => this.state.storage.delete(item.key)));
    }
  }

  async nextProductId() {
    const products = await this.listProducts();
    const maxId = products.reduce((max, product) => {
      const id = Number(product.id);
      return Number.isFinite(id) ? Math.max(max, id) : max;
    }, 0);
    return maxId + 1;
  }

  async saveProduct(input, fixedId) {
    const id = fixedId ?? input.id ?? await this.nextProductId();
    const product = sanitizeProduct(input, id);
    await this.state.storage.put(`product:${product.id}`, product);
    return product;
  }

  async clearProducts() {
    const entries = await this.state.storage.list({ prefix: 'product:' });
    await Promise.all([...entries.keys()].map((key) => this.state.storage.delete(key)));
    await this.state.storage.put('products_seeded', true);
    return entries.size;
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
  if (url.pathname === '/api/exchange-rate' && request.method === 'GET') {
    return fetchUsdCnyRate();
  }

  if (!env.AUTH_STORE || !env.SESSION_SECRET) {
    return json({ message: '认证后端未配置，请检查 AUTH_STORE 和 SESSION_SECRET' }, 503);
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const session = await readSession(request, env);
    const sessionUser = session ? await fetchSessionUser(env, session.username) : null;
    if (session && !sessionUser) {
      return json({ authenticated: false, user: null }, 200, {
        'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
      });
    }
    return json({
      authenticated: Boolean(sessionUser),
      user: sessionUser
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
  const sessionUser = await fetchSessionUser(env, session.username);
  if (!sessionUser) {
    return json({ message: '账号已被停用或删除，请重新登录' }, 403, {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
    });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以操作' }, 403);

    if (url.pathname === '/api/admin/users') {
      return authStore(env).fetch(new Request('https://auth.local/users', {
        method: request.method,
        body: request.method === 'POST' ? await request.text() : undefined,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    const userStatusMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
    if (userStatusMatch && request.method === 'PATCH') {
      return authStore(env).fetch(new Request(`https://auth.local/users/${userStatusMatch[1]}/status`, {
        method: 'PATCH',
        body: await request.text(),
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && request.method === 'DELETE') {
      return authStore(env).fetch(new Request(`https://auth.local/users/${userMatch[1]}`, { method: 'DELETE' }));
    }

    if (url.pathname === '/api/admin/login-requests') {
      return authStore(env).fetch('https://auth.local/login-requests');
    }

    const approveMatch = url.pathname.match(/^\/api\/admin\/login-requests\/([^/]+)\/approve$/);
    if (approveMatch && request.method === 'POST') {
      return authStore(env).fetch(new Request(`https://auth.local/login-requests/${approveMatch[1]}/approve`, { method: 'POST' }));
    }
  }

  if (url.pathname === '/api/products' && ['GET', 'POST', 'DELETE'].includes(request.method)) {
    if (request.method === 'DELETE' && sessionUser.role !== 'super_admin') {
      return json({ message: '只有超级管理员可以清空产品数据' }, 403);
    }
    return authStore(env).fetch(new Request('https://auth.local/products', {
      method: request.method,
      body: request.method === 'POST' ? await request.text() : undefined,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && request.method === 'PUT') {
    return authStore(env).fetch(new Request(`https://auth.local/products/${productMatch[1]}`, {
      method: 'PUT',
      body: await request.text(),
      headers: { 'Content-Type': 'application/json' }
    }));
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
  const phone = formatPhoneNumber(body.phoneCode, body.phone);
  const message = body.message ? cleanMessage(body.message) : [
    `账号：${cleanLine(body.account)}`,
    `密码：${cleanLine(body.password)}`,
    `绑定手机号：${cleanLine(phone)}`,
    `绑定邮箱：${cleanLine(body.email)}`,
    `设备安全码：${cleanLine(body.securityCode)}`,
    `VPS登录链接：${cleanLine(body.vpsRemoteUrl)}`
  ].join('\n');

  if (!message) return json({ message: '推送内容为空，请检查推送设置。' }, 400);

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

async function fetchSessionUser(env, username) {
  const response = await authStore(env).fetch(`https://auth.local/users/${encodeURIComponent(username)}`);
  if (!response.ok) return null;
  const data = await response.json();
  const user = data.user;
  if (!user || user.status !== 'active') return null;
  return user;
}

function cleanLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function formatPhoneNumber(phoneCode, phone) {
  const code = cleanLine(phoneCode);
  const rawPhone = cleanLine(phone);
  if (!code) return rawPhone;
  if (!rawPhone) return code;

  const normalizedCode = code.replace(/^\+/, '');
  const normalizedPhone = rawPhone.replace(/^[+\s-]+/, '');
  if (normalizedPhone === normalizedCode) return code;
  if (normalizedPhone.startsWith(normalizedCode)) return `${code} ${normalizedPhone.slice(normalizedCode.length).trim()}`;
  return `${code} ${rawPhone}`;
}

function cleanMessage(value) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, 4096);
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

function normalizeTrustedDeviceIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = [];
  const seen = new Set();
  for (const item of value) {
    const deviceId = normalizeDeviceId(item);
    if (!deviceId || seen.has(deviceId)) continue;
    seen.add(deviceId);
    ids.push(deviceId);
  }
  return ids.slice(0, 20);
}

function isTrustedDevice(user, deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (!normalizedDeviceId) return false;
  return normalizeTrustedDeviceIds(user?.trustedDeviceIds).includes(normalizedDeviceId);
}

async function trustDevice(state, user, deviceId) {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (!normalizedDeviceId || !user) return user;
  const trustedDeviceIds = normalizeTrustedDeviceIds(user.trustedDeviceIds);
  if (trustedDeviceIds.includes(normalizedDeviceId)) return user;
  user.trustedDeviceIds = [normalizedDeviceId, ...trustedDeviceIds].slice(0, 20);
  user.updatedAt = new Date().toISOString();
  await state.storage.put(`user:${user.username}`, user);
  return user;
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

function adminUser(user) {
  return {
    ...publicUser(user),
    initialPassword: user.role === 'partner_admin' ? user.initialPassword || '' : ''
  };
}

function sanitizeProduct(input, id) {
  const now = new Date();
  const updatedAt = now.toLocaleTimeString('zh-CN', { hour12: false });
  return {
    id: normalizeProductId(id),
    createdAt: cleanLine(input.createdAt) || now.toISOString().slice(0, 10),
    account: cleanLine(input.account),
    email: cleanLine(input.email),
    phoneCode: cleanLine(input.phoneCode) || '+86',
    phone: cleanLine(input.phone),
    password: cleanLine(input.password),
    googleAuth: cleanLine(input.googleAuth),
    securityCode: cleanLine(input.securityCode),
    vpsIp: cleanLine(input.vpsIp),
    vpsRemoteUrl: cleanLine(input.vpsRemoteUrl),
    vpsUsername: cleanLine(input.vpsUsername),
    vpsPassword: cleanLine(input.vpsPassword),
    remark: String(input.remark || '').slice(0, 200),
    costs: Array.isArray(input.costs) ? input.costs.map(sanitizeCost).filter(Boolean) : [],
    salePrice: numberOrZero(input.salePrice),
    saleTime: cleanLine(input.saleTime),
    isSold: Boolean(input.isSold),
    isPaid: Boolean(input.isPaid),
    settlementStatus: input.settlementStatus === 'settled' ? 'settled' : 'unsettled',
    settledAt: cleanLine(input.settledAt),
    settlementExchangeRate: positiveNumberOrNull(input.settlementExchangeRate),
    settlementShareCnyHongKong: nullableNumber(input.settlementShareCnyHongKong),
    settlementShareCnyWuhan: nullableNumber(input.settlementShareCnyWuhan),
    settlementHongKongCostUsd: nullableNumber(input.settlementHongKongCostUsd),
    settlementWuhanCostUsd: nullableNumber(input.settlementWuhanCostUsd),
    settlementProfitUsd: nullableNumber(input.settlementProfitUsd),
    settlementHongKongReceivableUsd: nullableNumber(input.settlementHongKongReceivableUsd),
    settlementWuhanRetainedUsd: nullableNumber(input.settlementWuhanRetainedUsd),
    settlementHongKongReceivableCny: nullableNumber(input.settlementHongKongReceivableCny),
    settlementWuhanRetainedCny: nullableNumber(input.settlementWuhanRetainedCny),
    saleRemark: String(input.saleRemark || '').slice(0, 200),
    accountType: input.accountType === 'enterprise' ? 'enterprise' : input.accountType === 'personal' ? 'personal' : '',
    accountCreationDate: cleanLine(input.accountCreationDate),
    accountCountry: cleanLine(input.accountCountry),
    accountInfoRaw: String(input.accountInfoRaw || '').slice(0, 3000),
    accountInfoFormatted: String(input.accountInfoFormatted || '').slice(0, 3000),
    updatedAt
  };
}

function productDuplicateKey(product) {
  const createdDate = cleanLine(product.createdAt).slice(0, 10);
  if (!createdDate) return '';

  const account = cleanLine(product.account).toLowerCase();
  const email = cleanLine(product.email).toLowerCase();
  const phone = [cleanLine(product.phoneCode), cleanLine(product.phone)].filter(Boolean).join(' ').toLowerCase();
  const vpsRemoteUrl = cleanLine(product.vpsRemoteUrl).toLowerCase();
  const identity = [account, email, phone, vpsRemoteUrl].filter(Boolean).join('|');

  return identity ? `${createdDate}|${identity}` : '';
}

function mergeDuplicateProduct(base, duplicate) {
  const merged = { ...base };
  const textFields = [
    'account',
    'email',
    'phoneCode',
    'phone',
    'password',
    'googleAuth',
    'securityCode',
    'vpsIp',
    'vpsRemoteUrl',
    'vpsUsername',
    'vpsPassword',
    'remark',
    'saleTime',
    'settledAt',
    'settlementExchangeRate',
    'settlementShareCnyHongKong',
    'settlementShareCnyWuhan',
    'settlementHongKongCostUsd',
    'settlementWuhanCostUsd',
    'settlementProfitUsd',
    'settlementHongKongReceivableUsd',
    'settlementWuhanRetainedUsd',
    'settlementHongKongReceivableCny',
    'settlementWuhanRetainedCny',
    'saleRemark',
    'accountType',
    'accountCreationDate',
    'accountCountry',
    'accountInfoRaw',
    'accountInfoFormatted',
    'updatedAt'
  ];

  for (const field of textFields) {
    const value = cleanLine(duplicate[field]);
    if (value) merged[field] = duplicate[field];
  }

  if (Array.isArray(duplicate.costs) && sumProductCosts(duplicate) >= sumProductCosts(merged)) {
    merged.costs = duplicate.costs;
  }
  if (numberOrZero(duplicate.salePrice) > 0) merged.salePrice = numberOrZero(duplicate.salePrice);

  merged.isSold = Boolean(base.isSold || duplicate.isSold);
  merged.isPaid = Boolean(base.isPaid || duplicate.isPaid);
  merged.settlementStatus = base.settlementStatus === 'settled' || duplicate.settlementStatus === 'settled' ? 'settled' : 'unsettled';

  return merged;
}

function sumProductCosts(product) {
  return Array.isArray(product.costs)
    ? product.costs.reduce((total, item) => total + numberOrZero(item?.amount), 0)
    : 0;
}

function compareProductIds(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a || '').localeCompare(String(b || ''));
}

function sanitizeCost(item, index) {
  const label = cleanLine(item?.label);
  if (!label) return null;
  return {
    id: normalizeProductId(item.id || Date.now() + index),
    label,
    amount: item.amount === '' ? '' : numberOrZero(item.amount),
    owner: item.owner === 'wuhan' ? 'wuhan' : 'hongKong',
    remark: String(item.remark || '').slice(0, 120)
  };
}

function normalizeProductId(value) {
  const number = Number(value);
  return Number.isFinite(number) && String(value).trim() !== '' ? number : cleanLine(value);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function fetchUsdCnyRate() {
  const candidates = await Promise.allSettled([
    fetchFrankfurterRate(),
    fetchOpenExchangeRate()
  ]);
  const rates = candidates
    .filter((candidate) => candidate.status === 'fulfilled' && candidate.value)
    .map((candidate) => candidate.value)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if (!rates.length) return json({ message: '汇率获取失败，请稍后重试' }, 502);
  return json(rates[0]);
}

async function fetchFrankfurterRate() {
  const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=CNY&t=${Date.now()}`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error('Frankfurter failed');
  const data = await response.json().catch(() => ({}));
  const rate = Number(data?.rates?.CNY);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Frankfurter invalid rate');

  return {
    base: 'USD',
    quote: 'CNY',
    rate,
    date: cleanLine(data.date),
    source: 'Frankfurter'
  };
}

async function fetchOpenExchangeRate() {
  const response = await fetch(`https://open.er-api.com/v6/latest/USD?t=${Date.now()}`, {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error('ExchangeRate-API failed');
  const data = await response.json().catch(() => ({}));
  const rate = Number(data?.rates?.CNY);
  if (data?.result !== 'success' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('ExchangeRate-API invalid rate');
  }

  return {
    base: 'USD',
    quote: 'CNY',
    rate,
    date: cleanLine(exchangeDateFromUnix(data.time_last_update_unix)),
    source: 'ExchangeRate-API'
  };
}

function exchangeDateFromUnix(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return new Date(seconds * 1000).toISOString().slice(0, 10);
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
