import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  BarChart3,
  Box,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Copy,
  CreditCard,
  Database,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  FileText,
  Bell,
  Home,
  Info,
  LayoutDashboard,
  LineChart,
  Lock,
  Plus,
  Power,
  RefreshCw,
  ReceiptText,
  Search,
  Send,
  Settings,
  Save,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  X
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import './styles.css';

const defaultExchangeRate = 6.84;
const exchangeRateSource = 'Frankfurter';
const googleDeveloperRole = 'google_developer';
const googleDeveloperPageId = 'google-developer';
const businessTypes = [
  {
    id: 'googleDeveloper',
    label: '谷歌开发者',
    shortLabel: '谷歌',
    navId: 'products-google',
    costLabels: ['账号成本', 'VPS', 'ESIM', '写卡器', '其他成本'],
    pushFields: ['account', 'password', 'email', 'recoveryEmailPassword', 'phone', 'googleAuth', 'authenticatorCodeUrl', 'securityCode', 'phoneSmsCode', 'vpsRemoteUrl', 'remark']
  },
  {
    id: 'appleDeveloper',
    label: '苹果开发者',
    shortLabel: '苹果',
    navId: 'products-apple',
    costLabels: ['账号成本', 'ESIM', '写卡器', '其他成本'],
    pushFields: ['account', 'password', 'email', 'phone', 'smsLink', 'remark']
  }
];
const defaultBusinessType = businessTypes[0].id;
const costOwners = {
  hongKong: 'hongKong',
  wuhan: 'wuhan'
};
const pushTemplateStorageKey = 'gpc_push_templates';
const authenticatorCodeUrl = 'https://2fa.aisea.space/';
const pushFieldOptions = [
  { key: 'account', label: '账号', placeholder: '{account}' },
  { key: 'password', label: '密码', placeholder: '{password}' },
  { key: 'email', label: '恢复邮箱账号', placeholder: '{email}' },
  { key: 'recoveryEmailPassword', label: '恢复邮箱密码', placeholder: '{recoveryEmailPassword}' },
  { key: 'phone', label: '恢复手机号', placeholder: '{phone}' },
  { key: 'googleAuth', label: '谷歌验证器', placeholder: '{googleAuth}' },
  { key: 'authenticatorCodeUrl', label: '验证器接码', placeholder: '{authenticatorCodeUrl}' },
  { key: 'smsLink', label: '接码链接', placeholder: '{smsLink}' },
  { key: 'securityCode', label: '备份码', placeholder: '{securityCode}' },
  { key: 'phoneSmsCode', label: '手机接码', placeholder: '{phoneSmsCode}' },
  { key: 'vpsRemoteUrl', label: 'VPS登录链接', placeholder: '{vpsRemoteUrl}' },
  { key: 'remark', label: '备注', placeholder: '{remark}' }
];
const defaultPushTemplateFields = ['account', 'password', 'email', 'recoveryEmailPassword', 'phone', 'googleAuth', 'authenticatorCodeUrl', 'securityCode', 'phoneSmsCode', 'vpsRemoteUrl'];

function businessTypeConfig(productType) {
  return businessTypes.find((item) => item.id === productType) || businessTypes[0];
}

function productBusinessType(product) {
  return businessTypeConfig(product?.productType).id;
}

function businessTypeFromPage(page) {
  return businessTypes.find((item) => item.navId === page)?.id || defaultBusinessType;
}

function pushOptionsForType(productType) {
  const allowed = new Set(businessTypeConfig(productType).pushFields);
  return pushFieldOptions.filter((item) => allowed.has(item.key));
}

function defaultPushFieldsForType(productType) {
  return pushOptionsForType(productType).slice(0, productType === 'appleDeveloper' ? 6 : 8).map((item) => item.key);
}

function createPushFormat(fields = defaultPushTemplateFields, productType = defaultBusinessType) {
  const options = pushOptionsForType(productType);
  return fields
    .map((fieldKey) => {
      const field = options.find((item) => item.key === fieldKey);
      return field ? `${field.label}：${field.placeholder}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

const defaultPushTemplates = [
  {
    id: 'list-default',
    name: '谷歌开发者信息推送',
    scene: 'googleDeveloper',
    fields: defaultPushTemplateFields,
    format: createPushFormat(defaultPushTemplateFields),
    active: true
  },
  {
    id: 'apple-default',
    name: '苹果开发者信息推送',
    scene: 'appleDeveloper',
    fields: defaultPushFieldsForType('appleDeveloper'),
    format: createPushFormat(defaultPushFieldsForType('appleDeveloper'), 'appleDeveloper'),
    active: true
  }
];

function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateTimeInput(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${localDateInput(date)}T${hours}:${minutes}`;
}

function toDateTimeInputValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(' ', 'T').slice(0, 16);
}

function fromDateTimeInputValue(value) {
  return value ? value.replace('T', ' ') : '';
}

function openNativePicker(input) {
  if (!input || input.disabled || input.readOnly) return;
  input.focus({ preventScroll: true });
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
    } catch {
      // Browsers may reject showPicker outside a direct user gesture.
    }
  }
}

function openRangePicker(event, fromInput, toInput) {
  const targetPicker = event.target?.closest?.('[data-picker]');
  if (targetPicker) {
    openNativePicker(targetPicker.dataset.picker === 'to' ? toInput : fromInput);
    return;
  }
  const { left, width } = event.currentTarget.getBoundingClientRect();
  openNativePicker(event.clientX < left + width / 2 ? fromInput : toInput);
}

function createBlankCosts(productType = defaultBusinessType) {
  return businessTypeConfig(productType).costLabels.map((label, index) => ({
    id: index + 1,
    label,
    amount: '',
    owner: costOwners.hongKong,
    remark: ''
  }));
}

function createBlankProduct(productType = defaultBusinessType) {
  return {
    id: '',
    productType: businessTypeConfig(productType).id,
    createdAt: localDateInput(),
    account: '',
    email: '',
    recoveryEmailPassword: '',
    phoneCode: '+86',
    phone: '',
    password: '',
    googleAuth: '',
    securityCode: '',
    phoneSmsCode: '',
    smsLink: '',
    vpsIp: '',
    vpsRemoteUrl: '',
    vpsUsername: '',
    vpsPassword: '',
    remark: '',
    costs: createBlankCosts(productType),
    salePrice: 0,
    saleTime: '',
    isSold: false,
    isPaid: false,
    settlementStatus: 'unsettled',
    settlementExchangeRate: null,
    settlementShareCnyHongKong: null,
    settlementShareCnyWuhan: null,
    settlementHongKongCostUsd: null,
    settlementWuhanCostUsd: null,
    settlementProfitUsd: null,
    settlementHongKongReceivableUsd: null,
    settlementWuhanRetainedUsd: null,
    settlementHongKongReceivableCny: null,
    settlementWuhanRetainedCny: null,
    accountType: '',
    accountCreationDate: '',
    accountCountry: '',
    accountInfoRaw: '',
    accountInfoFormatted: '',
    googleDeveloperAccess: createBlankGoogleDeveloperAccess(),
    updatedAt: ''
  };
}

function createBlankGoogleDeveloperInfo(product = {}) {
  return {
    productName: product.account || product.email || '',
    accountEmail: product.email || '',
    phoneNumber: formatPhoneNumber(product.phoneCode, product.phone),
    accountType: product.accountType || '',
    creationDate: product.accountCreationDate || '',
    country: product.accountCountry || '',
    onlineApplications: '',
    applicationReleaseDate: '',
    iarcEmailDate: '',
    appSize: '',
    sourceCodeKeystore: '',
    language: '',
    paymentProfile: '',
    violations: '',
    notes: product.accountInfoRaw || product.accountInfoFormatted || product.remark || ''
  };
}

function createBlankGoogleDeveloperAccess(product = {}) {
  return {
    enabled: false,
    syncBasicInfo: false,
    assignedTo: '',
    info: createBlankGoogleDeveloperInfo(product),
    updatedBy: '',
    updatedAt: ''
  };
}

function normalizeGoogleDeveloperAccess(product = {}) {
  const access = product.googleDeveloperAccess || {};
  return {
    ...createBlankGoogleDeveloperAccess(product),
    ...access,
    enabled: Boolean(access.enabled),
    syncBasicInfo: Boolean(access.syncBasicInfo),
    assignedTo: String(access.assignedTo || ''),
    info: {
      ...createBlankGoogleDeveloperInfo(product),
      ...(access.info || {})
    }
  };
}

function googleDeveloperStatus(product) {
  const access = normalizeGoogleDeveloperAccess(product);
  if (!access.enabled) return 'Not Shared';
  return access.syncBasicInfo ? 'Synced' : 'Shared';
}

function canUseGoogleDeveloperPage(user) {
  return user?.role === 'super_admin' || user?.role === googleDeveloperRole;
}

function getDeviceId() {
  const storageKey = 'gpc_device_id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

const initialProducts = [];

const businessTrend = [
  { date: '04-21', sales: 7600, profit: 2340 },
  { date: '04-22', sales: 18710, profit: 4530 },
  { date: '04-23', sales: 23680, profit: 4090 },
  { date: '04-24', sales: 30700, profit: 8190 },
  { date: '04-25', sales: 34795, profit: 10525 },
  { date: '04-26', sales: 29970, profit: 7020 },
  { date: '04-27', sales: 33040, profit: 9355 }
];

const businessTrend30 = [
  { date: '03-29', sales: 11200, profit: 2740 },
  { date: '03-31', sales: 13600, profit: 3220 },
  { date: '04-02', sales: 15800, profit: 4100 },
  { date: '04-04', sales: 14100, profit: 3680 },
  { date: '04-06', sales: 18200, profit: 5240 },
  { date: '04-08', sales: 20500, profit: 6110 },
  { date: '04-10', sales: 22400, profit: 6490 },
  { date: '04-12', sales: 21100, profit: 5900 },
  { date: '04-14', sales: 24700, profit: 7020 },
  { date: '04-16', sales: 26300, profit: 7650 },
  { date: '04-18', sales: 28600, profit: 8240 },
  { date: '04-20', sales: 30100, profit: 8850 },
  { date: '04-22', sales: 31800, profit: 9410 },
  { date: '04-24', sales: 34200, profit: 10120 },
  { date: '04-27', sales: 33040, profit: 9355 }
];

const monthBars = [
  { month: '11月', cost: 11990, profit: 9940 },
  { month: '12月', cost: 13740, profit: 11400 },
  { month: '1月', cost: 13305, profit: 10525 },
  { month: '2月', cost: 16375, profit: 12280 },
  { month: '3月', cost: 15060, profit: 12575 },
  { month: '4月', cost: 10738, profit: 14406 }
];

const chartLabels = {
  sales: '销售额',
  cost: '成本',
  profit: '利润'
};

function money(value, currency = '$') {
  const number = Number(value || 0);
  return `${currency}${number.toLocaleString(undefined, {
    minimumFractionDigits: number % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}

function cny(value) {
  return money(value, '¥');
}

function usdToCny(value, rate = defaultExchangeRate) {
  return Number(value || 0) * normalizeExchangeRate(rate);
}

function formatExchangeValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Number(number.toFixed(2)).toString();
}

function normalizeExchangeRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : defaultExchangeRate;
}

function settlementCnySnapshot(settlement, rate) {
  const normalizedRate = normalizeExchangeRate(rate);
  const hongKongReceivableUsd = Number(settlement?.hongKongReceivable || 0);
  const wuhanRetainedUsd = Number(settlement?.wuhanRetained || 0);
  const hongKongReceivableCny = Number((hongKongReceivableUsd * normalizedRate).toFixed(2));
  const wuhanRetainedCny = Number((wuhanRetainedUsd * normalizedRate).toFixed(2));
  return {
    settlementExchangeRate: normalizedRate,
    settlementShareCnyHongKong: hongKongReceivableCny,
    settlementShareCnyWuhan: wuhanRetainedCny,
    settlementHongKongCostUsd: Number(settlement?.hongKongCost || 0),
    settlementWuhanCostUsd: Number(settlement?.wuhanCost || 0),
    settlementProfitUsd: Number(settlement?.profit || 0),
    settlementHongKongReceivableUsd: hongKongReceivableUsd,
    settlementWuhanRetainedUsd: wuhanRetainedUsd,
    settlementHongKongReceivableCny: hongKongReceivableCny,
    settlementWuhanRetainedCny: wuhanRetainedCny
  };
}

function productSettlementSnapshot(product, settlement) {
  if (product.settlementStatus !== 'settled') return null;
  const rate = Number(product.settlementExchangeRate);
  const hongKong = Number(product.settlementHongKongReceivableCny);
  const wuhan = Number(product.settlementWuhanRetainedCny);
  if (Number.isFinite(rate) && rate > 0 && Number.isFinite(hongKong) && Number.isFinite(wuhan)) {
    return { rate, hongKong, wuhan };
  }
  const fallback = settlementCnySnapshot(settlement, Number.isFinite(rate) && rate > 0 ? rate : defaultExchangeRate);
  return {
    rate: fallback.settlementExchangeRate,
    hongKong: fallback.settlementHongKongReceivableCny,
    wuhan: fallback.settlementWuhanRetainedCny
  };
}

function trendDateValue(date) {
  return `2024-${date}`;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function shortDate(dateText) {
  return String(dateText || '').slice(5, 10);
}

function buildDailyTrend(products, days = 7) {
  const today = new Date();
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return { date: shortDate(dateKey(date)), fullDate: dateKey(date), sales: 0, profit: 0 };
  });

  const byDate = new Map(rows.map((item) => [item.fullDate, item]));
  products.forEach((product) => {
    if (!product.isSold) return;
    const key = String(product.saleTime || product.createdAt || '').slice(0, 10);
    const row = byDate.get(key);
    if (!row) return;
    row.sales += Number(product.salePrice || 0);
    row.profit += productProfit(product);
  });
  return rows;
}

function buildMonthlyBars(products) {
  const byMonth = new Map();
  products.forEach((product) => {
    const key = String(product.saleTime || product.createdAt || '').slice(0, 7);
    if (!key) return;
    const label = `${Number(key.slice(5, 7))}月`;
    const current = byMonth.get(key) || { month: label, cost: 0, profit: 0 };
    current.cost += sumCosts(product);
    if (product.isSold) current.profit += productProfit(product);
    byMonth.set(key, current);
  });
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row).slice(-6);
}

function normalizeCostOwner(owner) {
  return owner === costOwners.wuhan ? costOwners.wuhan : costOwners.hongKong;
}

function sumCosts(product, owner) {
  const costs = Array.isArray(product?.costs) ? product.costs : [];
  return costs.reduce((total, item) => {
    if (owner && normalizeCostOwner(item.owner) !== owner) return total;
    return total + Number(item.amount || 0);
  }, 0);
}

function productProfit(product) {
  return settlementAmounts(product).profit;
}

function settlementAmounts(product) {
  const salePrice = Number(product?.salePrice || 0);
  const hongKongCost = sumCosts(product, costOwners.hongKong);
  const wuhanCost = sumCosts(product, costOwners.wuhan);
  const totalCost = hongKongCost + wuhanCost;
  const profit = salePrice - totalCost;
  const hongKongProfitShare = profit / 2;
  const wuhanProfitShare = profit / 2;
  return {
    salePrice,
    hongKongCost,
    wuhanCost,
    totalCost,
    profit,
    hongKongProfitShare,
    wuhanProfitShare,
    hongKongReceivable: hongKongCost + hongKongProfitShare,
    wuhanRetained: wuhanCost + wuhanProfitShare
  };
}

function productStatus(product) {
  if (!product.costs.length || sumCosts(product) === 0) return '待补成本';
  if (!product.isSold) return '待售';
  if (!product.isPaid) return '待回款';
  if (product.settlementStatus === 'unsettled') return '待结算';
  return '已结算';
}

function shouldShowPendingSettlement(product) {
  return Boolean(product?.isSold && product?.settlementStatus === 'unsettled');
}

function settlementStatusLabel(product) {
  if (!product?.isSold) return '-';
  return product.settlementStatus === 'settled' ? '已结算' : '未结算';
}

function createBlankPurchaseExpense(rate = defaultExchangeRate) {
  return {
    id: `draft-expense-${Date.now()}`,
    purchaseDate: localDateInput(),
    itemName: '',
    quantityRemark: '',
    amountUsd: '',
    settlementStatus: 'unsettled',
    settlementExchangeRate: null,
    settlementAmountCny: null,
    settledAt: '',
    remark: '',
    updatedAt: ''
  };
}

function purchaseExpenseEstimatedCny(expense, rate = defaultExchangeRate) {
  return Number((Number(expense?.amountUsd || 0) * normalizeExchangeRate(rate)).toFixed(2));
}

function purchaseExpenseSettledCny(expense, rate = defaultExchangeRate) {
  const snapshot = Number(expense?.settlementAmountCny);
  if (Number.isFinite(snapshot) && snapshot > 0) return snapshot;
  const legacy = Number(expense?.amountCny);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;
  const settledRate = normalizeExchangeRate(expense?.settlementExchangeRate || expense?.exchangeRate || rate);
  return purchaseExpenseEstimatedCny(expense, settledRate);
}

function purchaseExpenseStatusLabel(expense) {
  return expense?.settlementStatus === 'settled' ? '已结算' : '未结算';
}

function purchaseExpenseDateValue(expense) {
  return String(expense?.purchaseDate || '').slice(0, 10);
}

function productDateValue(product) {
  return String(product.createdAt || '').slice(0, 10);
}

function compareNaturalIds(a, b) {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function sortProductsByIdDesc(products) {
  return [...products].sort((a, b) => compareNaturalIds(b.id, a.id));
}

function maxNumericProductId(products) {
  return products.reduce((max, product) => {
    const id = Number(product.id);
    return Number.isFinite(id) ? Math.max(max, id) : max;
  }, 0);
}

function compactDateLabel(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const [, month, day] = text.split('-');
  return month && day ? `${month}/${day}` : fallback;
}

function normalizeMonthText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const isoMonth = text.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (isoMonth) return `${isoMonth[1]}-${isoMonth[2].padStart(2, '0')}`;
  const dotted = text.match(/^(\d{4})[./年-](\d{1,2})/);
  if (dotted) return `${dotted[1]}-${dotted[2].padStart(2, '0')}`;
  const monthName = text.match(/(\d{1,2})?\s*([A-Za-z]+),?\s*(\d{4})|([A-Za-z]+)\s+(\d{1,2})?,?\s*(\d{4})/);
  if (monthName) {
    const monthText = monthName[2] || monthName[4];
    const year = monthName[3] || monthName[6];
    const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].findIndex((name) => monthText.toLowerCase().startsWith(name));
    if (monthIndex >= 0) return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  }
  return text;
}

function monthLabel(value) {
  const normalized = normalizeMonthText(value);
  const match = normalized.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}.${Number(match[2])}` : normalized;
}

function accountAgeMonths(product) {
  const listed = normalizeMonthText(productDateValue(product));
  const created = normalizeMonthText(product?.accountCreationDate);
  const listedMatch = listed.match(/^(\d{4})-(\d{2})/);
  const createdMatch = created.match(/^(\d{4})-(\d{2})/);
  if (!listedMatch || !createdMatch) return '';
  const months = (Number(listedMatch[1]) - Number(createdMatch[1])) * 12 + (Number(listedMatch[2]) - Number(createdMatch[2]));
  if (!Number.isFinite(months)) return '';
  return `${Math.max(0, Math.round(months))}个月`;
}

function parseKeyValueText(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const result = {};
  const urls = [];
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) {
      urls.push(line);
      continue;
    }
    const separator = line.indexOf(':');
    if (separator < 0) {
      if (/^no violations$/i.test(line)) result['no violations'] = 'No Violations';
      if (/source code and keystore available/i.test(line)) result['source code and keystore available'] = 'Available';
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    result[key] = value;
  }
  if (urls.length) result.url = urls.join('\n');
  return result;
}

