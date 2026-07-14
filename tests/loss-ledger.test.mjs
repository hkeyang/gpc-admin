import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOSS_SHARING_RULES,
  calculateLossSettlement,
  lossSettlementDirection,
  reverseLossSettlement
} from '../src/loss-ledger.js';

test('香港垫付的售后成本按五五分后由武汉补一半', () => {
  const result = calculateLossSettlement({
    costs: [{ amount: 400, owner: 'hongKong' }],
    sharingRule: LOSS_SHARING_RULES.EQUAL
  });
  assert.deepEqual(result, {
    productCostUsd: 400,
    hongKongCostUsd: 400,
    wuhanCostUsd: 0,
    recoveredAmountUsd: 0,
    netLossUsd: 400,
    hongKongBurdenUsd: 200,
    wuhanBurdenUsd: 200,
    hongKongSettlementUsd: 200,
    wuhanSettlementUsd: -200
  });
});

test('双方分别垫付时只结算超出各自应承担的差额', () => {
  const result = calculateLossSettlement({
    costs: [
      { amount: 300, owner: 'hongKong' },
      { amount: 100, owner: 'wuhan' }
    ]
  });
  assert.equal(result.netLossUsd, 400);
  assert.equal(result.hongKongSettlementUsd, 100);
});

test('供应商追回金额先冲减损失再共同承担', () => {
  const result = calculateLossSettlement({
    costs: [{ amount: 400, owner: 'hongKong' }],
    recoveredAmountUsd: 100,
    recoveryReceivedBy: 'hongKong'
  });
  assert.equal(result.netLossUsd, 300);
  assert.equal(result.hongKongBurdenUsd, 150);
  assert.equal(result.hongKongSettlementUsd, 150);
});

test('武汉单独承担香港垫付的损失时应返还全部成本', () => {
  const result = calculateLossSettlement({
    costs: [{ amount: 400, owner: 'hongKong' }],
    sharingRule: LOSS_SHARING_RULES.WUHAN
  });
  assert.equal(result.hongKongSettlementUsd, 400);
  assert.deepEqual(lossSettlementDirection(result.hongKongSettlementUsd), {
    label: '武汉应付香港',
    amount: 400
  });
});

test('已报损账号恢复可售时以追回额完整冲回损失', () => {
  const loss = calculateLossSettlement({
    costs: [{ amount: 400, owner: 'hongKong' }],
    sharingRule: LOSS_SHARING_RULES.EQUAL
  });
  const result = reverseLossSettlement(loss);
  assert.equal(result.netLossUsd, -400);
  assert.equal(result.hongKongBurdenUsd, -200);
  assert.equal(result.hongKongSettlementUsd, -200);
});
