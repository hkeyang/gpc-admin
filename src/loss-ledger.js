export const LOSS_EVENT_TYPES = Object.freeze({
  AFTER_SALE_REPLACEMENT: 'after_sale_replacement',
  INVENTORY_WRITEOFF: 'inventory_writeoff',
  COST_RECOVERY: 'cost_recovery',
  INVENTORY_RECOVERY: 'inventory_recovery'
});

export const LOSS_SHARING_RULES = Object.freeze({
  EQUAL: 'equal',
  HONG_KONG: 'hongKong',
  WUHAN: 'wuhan'
});

export const LOSS_RECOVERY_OWNERS = Object.freeze({
  HONG_KONG: 'hongKong',
  WUHAN: 'wuhan'
});

export const LOSS_EVENT_LABELS = Object.freeze({
  [LOSS_EVENT_TYPES.AFTER_SALE_REPLACEMENT]: '售后补偿',
  [LOSS_EVENT_TYPES.INVENTORY_WRITEOFF]: '库存报损',
  [LOSS_EVENT_TYPES.COST_RECOVERY]: '金额追回',
  [LOSS_EVENT_TYPES.INVENTORY_RECOVERY]: '恢复可售'
});

export const LOSS_SHARING_LABELS = Object.freeze({
  [LOSS_SHARING_RULES.EQUAL]: '双方各承担 50%',
  [LOSS_SHARING_RULES.HONG_KONG]: '香港独自承担（保留真实成本）',
  [LOSS_SHARING_RULES.WUHAN]: '武汉独自承担（保留真实成本）'
});

export function normalizeLossSharingRule(value) {
  if (value === LOSS_SHARING_RULES.HONG_KONG || value === LOSS_SHARING_RULES.WUHAN) return value;
  return LOSS_SHARING_RULES.EQUAL;
}

export function normalizeLossRecoveryOwner(value) {
  return value === LOSS_RECOVERY_OWNERS.HONG_KONG
    ? LOSS_RECOVERY_OWNERS.HONG_KONG
    : LOSS_RECOVERY_OWNERS.WUHAN;
}

export function lossCostTotals(costs = []) {
  return (Array.isArray(costs) ? costs : []).reduce((totals, item) => {
    const amount = finiteNumber(item?.amount);
    if (amount <= 0) return totals;
    if (item?.owner === LOSS_RECOVERY_OWNERS.WUHAN) totals.wuhan += amount;
    else totals.hongKong += amount;
    totals.total += amount;
    return totals;
  }, { hongKong: 0, wuhan: 0, total: 0 });
}

export function calculateLossSettlement({
  costs = [],
  recoveredAmountUsd = 0,
  recoveryReceivedBy = LOSS_RECOVERY_OWNERS.WUHAN,
  sharingRule = LOSS_SHARING_RULES.EQUAL
} = {}) {
  const cost = lossCostTotals(costs);
  const recovery = Math.max(0, finiteNumber(recoveredAmountUsd));
  const recoveryOwner = normalizeLossRecoveryOwner(recoveryReceivedBy);
  const rule = normalizeLossSharingRule(sharingRule);
  const netLoss = cost.total - recovery;
  const hongKongRatio = rule === LOSS_SHARING_RULES.HONG_KONG
    ? 1
    : rule === LOSS_SHARING_RULES.WUHAN
      ? 0
      : 0.5;
  const hongKongBurden = netLoss * hongKongRatio;
  const wuhanBurden = netLoss - hongKongBurden;
  const hongKongRecovery = recoveryOwner === LOSS_RECOVERY_OWNERS.HONG_KONG ? recovery : 0;
  const hongKongNetPaid = cost.hongKong - hongKongRecovery;
  const hongKongSettlement = hongKongNetPaid - hongKongBurden;

  return roundMoneyFields({
    productCostUsd: cost.total,
    hongKongCostUsd: cost.hongKong,
    wuhanCostUsd: cost.wuhan,
    recoveredAmountUsd: recovery,
    netLossUsd: netLoss,
    hongKongBurdenUsd: hongKongBurden,
    wuhanBurdenUsd: wuhanBurden,
    hongKongSettlementUsd: hongKongSettlement,
    wuhanSettlementUsd: -hongKongSettlement
  });
}

export function lossSettlementDirection(value) {
  const amount = roundMoney(finiteNumber(value));
  if (amount > 0) return { label: '武汉应付香港', amount };
  if (amount < 0) return { label: '香港应付武汉', amount: Math.abs(amount) };
  return { label: '双方无需补款', amount: 0 };
}

