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
