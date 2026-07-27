# MoonTV 4.0.4 Docker 直接部署说明

本文档适用于不使用 Docker Compose、通过 `docker run` 部署 MoonTV，并由宿主机 Nginx 提供 HTTPS 反向代理的环境。

## 1. 交付物

| 文件                                  | 说明                    |
| ------------------------------------- | ----------------------- |
| `moontv-4.0.4-linux-amd64.tar`        | Linux AMD64 Docker 镜像 |
| `moontv-4.0.4-linux-amd64.tar.sha256` | SHA-256 校验文件        |
| `DEPLOYMENT-4.0.4.md`                 | 本部署说明              |

镜像标签为 `moontv:4.0.4`，平台为 `linux/amd64`，容器以非 root 用户 `nextjs` 运行并监听 `3000/tcp`。

## 2. 校验并导入镜像

将三个交付文件放到同一目录后执行：

```bash
sha256sum -c moontv-4.0.4-linux-amd64.tar.sha256
docker load -i moontv-4.0.4-linux-amd64.tar
docker image inspect moontv:4.0.4 \
  --format 'ID={{.Id}} ARCH={{.Architecture}} SIZE={{.Size}} USER={{.Config.User}}'
```

校验结果应为 `moontv-4.0.4-linux-amd64.tar: OK`。

## 3. 准备视频源配置

```bash
sudo install -d -m 0755 /opt/moontv
sudoedit /opt/moontv/config.json
```

示例：

```json
{
  "cache_time": 7200,
  "api_site": {
    "example": {
      "api": "https://example.com/api.php/provide/vod",
      "name": "示例视频源",
      "detail": "https://example.com"
    }
  }
}
```

保存后校验：

```bash
jq empty /opt/moontv/config.json
```

挂载参数末尾的 `:ro` 表示容器只读。容器运行期间不能删除宿主机上的 `config.json`，它是容器内 `/app/config.json` 的挂载来源。

## 4. 可选：启动弹幕 API

把下面两处 `YOUR_DANMU_TOKEN` 替换为同一个自定义 Token。请使用足够长的随机值，不要把真实 Token 提交到公开仓库。

```bash
docker run -d \
  --name danmu-api \
  --restart unless-stopped \
  -p 127.0.0.1:9321:9321 \
  -e TOKEN='YOUR_DANMU_TOKEN' \
  logvar/danmu-api:latest
```

验证接口：

```bash
curl -sS -D - --max-time 30 \
  -G 'http://127.0.0.1:9321/YOUR_DANMU_TOKEN/api/v2/search/anime' \
  --data-urlencode 'keyword=凡人修仙传'
```

返回 HTTP 200 且正文不为空即为正常。

## 5. 启动 MoonTV 4.0.4

先生成会话签名密钥：

```bash
openssl rand -hex 32
```

启用弹幕时运行：

```bash
docker run -d \
  --name moontv \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e PASSWORD='请替换为强密码' \
  -e SESSION_SECRET='请替换为上一步生成的随机字符串' \
  -e NEXT_PUBLIC_STORAGE_TYPE='localstorage' \
  -e NEXT_PUBLIC_SITE_NAME='MoonTV' \
  -e NEXT_PUBLIC_DANMU_API_BASE_URL='/danmu-api/YOUR_DANMU_TOKEN' \
  -v /opt/moontv/config.json:/app/config.json:ro \
  moontv:4.0.4
```

不使用弹幕时，删除 `NEXT_PUBLIC_DANMU_API_BASE_URL` 那一行。启用时只替换 `YOUR_DANMU_TOKEN`，保留前面的 `/danmu-api/`，并确保它与弹幕容器的 `TOKEN` 完全一致。

```bash
docker ps --filter name=moontv
docker logs --tail 100 moontv
curl -I http://127.0.0.1:3000/login
```

`localstorage` 模式无需 Redis，但播放记录、收藏和设置只保存在当前浏览器，清理站点数据后会丢失。

## 6. Nginx 反代与 HTTPS

替换域名和证书路径：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name tv.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tv.example.com;

    ssl_certificate     /etc/letsencrypt/live/tv.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tv.example.com/privkey.pem;
    client_max_body_size 20m;

    # 末尾斜杠用于移除 /danmu-api/ 前缀。
    location /danmu-api/ {
        proxy_pass http://127.0.0.1:9321/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 部署后验证

```bash
curl -I http://127.0.0.1:3000/login
curl -I https://tv.example.com/login
curl -sS -D - --max-time 30 \
  -G 'https://tv.example.com/danmu-api/YOUR_DANMU_TOKEN/api/v2/search/anime' \
  --data-urlencode 'keyword=凡人修仙传'
```

浏览器重点检查：

1. 用户菜单显示 `v4.0.4`；
2. 播放视频后切换另一个视频，再返回主页，旧视频不应继续发声；
3. 弱网或切换集数时应持续显示加载状态，直至新视频可播放；
4. 滚动页面或悬浮首页卡片时，播放器、卡片和弹幕加载提示不应覆盖顶部导航；
5. 弹幕自动匹配失败提示应在短暂停留后自动消失；
6. 弹幕设置、长选集标题、空格播放快捷键、续播提示与断线恢复正常。

## 8. 更新视频源

```bash
sudoedit /opt/moontv/config.json
jq empty /opt/moontv/config.json
docker restart moontv
docker logs --tail 100 moontv
```

修改视频源不需要重新构建镜像，但宿主机配置文件必须持续保留。

## 9. 更新容器

更新前先记录容器参数并备份配置：

```bash
sudo cp /opt/moontv/config.json /opt/moontv/config.json.backup
docker inspect moontv > /opt/moontv/moontv-container-backup.json
docker stop moontv
docker rm moontv
```

导入新版镜像后，按第 5 节使用原有参数重新创建容器。只执行 `docker restart` 不会切换镜像版本。

## 10. 常见错误

- 弹幕接口返回 `401`：URL 中 Token 与弹幕容器的 `TOKEN` 不一致。
- 弹幕接口返回空正文 `400`：检查 Token 是否含特殊字符，并使用 `--data-urlencode`。
- HTTPS 页面无弹幕：确认使用 `/danmu-api/YOUR_DANMU_TOKEN`，且 Nginx 的弹幕 `proxy_pass` 末尾有 `/`。
- 图标或界面仍是旧版：强制刷新并清除该站点缓存；PWA 图标可能需要删除桌面快捷方式后重新添加。
