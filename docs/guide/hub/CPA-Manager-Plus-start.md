# CPA 与 CPA Manager Plus 一体化部署教程

> 版本：CLIProxyAPI `v7.2.94`、CPA Manager Plus `v1.11.5`  
> 适用环境：Ubuntu/Debian、Docker Engine、Docker Compose 插件、UFW、systemd

本文部署一套以 CPA 为核心的服务：CPA 负责 API 网关，CPA Manager Plus（下文简称 CPAMP）负责管理和观测，Nginx 统一处理 HTTPS。已有 sub2api 配置时，也可以接入同一入口。

核心组件只在 Docker 内部网络通信。公网开放 Nginx 的入口端口，CPA、CPAMP 和 sub2api 的内部端口不直接发布到宿主机，可减少端口暴露，也避开 Docker 发布端口绕过 UFW 的常见问题。

## 部署后的访问关系

```text
客户端
  |
  +-- https://example.com:9966 --> Nginx --> CPA:8317
  |
  +-- https://example.com:9969 --> Nginx --> CPAMP:18317
  |
  +-- https://example.com:9968 --> Nginx --> sub2api:8080（可选）
```

| 组件 | 用途 | Docker 内部端口 | 公网入口 | 是否必需 |
| --- | --- | ---: | --- | --- |
| CPA | API 网关与管理接口 | `8317` | `9966` | 是 |
| CPAMP | CPA 管理与用量观测 | `18317` | `9969` | 是 |
| sub2api | 既有 sub2api 服务 | `8080` | `9968` | 可选 |
| Nginx | TLS 终止与反向代理 | `9966/9968/9969` | 同左 | 是 |
| CPA OAuth 回调 | Codex OAuth 本地回调 | `1455` | 仅绑定宿主机回环地址 | 按需 |

## 一、部署前准备

开始前确认以下条件：

- 域名已经解析到服务器公网 IP。
- 服务器已安装 Docker Engine 和 Docker Compose 插件。
- 当前账号可以使用 `sudo`，并且拥有 Docker daemon 的访问权限。
- SSH 端口已经加入防火墙放行规则。
- `/opt/llmproxy` 下的配置由专门账号维护，不与公共下载目录混用。

检查 Docker：

```bash
docker --version
docker compose version
docker info >/dev/null
openssl version
```

`docker info` 报权限错误时，先配置 Docker 用户权限，或在后续 Docker 命令前统一加 `sudo`。系统缺少 OpenSSL 时，可以运行 `sudo apt install -y openssl` 安装。

本文使用以下占位值。执行前统一替换，避免改到一半才发现域名或密钥仍是示例：

| 占位值 | 替换内容 |
| --- | --- |
| `example.com` | 实际域名 |
| `admin@example.com` | 用于 Let's Encrypt 通知的邮箱 |
| `<CPA_MANAGEMENT_KEY>` | CPA 管理密钥 |
| `<CLIENT_API_KEY>` | 调用 CPA API 的客户端密钥 |
| `CPA_MANAGER_ADMIN_KEY` | CPAMP 管理员密钥，由后文命令生成 |

::: warning 密钥文件
`cpa/config.yaml`、`cpamp/.env` 和 `sub2api/.env` 都包含敏感信息。文件权限建议设为 `600`，也不要提交到 Git 或发送到公开聊天中。
:::

## 二、准备目录和 Docker 网络

本文统一使用 `/opt/llmproxy`：

```text
/opt/llmproxy/
├── cpa/
│   ├── auths/
│   ├── logs/
│   ├── docker-compose.yml
│   └── config.yaml
├── cpamp/
│   ├── .env
│   └── docker-compose.yml
├── nginx/
│   ├── docker-compose.yml
│   └── nginx.conf
└── sub2api/                 # 可选
    ├── data/
    ├── postgres_data/
    ├── redis_data/
    ├── docker-compose.yml
    └── .env
```

创建目录并交给当前用户维护：

