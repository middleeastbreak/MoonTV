# MoonTV

<div align="center">
  <img src="public/logo.png" alt="MoonTV Logo" width="120">
</div>

MoonTV 是一个基于 Next.js 的影视聚合播放器，支持多源搜索、HLS 在线播放、播放记录、收藏、弹幕和多种存储后端。

本仓库是 [Stardm0/MoonTV](https://github.com/Stardm0/MoonTV) 的个人维护分支；项目源自 [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV)。

> 本项目不内置视频源，也不存储、上传或分发任何视频内容。部署后需要自行提供合法的视频源配置。

## 当前版本

- 正式版：`4.0.4`
- Git 标签：`v4.0.4`
- 本地预览版：`4.1.0-preview.1`（未推送远端）
- [v4.0.4 Release](https://github.com/middleeastbreak/MoonTV/releases/tag/v4.0.4)
- [完整变更记录](CHANGELOG)

## 主要功能

- 多视频源聚合搜索与在线播放
- ArtPlayer + HLS.js 播放器
- 播放记录、收藏、续播提示和断线恢复
- 键盘快捷键和迷你进度条
- 弹幕自动匹配和显示设置
- 长选集标题自适应
- iPad、手机和桌面端响应式布局
- localStorage、Redis、Kvrocks、Upstash 和 Cloudflare D1 存储
- PWA 安装、TVBox 接口和 M3U8 下载

## v4.1.0-preview.1 预览功能

- 搜索保留原有精确结果；无直接匹配时，额外显示可关闭的相近标题和拼音纠错建议。
- 同一季的空格、数字和季数写法会合并；不同季、不同年份及电影解说保持独立，例如“问心”和“问心 2”分开显示。
- 播放源彻底恢复失败后，5 秒倒计时自动切换健康的备用源，可取消且最多尝试两个源。
- 手机和 iPad 首次升级默认关闭自动弹幕，手动打开时提示耗电和发热；默认透明度为 75%。
- 下载弹窗增加一键下载当前整季，按集串行执行并分别显示下载结果。
- MP4 转封装逻辑未改动，避免在缺少可复现样本时引入新的声画同步风险。

## v4.0.4 更新

### 播放体验

- 升级 ArtPlayer 5.4.0 与 HLS.js 1.6.16，改善 HLS 播放兼容性和稳定性。
- 支持键盘快捷键、续播提示、迷你进度条和更可靠的断线恢复。
- 修复空格快捷键重复响应，以及显示播放但视频没有实际播放的问题。
- 切换视频或集数时等待新视频可播放后再结束加载提示，减少弱网环境下的黑屏。
- 修复切换视频后返回主页，旧视频仍在后台发声且无法暂停的问题。
- 防止旧播放任务的延迟回调干扰新播放器。

### 界面与交互

- 选集按钮根据标题长度自动调整，特别篇、预热版等长标题不再重叠。
- 修复播放器、卡片悬浮效果和弹幕加载提示遮挡顶部导航的问题。
- 弹幕自动匹配失败提示会在短暂停留后自动消失。
- 全屏隐藏控制栏时不再持续显示迷你进度条。
- 优化用户信息与版本展示，更新网站 Logo 和应用图标。

### 弹幕

- 将弹幕开关整合进弹幕设置，播放器控制栏只保留一个入口。
- 自动匹配默认开启，显示区域默认为四分之一屏。
- 默认同步视频速度，并使用较慢的弹幕速度。

## Docker 直接部署

本维护分支主要验证 `docker run` 配合宿主机 `config.json`、Nginx HTTPS 反向代理及可选独立弹幕 API 的部署方式。

### 1. 下载并导入镜像

从 [v4.0.4 Release](https://github.com/middleeastbreak/MoonTV/releases/tag/v4.0.4) 下载：

- `moontv-4.0.4-linux-amd64.tar`
- `moontv-4.0.4-linux-amd64.tar.sha256`

```bash
sha256sum -c moontv-4.0.4-linux-amd64.tar.sha256
docker load -i moontv-4.0.4-linux-amd64.tar
```

### 2. 准备视频源

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

MoonTV 支持苹果 CMS V10 API。保存后建议执行：

```bash
jq empty /opt/moontv/config.json
```

### 3. 启动容器

先生成独立的会话签名密钥：

```bash
openssl rand -hex 32
```

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
  moontv:4.0.4
```

`config.json` 是只读挂载来源，容器运行期间不要删除宿主机上的文件。修改视频源后重启容器即可，无需重新构建镜像。

```bash
docker restart moontv
docker logs --tail 100 moontv
```

### 4. Nginx、HTTPS 与弹幕

完整的 Nginx 配置、弹幕 API 和部署验证步骤见：

- [MoonTV 4.0.4 Docker 直接部署说明](artifacts/docker/DEPLOYMENT-4.0.4.md)
- [MoonTV 4.1.0-preview.1 Docker 直接部署说明](artifacts/docker/DEPLOYMENT-4.1.0-preview.1.md)

使用弹幕时，建议通过 Nginx 将 `/danmu-api/` 同域转发到弹幕容器，避免 HTTPS 混合内容。文档中的 `YOUR_DANMU_TOKEN` 必须在部署时替换为自己的 Token，并保证两个容器的配置一致。

## 常用环境变量

| 变量                             | 用途                                                  | 默认值              |
| -------------------------------- | ----------------------------------------------------- | ------------------- |
| `PASSWORD`                       | localStorage 模式登录密码；其他模式下为站长密码       | 无，必须设置        |
| `SESSION_SECRET`                 | 会话签名密钥，建议使用 `openssl rand -hex 32` 生成    | 回退使用 `PASSWORD` |
| `USERNAME`                       | Redis、Kvrocks、Upstash、D1 模式的站长账号            | 空                  |
| `NEXT_PUBLIC_STORAGE_TYPE`       | `localstorage`、`redis`、`kvrocks`、`upstash` 或 `d1` | `localstorage`      |
| `NEXT_PUBLIC_SITE_NAME`          | 网站名称                                              | `MoonTV`            |
| `NEXT_PUBLIC_DANMU_API_BASE_URL` | 弹幕 API 地址，例如 `/danmu-api/YOUR_DANMU_TOKEN`     | 空                  |
| `NEXT_PUBLIC_ENABLE_REGISTER`    | 是否允许注册，仅非 localStorage 模式生效              | `false`             |
| `REDIS_URL`                      | Redis 连接地址                                        | 空                  |
| `KVROCKS_URL`                    | Kvrocks 连接地址                                      | 空                  |
| `UPSTASH_URL`                    | Upstash HTTPS Endpoint                                | 空                  |
| `UPSTASH_TOKEN`                  | Upstash Token                                         | 空                  |
| `TVBOX_ENABLED`                  | localStorage 模式是否启用 TVBox 接口                  | `true`              |
| `CRON_SECRET`                    | 定时刷新接口验证密钥                                  | 回退使用 `PASSWORD` |
| `ALLOW_PRIVATE_SOURCE`           | 是否允许服务端访问私网视频源                          | `false`             |

`NEXT_PUBLIC_` 开头的变量会提供给浏览器，不能用于保存真正的秘密。

## 存储说明

- `localstorage`：无需外部数据库，记录和设置保存在当前浏览器；清除站点数据后会丢失。
- `redis` / `kvrocks`：适合自托管多用户部署，需要配置持久化和备份。
- `upstash`：使用 Upstash Redis HTTP 接口。
- `d1`：用于 Cloudflare D1 部署。

非 localStorage 模式可以通过 `/admin` 管理用户、视频源和站点配置。

## 更新镜像

仅执行 `docker restart` 不会切换镜像版本。更新前先备份 `/opt/moontv/config.json` 并记录当前容器参数，然后停止并删除旧容器，导入新镜像后使用相同参数重新创建容器。

## 技术栈

- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS 3
- ArtPlayer 5.4.0
- HLS.js 1.6.16
- Jest、ESLint、Prettier

## 使用说明

- 请为公开网络上的实例配置强密码和 HTTPS。
- 请勿公开分享个人实例、访问口令或包含私人视频源的配置文件。
- 本项目仅供学习和个人使用，请遵守所在地法律法规及内容来源的使用条款。

## License

[MIT](LICENSE)

## 致谢

- [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV)
- [Stardm0/MoonTV](https://github.com/Stardm0/MoonTV)
- [LibreTV](https://github.com/LibreSpark/LibreTV)
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer)
- [HLS.js](https://github.com/video-dev/hls.js)
- [danmu_api](https://github.com/huangxd-/danmu_api)
