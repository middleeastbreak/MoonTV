# MoonTV 4.1.2 Docker 直接部署说明

本说明适用于不使用 Docker Compose、直接运行 Docker 容器，并由宿主机 Nginx 提供 HTTPS 反向代理的环境。交付镜像为 Linux AMD64 Docker 归档，导入后的本地标签为 `moontv:4.1.2`，应用内版本显示为 `4.1.2`。

## 1. 准备视频源

```bash
sudo install -d -m 0755 /opt/moontv
sudoedit /opt/moontv/config.json
```

最小示例：

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

保存后可运行 `jq empty /opt/moontv/config.json` 检查 JSON。挂载参数中的 `:ro` 表示容器只能读取该文件；容器运行期间不要删除宿主机文件。

## 2. 校验并导入镜像

从 [v4.1.2 Release](https://github.com/middleeastbreak/MoonTV/releases/tag/v4.1.2) 下载以下两个文件，并放在同一目录：

- `moontv-4.1.2-linux-amd64.tar`
- `moontv-4.1.2-linux-amd64.tar.sha256`

```bash
sha256sum -c moontv-4.1.2-linux-amd64.tar.sha256
docker load -i moontv-4.1.2-linux-amd64.tar
docker image inspect moontv:4.1.2 \
  --format 'ID={{.Id}} ARCH={{.Architecture}} SIZE={{.Size}} USER={{.Config.User}}'
```

校验结果应显示 `OK`，架构应为 `amd64`，容器用户应为 `nextjs`。

## 3. 启动 MoonTV

先生成会话签名密钥：

```bash
openssl rand -hex 32
```

不使用弹幕时：

```bash
docker run -d \
  --name moontv \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e PASSWORD='请替换为强密码' \
  -e SESSION_SECRET='请替换为上一步生成的随机字符串' \
  -e NEXT_PUBLIC_STORAGE_TYPE='localstorage' \
  -e NEXT_PUBLIC_SITE_NAME='MoonTV' \
  -v /opt/moontv/config.json:/app/config.json:ro \
  moontv:4.1.2
```

修改视频源后执行 `docker restart moontv` 即可，无需重新构建镜像。

## 4. 可选：启用弹幕

把两处 `YOUR_DANMU_TOKEN` 替换为同一个足够长的随机值：

```bash
docker run -d \
  --name danmu-api \
  --restart unless-stopped \
  -p 127.0.0.1:9321:9321 \
  -e TOKEN='YOUR_DANMU_TOKEN' \
  logvar/danmu-api:latest
```

然后在 MoonTV 的 `docker run` 参数中增加：

```bash
-e NEXT_PUBLIC_DANMU_API_BASE_URL='/danmu-api/YOUR_DANMU_TOKEN'
```

只替换 Token，保留 `/danmu-api/` 前缀。搜索接口返回作品列表不等同于弹幕正文；播放器会按作品和集数继续自动匹配。

## 5. Nginx HTTPS 反向代理

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

    location /danmu-api/ {
        proxy_pass http://127.0.0.1:9321/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 120s;
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

不使用弹幕时可以删除 `location /danmu-api/`。命令行测试弹幕接口时，如环境设置了代理，可按需使用 `curl --noproxy '*'`。

## 6. 播放与下载说明

- 首次播放、切换集数和自动换源都会主动尝试播放；浏览器禁止带声音自动播放时会提示点击播放。
- 桌面 Chrome/Edge 默认选择文件系统直写，适合大文件下载。
- iPhone 和 iPad 默认使用普通模式，不提供 Service Worker 流式下载，避免 Safari 将视频保存成无法播放的 `.ts.html` 文件。
- 移动浏览器内存有限，建议逐集下载较小文件；整季批量下载仅在支持目录访问的桌面浏览器中提供。

## 7. 验证与更新

```bash
docker ps --filter name=moontv
docker logs --tail 100 moontv
curl -I http://127.0.0.1:3000/login
```

更新镜像时，应先下载并导入新版本归档，再使用原有环境变量和挂载参数重新创建容器。不要仅执行 `docker restart`，因为重启不会更换镜像。
