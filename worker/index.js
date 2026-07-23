import {
  LOSS_EVENT_TYPES,
  calculateLossSettlement,
  normalizeLossRecoveryOwner,
  normalizeLossSharingRule,
  reverseLossSettlement
} from '../src/loss-ledger.js';

const SESSION_COOKIE = 'gpc_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const VERIFIER_TOKEN_MAX_AGE = 60 * 60 * 24 * 365;
const VERIFIER_SHORT_CODE_LENGTH = 10;
const VERIFIER_RECOVERY_UNLOCK_TTL = 5 * 60;
const VERIFIER_RECOVERY_FAILURE_LIMIT = 3;
const VERIFIER_RECOVERY_COOLDOWNS = [15 * 60, 60 * 60, 24 * 60 * 60];
const DEFAULT_VERIFIER_BASE_URL = 'https://shougema.top/';
const MICROSOFT_DEFAULT_TENANT = 'consumers';
const MICROSOFT_GRAPH_SCOPE = 'offline_access User.Read Mail.Read';
const DEFAULT_PRODUCTS = [];
const GOOGLE_DEVELOPER_ROLE = 'google_developer';
const CONTENT_TEMPLATE_SCENES = new Set(['googleDeveloper', 'appleDeveloper']);
const CONTENT_TEMPLATE_FIELDS = new Set([
  'account',
  'password',
  'email',
  'recoveryEmailPassword',
  'phone',
  'googleAuth',
  'securityCode',
  'phoneSmsCode',
  'verifierLinkUrl',
  'vpsRemoteUrl',
  'smsLink',
  'remark'
]);

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

      if (isTrustedDevice(user, deviceId)) {
        return json({ ok: true, approved: true, user: publicUser(user), deviceId });
      }

      if (user.role === 'super_admin' && normalizeTrustedDeviceIds(user.trustedDeviceIds).length === 0) {
        await trustDevice(this.state, user, deviceId);
        return json({ ok: true, approved: true, user: publicUser(user), deviceId });
      }

      const requests = await this.state.storage.list({ prefix: 'login_request:' });
      for (const loginRequest of requests.values()) {
        if (
          loginRequest.username === username &&
          loginRequest.deviceId === deviceId &&
          loginRequest.status === 'pending'
        ) {
          return json({ ok: true, approved: false, requestId: loginRequest.id, message: '已提交登录申请，请在已登录管理员后台批准' });
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

      return json({ ok: true, approved: false, requestId, message: '已提交登录申请，请在已登录管理员后台批准' });
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
      const role = normalizeUserRole(body.role);

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
        initialPassword: role !== 'super_admin' ? password : undefined,
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
      try {
        return json({ product: await this.saveProduct(body) }, 201);
      } catch (error) {
        return json({ message: error.message || '产品保存失败' }, 400);
      }
    }

    if (url.pathname === '/products' && request.method === 'DELETE') {
      const deleted = await this.clearProducts();
      return json({ ok: true, deleted });
    }

    if (url.pathname === '/content-templates' && request.method === 'GET') {
      const stored = await this.state.storage.get('content_templates');
      return json({
        templates: Array.isArray(stored?.templates) ? stored.templates : [],
        updatedAt: cleanLine(stored?.updatedAt),
        updatedBy: cleanLine(stored?.updatedBy)
      });
    }

    if (url.pathname === '/content-templates' && request.method === 'PUT') {
      const body = await readJson(request);
      const result = sanitizeContentTemplates(body.templates);
      if (result.error) return json({ message: result.error }, 400);
      const stored = {
        templates: result.templates,
        updatedAt: new Date().toISOString(),
        updatedBy: cleanLine(body.updatedBy).slice(0, 80)
      };
      await this.state.storage.put('content_templates', stored);
      return json(stored);
    }

    if (url.pathname === '/sales-customers' && request.method === 'GET') {
      return json({ customers: await this.listSalesCustomers() });
    }

    if (url.pathname === '/sales-customers' && request.method === 'POST') {
      const body = await readJson(request);
      const result = await this.saveSalesCustomer(body);
      if (result.error) return json({ message: result.error, customer: result.customer || null }, result.status || 400);
      return json({ customer: result.customer }, 201);
    }

    const salesCustomerMatch = url.pathname.match(/^\/sales-customers\/([^/]+)$/);
    if (salesCustomerMatch && request.method === 'PUT') {
      const id = decodeURIComponent(salesCustomerMatch[1]);
      const existing = await this.state.storage.get(`sales_customer:${id}`);
      if (!existing) return json({ message: '客户不存在' }, 404);
      const body = await readJson(request);
      const result = await this.saveSalesCustomer({ ...existing, ...body, id }, id);
      if (result.error) return json({ message: result.error, customer: result.customer || null }, result.status || 400);
      return json({ customer: result.customer });
    }

    if (url.pathname === '/google-developer-products' && request.method === 'GET') {
      const username = url.searchParams.get('username') || '';
      return json({ products: await this.listGoogleDeveloperProducts(username) });
    }

    const googleDeveloperProductMatch = url.pathname.match(/^\/google-developer-products\/([^/]+)$/);
    if (googleDeveloperProductMatch && request.method === 'PUT') {
      const id = decodeURIComponent(googleDeveloperProductMatch[1]);
      const existing = await this.state.storage.get(`product:${id}`);
      if (!existing) return json({ message: '产品不存在' }, 404);
      const body = await readJson(request);
      const username = url.searchParams.get('username') || '';
      const result = await this.saveGoogleDeveloperInfo(existing, body.product || body.info || {}, username);
      if (result.error) return json({ message: result.error }, 403);
      return json({ product: result.product });
    }

    if (url.pathname === '/purchase-expenses' && request.method === 'GET') {
      return json({ expenses: await this.listPurchaseExpenses() });
    }

    if (url.pathname === '/loss-events' && request.method === 'GET') {
      return json({ events: await this.listLossEvents() });
    }

    if (url.pathname === '/loss-events' && request.method === 'POST') {
      const body = await readJson(request);
      try {
        return json(await this.createLossEvent(body), 201);
      } catch (error) {
        return json({ message: error.message || '异常记录保存失败' }, 400);
      }
    }

    const lossEventSettleMatch = url.pathname.match(/^\/loss-events\/([^/]+)\/settle$/);
    if (lossEventSettleMatch && request.method === 'POST') {
      const id = decodeURIComponent(lossEventSettleMatch[1]);
      const body = await readJson(request);
      try {
        return json({ event: await this.settleLossEvent(id, body) });
      } catch (error) {
        return json({ message: error.message || '异常结算失败' }, 400);
      }
    }

    if (url.pathname === '/telegram-targets' && request.method === 'GET') {
      const targets = await this.listTelegramTargets();
      return json({ targets: targets.map(publicTelegramTarget) });
    }

    if (url.pathname === '/telegram-targets' && request.method === 'POST') {
      const body = await readJson(request);
      const result = await this.saveTelegramTarget(body);
      if (result.error) return json({ message: result.error }, result.status || 400);
      return json({ target: publicTelegramTarget(result.target) }, 201);
    }

    const telegramTargetMatch = url.pathname.match(/^\/telegram-targets\/([^/]+)$/);
    if (telegramTargetMatch && request.method === 'PUT') {
      const id = normalizeTelegramTargetId(decodeURIComponent(telegramTargetMatch[1]));
      const existing = await this.state.storage.get(`telegram_target:${id}`);
      if (!existing) return json({ message: '电报接收对象不存在' }, 404);
      const body = await readJson(request);
      const result = await this.saveTelegramTarget({ ...existing, ...body, id }, id);
      if (result.error) return json({ message: result.error }, result.status || 400);
      return json({ target: publicTelegramTarget(result.target) });
    }

    if (telegramTargetMatch && request.method === 'DELETE') {
      const id = normalizeTelegramTargetId(decodeURIComponent(telegramTargetMatch[1]));
      const existing = await this.state.storage.get(`telegram_target:${id}`);
      if (!existing) return json({ message: '电报接收对象不存在' }, 404);
      await this.state.storage.delete(`telegram_target:${id}`);
      return json({ ok: true });
    }

    const telegramTargetResolveMatch = url.pathname.match(/^\/telegram-targets\/([^/]+)\/resolve$/);
    if (telegramTargetResolveMatch && request.method === 'GET') {
      const id = normalizeTelegramTargetId(decodeURIComponent(telegramTargetResolveMatch[1]));
      const target = await this.findTelegramTarget(id);
      if (!target) return json({ message: '请选择有效的电报发送对象' }, 404);
      return json({ target });
    }

    if (url.pathname === '/purchase-expenses' && request.method === 'POST') {
      const body = await readJson(request);
      const result = await this.savePurchaseExpense(body);
      if (result.error) return json({ message: result.error }, 400);
      return json({ expense: result.expense }, 201);
    }

    const purchaseExpenseMatch = url.pathname.match(/^\/purchase-expenses\/([^/]+)$/);
    if (purchaseExpenseMatch && request.method === 'PUT') {
      const id = decodeURIComponent(purchaseExpenseMatch[1]);
      const existing = await this.state.storage.get(`purchase_expense:${id}`);
      if (!existing) return json({ message: '代采购费用不存在' }, 404);
      const body = await readJson(request);
      const result = await this.savePurchaseExpense({ ...existing, ...body, id }, id);
      if (result.error) return json({ message: result.error }, 400);
      return json({ expense: result.expense });
    }

    if (purchaseExpenseMatch && request.method === 'DELETE') {
      const id = decodeURIComponent(purchaseExpenseMatch[1]);
      const existing = await this.state.storage.get(`purchase_expense:${id}`);
      if (!existing) return json({ message: '代采购费用不存在' }, 404);
      await this.state.storage.delete(`purchase_expense:${id}`);
      return json({ ok: true });
    }

    if (url.pathname === '/verifier-links' && request.method === 'POST') {
      const body = await readJson(request);
      const productId = cleanLine(body.productId || body.id);
      if (!productId) return json({ message: '产品 ID 不能为空' }, 400);
      const product = await this.state.storage.get(`product:${productId}`);
      if (!product) return json({ message: '产品不存在或已删除' }, 404);
      const record = await this.createVerifierLink(productId, cleanLine(body.createdBy));
      return json({ record }, 201);
    }

    if (url.pathname === '/verifier-links' && request.method === 'GET') {
      const productId = cleanLine(url.searchParams.get('productId') || url.searchParams.get('id'));
      if (!productId) return json({ message: '产品 ID 不能为空' }, 400);
      const record = await this.findLatestVerifierLinkForProduct(productId);
      return json({ record });
    }

    const verifierLinkMatch = url.pathname.match(/^\/verifier-links\/([^/]+)$/);
    if (verifierLinkMatch && request.method === 'GET') {
      const code = normalizeVerifierCode(decodeURIComponent(verifierLinkMatch[1]));
      const record = code ? await this.state.storage.get(`verifier_link:${code}`) : null;
      if (!record || record.revokedAt) return json({ message: '接码链接无效，请重新生成' }, 404);
      if (record.exp < nowSeconds()) {
        await this.state.storage.delete(`verifier_link:${code}`);
        return json({ message: '接码链接已过期，请重新生成' }, 410);
      }
      return json({ record });
    }

    if (url.pathname === '/verifier-links' && request.method === 'DELETE') {
      const body = await readJson(request);
      const code = normalizeVerifierCode(body.token || body.code);
      const productId = cleanLine(body.productId || body.id);
      const revoked = code
        ? await this.revokeVerifierCode(code, productId)
        : await this.revokeVerifierLinksForProduct(productId);
      return json({ ok: true, revoked });
    }

    if (url.pathname === '/verifier-recovery' && request.method === 'POST') {
      const body = await readJson(request);
      return this.unlockVerifierRecovery(body);
    }

    if (url.pathname === '/hotmail-auth/status' && request.method === 'GET') {
      const productId = cleanLine(url.searchParams.get('productId') || url.searchParams.get('id'));
      const email = normalizeEmailKey(url.searchParams.get('email') || await this.emailForProduct(productId));
      if (!email) return json({ configured: false, message: '该产品没有配置 Hotmail 邮箱。' });
      const record = await this.getHotmailAuth(email);
      return json({ auth: publicHotmailAuth(record, email) });
    }

    if (url.pathname === '/hotmail-auth/device' && request.method === 'POST') {
      const body = await readJson(request);
      const productId = cleanLine(body.productId || body.id);
      const email = normalizeEmailKey(body.email || await this.emailForProduct(productId));
      if (!email) return json({ message: '请先填写恢复邮箱账号。' }, 400);
      const result = await this.startHotmailDeviceAuth({
        email,
        productId,
        startedBy: cleanLine(body.startedBy)
      });
      if (result.error) return json({ message: result.error }, result.status || 400);
      return json(result.authRequest, 201);
    }

    if (url.pathname === '/hotmail-auth/device-status' && request.method === 'GET') {
      const requestId = cleanLine(url.searchParams.get('requestId') || url.searchParams.get('id'));
      if (!requestId) return json({ message: '授权请求 ID 不能为空' }, 400);
      const result = await this.pollHotmailDeviceAuth(requestId);
      if (result.error) return json({ message: result.error }, result.status || 400);
      return json(result.status);
    }

    if (url.pathname === '/hotmail-auth' && request.method === 'DELETE') {
      const body = await readJson(request);
      const productId = cleanLine(body.productId || body.id);
      const email = normalizeEmailKey(body.email || await this.emailForProduct(productId));
      if (!email) return json({ message: '请先填写恢复邮箱账号。' }, 400);
      await this.state.storage.delete(`hotmail_auth:${email}`);
      return json({ ok: true, auth: publicHotmailAuth(null, email) });
    }

    if (url.pathname === '/hotmail-auth/mail-code' && request.method === 'GET') {
      const email = normalizeEmailKey(url.searchParams.get('email'));
      if (!email) return json({ message: '邮箱不能为空' }, 400);
      const result = await this.readHotmailVerificationCode(email);
      if (result.error) return json({ message: result.error, email }, result.status || 400);
      return json(result.data);
    }

    const productMatch = url.pathname.match(/^\/products\/([^/]+)$/);
    if (productMatch && request.method === 'GET') {
      const id = decodeURIComponent(productMatch[1]);
      const product = await this.state.storage.get(`product:${id}`);
      if (!product) return json({ message: '产品不存在' }, 404);
      return json({ product });
    }

    if (productMatch && request.method === 'PUT') {
      const id = decodeURIComponent(productMatch[1]);
      const existing = await this.state.storage.get(`product:${id}`);
      if (!existing) return json({ message: '产品不存在' }, 404);
      const body = await readJson(request);
      try {
        return json({ product: await this.saveProduct({ ...existing, ...body, id }, id) });
      } catch (error) {
        return json({ message: error.message || '产品保存失败' }, 400);
      }
    }

    const productSettleMatch = url.pathname.match(/^\/products\/([^/]+)\/settle$/);
    if (productSettleMatch && request.method === 'POST') {
      const id = decodeURIComponent(productSettleMatch[1]);
      const existing = await this.state.storage.get(`product:${id}`);
      if (!existing) return json({ message: '产品不存在' }, 404);
      const body = await readJson(request);
      try {
        return json({ product: await this.settleProduct(existing, body, id) });
      } catch (error) {
        return json({ message: error.message || '结算保存失败' }, 400);
      }
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
    return [...entries.values()]
      .map((product) => ({ ...product, verifierLinkUrl: migrateVerifierLinkUrl(product.verifierLinkUrl) }))
      .sort((a, b) => compareProductIds(b.id, a.id));
  }

  async listSalesCustomers() {
    const entries = await this.state.storage.list({ prefix: 'sales_customer:' });
    return [...entries.entries()]
      .map(([key, customer]) => sanitizeSalesCustomer(customer, String(key).slice('sales_customer:'.length)))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
      });
  }

  async findSalesCustomer(id) {
    const normalizedId = normalizeSalesCustomerId(id);
    if (!normalizedId) return null;
    const customer = await this.state.storage.get(`sales_customer:${normalizedId}`);
    return customer ? sanitizeSalesCustomer(customer, normalizedId) : null;
  }

  async findSalesCustomerByUnique(field, value, excludeId = '') {
    const needle = field === 'phone'
      ? normalizeSalesCustomerPhone(value)
      : field === 'zhanfuId'
        ? normalizeSalesCustomerZhanfuId(value)
        : normalizeSalesCustomerUsername(value);
    if (!needle) return null;
    const entries = await this.state.storage.list({ prefix: 'sales_customer:' });
    const excluded = normalizeSalesCustomerId(excludeId);
    for (const [key, customer] of entries) {
      const normalized = sanitizeSalesCustomer(customer, String(key).slice('sales_customer:'.length));
      if (excluded && normalized.id === excluded) continue;
      const candidate = field === 'phone'
        ? normalizeSalesCustomerPhone(normalized.zhanfuPhone)
        : field === 'zhanfuId'
          ? normalizeSalesCustomerZhanfuId(normalized.zhanfuId)
          : normalizeSalesCustomerUsername(normalized.zhanfuUsername);
      if (candidate === needle) return normalized;
    }
    return null;
  }

  async findSalesCustomerBySnapshot(snapshot) {
    const profile = sanitizeSalesCustomerSnapshot(snapshot);
    if (!profile) return null;

    if (profile.zhanfuId) {
      const matchedByZhanfuId = await this.findSalesCustomerByUnique('zhanfuId', profile.zhanfuId);
      if (matchedByZhanfuId) return matchedByZhanfuId;
    }
    if (profile.zhanfuUsername) {
      const matchedByUsername = await this.findSalesCustomerByUnique('username', profile.zhanfuUsername);
      if (matchedByUsername) return matchedByUsername;
    }
    if (profile.zhanfuPhone) {
      return this.findSalesCustomerByUnique('phone', profile.zhanfuPhone);
    }
    return null;
  }

  async saveSalesCustomer(input, fixedId) {
    const customer = sanitizeSalesCustomer(input, fixedId || input.id || crypto.randomUUID());
    if (!customer.zhanfuUsername) return { error: '请填写站斧用户名' };
    if (!customer.zhanfuPhone) return { error: '请填写站斧手机号' };

    const usernameDuplicate = await this.findSalesCustomerByUnique('username', customer.zhanfuUsername, customer.id);
    if (usernameDuplicate) {
      return { error: '站斧用户名已存在，请选择已有客户。', status: 409, customer: usernameDuplicate };
    }
    const phoneDuplicate = await this.findSalesCustomerByUnique('phone', customer.zhanfuPhone, customer.id);
    if (phoneDuplicate) {
      return { error: '站斧手机号已存在，请选择已有客户。', status: 409, customer: phoneDuplicate };
    }
    if (customer.zhanfuId) {
      const idDuplicate = await this.findSalesCustomerByUnique('zhanfuId', customer.zhanfuId, customer.id);
      if (idDuplicate) {
        return { error: '站斧 ID 已存在，请选择已有客户。', status: 409, customer: idDuplicate };
      }
    }

    const existing = await this.state.storage.get(`sales_customer:${customer.id}`);
    const stored = {
      ...customer,
      createdAt: cleanLine(existing?.createdAt) || customer.createdAt,
      updatedAt: new Date().toISOString()
    };
    await this.state.storage.put(`sales_customer:${stored.id}`, stored);
    return { customer: stored };
  }

  async listTelegramTargets() {
    const targets = [];
    const seen = new Set();
    for (const target of envTelegramTargets(this.env)) {
      if (!target.id || seen.has(target.id)) continue;
      seen.add(target.id);
      targets.push(target);
    }
    const entries = await this.state.storage.list({ prefix: 'telegram_target:' });
    for (const target of entries.values()) {
      const normalized = sanitizeTelegramTarget(target, target.id);
      if (!normalized.id || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      targets.push(normalized);
    }
    return targets;
  }

  async findTelegramTarget(id) {
    const normalizedId = normalizeTelegramTargetId(id);
    if (!normalizedId) return null;
    const targets = await this.listTelegramTargets();
    return targets.find((target) => target.id === normalizedId) || null;
  }

  async saveTelegramTarget(input, fixedId) {
    const target = sanitizeTelegramTarget(input, fixedId);
    if (!target.label) return { error: '请填写电报接收对象名称' };
    if (!target.chatId) return { error: '请填写 Telegram Chat ID' };
    if (isLikelyTelegramBotToken(target.chatId)) {
      return { error: '这里要填写 chat_id，不是 Bot Token。请用 getUpdates 里的 chat.id。' };
    }
    if (target.botToken && !isLikelyTelegramBotToken(target.botToken)) {
      return { error: 'Bot Token 格式不正确，请填写 BotFather 生成的完整 token，或留空使用系统统一 Bot。' };
    }
    const stored = { ...target, source: 'stored', updatedAt: new Date().toISOString() };
    await this.state.storage.put(`telegram_target:${stored.id}`, stored);
    return { target: stored };
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
    const existing = fixedId !== undefined && fixedId !== null
      ? await this.state.storage.get(`product:${normalizeProductId(fixedId)}`)
      : null;
    if (existing) {
      const managedStatuses = new Set(['compensated', 'damaged']);
      const previousStatus = normalizeAvailabilityStatus(existing.availabilityStatus);
      const nextStatus = normalizeAvailabilityStatus(input.availabilityStatus);
      if (previousStatus !== nextStatus && (managedStatuses.has(previousStatus) || managedStatuses.has(nextStatus))) {
        throw new Error('售后补偿和已损坏状态只能在“异常处理”中变更。');
      }
    }
    const product = await this.sanitizeProductForSave(input, id);
    await this.state.storage.put(`product:${product.id}`, product);
    return product;
  }

  async sanitizeProductForSave(input, id) {
    const product = sanitizeProduct(input, id);
    const customerId = normalizeSalesCustomerId(input.salesCustomerId || product.salesCustomerId);
    if (!customerId) return product;

    const customer = await this.findSalesCustomer(customerId)
      || await this.findSalesCustomerBySnapshot(input.salesCustomerSnapshot || product.salesCustomerSnapshot);
    if (!customer) throw new Error('销售对象不存在，请重新选择。');
    return {
      ...product,
      salesCustomerId: customer.id,
      salesCustomerSnapshot: salesCustomerSnapshot(customer)
    };
  }

  async createVerifierLink(productId, createdBy = '') {
    const now = nowSeconds();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = randomVerifierCode();
      if (await this.state.storage.get(`verifier_link:${code}`)) continue;
      const record = {
        typ: 'verifier',
        token: code,
        productId,
        createdBy,
        iat: now,
        exp: now + VERIFIER_TOKEN_MAX_AGE,
        createdAt: new Date(now * 1000).toISOString()
      };
      await this.state.storage.put(`verifier_link:${code}`, record);
      return record;
    }
    throw new Error('短码生成失败，请重试');
  }

  async revokeVerifierCode(code, productId = '') {
    const record = await this.state.storage.get(`verifier_link:${code}`);
    if (!record) return 0;
    if (productId && cleanLine(record.productId) !== productId) return 0;
    await this.state.storage.delete(`verifier_link:${code}`);
    return 1;
  }

  async revokeVerifierLinksForProduct(productId) {
    if (!productId) return 0;
    const entries = await this.state.storage.list({ prefix: 'verifier_link:' });
    let revoked = 0;
    for (const [key, record] of entries) {
      if (cleanLine(record.productId) !== productId) continue;
      await this.state.storage.delete(key);
      revoked += 1;
    }
    return revoked;
  }

  async findLatestVerifierLinkForProduct(productId) {
    if (!productId) return null;
    const entries = await this.state.storage.list({ prefix: 'verifier_link:' });
    const now = nowSeconds();
    let latest = null;
    for (const [, record] of entries) {
      if (cleanLine(record.productId) !== productId || record.revokedAt) continue;
      if (record.exp < now) continue;
      if (!latest || Number(record.iat || 0) > Number(latest.iat || 0)) latest = record;
    }
    return latest;
  }

  async verifierRecordForToken(token) {
    const rawToken = cleanLine(token);
    if (!rawToken) return { status: 400, error: '缺少接码 token' };

    const code = normalizeVerifierCode(rawToken);
    if (code && !rawToken.includes('.')) {
      const record = await this.state.storage.get(`verifier_link:${code}`);
      if (!record || record.revokedAt) return { status: 401, error: '接码链接无效，请重新生成' };
      if (record.exp < nowSeconds()) {
        await this.state.storage.delete(`verifier_link:${code}`);
        return { status: 401, error: '接码链接已过期，请重新生成' };
      }
      return { record, key: code };
    }

    const payload = await verifySession(rawToken, this.env.SESSION_SECRET);
    if (!payload || payload.typ !== 'verifier' || !payload.productId) {
      return { status: 401, error: '接码链接无效，请重新生成' };
    }
    if (payload.exp < nowSeconds()) return { status: 401, error: '接码链接已过期，请重新生成' };
    return { record: payload, key: await sha256Base64Url(rawToken) };
  }

  async unlockVerifierRecovery(input) {
    const resolved = await this.verifierRecordForToken(input.token);
    if (resolved.error) return json({ message: resolved.error }, resolved.status || 401);

    const now = nowSeconds();
    const attemptKey = `verifier_recovery_attempt:${resolved.key}`;
    const state = await this.state.storage.get(attemptKey) || { failures: 0, cooldownLevel: 0, lockedUntil: 0 };
    if (Number(state.lockedUntil || 0) > now) {
      return json({
        message: cooldownMessage(state.lockedUntil),
        lockedUntil: new Date(Number(state.lockedUntil) * 1000).toISOString()
      }, 429);
    }

    const productId = cleanLine(resolved.record.productId);
    const product = productId ? await this.state.storage.get(`product:${productId}`) : null;
    if (!product) return json({ message: '接码链接对应的产品不存在或已删除' }, 404);

    const expectedAccount = normalizeVerifierAccount(product.account);
    const submittedAccount = normalizeVerifierAccount(input.account);
    if (!expectedAccount || !submittedAccount || expectedAccount !== submittedAccount) {
      const failures = Number(state.failures || 0) + 1;
      const cooldownLevel = Number(state.cooldownLevel || 0);
      const nextState = {
        failures,
        cooldownLevel,
        lockedUntil: 0,
        updatedAt: new Date(now * 1000).toISOString()
      };

      if (failures >= VERIFIER_RECOVERY_FAILURE_LIMIT) {
        const cooldownSeconds = VERIFIER_RECOVERY_COOLDOWNS[Math.min(cooldownLevel, VERIFIER_RECOVERY_COOLDOWNS.length - 1)];
        nextState.failures = 0;
        nextState.cooldownLevel = cooldownLevel + 1;
        nextState.lockedUntil = now + cooldownSeconds;
      }

      await this.state.storage.put(attemptKey, nextState);
      return json({
        message: nextState.lockedUntil ? cooldownMessage(nextState.lockedUntil) : 'Gmail 账号不匹配。',
        lockedUntil: nextState.lockedUntil ? new Date(nextState.lockedUntil * 1000).toISOString() : ''
      }, nextState.lockedUntil ? 429 : 401);
    }

    await this.state.storage.delete(attemptKey);
    await this.state.storage.put(`verifier_recovery_view:${resolved.key}`, {
      productId,
      viewedAt: new Date(now * 1000).toISOString()
    });

    return json({
      unlockedUntil: new Date((now + VERIFIER_RECOVERY_UNLOCK_TTL) * 1000).toISOString(),
      recovery: publicVerifierRecovery(product)
    });
  }

  async emailForProduct(productId) {
    if (!productId) return '';
    const product = await this.state.storage.get(`product:${productId}`);
    return product ? cleanLine(product.email) : '';
  }

  async getHotmailAuth(email) {
    const key = normalizeEmailKey(email);
    return key ? await this.state.storage.get(`hotmail_auth:${key}`) : null;
  }

  async startHotmailDeviceAuth({ email, productId = '', startedBy = '' }) {
    const clientId = cleanLine(this.env.MICROSOFT_CLIENT_ID);
    if (!clientId) {
      return { status: 503, error: 'Microsoft Client ID 未配置，请先设置 MICROSOFT_CLIENT_ID。' };
    }

    const tenant = normalizeMicrosoftTenant(this.env.MICROSOFT_TENANT);
    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: MICROSOFT_GRAPH_SCOPE
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.device_code) {
      return { status: 502, error: data.error_description || data.error || 'Microsoft 设备码授权启动失败。' };
    }

    const now = Date.now();
    const requestId = crypto.randomUUID();
    const record = {
      id: requestId,
      email: normalizeEmailKey(email),
      productId,
      startedBy,
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      message: data.message,
      interval: Math.max(5, Number(data.interval || 5)),
      status: 'pending',
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + Number(data.expires_in || 900) * 1000).toISOString()
    };
    await this.state.storage.put(`hotmail_device:${requestId}`, record);
    return {
      authRequest: publicHotmailDeviceRequest(record)
    };
  }

  async pollHotmailDeviceAuth(requestId) {
    const record = await this.state.storage.get(`hotmail_device:${requestId}`);
    if (!record) return { status: 404, error: '授权请求不存在，请重新开始。' };
    if (record.status === 'authorized') {
      return { status: { status: 'authorized', auth: publicHotmailAuth(await this.getHotmailAuth(record.email), record.email) } };
    }
    if (Date.parse(record.expiresAt || '') <= Date.now()) {
      await this.state.storage.delete(`hotmail_device:${requestId}`);
      return { status: 410, error: '设备码已过期，请重新授权。' };
    }

    const clientId = cleanLine(this.env.MICROSOFT_CLIENT_ID);
    if (!clientId) return { status: 503, error: 'Microsoft Client ID 未配置，请先设置 MICROSOFT_CLIENT_ID。' };

    const tenant = normalizeMicrosoftTenant(this.env.MICROSOFT_TENANT);
    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: clientId,
        device_code: record.deviceCode
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = cleanLine(data.error);
      if (error === 'authorization_pending') return { status: { status: 'pending', interval: record.interval } };
      if (error === 'slow_down') {
        record.interval = Math.min(20, Number(record.interval || 5) + 5);
        await this.state.storage.put(`hotmail_device:${requestId}`, record);
        return { status: { status: 'pending', interval: record.interval } };
      }
      if (error === 'authorization_declined') return { status: 403, error: '授权已被拒绝，请重新开始。' };
      if (error === 'expired_token') {
        await this.state.storage.delete(`hotmail_device:${requestId}`);
        return { status: 410, error: '设备码已过期，请重新授权。' };
      }
      return { status: 502, error: data.error_description || error || 'Microsoft 授权状态读取失败。' };
    }

    if (!data.refresh_token) return { status: 502, error: 'Microsoft 未返回 refresh token，请确认应用允许公共客户端并请求 offline_access。' };

    const saved = await this.saveHotmailAuth(record.email, data, {
      productId: record.productId,
      startedBy: record.startedBy
    });
    record.status = 'authorized';
    record.authorizedAt = new Date().toISOString();
    await this.state.storage.put(`hotmail_device:${requestId}`, record);
    return { status: { status: 'authorized', auth: publicHotmailAuth(saved, record.email) } };
  }

  async saveHotmailAuth(email, tokenData, meta = {}) {
    const key = normalizeEmailKey(email);
    const existing = await this.getHotmailAuth(key);
    const now = new Date().toISOString();
    const accessToken = cleanLine(tokenData.access_token);
    const microsoftUser = accessToken ? await fetchMicrosoftProfile(accessToken) : null;
    const record = {
      ...(existing || {}),
      email: key,
      productId: cleanLine(meta.productId || existing?.productId),
      startedBy: cleanLine(meta.startedBy || existing?.startedBy),
      refreshToken: await encryptSecret(cleanLine(tokenData.refresh_token), tokenCryptoSecret(this.env)),
      scopes: cleanLine(tokenData.scope || existing?.scopes || MICROSOFT_GRAPH_SCOPE),
      microsoftUser,
      status: 'authorized',
      error: '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastTokenRefreshAt: now
    };
    await this.state.storage.put(`hotmail_auth:${key}`, record);
    return record;
  }

  async readHotmailVerificationCode(email) {
    const key = normalizeEmailKey(email);
    const record = await this.getHotmailAuth(key);
    if (!record?.refreshToken) return { status: 404, error: '该恢复邮箱还没有授权 Hotmail 读取。' };

    const refreshToken = await decryptSecret(record.refreshToken, tokenCryptoSecret(this.env));
    if (!refreshToken) return { status: 500, error: '恢复邮箱授权凭据无法解密，请重新授权。' };

    const tokenResult = await refreshMicrosoftToken(refreshToken, this.env);
    if (tokenResult.error) {
      record.status = 'reauthorize_required';
      record.error = tokenResult.error;
      record.updatedAt = new Date().toISOString();
      await this.state.storage.put(`hotmail_auth:${key}`, record);
      return { status: tokenResult.status || 502, error: tokenResult.error };
    }

    if (tokenResult.refreshToken) {
      record.refreshToken = await encryptSecret(tokenResult.refreshToken, tokenCryptoSecret(this.env));
      record.lastTokenRefreshAt = new Date().toISOString();
    }

    const mailResult = await fetchLatestMicrosoftMailCode(tokenResult.accessToken);
    record.status = mailResult.error ? 'authorized' : 'authorized';
    record.error = mailResult.error || '';
    record.lastReadAt = new Date().toISOString();
    record.updatedAt = record.lastReadAt;
    await this.state.storage.put(`hotmail_auth:${key}`, record);

    if (mailResult.error) return { status: mailResult.status || 502, error: mailResult.error };
    return {
      data: {
        configured: true,
        email: key,
        code: mailResult.code,
        subject: mailResult.subject,
        receivedAt: mailResult.receivedAt,
        message: mailResult.code ? '已读取最新恢复邮件验证码。' : '已读取最新邮件，但暂未找到验证码。'
      }
    };
  }

  async listGoogleDeveloperProducts(username = '') {
    const products = await this.listProducts();
    return products
      .filter((product) => canAccessGoogleDeveloperProduct(product, username))
      .map(publicGoogleDeveloperProduct);
  }

  async saveGoogleDeveloperInfo(existing, patch, username = '') {
    if (!canAccessGoogleDeveloperProduct(existing, username)) {
      return { error: '无权修改该产品的 Google Developer 信息' };
    }
    const access = sanitizeGoogleDeveloperAccess({
      ...existing.googleDeveloperAccess,
      enabled: true,
      syncBasicInfo: false,
      updatedBy: username
    }, existing);
    const product = sanitizeProduct({
      ...existing,
      ...googleDeveloperProductPatch(patch),
      googleDeveloperAccess: access
    }, existing.id);
    await this.state.storage.put(`product:${product.id}`, product);
    return { product: publicGoogleDeveloperProduct(product) };
  }

  async settleProduct(existing, patch, fixedId) {
    const product = await this.sanitizeProductForSave({
      ...existing,
      settlementStatus: 'settled',
      settlementExchangeRate: patch.settlementExchangeRate,
      settlementShareCnyHongKong: patch.settlementShareCnyHongKong,
      settlementShareCnyWuhan: patch.settlementShareCnyWuhan,
      settlementHongKongCostUsd: patch.settlementHongKongCostUsd,
      settlementWuhanCostUsd: patch.settlementWuhanCostUsd,
      settlementProfitUsd: patch.settlementProfitUsd,
      settlementHongKongReceivableUsd: patch.settlementHongKongReceivableUsd,
      settlementWuhanRetainedUsd: patch.settlementWuhanRetainedUsd,
      settlementHongKongReceivableCny: patch.settlementHongKongReceivableCny,
      settlementWuhanRetainedCny: patch.settlementWuhanRetainedCny,
      settledAt: patch.settledAt
    }, fixedId);
    await this.state.storage.put(`product:${product.id}`, product);
    return product;
  }

  async clearProducts() {
    const entries = await this.state.storage.list({ prefix: 'product:' });
    await Promise.all([...entries.keys()].map((key) => this.state.storage.delete(key)));
    await this.state.storage.put('products_seeded', true);
    return entries.size;
  }

  async listPurchaseExpenses() {
    const entries = await this.state.storage.list({ prefix: 'purchase_expense:' });
    return [...entries.values()].sort((a, b) => {
      const dateCompare = String(b.purchaseDate || '').localeCompare(String(a.purchaseDate || ''));
      return dateCompare || compareProductIds(b.id, a.id);
    });
  }

  async listLossEvents() {
    const entries = await this.state.storage.list({ prefix: 'loss_event:' });
    return [...entries.values()].sort((a, b) => {
      const dateCompare = String(b.eventDate || b.createdAt || '').localeCompare(String(a.eventDate || a.createdAt || ''));
      return dateCompare || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  async createLossEvent(input = {}) {
    const eventType = normalizeLossEventType(input.eventType);
    if (!eventType) throw new Error('异常类型不正确。');
    if ([LOSS_EVENT_TYPES.COST_RECOVERY, LOSS_EVENT_TYPES.INVENTORY_RECOVERY].includes(eventType)) {
      return this.createRecoveryEvent(input, eventType);
    }

    const productId = normalizeProductId(input.productId);
    const product = await this.state.storage.get(`product:${productId}`);
    if (!product) throw new Error('处理账号不存在。');
    if (product.isSold) throw new Error('已正常售出的账号不能再次作为补偿或报损账号。');
    const availability = normalizeAvailabilityStatus(product.availabilityStatus);
    if (!['preparing', 'available'].includes(availability)) throw new Error('该账号当前状态不能进行异常处理。');

    let originalProduct = null;
    if (eventType === LOSS_EVENT_TYPES.AFTER_SALE_REPLACEMENT) {
      const originalProductId = normalizeProductId(input.originalProductId);
      originalProduct = await this.state.storage.get(`product:${originalProductId}`);
      if (!originalProduct?.isSold) throw new Error('请选择一条已经售出的原账号。');
      if (normalizeProductType(originalProduct.productType) !== normalizeProductType(product.productType)) {
        throw new Error('补偿账号必须与原销售账号属于同一商品类型。');
      }
    }

    const costsSnapshot = lossCostsSnapshot(product.costs);
    const calculated = calculateLossSettlement({
      costs: costsSnapshot,
      recoveredAmountUsd: input.recoveredAmountUsd,
      recoveryReceivedBy: input.recoveryReceivedBy,
      sharingRule: input.sharingRule
    });
    if (calculated.productCostUsd <= 0) throw new Error('该账号尚未录入成本，不能确认损失。');

    const now = new Date();
    const event = {
      id: crypto.randomUUID(),
      eventType,
      eventDate: cleanDate(input.eventDate) || now.toISOString().slice(0, 10),
      productId: product.id,
      productType: normalizeProductType(product.productType),
      productSnapshot: lossProductSnapshot(product),
      originalProductId: originalProduct?.id || '',
      originalProductSnapshot: originalProduct ? lossProductSnapshot(originalProduct) : null,
      salesCustomerId: originalProduct?.salesCustomerId || '',
      salesCustomerSnapshot: originalProduct?.salesCustomerSnapshot || null,
      referenceEventId: '',
      reason: String(input.reason || '').slice(0, 500),
      sharingRule: normalizeLossSharingRule(input.sharingRule),
      recoveryReceivedBy: normalizeLossRecoveryOwner(input.recoveryReceivedBy),
      costsSnapshot,
      ...calculated,
      settlementStatus: Math.abs(Number(calculated.hongKongSettlementUsd || 0)) < 0.005 ? 'not_required' : 'unsettled',
      settlementExchangeRate: null,
      settlementAmountCny: null,
      settledAt: '',
      recoveryStatus: 'none',
      createdBy: cleanLine(input.createdBy).slice(0, 80),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    const nextProduct = sanitizeProduct({
      ...product,
      availabilityStatus: eventType === LOSS_EVENT_TYPES.AFTER_SALE_REPLACEMENT ? 'compensated' : 'damaged',
      dispositionType: eventType,
      relatedOriginalProductId: originalProduct?.id || '',
      lossEventId: event.id,
      salesCustomerId: originalProduct?.salesCustomerId || product.salesCustomerId,
      salesCustomerSnapshot: originalProduct?.salesCustomerSnapshot || product.salesCustomerSnapshot
    }, product.id);

    await this.state.storage.transaction(async (transaction) => {
      await transaction.put(`loss_event:${event.id}`, event);
      await transaction.put(`product:${nextProduct.id}`, nextProduct);
    });
    return { event, product: nextProduct };
  }

  async createRecoveryEvent(input, eventType) {
    const referenceEventId = cleanLine(input.referenceEventId);
    const reference = await this.state.storage.get(`loss_event:${referenceEventId}`);
    if (!reference || ![LOSS_EVENT_TYPES.AFTER_SALE_REPLACEMENT, LOSS_EVENT_TYPES.INVENTORY_WRITEOFF].includes(reference.eventType)) {
      throw new Error('原损失记录不存在。');
    }

    const existingRecoveries = (await this.listLossEvents()).filter((item) => item.referenceEventId === reference.id);
    const recoveredAlready = existingRecoveries.reduce((total, item) => total + Number(item.recoveredAmountUsd || 0), 0);
    let recoveredAmountUsd = Number(input.recoveredAmountUsd || 0);
    let product = null;
    let nextProduct = null;

    if (eventType === LOSS_EVENT_TYPES.INVENTORY_RECOVERY) {
      if (reference.eventType !== LOSS_EVENT_TYPES.INVENTORY_WRITEOFF) throw new Error('只有库存报损账号可以恢复可售。');
      if (existingRecoveries.length || reference.recoveryStatus === 'recovered') throw new Error('该报损账号已经登记过追回或恢复。');
      if (Number(reference.recoveredAmountUsd || 0) > 0) throw new Error('该报损已包含追回金额，不能直接恢复全部库存。');
      product = await this.state.storage.get(`product:${reference.productId}`);
      if (!product || normalizeAvailabilityStatus(product.availabilityStatus) !== 'damaged') throw new Error('该账号当前不是已损坏状态。');
      recoveredAmountUsd = Number(reference.productCostUsd || 0);
      nextProduct = sanitizeProduct({
        ...product,
        availabilityStatus: 'available',
        dispositionType: '',
        relatedOriginalProductId: '',
        lossEventId: ''
      }, product.id);
    } else {
      if (!Number.isFinite(recoveredAmountUsd) || recoveredAmountUsd <= 0) throw new Error('请输入大于 0 的追回金额。');
      const remainingLoss = Math.max(0, Number(reference.netLossUsd || 0) - recoveredAlready);
      if (recoveredAmountUsd > remainingLoss) throw new Error(`追回金额不能超过剩余损失 ${remainingLoss.toFixed(2)} USD。`);
    }

    const now = new Date();
    const calculated = eventType === LOSS_EVENT_TYPES.INVENTORY_RECOVERY
      ? reverseLossSettlement(reference)
      : calculateLossSettlement({
        costs: [],
        recoveredAmountUsd,
        recoveryReceivedBy: input.recoveryReceivedBy,
        sharingRule: reference.sharingRule
      });
    const event = {
      id: crypto.randomUUID(),
      eventType,
      eventDate: cleanDate(input.eventDate) || now.toISOString().slice(0, 10),
      productId: reference.productId,
      productType: reference.productType,
      productSnapshot: reference.productSnapshot,
      originalProductId: reference.originalProductId || '',
      originalProductSnapshot: reference.originalProductSnapshot || null,
      salesCustomerId: reference.salesCustomerId || '',
      salesCustomerSnapshot: reference.salesCustomerSnapshot || null,
      referenceEventId: reference.id,
      reason: String(input.reason || (eventType === LOSS_EVENT_TYPES.INVENTORY_RECOVERY ? '账号恢复可售' : '登记损失追回')).slice(0, 500),
      sharingRule: reference.sharingRule,
      recoveryReceivedBy: normalizeLossRecoveryOwner(input.recoveryReceivedBy),
      costsSnapshot: [],
      ...calculated,
      settlementStatus: Math.abs(Number(calculated.hongKongSettlementUsd || 0)) < 0.005 ? 'not_required' : 'unsettled',
      settlementExchangeRate: null,
      settlementAmountCny: null,
      settledAt: '',
      recoveryStatus: 'none',
      createdBy: cleanLine(input.createdBy).slice(0, 80),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    const nextReference = {
      ...reference,
      recoveryStatus: eventType === LOSS_EVENT_TYPES.INVENTORY_RECOVERY || recoveredAlready + recoveredAmountUsd >= Number(reference.netLossUsd || 0)
        ? 'recovered'
        : 'partial',
      updatedAt: now.toISOString()
    };

    await this.state.storage.transaction(async (transaction) => {
      await transaction.put(`loss_event:${event.id}`, event);
      await transaction.put(`loss_event:${nextReference.id}`, nextReference);
      if (nextProduct) await transaction.put(`product:${nextProduct.id}`, nextProduct);
    });
    return { event, product: nextProduct, referenceEvent: nextReference };
  }

  async settleLossEvent(id, input = {}) {
    const event = await this.state.storage.get(`loss_event:${cleanLine(id)}`);
    if (!event) throw new Error('异常记录不存在。');
    if (event.settlementStatus === 'settled' || event.settlementStatus === 'not_required' || Math.abs(Number(event.hongKongSettlementUsd || 0)) < 0.005) return event;
    const exchangeRate = positiveNumberOrNull(input.exchangeRate);
    if (!exchangeRate) throw new Error('结算汇率必须大于 0。');
    const now = new Date();
    const settled = {
      ...event,
      settlementStatus: 'settled',
      settlementExchangeRate: exchangeRate,
      settlementAmountCny: Number((Number(event.hongKongSettlementUsd || 0) * exchangeRate).toFixed(2)),
      settledAt: now.toLocaleString('zh-CN', { hour12: false }),
      settledBy: cleanLine(input.settledBy).slice(0, 80),
      updatedAt: now.toISOString()
    };
    await this.state.storage.put(`loss_event:${settled.id}`, settled);
    return settled;
  }

  async nextPurchaseExpenseId() {
    const expenses = await this.listPurchaseExpenses();
    const maxId = expenses.reduce((max, expense) => {
      const id = Number(expense.id);
      return Number.isFinite(id) ? Math.max(max, id) : max;
    }, 0);
    return maxId + 1;
  }

  async savePurchaseExpense(input, fixedId) {
    const id = fixedId ?? input.id ?? await this.nextPurchaseExpenseId();
    const expense = sanitizePurchaseExpense(input, id);
    if (!expense.itemName) return { error: '请填写采购产品或事项名称' };
    if (expense.amountUsd <= 0) return { error: '支出金额 USD 必须大于 0' };
    if (expense.settlementStatus === 'settled' && expense.settlementAmountCny <= 0) return { error: '结算金额 CNY 必须大于 0' };
    await this.state.storage.put(`purchase_expense:${expense.id}`, expense);
    return { expense };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Incident containment: the public custom domain was flagged for phishing.
    // Keep every route, including APIs, unavailable until the registrar hold is
    // lifted and the credential-handling workflow has been redesigned.
    if (url.hostname === 'youxi.aisea.space') {
      return incidentMaintenanceResponse();
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  }
};

function incidentMaintenanceResponse() {
  const body = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>系统安全维护中</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #182230; }
    main { width: min(92vw, 560px); padding: 40px; border: 1px solid #e4e9f0; border-radius: 18px; background: #fff; box-shadow: 0 18px 50px rgba(20, 35, 60, .08); }
    h1 { margin: 0 0 16px; font-size: 28px; }
    p { margin: 0; color: #526071; line-height: 1.75; }
  </style>
</head>
<body>
  <main>
    <h1>系统安全维护中</h1>
    <p>该管理系统已暂停访问并正在进行安全检查。当前页面不会要求您输入账号、密码、验证码或其他个人信息。</p>
  </main>
</body>
</html>`;

  return new Response(body, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }
  });
}

async function handleApi(request, env, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: verifierCorsHeaders(request) });
  }

  if (url.pathname === '/api/exchange-rate' && request.method === 'GET') {
    return fetchUsdCnyRate();
  }

  if (!env.AUTH_STORE || !env.SESSION_SECRET) {
    return json({ message: '认证后端未配置，请检查 AUTH_STORE 和 SESSION_SECRET' }, 503);
  }

  if (url.pathname === '/api/verifier-session' && request.method === 'GET') {
    return readVerifierSession(request, env, url);
  }

  if (url.pathname === '/api/verifier-mail-code' && request.method === 'GET') {
    return readVerifierMailCode(request, env, url);
  }

  if (url.pathname === '/api/verifier-sms-code' && request.method === 'GET') {
    return readVerifierSmsCode(request, env, url);
  }

  if (url.pathname === '/api/verifier-recovery' && request.method === 'POST') {
    return unlockVerifierRecovery(request, env);
  }

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    const session = await readSession(request, env);
    const sessionUser = session ? await fetchSessionUser(env, session.username) : null;
    if (session && !sessionUser) {
      return json({ authenticated: false, user: null }, 200, {
        'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
      });
    }
    const refreshedToken = sessionUser ? await signSession({
      userId: sessionUser.id,
      username: sessionUser.username,
      role: sessionUser.role,
      deviceId: session.deviceId,
      exp: nowSeconds() + SESSION_MAX_AGE
    }, env.SESSION_SECRET) : '';
    return json({
      authenticated: Boolean(sessionUser),
      user: sessionUser
    }, 200, refreshedToken ? {
      'Set-Cookie': sessionCookie(refreshedToken, SESSION_MAX_AGE)
    } : {});
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

  if (url.pathname === '/api/google-developer-products' && request.method === 'GET') {
    if (sessionUser.role !== 'super_admin' && sessionUser.role !== GOOGLE_DEVELOPER_ROLE) {
      return json({ message: '无权查看 Google Developer 页面' }, 403);
    }
    const username = sessionUser.role === GOOGLE_DEVELOPER_ROLE ? sessionUser.username : '';
    return authStore(env).fetch(`https://auth.local/google-developer-products?username=${encodeURIComponent(username)}`);
  }

  const googleDeveloperProductMatch = url.pathname.match(/^\/api\/google-developer-products\/([^/]+)$/);
  if (googleDeveloperProductMatch && request.method === 'PUT') {
    if (sessionUser.role !== 'super_admin' && sessionUser.role !== GOOGLE_DEVELOPER_ROLE) {
      return json({ message: '无权修改 Google Developer 信息' }, 403);
    }
    const username = sessionUser.role === GOOGLE_DEVELOPER_ROLE ? sessionUser.username : '';
    return authStore(env).fetch(new Request(`https://auth.local/google-developer-products/${googleDeveloperProductMatch[1]}?username=${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: await request.text(),
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  if (sessionUser.role === GOOGLE_DEVELOPER_ROLE) {
    return json({ message: 'Google Developer 账号只能访问英文基础信息页面' }, 403);
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

  if (url.pathname === '/api/content-templates' && request.method === 'GET') {
    return authStore(env).fetch('https://auth.local/content-templates');
  }

  if (url.pathname === '/api/content-templates' && request.method === 'PUT') {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以修改内容模板' }, 403);
    const body = await readJson(request);
    return authStore(env).fetch(new Request('https://auth.local/content-templates', {
      method: 'PUT',
      body: JSON.stringify({ templates: body.templates, updatedBy: sessionUser.username }),
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  if (url.pathname === '/api/sales-customers' && ['GET', 'POST'].includes(request.method)) {
    return authStore(env).fetch(new Request('https://auth.local/sales-customers', {
      method: request.method,
      body: request.method === 'POST' ? await request.text() : undefined,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const salesCustomerMatch = url.pathname.match(/^\/api\/sales-customers\/([^/]+)$/);
  if (salesCustomerMatch && request.method === 'PUT') {
    return authStore(env).fetch(new Request(`https://auth.local/sales-customers/${salesCustomerMatch[1]}`, {
      method: 'PUT',
      body: await request.text(),
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  if (url.pathname === '/api/purchase-expenses' && ['GET', 'POST'].includes(request.method)) {
    return authStore(env).fetch(new Request('https://auth.local/purchase-expenses', {
      method: request.method,
      body: request.method === 'POST' ? await request.text() : undefined,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  if (url.pathname === '/api/loss-events' && ['GET', 'POST'].includes(request.method)) {
    const body = request.method === 'POST' ? await readJson(request) : null;
    return authStore(env).fetch(new Request('https://auth.local/loss-events', {
      method: request.method,
      body: body ? JSON.stringify({ ...body, createdBy: sessionUser.username }) : undefined,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const lossEventSettleMatch = url.pathname.match(/^\/api\/loss-events\/([^/]+)\/settle$/);
  if (lossEventSettleMatch && request.method === 'POST') {
    const body = await readJson(request);
    return authStore(env).fetch(new Request(`https://auth.local/loss-events/${lossEventSettleMatch[1]}/settle`, {
      method: 'POST',
      body: JSON.stringify({ ...body, settledBy: sessionUser.username }),
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const purchaseExpenseMatch = url.pathname.match(/^\/api\/purchase-expenses\/([^/]+)$/);
  if (purchaseExpenseMatch && ['PUT', 'DELETE'].includes(request.method)) {
    return authStore(env).fetch(new Request(`https://auth.local/purchase-expenses/${purchaseExpenseMatch[1]}`, {
      method: request.method,
      body: request.method === 'PUT' ? await request.text() : undefined,
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

  const productSettleMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/settle$/);
  if (productSettleMatch && request.method === 'POST') {
    return authStore(env).fetch(new Request(`https://auth.local/products/${productSettleMatch[1]}/settle`, {
      method: 'POST',
      body: await request.text(),
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  if (url.pathname === '/api/telegram/targets' && request.method === 'GET') {
    return authStore(env).fetch('https://auth.local/telegram-targets');
  }

  if (url.pathname === '/api/telegram/targets' && request.method === 'POST') {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以管理电报接收对象' }, 403);
    return authStore(env).fetch(new Request('https://auth.local/telegram-targets', {
      method: 'POST',
      body: await request.text(),
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const telegramTargetMatch = url.pathname.match(/^\/api\/telegram\/targets\/([^/]+)$/);
  if (telegramTargetMatch && ['PUT', 'DELETE'].includes(request.method)) {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以管理电报接收对象' }, 403);
    return authStore(env).fetch(new Request(`https://auth.local/telegram-targets/${telegramTargetMatch[1]}`, {
      method: request.method,
      body: request.method === 'PUT' ? await request.text() : undefined,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  if (url.pathname === '/api/telegram/push' && request.method === 'POST') {
    return pushTelegramMessage(request, env);
  }

  if (url.pathname === '/api/verifier-links' && request.method === 'POST') {
    return createVerifierLink(request, env, sessionUser);
  }

  if (url.pathname === '/api/verifier-links' && request.method === 'GET') {
    return getVerifierLink(request, env, url);
  }

  if (url.pathname === '/api/verifier-links' && request.method === 'DELETE') {
    return revokeVerifierLink(request, env);
  }

  if (url.pathname === '/api/hotmail-auth/status' && request.method === 'GET') {
    return getHotmailAuthStatus(env, url);
  }

  if (url.pathname === '/api/hotmail-auth/device/start' && request.method === 'POST') {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以授权恢复邮箱读取' }, 403);
    return startHotmailDeviceAuth(request, env, sessionUser);
  }

  if (url.pathname === '/api/hotmail-auth/device/status' && request.method === 'GET') {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以授权恢复邮箱读取' }, 403);
    return pollHotmailDeviceAuth(env, url);
  }

  if (url.pathname === '/api/hotmail-auth' && request.method === 'DELETE') {
    if (sessionUser.role !== 'super_admin') return json({ message: '只有超级管理员可以取消恢复邮箱授权' }, 403);
    return revokeHotmailAuth(request, env);
  }

  return json({ message: 'Not found' }, 404);
}

async function createVerifierLink(request, env, sessionUser) {
  const body = await readJson(request);
  const productId = cleanLine(body.productId || body.id);
  if (!productId) return json({ message: '产品 ID 不能为空' }, 400);

  const product = await fetchProductById(env, productId);
  if (!product) return json({ message: '产品不存在或已删除' }, 404);

  const response = await authStore(env).fetch(new Request('https://auth.local/verifier-links', {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, createdBy: sessionUser?.username || '' }),
    headers: { 'Content-Type': 'application/json' }
  }));
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.record?.token) {
    return json({ message: data.message || '接码短码生成失败，请重试' }, response.status || 500);
  }

  const token = data.record.token;
  const baseUrl = normalizedVerifierBaseUrl(env.VERIFIER_BASE_URL || DEFAULT_VERIFIER_BASE_URL);
  const verifierUrl = new URL(baseUrl);
  verifierUrl.searchParams.set('token', token);
  const verifierUrlText = verifierUrl.toString();
  await updateProductVerifierLink(env, product.id, verifierUrlText);

  return json({
    ok: true,
    token,
    url: verifierUrlText,
    expiresAt: new Date(data.record.exp * 1000).toISOString(),
    expiresIn: VERIFIER_TOKEN_MAX_AGE
  });
}

async function getVerifierLink(request, env, url) {
  const productId = cleanLine(url.searchParams.get('productId') || url.searchParams.get('id'));
  if (!productId) return json({ message: '产品 ID 不能为空' }, 400);

  const response = await authStore(env).fetch(`https://auth.local/verifier-links?productId=${encodeURIComponent(productId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: data.message || '接码链接读取失败，请重试' }, response.status);
  if (!data.record?.token) return json({ ok: true, token: '', url: '' });

  const baseUrl = normalizedVerifierBaseUrl(env.VERIFIER_BASE_URL || DEFAULT_VERIFIER_BASE_URL);
  const verifierUrl = new URL(baseUrl);
  verifierUrl.searchParams.set('token', data.record.token);
  const verifierUrlText = verifierUrl.toString();
  await updateProductVerifierLink(env, productId, verifierUrlText);

  return json({
    ok: true,
    token: data.record.token,
    url: verifierUrlText,
    expiresAt: new Date(data.record.exp * 1000).toISOString(),
    expiresIn: Math.max(0, Number(data.record.exp || 0) - nowSeconds())
  });
}

async function revokeVerifierLink(request, env) {
  const body = await readJson(request);
  const productId = cleanLine(body.productId || body.id);
  const token = normalizeVerifierCode(body.token || body.code);
  if (!productId && !token) return json({ message: '产品 ID 或短码不能为空' }, 400);

  const response = await authStore(env).fetch(new Request('https://auth.local/verifier-links', {
    method: 'DELETE',
    body: JSON.stringify({ productId, token }),
    headers: { 'Content-Type': 'application/json' }
  }));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return json({ message: data.message || '接码链接作废失败，请重试' }, response.status);
  if (productId) await updateProductVerifierLink(env, productId, '');
  return json(data);
}

async function updateProductVerifierLink(env, productId, verifierLinkUrl) {
  if (!productId) return null;
  const response = await authStore(env).fetch(new Request(`https://auth.local/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: JSON.stringify({ verifierLinkUrl }),
    headers: { 'Content-Type': 'application/json' }
  }));
  return response.ok ? response : null;
}

async function getHotmailAuthStatus(env, url) {
  const productId = cleanLine(url.searchParams.get('productId') || url.searchParams.get('id'));
  const email = cleanLine(url.searchParams.get('email'));
  const params = new URLSearchParams();
  if (productId) params.set('productId', productId);
  if (email) params.set('email', email);
  const response = await authStore(env).fetch(`https://auth.local/hotmail-auth/status?${params.toString()}`);
  return response;
}

async function startHotmailDeviceAuth(request, env, sessionUser) {
  const body = await readJson(request);
  const response = await authStore(env).fetch(new Request('https://auth.local/hotmail-auth/device', {
    method: 'POST',
    body: JSON.stringify({
      productId: cleanLine(body.productId || body.id),
      email: cleanLine(body.email),
      startedBy: sessionUser?.username || ''
    }),
    headers: { 'Content-Type': 'application/json' }
  }));
  return response;
}

async function pollHotmailDeviceAuth(env, url) {
  const requestId = cleanLine(url.searchParams.get('requestId') || url.searchParams.get('id'));
  return authStore(env).fetch(`https://auth.local/hotmail-auth/device-status?requestId=${encodeURIComponent(requestId)}`);
}

async function revokeHotmailAuth(request, env) {
  const body = await readJson(request);
  const response = await authStore(env).fetch(new Request('https://auth.local/hotmail-auth', {
    method: 'DELETE',
    body: JSON.stringify({
      productId: cleanLine(body.productId || body.id),
      email: cleanLine(body.email)
    }),
    headers: { 'Content-Type': 'application/json' }
  }));
  return response;
}

async function readVerifierSession(request, env, url) {
  const verification = await verifyVerifierToken(url.searchParams.get('token') || '', env);
  if (verification.error) return json(verification.error, verification.status, verifierCorsHeaders(request));

  const product = await fetchProductById(env, verification.payload.productId);
  if (!product) return json({ message: '接码链接对应的产品不存在或已删除' }, 404, verifierCorsHeaders(request));

  return json({
    product: publicVerifierProduct(product),
    expiresAt: new Date(verification.payload.exp * 1000).toISOString()
  }, 200, verifierCorsHeaders(request));
}

async function readVerifierMailCode(request, env, url) {
  const verification = await verifyVerifierToken(url.searchParams.get('token') || '', env);
  if (verification.error) return json(verification.error, verification.status, verifierCorsHeaders(request));

  const product = await fetchProductById(env, verification.payload.productId);
  if (!product) return json({ message: '接码链接对应的产品不存在或已删除' }, 404, verifierCorsHeaders(request));
  if (!cleanLine(product.email)) return json({ message: '该产品没有配置 Hotmail 邮箱。' }, 400, verifierCorsHeaders(request));

  const response = await authStore(env).fetch(`https://auth.local/hotmail-auth/mail-code?email=${encodeURIComponent(product.email)}`);
  const data = await response.json().catch(() => ({}));
  return json(data, response.ok ? 200 : response.status, verifierCorsHeaders(request));
}

async function readVerifierSmsCode(request, env, url) {
  const verification = await verifyVerifierToken(url.searchParams.get('token') || '', env);
  if (verification.error) return json(verification.error, verification.status, verifierCorsHeaders(request));

  const product = await fetchProductById(env, verification.payload.productId);
  if (!product) return json({ message: '接码链接对应的产品不存在或已删除' }, 404, verifierCorsHeaders(request));

  const rawSms = cleanLine(product.phoneSmsCode || product.smsLink);
  if (!rawSms) return json({ message: '该产品没有配置手机接码网址。' }, 400, verifierCorsHeaders(request));

  const directCode = extractVerificationCode(rawSms);
  if (directCode && !normalizeHttpUrl(rawSms)) {
    return json({
      configured: true,
      code: directCode,
      message: '已从手机接码字段提取验证码。'
    }, 200, verifierCorsHeaders(request));
  }

  const smsUrl = normalizeHttpUrl(rawSms);
  if (!smsUrl) return json({ message: '手机接码字段不是可读取的网址。' }, 400, verifierCorsHeaders(request));

  try {
    const response = await fetch(smsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'User-Agent': 'Mozilla/5.0 (compatible; GPCVerifier/1.0; +https://shougema.top)'
      }
    });
    const text = await response.text();
    if (!response.ok) {
      return json({ message: `短信页面读取失败（HTTP ${response.status}）。` }, 502, verifierCorsHeaders(request));
    }

    const code = extractVerificationCode(text);
    return json({
      configured: true,
      code,
      message: code
        ? '已读取最新短信验证码。'
        : '暂未从短信页面中找到验证码，请稍后重试。'
    }, code ? 200 : 404, verifierCorsHeaders(request));
  } catch (error) {
    return json({ message: '短信页面读取失败，请检查接码网址是否可访问。' }, 502, verifierCorsHeaders(request));
  }
}

async function unlockVerifierRecovery(request, env) {
  const response = await authStore(env).fetch(new Request('https://auth.local/verifier-recovery', {
    method: 'POST',
    body: await request.text(),
    headers: { 'Content-Type': 'application/json' }
  }));
  const data = await response.json().catch(() => ({}));
  return json(data, response.status, verifierCorsHeaders(request));
}

async function verifyVerifierToken(token, env) {
  if (!token) return { status: 400, error: { message: '缺少接码 token' } };
  const code = normalizeVerifierCode(token);
  if (code && !token.includes('.')) {
    const response = await authStore(env).fetch(`https://auth.local/verifier-links/${encodeURIComponent(code)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.record?.productId) {
      return { status: response.status === 410 ? 401 : 401, error: { message: data.message || '接码链接无效，请重新生成' } };
    }
    return { payload: data.record };
  }

  const payload = await verifySession(token, env.SESSION_SECRET);
  if (!payload || payload.typ !== 'verifier' || !payload.productId) {
    return { status: 401, error: { message: '接码链接无效，请重新生成' } };
  }
  if (payload.exp < nowSeconds()) {
    return { status: 401, error: { message: '接码链接已过期，请重新生成' } };
  }
  return { payload };
}

async function fetchProductById(env, productId) {
  const response = await authStore(env).fetch(`https://auth.local/products/${encodeURIComponent(productId)}`);
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data.product || null;
}

function publicVerifierProduct(product) {
  const smsUrl = normalizeHttpUrl(product.phoneSmsCode || product.smsLink);
  const securityCode = cleanLine(product.securityCode);
  return {
    id: product.id,
    label: maskVerifierAccount(product.account) || `#${product.id}`,
    googleAuth: cleanLine(product.googleAuth),
    securityCode,
    smsUrl,
    smsRaw: cleanLine(product.phoneSmsCode || product.smsLink),
    capabilities: {
      totp: Boolean(cleanLine(product.googleAuth)),
      sms: Boolean(smsUrl || cleanLine(product.phoneSmsCode || product.smsLink)),
      hotmail: Boolean(cleanLine(product.email)),
      backupCodes: Boolean(securityCode),
      recovery: Boolean(cleanLine(product.account))
    }
  };
}

function publicVerifierRecovery(product) {
  return {
    recoveryEmail: cleanLine(product.email),
    recoveryEmailPassword: cleanLine(product.recoveryEmailPassword),
    recoveryPhone: formatPhoneNumber(product.phoneCode, product.phone)
  };
}

function maskVerifierAccount(value) {
  const text = cleanLine(value).slice(0, 120);
  const match = text.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (!match) return text ? '已绑定账号' : '';
  const [, name, domain] = match;
  const prefix = name.slice(0, Math.min(3, name.length));
  return `${prefix}***@${domain}`;
}

function normalizedVerifierBaseUrl(value) {
  const text = cleanLine(value) || DEFAULT_VERIFIER_BASE_URL;
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  const url = new URL(withProtocol);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

function migrateVerifierLinkUrl(value) {
  const text = cleanLine(value);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['2fa.aisea.space', '2fa.hashkey-eyang.workers.dev'].includes(url.hostname)) return text;
    const migrated = new URL(DEFAULT_VERIFIER_BASE_URL);
    migrated.search = url.search;
    migrated.hash = url.hash;
    return migrated.toString();
  } catch {
    return text;
  }
}

function normalizeHttpUrl(value) {
  const text = cleanLine(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text)) return `https://${text}`;
  return '';
}

function verifierCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = [
    'https://shougema.top',
    'https://2fa.aisea.space',
    'https://2fa.hashkey-eyang.workers.dev',
    'http://localhost:8787',
    'http://127.0.0.1:8787'
  ];
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function pushTelegramMessage(request, env) {
  const body = await readJson(request);
  const targetId = normalizeTelegramTargetId(body.targetId);
  if (!targetId) return json({ message: '请选择电报发送对象后再推送。' }, 400);

  const targetResponse = await authStore(env).fetch(`https://auth.local/telegram-targets/${encodeURIComponent(targetId)}/resolve`);
  const targetData = await targetResponse.json().catch(() => ({}));
  if (!targetResponse.ok || !targetData.target?.chatId) {
    return json({ message: targetData.message || '请选择有效的电报发送对象。' }, targetResponse.status || 400);
  }
  const botToken = targetData.target.botToken || env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return json({ message: '该电报接收对象没有配置专属 Bot Token，系统统一 TELEGRAM_BOT_TOKEN 也未配置。' }, 503);
  }

  const phone = formatPhoneNumber(body.phoneCode, body.phone);
  const message = body.message ? cleanMessage(body.message) : [
    `账号：${cleanLine(body.account)}`,
    `密码：${cleanLine(body.password)}`,
    `恢复邮箱账号：${cleanLine(body.email)}`,
    `恢复邮箱密码：${cleanLine(body.recoveryEmailPassword)}`,
    `恢复手机号：${cleanLine(phone)}`,
    `备份码：${cleanLine(body.securityCode)}`,
    `手机接码：${cleanLine(body.phoneSmsCode)}`,
    `VPS登录链接：${cleanLine(body.vpsRemoteUrl)}`
  ].join('\n');

  if (!message) return json({ message: '推送内容为空，请检查推送设置。' }, 400);

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetData.target.chatId,
      text: message,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return json({ message: data.description || 'Telegram 推送失败，请检查 Bot Token 和 Chat ID。' }, 502);
  }

  return json({ ok: true, target: publicTelegramTarget(targetData.target) });
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

function normalizeEmailKey(value) {
  return cleanLine(value).toLowerCase();
}

function normalizeVerifierAccount(value) {
  return cleanLine(value).toLowerCase();
}

function cooldownMessage(lockedUntil) {
  const seconds = Math.max(0, Number(lockedUntil || 0) - nowSeconds());
  if (seconds >= 23 * 60 * 60) return '尝试次数过多，请 24 小时后再试。';
  if (seconds >= 55 * 60) return '尝试次数过多，请 1 小时后再试。';
  return '尝试次数过多，请 15 分钟后再试。';
}

function normalizeMicrosoftTenant(value) {
  const tenant = cleanLine(value) || MICROSOFT_DEFAULT_TENANT;
  return /^[a-zA-Z0-9_.-]+$/.test(tenant) ? tenant : MICROSOFT_DEFAULT_TENANT;
}

function tokenCryptoSecret(env) {
  return cleanLine(env.MICROSOFT_TOKEN_SECRET || env.SESSION_SECRET);
}

async function secretKey(secret) {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptSecret(value, secret) {
  if (!value) return '';
  if (!secret) throw new Error('缺少 token 加密密钥');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await secretKey(secret);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `v1.${base64UrlEncodeBytes(iv)}.${base64UrlEncodeBytes(new Uint8Array(encrypted))}`;
}

async function decryptSecret(value, secret) {
  const text = cleanLine(value);
  if (!text || !secret) return '';
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return '';
  try {
    const iv = base64UrlDecodeBytes(parts[1]);
    const encrypted = base64UrlDecodeBytes(parts[2]);
    const key = await secretKey(secret);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}

function publicHotmailDeviceRequest(record) {
  return {
    requestId: record.id,
    email: record.email,
    userCode: record.userCode,
    verificationUri: record.verificationUri,
    message: record.message,
    interval: record.interval,
    expiresAt: record.expiresAt,
    status: record.status
  };
}

function publicHotmailAuth(record, email = '') {
  const key = normalizeEmailKey(email || record?.email);
  if (!record) {
    return {
      configured: false,
      email: key,
      status: key ? 'not_authorized' : 'missing_email',
      message: key ? '该邮箱尚未授权读取。' : '该产品没有配置 Hotmail 邮箱。'
    };
  }
  return {
    configured: Boolean(record.refreshToken && record.status === 'authorized'),
    email: key,
    status: record.status || 'authorized',
    microsoftUser: record.microsoftUser || null,
    scopes: record.scopes || '',
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || '',
    lastReadAt: record.lastReadAt || '',
    lastTokenRefreshAt: record.lastTokenRefreshAt || '',
    error: record.error || '',
    message: record.status === 'reauthorize_required' ? '授权已失效，请重新授权。' : '已授权后台读取恢复邮箱。'
  };
}

async function refreshMicrosoftToken(refreshToken, env) {
  const clientId = cleanLine(env.MICROSOFT_CLIENT_ID);
  if (!clientId) return { status: 503, error: 'Microsoft Client ID 未配置，请先设置 MICROSOFT_CLIENT_ID。' };

  const tenant = normalizeMicrosoftTenant(env.MICROSOFT_TENANT);
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: MICROSOFT_GRAPH_SCOPE
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    return { status: response.status || 502, error: data.error_description || data.error || 'Microsoft token 刷新失败，请重新授权。' };
  }
  return {
    accessToken: data.access_token,
    refreshToken: cleanLine(data.refresh_token)
  };
}

async function fetchMicrosoftProfile(accessToken) {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
      id: cleanLine(data.id),
      displayName: cleanLine(data.displayName),
      userPrincipalName: cleanLine(data.userPrincipalName),
      mail: cleanLine(data.mail)
    };
  } catch {
    return null;
  }
}

async function fetchLatestMicrosoftMailCode(accessToken) {
  const messagesUrl = new URL('https://graph.microsoft.com/v1.0/me/messages');
  messagesUrl.searchParams.set('$top', '10');
  messagesUrl.searchParams.set('$orderby', 'receivedDateTime desc');
  messagesUrl.searchParams.set('$select', 'subject,bodyPreview,body,receivedDateTime,from');
  const response = await fetch(messagesUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text"'
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { status: response.status || 502, error: data.error?.message || 'Microsoft Graph 邮件读取失败。' };
  }

  const messages = Array.isArray(data.value) ? data.value : [];
  for (const message of messages) {
    const text = [
      message.subject,
      message.bodyPreview,
      message.body?.content
    ].filter(Boolean).join(' ');
    const code = extractVerificationCode(text);
    if (code) {
      return {
        code,
        subject: cleanLine(message.subject),
        receivedAt: cleanLine(message.receivedDateTime)
      };
    }
  }
  const latest = messages[0] || {};
  return {
    code: '',
    subject: cleanLine(latest.subject),
    receivedAt: cleanLine(latest.receivedDateTime)
  };
}

function extractVerificationCode(value) {
  const text = String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
  const labeled = text.match(/(?:验证码|驗證碼|校验码|校驗碼|动态码|動態碼|code|otp)[^\d]{0,24}(\d{4,8})/i);
  if (labeled) return labeled[1];
  const standalone = text.match(/(?<!\d)(\d{6})(?!\d)/);
  if (standalone) return standalone[1];
  const shorter = text.match(/(?<!\d)(\d{4,5}|\d{7,8})(?!\d)/);
  return shorter ? shorter[1] : '';
}

function normalizeVerifierCode(value) {
  const code = cleanLine(value);
  return /^[A-Za-z0-9]{10}$/.test(code) ? code : '';
}

function randomVerifierCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = new Uint8Array(VERIFIER_SHORT_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function cleanDate(value) {
  const match = cleanLine(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function addDays(value, days) {
  const dateText = cleanDate(value);
  if (!dateText) return '';
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
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

function normalizeTelegramTargetId(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return text.slice(0, 48);
}

function normalizeTelegramChatId(value) {
  return String(value || '').trim().slice(0, 128);
}

function normalizeTelegramBotToken(value) {
  return String(value || '').trim().slice(0, 256);
}

function isLikelyTelegramBotToken(value) {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(String(value || '').trim());
}

function normalizeTelegramScenes(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(['googleDeveloper', 'appleDeveloper']);
  const scenes = [];
  const seen = new Set();
  for (const item of value) {
    const scene = cleanLine(item);
    if (!allowed.has(scene) || seen.has(scene)) continue;
    seen.add(scene);
    scenes.push(scene);
  }
  return scenes;
}

function envTelegramTargets(env) {
  const targets = [];
  if (env.TELEGRAM_TARGETS) {
    try {
      const parsed = JSON.parse(env.TELEGRAM_TARGETS);
      if (Array.isArray(parsed)) {
        parsed.forEach((target, index) => {
          const normalized = sanitizeTelegramTarget(target, target.id || `env-${index + 1}`);
          if (normalized.label && normalized.chatId) {
            targets.push({ ...normalized, source: 'env' });
          }
        });
      }
    } catch {
      // Ignore malformed optional target lists; the legacy target below can still work.
    }
  }

  if (env.TELEGRAM_CHAT_ID && !targets.some((target) => target.id === 'default')) {
    targets.push(sanitizeTelegramTarget({
      id: 'default',
      label: env.TELEGRAM_CHAT_LABEL || '默认电报号',
      chatId: env.TELEGRAM_CHAT_ID,
      botToken: env.TELEGRAM_BOT_TOKEN,
      scenes: ['googleDeveloper', 'appleDeveloper'],
      source: 'env'
    }, 'default'));
  }
  return targets;
}

function sanitizeTelegramTarget(input = {}, fixedId = '') {
  const label = cleanLine(input.label || input.name).slice(0, 32);
  const fallbackId = label ? label.toLowerCase() : crypto.randomUUID();
  return {
    id: normalizeTelegramTargetId(fixedId || input.id || fallbackId) || crypto.randomUUID().slice(0, 8),
    label,
    chatId: normalizeTelegramChatId(input.chatId || input.chat_id),
    botToken: normalizeTelegramBotToken(input.botToken || input.bot_token),
    scenes: normalizeTelegramScenes(input.scenes),
    source: input.source === 'env' ? 'env' : 'stored'
  };
}

function publicTelegramTarget(target) {
  return {
    id: target.id,
    label: target.label,
    scenes: Array.isArray(target.scenes) ? target.scenes : [],
    hasCustomBotToken: Boolean(target.botToken && target.source !== 'env'),
    source: target.source === 'env' ? 'env' : 'stored'
  };
}

function sanitizeContentTemplates(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: '至少需要保留一个内容模板。', templates: [] };
  }
  if (value.length > 30) {
    return { error: '内容模板最多保存 30 个。', templates: [] };
  }

  const templates = [];
  const seenIds = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const input = value[index] || {};
    const fallbackId = `template-${index + 1}`;
    const id = cleanLine(input.id || fallbackId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || fallbackId;
    if (seenIds.has(id)) return { error: `内容模板 ID 重复：${id}`, templates: [] };
    seenIds.add(id);

    const scene = CONTENT_TEMPLATE_SCENES.has(input.scene) ? input.scene : 'googleDeveloper';
    const fields = [];
    const seenFields = new Set();
    if (Array.isArray(input.fields)) {
      for (const rawField of input.fields) {
        const field = cleanLine(rawField);
        if (!CONTENT_TEMPLATE_FIELDS.has(field) || seenFields.has(field)) continue;
        seenFields.add(field);
        fields.push(field);
      }
    }

    templates.push({
      id,
      name: cleanLine(input.name).slice(0, 80) || `内容模板 ${index + 1}`,
      scene,
      fields,
      format: String(input.format || '').slice(0, 10000),
      active: Boolean(input.active)
    });
  }

  return { templates };
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
    trustedDeviceCount: normalizeTrustedDeviceIds(user.trustedDeviceIds).length,
    initialPassword: user.role !== 'super_admin' ? user.initialPassword || '' : ''
  };
}

function normalizeUserRole(value) {
  if (value === 'super_admin') return 'super_admin';
  if (value === GOOGLE_DEVELOPER_ROLE) return GOOGLE_DEVELOPER_ROLE;
  return 'partner_admin';
}

function normalizeAvailabilityStatus(value) {
  if (['preparing', 'paused', 'compensated', 'damaged'].includes(value)) return value;
  return 'available';
}

function normalizeLossEventType(value) {
  return Object.values(LOSS_EVENT_TYPES).includes(value) ? value : '';
}

function lossCostsSnapshot(value = []) {
  return (Array.isArray(value) ? value : [])
    .map(sanitizeCost)
    .filter((item) => item && Number(item.amount || 0) > 0)
    .map((item) => ({
      id: item.id,
      label: item.label,
      amount: Number(item.amount || 0),
      owner: item.owner === 'wuhan' ? 'wuhan' : 'hongKong',
      remark: item.remark || ''
    }));
}

function lossProductSnapshot(product = {}) {
  return {
    id: product.id,
    productType: normalizeProductType(product.productType),
    account: cleanLine(product.account),
    email: cleanLine(product.email),
    createdAt: cleanLine(product.createdAt),
    capturedAt: new Date().toISOString()
  };
}

function sanitizeProduct(input, id) {
  const now = new Date();
  const updatedAt = now.toLocaleTimeString('zh-CN', { hour12: false });
  return {
    id: normalizeProductId(id),
    productType: normalizeProductType(input.productType),
    availabilityStatus: normalizeAvailabilityStatus(input.availabilityStatus),
    createdAt: cleanLine(input.createdAt) || now.toISOString().slice(0, 10),
    account: cleanLine(input.account),
    email: cleanLine(input.email),
    recoveryEmailPassword: cleanLine(input.recoveryEmailPassword),
    phoneCode: cleanLine(input.phoneCode) || '+86',
    phone: cleanLine(input.phone),
    password: cleanLine(input.password),
    googleAuth: cleanLine(input.googleAuth),
    securityCode: cleanLine(input.securityCode),
    phoneSmsCode: cleanLine(input.phoneSmsCode),
    verifierLinkUrl: migrateVerifierLinkUrl(input.verifierLinkUrl),
    smsLink: cleanLine(input.smsLink),
    vpsIp: cleanLine(input.vpsIp),
    vpsRemoteUrl: cleanLine(input.vpsRemoteUrl),
    vpsUsername: cleanLine(input.vpsUsername),
    vpsPassword: cleanLine(input.vpsPassword),
    remark: String(input.remark || '').slice(0, 500),
    costs: Array.isArray(input.costs) ? input.costs.map(sanitizeCost).filter(Boolean) : [],
    salePrice: numberOrZero(input.salePrice),
    saleTime: cleanLine(input.saleTime),
    isSold: Boolean(input.isSold),
    isPaid: Boolean(input.isPaid),
    salesCustomerId: normalizeSalesCustomerId(input.salesCustomerId),
    salesCustomerSnapshot: sanitizeSalesCustomerSnapshot(input.salesCustomerSnapshot),
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
    dispositionType: normalizeLossEventType(input.dispositionType),
    relatedOriginalProductId: input.relatedOriginalProductId ? normalizeProductId(input.relatedOriginalProductId) : '',
    lossEventId: cleanLine(input.lossEventId),
    saleRemark: String(input.saleRemark || '').slice(0, 500),
    accountType: input.accountType === 'enterprise' ? 'enterprise' : input.accountType === 'personal' ? 'personal' : '',
    accountCreationDate: cleanLine(input.accountCreationDate),
    accountCountry: cleanLine(input.accountCountry),
    accountInfoRaw: String(input.accountInfoRaw || '').slice(0, 3000),
    accountInfoFormatted: String(input.accountInfoFormatted || '').slice(0, 3000),
    phoneRenewal: sanitizePhoneRenewal(input.phoneRenewal, input),
    googleDeveloperAccess: sanitizeGoogleDeveloperAccess(input.googleDeveloperAccess, input),
    updatedAt
  };
}

function sanitizeSalesCustomer(input = {}, fixedId = '') {
  const now = new Date().toISOString();
  return {
    id: normalizeSalesCustomerId(fixedId || input.id || crypto.randomUUID()),
    zhanfuId: cleanLine(input.zhanfuId).slice(0, 80),
    zhanfuUsername: cleanLine(input.zhanfuUsername).slice(0, 80),
    zhanfuPhone: cleanLine(input.zhanfuPhone).slice(0, 40),
    status: input.status === 'disabled' ? 'disabled' : 'active',
    remark: String(input.remark || '').slice(0, 500),
    createdAt: cleanLine(input.createdAt) || now,
    updatedAt: cleanLine(input.updatedAt) || now
  };
}

function sanitizeSalesCustomerSnapshot(input = {}) {
  if (!input) return null;
  const zhanfuId = cleanLine(input.zhanfuId).slice(0, 80);
  const zhanfuUsername = cleanLine(input.zhanfuUsername).slice(0, 80);
  const zhanfuPhone = cleanLine(input.zhanfuPhone).slice(0, 40);
  if (!zhanfuUsername && !zhanfuPhone) return null;
  return {
    id: normalizeSalesCustomerId(input.id),
    zhanfuId,
    zhanfuUsername,
    zhanfuPhone,
    capturedAt: cleanLine(input.capturedAt) || new Date().toISOString()
  };
}

function salesCustomerSnapshot(customer) {
  return {
    id: customer.id,
    zhanfuId: customer.zhanfuId,
    zhanfuUsername: customer.zhanfuUsername,
    zhanfuPhone: customer.zhanfuPhone,
    capturedAt: new Date().toISOString()
  };
}

function sanitizePhoneRenewal(input = {}, product = {}) {
  const purchasedAt = cleanDate(input.purchasedAt) || cleanDate(product.createdAt) || new Date().toISOString().slice(0, 10);
  const maxLifetimeMonths = positiveInteger(input.maxLifetimeMonths, 12);
  const defaultRenewDays = positiveInteger(input.defaultRenewDays, 30);
  const reminderDays = positiveInteger(input.reminderDays, 5);
  const currentExpiresAt = cleanDate(input.currentExpiresAt) || addDays(purchasedAt, defaultRenewDays);
  return {
    mode: input.mode === 'disabled' ? 'disabled' : 'monthly',
    purchasedAt,
    currentExpiresAt,
    maxLifetimeMonths,
    reminderDays,
    defaultRenewDays,
    lastRenewedAt: cleanDate(input.lastRenewedAt),
    lastRenewDays: positiveInteger(input.lastRenewDays, 0),
    lastRenewalNote: String(input.lastRenewalNote || '').slice(0, 300),
    history: Array.isArray(input.history) ? input.history.map(sanitizePhoneRenewalHistory).filter(Boolean).slice(0, 20) : []
  };
}

function sanitizePhoneRenewalHistory(item = {}) {
  const renewedAt = cleanDate(item.renewedAt);
  const days = positiveInteger(item.days, 0);
  if (!renewedAt || !days) return null;
  return {
    id: cleanLine(item.id) || crypto.randomUUID(),
    renewedAt,
    days,
    from: cleanDate(item.from),
    to: cleanDate(item.to),
    note: String(item.note || '').slice(0, 300)
  };
}

function sanitizeGoogleDeveloperAccess(input = {}, product = {}) {
  const info = input.info || {};
  const enabled = Boolean(input.enabled);
  const syncBasicInfo = Boolean(input.syncBasicInfo);
  const syncedInfo = syncBasicInfo ? {
    productName: product.account || product.email,
    accountEmail: product.email,
    phoneNumber: [product.phoneCode, product.phone].filter(Boolean).join(' '),
    accountType: product.accountType,
    creationDate: product.accountCreationDate,
    country: product.accountCountry,
    notes: product.accountInfoRaw || product.accountInfoFormatted || product.remark
  } : {};
  const sourceInfo = { ...info, ...syncedInfo };
  return {
    enabled,
    syncBasicInfo,
    assignedTo: cleanLine(input.assignedTo),
    info: {
      productName: cleanLine(sourceInfo.productName || product.account || product.email).slice(0, 160),
      accountEmail: cleanLine(sourceInfo.accountEmail || product.email).slice(0, 160),
      phoneNumber: cleanLine(sourceInfo.phoneNumber || [product.phoneCode, product.phone].filter(Boolean).join(' ')).slice(0, 80),
      accountType: sourceInfo.accountType === 'enterprise' ? 'enterprise' : sourceInfo.accountType === 'personal' ? 'personal' : '',
      creationDate: cleanLine(sourceInfo.creationDate || product.accountCreationDate).slice(0, 80),
      country: cleanLine(sourceInfo.country || product.accountCountry).slice(0, 80),
      onlineApplications: cleanLine(sourceInfo.onlineApplications).slice(0, 120),
      applicationReleaseDate: cleanLine(sourceInfo.applicationReleaseDate).slice(0, 120),
      iarcEmailDate: cleanLine(sourceInfo.iarcEmailDate).slice(0, 120),
      appSize: cleanLine(sourceInfo.appSize).slice(0, 80),
      sourceCodeKeystore: cleanLine(sourceInfo.sourceCodeKeystore).slice(0, 160),
      language: cleanLine(sourceInfo.language).slice(0, 80),
      paymentProfile: cleanLine(sourceInfo.paymentProfile).slice(0, 160),
      violations: cleanLine(sourceInfo.violations).slice(0, 160),
      notes: String(sourceInfo.notes || product.accountInfoRaw || product.accountInfoFormatted || '').slice(0, 3000)
    },
    updatedBy: cleanLine(input.updatedBy),
    updatedAt: cleanLine(input.updatedAt) || new Date().toISOString()
  };
}

function canAccessGoogleDeveloperProduct(product, username = '') {
  const access = sanitizeGoogleDeveloperAccess(product?.googleDeveloperAccess, product);
  if (!access.enabled) return false;
  const assignedTo = cleanLine(access.assignedTo).toLowerCase();
  const requester = cleanLine(username).toLowerCase();
  return !requester || !assignedTo || assignedTo === requester;
}

function publicGoogleDeveloperProduct(product) {
  const access = sanitizeGoogleDeveloperAccess(product?.googleDeveloperAccess, product);
  return {
    id: product.id,
    productType: product.productType,
    createdAt: product.createdAt,
    account: product.account,
    email: product.email,
    recoveryEmailPassword: product.recoveryEmailPassword,
    phoneCode: product.phoneCode,
    phone: product.phone,
    password: product.password,
    googleAuth: product.googleAuth,
    securityCode: product.securityCode,
    phoneSmsCode: product.phoneSmsCode,
    vpsRemoteUrl: product.vpsRemoteUrl,
    remark: product.remark,
    accountType: product.accountType,
    accountCreationDate: product.accountCreationDate,
    accountCountry: product.accountCountry,
    updatedAt: access.updatedAt || product.updatedAt,
    googleDeveloperAccess: access
  };
}

function googleDeveloperProductPatch(input = {}) {
  const patch = {
    createdAt: input.createdAt,
    account: input.account,
    email: input.email,
    recoveryEmailPassword: input.recoveryEmailPassword,
    phoneCode: input.phoneCode,
    phone: input.phone,
    password: input.password,
    googleAuth: input.googleAuth,
    securityCode: input.securityCode,
    phoneSmsCode: input.phoneSmsCode,
    vpsRemoteUrl: input.vpsRemoteUrl,
    remark: input.remark,
    accountType: input.accountType,
    accountCreationDate: input.accountCreationDate,
    accountCountry: input.accountCountry
  };
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function sanitizePurchaseExpense(input, id) {
  const now = new Date();
  const amountUsd = numberOrZero(input.amountUsd);
  const settlementStatus = input.settlementStatus === 'settled' ? 'settled' : 'unsettled';
  const legacyExchangeRate = positiveNumberOrNull(input.exchangeRate);
  const legacyAmountCny = nullableNumber(input.amountCny);
  const settlementExchangeRate = settlementStatus === 'settled'
    ? positiveNumberOrNull(input.settlementExchangeRate) || legacyExchangeRate
    : null;
  const settlementAmountCny = settlementStatus === 'settled'
    ? nullableNumber(input.settlementAmountCny) ?? legacyAmountCny ?? (settlementExchangeRate ? Number((amountUsd * settlementExchangeRate).toFixed(2)) : null)
    : null;
  return {
    id: normalizeProductId(id),
    purchaseDate: cleanLine(input.purchaseDate) || now.toISOString().slice(0, 10),
    itemName: cleanLine(input.itemName).slice(0, 120),
    quantityRemark: String(input.quantityRemark || '').slice(0, 500),
    amountUsd,
    exchangeRate: legacyExchangeRate,
    amountCny: legacyAmountCny,
    settlementExchangeRate,
    settlementAmountCny,
    settlementStatus,
    settledAt: settlementStatus === 'settled'
      ? cleanLine(input.settledAt) || now.toLocaleString('zh-CN', { hour12: false })
      : '',
    remark: String(input.remark || '').slice(0, 500),
    updatedAt: now.toLocaleTimeString('zh-CN', { hour12: false })
  };
}

function productDuplicateKey(product) {
  const createdDate = cleanLine(product.createdAt).slice(0, 10);
  if (!createdDate) return '';

  const account = cleanLine(product.account).toLowerCase();
  const email = cleanLine(product.email).toLowerCase();
  const phone = [cleanLine(product.phoneCode), cleanLine(product.phone)].filter(Boolean).join(' ').toLowerCase();
  const smsLink = cleanLine(product.smsLink).toLowerCase();
  const vpsRemoteUrl = cleanLine(product.vpsRemoteUrl).toLowerCase();
  const identity = [account, email, phone, smsLink, vpsRemoteUrl].filter(Boolean).join('|');

  return identity ? `${normalizeProductType(product.productType)}|${createdDate}|${identity}` : '';
}

function mergeDuplicateProduct(base, duplicate) {
  const merged = { ...base };
  const textFields = [
    'account',
    'email',
    'recoveryEmailPassword',
    'phoneCode',
    'phone',
    'password',
    'productType',
    'availabilityStatus',
    'googleAuth',
    'securityCode',
    'phoneSmsCode',
    'verifierLinkUrl',
    'smsLink',
    'vpsIp',
    'vpsRemoteUrl',
    'vpsUsername',
    'vpsPassword',
    'remark',
    'saleTime',
    'salesCustomerId',
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
  if (duplicate.googleDeveloperAccess?.enabled) {
    merged.googleDeveloperAccess = duplicate.googleDeveloperAccess;
  }
  if (duplicate.phoneRenewal?.currentExpiresAt) {
    merged.phoneRenewal = duplicate.phoneRenewal;
  }
  if (duplicate.salesCustomerId) {
    merged.salesCustomerId = duplicate.salesCustomerId;
    merged.salesCustomerSnapshot = duplicate.salesCustomerSnapshot || merged.salesCustomerSnapshot || null;
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

function normalizeSalesCustomerId(value) {
  return cleanLine(value).slice(0, 80);
}

function normalizeSalesCustomerZhanfuId(value) {
  return cleanLine(value).toLowerCase();
}

function normalizeSalesCustomerUsername(value) {
  return cleanLine(value).toLowerCase();
}

function normalizeSalesCustomerPhone(value) {
  return cleanLine(value).replace(/[^\d+]+/g, '').replace(/^\+/, '');
}

function normalizeProductType(value) {
  return value === 'appleDeveloper' ? 'appleDeveloper' : 'googleDeveloper';
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
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

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(digest));
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
  return new TextDecoder().decode(base64UrlDecodeBytes(value));
}

function base64UrlDecodeBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
