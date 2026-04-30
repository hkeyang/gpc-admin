# GPC 管理后台安全配置

当前版本已经把登录、伙伴账号和登录审批放到 Cloudflare Worker 后端处理：

- 管理员密码不写在前端代码里。
- 密码只保存 PBKDF2-SHA256 哈希。
- 登录状态使用后端签名的 `HttpOnly + Secure + SameSite=Strict` Cookie。
- 超级管理员可创建伙伴管理员账号。
- 伙伴管理员登录后必须等待超级管理员在后台同意登录。
- 伙伴管理员只能维护成本、售价、销售/回款状态，不能修改或查看账号密码类敏感信息。

## 谁来同意伙伴管理员登录

第一版采用“超级管理员后台审批”模式：

1. 超级管理员登录后台。
2. 在“系统设置”里创建伙伴管理员账号和初始密码。
3. 伙伴管理员输入账号密码登录。
4. 系统生成待审批登录申请。
5. 超级管理员在“系统设置 > 待审批登录”里点击“同意登录”。
6. 伙伴管理员点击“我已获得批准，进入后台”后，后端才签发登录 Cookie。

后续如果需要更严格，可以把审批记录扩展成“同意 / 拒绝 / 永久信任设备 / 撤销设备”。

## 生成密码哈希

不要把明文密码填进 Cloudflare。

```bash
npm run hash-secret -- "你的超级管理员密码"
```

命令会输出类似：

```text
pbkdf2_sha256$310000$...$...
```

把输出值配置到 Cloudflare 环境变量。

## Cloudflare 环境变量

在 Cloudflare Workers 的项目设置里配置：

```text
SUPER_ADMIN_USERNAME=admin
SUPER_ADMIN_PASSWORD_HASH=上面生成的超级管理员密码哈希
SESSION_SECRET=一段很长的随机字符串
```

建议把 `SUPER_ADMIN_PASSWORD_HASH`、`SESSION_SECRET` 配成 Secret。

本地开发可以复制：

```bash
cp .dev.vars.example .dev.vars
```

然后把真实值填进 `.dev.vars`，这个文件已经被 `.gitignore` 忽略，不会提交。

## 部署

```bash
npm run build
npx wrangler deploy
```

## 还需要后端数据库时

当前版本保护的是“进入后台”的门禁。以后接真实产品数据时，还要继续做：

- 敏感字段入库前加密。
- 查看密码、Google 验证、VPS 密码时写操作日志。
- 数据库定期备份。
- 管理员账号开启二次验证。
