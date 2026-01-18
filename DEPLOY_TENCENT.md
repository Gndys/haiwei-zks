# 部署到腾讯云（本项目：纯静态站点）

从仓库结构看，本项目由大量 `.html` + `static/`、`style/` 等静态资源组成，没有后端服务与构建步骤；部署本质就是把整份目录放到可对外提供静态文件的地方。

下面给两种常见方式：**CVM + Nginx（你截图就是这种）**，以及 **COS 静态网站 + CDN（更省心、性能更好）**。

---

## 新手先看：你需要在哪儿操作？

你只需要在两个地方操作：

1) **腾讯云网页控制台**：点点点放行端口（80/443）
2) **服务器命令行窗口**：就是你截图里那个黑窗口 `root@...:~#`，把我给的命令复制进去回车

如果你只想“最快先跑起来”，按下面「方案 A」一步步做即可（一般 10~15 分钟）。

## 方案 A：CVM（Ubuntu）+ Nginx

### 1) 安全组/防火墙放行
在 **腾讯云控制台**：

- 进入：`云服务器 CVM` → `实例` → 点你的服务器 → `安全组`（或“防火墙/安全组规则”）
- 在“入站规则”新增：
  - 放行 `TCP:80`（HTTP）
  - 放行 `TCP:443`（HTTPS，可先不配证书但端口先放行也没问题）

在 **服务器命令行窗口**（可选：只有你启用了 `ufw` 才需要）：
```bash
sudo ufw allow 80
sudo ufw allow 443
```

### 2) 在服务器安装 Nginx
下面命令都在 **服务器命令行窗口** 执行（你截图的窗口）：
```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

安装后你可以先验证 Nginx 是否正常（可选）：
```bash
sudo systemctl status nginx --no-pager
```

### 3) 上传项目文件到服务器
推荐放到 `/var/www/haiwei`：
```bash
sudo mkdir -p /var/www/haiwei
```

接下来你需要把“你电脑里的项目文件”传到服务器。最简单两种方式选一种：

**方式 A（推荐新手）：用 SFTP 工具上传**

- 下载一个 SFTP 客户端（例如 FileZilla）
- 连接信息一般是：
  - 主机：你的公网 IP（例如 `101.34.227.127`）
  - 协议：SFTP
  - 用户名：`ubuntu`（或 `root`，看你用哪个登录）
  - 密码/密钥：用你创建服务器时设置的
- 连接成功后：
  - 远程目录切到：`/var/www/haiwei`
  - 把你本机项目文件（`index.html`、`style/`、`static/` 等整份目录内容）拖进去上传

**方式 B：用命令上传（在你电脑终端执行）**

在你电脑上打开“终端”，进入项目目录，然后执行（把 `IP` 换成你的公网 IP）：
```bash
rsync -av --delete ./ ubuntu@IP:/var/www/haiwei/
# 或者
scp -r ./* ubuntu@IP:/var/www/haiwei/
```

如果你用 root 登录，也可以改成 `root@IP:/var/www/haiwei/`。

确保权限可读：
```bash
sudo chown -R www-data:www-data /var/www/haiwei
sudo find /var/www/haiwei -type d -exec chmod 755 {} \;
sudo find /var/www/haiwei -type f -exec chmod 644 {} \;
```

### 4) 配置 Nginx 站点
创建配置文件：
```bash
sudo tee /etc/nginx/sites-available/haiwei >/dev/null <<'NGINX'
server {
  listen 80;
  server_name _;

  root /var/www/haiwei;
  index index.html;

  # 多页面静态站：有文件就返回文件/目录，否则 404
  location / {
    try_files $uri $uri/ =404;
  }

  # 静态资源缓存（可按需调整）
  location ~* \.(css|js|mjs|map|png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000" always;
  }
}
NGINX
```

启用站点并检查配置：
```bash
sudo ln -sf /etc/nginx/sites-available/haiwei /etc/nginx/sites-enabled/haiwei
sudo nginx -t
sudo systemctl reload nginx
```

现在访问 `http://你的公网IP/` 应该能看到 `index.html`。

---

## 方案 B：COS 静态网站托管 + CDN（推荐）

适合纯静态站点：免运维、可直接配 CDN、HTTPS 简单。

### 1) 创建 COS 存储桶
- 选择地域（建议与你用户接近或与其它资源同地域）
- 权限：建议**私有读写** + 通过 CDN/回源控制（或按业务选择公有读）

### 2) 上传全站文件
把仓库所有文件/目录上传到存储桶根目录（需要保证根目录有 `index.html`）。

### 3) 开启静态网站
在 COS 控制台开启“静态网站”：
- 索引文档：`index.html`
- 错误文档：可先不填，或新建一个 `404.html` 再填

### 4) 配 CDN + 域名 + HTTPS
- 创建 CDN 加速域名，源站选择 COS 存储桶
- 域名解析到 CDN CNAME
- 申请/上传 SSL 证书并在 CDN 开启 HTTPS（或在 Nginx 方案里配证书）

---

## HTTPS（CVM + Nginx）

如果你用自有域名，建议直接用腾讯云 SSL 证书服务申请免费证书，然后在 Nginx 上配置 `443`（这一段可以等你 HTTP 先跑通再做）：
- 下载证书（`fullchain.pem` / `cert.pem` + `privkey.key`）上传到服务器某目录（如 `/etc/nginx/certs/`）
- 在 `server` 中增加 `listen 443 ssl;` 并配置 `ssl_certificate`、`ssl_certificate_key`
- 可再加一个 80 端口的 `server` 做 HTTP -> HTTPS 跳转

---

## 排查与常用命令
- 查看 Nginx 状态：`systemctl status nginx`
- 查看错误日志：`tail -n 200 /var/log/nginx/error.log`
- 查看访问日志：`tail -n 200 /var/log/nginx/access.log`

### 常见报错：`port 80 is already in use`
意思是 **80 端口已被其它程序占用**（比如已安装的 `apache2`、宝塔面板/其它 Web 服务、或某个容器）。

在服务器上查是谁占用了 80（复制执行其中一个）：
```bash
sudo ss -ltnp | grep ':80'
# 或
sudo lsof -iTCP:80 -sTCP:LISTEN -n -P
```

如果看到是 `apache2`，就先停掉它（再启动 nginx）：
```bash
sudo systemctl stop apache2
sudo systemctl disable apache2
sudo systemctl restart nginx
```
