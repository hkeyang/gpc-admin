import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthStore } from '../worker/index.js';
import { LOSS_EVENT_TYPES } from '../src/loss-ledger.js';

class MemoryStorage {
  constructor(entries = []) {
    this.data = new Map(entries);
  }

  async get(key) {
    return structuredClone(this.data.get(key));
  }

  async put(key, value) {
    this.data.set(key, structuredClone(value));
  }

  async delete(key) {
    return this.data.delete(key);
  }

  async list({ prefix = '' } = {}) {
    return new Map([...this.data.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key, structuredClone(value)]));
  }

  async transaction(callback) {
    return callback(this);
  }
}

function product(id, patch = {}) {
  return {
    id,
    productType: 'googleDeveloper',
    availabilityStatus: 'available',
    createdAt: '2026-07-01',
    account: `account-${id}`,
    email: '',
    costs: [{ id: 1, label: '账号成本', amount: 400, owner: 'hongKong', remark: '' }],
    salePrice: 0,
    saleTime: '',
    isSold: false,
    isPaid: false,
    settlementStatus: 'unsettled',
    ...patch
  };
}

async function call(store, path, method = 'GET', body) {
  const response = await store.fetch(new Request(`https://auth.local${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  }));
  return { status: response.status, data: await response.json() };
}

test('售后补偿独立记损失且不改动已结算原销售', async () => {
  const original = product(1, {
    isSold: true,
    isPaid: true,
    salePrice: 1000,
    settlementStatus: 'settled',
    settlementExchangeRate: 6.9,
    settlementHongKongReceivableUsd: 700,
    salesCustomerId: 'customer-1',
    salesCustomerSnapshot: { id: 'customer-1', zhanfuUsername: '客户A', zhanfuPhone: '10086' }
  });
  const replacement = product(2);
  const storage = new MemoryStorage([
    ['product:1', original],
    ['product:2', replacement]
  ]);
  const store = new AuthStore({ storage }, {});

  const result = await call(store, '/loss-events', 'POST', {
    eventType: LOSS_EVENT_TYPES.AFTER_SALE_REPLACEMENT,
    originalProductId: 1,
    productId: 2,
    sharingRule: 'equal',
    eventDate: '2026-07-15'
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.event.netLossUsd, 400);
  assert.equal(result.data.event.hongKongSettlementUsd, 200);
  assert.equal(result.data.product.availabilityStatus, 'compensated');
  assert.equal(result.data.product.isSold, false);
  assert.deepEqual(await storage.get('product:1'), original);

  const settled = await call(store, `/loss-events/${result.data.event.id}/settle`, 'POST', { exchangeRate: 7 });
  assert.equal(settled.status, 200);
  assert.equal(settled.data.event.settlementAmountCny, 1400);
  assert.deepEqual(await storage.get('product:1'), original);
});

test('未售账号报损按实际垫付差额结算并可用冲回记录恢复', async () => {
  const damaged = product(3, {
    costs: [
      { id: 1, label: '账号成本', amount: 300, owner: 'hongKong', remark: '' },
      { id: 2, label: '其他成本', amount: 100, owner: 'wuhan', remark: '' }
    ]
  });
  const storage = new MemoryStorage([['product:3', damaged]]);
  const store = new AuthStore({ storage }, {});

  const writeoff = await call(store, '/loss-events', 'POST', {
    eventType: LOSS_EVENT_TYPES.INVENTORY_WRITEOFF,
    productId: 3,
    sharingRule: 'equal'
  });
  assert.equal(writeoff.status, 201);
  assert.equal(writeoff.data.event.netLossUsd, 400);
  assert.equal(writeoff.data.event.hongKongSettlementUsd, 100);
  assert.equal((await storage.get('product:3')).availabilityStatus, 'damaged');

  const manualStatusChange = await call(store, '/products/3', 'PUT', { availabilityStatus: 'available' });
  assert.equal(manualStatusChange.status, 400);
  assert.match(manualStatusChange.data.message, /异常处理/);
  assert.equal((await storage.get('product:3')).availabilityStatus, 'damaged');

  const recovery = await call(store, '/loss-events', 'POST', {
    eventType: LOSS_EVENT_TYPES.INVENTORY_RECOVERY,
    referenceEventId: writeoff.data.event.id,
    recoveryReceivedBy: 'wuhan'
  });
  assert.equal(recovery.status, 201);
  assert.equal(recovery.data.event.netLossUsd, -400);
  assert.equal(recovery.data.event.hongKongSettlementUsd, -100);
  assert.equal((await storage.get('product:3')).availabilityStatus, 'available');
  assert.equal(recovery.data.referenceEvent.recoveryStatus, 'recovered');
});

test('香港独自承担且无需跨方补款时自动标记为无需内部结算', async () => {
  const replacement = product(4, {
    costs: [{ id: 1, label: '账号成本', amount: 357, owner: 'hongKong', remark: '' }]
  });
  const storage = new MemoryStorage([['product:4', replacement]]);
  const store = new AuthStore({ storage }, {});

  const result = await call(store, '/loss-events', 'POST', {
    eventType: LOSS_EVENT_TYPES.INVENTORY_WRITEOFF,
    productId: 4,
    sharingRule: 'hongKong'
  });

  assert.equal(result.status, 201);
  assert.equal(result.data.event.hongKongBurdenUsd, 357);
  assert.equal(result.data.event.wuhanBurdenUsd, 0);
  assert.equal(result.data.event.hongKongSettlementUsd, 0);
  assert.equal(result.data.event.settlementStatus, 'not_required');
  assert.equal((await storage.get('product:4')).costs[0].amount, 357);
});

test('读取空异常账本不会改写任何现有产品', async () => {
  const existing = product(9, { account: 'legacy-account' });
  const storage = new MemoryStorage([['product:9', existing]]);
  const store = new AuthStore({ storage }, {});
  const before = structuredClone(await storage.get('product:9'));

  const result = await call(store, '/loss-events');

  assert.equal(result.status, 200);
  assert.deepEqual(result.data.events, []);
  assert.deepEqual(await storage.get('product:9'), before);
});

test('站斧 ID 会随客户保存，并且填写时保持唯一', async () => {
  const store = new AuthStore({ storage: new MemoryStorage() }, {});

  const created = await call(store, '/sales-customers', 'POST', {
    zhanfuId: 'ZF-2026-001',
    zhanfuUsername: '客户A',
    zhanfuPhone: '13800138000'
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.customer.zhanfuId, 'ZF-2026-001');

  const duplicate = await call(store, '/sales-customers', 'POST', {
    zhanfuId: 'zf-2026-001',
    zhanfuUsername: '客户B',
    zhanfuPhone: '13900139000'
  });
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.data.message, /站斧 ID 已存在/);
});

test('产品遗留失效客户 ID 时，按销售快照重新绑定现有客户', async () => {
  const customer = {
    id: 'customer-current',
    zhanfuId: 'ZF-36',
    zhanfuUsername: '武汉市跃文',
    zhanfuPhone: '13800138036',
    status: 'active',
    remark: '',
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z'
  };
  const staleProduct = product(36, {
    salesCustomerId: 'customer-deleted',
    salesCustomerSnapshot: {
      id: 'customer-deleted',
      zhanfuId: 'ZF-36',
      zhanfuUsername: '武汉市跃文',
      zhanfuPhone: '13800138036'
    }
  });
  const storage = new MemoryStorage([
    ['product:36', staleProduct],
    ['sales_customer:customer-current', customer]
  ]);
  const store = new AuthStore({ storage }, {});

  const saved = await call(store, '/products/36', 'PUT', {
    salesCustomerId: 'customer-deleted',
    salesCustomerSnapshot: staleProduct.salesCustomerSnapshot
  });

  assert.equal(saved.status, 200);
  assert.equal(saved.data.product.salesCustomerId, 'customer-current');
  assert.equal(saved.data.product.salesCustomerSnapshot.zhanfuUsername, '武汉市跃文');
});

test('旧客户档案缺少内置 ID 时，列表仍使用存储键中的原始 ID', async () => {
  const storage = new MemoryStorage([[
    'sales_customer:legacy-yuewen',
    {
      zhanfuUsername: '武汉市跃文',
      zhanfuPhone: '13800138036',
      status: 'active',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z'
    }
  ]]);
  const store = new AuthStore({ storage }, {});

  const listed = await call(store, '/sales-customers');
  assert.equal(listed.status, 200);
  assert.equal(listed.data.customers[0].id, 'legacy-yuewen');

  const saved = await call(store, '/sales-customers/legacy-yuewen', 'PUT', { zhanfuId: 'ZF-36' });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.customer.id, 'legacy-yuewen');
  assert.equal(saved.data.customer.zhanfuId, 'ZF-36');
  assert.equal((await storage.get('sales_customer:legacy-yuewen')).id, 'legacy-yuewen');
});