function formatAccountInfo(rawText) {
  const parsed = parseKeyValueText(rawText);
  const lines = [
    `Creation Date: ${parsed['creation date'] || ''}`,
    `Online Applications: ${parsed['online applications'] || ''}`,
    `Application Release Date: ${parsed['application release date'] || ''}`,
    `IARC Email Date: ${parsed['iarc email date'] || ''}`,
    `App Size: ${parsed['app size'] || ''}`,
    parsed['source code and keystore available'] !== undefined ? 'Source Code and Keystore Available' : `Source Code and Keystore: ${parsed['source code and keystore'] || ''}`,
    `Language: ${parsed.language || ''}`,
    `Payment Profile: ${parsed['payment profile'] || ''}`,
    `Country: ${parsed.country || ''}`,
    parsed['no violations'] !== undefined ? 'No Violations' : `Violations: ${parsed.violations || ''}`
  ];
  if (parsed.url) lines.push(parsed.url);
  return lines.join('\n');
}

function accountInfoPatch(rawText) {
  const parsed = parseKeyValueText(rawText);
  return {
    accountInfoRaw: rawText,
    accountInfoFormatted: formatAccountInfo(rawText),
    accountCreationDate: normalizeMonthText(parsed['creation date'] || ''),
    accountCountry: parsed.country || ''
  };
}

function accountCost(product) {
  const costs = Array.isArray(product?.costs) ? product.costs : [];
  const matched = costs.find((item) => String(item.label || '').includes('账号'));
  return Number(matched?.amount || 0);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function statusClass(status) {
  if (['已售', '已回款', '已结算'].includes(status)) return 'success';
  if (['待回款', '未回款', '未结算'].includes(status)) return 'danger';
  if (['待售', '待补成本'].includes(status)) return 'primary';
  return 'warning';
}

async function apiJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 15000;
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const { timeoutMs: _timeoutMs, signal: _signal, ...fetchOptions } = options;
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(fetchOptions.headers || {}) },
      ...fetchOptions,
      signal: controller.signal
    }).catch((error) => {
      if (error.name === 'AbortError') throw new Error('请求超时，请重试。');
      throw error;
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || '请求失败');
    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function promiseWithTimeout(promise, timeoutMs, message = '操作超时，请重试。') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function normalizePushTemplates(value) {
  const templates = Array.isArray(value) && value.length ? value : defaultPushTemplates;
  const normalized = templates.map((template, index) => {
    const scene = template.scene === 'products' ? defaultBusinessType : businessTypeConfig(template.scene).id;
    const fieldOptions = pushOptionsForType(scene);
    const fieldKeys = new Set(fieldOptions.map((item) => item.key));
    const fallbackFields = defaultPushFieldsForType(scene);
    const storedFields = Array.isArray(template.fields) && template.fields.length ? template.fields : fallbackFields;
    const migratedFields = scene === 'googleDeveloper' && template.id === 'list-default' && !storedFields.includes('authenticatorCodeUrl')
      ? insertAfterField(storedFields, 'googleAuth', 'authenticatorCodeUrl')
      : storedFields;
    const fields = migratedFields
      .filter((field) => fieldKeys.has(field));
    return {
      id: template.id || `push-${Date.now()}-${index}`,
      name: template.name || `${businessTypeConfig(scene).label}信息推送`,
      scene,
      fields: fields.length ? fields : fallbackFields,
      format: normalizePushFormat(template.format) || createPushFormat(fields.length ? fields : fallbackFields, scene),
      active: Boolean(template.active)
    };
  });
  const scenes = new Set(normalized.map((template) => template.scene));
  return [
    ...normalized,
    ...defaultPushTemplates.filter((template) => !scenes.has(template.scene))
  ];
}

function insertAfterField(fields, anchor, inserted) {
  if (fields.includes(inserted)) return fields;
  const anchorIndex = fields.indexOf(anchor);
  if (anchorIndex < 0) return [...fields, inserted];
  return [
    ...fields.slice(0, anchorIndex + 1),
    inserted,
    ...fields.slice(anchorIndex + 1)
  ];
}

function normalizePushFormat(format) {
  return String(format || '')
    .replace(/(Google|谷歌)\s*验证器+/g, '$1验证器')
    .replace(/(Google|谷歌)\s*验证(?!器)/g, '$1验证器')
    .replace(/绑定手机号/g, '恢复手机号')
    .replace(/绑定邮箱/g, '恢复邮箱账号')
    .replace(/设备安全码/g, '备份码')
    .split('\n')
    .filter((line) => !/(VPS\s*(用户名|密码|IP)|\{vpsUsername\}|\{vpsPassword\}|\{vpsIp\})/i.test(line))
    .join('\n');
}

function readStoredPushTemplates() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(pushTemplateStorageKey) || '[]');
    return normalizePushTemplates(stored);
  } catch {
    return defaultPushTemplates;
  }
}

function productPushValue(product, key) {
  if (key === 'phone') return formatPhoneNumber(product.phoneCode, product.phone);
  if (key === 'authenticatorCodeUrl') return authenticatorCodeUrl;
  return product[key] ?? '';
}

function normalizeAuthenticatorSecret(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^otpauth:\/\//i.test(text)) {
    try {
      const parsed = new URL(text);
      return parsed.searchParams.get('secret') || '';
    } catch {
      return '';
    }
  }
  return text;
}