```bash
sudo mkdir -p /opt/llmproxy/cpa/{auths,logs}
sudo mkdir -p /opt/llmproxy/cpamp /opt/llmproxy/nginx
sudo mkdir -p /opt/llmproxy/sub2api/{data,postgres_data,redis_data}
sudo chown -R "$USER":"$USER" /opt/llmproxy
```

创建共享网络。CPA、CPAMP、sub2api 和 Nginx 都会加入这个网络，并通过服务名互相访问：

```bash
docker network inspect llmproxy >/dev/null 2>&1 || docker network create llmproxy
```

## 三、部署 CPA

### 1. 编写 Compose 文件

创建 `/opt/llmproxy/cpa/docker-compose.yml`：

```yaml
name: cpa

services:
  cpa:
    image: eceasy/cli-proxy-api:v7.2.94
    container_name: cpa
    restart: unless-stopped
    ports:
      - "127.0.0.1:1455:1455"
    expose:
      - "8317"
    volumes:
      - /opt/llmproxy/cpa/config.yaml:/CLIProxyAPI/config.yaml
      - /opt/llmproxy/cpa/auths:/root/.cli-proxy-api
      - /opt/llmproxy/cpa/logs:/CLIProxyAPI/logs
    networks:
      - llmproxy

networks:
  llmproxy:
    external: true
```

CPA 的官方镜像没有预装 `wget` 或 `curl`。本教程改用独立的 BusyBox 容器检查 `8317` 端口，避免 CPA 实际可用却一直显示 `unhealthy`。

`config.yaml` 保持可写挂载，因为 CPA 管理接口需要把配置变更保存回文件。访问权限由宿主机上的 `chmod 600` 控制。

`1455` 是 Codex OAuth 回调端口，只绑定到宿主机 `127.0.0.1`。从远程电脑完成 OAuth 时，可以先建立 SSH 转发：

```bash
ssh -L 1455:127.0.0.1:1455 <USER>@<SERVER_IP>
```

### 2. 配置 CPA

在 `/opt/llmproxy/cpa/config.yaml` 中保留项目所需的完整 Provider 配置。下面只列出与本教程相关的关键项：

```yaml
host: ""
port: 8317

tls:
  enable: false

remote-management:
  allow-remote: true
  secret-key: "<CPA_MANAGEMENT_KEY>"

api-keys:
  - "<CLIENT_API_KEY>"

routing:
  strategy: "fill-first"
  session-affinity: true
  session-affinity-ttl: "1h"

usage-statistics-enabled: true
redis-usage-queue-retention-seconds: 60

ws-auth: true
```

Nginx 会负责公网 TLS，CPA 容器内部继续使用 HTTP。`remote-management.secret-key` 用于 CPA 管理接口，`api-keys` 则用于客户端调用，两类密钥不要混用。

限制配置文件权限：

```bash
chmod 600 /opt/llmproxy/cpa/config.yaml
```

### 3. 启动并检查 CPA

```bash
cd /opt/llmproxy/cpa
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 cpa
```

确认容器已在共享网络内监听 `8317`：

```bash
docker run --rm --network llmproxy busybox:1.37 nc -z cpa 8317
```

命令退出码为 `0` 代表 TCP 端口已经就绪。查看退出码：

```bash
echo $?
```

## 四、部署 CPA Manager Plus

CPAMP 完整模式使用独立的 Manager Server，提供请求历史、用量分析和账号健康等功能。CPAMP 官方建议 CPA 使用 `v7.1.39+`，HTTP 用量队列至少需要 `v6.10.8+`；本文的 CPA 版本满足该要求。

### 1. 生成管理员密钥

在 CPAMP 目录生成一份随机管理员密钥：

```bash
cd /opt/llmproxy/cpamp
umask 077
printf 'CPA_MANAGER_ADMIN_KEY=%s\n' "$(openssl rand -hex 32)" > .env
chmod 600 .env
```

这份密钥用于登录 CPAMP，不是 CPA Management Key。部署完成后将它保存到密码管理器中。

### 2. 编写 Compose 文件

创建 `/opt/llmproxy/cpamp/docker-compose.yml`：

