# GPC 管理后台安全配置

当前版本已经把登录和设备授权放到 Cloudflare Worker 后端处理：

- 管理员密码不写在前端代码里。
- 密码和设备授权码只保存 PBKDF2-SHA256 哈希。
- 登录状态使用后端签名的 `HttpOnly + Secure + SameSite=Strict` Cookie。
- 新设备第一次登录后，必须输入管理员保管的设备授权码。

## 谁来同意设备授权

第一版采用“设备授权码”模式：

1. 管理员提前生成一段设备授权码。
2. 新设备输入账号密码登录。
3. 后台显示“当前设备待授权”。
4. 管理员把设备授权码提供给可信设备使用者。
5. 后端验证授权码正确后，才签发已授权会话。

后续如果需要更严格，可以新增“系统设置 > 设备管理”页面，把待授权设备写入数据库，由管理员在后台点击“同意 / 拒绝”。

## 生成密码哈希

不要把明文密码填进 Cloudflare。

```bash
npm run hash-secret -- "你的管理员密码"
npm run hash-secret -- "你的设备授权码"
```

命令会输出类似：

```text
pbkdf2_sha256$310000$...$...
```

把输出值配置到 Cloudflare 环境变量。

## Cloudflare 环境变量

在 Cloudflare Workers 的项目设置里配置：

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=上面生成的管理员密码哈希
DEVICE_APPROVAL_CODE_HASH=上面生成的设备授权码哈希
SESSION_SECRET=一段很长的随机字符串
```

建议把 `ADMIN_PASSWORD_HASH`、`DEVICE_APPROVAL_CODE_HASH`、`SESSION_SECRET` 配成 Secret。

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