function decodeBase32Secret(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = normalizeAuthenticatorSecret(value).toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (!clean) throw new Error('请先填写谷歌验证器密钥。');
  let bits = '';
  const bytes = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('密钥格式不正确，请检查是否为 Base32。');
    bits += index.toString(2).padStart(5, '0');
    while (bits.length >= 8) {
      bytes.push(Number.parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }
  return new Uint8Array(bytes);
}

async function generateTotpCode(secret, time = Date.now()) {
  const keyBytes = decodeBase32Secret(secret);
  const counter = Math.floor(time / 1000 / 30);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter);
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const digest = new Uint8Array(await window.crypto.subtle.sign('HMAC', cryptoKey, buffer));
  const offset = digest[digest.length - 1] & 0xf;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

function formatPhoneNumber(phoneCode, phone) {
  const code = String(phoneCode || '').trim();
  const rawPhone = String(phone || '').trim();
  if (!code) return rawPhone;
  if (!rawPhone) return code;

  const normalizedCode = code.replace(/^\+/, '');
  const normalizedPhone = rawPhone.replace(/^[+\s-]+/, '');
  if (normalizedPhone === normalizedCode) return code;
  if (normalizedPhone.startsWith(normalizedCode)) return `${code} ${normalizedPhone.slice(normalizedCode.length).trim()}`;
  return `${code} ${rawPhone}`;
}

function buildProductPushMessage(product, template = defaultPushTemplates[0]) {
  const productType = productBusinessType(product);
  const options = pushOptionsForType(productType);
  const fields = Array.isArray(template.fields) && template.fields.length ? template.fields : defaultPushFieldsForType(productType);
  const format = normalizePushFormat(template.format) || createPushFormat(fields, productType);
  return pushFieldOptions.reduce((message, field) => {
    return message.replaceAll(field.placeholder, cleanMessageValue(productPushValue(product, field.key)));
  }, format || createPushFormat(options.map((item) => item.key), productType));
}

function cleanMessageValue(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function App() {
  const [page, setPageState] = useState(() => {
    const hashPage = window.location.hash.replace('#/', '') || 'dashboard';
    return hashPage === 'products' ? businessTypes[0].navId : hashPage;
  });
  const [products, setProducts] = useState(initialProducts);
  const [purchaseExpenses, setPurchaseExpenses] = useState([]);
  const [activeId, setActiveId] = useState(initialProducts[0]?.id || 1);
  const [draftProduct, setDraftProduct] = useState(null);
  const [productSync, setProductSync] = useState({ loading: false, saving: false, message: '' });
  const [purchaseExpenseSync, setPurchaseExpenseSync] = useState({ loading: false, saving: false, message: '' });
  const [pushTemplates, setPushTemplates] = useState(readStoredPushTemplates);
  const [deviceId] = useState(getDeviceId);
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null, pendingRequestId: '' });
  const [adminLoginRequests, setAdminLoginRequests] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(defaultExchangeRate);
  const adminLoginRequestsActive = useRef(false);
  const activeProduct = draftProduct && draftProduct.id === activeId
    ? draftProduct
    : products.find((item) => item.id === activeId) || products[0] || null;
  const currentUser = authState.user;
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isGoogleDeveloperUser = currentUser?.role === googleDeveloperRole;
  const pendingLoginCount = adminLoginRequests.filter((item) => item.status === 'pending').length;
  const refreshAdminLoginRequests = async () => {
    if (!authState.authenticated || !isSuperAdmin) {
      setAdminLoginRequests([]);
      return;
    }

    try {
      const data = await apiJson('/api/admin/login-requests');
      if (!adminLoginRequestsActive.current) return;
      setAdminLoginRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch {
      if (!adminLoginRequestsActive.current) return;
      setAdminLoginRequests([]);
    }
  };
  const listPushTemplate = useMemo(() => {
    return (productType) => pushTemplates.find((item) => item.scene === productType && item.active)
      || pushTemplates.find((item) => item.scene === productType)
      || defaultPushTemplates.find((item) => item.scene === productType)
      || defaultPushTemplates[0];
  }, [pushTemplates]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextPage = window.location.hash.replace('#/', '') || 'dashboard';
      setPageState(nextPage === 'products' ? businessTypes[0].navId : nextPage);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setAuthState({
        loading: false,
        authenticated: Boolean(data.authenticated),
        user: data.user || null,
        pendingRequestId: ''
      }))
      .catch(() => setAuthState({ loading: false, authenticated: false, user: null, pendingRequestId: '' }));
  }, []);

  useEffect(() => {
    if (!authState.authenticated || !isSuperAdmin) {
      setAdminLoginRequests([]);
      adminLoginRequestsActive.current = false;
      return;
    }

    adminLoginRequestsActive.current = true;
    let cancelled = false;
    const loadAdminLoginRequests = async () => {
      await refreshAdminLoginRequests();
      if (cancelled) return;
    };

    loadAdminLoginRequests();
    const timer = window.setInterval(loadAdminLoginRequests, 15000);
    return () => {
      cancelled = true;
      adminLoginRequestsActive.current = false;
      window.clearInterval(timer);
    };
  }, [authState.authenticated, isSuperAdmin]);

  useEffect(() => {
    window.localStorage.setItem(pushTemplateStorageKey, JSON.stringify(pushTemplates));
  }, [pushTemplates]);

  const setPage = (nextPage) => {
    if (isGoogleDeveloperUser && nextPage !== googleDeveloperPageId) {
      nextPage = googleDeveloperPageId;
    }
    if (nextPage === 'settings' && !isSuperAdmin) {
      nextPage = 'dashboard';
    }
    setPageState(nextPage);
    window.history.replaceState(null, '', `#/${nextPage}`);
  };

  useEffect(() => {
    if (authState.authenticated && isGoogleDeveloperUser && page !== googleDeveloperPageId) {
      setPage(googleDeveloperPageId);
      return;
    }
    if (authState.authenticated && page === 'settings' && !isSuperAdmin) {
      setPage('dashboard');
    }
    if (authState.authenticated && page === googleDeveloperPageId && !canUseGoogleDeveloperPage(currentUser)) {
      setPage('dashboard');
    }
  }, [authState.authenticated, page, isSuperAdmin, isGoogleDeveloperUser, currentUser]);

  useEffect(() => {
    if (!authState.authenticated) return;
    let cancelled = false;
    setProductSync((current) => ({ ...current, loading: true, message: '' }));
    apiJson(isGoogleDeveloperUser ? '/api/google-developer-products' : '/api/products')
      .then((data) => {
        if (cancelled) return;
        const loadedProducts = sortProductsByIdDesc(Array.isArray(data.products) ? data.products : []);
        setProducts(loadedProducts);
        setActiveId((currentId) => loadedProducts.some((item) => item.id === currentId) ? currentId : loadedProducts[0]?.id || currentId);
        setProductSync({ loading: false, saving: false, message: '' });
      })
      .catch((error) => {
        if (cancelled) return;
        setProductSync({ loading: false, saving: false, message: error.message || '产品数据读取失败，当前显示本地示例数据。' });
      });
    return () => {
      cancelled = true;
    };
  }, [authState.authenticated, isGoogleDeveloperUser]);

  useEffect(() => {
    if (!authState.authenticated || isGoogleDeveloperUser) {
      setPurchaseExpenses([]);
      return;
    }
    let cancelled = false;
    setPurchaseExpenseSync((current) => ({ ...current, loading: true, message: '' }));
    apiJson('/api/purchase-expenses')
      .then((data) => {
        if (cancelled) return;
        setPurchaseExpenses(Array.isArray(data.expenses) ? data.expenses : []);
        setPurchaseExpenseSync({ loading: false, saving: false, message: '' });
      })
      .catch((error) => {
        if (cancelled) return;
        setPurchaseExpenseSync({ loading: false, saving: false, message: error.message || '代采购费用读取失败。' });
      });
    return () => {
      cancelled = true;
    };
  }, [authState.authenticated, isGoogleDeveloperUser]);

  useEffect(() => {
    if (!authState.authenticated || isGoogleDeveloperUser) return;
    let cancelled = false;
    apiJson('/api/exchange-rate')
      .then((data) => {
        if (!cancelled) setExchangeRate(normalizeExchangeRate(data.rate));
      })
      .catch(() => {
        if (!cancelled) setExchangeRate(defaultExchangeRate);
      });
    return () => {
      cancelled = true;
    };
  }, [authState.authenticated, isGoogleDeveloperUser]);

  const addProduct = (productType = defaultBusinessType) => {
    const now = new Date();
    const nextId = maxNumericProductId(products) + 1;
    const normalizedType = businessTypeConfig(productType).id;
    const nextProduct = {
      id: nextId,
      productType: normalizedType,
      createdAt: localDateInput(now),
      account: `new_product_${nextId}`,
      email: '',
      recoveryEmailPassword: '',
      phoneCode: '+86',
      phone: '',
      password: '',
      googleAuth: '',
      securityCode: '',
      phoneSmsCode: '',
      smsLink: '',
      vpsIp: '',
      vpsRemoteUrl: '',
      vpsUsername: '',
      vpsPassword: '',
      remark: '',
      costs: createBlankCosts(normalizedType),
      salePrice: 0,
      saleTime: '',
      isSold: false,
      isPaid: false,
      settlementStatus: 'unsettled',
      settlementExchangeRate: null,
      settlementShareCnyHongKong: null,
      settlementShareCnyWuhan: null,
      settlementHongKongCostUsd: null,
      settlementWuhanCostUsd: null,
      settlementProfitUsd: null,
      settlementHongKongReceivableUsd: null,
      settlementWuhanRetainedUsd: null,
      settlementHongKongReceivableCny: null,
      settlementWuhanRetainedCny: null,
      accountType: '',
      accountCreationDate: '',
      accountCountry: '',
      accountInfoRaw: '',
      accountInfoFormatted: '',
      googleDeveloperAccess: createBlankGoogleDeveloperAccess(),
      updatedAt: now.toLocaleTimeString('zh-CN', { hour12: false })
    };
    nextProduct.id = `draft-${Date.now()}`;
    setDraftProduct(nextProduct);
    setActiveId(nextProduct.id);
    setPage('workbench');
  };

  const saveProduct = async (product) => {
    setProductSync((current) => ({ ...current, saving: true, message: '' }));
    try {
      const isDraft = String(product.id).startsWith('draft-');
      const payload = { ...product };
      const access = normalizeGoogleDeveloperAccess(payload);
      if (access.enabled && access.syncBasicInfo) {
        payload.googleDeveloperAccess = {
          ...access,
          info: createBlankGoogleDeveloperInfo(payload),
          updatedBy: currentUser?.username || access.updatedBy,
          updatedAt: new Date().toLocaleString('zh-CN', { hour12: false })
        };
      }
      if (isDraft) delete payload.id;
      const data = await apiJson(isDraft ? '/api/products' : `/api/products/${encodeURIComponent(product.id)}`, {
        method: isDraft ? 'POST' : 'PUT',
        body: JSON.stringify(payload)
      });
      const savedProduct = data.product;
      setProducts((current) => {
        const withoutDraft = current.filter((item) => item.id !== product.id);
        const exists = withoutDraft.some((item) => item.id === savedProduct.id);
        const nextProducts = exists
          ? withoutDraft.map((item) => item.id === savedProduct.id ? savedProduct : item)
          : [savedProduct, ...withoutDraft];
        return sortProductsByIdDesc(nextProducts);
      });
      setDraftProduct(null);
      setActiveId(savedProduct.id);
      setProductSync({ loading: false, saving: false, message: '产品已保存。' });
      return { ok: true, product: savedProduct };
    } catch (error) {
      const message = error.message || '保存失败，请稍后重试。';
      setProductSync({ loading: false, saving: false, message });
      return { ok: false, message };
    }
  };

  const saveGoogleDeveloperProduct = async (product) => {
    setProductSync((current) => ({ ...current, saving: true, message: '' }));
    try {
      const data = await apiJson(`/api/google-developer-products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ product })
      });
      const savedProduct = data.product;
      setProducts((current) => sortProductsByIdDesc(current.map((item) => item.id === savedProduct.id ? { ...item, ...savedProduct } : item)));
      setProductSync({ loading: false, saving: false, message: 'Basic information saved.' });
      return { ok: true, product: savedProduct };
    } catch (error) {
      const message = error.message || 'Save failed. Please try again.';
      setProductSync({ loading: false, saving: false, message });
      return { ok: false, message };
    }
  };

  const settleProductStatus = async (product, settlementPatch) => {
    setProductSync((current) => ({ ...current, saving: true, message: '' }));
    try {
      const data = await apiJson(`/api/products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        body: JSON.stringify(settlementPatch),
        timeoutMs: 10000
      });
      const savedProduct = data.product;
      setProducts((current) => sortProductsByIdDesc(current.map((item) => item.id === savedProduct.id ? savedProduct : item)));
      setDraftProduct(null);
      setActiveId(savedProduct.id);
      setProductSync({ loading: false, saving: false, message: '结算状态已保存。' });
      return { ok: true, product: savedProduct };
    } catch (error) {
      const message = error.message || '结算保存失败，请稍后重试。';
      setProductSync({ loading: false, saving: false, message });
      return { ok: false, message };
    }
  };

  const clearProducts = async () => {
    const confirmed = window.confirm('确定清空全部产品数据吗？此操作会删除当前所有产品记录。');
    if (!confirmed) return;
    setProductSync((current) => ({ ...current, saving: true, message: '' }));
    try {
      const data = await apiJson('/api/products', { method: 'DELETE' });
      setProducts([]);
      setDraftProduct(null);
      setActiveId(null);
      setProductSync({ loading: false, saving: false, message: `已清空产品数据，共删除 ${data.deleted || 0} 条。` });
    } catch (error) {
      setProductSync({ loading: false, saving: false, message: error.message || '清空产品数据失败，请稍后重试。' });
    }
  };

  const savePurchaseExpense = async (expense) => {
    setPurchaseExpenseSync((current) => ({ ...current, saving: true, message: '' }));
    try {
      const isDraft = String(expense.id).startsWith('draft-expense-');
      const payload = { ...expense };
      if (isDraft) delete payload.id;
      delete payload.exchangeRate;
      delete payload.amountCny;
      const data = await apiJson(isDraft ? '/api/purchase-expenses' : `/api/purchase-expenses/${encodeURIComponent(expense.id)}`, {
        method: isDraft ? 'POST' : 'PUT',
        body: JSON.stringify(payload)
      });
      const savedExpense = data.expense;
      setPurchaseExpenses((current) => {
        const withoutDraft = current.filter((item) => item.id !== expense.id);
        const exists = withoutDraft.some((item) => item.id === savedExpense.id);
        return exists
          ? withoutDraft.map((item) => item.id === savedExpense.id ? savedExpense : item)
          : [savedExpense, ...withoutDraft];
      });
      setPurchaseExpenseSync({ loading: false, saving: false, message: '代采购费用已保存。' });
      return { ok: true, expense: savedExpense };
    } catch (error) {
      const message = error.message || '代采购费用保存失败，请稍后重试。';
      setPurchaseExpenseSync({ loading: false, saving: false, message });
      return { ok: false, message };
    }
  };

  const deletePurchaseExpense = async (expense) => {
    const confirmed = window.confirm(`确定删除代采购费用「${expense.itemName || expense.id}」吗？`);
    if (!confirmed) return { ok: false, cancelled: true };
    setPurchaseExpenseSync((current) => ({ ...current, saving: true, message: '' }));
    try {
      await apiJson(`/api/purchase-expenses/${encodeURIComponent(expense.id)}`, { method: 'DELETE' });
      setPurchaseExpenses((current) => current.filter((item) => item.id !== expense.id));
      setPurchaseExpenseSync({ loading: false, saving: false, message: '代采购费用已删除。' });
      return { ok: true };
    } catch (error) {
      const message = error.message || '代采购费用删除失败，请稍后重试。';
      setPurchaseExpenseSync({ loading: false, saving: false, message });
      return { ok: false, message };
    }
  };

  const handleLogin = async (username, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const data = await response.json();
      if (!response.ok) return { ok: false, message: data.message || '登录失败' };
      if (!data.approved) {
        setAuthState({ loading: false, authenticated: false, user: null, pendingRequestId: data.requestId || '' });
        return { ok: true, pendingApproval: true, requestId: data.requestId, message: data.message };
      }
      setAuthState({ loading: false, authenticated: true, user: data.user, pendingRequestId: '' });
      return { ok: true, pendingApproval: false };
    } catch {
      return { ok: false, message: '后端认证服务不可用，请使用 Wrangler/Cloudflare 部署运行' };
    }
  };

  const checkLoginRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/auth/login-status?request_id=${encodeURIComponent(requestId)}`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) return { ok: false, message: data.message || '登录申请状态查询失败' };
      if (!data.approved) return { ok: true, approved: false, message: '还在等待超级管理员批准' };
      setAuthState({ loading: false, authenticated: true, user: data.user, pendingRequestId: '' });
      return { ok: true, approved: true };
    } catch {
      return { ok: false, message: '后端登录审批服务不可用' };
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthState({ loading: false, authenticated: false, user: null, pendingRequestId: '' });
  };

  if (authState.loading) {
    return <div className="auth-loading"><RefreshCw size={22} /> 正在验证登录状态...</div>;
  }

  if (!authState.authenticated) {
    return (
      <LoginPage
        deviceId={deviceId}
        pendingRequestId={authState.pendingRequestId}
        onLogin={handleLogin}
        onCheckApproval={checkLoginRequest}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar
        current={page}
        onChange={setPage}
        user={currentUser}
        pendingLoginCount={pendingLoginCount}
        products={products}
        activeGoogleDeveloperId={activeId}
        onOpenGoogleDeveloperProduct={(id) => {
          setActiveId(id);
          setPage(googleDeveloperPageId);
        }}
      />
      <main className="main">
        <Topbar
          user={currentUser}
          onLogout={logout}
          onOpenSettings={() => setPage('settings')}
          pendingLoginCount={pendingLoginCount}
        />
        {isSuperAdmin && pendingLoginCount > 0 && (
          <div className="admin-alert">
            <Bell size={15} />
            <span>有 {pendingLoginCount} 条待审批登录申请</span>
            <button className="link-button" type="button" onClick={() => setPage('settings')}>去系统设置</button>
          </div>
        )}
        {page === googleDeveloperPageId && canUseGoogleDeveloperPage(currentUser) && (
          <GoogleDeveloperPage
            products={products}
            user={currentUser}
            saving={productSync.saving}
            activeId={activeId}
            onActiveChange={setActiveId}
            onSave={saveGoogleDeveloperProduct}
          />
        )}
        {!isGoogleDeveloperUser && page === 'dashboard' && <Dashboard products={products} exchangeRate={exchangeRate} onOpenProducts={() => setPage(businessTypes[0].navId)} onOpenWorkbench={(id) => { setActiveId(id); setPage('workbench'); }} />}
        {!isGoogleDeveloperUser && businessTypes.some((item) => item.navId === page) && (() => {
          const productType = businessTypeFromPage(page);
          const visibleProducts = products.filter((item) => productBusinessType(item) === productType);
          return (
            <ProductsPage
              productType={productType}
              title={businessTypeConfig(productType).label}
              products={visibleProducts}
              exchangeRate={exchangeRate}
              pushTemplate={listPushTemplate(productType)}
              onAddProduct={() => addProduct(productType)}
              onOpenWorkbench={(id) => {
                setActiveId(id);
                setPage('workbench');
              }}
            />
          );
        })()}
        {!isGoogleDeveloperUser && page === 'account-details' && <AccountDetailsPage products={products} onSaveProduct={saveProduct} saving={productSync.saving} />}
        {productSync.message && <div className="global-notice"><Info size={15} />{productSync.message}</div>}
        {!isGoogleDeveloperUser && page === 'purchase-expenses' && (
          <PurchaseExpensesPage
            expenses={purchaseExpenses}
            exchangeRate={exchangeRate}
            loading={purchaseExpenseSync.loading}
            saving={purchaseExpenseSync.saving}
            onSaveExpense={savePurchaseExpense}
            onDeleteExpense={deletePurchaseExpense}
          />
        )}
        {purchaseExpenseSync.message && <div className="global-notice"><Info size={15} />{purchaseExpenseSync.message}</div>}
        {!isGoogleDeveloperUser && page === 'workbench' && activeProduct && (
          <Workbench product={activeProduct} user={currentUser} onSave={saveProduct} onSettle={settleProductStatus} saving={productSync.saving} />
        )}
        {!isGoogleDeveloperUser && page === 'push-settings' && (
          <PushSettingsPage
            products={products}
            templates={pushTemplates}
            onChange={setPushTemplates}
          />
        )}
        {page === 'settings' && isSuperAdmin && (
          <SettingsPage user={currentUser} onRequestsChanged={refreshAdminLoginRequests} />
        )}
      </main>
    </div>
  );
}

function LoginPage({ deviceId, pendingRequestId, onLogin, onCheckApproval }) {
  const [username, setUsername] = useState('xyzunknown');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [localRequestId, setLocalRequestId] = useState(pendingRequestId);
  const activeRequestId = pendingRequestId || localRequestId;

  const submit = async (event) => {
    event.preventDefault();
    const result = await onLogin(username, password);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.pendingApproval) {
      setLocalRequestId(result.requestId);
      setMessage(result.message || '登录申请已提交，等待超级管理员批准');
      return;
    }
    setMessage('');
  };

  const checkApproval = async () => {
    const result = await onCheckApproval(activeRequestId);
    if (!result.ok || !result.approved) {
      setMessage(result.message || '还在等待超级管理员批准');
    }
  };

  useEffect(() => {
    if (!activeRequestId) return;
    let cancelled = false;

    const pollApproval = async () => {
      const result = await onCheckApproval(activeRequestId);
      if (cancelled) return;
      if (!result.ok) {
        setMessage(result.message || '还在等待超级管理员批准');
        return;
      }
      if (result.approved) setMessage('');
    };

    pollApproval();
    const timer = window.setInterval(pollApproval, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRequestId, onCheckApproval]);

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <img className="brand-logo" src="/google-logo.svg" alt="Google" />
          <div>
            <strong>GPC管理</strong>
            <p>轻量产品管理平台</p>
          </div>
        </div>
        <div className="login-copy">
          <h1>后台登录</h1>
          <p>账号密码验证后，仅授权设备可进入管理后台；同一账号可在多台设备同时在线。</p>
        </div>
        {!activeRequestId ? (
          <form className="login-form" onSubmit={submit}>
            <label>
              <span>管理员账号</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>
            <label>
              <span>登录密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </label>
            {message && <div className="login-error">{message}</div>}
            <button className="primary-button login-submit" type="submit"><Lock size={16} /> 登录后台</button>
          </form>
        ) : (
          <div className="device-card">
            <ShieldCheck size={34} />
            <h2>等待超级管理员授权</h2>
            <p>设备指纹</p>
            <code>{deviceId}</code>
            <p>登录申请</p>
            <code>{activeRequestId}</code>
            {message && <div className="login-error">{message}</div>}
            <button className="primary-button login-submit" onClick={checkApproval}>我已获得批准，进入后台</button>
            <button className="secondary-button login-submit" onClick={() => { setLocalRequestId(''); setMessage(''); }}>返回登录</button>
            <span>在已登录的管理员后台“系统设置”里点击同意后，这台设备会自动进入后台。</span>
          </div>
        )}
      </section>
    </main>
  );
}

function Sidebar({ current, onChange, user, pendingLoginCount, products = [], activeGoogleDeveloperId, onOpenGoogleDeveloperProduct }) {
  const isSuperAdmin = user?.role === 'super_admin';
  const isGoogleDeveloperUser = user?.role === googleDeveloperRole;
  const googleDeveloperProducts = products.filter((product) => normalizeGoogleDeveloperAccess(product).enabled);
  const internalNav = [
    { id: 'dashboard', label: '首页', icon: Home },
    ...businessTypes.map((item) => ({ id: item.navId, label: item.label, icon: ClipboardList })),
    { id: 'account-details', label: '账号详情', icon: UserRound },
    { id: 'purchase-expenses', label: '代采购费用', icon: ReceiptText },
    { id: 'push-settings', label: '推送设置', icon: Send },
    { id: 'settings', label: '系统设置', icon: Settings }
  ].filter((item) => item.id !== 'settings' || isSuperAdmin);
  const nav = [
    ...(!isGoogleDeveloperUser ? internalNav : []),
    ...(canUseGoogleDeveloperPage(user) ? [{ id: googleDeveloperPageId, label: 'Google Developer', icon: FileText }] : [])
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src="/google-logo.svg" alt="Google" />
        <div>
          <strong>GPC管理</strong>
          <p>轻量产品管理平台</p>
        </div>
      </div>
      <nav>
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.id}>
            <button
              className={`nav-item ${current === item.id ? 'active' : ''}`}
              onClick={() => !item.disabled && onChange(item.id)}
              disabled={item.disabled}
            >
              <span className="nav-item-main">
                <Icon size={17} />
                <span>{item.label}</span>
              </span>
              {item.id === 'settings' && pendingLoginCount > 0 && (
                <span className="nav-count">{pendingLoginCount}</span>
              )}
            </button>
            {item.id === googleDeveloperPageId && googleDeveloperProducts.length > 0 && (
              <div className="nav-sublist">
                {googleDeveloperProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className={`nav-subitem ${activeGoogleDeveloperId === product.id ? 'active' : ''}`}
                    onClick={() => onOpenGoogleDeveloperProduct?.(product.id)}
                    title={product.account || product.email || `#${product.id}`}
                  >
                    {product.account || product.email || `#${product.id}`}
                  </button>
                ))}
              </div>
            )}
            </React.Fragment>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar({ user, onLogout, onOpenSettings, pendingLoginCount }) {
  const roleLabel = user?.role === 'super_admin' ? '超级管理员' : user?.role === googleDeveloperRole ? 'Google Developer' : '伙伴管理员';
  return (
    <header className="topbar">
      <div className="topbar-spacer" />
      {pendingLoginCount > 0 && (
        <button className="topbar-alert" type="button" onClick={onOpenSettings}>
          <Bell size={15} />
          <span>待审批 {pendingLoginCount}</span>
        </button>
      )}
      <div className="avatar">{user?.username?.slice(0, 1)?.toUpperCase() || 'A'}</div>
      <div className="admin">{user?.username || 'Admin'}<span>{roleLabel}</span></div>
      <button className="logout-button" onClick={onLogout}>退出</button>
    </header>
  );
}