```yaml
name: cpamp

services:
  cpa-manager-plus:
    image: seakee/cpa-manager-plus:v1.11.5
    container_name: cpa-manager-plus
    restart: unless-stopped
    env_file:
      - .env
    expose:
      - "18317"
    environment:
      HTTP_ADDR: "0.0.0.0:18317"
      USAGE_DB_PATH: "/data/usage.sqlite"
      CPA_MANAGER_DATA_KEY_PATH: "/data/data.key"
      USAGE_COLLECTOR_MODE: "auto"
      USAGE_RESP_QUEUE: "usage"
      USAGE_RESP_POP_SIDE: "right"
      USAGE_BATCH_SIZE: "100"
      USAGE_POLL_INTERVAL_MS: "500"
      USAGE_QUERY_LIMIT: "50000"
    volumes:
      - cpa-manager-plus-data:/data
    networks:
      - llmproxy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:18317/health"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  cpa-manager-plus-data:
    name: cpa-manager-plus-data

networks:
  llmproxy:
    external: true
```

### 3. 启动并检查 CPAMP

```bash
cd /opt/llmproxy/cpamp
docker compose pull
docker compose up -d --wait
docker compose ps
docker compose logs --tail=100 cpa-manager-plus
```

正常情况下，`docker compose ps` 会在启动后显示 `healthy`。也可以直接检查健康接口：

```bash
docker exec cpa-manager-plus wget -qO- http://127.0.0.1:18317/health
```

## 五、接入 sub2api（可选）

这一节以已有的 `sub2api/docker-compose.yml` 和 `.env` 为前提，只调整它与 CPA 服务栈的网络关系。数据库、Redis 和镜像配置继续沿用原项目文件。

确认 `.env` 至少已经设置以下敏感字段：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `TOTP_ENCRYPTION_KEY`
- `ADMIN_PASSWORD`

应用端口保持为 `8080`：

```dotenv
BIND_HOST=0.0.0.0
SERVER_PORT=8080
SERVER_MODE=release
RUN_MODE=standard
TZ=Asia/Shanghai
```

在 sub2api 服务中加入共享网络。下面假设服务名为 `sub2api`；如果你的 Compose 使用其他名称，请同步修改 Nginx 的 `proxy_pass`：

```yaml
services:
  sub2api:
    expose:
      - "8080"
    networks:
      - default
      - llmproxy

networks:
  llmproxy:
    external: true
```

若原配置存在 `8080:8080` 一类宿主机端口映射，可以删除该映射，让 Nginx 通过 `llmproxy` 网络直接访问容器。

启动并确认状态：

```bash
cd /opt/llmproxy/sub2api
chmod 600 .env
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 sub2api
```

## 六、申请 Let's Encrypt 证书

先设置本次终端使用的域名和邮箱：

```bash
export DOMAIN="example.com"
export CERTBOT_EMAIL="admin@example.com"
```

确认 `$DOMAIN` 已经替换成真实域名，并检查解析结果：

```bash
getent ahostsv4 "$DOMAIN"
```

解析地址应与服务器公网 IP 一致。随后安装 Certbot，并开放独立验证需要的 `80/tcp`：

域名存在 AAAA 记录时，也要确认 IPv6 指向这台服务器。错误的 AAAA 记录可能让证书验证请求落到另一台主机。

```bash
sudo ufw allow 80/tcp
sudo apt update
sudo apt install -y certbot acl
sudo certbot certonly --standalone \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email
```

签发成功后，证书位于：

```text
/etc/letsencrypt/live/<DOMAIN>/
```

本文使用 `nginxinc/nginx-unprivileged` 镜像。该镜像通常以 UID `101` 运行，需要读取证书和私钥。可以先确认镜像用户：

```bash
docker run --rm --entrypoint id nginxinc/nginx-unprivileged:1.31.3-alpine
```

给 UID `101` 增加目录遍历和证书读取权限，同时设置默认 ACL，让续期生成的新文件继承权限：

```bash
sudo setfacl -m u:101:rx /etc/letsencrypt /etc/letsencrypt/live /etc/letsencrypt/archive
sudo setfacl -R -m u:101:rX "/etc/letsencrypt/live/$DOMAIN" "/etc/letsencrypt/archive/$DOMAIN"
sudo setfacl -m d:u:101:rX "/etc/letsencrypt/archive/$DOMAIN"
```

