import React, { useEffect, useMemo, useState } from 'react';
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
  Home,
  Info,
  LayoutDashboard,
  LineChart,
  Lock,
  Plus,
  Power,
  RefreshCw,
  Search,
  Send,
  Settings,
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

const exchangeRate = 6.84;

function getDeviceId() {
  const storageKey = 'gpc_device_id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

const initialProducts = [
  {
    id: 1,
    createdAt: '2024-04-27 10:28',
    account: 'example@gmail.com',
    email: 'example@gmail.com',
    phoneCode: '+86',
    phone: '138 0000 1234',
    password: 'Gpc#2024!demo',
    googleAuth: 'GBCD EFGH 1234 5678',
    securityCode: '123456',
    vpsIp: '30.199.***.***',
    vpsRemoteUrl: 'ssh://root@30.199.xxx.xxx:22',
    vpsUsername: 'vpsuser',
    vpsPassword: 'Vps@2024#',
    remark: '',
    costs: [
      { id: 1, label: '账号成本', amount: 210.45, remark: '' },
      { id: 2, label: 'VPS', amount: 30.2, remark: '' },
      { id: 3, label: 'ESIM', amount: 13.1, remark: '' },
      { id: 4, label: '写卡器', amount: 2, remark: '' },
      { id: 5, label: '其他成本', amount: 144.25, remark: '' }
    ],
    salePrice: 900,
    saleTime: '2024-04-27 10:28',
    isSold: true,
    isPaid: false,
    settlementStatus: 'unsettled',
    updatedAt: '10:28:45'
  },
  {
    id: 2,
    createdAt: '2024-04-26 15:42',
    account: 'demo_user',
    email: 'demo***@outlook.com',
    phoneCode: '+852',
    phone: '6600 8811',
    password: 'Demo@pass',
    googleAuth: 'HJKL MNOP 8899 1023',
    securityCode: '778899',
    vpsIp: '47.244.***.***',
    vpsRemoteUrl: 'rdp://47.244.xxx.xxx',
    vpsUsername: 'administrator',
    vpsPassword: 'VpS-demo-18',
    remark: '已交付资料',
    costs: [{ id: 1, label: '账号成本', amount: 220, remark: '' }],
    salePrice: 500,
    saleTime: '2024-04-26 16:00',
    isSold: true,
    isPaid: true,
    settlementStatus: 'settled',
    settledAt: '2024-04-27 18:30',
    updatedAt: '10:22:31'
  },
  {
    id: 3,
    createdAt: '2024-04-26 11:05',
    account: 'test123',
    email: 'test123@gmail.com',
    phoneCode: '+86',
    phone: '139 2345 6789',
    password: 'Test#123',
    googleAuth: 'QWER TYUI 1122 3344',
    securityCode: '453211',
    vpsIp: '15.236.***.***',
    vpsRemoteUrl: 'ssh://root@15.236.xxx.xxx:22',
    vpsUsername: 'root',
    vpsPassword: 'root-test',
    remark: '',
    costs: [{ id: 1, label: 'VPS', amount: 205.3, remark: '' }],
    salePrice: 450,
    saleTime: '2024-04-26 11:12',
    isSold: true,
    isPaid: true,
    settlementStatus: 'unsettled',
    updatedAt: '10:18:09'
  },
  {
    id: 4,
    createdAt: '2024-04-25 16:30',
    account: 'alpha_user',
    email: 'alpha***@gmail.com',
    phoneCode: '+86',
    phone: '137 3000 8888',
    password: 'Alpha#8899',
    googleAuth: 'ALPH AUSR 4455 6677',
    securityCode: '900821',
    vpsIp: '8.210.***.***',
    vpsRemoteUrl: 'ssh://root@8.210.xxx.xxx:22',
    vpsUsername: 'root',
    vpsPassword: 'alpha-vps',
    remark: '',
    costs: [{ id: 1, label: '账号成本', amount: 198.75, remark: '' }],
    salePrice: 400,
    saleTime: '2024-04-25 17:21',
    isSold: true,
    isPaid: false,
    settlementStatus: 'unsettled',
    updatedAt: '10:12:55'
  },
  {
    id: 5,
    createdAt: '2024-04-25 09:18',
    account: 'user456',
    email: 'user456@outlook.com',
    phoneCode: '+86',
    phone: '136 4567 0000',
    password: 'User456!',
    googleAuth: 'ZXCV BNML 2345 9988',
    securityCode: '120920',
    vpsIp: '43.198.***.***',
    vpsRemoteUrl: 'rdp://43.198.xxx.xxx',
    vpsUsername: 'admin',
    vpsPassword: 'pass456',
    remark: '',
    costs: [{ id: 1, label: '其他成本', amount: 215.6, remark: '' }],
    salePrice: 450,
    saleTime: '',
    isSold: false,
    isPaid: false,
    settlementStatus: 'unsettled',
    updatedAt: '09:58:17'
  },
  {
    id: 6,
    createdAt: '2024-04-24 22:11',
    account: 'beta_test',
    email: 'beta***@hotmail.com',
    phoneCode: '+86',
    phone: '135 1111 2222',
    password: 'Beta@2024',
    googleAuth: 'BETA TEST 3333 4444',
    securityCode: '560011',
    vpsIp: '119.29.***.***',
    vpsRemoteUrl: 'ssh://root@119.29.xxx.xxx:22',
    vpsUsername: 'root',
    vpsPassword: 'beta-vps',
    remark: '',
    costs: [{ id: 1, label: '账号成本', amount: 230, remark: '' }],
    salePrice: 500,
    saleTime: '2024-04-24 22:30',
    isSold: true,
    isPaid: true,
    settlementStatus: 'settled',
    updatedAt: '10:05:34'
  },
  {
    id: 7,
    createdAt: '2024-04-24 14:07',
    account: 'gamma001',
    email: 'gamma001@gmail.com',
    phoneCode: '+86',
    phone: '134 9000 2211',
    password: 'Gamma001',
    googleAuth: 'GAMA AUTH 1122 8899',
    securityCode: '109234',
    vpsIp: '103.45.***.***',
    vpsRemoteUrl: 'ssh://root@103.45.xxx.xxx:22',
    vpsUsername: 'root',
    vpsPassword: 'gamma-vps',
    remark: '',
    costs: [{ id: 1, label: 'VPS', amount: 208.9, remark: '' }],
    salePrice: 450,
    saleTime: '2024-04-24 15:00',
    isSold: true,
    isPaid: true,
    settlementStatus: 'unsettled',
    updatedAt: '09:48:12'
  },
  {
    id: 8,
    createdAt: '2024-04-24 10:55',
    account: 'new_account',
    email: 'new***@qq.com',
    phoneCode: '+86',
    phone: '133 2000 9000',
    password: 'NewAccount',
    googleAuth: 'NEWQ QQQQ 1234 0000',
    securityCode: '880012',
    vpsIp: '124.71.***.***',
    vpsRemoteUrl: '',
    vpsUsername: '',
    vpsPassword: '',
    remark: '',
    costs: [],
    salePrice: 400,
    saleTime: '',
    isSold: false,
    isPaid: false,
    settlementStatus: 'unsettled',
    updatedAt: '09:35:11'
  }
];

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

function formatExchangeValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return Number(number.toFixed(2)).toString();
}