function Dashboard({ products, exchangeRate, onOpenWorkbench, onOpenProducts }) {
  const [trendRange, setTrendRange] = useState('7d');
  const [customTrendRange, setCustomTrendRange] = useState({ from: '', to: '' });
  const [settlementInfoOpen, setSettlementInfoOpen] = useState(false);
  const total = products.length;
  const sold = products.filter((item) => item.isSold).length;
  const paid = products.filter((item) => item.isPaid).length;
  const totalSales = products.filter((item) => item.isSold).reduce((sum, item) => sum + Number(item.salePrice || 0), 0);
  const totalProfit = products.filter((item) => item.isSold).reduce((sum, item) => sum + productProfit(item), 0);
  const pendingPayment = products.filter((item) => item.isSold && !item.isPaid).reduce((sum, item) => sum + Number(item.salePrice || 0), 0);
  const missingCost = products.filter((item) => !item.costs.length || sumCosts(item) === 0).length;
  const pendingSettlement = products
    .filter((item) => shouldShowPendingSettlement(item))
    .reduce((sum, item) => sum + settlementAmounts(item).hongKongReceivable, 0);

  const pie = [
    { name: '待售', value: products.filter((item) => !item.isSold).length, color: '#3f74f6' },
    { name: '已售', value: products.filter((item) => item.isSold).length, color: '#26c281' },
    { name: '待补成本', value: missingCost, color: '#8290a8' }
  ];
  const visiblePie = pie.some((item) => item.value > 0)
    ? pie
    : [{ name: '暂无数据', value: 1, color: '#e4e8f1' }];
  const activeTrend = useMemo(() => {
    const base = buildDailyTrend(products, trendRange === '30d' || trendRange === 'custom' ? 30 : 7);
    if (trendRange !== 'custom') return base;
    return base.filter((item) => (
      (!customTrendRange.from || item.fullDate >= customTrendRange.from) &&
      (!customTrendRange.to || item.fullDate <= customTrendRange.to)
    ));
  }, [products, trendRange, customTrendRange]);
  const monthlyBars = useMemo(() => buildMonthlyBars(products), [products]);
  const trendLabel = trendRange === '30d' ? '近 30 天' : trendRange === 'custom' ? '自定义区间' : '近 7 天';
  const trendPeak = activeTrend.length ? Math.max(...activeTrend.map((item) => item.profit)) : 0;
  const trendPeakDate = activeTrend.find((item) => item.profit === trendPeak)?.date;
  const downloadTrend = () => downloadCsv('gpc-business-trend.csv', [
    ['日期', '销售额', '利润'],
    ...activeTrend.map((item) => [item.date, item.sales, item.profit])
  ]);

  return (
    <section className="page">
      <div className="page-title dashboard-title">
        <h1>首页</h1>
        <button
          className={`title-toggle ${settlementInfoOpen ? 'open' : ''}`}
          type="button"
          onClick={() => setSettlementInfoOpen((open) => !open)}
          aria-expanded={settlementInfoOpen}
        >
          结算信息 <ChevronDown size={14} />
        </button>
        {settlementInfoOpen && (
          <div className="settlement-info-card" aria-label="结算信息">
            <strong>6227002722020149126</strong>
            <span>中国建设银行</span>
            <span>徐勇</span>
          </div>
        )}
      </div>
      <div className="kpi-grid six">
        <Kpi icon={WalletCards} label="累计产品" value={`${total} 件`} sub="实时产品库" tone="purple" />
        <Kpi icon={ShoppingCart} label="累计售出" value={`${sold} 件`} sub={`回款 ${paid} 件`} tone="blue" />
        <Kpi icon={Coins} label="累计利润" value={money(totalProfit)} sub={`销售额 ${money(totalSales)}`} tone="orange" />
        <Kpi icon={TrendingUp} label="本月利润" value={money(monthlyBars.at(-1)?.profit || 0)} sub="当前产品数据" tone="green" />
        <Kpi icon={Database} label="待回款" value={money(pendingPayment)} sub={`${products.filter((item) => item.isSold && !item.isPaid).length} 笔`} tone="orange" negative />
        <Kpi icon={CreditCard} label="待结算香港" value={money(pendingSettlement)} subValue={cny(usdToCny(pendingSettlement, exchangeRate))} sub={`${products.filter((item) => shouldShowPendingSettlement(item)).length} 笔`} tone="purple" />
      </div>

      <div className="dashboard-grid">
        <Panel className="overview-panel" title="经营总览" hint="单位：USD" action={<ChartTabs active={trendRange} customRange={customTrendRange} onChange={setTrendRange} onCustomRangeChange={setCustomTrendRange} onDownload={downloadTrend} />}>
          <ChartLegend items={[
            { label: '销售额', color: '#7a5cf8' },
            { label: '利润', color: '#4f9ff8' }
          ]} />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={activeTrend} margin={{ left: 6, right: 10, top: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7a5cf8" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#7a5cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <Tooltip content={<BusinessTooltip />} />
              <Area isAnimationActive={false} type="monotone" dataKey="sales" name="销售额" stroke="#7a5cf8" strokeWidth={2.5} fill="url(#salesGradient)" />
              <Area isAnimationActive={false} type="monotone" dataKey="profit" name="利润" stroke="#4f9ff8" strokeWidth={2.5} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
          <ChartInsight tone="blue">{trendLabel}利润峰值 {money(trendPeak)}{trendPeakDate ? `，出现在 ${trendPeakDate}。` : '。'}</ChartInsight>
        </Panel>

        <Panel title="产品状态分布" className="status-panel">
          <div className="donut-wrap">
            <div className="donut-chart-box">
              <PieChart width={190} height={190}>
                <Pie isAnimationActive={false} data={visiblePie} innerRadius={58} outerRadius={78} dataKey="value" strokeWidth={0}>
                  {visiblePie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="donut-center"><span>总数</span><strong>{total}</strong></div>
            </div>
            <div className="legend">
              {pie.map((entry, index) => (
                <div key={entry.name}><i style={{ background: entry.color }} />{entry.name}<b>{entry.value}</b></div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="关键提醒" action={<button className="link-button" onClick={onOpenProducts}>查看全部 <ChevronRight size={14} /></button>}>
          <div className="alerts">
            <AlertRow icon={AlertTriangle} label="未回款" value={money(pendingPayment)} sub={`共 ${products.filter((item) => item.isSold && !item.isPaid).length} 笔`} tone="red" />
            <AlertRow icon={ShieldCheck} label="未结算" value={money(pendingSettlement)} sub={`共 ${products.filter((item) => shouldShowPendingSettlement(item)).length} 笔`} tone="orange" />
            <AlertRow icon={UserRound} label="待补成本" value={`${missingCost} 个`} sub="成本为 0 或未填写" tone="purple" />
          </div>
        </Panel>
      </div>

      <div className="bottom-grid">
        <Panel title="月度成本与利润对比" hint="单位：USD">
          <ChartLegend items={[
            { label: '成本', color: '#4f9ff8' },
            { label: '利润', color: '#8f63f7' }
          ]} />
          <ResponsiveContainer width="100%" height={218}>
            <BarChart data={monthlyBars} margin={{ left: 6, right: 10, top: 12, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <Tooltip content={<BarTooltip />} />
              <Bar isAnimationActive={false} dataKey="cost" name="成本" fill="#4f9ff8" radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="profit" name="利润" fill="#8f63f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ChartInsight tone="purple">月度图表随产品成本、售价和销售状态实时更新。</ChartInsight>
        </Panel>
        <Panel title="最近产品记录" action={<button className="link-button" onClick={onOpenProducts}>查看全部 <ChevronRight size={14} /></button>}>
          <table className="mini-table">
            <thead><tr><th>ID</th><th>业务</th><th>账号</th><th>状态</th><th>利润 (USD)</th><th>时间</th></tr></thead>
            <tbody>
              {products.slice(0, 5).map((item) => (
                <tr key={item.id} onClick={() => onOpenWorkbench(item.id)}>
                  <td>{item.id}</td>
                  <td>{businessTypeConfig(productBusinessType(item)).shortLabel}</td>
                  <td>{item.account}</td>
                  <td><StatusBadge label={productStatus(item)} /></td>
                  <td>{money(Math.max(productProfit(item), 0))}</td>
                  <td>{item.updatedAt}</td>
                </tr>
              ))}
              {!products.length && <tr><td colSpan={6}>暂无产品记录</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
      <FooterNote />
    </section>
  );
}

function Kpi({ icon: Icon, label, value, subValue, sub, tone, negative }) {
  return (
    <div className="kpi-card">
      <div className={`icon-bubble ${tone}`}><Icon size={20} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {subValue && <em className="amount-subvalue">{subValue}</em>}
        {sub && <p><span>{sub}</span><b className={negative ? 'down' : 'up'}>{negative ? '↓' : '↑'}</b></p>}
      </div>
    </div>
  );
}

function ChartTabs({ active, customRange, onChange, onCustomRangeChange, onDownload }) {
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  const updateCustomRange = (key, value) => {
    onCustomRangeChange((current) => ({ ...current, [key]: value }));
    onChange('custom');
  };

  return (
    <div className="chart-tabs">
      <button className={active === '7d' ? 'active' : ''} onClick={() => onChange('7d')}>近7天</button>
      <button className={active === '30d' ? 'active' : ''} onClick={() => onChange('30d')}>近30天</button>
      <button className={active === 'custom' ? 'active' : ''} onClick={() => onChange('custom')}>自定义</button>
      {active === 'custom' && (
        <div className="custom-date-range" onClick={(event) => openRangePicker(event, fromInputRef.current, toInputRef.current)}>
          <input ref={fromInputRef} aria-label="自定义开始日期" type="date" value={customRange.from} onChange={(event) => updateCustomRange('from', event.target.value)} />
          <span>-</span>
          <input ref={toInputRef} aria-label="自定义结束日期" type="date" value={customRange.to} onChange={(event) => updateCustomRange('to', event.target.value)} />
        </div>
      )}
      <button className="icon-button" aria-label="下载经营数据" onClick={onDownload}><Download size={15} /></button>
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <div className="chart-legend" aria-hidden="true">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function BusinessTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <p key={item.dataKey}><i className={item.dataKey === 'profit' ? 'blue-dot' : 'purple-dot'} />{chartLabels[item.dataKey]}　{money(item.value)}</p>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <p key={item.dataKey}><i className={item.dataKey === 'cost' ? 'blue-dot' : 'purple-dot'} />{chartLabels[item.dataKey]}　{money(item.value)}</p>
      ))}
    </div>
  );
}

function ChartInsight({ children, tone }) {
  return <div className={`chart-insight ${tone}`}><Info size={14} />{children}</div>;
}

function AlertRow({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className={`alert-row ${tone}`}>
      <Icon size={20} />
      <div><strong>{label}</strong><span>{sub}</span></div>
      <b>{value}</b>
    </div>
  );
}

function ProductsPage({ products, exchangeRate, pushTemplate, onOpenWorkbench, onAddProduct, title }) {
  const [keyword, setKeyword] = useState('');
  const [saleFilter, setSaleFilter] = useState('全部');
  const [paidFilter, setPaidFilter] = useState('全部');
  const [settlementFilter, setSettlementFilter] = useState('全部');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pushState, setPushState] = useState({ productId: '', message: '' });

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const keywordText = [item.id, item.account, item.phone].join(' ').toLowerCase();
      const matchesKeyword = keywordText.includes(keyword.toLowerCase());
      const matchesSale = saleFilter === '全部' || (saleFilter === '待售' ? !item.isSold : item.isSold);
      const matchesPaid = paidFilter === '全部' || (paidFilter === '未回款' ? !item.isPaid : item.isPaid);
      const matchesSettlement = settlementFilter === '全部' || (settlementFilter === '未结算' ? shouldShowPendingSettlement(item) : item.settlementStatus === 'settled');
      const createdDate = productDateValue(item);
      const matchesDateFrom = !dateFrom || createdDate >= dateFrom;
      const matchesDateTo = !dateTo || createdDate <= dateTo;
      return matchesKeyword && matchesSale && matchesPaid && matchesSettlement && matchesDateFrom && matchesDateTo;
    });
  }, [products, keyword, saleFilter, paidFilter, settlementFilter, dateFrom, dateTo]);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const today = localDateInput();
  const soldProducts = products.filter((item) => item.isSold);
  const paidProducts = products.filter((item) => item.isPaid);
  const unsettledProducts = products.filter((item) => shouldShowPendingSettlement(item));
  const todayProducts = products.filter((item) => productDateValue(item) === today);
  const todaySold = products.filter((item) => item.isSold && String(item.saleTime || item.createdAt || '').slice(0, 10) === today);
  const todayPaid = todaySold.filter((item) => item.isPaid);
  const unsettledHongKongReceivable = unsettledProducts.reduce((sum, item) => sum + Math.max(settlementAmounts(item).hongKongReceivable, 0), 0);
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, saleFilter, paidFilter, settlementFilter, dateFrom, dateTo, pageSize]);
  const resetFilters = () => {
    setKeyword('');
    setSaleFilter('全部');
    setPaidFilter('全部');
    setSettlementFilter('全部');
    setDateFrom('');
    setDateTo('');
  };
  const pushProduct = async (product) => {
    setPushState({ productId: product.id, message: `正在推送 ${product.account || `#${product.id}`} 到 Telegram...` });
    try {
      await apiJson('/api/telegram/push', {
        method: 'POST',
        body: JSON.stringify({ message: buildProductPushMessage(product, pushTemplate) })
      });
      setPushState({ productId: '', message: `已推送 ${product.account || `#${product.id}`} 到 Telegram Bot。` });
    } catch (error) {
      setPushState({ productId: '', message: error.message || 'Telegram 推送失败，请稍后重试。' });
    }
  };

  return (
    <section className="page products-page">
      <div className="page-title"><h1>{title}</h1><span>产品列表、推送与结算入口</span></div>
      <div className="kpi-grid five compact">
        <Kpi icon={Box} label="产品总数" value={String(products.length)} tone="purple" />
        <Kpi icon={ShoppingCart} label="待售" value={String(products.length - soldProducts.length)} tone="blue" />
        <Kpi icon={CheckCircle2} label="已售" value={String(soldProducts.length)} tone="green" />
        <Kpi icon={CreditCard} label="已回款" value={String(paidProducts.length)} tone="purple" />
        <Kpi icon={Info} label="未结算" value={String(unsettledProducts.length)} tone="orange" />
      </div>
      <div className="list-layout">
        <Panel className="list-panel">
          <div className="filters">
            <label className="search-box"><Search size={17} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索 ID / 账号 / 手机号" /></label>
            <FilterSelect label="销售状态" value={saleFilter} onChange={setSaleFilter} options={['全部', '待售', '已售']} />
            <FilterSelect label="回款状态" value={paidFilter} onChange={setPaidFilter} options={['全部', '未回款', '已回款']} />
            <FilterSelect label="结算状态" value={settlementFilter} onChange={setSettlementFilter} options={['全部', '未结算', '已结算']} />
            <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <div className="filters-actions">
              <button className="secondary-button" onClick={resetFilters}>重置</button>
              <button className="primary-button" onClick={onAddProduct}><Plus size={16} /> 新增产品</button>
            </div>
          </div>
          {pushState.message && <div className="inline-notice product-list-notice"><Info size={15} />{pushState.message}</div>}
          {products.length === 0 ? (
            <EmptyState icon={Box} title="暂无产品" text="先新增产品，再录入账号资料、成本、销售与结算信息。" />
          ) : filteredProducts.length === 0 ? (
            <EmptyState icon={Search} title="没有匹配结果" text="换一个关键词，或清空销售、回款、结算筛选条件。" />
          ) : (
            <>
              <ProductTable products={paginatedProducts} onOpenWorkbench={onOpenWorkbench} onPushProduct={pushProduct} pushingId={pushState.productId} />
              <div className="pagination">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                  <option value={5}>5 条/页</option>
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                </select>
                <span>共 {filteredProducts.length} 条</span>
                <div className="pager">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                    <button key={page} className={page === currentPage ? 'active' : ''} onClick={() => setCurrentPage(page)}>{page}</button>
                  ))}
                  <button disabled={currentPage === pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}><ChevronRight size={16} /></button>
                </div>
              </div>
            </>
          )}
        </Panel>
        <aside className="right-board">
          <MiniMetric icon={Box} label="今日新增" value={String(todayProducts.length)} />
          <MiniMetric icon={ShoppingCart} label="今日已售" value={String(todaySold.length)} />
          <MiniMetric icon={CreditCard} label="今日回款" value={String(todayPaid.length)} />
          <MiniMetric icon={DollarSign} label="待结算香港" value={money(unsettledHongKongReceivable)} subValue={cny(usdToCny(unsettledHongKongReceivable, exchangeRate))} accent />
          <div className="hint-card"><Info size={18} />提示：点击 “工作台” 可进入单个产品的详细录入与结算页面</div>
        </aside>
      </div>
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DateRangeFilter({ from, to, onFromChange, onToChange }) {
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);
  return (
    <div className="date-filter">
      <span>上架时间</span>
      <div className="date-range" onClick={(event) => openRangePicker(event, fromInputRef.current, toInputRef.current)}>
        <button type="button" data-picker="from">
          <Calendar size={14} />
          <span>{compactDateLabel(from, '开始')}</span>
        </button>
        <b>~</b>
        <button type="button" data-picker="to">
          <Calendar size={14} />
          <span>{compactDateLabel(to, '结束')}</span>
        </button>
        <input ref={fromInputRef} aria-label="开始日期" type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} />
        <input ref={toInputRef} aria-label="结束日期" type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} />
      </div>
    </div>
  );
}