export function lossEventBurdens(event = {}) {
  const hasStoredHongKongBurden = event.hongKongBurdenUsd !== '' && event.hongKongBurdenUsd != null;
  const hasStoredWuhanBurden = event.wuhanBurdenUsd !== '' && event.wuhanBurdenUsd != null;
  const storedHongKongBurden = Number(event.hongKongBurdenUsd);
  const storedWuhanBurden = Number(event.wuhanBurdenUsd);
  if (hasStoredHongKongBurden && hasStoredWuhanBurden
    && Number.isFinite(storedHongKongBurden) && Number.isFinite(storedWuhanBurden)) {
    return roundMoneyFields({
      hongKongBurdenUsd: storedHongKongBurden,
      wuhanBurdenUsd: storedWuhanBurden
    });
  }

  const netLossUsd = finiteNumber(event.netLossUsd);
  const rule = normalizeLossSharingRule(event.sharingRule);
  const hongKongBurdenUsd = rule === LOSS_SHARING_RULES.HONG_KONG
    ? netLossUsd
    : rule === LOSS_SHARING_RULES.WUHAN
      ? 0
      : netLossUsd / 2;
  return roundMoneyFields({
    hongKongBurdenUsd,
    wuhanBurdenUsd: netLossUsd - hongKongBurdenUsd
  });
}

export function calculateProfitAttribution({ normalProfitUsd = 0, lossEvents = [] } = {}) {
  const normalProfit = finiteNumber(normalProfitUsd);
  const lossTotals = (Array.isArray(lossEvents) ? lossEvents : []).reduce((totals, event) => {
    const burdens = lossEventBurdens(event);
    totals.companyLossUsd += finiteNumber(event?.netLossUsd);
    totals.hongKongLossBurdenUsd += burdens.hongKongBurdenUsd;
    totals.wuhanLossBurdenUsd += burdens.wuhanBurdenUsd;
    return totals;
  }, { companyLossUsd: 0, hongKongLossBurdenUsd: 0, wuhanLossBurdenUsd: 0 });
  const normalHongKongProfitUsd = normalProfit / 2;
  const normalWuhanProfitUsd = normalProfit - normalHongKongProfitUsd;
  const finalHongKongProfitUsd = normalHongKongProfitUsd - lossTotals.hongKongLossBurdenUsd;
  const finalWuhanProfitUsd = normalWuhanProfitUsd - lossTotals.wuhanLossBurdenUsd;

  return roundMoneyFields({
    normalProfitUsd: normalProfit,
    normalHongKongProfitUsd,
    normalWuhanProfitUsd,
    companyLossUsd: lossTotals.companyLossUsd,
    hongKongLossBurdenUsd: lossTotals.hongKongLossBurdenUsd,
    wuhanLossBurdenUsd: lossTotals.wuhanLossBurdenUsd,
    hongKongExceptionalImpactUsd: -lossTotals.hongKongLossBurdenUsd,
    wuhanExceptionalImpactUsd: -lossTotals.wuhanLossBurdenUsd,
    finalCompanyProfitUsd: normalProfit - lossTotals.companyLossUsd,
    finalHongKongProfitUsd,
    finalWuhanProfitUsd
  });
}

export function lossEventNeedsInternalSettlement(event = {}) {
  if (event.settlementStatus === 'settled' || event.settlementStatus === 'not_required') return false;
  return Math.abs(finiteNumber(event.hongKongSettlementUsd)) >= 0.005;
}

export function reverseLossSettlement(source = {}) {
  return roundMoneyFields({
    productCostUsd: 0,
    hongKongCostUsd: 0,
    wuhanCostUsd: 0,
    recoveredAmountUsd: Math.max(0, finiteNumber(source.productCostUsd)),
    netLossUsd: -finiteNumber(source.netLossUsd),
    hongKongBurdenUsd: -finiteNumber(source.hongKongBurdenUsd),
    wuhanBurdenUsd: -finiteNumber(source.wuhanBurdenUsd),
    hongKongSettlementUsd: -finiteNumber(source.hongKongSettlementUsd),
    wuhanSettlementUsd: -finiteNumber(source.wuhanSettlementUsd)
  });
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Number(finiteNumber(value).toFixed(2));
}

function roundMoneyFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, roundMoney(amount)]));
}