function trendDateValue(date) {
  return `2024-${date}`;
}

function sumCosts(product) {
  return product.costs.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function productProfit(product) {
  return Number(product.salePrice || 0) - sumCosts(product);
}

function productStatus(product) {
  if (!product.costs.length || sumCosts(product) === 0) return '待补成本';
  if (!product.isSold) return '待售';
  if (!product.isPaid) return '待回款';
  if (product.settlementStatus === 'unsettled') return '待结算';
  return '已结算';
}

function productDateValue(product) {
  return String(product.createdAt || '').slice(0, 10);
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

function App() {
  const [page, setPageState] = useState(() => window.location.hash.replace('#/', '') || 'dashboard');
  const [products, setProducts] = useState(initialProducts);
  const [activeId, setActiveId] = useState(1);
  const [deviceId] = useState(getDeviceId);
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, user: null, pendingRequestId: '' });
  const activeProduct = products.find((item) => item.id === activeId) || products[0];
  const currentUser = authState.user;
  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    const handleHashChange = () => {
      setPageState(window.location.hash.replace('#/', '') || 'dashboard');
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

  const setPage = (nextPage) => {
    if (nextPage === 'settings' && !isSuperAdmin) {
      nextPage = 'dashboard';
    }
    setPageState(nextPage);
    window.history.replaceState(null, '', `#/${nextPage}`);
  };

  useEffect(() => {
    if (authState.authenticated && page === 'settings' && !isSuperAdmin) {
      setPage('dashboard');
    }
  }, [authState.authenticated, page, isSuperAdmin]);

  const addProduct = () => {
    const now = new Date();
    const nextId = Math.max(...products.map((item) => item.id), 0) + 1;
    const nextProduct = {
      id: nextId,
      createdAt: now.toISOString().slice(0, 16).replace('T', ' '),
      account: `new_product_${nextId}`,
      email: '',
      phoneCode: '+86',
      phone: '',
      password: '',
      googleAuth: '',
      securityCode: '',
      vpsIp: '',
      vpsRemoteUrl: '',
      vpsUsername: '',
      vpsPassword: '',
      remark: '',
      costs: [],
      salePrice: 0,
      saleTime: '',
      isSold: false,
      isPaid: false,
      settlementStatus: 'unsettled',
      updatedAt: now.toLocaleTimeString('zh-CN', { hour12: false })
    };
    setProducts((current) => [nextProduct, ...current]);
    setActiveId(nextId);
    setPage('workbench');
  };

  const updateProduct = (id, patch) => {
    setProducts((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              updatedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false })
            }
          : item
      )
    );
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
      <Sidebar current={page} onChange={setPage} user={currentUser} />
      <main className="main">
        <Topbar user={currentUser} onLogout={logout} />
        {page === 'dashboard' && <Dashboard products={products} onOpenProducts={() => setPage('products')} onOpenWorkbench={(id) => { setActiveId(id); setPage('workbench'); }} />}
        {page === 'products' && (
          <ProductsPage
            products={products}
            onAddProduct={addProduct}
            onOpenWorkbench={(id) => {
              setActiveId(id);
              setPage('workbench');
            }}
          />
        )}
        {page === 'workbench' && (
          <Workbench product={activeProduct} user={currentUser} onChange={(patch) => updateProduct(activeProduct.id, patch)} />
        )}
        {page === 'settings' && isSuperAdmin && <SettingsPage user={currentUser} />}
      </main>
    </div>
  );
}