function ProductTable({ products, onOpenWorkbench, onPushProduct, pushingId }) {
  return (
    <table className="product-table">
      <thead>
        <tr>
          <th>ID</th><th>上架时间</th><th>账号</th><th>总成本 (USD)</th><th>售价 (USD)</th><th>利润 (USD)</th><th>销售状态</th><th>回款状态</th><th>结算状态</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        {products.map((item) => {
          const cost = sumCosts(item);
          const profit = productProfit(item);
          return (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{productDateValue(item)}</td>
              <td><CopyableAccountCell value={item.account || item.email} /></td>
              <td>{cost.toFixed(2)}</td>
              <td>{Number(item.salePrice || 0).toFixed(2)}</td>
              <td className="profit-text">{profit.toFixed(2)}</td>
              <td><StatusBadge label={item.isSold ? '已售' : '待售'} /></td>
              <td>{item.isSold ? <StatusBadge label={item.isPaid ? '已回款' : '未回款'} /> : '-'}</td>
              <td><StatusBadge label={settlementStatusLabel(item)} /></td>
              <td className="actions">
                <button onClick={() => onOpenWorkbench(item.id)}>工作台</button>
                <button disabled={pushingId === item.id} onClick={() => onPushProduct(item)}>{pushingId === item.id ? '推送中' : '推送'}</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PurchaseExchangeCard({ exchangeRate, unsettledUsd, onRateChange }) {
  const [usdAmount, setUsdAmount] = useState('');
  const [cnyAmount, setCnyAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const normalizedRate = normalizeExchangeRate(exchangeRate);

  const refreshRate = async () => {
    setLoading(true);
    setMessage('');
    try {
      const data = await apiJson(`/api/exchange-rate?t=${Date.now()}`);
      const nextRate = normalizeExchangeRate(data.rate);
      onRateChange(nextRate);
      setMessage(data.date ? `${data.source || exchangeRateSource} · ${data.date}` : data.source || exchangeRateSource);
      if (usdAmount !== '') {
        const number = Number(usdAmount);
        setCnyAmount(Number.isFinite(number) ? formatExchangeValue(number * nextRate) : '');
      } else if (cnyAmount !== '') {
        const number = Number(cnyAmount);
        setUsdAmount(Number.isFinite(number) ? formatExchangeValue(number / nextRate) : '');
      }
    } catch (error) {
      setMessage(error.message || '汇率刷新失败');
    } finally {
      setLoading(false);
    }
  };
  const updateUsdAmount = (value) => {
    setUsdAmount(value);
    const number = Number(value);
    setCnyAmount(value === '' || !Number.isFinite(number) ? '' : formatExchangeValue(number * normalizedRate));
  };
  const updateCnyAmount = (value) => {
    setCnyAmount(value);
    const number = Number(value);
    setUsdAmount(value === '' || !Number.isFinite(number) ? '' : formatExchangeValue(number / normalizedRate));
  };

  return (
    <div className="purchase-rate-card">
      <div className="purchase-rate-head">
        <span>USD/CNY 汇率</span>
        <button type="button" onClick={refreshRate} disabled={loading} aria-label="刷新 USD/CNY 汇率"><RefreshCw size={14} /></button>
      </div>
      <strong>{normalizedRate.toFixed(4)}</strong>
      <em>未结算约 {cny(usdToCny(unsettledUsd, normalizedRate))}</em>
      <div className="purchase-rate-inputs">
        <label><span>USD</span><input type="number" min="0" value={usdAmount} onChange={(event) => updateUsdAmount(event.target.value)} /></label>
        <label><span>CNY</span><input type="number" min="0" value={cnyAmount} onChange={(event) => updateCnyAmount(event.target.value)} /></label>
      </div>
      {message && <small>{message}</small>}
    </div>
  );
}

function PurchaseExpensesPage({ expenses, exchangeRate, loading, saving, onSaveExpense, onDeleteExpense }) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [fullView, setFullView] = useState(null);
  const [liveExchangeRate, setLiveExchangeRate] = useState(normalizeExchangeRate(exchangeRate));
  const normalizedExchangeRate = normalizeExchangeRate(liveExchangeRate);
  useEffect(() => {
    setLiveExchangeRate(normalizeExchangeRate(exchangeRate));
  }, [exchangeRate]);
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const keywordText = [item.itemName, item.quantityRemark, item.remark].join(' ').toLowerCase();
      const matchesKeyword = keywordText.includes(keyword.toLowerCase());
      const matchesStatus = statusFilter === '全部' || purchaseExpenseStatusLabel(item) === statusFilter;
      const purchaseDate = purchaseExpenseDateValue(item);
      const matchesDateFrom = !dateFrom || purchaseDate >= dateFrom;
      const matchesDateTo = !dateTo || purchaseDate <= dateTo;
      return matchesKeyword && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [expenses, keyword, statusFilter, dateFrom, dateTo]);
  const unsettledExpenses = expenses.filter((item) => item.settlementStatus !== 'settled');
  const settledExpenses = expenses.filter((item) => item.settlementStatus === 'settled');
  const unsettledUsd = unsettledExpenses.reduce((sum, item) => sum + Number(item.amountUsd || 0), 0);
  const unsettledCny = unsettledExpenses.reduce((sum, item) => sum + purchaseExpenseEstimatedCny(item, normalizedExchangeRate), 0);
  const settledCny = settledExpenses.reduce((sum, item) => sum + purchaseExpenseSettledCny(item, normalizedExchangeRate), 0);

  const startNewExpense = () => {
    setDraft(createBlankPurchaseExpense(exchangeRate));
    setNotice('');
  };
  const updateDraft = (patch) => {
    setDraft((current) => ({ ...(current || createBlankPurchaseExpense(exchangeRate)), ...patch }));
    setNotice('');
  };
  const saveDraft = async () => {
    if (!draft?.itemName?.trim()) {
      setNotice('请填写采购产品或事项名称。');
      return;
    }
    if (Number(draft.amountUsd || 0) <= 0) {
      setNotice('请填写大于 0 的 USD 支出金额。');
      return;
    }
    let payload = { ...draft };
    if (payload.settlementStatus === 'settled' && Number(payload.settlementAmountCny || 0) <= 0) {
      setNotice('正在获取最新汇率并结算...');
      let latestRate = normalizedExchangeRate;
      try {
        const data = await apiJson(`/api/exchange-rate?t=${Date.now()}`);
        latestRate = normalizeExchangeRate(data.rate);
        setLiveExchangeRate(latestRate);
      } catch {
        latestRate = normalizedExchangeRate;
      }
      payload = {
        ...payload,
        settlementExchangeRate: latestRate,
        settlementAmountCny: purchaseExpenseEstimatedCny(payload, latestRate),
        settledAt: payload.settledAt || new Date().toLocaleString('zh-CN', { hour12: false })
      };
    }
    const result = await onSaveExpense(payload);
    if (!result.ok) {
      setNotice(result.message || '保存失败，请稍后重试。');
      return;
    }
    setDraft(null);
    setNotice('代采购费用已保存。');
  };
  const editExpense = (expense) => {
    setDraft({ ...expense });
    setNotice('');
  };
  const markSettled = async (expense) => {
    setNotice('正在获取最新汇率并结算...');
    let latestRate = normalizedExchangeRate;
    try {
      const data = await apiJson(`/api/exchange-rate?t=${Date.now()}`);
      latestRate = normalizeExchangeRate(data.rate);
      setLiveExchangeRate(latestRate);
    } catch {
      latestRate = normalizedExchangeRate;
    }
    const result = await onSaveExpense({
      ...expense,
      settlementStatus: 'settled',
      settlementExchangeRate: latestRate,
      settlementAmountCny: purchaseExpenseEstimatedCny(expense, latestRate),
      settledAt: new Date().toLocaleString('zh-CN', { hour12: false })
    });
    setNotice(result.ok ? '已标记为已结算。' : result.message || '结算状态保存失败。');
  };
  const resetFilters = () => {
    setKeyword('');
    setStatusFilter('全部');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <section className="page purchase-expenses-page">
      <div className="page-title"><h1>代采购费用</h1><span>香港替武汉采购产生的独立往来款记录</span></div>
      <div className="purchase-summary-grid">
        <Kpi icon={DollarSign} label="未结算 USD" value={money(unsettledUsd)} tone="orange" />
        <PurchaseExchangeCard exchangeRate={normalizedExchangeRate} unsettledUsd={unsettledUsd} onRateChange={setLiveExchangeRate} />
        <Kpi icon={WalletCards} label="未结算 CNY" value={cny(unsettledCny)} tone="purple" />
        <Kpi icon={ShieldCheck} label="已结算 CNY" value={cny(settledCny)} tone="green" />
        <Kpi icon={ReceiptText} label="费用记录" value={`${expenses.length} 笔`} tone="blue" />
      </div>
      {notice && <div className="inline-notice purchase-notice"><Info size={15} />{notice}</div>}
      <div className="purchase-expenses-layout">
        <Panel
          className="purchase-expenses-list"
          title="费用明细"
          hint={loading ? '正在读取费用记录...' : '不计入产品利润和产品结算'}
          action={<button className="primary-button" type="button" onClick={startNewExpense}><Plus size={16} /> 新增费用</button>}
        >
          <div className="filters purchase-filters">
            <label className="search-box"><Search size={17} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索产品 / 数量 / 备注" /></label>
            <FilterSelect label="结算状态" value={statusFilter} onChange={setStatusFilter} options={['全部', '未结算', '已结算']} />
            <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <div className="filters-actions single">
              <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
            </div>
          </div>
          {!expenses.length ? (
            <EmptyState icon={ReceiptText} title="暂无代采购费用" text="新增费用后，武汉可在这里查看采购日期、USD 支出、实时人民币估算和结算状态。" />
          ) : !filteredExpenses.length ? (
            <EmptyState icon={Search} title="没有匹配结果" text="换一个关键词，或清空日期和结算状态筛选条件。" />
          ) : (
            <div className="purchase-table-wrap">
              <table className="product-table purchase-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>采购日期</th>
                    <th>采购产品/事项</th>
                    <th>数量</th>
                    <th>USD 支出</th>
                    <th>结算状态</th>
                    <th>结算时间</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{purchaseExpenseDateValue(item)}</td>
                      <td>{item.itemName}</td>
                      <td>{item.quantityRemark || '-'}</td>
                      <td>{money(item.amountUsd)}</td>
                      <td><StatusBadge label={purchaseExpenseStatusLabel(item)} /></td>
                      <td>{item.settledAt || '-'}</td>
                      <td>
                        {item.remark ? (
                          <button className="remark-toggle" type="button" onClick={() => setFullView({ label: `费用 #${item.id} 备注`, value: item.remark })}>
                            {item.remark.length > 5 ? `${item.remark.slice(0, 5)}...` : item.remark}
                          </button>
                        ) : '-'}
                      </td>
                      <td className="actions">
                        <button type="button" onClick={() => editExpense(item)}>编辑</button>
                        {item.settlementStatus !== 'settled' && <button type="button" onClick={() => markSettled(item)}>结清</button>}
                        <button type="button" onClick={() => onDeleteExpense(item)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel className="purchase-editor-panel" title={draft ? (String(draft.id).startsWith('draft-expense-') ? '新增费用' : `编辑费用 #${draft.id}`) : '录入区'} hint="结清时按最新汇率锁定 CNY 金额">
          {draft ? (
            <div className="purchase-editor">
              <Input label="采购日期" type="date" value={draft.purchaseDate} icon={Calendar} onChange={(value) => updateDraft({ purchaseDate: value })} />
              <Input label="采购产品/事项" value={draft.itemName} onChange={(value) => updateDraft({ itemName: value })} />
              <Input label="数量" value={draft.quantityRemark} onChange={(value) => updateDraft({ quantityRemark: value })} />
              <Input label="支出金额 USD" type="number" value={draft.amountUsd} onChange={(value) => updateDraft({ amountUsd: value })} />
              <label className="input-label">
                <span>结算状态</span>
                <select className="plain-select" value={draft.settlementStatus} onChange={(event) => updateDraft({
                  settlementStatus: event.target.value,
                  settledAt: event.target.value === 'settled' ? draft.settledAt || new Date().toLocaleString('zh-CN', { hour12: false }) : '',
                  settlementExchangeRate: event.target.value === 'settled' ? draft.settlementExchangeRate : null,
                  settlementAmountCny: event.target.value === 'settled' ? draft.settlementAmountCny : null
                })}>
                  <option value="unsettled">未结算</option>
                  <option value="settled">已结算</option>
                </select>
              </label>
              <Textarea label="备注" value={draft.remark} onChange={(value) => updateDraft({ remark: value })} />
              <div className="purchase-editor-actions">
                <button className="secondary-button" type="button" onClick={() => setDraft(null)}>取消</button>
                <button className="primary-button" type="button" disabled={saving} onClick={saveDraft}><Save size={16} />{saving ? '保存中...' : '保存费用'}</button>
              </div>
            </div>
          ) : (
            <div className="purchase-editor-empty">
              <ReceiptText size={30} />
              <strong>选择一条费用编辑，或新增一笔代采购记录。</strong>
              <span>未结算金额按实时汇率预估，结清时锁定当时汇率。</span>
            </div>
          )}
        </Panel>
      </div>
      {fullView && <FullValueModal label={fullView.label} value={fullView.value} onClose={() => setFullView(null)} />}
    </section>
  );
}

function AccountDetailsPage({ products, onSaveProduct, saving }) {
  const [activeId, setActiveId] = useState(products[0]?.id || '');
  const [detailDraft, setDetailDraft] = useState({ accountType: '', accountCountry: '', accountInfo: '' });
  const [notice, setNotice] = useState('');
  const activeProduct = products.find((item) => item.id === activeId) || products[0] || null;

  useEffect(() => {
    if (!products.length) {
      setActiveId('');
      return;
    }
    setActiveId((current) => products.some((item) => item.id === current) ? current : products[0].id);
  }, [products]);

  useEffect(() => {
    setDetailDraft({
      accountType: activeProduct?.accountType || '',
      accountCountry: activeProduct?.accountCountry || '',
      accountInfo: activeProduct?.accountInfoRaw || activeProduct?.accountInfoFormatted || ''
    });
    setNotice('');
  }, [activeProduct?.id]);

  const saveAccountPatch = async (product, patch, successMessage = '账号详情已保存。') => {
    if (!product) return;
    setNotice('');
    const result = await onSaveProduct({ ...product, ...patch });
    setNotice(result.ok ? successMessage : result.message || '保存失败，请稍后重试。');
  };

  const updateAccountType = (product, accountType) => {
    if (activeProduct?.id === product.id) {
      setDetailDraft((current) => ({ ...current, accountType }));
    }
    saveAccountPatch(product, { accountType }, '账号类型已同步。');
  };

  const saveAccountDetails = () => {
    if (!activeProduct) {
      setNotice('请先选择账号。');
      return;
    }
    saveAccountPatch(activeProduct, {
      accountType: detailDraft.accountType,
      accountCountry: detailDraft.accountCountry,
      accountInfoRaw: detailDraft.accountInfo,
      accountInfoFormatted: detailDraft.accountInfo
    });
  };

  return (
    <section className="page account-details-page">
      <div className="page-title"><h1>账号详情</h1><span>与产品基础信息同步的账号资料</span></div>
      {notice && <div className="inline-notice"><Info size={15} />{notice}</div>}
      <div className="account-details-grid">
        <Panel className="account-table-panel" title="账号资料" hint="新增产品会自动出现在这里">
          <div className="account-table-wrap">
            <table className="product-table account-detail-table">
              <thead>
                <tr>
                  <th>业务</th>
                  <th>上架时间</th>
                  <th>账号</th>
                  <th>创建时间</th>
                  <th>账号类型</th>
                  <th>国家</th>
                  <th>账号成本</th>
                  <th>账号信息</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className={activeProduct?.id === product.id ? 'selected-row' : ''} onClick={() => setActiveId(product.id)}>
                    <td>{businessTypeConfig(productBusinessType(product)).shortLabel}</td>
                    <td>{productDateValue(product)}</td>
                    <td><CopyableAccountCell value={product.account || product.email} /></td>
                    <td>{monthLabel(product.accountCreationDate) || '-'}</td>
                    <td>
                      <select
                        className="table-select"
                        value={product.accountType || ''}
                        disabled={saving}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => updateAccountType(product, event.target.value)}
                      >
                        <option value="">未选择</option>
                        <option value="enterprise">企业</option>
                        <option value="personal">个人</option>
                      </select>
                    </td>
                    <td>{product.accountCountry || '-'}</td>
                    <td>{money(accountCost(product))}</td>
                    <td className="account-info-cell">{product.accountInfoRaw || product.accountInfoFormatted || '-'}</td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={8}>暂无产品记录</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="account-edit-panel" title="账号信息" hint={activeProduct ? `当前账号：${activeProduct.account || activeProduct.email || `#${activeProduct.id}`}` : '请选择账号'}>
          <label className="input-label">
            <span>账号类型</span>
            <div className="input-shell">
              <select value={detailDraft.accountType} disabled={saving || !activeProduct} onChange={(event) => setDetailDraft({ ...detailDraft, accountType: event.target.value })}>
                <option value="">未选择</option>
                <option value="enterprise">企业</option>
                <option value="personal">个人</option>
              </select>
            </div>
          </label>
          <Input label="国家" value={detailDraft.accountCountry} disabled={saving || !activeProduct} onChange={(value) => setDetailDraft({ ...detailDraft, accountCountry: value })} />
          <textarea
            className="converter-input"
            value={detailDraft.accountInfo}
            disabled={saving || !activeProduct}
            onChange={(event) => setDetailDraft({ ...detailDraft, accountInfo: event.target.value })}
            placeholder="粘贴或修改账号信息"
          />
          <div className="converter-actions">
            <button className="secondary-button" type="button" disabled={!activeProduct} onClick={() => setDetailDraft({
              accountType: activeProduct?.accountType || '',
              accountCountry: activeProduct?.accountCountry || '',
              accountInfo: activeProduct?.accountInfoRaw || activeProduct?.accountInfoFormatted || ''
            })}>恢复当前账号信息</button>
            <button className="primary-button" type="button" disabled={saving || !activeProduct} onClick={saveAccountDetails}>
              <Save size={16} />{saving ? '保存中...' : '保存账号信息'}
            </button>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function CopyableAccountCell({ value }) {
  const [copied, setCopied] = useState(false);
  const text = String(value || '');
  const copyAccount = async () => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="copyable-account" title="双击复制邮箱" onDoubleClick={copyAccount}>
      <span>{text}</span>
      {copied && <em>已复制</em>}
    </span>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Workbench({ product, user, onSave, onSettle, saving }) {
  const [draft, setDraft] = useState(product);
  const [dirty, setDirty] = useState(false);
  const [visible, setVisible] = useState({});
  const [costDraft, setCostDraft] = useState({ label: '', amount: '', owner: costOwners.hongKong, remark: '' });
  const [showCostForm, setShowCostForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [settlementNotice, setSettlementNotice] = useState('');
  const [settling, setSettling] = useState(false);
  const [fullView, setFullView] = useState(null);
  const [authenticatorCode, setAuthenticatorCode] = useState({ code: '', seconds: 0, message: '' });
  const settlement = settlementAmounts(draft);
  const canEditCredentials = user?.role === 'super_admin';
  const isNewProduct = String(draft.id).startsWith('draft-');
  const business = businessTypeConfig(productBusinessType(draft));
  const isAppleDeveloper = business.id === 'appleDeveloper';
  const googleDeveloperAccess = normalizeGoogleDeveloperAccess(draft);

  useEffect(() => {
    setDraft(product);
    setDirty(false);
    setNotice('');
    setSettlementNotice('');
    setAuthenticatorCode({ code: '', seconds: 0, message: '' });
    setCostDraft({ label: '', amount: '', owner: costOwners.hongKong, remark: '' });
    setShowCostForm(false);
  }, [product?.id]);

  useEffect(() => {
    if (!authenticatorCode.code) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const code = await generateTotpCode(draft.googleAuth);
        setAuthenticatorCode((current) => current.code ? ({
          ...current,
          code,
          seconds: 30 - (Math.floor(Date.now() / 1000) % 30),
          message: ''
        }) : current);
      } catch (error) {
        setAuthenticatorCode({ code: '', seconds: 0, message: error.message || '验证码生成失败，请检查密钥。' });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authenticatorCode.code, draft.googleAuth]);

  const commitChange = (patch) => {
    try {
      setDraft((current) => ({
        ...current,
        ...patch,
        updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
      }));
      setDirty(true);
      return true;
    } catch {
      setNotice('草稿更新失败，请稍后重试。');
      return false;
    }
  };
  const updateField = (field, value) => {
    setNotice('');
    setSettlementNotice('');
    commitChange({ [field]: value });
  };
  const updateSaleStatus = (checked) => {
    if (checked && settlement.totalCost <= 0) {
      setNotice('请先填写成本后再标记售出，避免利润和分成被误算。');
      setSettlementNotice('请先填写成本后再进入结算。');
      return;
    }
    setSettlementNotice('');
    commitChange({
      isSold: checked,
      saleTime: checked && !draft.saleTime ? fromDateTimeInputValue(localDateTimeInput()) : draft.saleTime
    });
  };
  const updatePaidStatus = (checked) => {
    if (checked && !draft.isSold) {
      setNotice('请先标记售出，再登记回款。');
      setSettlementNotice('请先标记售出，再登记回款。');
      return;
    }
    updateField('isPaid', checked);
  };
  const updateCost = (id, amount) => {
    setNotice('');
    setSettlementNotice('');
    commitChange({ costs: draft.costs.map((item) => item.id === id ? { ...item, amount: amount === '' ? '' : Number(amount) } : item) });
  };
  const updateCostOwner = (id, owner) => {
    setNotice('');
    setSettlementNotice('');
    commitChange({ costs: draft.costs.map((item) => item.id === id ? { ...item, owner: normalizeCostOwner(owner) } : item) });
  };
  const updateGoogleDeveloperAccess = (patch) => {
    setNotice('');
    setSettlementNotice('');
    const currentAccess = normalizeGoogleDeveloperAccess(draft);
    const nextAccess = {
      ...currentAccess,
      ...patch,
      updatedAt: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    commitChange({ googleDeveloperAccess: nextAccess });
  };
  const syncGoogleDeveloperInfo = () => {
    updateGoogleDeveloperAccess({
      enabled: true,
      syncBasicInfo: true,
      info: createBlankGoogleDeveloperInfo(draft),
      updatedBy: user?.username || ''
    });
    setNotice('已同步基础信息到 Google Developer 英文页面。保存产品后对方即可看到。');
  };
  const removeGoogleDeveloperAccess = () => {
    const confirmed = window.confirm('确定删除该产品的 Google Developer 权限吗？删除后对方后台将看不到这条商品信息。');
    if (!confirmed) return;
    updateGoogleDeveloperAccess({
      enabled: false,
      syncBasicInfo: false,
      assignedTo: '',
      updatedBy: user?.username || ''
    });
    setNotice('已删除该产品的 Google Developer 权限。保存产品后对方后台将不再显示这条商品。');
  };
  const addCost = () => {
    if (!costDraft.label || !costDraft.amount) return;
    const saved = commitChange({
      costs: [
        ...draft.costs,
        { id: Date.now(), label: costDraft.label, amount: Number(costDraft.amount), owner: normalizeCostOwner(costDraft.owner), remark: costDraft.remark }
      ]
    });
    if (!saved) return;
    setCostDraft({ label: '', amount: '', owner: costOwners.hongKong, remark: '' });
    setShowCostForm(false);
  };
  const settleProduct = async (rateSnapshot = {}) => {
    if (settlement.totalCost <= 0) {
      setNotice('请先填写成本后再结算。');
      setSettlementNotice('请先填写成本后再结算。');
      return;
    }
    if (!draft.isPaid) {
      setNotice('未回款产品暂不允许结算，请先确认回款状态。');
      setSettlementNotice('未回款产品暂不允许结算，请先确认回款状态。');
      return;
    }
    setSettling(true);
    setSettlementNotice('正在保存结算状态...');
    const nextDraft = {
      ...draft,
      settlementStatus: 'settled',
      ...settlementCnySnapshot(settlement, rateSnapshot.rate),
      settledAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
    };
    try {
      const settlementPatch = {
        settlementStatus: nextDraft.settlementStatus,
        settlementExchangeRate: nextDraft.settlementExchangeRate,
        settlementShareCnyHongKong: nextDraft.settlementShareCnyHongKong,
        settlementShareCnyWuhan: nextDraft.settlementShareCnyWuhan,
        settlementHongKongCostUsd: nextDraft.settlementHongKongCostUsd,
        settlementWuhanCostUsd: nextDraft.settlementWuhanCostUsd,
        settlementProfitUsd: nextDraft.settlementProfitUsd,
        settlementHongKongReceivableUsd: nextDraft.settlementHongKongReceivableUsd,
        settlementWuhanRetainedUsd: nextDraft.settlementWuhanRetainedUsd,
        settlementHongKongReceivableCny: nextDraft.settlementHongKongReceivableCny,
        settlementWuhanRetainedCny: nextDraft.settlementWuhanRetainedCny,
        settledAt: nextDraft.settledAt,
        updatedAt: nextDraft.updatedAt
      };
      const result = await promiseWithTimeout(
        onSettle(draft, settlementPatch),
        15000,
        '结算保存超时，请刷新后确认状态，或稍后重试。'
      );
      if (result.ok) {
        setDraft(result.product);
        setDirty(false);
        setNotice('已保存结算状态，应结算香港与武汉留存金额已按本次汇率锁定。');
        setSettlementNotice('已保存结算状态。');
      } else {
        const message = result.message || '结算状态保存失败，请稍后重试。';
        setNotice(message);
        setSettlementNotice(message);
      }
    } catch (error) {
      const message = error.message || '结算状态保存失败，请稍后重试。';
      setNotice(message);
      setSettlementNotice(message);
    } finally {
      setSettling(false);
    }
  };
  const openFullValue = (label, value) => {
    setFullView({ label, value: String(value || '') });
  };
  const showAuthenticatorCode = async () => {
    try {
      const code = await generateTotpCode(draft.googleAuth);
      setAuthenticatorCode({
        code,
        seconds: 30 - (Math.floor(Date.now() / 1000) % 30),
        message: ''
      });
      await navigator.clipboard?.writeText(code);
    } catch (error) {
      setAuthenticatorCode({ code: '', seconds: 0, message: error.message || '验证码生成失败，请检查密钥。' });
    }
  };
  const saveDraft = async () => {
    setNotice('');
    const result = await onSave(draft);
    if (!result.ok) {
      setNotice(result.message || '保存失败，请稍后重试。');
      return;
    }
    setDraft(result.product);
    setDirty(false);
    setNotice('已保存，产品列表和工作台数据已同步。');
  };

  return (
    <section className="page workbench-page">
      <div className="workbench-toolbar">
        <div>
          <strong>{isNewProduct ? `新增${business.label}草稿` : `${business.label} #${draft.id}`}</strong>
          <span>{dirty ? '有未保存改动' : '已保存'}</span>
        </div>
        <button className="primary-button" type="button" disabled={saving || (!dirty && !isNewProduct)} onClick={saveDraft}>
          <Save size={16} />{saving ? '保存中...' : isNewProduct ? '保存产品' : '保存修改'}
        </button>
      </div>
      <div className="workbench-grid">
        <div className="workbench-main">
          {notice && <div className="inline-notice"><Info size={15} />{notice}</div>}
          <Section
            title="基础信息"
            icon={FileText}
            subtitle="填写产品基础信息，为后续流程提供准备"
          >
            {!canEditCredentials && <div className="permission-note"><Lock size={15} /> 合作伙伴可查看全部资料，但账号密码、恢复邮箱密码、谷歌验证器、备份码等敏感凭据仅超级管理员可修改。</div>}
            <div className="form-grid">
              <Input label="上架时间" type="date" value={productDateValue(draft) || localDateInput()} icon={Calendar} onChange={(value) => updateField('createdAt', value)} />
              <Input label="账号" value={draft.account} copyable onOpenFull={openFullValue} onChange={(value) => updateField('account', value)} />
              <SecretInput readOnly={!canEditCredentials} label="密码" value={draft.password} visible={visible.password} onToggle={() => setVisible({ ...visible, password: !visible.password })} onChange={(value) => updateField('password', value)} onOpenFull={openFullValue} />
              <Input label="恢复邮箱账号" value={draft.email} copyable onOpenFull={openFullValue} onChange={(value) => updateField('email', value)} />
              <SecretInput readOnly={!canEditCredentials} label="恢复邮箱密码" value={draft.recoveryEmailPassword} visible={visible.recoveryEmailPassword} onToggle={() => setVisible({ ...visible, recoveryEmailPassword: !visible.recoveryEmailPassword })} onChange={(value) => updateField('recoveryEmailPassword', value)} onOpenFull={openFullValue} />
              <PhoneInput product={draft} copyable onChange={(patch) => commitChange(patch)} />
              {isAppleDeveloper && <Input label="接码链接" value={draft.smsLink} wide copyable onOpenFull={openFullValue} onChange={(value) => updateField('smsLink', value)} />}
              {!isAppleDeveloper && <SecretInput readOnly={!canEditCredentials} label="谷歌验证器" value={draft.googleAuth} visible={visible.googleAuth} onToggle={() => setVisible({ ...visible, googleAuth: !visible.googleAuth })} onChange={(value) => updateField('googleAuth', value)} actionLabel={authenticatorCode.code ? `${authenticatorCode.code} · ${authenticatorCode.seconds}s` : '6位码'} onAction={showAuthenticatorCode} actionDisabled={!draft.googleAuth} actionTitle="生成并复制当前6位验证码" />}
              {!isAppleDeveloper && authenticatorCode.message && <div className="field-note">{authenticatorCode.message}</div>}
              {!isAppleDeveloper && <SecretInput readOnly={!canEditCredentials} label="备份码" value={draft.securityCode} visible={visible.securityCode} onToggle={() => setVisible({ ...visible, securityCode: !visible.securityCode })} onChange={(value) => updateField('securityCode', value)} />}
              {!isAppleDeveloper && <Input label="手机接码" value={draft.phoneSmsCode} copyable onOpenFull={openFullValue} onChange={(value) => updateField('phoneSmsCode', value)} />}
              {!isAppleDeveloper && <Input label="VPS 远程链接" value={draft.vpsRemoteUrl} wide copyable onOpenFull={openFullValue} onChange={(value) => updateField('vpsRemoteUrl', value)} />}
              <label className="input-label">
                <span>账号类型</span>
                <div className="input-shell">
                  <select value={draft.accountType || ''} onChange={(event) => updateField('accountType', event.target.value)}>
                    <option value="">未选择</option>
                    <option value="enterprise">企业</option>
                    <option value="personal">个人</option>
                  </select>
                </div>
              </label>
              <Input label="国家" value={draft.accountCountry} onChange={(value) => updateField('accountCountry', value)} />
              <Textarea label="备注" value={draft.remark} copyable onOpenFull={openFullValue} onChange={(value) => updateField('remark', value)} />
            </div>
          </Section>

          {canEditCredentials && !isAppleDeveloper && (
            <Section title="Google Developer Access" icon={ShieldCheck} subtitle="Control the English basic information page for the overseas buyer">
              <div className="google-access-box">
                <label className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={googleDeveloperAccess.enabled}
                    onChange={(event) => updateGoogleDeveloperAccess({ enabled: event.target.checked })}
                  />
                  <span>Allow Google Developer to view this product</span>
                </label>
                <label className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={googleDeveloperAccess.syncBasicInfo}
                    onChange={(event) => updateGoogleDeveloperAccess({ syncBasicInfo: event.target.checked })}
                  />
                  <span>Sync Basic Information</span>
                </label>
                <Input
                  label="Assign To"
                  value={googleDeveloperAccess.assignedTo}
                  onChange={(value) => updateGoogleDeveloperAccess({ assignedTo: value })}
                />
                <button className="secondary-button" type="button" onClick={syncGoogleDeveloperInfo}>
                  <RefreshCw size={15} /> Sync current basic info
                </button>
                <button
                  className="danger-button google-access-remove"
                  type="button"
                  disabled={!googleDeveloperAccess.enabled}
                  onClick={removeGoogleDeveloperAccess}
                >
                  <Trash2 size={14} /> Remove access
                </button>
              </div>
              <div className="support-note"><Info size={15} /> This only exposes the English Basic Information area. Costs, sales, settlement, passwords and internal Chinese data stay hidden.</div>
            </Section>
          )}

          <Section title="成本录入" icon={Coins} subtitle="录入各项成本，系统将自动计算总成本（USD）">
            <div className="cost-row">
              {draft.costs.map((item) => (
                <label className="cost-input" key={item.id}>
                  <span>{item.label}（USD）</span>
                  <input type="number" value={item.amount ?? ''} onChange={(event) => updateCost(item.id, event.target.value)} />
                  <select value={normalizeCostOwner(item.owner)} onChange={(event) => updateCostOwner(item.id, event.target.value)} aria-label={`${item.label}成本归属`}>
                    <option value={costOwners.hongKong}>香港承担</option>
                    <option value={costOwners.wuhan}>武汉承担</option>
                  </select>
                </label>
              ))}
              <button className="add-cost" onClick={() => setShowCostForm(true)}><Plus size={26} /><strong>添加成本标签</strong><span>支持自定义成本类别</span></button>
              <div className="total-cost"><span>总成本（USD）</span><strong>{money(settlement.totalCost)}</strong></div>
            </div>
            {showCostForm && (
              <div className="cost-popover">
                <button className="close" type="button" aria-label="关闭成本表单" onClick={() => setShowCostForm(false)}><X size={16} /></button>
                <Input label="成本名称" value={costDraft.label} onChange={(value) => setCostDraft({ ...costDraft, label: value })} />
                <Input label="金额 USD" type="number" value={costDraft.amount} onChange={(value) => setCostDraft({ ...costDraft, amount: value })} />
                <label className="input-label">
                  <span>成本归属</span>
                  <select className="plain-select" value={costDraft.owner} onChange={(event) => setCostDraft({ ...costDraft, owner: event.target.value })}>
                    <option value={costOwners.hongKong}>香港承担</option>
                    <option value={costOwners.wuhan}>武汉承担</option>
                  </select>
                </label>
                <Input label="备注" value={costDraft.remark} onChange={(value) => setCostDraft({ ...costDraft, remark: value })} />
                <button className="primary-button" type="button" onClick={addCost}>保存</button>
              </div>
            )}
            <div className="support-note"><Info size={15} /> 成本可选择香港或武汉承担；历史未标记成本默认按香港承担计算。</div>
          </Section>

          <Section title="销售登记" icon={LineChart} subtitle="登记销售信息与收款">
            <div className="sale-grid">
              <Input label="售价（USD）" type="number" value={draft.salePrice} onChange={(value) => updateField('salePrice', Number(value))} />
              <Input label="销售时间" type="datetime-local" value={toDateTimeInputValue(draft.saleTime)} onChange={(value) => updateField('saleTime', fromDateTimeInputValue(value))} />
              <Toggle label="是否售出" checked={draft.isSold} onChange={updateSaleStatus} />
              <Toggle label="是否回款" checked={draft.isPaid} onChange={updatePaidStatus} />
              <Textarea label="备注" value={draft.saleRemark || ''} copyable onOpenFull={openFullValue} onChange={(value) => updateField('saleRemark', value)} />
            </div>
          </Section>

          <Section title="自动结算" icon={ShieldCheck} subtitle="系统自动计算双方成本回收与利润五五分">
            <div className="settlement-cards">
              <MiniSettle label="销售收入（USD）" value={money(settlement.salePrice)} />
              <MiniSettle label="香港成本（USD）" value={money(settlement.hongKongCost)} />
              <MiniSettle label="武汉成本（USD）" value={money(settlement.wuhanCost)} />
              <MiniSettle label="可分配利润（USD）" value={money(settlement.profit)} green />
              <MiniSettle label="香港利润 50%" value={money(settlement.hongKongProfitShare)} />
              <MiniSettle label="武汉利润 50%" value={money(settlement.wuhanProfitShare)} />
              <MiniSettle label="武汉留存金额" value={money(settlement.wuhanRetained)} />
              <MiniSettle label="应结算香港金额" value={money(settlement.hongKongReceivable)} green />
            </div>
          </Section>
        </div>
        <ProfitPreview product={draft} settlement={settlement} onSettle={settleProduct} settling={settling} settlementNotice={settlementNotice} />
      </div>
      {fullView && <FullValueModal label={fullView.label} value={fullView.value} onClose={() => setFullView(null)} />}
    </section>
  );
}

function ProfitPreview({ product, settlement, onSettle, settling, settlementNotice }) {
  const [exchangeRate, setExchangeRate] = useState(defaultExchangeRate);
  const [rateMeta, setRateMeta] = useState({ date: '', source: exchangeRateSource });
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [cnyAmount, setCnyAmount] = useState('');
  const rateAvailable = Number.isFinite(exchangeRate) && exchangeRate > 0;
  const isSettled = product.settlementStatus === 'settled';
  const settlementSnapshot = productSettlementSnapshot(product, settlement);
  const displayRate = isSettled && settlementSnapshot ? settlementSnapshot.rate : exchangeRate;
  const displayHongKongCny = isSettled && settlementSnapshot ? settlementSnapshot.hongKong : settlement.hongKongReceivable * exchangeRate;
  const displayWuhanCny = isSettled && settlementSnapshot ? settlementSnapshot.wuhan : settlement.wuhanRetained * exchangeRate;

  const loadExchangeRate = async (manual = false) => {
    setRateLoading(true);
    setRateError('');
    try {
      const data = await apiJson(`/api/exchange-rate${manual ? `?t=${Date.now()}` : ''}`);
      const nextRate = normalizeExchangeRate(data.rate);
      setExchangeRate(nextRate);
      setRateMeta({ date: data.date || '', source: data.source || exchangeRateSource });
      if (usdAmount !== '') {
        const number = Number(usdAmount);
        setCnyAmount(Number.isFinite(number) ? formatExchangeValue(number * nextRate) : '');
      } else if (cnyAmount !== '') {
        const number = Number(cnyAmount);
        setUsdAmount(Number.isFinite(number) ? formatExchangeValue(number / nextRate) : '');
      }
    } catch (error) {
      setRateError(error.message || '汇率获取失败，已使用默认汇率。');
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    loadExchangeRate(false);
  }, [product.id]);

  const updateUsdAmount = (value) => {
    setUsdAmount(value);
    const number = Number(value);
    setCnyAmount(value === '' || !Number.isFinite(number) ? '' : formatExchangeValue(number * exchangeRate));
  };

  const updateCnyAmount = (value) => {
    setCnyAmount(value);
    const number = Number(value);
    setUsdAmount(value === '' || !Number.isFinite(number) ? '' : formatExchangeValue(number / exchangeRate));
  };

  return (
    <aside className="profit-preview">
      <Panel title="实时利润预览">
        <PreviewLine icon={Database} label="销售收入（USD）" value={money(settlement.salePrice)} />
        <PreviewLine icon={Box} label="香港成本（USD）" value={money(settlement.hongKongCost)} />
        <PreviewLine icon={Box} label="武汉成本（USD）" value={money(settlement.wuhanCost)} />
        <PreviewLine icon={DollarSign} label="可分配利润（USD）" value={money(settlement.profit)} green />
        <PreviewLine icon={ShieldCheck} label="香港利润分成（50%）" value={money(settlement.hongKongProfitShare)} />
        <PreviewLine icon={WalletCards} label="武汉利润分成（50%）" value={money(settlement.wuhanProfitShare)} />
        <PreviewLine icon={WalletCards} label="武汉留存金额" value={money(settlement.wuhanRetained)} />
        <PreviewLine icon={Send} label="应结算香港金额" value={money(settlement.hongKongReceivable)} green />
      </Panel>
      <Panel className="rate-card">
        <div className="rate-title">
          <span>USD / CNY 换算</span>
          <button className="rate-refresh" type="button" onClick={() => loadExchangeRate(true)} disabled={rateLoading} aria-label="刷新 USD/CNY 汇率">
            <RefreshCw size={14} />
          </button>
        </div>
        {rateAvailable ? (
          <>
            <p>1 USD = {exchangeRate.toFixed(2)} CNY <b>{exchangeRate.toFixed(2)} <span>CNY</span></b></p>
            <div className="rate-meta">{rateLoading ? '正在刷新汇率...' : `${rateMeta.source}${rateMeta.date ? ` · ${rateMeta.date}` : ''}`}</div>
            <div className="exchange-converter">
              <label>
                <span>USD</span>
                <input type="number" min="0" value={usdAmount} onChange={(event) => updateUsdAmount(event.target.value)} placeholder="输入 USD" />
              </label>
              <label>
                <span>CNY</span>
                <input type="number" min="0" value={cnyAmount} onChange={(event) => updateCnyAmount(event.target.value)} placeholder="输入 CNY" />
              </label>
            </div>
          </>
        ) : (
          <div className="rate-error"><AlertTriangle size={15} />汇率获取失败，CNY 换算暂不可用。</div>
        )}
        {rateError && <div className="rate-warning"><AlertTriangle size={14} />{rateError}</div>}
      </Panel>
      <Panel className="rmb-card">
        <div className="currency-note">
          {product.isSold
            ? (isSettled
              ? `已结算金额按结算时汇率 ${displayRate.toFixed(4)} 锁定；上方换算器可继续查看当前汇率。`
              : '未结算时按进入页面/手动刷新得到的最新汇率实时折合，结算后会锁定本次 CNY 金额。')
            : '待售产品仅作利润预览，不进入待结算展示。'}
        </div>
        <PreviewLine icon={Send} label={product.isSold ? (isSettled ? '应结算香港 CNY' : '应结算香港折合 CNY') : '待售香港折合 CNY'} value={rateAvailable ? cny(displayHongKongCny) : '-'} />
        <PreviewLine icon={WalletCards} label={product.isSold ? (isSettled ? '武汉留存 CNY' : '武汉留存折合 CNY') : '待售武汉折合 CNY'} value={rateAvailable ? cny(displayWuhanCny) : '-'} />
      </Panel>
      <Panel className="settlement-status">
        <div className="status-head"><strong>结算状态</strong><StatusBadge label={product.isSold ? (product.settlementStatus === 'settled' ? '已结算' : '未结算') : '待售'} /></div>
        <p>武汉回款后，保留武汉成本与利润，其余结算给香港。</p>
        <div className="check-list"><span className={settlement.totalCost > 0 ? 'ok' : 'bad'}></span>{settlement.totalCost > 0 ? '已录入：成本信息' : '待处理：未填写成本'}</div>
        <div className="check-list"><span className={product.isSold ? 'ok' : 'bad'}></span>{product.isSold ? '已确认：产品已售' : '待处理：售出后进入结算流程'}</div>
        <div className="check-list"><span className={product.isPaid ? 'ok' : 'bad'}></span>{product.isPaid ? '已确认：回款完成' : '待处理：未回款不允许结算'}</div>
        <div className="check-list"><span className={product.isSold && product.settlementStatus === 'settled' ? 'ok' : 'bad'}></span>{product.isSold ? (product.settlementStatus === 'settled' ? `已结算：${product.settledAt} Admin` : '未结算：尚未完成结算') : '待售：售出后才会进入待结算'}</div>
        {settlementNotice && <div className="settlement-notice"><Info size={14} />{settlementNotice}</div>}
        {product.isSold && product.settlementStatus !== 'settled' && (
          <button
            className="primary-button full"
            type="button"
            disabled={settling}
            onClick={() => onSettle({ rate: exchangeRate })}
          >
            {settling ? '结算中...' : '标记为已结算'}
          </button>
        )}
      </Panel>
      <div className="calc-note">{isSettled ? '已结算 CNY 金额保持不变' : (product.isSold ? '实时计算，自动更新' : '待售时仅作预览，不参与结算')}</div>
    </aside>
  );
}

function Section({ title, subtitle, icon: Icon, action, children }) {
  return (
    <section className="form-section">
      <div className="section-title"><Icon size={18} /><strong>{title}</strong><span>{subtitle}</span>{action && <div className="section-action">{action}</div>}</div>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, icon: Icon, wide, type = 'text', disabled = false, copyable = false, onOpenFull }) {
  const text = String(value ?? '');
  const inputRef = useRef(null);
  const opensNativePicker = ['date', 'datetime-local', 'time', 'month', 'week'].includes(type);
  return (
    <label className={`input-label ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <div
        className={`input-shell ${opensNativePicker ? 'date-input' : ''}`}
        onClick={(event) => {
          if (opensNativePicker && !event.target?.closest?.('button')) {
            openNativePicker(inputRef.current);
          }
        }}
        onDoubleClick={() => onOpenFull?.(label, text)}
        title="双击查看完整内容"
      >
        <input ref={inputRef} disabled={disabled} type={type} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
        {Icon && <Icon size={15} />}
        {copyable && <CopyFieldButton value={text} disabled={disabled} />}
      </div>
    </label>
  );
}

function SecretInput({ label, value, visible, onToggle, onChange, disabled = false, readOnly = false, onOpenFull, actionLabel, onAction, actionDisabled = false, actionTitle }) {
  const canReveal = !disabled;
  const text = String(value || '');
  return (
    <label className="input-label">
      <span>{label}</span>
      <div className="input-shell" onDoubleClick={() => canReveal && onOpenFull?.(label, text)} title="双击查看完整内容">
        <input readOnly={readOnly} disabled={disabled} type={visible && canReveal ? 'text' : 'password'} value={disabled ? '********' : (value || '')} onChange={(event) => !readOnly && onChange(event.target.value)} />
        {actionLabel && <button className="input-text-button" disabled={!canReveal || actionDisabled} type="button" title={actionTitle} onClick={(event) => { event.stopPropagation(); onAction?.(); }}>{actionLabel}</button>}
        <button disabled={!canReveal} type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        <CopyFieldButton value={text} disabled={!canReveal} />
      </div>
    </label>
  );
}

function PhoneInput({ product, onChange, disabled = false, copyable = false }) {
  const text = formatPhoneNumber(product.phoneCode, product.phone);
  return (
    <label className="input-label">
      <span>恢复手机号</span>
      <div className="phone-shell">
        <select disabled={disabled} value={product.phoneCode} onChange={(event) => onChange({ phoneCode: event.target.value })}>
          <option>+86</option><option>+852</option><option>+1</option><option>+44</option>
        </select>
        <input disabled={disabled} value={product.phone} onChange={(event) => onChange({ phone: event.target.value })} />
        {copyable && <CopyFieldButton value={text} disabled={disabled} />}
      </div>
    </label>
  );
}

function Textarea({ label, value, onChange, disabled = false, copyable = false, onOpenFull, placeholder = '请输入备注信息（可选）' }) {
  const text = String(value || '');
  return (
    <label className="input-label wide">
      <span>{label}</span>
      <div className="textarea-shell" onDoubleClick={() => onOpenFull?.(label, text)} title="双击查看完整内容">
        <textarea disabled={disabled} value={value || ''} maxLength={500} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        <em>{(value || '').length} / 500</em>
        {copyable && <CopyFieldButton value={text} disabled={disabled} />}
      </div>
    </label>
  );
}

function CopyFieldButton({ value, disabled = false }) {
  const [copied, setCopied] = useState(false);
  const copyValue = async (event) => {
    event.stopPropagation();
    if (disabled) return;
    try {
      await navigator.clipboard?.writeText(value || '');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button className="copy-field-button" disabled={disabled} type="button" onClick={copyValue} aria-label="复制">
      <Copy size={15} />
      {copied && <em className="copy-feedback">已复制</em>}
    </button>
  );
}

function FullValueModal({ label, value, onClose }) {
  return (
    <div className="value-modal-backdrop" onClick={onClose}>
      <section className="value-modal" onClick={(event) => event.stopPropagation()}>
        <div className="value-modal-head">
          <strong>{label}</strong>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <textarea readOnly value={value || '暂无内容'} />
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle-label">
      <span>{label}</span>
      <button className={`toggle ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)} type="button"><i /></button>
    </label>
  );
}

function MiniSettle({ label, value, green }) {
  return <div className="mini-settle"><span>{label}</span><strong className={green ? 'profit-text' : ''}>{value}</strong></div>;
}

function PreviewLine({ icon: Icon, label, value, green }) {
  return (
    <div className="preview-line"><i><Icon size={16} /></i><span>{label}</span><strong className={green ? 'profit-text' : ''}>{value}</strong></div>
  );
}

function MiniMetric({ icon: Icon, label, value, subValue, accent }) {
  return <div className="mini-metric"><Icon size={20} /><span>{label}</span><strong className={accent ? 'orange-text' : ''}>{value}</strong>{subValue && <em className="amount-subvalue">{subValue}</em>}</div>;
}

function StatusBadge({ label }) {
  return <span className={`status-badge ${statusClass(label)}`}>{label}</span>;
}

function Panel({ title, hint, action, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <div className="panel-head"><div>{title && <h2>{title}</h2>}{hint && <p>{hint}</p>}</div>{action}</div>}
      {children}
    </section>
  );
}

function PushSettingsPage({ products, templates, onChange }) {
  const [activeId, setActiveId] = useState(templates[0]?.id || defaultPushTemplates[0].id);
  const activeTemplate = templates.find((item) => item.id === activeId) || templates[0] || defaultPushTemplates[0];
  const activeBusiness = businessTypeConfig(activeTemplate.scene);
  const activePushFields = pushOptionsForType(activeBusiness.id);
  const previewProduct = products.find((item) => productBusinessType(item) === activeBusiness.id) || createBlankProduct(activeBusiness.id);
  const previewMessage = buildProductPushMessage(previewProduct, activeTemplate);

  useEffect(() => {
    if (!templates.some((item) => item.id === activeId)) {
      setActiveId(templates[0]?.id || defaultPushTemplates[0].id);
    }
  }, [templates, activeId]);

  const updateTemplate = (patch) => {
    onChange((current) => current.map((item) => item.id === activeTemplate.id ? { ...item, ...patch } : item));
  };
  const addTemplate = () => {
    const scene = businessTypes[0].id;
    const fields = defaultPushFieldsForType(scene);
    const nextTemplate = {
      id: `push-${Date.now()}`,
      name: `新的${businessTypeConfig(scene).label}推送`,
      scene,
      fields,
      format: createPushFormat(fields, scene),
      active: false
    };
    onChange((current) => [...current, nextTemplate]);
    setActiveId(nextTemplate.id);
  };
  const deleteTemplate = () => {
    if (templates.length <= 1) return;
    const confirmed = window.confirm(`确定删除推送类型「${activeTemplate.name}」吗？`);
    if (!confirmed) return;
    onChange((current) => current.filter((item) => item.id !== activeTemplate.id));
  };
  const setActiveForScene = () => {
    onChange((current) => current.map((item) => (
      item.scene === activeTemplate.scene ? { ...item, active: item.id === activeTemplate.id } : item
    )));
  };
  const toggleField = (fieldKey) => {
    const exists = activeTemplate.fields.includes(fieldKey);
    const fields = exists
      ? activeTemplate.fields.filter((item) => item !== fieldKey)
      : activePushFields.filter((item) => [...activeTemplate.fields, fieldKey].includes(item.key)).map((item) => item.key);
    updateTemplate({ fields, format: createPushFormat(fields, activeBusiness.id) });
  };
  const updateScene = (scene) => {
    const nextScene = businessTypeConfig(scene).id;
    const fields = defaultPushFieldsForType(nextScene);
    updateTemplate({
      scene: nextScene,
      fields,
      format: createPushFormat(fields, nextScene),
      name: activeTemplate.name.includes(activeBusiness.label) ? activeTemplate.name.replace(activeBusiness.label, businessTypeConfig(nextScene).label) : activeTemplate.name
    });
  };

  return (
    <section className="page push-settings-page">
      <div className="page-title"><h1>推送设置</h1><span>配置列表页推送类型、字段和消息格式</span></div>
      <div className="push-settings-grid">
        <Panel
          title="推送类型"
          hint="每个类型可以指定使用场景和推送内容"
          className="push-type-panel"
          action={<button className="primary-button" onClick={addTemplate}><Plus size={15} /> 新建推送类型</button>}
        >
          <div className="push-template-list">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`push-template-card ${template.id === activeTemplate.id ? 'active' : ''}`}
                onClick={() => setActiveId(template.id)}
              >
                <strong>{template.name}</strong>
                <span>推送{businessTypeConfig(template.scene).label} · {template.fields.length} 个字段</span>
                {template.active && <b>当前使用</b>}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="内容格式" hint="选择字段后会生成默认格式，也可以继续手动调整文案">
          <div className="push-editor">
            <Input label="类型名称" value={activeTemplate.name} onChange={(value) => updateTemplate({ name: value })} />
            <label className="input-label">
              <span>使用场景</span>
              <div className="input-shell">
                <select value={activeTemplate.scene} onChange={(event) => updateScene(event.target.value)}>
                  {businessTypes.map((item) => <option key={item.id} value={item.id}>推送{item.label}</option>)}
                </select>
              </div>
            </label>
            <div className="field-picker wide-settings">
              <span>选择推送信息</span>
              <div className="field-grid">
                {activePushFields.map((field) => (
                  <label className="checkbox-chip" key={field.key}>
                    <input type="checkbox" checked={activeTemplate.fields.includes(field.key)} onChange={() => toggleField(field.key)} />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="input-label wide-settings">
              <span>推送格式</span>
              <textarea
                className="format-editor"
                value={activeTemplate.format}
                onChange={(event) => updateTemplate({ format: event.target.value })}
              />
            </label>
            <div className="push-actions wide-settings">
              <button className="primary-button" onClick={setActiveForScene}><Save size={15} /> 设为{activeBusiness.label}当前模板</button>
              <button className="secondary-button" onClick={() => updateTemplate({ format: createPushFormat(activeTemplate.fields, activeBusiness.id) })}>恢复字段默认格式</button>
              <button className="danger-button" disabled={templates.length <= 1} onClick={deleteTemplate}><Trash2 size={14} /> 删除</button>
            </div>
            <div className="push-preview wide-settings">
              <strong>预览</strong>
              <pre>{previewMessage}</pre>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function GoogleDeveloperPage({ products, user, saving, activeId, onActiveChange, onSave }) {
  const visibleProducts = products.filter((product) => normalizeGoogleDeveloperAccess(product).enabled);
  const activeProduct = visibleProducts.find((item) => item.id === activeId) || visibleProducts[0] || null;
  const [draft, setDraft] = useState(activeProduct || createBlankProduct());
  const [visible, setVisible] = useState({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!visibleProducts.length) return;
    onActiveChange?.(visibleProducts.some((item) => item.id === activeId) ? activeId : visibleProducts[0].id);
  }, [products]);

  useEffect(() => {
    setDraft(activeProduct || createBlankProduct());
    setVisible({});
    setNotice('');
  }, [activeProduct?.id]);

  const updateField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice('');
  };
  const updatePhone = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice('');
  };

  const saveInfo = async () => {
    if (!activeProduct) return;
    const result = await onSave(draft);
    setNotice(result.ok ? 'Basic information saved.' : result.message || 'Save failed. Please try again.');
  };

  return (
    <section className="page google-developer-page">
      <div className="page-title"><h1>Google Developer</h1><span>Basic Information</span></div>
      <div className="google-developer-layout single">
        <section className="form-section google-basic-panel">
          <div className="section-title">
            <FileText size={18} />
            <strong>Basic Information</strong>
            <span>Fill in product basic information for follow-up workflow</span>
            {activeProduct && (
              <div className="section-action">
                <button className="primary-button" type="button" disabled={saving} onClick={saveInfo}>
                  <Save size={16} />{saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
          {!visibleProducts.length ? (
            <EmptyState icon={FileText} title="No shared accounts" text={user?.role === 'super_admin' ? 'Enable Google Developer Access on a product first.' : 'No account has been shared with this user yet.'} />
          ) : activeProduct ? (
            <>
              {notice && <div className="inline-notice google-notice"><Info size={15} />{notice}</div>}
              <div className="form-grid">
                <Input label="Listed Date" type="date" value={productDateValue(draft) || localDateInput()} icon={Calendar} onChange={(value) => updateField('createdAt', value)} />
                <Input label="Account" value={draft.account} copyable onChange={(value) => updateField('account', value)} />
                <SecretInput label="Password" value={draft.password} visible={visible.password} onToggle={() => setVisible({ ...visible, password: !visible.password })} onChange={(value) => updateField('password', value)} />
                <Input label="Recovery Email Account" value={draft.email} copyable onChange={(value) => updateField('email', value)} />
                <SecretInput label="Recovery Email Password" value={draft.recoveryEmailPassword} visible={visible.recoveryEmailPassword} onToggle={() => setVisible({ ...visible, recoveryEmailPassword: !visible.recoveryEmailPassword })} onChange={(value) => updateField('recoveryEmailPassword', value)} />
                <GoogleDeveloperPhoneInput product={draft} copyable onChange={updatePhone} />
                <SecretInput label="Google Authenticator" value={draft.googleAuth} visible={visible.googleAuth} onToggle={() => setVisible({ ...visible, googleAuth: !visible.googleAuth })} onChange={(value) => updateField('googleAuth', value)} />
                <SecretInput label="Backup Codes" value={draft.securityCode} visible={visible.securityCode} onToggle={() => setVisible({ ...visible, securityCode: !visible.securityCode })} onChange={(value) => updateField('securityCode', value)} />
                <Input label="Phone SMS Code" value={draft.phoneSmsCode} copyable onChange={(value) => updateField('phoneSmsCode', value)} />
                <Input label="VPS Remote Link" value={draft.vpsRemoteUrl} wide copyable onChange={(value) => updateField('vpsRemoteUrl', value)} />
                <label className="input-label">
                  <span>Account Type</span>
                  <div className="input-shell">
                    <select value={draft.accountType || ''} onChange={(event) => updateField('accountType', event.target.value)}>
                      <option value="">Not Selected</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="personal">Personal</option>
                    </select>
                  </div>
                </label>
                <Input label="Country" value={draft.accountCountry} onChange={(value) => updateField('accountCountry', value)} />
                <Textarea label="Notes" value={draft.remark} placeholder="Enter notes (optional)" copyable onChange={(value) => updateField('remark', value)} />
              </div>
            </>
          ) : (
            <div className="purchase-editor-empty">
              <FileText size={30} />
              <strong>No account selected.</strong>
              <span>Shared accounts will appear under Google Developer in the sidebar.</span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function GoogleDeveloperPhoneInput({ product, onChange, copyable = false }) {
  const text = formatPhoneNumber(product.phoneCode, product.phone);
  return (
    <label className="input-label">
      <span>Recovery Phone Number</span>
      <div className="phone-shell">
        <select value={product.phoneCode} onChange={(event) => onChange({ phoneCode: event.target.value })}>
          <option>+86</option><option>+852</option><option>+1</option><option>+44</option>
        </select>
        <input value={product.phone} onChange={(event) => onChange({ phone: event.target.value })} />
        {copyable && <CopyFieldButton value={text} />}
      </div>
    </label>
  );
}

function SettingsPage({ user, onRequestsChanged }) {
  const isSuperAdmin = user?.role === 'super_admin';
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [accountDraft, setAccountDraft] = useState({ username: '', password: '', role: 'partner_admin' });
  const [settingsMessage, setSettingsMessage] = useState('');
  const pendingRequests = requests.filter((item) => item.status === 'pending');

  const loadAdminData = async () => {
    if (!isSuperAdmin) return;
    const [usersResponse, requestsResponse] = await Promise.all([
      fetch('/api/admin/users', { credentials: 'include' }),
      fetch('/api/admin/login-requests', { credentials: 'include' })
    ]);
    if (usersResponse.ok) setUsers((await usersResponse.json()).users || []);
    if (requestsResponse.ok) setRequests((await requestsResponse.json()).requests || []);
  };

  useEffect(() => {
    loadAdminData();
  }, [isSuperAdmin]);

  const createPartner = async () => {
    setSettingsMessage('');
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: accountDraft.username, password: accountDraft.password, role: accountDraft.role })
    });
    const data = await response.json();
    if (!response.ok) {
      setSettingsMessage(data.message || '创建账号失败');
      return;
    }
    setSettingsMessage(`已创建账号：${data.user.username}`);
    setAccountDraft({ username: '', password: '', role: 'partner_admin' });
    loadAdminData();
  };

  const approveLogin = async (requestId) => {
    const response = await fetch(`/api/admin/login-requests/${requestId}/approve`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!response.ok) {
      const data = await response.json();
      setSettingsMessage(data.message || '审批失败');
      return;
    }
    setSettingsMessage('已同意该设备登录');
    loadAdminData();
    onRequestsChanged?.();
  };

  const updateUserStatus = async (targetUser, status) => {
    setSettingsMessage('');
    const response = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.username)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSettingsMessage(data.message || '账号状态更新失败');
      return;
    }
    setSettingsMessage(`${status === 'active' ? '已启用' : '已禁用'}账号：${targetUser.username}`);
    loadAdminData();
  };

  const deleteUser = async (targetUser) => {
    setSettingsMessage('');
    const confirmed = window.confirm(`确定删除账号「${targetUser.username}」吗？删除后将无法登录。`);
    if (!confirmed) return;
    const response = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.username)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSettingsMessage(data.message || '删除账号失败');
      return;
    }
    setSettingsMessage(`已删除账号：${targetUser.username}`);
    loadAdminData();
  };

  return (
    <section className="page settings-page">
      <Panel title="系统设置">
        {!isSuperAdmin ? (
          <div className="settings-placeholder">
            <Lock size={34} />
            <h2>权限受限</h2>
            <p>合作伙伴管理员权限接近超级管理员，但不能管理后台账号、审批登录或修改敏感凭据。</p>
          </div>
        ) : (
          <div className="settings-admin-grid">
            <section className="settings-block">
              <h3>生成后台账号</h3>
              <p>伙伴管理员、Google Developer 和超级管理员的新设备登录都需要你在这里同意；已授权设备可同时在线。</p>
              <div className="settings-form">
                <Input label="账号" value={accountDraft.username} onChange={(value) => setAccountDraft({ ...accountDraft, username: value })} />
                <Input label="初始密码" type="password" value={accountDraft.password} onChange={(value) => setAccountDraft({ ...accountDraft, password: value })} />
                <label className="input-label">
                  <span>账号角色</span>
                  <div className="input-shell">
                    <select value={accountDraft.role} onChange={(event) => setAccountDraft({ ...accountDraft, role: event.target.value })}>
                      <option value="partner_admin">伙伴管理员</option>
                      <option value={googleDeveloperRole}>Google Developer</option>
                    </select>
                  </div>
                </label>
                <button className="primary-button" onClick={createPartner}>创建账号</button>
              </div>
              {settingsMessage && <div className="settings-message">{settingsMessage}</div>}
            </section>
            <section className="settings-block">
              <h3>待审批登录</h3>
              {pendingRequests.length > 0 && (
                <div className="settings-alert">
                  <Bell size={15} />
                  <span>当前有 {pendingRequests.length} 条待审批登录申请</span>
                </div>
              )}
              <div className="approval-list">
                {pendingRequests.length === 0 && <p>暂无待审批登录申请</p>}
                {pendingRequests.map((item) => (
                  <div className="approval-row" key={item.id}>
                    <div>
                      <strong>{item.username}</strong>
                      <span>{new Date(item.createdAt).toLocaleString('zh-CN')} · {item.deviceId}</span>
                    </div>
                    <button className="primary-button" onClick={() => approveLogin(item.id)}>同意登录</button>
                  </div>
                ))}
              </div>
            </section>
            <section className="settings-block wide-settings">
              <h3>账号列表</h3>
              <table className="settings-table">
                <thead><tr><th>账号</th><th>角色</th><th>登录密码</th><th>已授权设备</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{item.role === 'super_admin' ? '超级管理员' : item.role === googleDeveloperRole ? 'Google Developer' : '伙伴管理员'}</td>
                      <td>{item.role !== 'super_admin' ? (item.initialPassword || '未记录') : '-'}</td>
                      <td>{item.trustedDeviceCount || 0} 台</td>
                      <td>{item.status === 'active' ? '启用' : '停用'}</td>
                      <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                      <td>
                        {item.role !== 'super_admin' ? (
                          <div className="settings-actions">
                            <button
                              className="secondary-button"
                              onClick={() => updateUserStatus(item, item.status === 'active' ? 'disabled' : 'active')}
                            >
                              <Power size={14} /> {item.status === 'active' ? '禁用' : '启用'}
                            </button>
                            <button className="danger-button" onClick={() => deleteUser(item)}>
                              <Trash2 size={14} /> 删除
                            </button>
                          </div>
                        ) : (
                          <span className="muted-text">不可操作</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </Panel>
    </section>
  );
}

function FooterNote() {
  return <footer className="footer-note">数据安全有保障｜多重权限控制｜操作日志可追溯 <span>© 2024 GPC管理平台 版权所有</span></footer>;
}

createRoot(document.getElementById('root')).render(<App />);
