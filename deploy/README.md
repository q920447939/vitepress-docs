# GitHub Actions 自动部署

每次向 GitHub 的 `main` 分支推送代码后，工作流会自动构建 VitePress，并通过 SSH 将静态文件发布到服务器。

## 发布流程

```text
git push
  -> GitHub Actions 执行 npm ci
  -> 执行 npm run docs:build
  -> 上传到 /var/www/vitepress-docs/releases/<commit-sha>
  -> 将 /var/www/vitepress-docs/current 切换到新版本
  -> Nginx 读取 current
```

构建或上传失败时不会切换 `current`，线上继续使用上一次成功版本。服务器保留最近 5 个版本。
工作流先创建临时软链接，再通过同一文件系统内的 `mv -Tf` 原子替换 `current`，切换过程中不会出现链接缺失窗口。

## 一、创建服务器部署用户

下面命令在服务器上执行，并使用已有的管理员账号：

```bash
sudo useradd --create-home --shell /bin/bash deploy
sudo mkdir -p /var/www/vitepress-docs/releases
sudo chown -R deploy:deploy /var/www/vitepress-docs
```

不要让 GitHub Actions 使用 `root` 用户。

## 二、生成部署密钥

在本地电脑执行：

```bash
ssh-keygen -t ed25519 -C "github-actions-vitepress" -f ~/.ssh/vitepress_deploy
```

不要为这把自动部署密钥设置密码。它应当只用于该服务器的部署用户。

将公钥安装到服务器：

```bash
ssh-copy-id -i ~/.ssh/vitepress_deploy.pub deploy@SERVER_HOST
```

自定义 SSH 端口时：

```bash
ssh-copy-id -p 2222 -i ~/.ssh/vitepress_deploy.pub deploy@SERVER_HOST
```

部署用户是专用账号，可以给刚安装的公钥增加 OpenSSH 限制，禁止端口转发、代理转发和交互式终端：

```bash
sudo sed -i 's/^ssh-ed25519 /restrict ssh-ed25519 /' \
  /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

`restrict` 仍允许 GitHub Actions 执行本项目需要的非交互式发布命令。

测试登录：

```bash
ssh -i ~/.ssh/vitepress_deploy deploy@SERVER_HOST
```

自定义 SSH 端口时：

```bash
ssh -p 2222 -i ~/.ssh/vitepress_deploy deploy@SERVER_HOST
```

## 三、收集 GitHub Secrets

读取私钥：

```bash
cat ~/.ssh/vitepress_deploy
```

读取服务器主机指纹：

```bash
ssh-keyscan -H SERVER_HOST
```

如果 SSH 使用自定义端口，例如 `2222`：

```bash
ssh-keyscan -p 2222 -H SERVER_HOST
```

将输出中的指纹与服务器控制台显示的 SSH 主机指纹核对后再使用，避免信任错误的服务器。

在 GitHub 仓库中打开：

```text
Settings
  -> Secrets and variables
  -> Actions
  -> New repository secret
```

创建以下 Secrets：

| 名称 | 内容 |
| --- | --- |
| `SERVER_HOST` | 服务器 IP 或域名，不包含 `http://` |
| `SERVER_USER` | `deploy` |
| `SERVER_PORT` | SSH 端口，通常为 `22` |
| `SSH_PRIVATE_KEY` | `~/.ssh/vitepress_deploy` 的完整内容 |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan -H SERVER_HOST` 的输出 |

私钥只能放在 GitHub Secrets 中，不得提交到仓库。

## 四、配置 Nginx

先安装 Nginx：

```bash
sudo apt update
sudo apt install -y nginx rsync
```

将 `deploy/nginx.conf` 放到服务器的 `/etc/nginx/sites-available/vitepress-docs`，并把 `docs.example.com` 改成真实域名：

```bash
sudo ln -s /etc/nginx/sites-available/vitepress-docs \
  /etc/nginx/sites-enabled/vitepress-docs
sudo nginx -t
sudo systemctl reload nginx
```

第一次发布前 `current` 还不存在，Nginx 返回 404 属于正常现象。

## 五、启用 HTTPS

域名解析到服务器并确认 HTTP 可以访问后，使用 Certbot 配置 HTTPS：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d docs.example.com
sudo certbot renew --dry-run
```

将 `docs.example.com` 替换为真实域名。Certbot 会为 Nginx 增加 443 监听、证书路径和 HTTP 到 HTTPS 的跳转，并通过系统定时任务自动续期。

如果服务器前面使用 Cloudflare 等负责 TLS 的 CDN，也必须确保 CDN 到用户的访问启用 HTTPS，并根据安全要求决定 CDN 回源是否同样使用 HTTPS。

## 六、关联 GitHub 仓库

先在 GitHub 创建空仓库，再在项目目录执行：

```bash
git remote add origin git@github.com:YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

推送后打开 GitHub 仓库的 `Actions` 页面查看部署过程。

也可以进入 `Actions -> Deploy documentation -> Run workflow` 手动执行一次发布。

## 七、日常更新

```bash
git pull --rebase

# 修改 Markdown、图片或菜单

git add .
git commit -m "docs: 更新文档"
git push
```

`git push` 后不需要登录服务器，也不需要在服务器上执行 `git pull` 或运行 VitePress 服务。

## 常见问题

### SSH 连接失败

检查 `SERVER_HOST`、`SERVER_PORT`、`SERVER_USER` 和服务器防火墙，并确认本地测试登录使用的是同一把私钥。

### Host key verification failed

重新执行 `ssh-keyscan -H SERVER_HOST`，将完整输出更新到 `SSH_KNOWN_HOSTS`。
如果使用自定义端口，执行 `ssh-keyscan -p SERVER_PORT -H SERVER_HOST`，并确保 `SERVER_PORT` Secret 使用相同端口。

### Permission denied

确认 `/var/www/vitepress-docs` 属于 `deploy:deploy`：

```bash
sudo chown -R deploy:deploy /var/www/vitepress-docs
```

### 构建失败

先在本地执行：

```bash
npm ci
npm run docs:build
```

修复错误并重新推送。构建失败不会覆盖现有线上版本。