## 七、配置并启动 Nginx

### 1. 编写 Compose 文件

创建 `/opt/llmproxy/nginx/docker-compose.yml`：

```yaml
name: nginx

services:
  nginx:
    image: nginxinc/nginx-unprivileged:1.31.3-alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "9966:9966"
      - "9968:9968"
      - "9969:9969"
    volumes:
      - /opt/llmproxy/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    networks:
      - llmproxy
    healthcheck:
      test: ["CMD-SHELL", "nginx -t >/dev/null 2>&1 || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  llmproxy:
    external: true
```

::: tip 未部署 sub2api
删除 `9968:9968` 端口映射，并删除下一节 Nginx 配置中监听 `9968` 的整个 `server` 块。Nginx 启动时会解析上游服务名，配置中保留不存在的 `sub2api` 会导致启动失败。
:::

### 2. 编写 Nginx 配置

创建 `/opt/llmproxy/nginx/nginx.conf`，并将所有 `example.com` 替换成实际域名：

::: details 展开完整 nginx.conf
```nginx
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /tmp/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server_tokens off;
    underscores_in_headers on;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50m;
    client_body_timeout 360s;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 9966 ssl;
        http2 on;
        server_name example.com;

        ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://cpa:8317;
            proxy_http_version 1.1;

            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $http_host;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;

            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
        }
    }

    server {
        listen 9968 ssl;
        http2 on;
        server_name example.com;

        ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://sub2api:8080;
            proxy_http_version 1.1;

            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $http_host;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;

            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
        }
    }

    server {
        listen 9969 ssl;
        http2 on;
        server_name example.com;

        ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://cpa-manager-plus:18317;
            proxy_http_version 1.1;

            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $http_host;
            proxy_set_header X-Forwarded-Port $server_port;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;

            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
        }
    }
}
```
:::

### 3. 开放公网入口

先确认 SSH 使用的端口已经放行，再添加服务入口：

```bash
sudo ufw allow 9966/tcp
sudo ufw allow 9968/tcp
sudo ufw allow 9969/tcp
sudo ufw reload
sudo ufw status numbered
```

未部署 sub2api 时，省略 `9968/tcp`。CPA 的 `8317`、CPAMP 的 `18317` 和 sub2api 的 `8080` 没有发布到宿主机，因此无需为它们添加公网规则。

### 4. 启动并测试 Nginx

启动前扫描一次残留占位值。命令没有输出才继续：

```bash
grep -RInE 'example\.com|<CPA_MANAGEMENT_KEY>|<CLIENT_API_KEY>' /opt/llmproxy
```

```bash
cd /opt/llmproxy/nginx
docker compose pull
docker compose up -d --wait
docker exec nginx nginx -t
docker compose ps
docker compose logs --tail=100 nginx
```

## 八、完成 CPAMP 首次设置

打开：

```text
https://example.com:9969/management.html
```

使用 `/opt/llmproxy/cpamp/.env` 中的 `CPA_MANAGER_ADMIN_KEY` 登录，然后添加 CPA 连接：

| 设置项 | 填写内容 |
| --- | --- |
| CPA URL | `http://cpa:8317` |
| CPA Management Key | `cpa/config.yaml` 中的 `remote-management.secret-key` |

这里填写 Docker 内部地址，不填公网的 `https://example.com:9966`。CPAMP 和 CPA 已经加入同一个 `llmproxy` 网络，直接使用容器服务名更稳定，也省去一次外部 TLS 回环。

保存后至少确认以下结果：

- CPAMP 可以读取 CPA 基本配置。
- Provider 或认证文件页面可以正常加载。
- 首次设置中已启用请求监控，并保持 `USAGE_COLLECTOR_MODE=auto`。
- 发起新的 CPA 请求后，监控页面能够持续显示记录。

若监控一直为空，先检查 CPA 版本、HTTP 用量队列配置，以及是否有多个 Manager Server 同时消费同一个 CPA 用量队列。

## 九、端到端验证

