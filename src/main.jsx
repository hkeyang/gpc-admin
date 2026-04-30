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
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
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
      { id: 1, label: '服务器费', amount: 210.45, remark: '' },
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
    costs: [{ id: 1, label: '服务器费', amount: 220, remark: '' }],
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
    costs: [{ id: 1, label: '服务器费', amount: 198.75, remark: '' }],
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
    costs: [{ id: 1, label: '服务器费', amount: 230, remark: '' }],
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
  { date: '04-21', sales: 52000, profit: 16000 },
  { date: '04-22', sales: 128000, profit: 31000 },
  { date: '04-23', sales: 162000, profit: 28000 },
  { date: '04-24', sales: 210000, profit: 56000 },
  { date: '04-25', sales: 238000, profit: 72000 },
  { date: '04-26', sales: 205000, profit: 48000 },
  { date: '04-27', sales: 226000, profit: 64000 }
];

const monthBars = [
  { month: '11月', cost: 82000, profit: 68000 },
  { month: '12月', cost: 94000, profit: 78000 },
  { month: '1月', cost: 91000, profit: 72000 },
  { month: '2月', cost: 112000, profit: 84000 },
  { month: '3月', cost: 103000, profit: 86000 },
  { month: '4月', cost: 73450, profit: 98540 }
];