function LoginPage({ deviceId, pendingRequestId, onLogin, onCheckApproval }) {
  const [username, setUsername] = useState('admin');
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
          <p>账号密码验证后，仅授权设备可进入管理后台。</p>
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
            <span>超级管理员在“系统设置”里点击同意后，你才能进入后台。</span>
          </div>
        )}
      </section>
    </main>
  );
}

function Sidebar({ current, onChange, user }) {
  const isSuperAdmin = user?.role === 'super_admin';
  const nav = [
    { id: 'dashboard', label: '首页', icon: Home },
    { id: 'products', label: '产品列表', icon: ClipboardList },
    { id: 'workbench', label: '产品工作台', icon: WalletCards },
    { id: 'settings', label: '系统设置', icon: Settings }
  ].filter((item) => item.id !== 'settings' || isSuperAdmin);

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
            <button
              key={item.id}
              className={`nav-item ${current === item.id ? 'active' : ''}`}
              onClick={() => !item.disabled && onChange(item.id)}
              disabled={item.disabled}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar({ user, onLogout }) {
  const roleLabel = user?.role === 'super_admin' ? '超级管理员' : '伙伴管理员';
  return (
    <header className="topbar">
      <div className="topbar-spacer" />
      <div className="avatar">{user?.username?.slice(0, 1)?.toUpperCase() || 'A'}</div>
      <div className="admin">{user?.username || 'Admin'}<span>{roleLabel}</span></div>
      <button className="logout-button" onClick={onLogout}>退出</button>
    </header>
  );
}

function Dashboard({ products, onOpenWorkbench, onOpenProducts }) {
  const [trendRange, setTrendRange] = useState('7d');
  const [customTrendRange, setCustomTrendRange] = useState({ from: '2024-04-23', to: '2024-04-26' });
  const total = products.length;
  const sold = products.filter((item) => item.isSold).length;
  const totalProfit = products.filter((item) => item.isSold).reduce((sum, item) => sum + productProfit(item), 0);
  const pendingPayment = products.filter((item) => item.isSold && !item.isPaid).reduce((sum, item) => sum + Number(item.salePrice || 0), 0);
  const pendingSettlement = products
    .filter((item) => item.isPaid && item.settlementStatus === 'unsettled')
    .reduce((sum, item) => sum + productProfit(item), 0);

  const pie = [
    { name: '待售', value: products.filter((item) => !item.isSold).length || 1, color: '#3f74f6' },
    { name: '已售', value: products.filter((item) => item.isSold).length, color: '#26c281' },
    { name: '已下架', value: 1, color: '#8290a8' }
  ];
  const activeTrend = useMemo(() => {
    if (trendRange === '30d') return businessTrend30;
    if (trendRange !== 'custom') return businessTrend;
    const filtered = businessTrend30.filter((item) => (
      (!customTrendRange.from || trendDateValue(item.date) >= customTrendRange.from) &&
      (!customTrendRange.to || trendDateValue(item.date) <= customTrendRange.to)
    ));
    return filtered.length ? filtered : businessTrend30;
  }, [trendRange, customTrendRange]);
  const trendLabel = trendRange === '30d' ? '近 30 天' : trendRange === 'custom' ? '自定义区间' : '近 7 天';
  const trendPeak = Math.max(...activeTrend.map((item) => item.profit));
  const trendPeakDate = activeTrend.find((item) => item.profit === trendPeak)?.date;
  const downloadTrend = () => downloadCsv('gpc-business-trend.csv', [
    ['日期', '销售额', '利润'],
    ...activeTrend.map((item) => [item.date, item.sales, item.profit])
  ]);

  return (
    <section className="page">
      <div className="page-title"><h1>首页</h1><span>业务驾驶舱</span></div>
      <div className="kpi-grid six">
        <Kpi icon={WalletCards} label="累计产品" value="248 件" sub="较上月 +18　7.83%" tone="purple" />
        <Kpi icon={ShoppingCart} label="累计售出" value="12,865 件" sub="较上月 +1,236　10.61%" tone="blue" />
        <Kpi icon={Coins} label="累计利润" value="$183,960" sub="较上月 +14,440　8.52%" tone="orange" />
        <Kpi icon={TrendingUp} label="本月利润" value="$14,406" sub="较上月 +1,870　14.91%" tone="green" />
        <Kpi icon={Database} label="待回款" value={money(pendingPayment)} sub="较上月 -1,260　3.82%" tone="orange" negative />
        <Kpi icon={CreditCard} label="待结算" value={money(pendingSettlement)} sub="较上月 +3,092　6.58%" tone="purple" />
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
          <ChartInsight tone="blue">{trendLabel}利润峰值 {money(trendPeak)}，出现在 {trendPeakDate}。</ChartInsight>
        </Panel>

        <Panel title="产品状态分布" className="status-panel">
          <div className="donut-wrap">
            <div className="donut-chart-box">
              <PieChart width={190} height={190}>
                <Pie isAnimationActive={false} data={pie} innerRadius={58} outerRadius={78} dataKey="value" strokeWidth={0}>
                  {pie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="donut-center"><span>总数</span><strong>248</strong></div>
            </div>
            <div className="legend">
              {pie.map((entry, index) => (
                <div key={entry.name}><i style={{ background: entry.color }} />{entry.name}<b>{index === 0 ? 156 : index === 1 ? 78 : 14}</b></div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="关键提醒" action={<button className="link-button" onClick={onOpenProducts}>查看全部 <ChevronRight size={14} /></button>}>
          <div className="alerts">
            <AlertRow icon={AlertTriangle} label="未回款" value={money(pendingPayment)} sub="共 5 笔　较上月 ↓3 笔" tone="red" />
            <AlertRow icon={ShieldCheck} label="未结算" value={money(pendingSettlement)} sub="共 7 笔　较上月 ↓2 笔" tone="orange" />
            <AlertRow icon={UserRound} label="待补成本" value="$4,180" sub="共 3 个产品　较上月 ↓1 个" tone="purple" />
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
            <BarChart data={monthBars} margin={{ left: 6, right: 10, top: 12, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <Tooltip content={<BarTooltip />} />
              <Bar isAnimationActive={false} dataKey="cost" name="成本" fill="#4f9ff8" radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="profit" name="利润" fill="#8f63f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <ChartInsight tone="purple">4 月利润 $14,406，高于成本 $10,738；利润率约 57.3%。</ChartInsight>
        </Panel>
        <Panel title="最近产品记录" action={<button className="link-button" onClick={onOpenProducts}>查看全部 <ChevronRight size={14} /></button>}>
          <table className="mini-table">
            <thead><tr><th>ID</th><th>账号</th><th>状态</th><th>利润 (USD)</th><th>时间</th></tr></thead>
            <tbody>
              {products.slice(0, 5).map((item) => (
                <tr key={item.id} onClick={() => onOpenWorkbench(item.id)}>
                  <td>#{`20240427${String(item.id).padStart(2, '0')}`}</td>
                  <td>{item.account}</td>
                  <td><StatusBadge label={productStatus(item)} /></td>
                  <td>{money(Math.max(productProfit(item), 0))}</td>
                  <td>{item.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <FooterNote />
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, negative }) {
  return (
    <div className="kpi-card">
      <div className={`icon-bubble ${tone}`}><Icon size={20} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {sub && <p><span>{sub}</span><b className={negative ? 'down' : 'up'}>{negative ? '↓' : '↑'}</b></p>}
      </div>
    </div>
  );
}

function ChartTabs({ active, customRange, onChange, onCustomRangeChange, onDownload }) {
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
        <div className="custom-date-range">
          <input aria-label="自定义开始日期" type="date" value={customRange.from} onChange={(event) => updateCustomRange('from', event.target.value)} />
          <span>-</span>
          <input aria-label="自定义结束日期" type="date" value={customRange.to} onChange={(event) => updateCustomRange('to', event.target.value)} />
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

function ProductsPage({ products, onOpenWorkbench, onAddProduct }) {
  const [keyword, setKeyword] = useState('');
  const [saleFilter, setSaleFilter] = useState('全部');
  const [paidFilter, setPaidFilter] = useState('全部');
  const [settlementFilter, setSettlementFilter] = useState('全部');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const keywordText = [item.id, item.account, item.phone, item.vpsRemoteUrl].join(' ').toLowerCase();
      const matchesKeyword = keywordText.includes(keyword.toLowerCase());
      const matchesSale = saleFilter === '全部' || (saleFilter === '待售' ? !item.isSold : item.isSold);
      const matchesPaid = paidFilter === '全部' || (paidFilter === '未回款' ? !item.isPaid : item.isPaid);
      const matchesSettlement = settlementFilter === '全部' || (settlementFilter === '未结算' ? item.settlementStatus === 'unsettled' : item.settlementStatus === 'settled');
      const createdDate = productDateValue(item);
      const matchesDateFrom = !dateFrom || createdDate >= dateFrom;
      const matchesDateTo = !dateTo || createdDate <= dateTo;
      return matchesKeyword && matchesSale && matchesPaid && matchesSettlement && matchesDateFrom && matchesDateTo;
    });
  }, [products, keyword, saleFilter, paidFilter, settlementFilter, dateFrom, dateTo]);
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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

  return (
    <section className="page products-page">
      <div className="kpi-grid five compact">
        <Kpi icon={Box} label="产品总数" value="128" tone="purple" />
        <Kpi icon={ShoppingCart} label="待售" value="34" tone="blue" />
        <Kpi icon={CheckCircle2} label="已售" value="62" tone="green" />
        <Kpi icon={CreditCard} label="已回款" value="55" tone="purple" />
        <Kpi icon={Info} label="未结算" value="21" tone="orange" />
      </div>
      <div className="list-layout">
        <Panel className="list-panel">
          <div className="filters">
            <label className="search-box"><Search size={17} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索 ID / 账号 / 手机号 / 远程链接" /></label>
            <FilterSelect label="销售状态" value={saleFilter} onChange={setSaleFilter} options={['全部', '待售', '已售']} />
            <FilterSelect label="回款状态" value={paidFilter} onChange={setPaidFilter} options={['全部', '未回款', '已回款']} />
            <FilterSelect label="结算状态" value={settlementFilter} onChange={setSettlementFilter} options={['全部', '未结算', '已结算']} />
            <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
            <button className="secondary-button" onClick={resetFilters}>重置</button>
            <button className="primary-button" onClick={onAddProduct}><Plus size={16} /> 新增产品</button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={Box} title="暂无产品" text="先新增产品，再录入账号资料、成本、销售与结算信息。" />
          ) : filteredProducts.length === 0 ? (
            <EmptyState icon={Search} title="没有匹配结果" text="换一个关键词，或清空销售、回款、结算筛选条件。" />
          ) : (
            <>
              <ProductTable products={paginatedProducts} onOpenWorkbench={onOpenWorkbench} />
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
          <MiniMetric icon={Box} label="今日新增" value="3" />
          <MiniMetric icon={ShoppingCart} label="今日已售" value="5" />
          <MiniMetric icon={CreditCard} label="今日回款" value="4" />
          <MiniMetric icon={DollarSign} label="待结算利润" value="$2,450.00" accent />
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
  return (
    <div className="date-filter">
      <span>创建时间</span>
      <div className="date-range">
        <input aria-label="开始日期" type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} />
        <b>~</b>
        <input aria-label="结束日期" type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} />
        <Calendar size={15} />
      </div>
    </div>
  );
}

function ProductTable({ products, onOpenWorkbench }) {
  return (
    <table className="product-table">
      <thead>
        <tr>
          <th>ID</th><th>创建时间</th><th>账号</th><th>总成本 (USD)</th><th>售价 (USD)</th><th>利润 (USD)</th><th>销售状态</th><th>回款状态</th><th>结算状态</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        {products.map((item) => {
          const cost = sumCosts(item);
          const profit = productProfit(item);
          return (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.createdAt}</td>
              <td>{item.account}</td>
              <td>{cost.toFixed(2)}</td>
              <td>{Number(item.salePrice || 0).toFixed(2)}</td>
              <td className="profit-text">{profit.toFixed(2)}</td>
              <td><StatusBadge label={item.isSold ? '已售' : '待售'} /></td>
              <td>{item.isSold ? <StatusBadge label={item.isPaid ? '已回款' : '未回款'} /> : '-'}</td>
              <td><StatusBadge label={item.settlementStatus === 'settled' ? '已结算' : '未结算'} /></td>
              <td className="actions"><button onClick={() => onOpenWorkbench(item.id)}>查看</button><button onClick={() => onOpenWorkbench(item.id)}>编辑</button><button onClick={() => onOpenWorkbench(item.id)}>工作台</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
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

function Workbench({ product, user, onChange }) {
  const [visible, setVisible] = useState({});
  const [costDraft, setCostDraft] = useState({ label: '', amount: '', remark: '' });
  const [showCostForm, setShowCostForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [fullView, setFullView] = useState(null);
  const totalCost = sumCosts(product);
  const profit = productProfit(product);
  const share = profit / 2;
  const canEditCredentials = user?.role === 'super_admin';

  const commitChange = (patch) => {
    try {
      onChange(patch);
      return true;
    } catch {
      setNotice('数据保存失败，请稍后重试；当前页面未完成写入。');
      return false;
    }
  };
  const updateField = (field, value) => {
    setNotice('');
    commitChange({ [field]: value });
  };
  const updateSaleStatus = (checked) => {
    if (checked && totalCost <= 0) {
      setNotice('请先填写成本后再标记售出，避免利润和分成被误算。');
      return;
    }
    updateField('isSold', checked);
  };
  const updatePaidStatus = (checked) => {
    if (checked && !product.isSold) {
      setNotice('请先标记售出，再登记回款。');
      return;
    }
    updateField('isPaid', checked);
  };
  const updateCost = (id, amount) => {
    setNotice('');
    commitChange({ costs: product.costs.map((item) => item.id === id ? { ...item, amount: Number(amount) } : item) });
  };
  const addCost = () => {
    if (!costDraft.label || !costDraft.amount) return;
    const saved = commitChange({
      costs: [
        ...product.costs,
        { id: Date.now(), label: costDraft.label, amount: Number(costDraft.amount), remark: costDraft.remark }
      ]
    });
    if (!saved) return;
    setCostDraft({ label: '', amount: '', remark: '' });
    setShowCostForm(false);
  };
  const settleProduct = () => {
    if (totalCost <= 0) {
      setNotice('请先填写成本后再结算。');
      return;
    }
    if (!product.isPaid) {
      setNotice('未回款产品暂不允许结算，请先确认回款状态。');
      return;
    }
    if (commitChange({ settlementStatus: 'settled', settledAt: '2024-04-27 18:30' })) {
      setNotice('已标记结算，利润分成按 USD 记录，右侧同步显示 CNY 换算。');
    }
  };
  const pushToTelegram = async () => {
    setNotice('正在推送到 Telegram...');
    try {
      const response = await fetch('/api/telegram/push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: product.account,
          password: product.password,
          phoneCode: product.phoneCode,
          phone: product.phone,
          email: product.email,
          securityCode: product.securityCode,
          vpsRemoteUrl: product.vpsRemoteUrl
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(data.message || 'Telegram 推送失败，请稍后重试。');
        return;
      }
      setNotice('已推送到关联的 Telegram Bot。');
    } catch {
      setNotice('Telegram 推送失败，请检查网络或后端配置。');
    }
  };
  const openFullValue = (label, value) => {
    setFullView({ label, value: String(value || '') });
  };

  return (
    <section className="page workbench-page">
      <div className="steps">
        {[
          ['1', '基础信息', '填写产品基础信息'],
          ['2', '成本录入', '录入各项成本并计算总成本'],
          ['3', '销售登记', '登记销售信息与收款'],
          ['4', '自动结算', '自动计算利润与分成']
        ].map((step, index) => (
          <div className={`step ${index === 1 ? 'active' : ''}`} key={step[0]}>
            <b>{step[0]}</b><div><strong>{step[1]}</strong><span>{step[2]}</span></div>
          </div>
        ))}
      </div>
      <div className="workbench-grid">
        <div className="workbench-main">
          {notice && <div className="inline-notice"><Info size={15} />{notice}</div>}
          <Section
            title="基础信息"
            icon={FileText}
            subtitle="填写产品基础信息，为后续流程提供准备"
            action={<button className="telegram-push" type="button" onClick={pushToTelegram}><Send size={15} />推送</button>}
          >
            {!canEditCredentials && <div className="permission-note"><Lock size={15} /> 合作伙伴可查看全部资料，但账号密码、Google 验证、设备安全码、VPS 密码仅超级管理员可修改。</div>}
            <div className="form-grid">
              <Input label="创建时间" value={product.createdAt.split(' ')[0]} icon={Calendar} onChange={(value) => updateField('createdAt', `${value} ${product.createdAt.split(' ')[1] || '10:28'}`)} />
              <Input label="绑定邮箱" value={product.email} onChange={(value) => updateField('email', value)} />
              <PhoneInput product={product} onChange={onChange} />
              <Input label="账号" value={product.account} onChange={(value) => updateField('account', value)} />
              <SecretInput readOnly={!canEditCredentials} label="Google 验证" value={product.googleAuth} visible={visible.googleAuth} onToggle={() => setVisible({ ...visible, googleAuth: !visible.googleAuth })} onChange={(value) => updateField('googleAuth', value)} />
              <SecretInput readOnly={!canEditCredentials} label="设备安全码" value={product.securityCode} visible={visible.securityCode} onToggle={() => setVisible({ ...visible, securityCode: !visible.securityCode })} onChange={(value) => updateField('securityCode', value)} />
              <SecretInput readOnly={!canEditCredentials} label="密码" value={product.password} visible={visible.password} onToggle={() => setVisible({ ...visible, password: !visible.password })} onChange={(value) => updateField('password', value)} onOpenFull={openFullValue} />
              <Input label="VPS 用户名" value={product.vpsUsername} onChange={(value) => updateField('vpsUsername', value)} />
              <SecretInput readOnly={!canEditCredentials} label="VPS 密码" value={product.vpsPassword} visible={visible.vpsPassword} onToggle={() => setVisible({ ...visible, vpsPassword: !visible.vpsPassword })} onChange={(value) => updateField('vpsPassword', value)} onOpenFull={openFullValue} />
              <Input label="VPS IP" value={product.vpsIp} copyable onOpenFull={openFullValue} onChange={(value) => updateField('vpsIp', value)} />
              <Input label="VPS 远程链接" value={product.vpsRemoteUrl} wide copyable onOpenFull={openFullValue} onChange={(value) => updateField('vpsRemoteUrl', value)} />
              <Textarea label="备注" value={product.remark} copyable onOpenFull={openFullValue} onChange={(value) => updateField('remark', value)} />
            </div>
          </Section>

          <Section title="成本录入" icon={Coins} subtitle="录入各项成本，系统将自动计算总成本（USD）">
            <div className="cost-row">
              {product.costs.map((item) => (
                <label className="cost-input" key={item.id}>
                  <span>{item.label}（USD）</span>
                  <input type="number" value={item.amount} onChange={(event) => updateCost(item.id, event.target.value)} />
                </label>
              ))}
              <button className="add-cost" onClick={() => setShowCostForm(true)}><Plus size={26} /><strong>添加成本标签</strong><span>支持自定义成本类别</span></button>
              <div className="total-cost"><span>总成本（USD）</span><strong>{money(totalCost)}</strong></div>
            </div>
            {showCostForm && (
              <div className="cost-popover">
                <button className="close" onClick={() => setShowCostForm(false)}><X size={15} /></button>
                <Input label="成本名称" value={costDraft.label} onChange={(value) => setCostDraft({ ...costDraft, label: value })} />
                <Input label="金额 USD" type="number" value={costDraft.amount} onChange={(value) => setCostDraft({ ...costDraft, amount: value })} />
                <Input label="备注" value={costDraft.remark} onChange={(value) => setCostDraft({ ...costDraft, remark: value })} />
                <button className="primary-button" onClick={addCost}>保存</button>
              </div>
            )}
            <div className="support-note"><Info size={15} /> 支持自定义成本标签，可添加其他任何成本类别</div>
          </Section>

          <Section title="销售登记" icon={LineChart} subtitle="登记销售信息与收款">
            <div className="sale-grid">
              <Input label="售价（USD）" type="number" value={product.salePrice} onChange={(value) => updateField('salePrice', Number(value))} />
              <Input label="销售时间" value={product.saleTime || '2024-04-27 10:28'} icon={Calendar} onChange={(value) => updateField('saleTime', value)} />
              <Toggle label="是否售出" checked={product.isSold} onChange={updateSaleStatus} />
              <Toggle label="是否回款" checked={product.isPaid} onChange={updatePaidStatus} />
              <Textarea label="备注" value={product.saleRemark || ''} copyable onOpenFull={openFullValue} onChange={(value) => updateField('saleRemark', value)} />
            </div>
          </Section>

          <Section title="自动结算" icon={ShieldCheck} subtitle="系统自动计算利润与分成（USD）">
            <div className="settlement-cards">
              <MiniSettle label="总成本（USD）" value={money(totalCost)} />
              <MiniSettle label="售价（USD）" value={money(product.salePrice)} />
              <MiniSettle label="利润（USD）" value={money(profit)} green />
              <MiniSettle label="香港分成（50%）" value={money(share)} />
              <MiniSettle label="武汉分成（50%）" value={money(share)} />
            </div>
          </Section>
        </div>
        <ProfitPreview product={product} totalCost={totalCost} profit={profit} share={share} onSettle={settleProduct} />
      </div>
      {fullView && <FullValueModal label={fullView.label} value={fullView.value} onClose={() => setFullView(null)} />}
    </section>
  );
}

function ProfitPreview({ product, totalCost, profit, share, onSettle }) {
  const rateAvailable = Number.isFinite(exchangeRate) && exchangeRate > 0;
  const [usdAmount, setUsdAmount] = useState('');
  const [cnyAmount, setCnyAmount] = useState('');

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
        <PreviewLine icon={Box} label="总成本（USD）" value={money(totalCost)} />
        <PreviewLine icon={Database} label="售价（USD）" value={money(product.salePrice)} />
        <PreviewLine icon={DollarSign} label="利润（USD）" value={money(profit)} green />
        <PreviewLine icon={ShieldCheck} label="香港分成（50%）" value={money(share)} />
        <PreviewLine icon={ShieldCheck} label="武汉分成（50%）" value={money(share)} />
      </Panel>
      <Panel className="rate-card">
        <div className="rate-title">USD / CNY 换算 <RefreshCw size={14} /></div>
        {rateAvailable ? (
          <>
            <p>1 USD = {exchangeRate.toFixed(2)} CNY <b>{exchangeRate.toFixed(2)} <span>CNY</span></b></p>
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
      </Panel>
      <Panel className="rmb-card">
        <div className="currency-note">左侧经营金额以 USD 记录；本模块仅用于分成折合 CNY。</div>
        <PreviewLine icon={ShieldCheck} label="香港分成折合 CNY" value={rateAvailable ? cny(share * exchangeRate) : '-'} />
        <PreviewLine icon={ShieldCheck} label="武汉分成折合 CNY" value={rateAvailable ? cny(share * exchangeRate) : '-'} />
      </Panel>
      <Panel className="settlement-status">
        <div className="status-head"><strong>结算状态</strong><StatusBadge label={product.settlementStatus === 'settled' ? '已结算' : '未结算'} /></div>
        <p>香港与武汉利润分成结算状态</p>
        <div className="check-list"><span className={totalCost > 0 ? 'ok' : 'bad'}></span>{totalCost > 0 ? '已录入：成本信息' : '待处理：未填写成本'}</div>
        <div className="check-list"><span className={product.isPaid ? 'ok' : 'bad'}></span>{product.isPaid ? '已确认：回款完成' : '待处理：未回款不允许结算'}</div>
        <div className="check-list"><span className="bad"></span>{product.settlementStatus === 'settled' ? `已结算：${product.settledAt} Admin` : '未结算：尚未完成结算'}</div>
        {product.settlementStatus !== 'settled' && <button className="primary-button full" onClick={onSettle}>标记为已结算</button>}
      </Panel>
      <div className="calc-note">实时计算，自动更新</div>
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
  return (
    <label className={`input-label ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <div className="input-shell" onDoubleClick={() => onOpenFull?.(label, text)} title="双击查看完整内容">
        <input disabled={disabled} type={type} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
        {Icon && <Icon size={15} />}
        {copyable && <CopyFieldButton value={text} disabled={disabled} />}
      </div>
    </label>
  );
}

function SecretInput({ label, value, visible, onToggle, onChange, disabled = false, readOnly = false, onOpenFull }) {
  const canReveal = !disabled;
  const text = String(value || '');
  return (
    <label className="input-label">
      <span>{label}</span>
      <div className="input-shell" onDoubleClick={() => canReveal && onOpenFull?.(label, text)} title="双击查看完整内容">
        <input readOnly={readOnly} disabled={disabled} type={visible && canReveal ? 'text' : 'password'} value={disabled ? '********' : (value || '')} onChange={(event) => !readOnly && onChange(event.target.value)} />
        <button disabled={!canReveal} type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        <CopyFieldButton value={text} disabled={!canReveal} />
      </div>
    </label>
  );
}

function PhoneInput({ product, onChange, disabled = false }) {
  return (
    <label className="input-label">
      <span>绑定手机号</span>
      <div className="phone-shell">
        <select disabled={disabled} value={product.phoneCode} onChange={(event) => onChange({ phoneCode: event.target.value })}>
          <option>+86</option><option>+852</option><option>+1</option>
        </select>
        <input disabled={disabled} value={product.phone} onChange={(event) => onChange({ phone: event.target.value })} />
      </div>
    </label>
  );
}

function Textarea({ label, value, onChange, disabled = false, copyable = false, onOpenFull }) {
  const text = String(value || '');
  return (
    <label className="input-label wide">
      <span>{label}</span>
      <div className="textarea-shell" onDoubleClick={() => onOpenFull?.(label, text)} title="双击查看完整内容">
        <textarea disabled={disabled} value={value || ''} maxLength={200} placeholder="请输入备注信息（可选）" onChange={(event) => onChange(event.target.value)} />
        <em>{(value || '').length} / 200</em>
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

function MiniMetric({ icon: Icon, label, value, accent }) {
  return <div className="mini-metric"><Icon size={20} /><span>{label}</span><strong className={accent ? 'orange-text' : ''}>{value}</strong></div>;
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

function SettingsPage({ user }) {
  const isSuperAdmin = user?.role === 'super_admin';
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [accountDraft, setAccountDraft] = useState({ username: '', password: '' });
  const [settingsMessage, setSettingsMessage] = useState('');

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
      body: JSON.stringify({ username: accountDraft.username, password: accountDraft.password, role: 'partner_admin' })
    });
    const data = await response.json();
    if (!response.ok) {
      setSettingsMessage(data.message || '创建账号失败');
      return;
    }
    setSettingsMessage(`已创建伙伴管理员：${data.user.username}`);
    setAccountDraft({ username: '', password: '' });
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
    setSettingsMessage('已同意该伙伴管理员登录');
    loadAdminData();
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
    setSettingsMessage(`${status === 'active' ? '已启用' : '已禁用'}伙伴管理员：${targetUser.username}`);
    loadAdminData();
  };

  const deleteUser = async (targetUser) => {
    setSettingsMessage('');
    const confirmed = window.confirm(`确定删除伙伴管理员账号「${targetUser.username}」吗？删除后将无法登录。`);
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
    setSettingsMessage(`已删除伙伴管理员：${targetUser.username}`);
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
              <h3>生成伙伴管理员账号</h3>
              <p>伙伴管理员登录后需要你在这里同意；进入后可查看全部产品资料并维护业务数据，但不能管理后台账号或修改敏感凭据。</p>
              <div className="settings-form">
                <Input label="账号" value={accountDraft.username} onChange={(value) => setAccountDraft({ ...accountDraft, username: value })} />
                <Input label="初始密码" type="password" value={accountDraft.password} onChange={(value) => setAccountDraft({ ...accountDraft, password: value })} />
                <button className="primary-button" onClick={createPartner}>创建伙伴账号</button>
              </div>
              {settingsMessage && <div className="settings-message">{settingsMessage}</div>}
            </section>
            <section className="settings-block">
              <h3>待审批登录</h3>
              <div className="approval-list">
                {requests.filter((item) => item.status === 'pending').length === 0 && <p>暂无待审批登录申请</p>}
                {requests.filter((item) => item.status === 'pending').map((item) => (
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
                <thead><tr><th>账号</th><th>角色</th><th>登录密码</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{item.role === 'super_admin' ? '超级管理员' : '伙伴管理员'}</td>
                      <td>{item.role === 'partner_admin' ? (item.initialPassword || '未记录') : '-'}</td>
                      <td>{item.status === 'active' ? '启用' : '停用'}</td>
                      <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                      <td>
                        {item.role === 'partner_admin' ? (
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