将 `example.com` 替换成实际域名：

```bash
curl -fsS -o /dev/null -w 'CPA management: %{http_code}\n' \
  https://example.com:9966/management.html

curl -fsS https://example.com:9969/health

curl -fsS -o /dev/null -w 'CPAMP management: %{http_code}\n' \
  https://example.com:9969/management.html
```

部署了 sub2api 时再检查：

```bash
curl -fsS https://example.com:9968/health
```

常用入口：

| 服务 | 地址 |
| --- | --- |
| CPA API | `https://example.com:9966` |
| CPA 管理页 | `https://example.com:9966/management.html` |
| CPAMP 管理页 | `https://example.com:9969/management.html` |
| sub2api | `https://example.com:9968` |

## 十、证书续期和日常运维

### 配置 Nginx 自动重载

Certbot 更新证书文件后，Nginx 还需要重新加载配置。创建续期钩子：

```bash
sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx-container.sh >/dev/null <<'EOF'
#!/bin/sh
docker exec nginx nginx -s reload
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx-container.sh
```

检查定时器与续期流程：

```bash
systemctl status certbot.timer
systemctl list-timers | grep certbot
sudo certbot renew --dry-run --run-deploy-hooks
```

### 查看容器状态和日志

```bash
docker ps

docker compose -f /opt/llmproxy/cpa/docker-compose.yml logs -f cpa
docker compose -f /opt/llmproxy/cpamp/docker-compose.yml logs -f cpa-manager-plus
docker compose -f /opt/llmproxy/nginx/docker-compose.yml logs -f nginx
```

这些 `logs -f` 命令会持续跟踪日志，按 `Ctrl+C` 退出查看不会停止容器。

CPA、CPAMP 或 sub2api 升级重建后，容器 IP 可能变化。后端恢复运行后重新加载 Nginx，让静态上游名称解析到新地址：

```bash
docker exec nginx nginx -s reload
```

sub2api 的日志：

```bash
docker compose -f /opt/llmproxy/sub2api/docker-compose.yml logs -f sub2api
```

### 备份 CPAMP 数据

CPAMP 会把 SQLite 数据和 `data.key` 一起保存在 `cpa-manager-plus-data` 卷中。两者需要成套备份，否则已经加密保存的 CPA Management Key 可能需要重新录入。

进行文件级备份前先短暂停止 CPAMP：

```bash
mkdir -p /opt/llmproxy/backups
docker compose -f /opt/llmproxy/cpamp/docker-compose.yml stop
docker run --rm \
  -v cpa-manager-plus-data:/data:ro \
  -v /opt/llmproxy/backups:/backup \
  alpine:3.21 \
  sh -c 'tar -czf /backup/cpamp-$(date +%F-%H%M%S).tar.gz -C /data .'
docker compose -f /opt/llmproxy/cpamp/docker-compose.yml start
```

## 十一、常见问题

| 现象 | 优先检查 |
| --- | --- |
| Nginx 启动时报 `host not found in upstream` | 上游容器是否启动、服务名是否与 `proxy_pass` 一致、是否加入 `llmproxy` 网络 |
| 访问 `9966/9968/9969` 返回 `502` | 对应容器是否在监听内部端口，查看 Nginx 和后端日志 |
| Nginx 报证书 `Permission denied` | UID `101` 的 ACL、证书目录路径、挂载是否带 `:ro` |
| CPAMP 登录返回 `401` | 使用的是 CPAMP 管理员密钥，而不是 CPA Management Key |
| CPAMP 可以登录但连接 CPA 失败 | CPA URL 应填 `http://cpa:8317`，并核对 CPA Management Key |
| 请求监控没有数据 | CPA 版本、HTTP 用量队列、`USAGE_COLLECTOR_MODE`，以及是否存在多个消费端 |
| Codex OAuth 回调失败 | `1455` 的回环映射和 SSH `-L 1455` 转发 |
| WebSocket 请求失败 | Nginx 是否保留 `Upgrade` 与 `Connection` 代理头 |
| 证书续期后仍显示旧证书 | Certbot deploy hook 是否执行，Nginx 是否成功 reload |
