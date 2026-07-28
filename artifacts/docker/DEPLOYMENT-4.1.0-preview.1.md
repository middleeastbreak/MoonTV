# MoonTV 4.1.0-preview.1 Docker 直接部署说明

本说明适用于不使用 Docker Compose、直接运行 Docker 容器，并由宿主机 Nginx 提供 HTTPS 反向代理的环境。本预览版仅在本地交付，没有推送 GitHub 或镜像仓库。

## 1. 交付物

| 文件 | 说明 |
| --- | --- |
| `moontv-4.1.0-preview.1-linux-amd64.tar` | Linux AMD64 Docker 镜像 |
| `moontv-4.1.0-preview.1-linux-amd64.tar.sha256` | SHA-256 校验文件 |
| `DEPLOYMENT-4.1.0-preview.1.md` | 本说明 |

镜像标签是 `moontv:4.1.0-preview.1`，应用内版本显示为 `4.1.0`。

## 2. 校验并导入镜像

将三个文件放在同一目录：

```bash
sha256sum -c moontv-4.1.0-preview.1-linux-amd64.tar.sha256
docker load -i moontv-4.1.0-preview.1-linux-amd64.tar
docker image inspect moontv:4.1.0-preview.1 \
  --format 'ID={{.Id}} ARCH={{.Architecture}} SIZE={{.Size}} USER={{.Config.User}}'
```

校验结果应显示 `OK`，架构应为 `amd64`，容器用户应为 `nextjs`。

## 3. 准备视频源

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

```bash
jq empty /opt/moontv/config.json
```

挂载参数末尾的 `:ro` 表示容器只能读取该文件。容器运行期间不能删除宿主机上的 `config.json`；修改视频源后重启 MoonTV 容器即可。

## 4. 可选：启动弹幕 API

把以下两处 `YOUR_DANMU_TOKEN` 替换成同一个足够长的随机值：

```bash
docker run -d \
  --name danmu-api \
  --restart unless-stopped \
  -p 127.0.0.1:9321:9321 \
  -e TOKEN='YOUR_DANMU_TOKEN' \
  logvar/danmu-api:latest
```

```bash
curl --noproxy '*' -sS -D - --max-time 30 \
  -G 'http://127.0.0.1:9321/YOUR_DANMU_TOKEN/api/v2/search/anime' \
  --data-urlencode 'keyword=凡人修仙传'
```

返回 HTTP 200 且正文包含 `animes` 即表示弹幕搜索接口正常。搜索响应只列出作品；实际弹幕会在播放时按作品和集数继续匹配。

## 5. 启动 MoonTV

生成会话签名密钥：

```bash
openssl rand -hex 32
```

启用弹幕时：

```bash
docker run -d \
  --name moontv-preview \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e PASSWORD='请替换为强密码' \
  -e SESSION_SECRET='请替换为上一步生成的随机字符串' \
  -e NEXT_PUBLIC_STORAGE_TYPE='localstorage' \
  -e NEXT_PUBLIC_SITE_NAME='MoonTV' \
  -e NEXT_PUBLIC_DANMU_API_BASE_URL='/danmu-api/YOUR_DANMU_TOKEN' \
  -v /opt/moontv/config.json:/app/config.json:ro \
  moontv:4.1.0-preview.1
```

不使用弹幕时删除 `NEXT_PUBLIC_DANMU_API_BASE_URL` 那一行。启用时只替换 `YOUR_DANMU_TOKEN`，保留 `/danmu-api/` 前缀。

```bash
docker ps --filter name=moontv-preview
docker logs --tail 100 moontv-preview
curl -I http://127.0.0.1:3000/login
```

## 6. Nginx HTTPS 反向代理

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

    location /danmu-api/ {
        # 末尾斜杠会去掉 /danmu-api/ 前缀。
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

宿主机的系统代理 `127.0.0.1:8118` 无需修改。容器间或 Nginx 到 `127.0.0.1:9321` 的本地通信不应经过该代理；命令行测试受代理变量影响时使用 `curl --noproxy '*'`。

## 7. 预览版功能验证

1. 用户菜单的版本信息显示 `4.1.0`。
2. 规范标题进入直接结果；只有没有直接匹配时才显示“可能想找”，关闭“智能搜索纠错”后不再出现。
3. 同一季的不同写法正确合并，不同季和不同内容类型保持独立。
4. 手机或 iPad 首次打开本版时自动弹幕默认关闭；手动开启显示耗电提示，弹幕透明度默认 75%。
5. 播放线路彻底恢复失败后出现较长的换源倒计时；可取消，最多尝试两个备用源。
6. 播放器设置中的“播放诊断”可复制脱敏信息，内容不应包含播放 URL、Token、账号或密码。
7. 下载弹窗显示“一键下载整季（N 集）”；文件系统直写只选择一次目录，整季任务一次性加入列表后逐集开始。

整季下载依赖浏览器保持页面打开。浏览器可能对连续保存多个文件弹出授权提示，请允许该站点下载多个文件。大文件建议选择 Service Worker 流式下载或文件系统直写；移动端 Safari 的超大单集仍可能受到系统内存限制。

## 8. 更新、回退与清理

该预览版使用独立容器名和镜像标签，不会覆盖 `moontv:4.0.4`。切回正式版时停止预览容器，再用原参数启动 `moontv:4.0.4`。

```bash
docker stop moontv-preview
docker rm moontv-preview
```

确认不再需要预览镜像后才执行：

```bash
docker image rm moontv:4.1.0-preview.1
```

不要删除 `/opt/moontv/config.json`，除非已停止所有使用该挂载的 MoonTV 容器并确认有备份。