function money(value, currency = '$') {
  const number = Number(value || 0);
  return `${currency}${number.toLocaleString(undefined, {
    minimumFractionDigits: number % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
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
    setPageState(nextPage);
    window.history.replaceState(null, '', `#/${nextPage}`);
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
      <Sidebar current={page} onChange={setPage} />
      <main className="main">
        <Topbar id={activeProduct.id} user={currentUser} onLogout={logout} />
        {page === 'dashboard' && <Dashboard products={products} onOpenWorkbench={(id) => { setActiveId(id); setPage('workbench'); }} />}
        {page === 'products' && (
          <ProductsPage
            products={products}
            onOpenWorkbench={(id) => {
              setActiveId(id);
              setPage('workbench');
            }}
          />
        )}
        {page === 'workbench' && (
          <Workbench product={activeProduct} user={currentUser} onChange={(patch) => updateProduct(activeProduct.id, patch)} />
        )}
        {page === 'settings' && <SettingsPage user={currentUser} />}
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
          <div className="google-mark"><span>G</span></div>
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
            <div className="login-demo">超级管理员直接进入；伙伴管理员登录后需等待超级管理员批准</div>
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

function Sidebar({ current, onChange }) {
  const nav = [
    { id: 'dashboard', label: '首页', icon: Home },
    { id: 'products', label: '产品列表', icon: ClipboardList },
    { id: 'workbench', label: '产品工作台', icon: WalletCards },
    { id: 'settings', label: '系统设置', icon: Settings }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="google-mark"><span>G</span></div>
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
      <div className="sidebar-card">
        <div className="mini-chart">
          <span></span><span></span><span></span><span></span>
          <i></i>
        </div>
        <strong>轻量、高效、清晰</strong>
        <p>专为 2 人团队打造的产品管理工具 ✨</p>
      </div>
    </aside>
  );
}

function Topbar({ id, user, onLogout }) {
  const roleLabel = user?.role === 'super_admin' ? '超级管理员' : '伙伴管理员';
  return (
    <header className="topbar">
      <div className="topbar-spacer" />
      <div className="pill">系统ID：{id}<Info size={14} /></div>
      <div className="data-time"><RefreshCw size={15} /> 数据更新：10:30:45</div>
      <div className="avatar">{user?.username?.slice(0, 1)?.toUpperCase() || 'A'}</div>
      <div className="admin">{user?.username || 'Admin'}<span>{roleLabel}</span></div>
      <button className="logout-button" onClick={onLogout}>退出</button>
    </header>
  );
}

function Dashboard({ products, onOpenWorkbench }) {
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

  return (
    <section className="page">
      <div className="page-title"><h1>首页</h1><span>业务驾驶舱</span></div>
      <div className="kpi-grid six">
        <Kpi icon={WalletCards} label="累计产品" value="248 件" sub="较上月 +18　7.83%" tone="purple" />
        <Kpi icon={ShoppingCart} label="累计售出" value="12,865 件" sub="较上月 +1,236　10.61%" tone="blue" />
        <Kpi icon={Coins} label="累计利润" value="¥ 1,258,290" sub="较上月 +98,765　8.52%" tone="orange" />
        <Kpi icon={TrendingUp} label="本月利润" value="¥ 96,540" sub="较上月 +12,540　14.91%" tone="green" />
        <Kpi icon={Database} label="待回款" value="¥ 216,800" sub="较上月 -8,600　3.82%" tone="orange" negative />
        <Kpi icon={CreditCard} label="待结算" value="¥ 342,150" sub="较上月 +21,150　6.58%" tone="purple" />
      </div>

      <div className="dashboard-grid">
        <Panel className="overview-panel" title="经营总览" hint="单位：人民币（元）" action={<ChartTabs />}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={businessTrend} margin={{ left: -20, right: 10, top: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7a5cf8" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#7a5cf8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <Tooltip content={<BusinessTooltip />} />
              <Area isAnimationActive={false} type="monotone" dataKey="sales" stroke="#7a5cf8" strokeWidth={2.5} fill="url(#salesGradient)" />
              <Area isAnimationActive={false} type="monotone" dataKey="profit" stroke="#4f9ff8" strokeWidth={2.5} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="产品状态分布" className="status-panel">
          <div className="donut-wrap">
            <PieChart width={180} height={180}>
                <Pie isAnimationActive={false} data={pie} innerRadius={58} outerRadius={78} dataKey="value" strokeWidth={0}>
                  {pie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
            </PieChart>
            <div className="donut-center"><span>总数</span><strong>248</strong></div>
            <div className="legend">
              {pie.map((entry, index) => (
                <div key={entry.name}><i style={{ background: entry.color }} />{entry.name}<b>{index === 0 ? 156 : index === 1 ? 78 : 14}</b></div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="关键提醒" action={<button className="link-button">查看全部 <ChevronRight size={14} /></button>}>
          <div className="alerts">
            <AlertRow icon={AlertTriangle} label="未回款" value={money(pendingPayment, '¥ ')} sub="共 5 笔　较上月 ↓3 笔" tone="red" />
            <AlertRow icon={ShieldCheck} label="未结算" value={money(pendingSettlement * exchangeRate, '¥ ')} sub="共 7 笔　较上月 ↓2 笔" tone="orange" />
            <AlertRow icon={UserRound} label="待补成本" value="¥ 28,600" sub="共 3 个产品　较上月 ↓1 个" tone="purple" />
          </div>
        </Panel>
      </div>

      <div className="bottom-grid">
        <Panel title="月度成本与利润对比" hint="单位：人民币（元）">
          <ResponsiveContainer width="100%" height={218}>
            <BarChart data={monthBars} margin={{ left: -20, right: 10, top: 20, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa4b6', fontSize: 11 }} />
              <Tooltip />
              <Bar isAnimationActive={false} dataKey="cost" fill="#4f9ff8" radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="profit" fill="#8f63f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="最近产品记录" action={<button className="link-button">查看全部 <ChevronRight size={14} /></button>}>
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
        <p>{sub} <b className={negative ? 'down' : 'up'}>{negative ? '↓' : '↑'}</b></p>
      </div>
    </div>
  );
}

function ChartTabs() {
  return (
    <div className="chart-tabs">
      <button className="active">近7天</button>
      <button>近30天</button>
      <button>自定义</button>
      <Download size={15} />
    </div>
  );
}

function BusinessTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <p><i className="purple-dot" />销售额　¥{payload[0].value.toLocaleString()}</p>
      <p><i className="blue-dot" />利润　¥{payload[1].value.toLocaleString()}</p>
    </div>
  );
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

function ProductsPage({ products, onOpenWorkbench }) {
  const [keyword, setKeyword] = useState('');
  const [saleFilter, setSaleFilter] = useState('全部');
  const [paidFilter, setPaidFilter] = useState('全部');
  const [settlementFilter, setSettlementFilter] = useState('全部');

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const keywordText = [item.id, item.account, item.phone, item.vpsRemoteUrl].join(' ').toLowerCase();
      const matchesKeyword = keywordText.includes(keyword.toLowerCase());
      const matchesSale = saleFilter === '全部' || (saleFilter === '待售' ? !item.isSold : item.isSold);
      const matchesPaid = paidFilter === '全部' || (paidFilter === '未回款' ? !item.isPaid : item.isPaid);
      const matchesSettlement = settlementFilter === '全部' || (settlementFilter === '未结算' ? item.settlementStatus === 'unsettled' : item.settlementStatus === 'settled');
      return matchesKeyword && matchesSale && matchesPaid && matchesSettlement;
    });
  }, [products, keyword, saleFilter, paidFilter, settlementFilter]);

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
            <div className="date-filter"><span>创建时间</span><button>开始日期　~　结束日期 <Calendar size={15} /></button></div>
            <button className="secondary-button">重置</button>
            <button className="primary-button"><Plus size={16} /> 新增产品</button>
          </div>
          <ProductTable products={filteredProducts} onOpenWorkbench={onOpenWorkbench} />
          <div className="pagination">
            <button>10 条/页</button><span>共 128 条</span>
            <div className="pager"><ChevronLeft size={16} /><b>1</b><span>2</span><span>3</span><span>4</span><span>5</span><em>...</em><span>13</span><ChevronRight size={16} /></div>
          </div>
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
              <td className="actions"><button>查看</button><button>编辑</button><button onClick={() => onOpenWorkbench(item.id)}>工作台</button></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Workbench({ product, user, onChange }) {
  const [visible, setVisible] = useState({});
  const [costDraft, setCostDraft] = useState({ label: '', amount: '', remark: '' });
  const [showCostForm, setShowCostForm] = useState(false);
  const totalCost = sumCosts(product);
  const profit = productProfit(product);
  const share = profit / 2;
  const canManageSensitive = user?.role === 'super_admin';

  const updateField = (field, value) => onChange({ [field]: value });
  const updateCost = (id, amount) => {
    onChange({ costs: product.costs.map((item) => item.id === id ? { ...item, amount: Number(amount) } : item) });
  };
  const addCost = () => {
    if (!costDraft.label || !costDraft.amount) return;
    onChange({
      costs: [
        ...product.costs,
        { id: Date.now(), label: costDraft.label, amount: Number(costDraft.amount), remark: costDraft.remark }
      ]
    });
    setCostDraft({ label: '', amount: '', remark: '' });
    setShowCostForm(false);
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
          <Section title="基础信息" icon={FileText} subtitle="填写产品基础信息，为后续流程提供准备">
            {!canManageSensitive && <div className="permission-note"><Lock size={15} /> 伙伴管理员只能维护成本与销售金额，基础账号、密码、VPS 信息不可修改或查看。</div>}
            <div className="form-grid">
              <Input disabled={!canManageSensitive} label="创建时间" value={product.createdAt.split(' ')[0]} icon={Calendar} onChange={(value) => updateField('createdAt', `${value} ${product.createdAt.split(' ')[1] || '10:28'}`)} />
              <Input disabled={!canManageSensitive} label="绑定邮箱" value={product.email} onChange={(value) => updateField('email', value)} />
              <PhoneInput disabled={!canManageSensitive} product={product} onChange={onChange} />
              <Input disabled={!canManageSensitive} label="账号" value={product.account} onChange={(value) => updateField('account', value)} />
              <SecretInput disabled={!canManageSensitive} label="Google 验证" value={product.googleAuth} visible={visible.googleAuth} onToggle={() => setVisible({ ...visible, googleAuth: !visible.googleAuth })} onChange={(value) => updateField('googleAuth', value)} />
              <SecretInput disabled={!canManageSensitive} label="安全码" value={product.securityCode} visible={visible.securityCode} onToggle={() => setVisible({ ...visible, securityCode: !visible.securityCode })} onChange={(value) => updateField('securityCode', value)} />
              <SecretInput disabled={!canManageSensitive} label="密码" value={product.password} visible={visible.password} onToggle={() => setVisible({ ...visible, password: !visible.password })} onChange={(value) => updateField('password', value)} />
              <Input disabled={!canManageSensitive} label="VPS 用户名" value={product.vpsUsername} onChange={(value) => updateField('vpsUsername', value)} />
              <SecretInput disabled={!canManageSensitive} label="VPS 密码" value={product.vpsPassword} visible={visible.vpsPassword} onToggle={() => setVisible({ ...visible, vpsPassword: !visible.vpsPassword })} onChange={(value) => updateField('vpsPassword', value)} />
              <Input disabled={!canManageSensitive} label="VPS IP" value={product.vpsIp} onChange={(value) => updateField('vpsIp', value)} />
              <Input disabled={!canManageSensitive} label="VPS 远程链接" value={product.vpsRemoteUrl} wide onChange={(value) => updateField('vpsRemoteUrl', value)} />
              <Textarea disabled={!canManageSensitive} label="备注" value={product.remark} onChange={(value) => updateField('remark', value)} />
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
              <Toggle label="是否售出" checked={product.isSold} onChange={(checked) => updateField('isSold', checked)} />
              <Toggle label="是否回款" checked={product.isPaid} onChange={(checked) => updateField('isPaid', checked)} />
              <Textarea label="备注" value={product.saleRemark || ''} onChange={(value) => updateField('saleRemark', value)} />
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
        <ProfitPreview product={product} totalCost={totalCost} profit={profit} share={share} onSettle={() => onChange({ settlementStatus: 'settled', settledAt: '2024-04-27 18:30' })} />
      </div>
    </section>
  );
}

function ProfitPreview({ product, totalCost, profit, share, onSettle }) {
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
        <div className="rate-title">Google 实时汇率 <RefreshCw size={14} /></div>
        <p>1 USD = 6.84 CNY <b>6.84 <span>CNY</span></b></p>
      </Panel>
      <Panel className="rmb-card">
        <PreviewLine icon={ShieldCheck} label="香港折合人民币" value={money(share * exchangeRate, '¥')} />
        <PreviewLine icon={ShieldCheck} label="武汉折合人民币" value={money(share * exchangeRate, '¥')} />
      </Panel>
      <Panel className="settlement-status">
        <div className="status-head"><strong>结算状态</strong><StatusBadge label={product.settlementStatus === 'settled' ? '已结算' : '未结算'} /></div>
        <p>香港与武汉利润分成结算状态</p>
        <div className="check-list"><span className="ok"></span>已录入：成本与收款信息</div>
        <div className="check-list"><span className="bad"></span>{product.settlementStatus === 'settled' ? `已结算：${product.settledAt} Admin` : '未结算：尚未完成结算'}</div>
        {product.settlementStatus !== 'settled' && <button className="primary-button full" onClick={onSettle}>标记为已结算</button>}
      </Panel>
      <div className="calc-note">实时计算，自动更新</div>
    </aside>
  );
}

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="form-section">
      <div className="section-title"><Icon size={18} /><strong>{title}</strong><span>{subtitle}</span></div>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, icon: Icon, wide, type = 'text', disabled = false }) {
  return (
    <label className={`input-label ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <div className="input-shell">
        <input disabled={disabled} type={type} value={value ?? ''} onChange={(event) => onChange?.(event.target.value)} />
        {Icon && <Icon size={15} />}
      </div>
    </label>
  );
}

function SecretInput({ label, value, visible, onToggle, onChange, disabled = false }) {
  const canReveal = !disabled;
  return (
    <label className="input-label">
      <span>{label}</span>
      <div className="input-shell">
        <input disabled={disabled} type={visible && canReveal ? 'text' : 'password'} value={disabled ? '********' : (value || '')} onChange={(event) => onChange(event.target.value)} />
        <button disabled={!canReveal} type="button" onClick={onToggle}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
        <button disabled={!canReveal} type="button" onClick={() => navigator.clipboard?.writeText(value || '')}><Copy size={15} /></button>
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

function Textarea({ label, value, onChange, disabled = false }) {
  return (
    <label className="input-label wide">
      <span>{label}</span>
      <textarea disabled={disabled} value={value || ''} maxLength={200} placeholder="请输入备注信息（可选）" onChange={(event) => onChange(event.target.value)} />
      <em>{(value || '').length} / 200</em>
    </label>
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

  return (
    <section className="page settings-page">
      <Panel title="系统设置">
        {!isSuperAdmin ? (
          <div className="settings-placeholder">
            <Lock size={34} />
            <h2>权限受限</h2>
            <p>伙伴管理员只能录入成本和销售金额，不能管理账号、审批登录或查看敏感配置。</p>
          </div>
        ) : (
          <div className="settings-admin-grid">
            <section className="settings-block">
              <h3>生成伙伴管理员账号</h3>
              <p>伙伴管理员登录后需要你在这里同意，且不能修改账号密码、Google 验证、安全码、VPS 信息。</p>
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
                <thead><tr><th>账号</th><th>角色</th><th>状态</th><th>创建时间</th></tr></thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{item.role === 'super_admin' ? '超级管理员' : '伙伴管理员'}</td>
                      <td>{item.status === 'active' ? '启用' : '停用'}</td>
                      <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
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
