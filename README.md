# 屿 Pocket AI

一个手机端 AI 陪伴 App：人物屏幕、打字字幕、摄像头/定位/语音权限、长期记忆、豆包模型和克隆音色后端。

## 先部署后端

电脑关机也能用的关键是：后端必须部署到云服务器。手机 App 只放前端界面，不能把 Ark API Key 或豆包语音 Key 写进 APK。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hygtrfdesw/-ai)

Render 会读取仓库根目录的 `render.yaml` 和 `Dockerfile` 创建 Web Service。部署时填这些环境变量：

```text
ARK_API_KEY=你的火山方舟 API Key
ARK_MODEL=doubao-seed-2-0-mini-260428
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLC_TTS_API_KEY=你的豆包语音 API Key
VOLC_TTS_VOICE_TYPE=你的克隆音色 ID
```

可选云记忆：

```text
BMOB_APP_ID=你的 Bmob Application ID
BMOB_REST_KEY=你的 Bmob REST API Key
BMOB_BASE_URL=https://api.codenow.cn/1/classes
BMOB_MEMORY_CLASS=LingyuMemory
```

部署成功后打开：

```text
https://你的后端域名/api/health
```

看到 `ok: true`，并且 `chatConfigured` / `ttsConfigured` 是 `true`，说明模型和克隆语音都连上了。

## 按小智服务端方式部署

本项目已参考 `xiaozhi-esp32-server` 的服务端部署习惯，支持：

- `docker-compose.yml` 一键启动
- `data/.config.yaml` 私有配置文件
- `data/` 数据目录挂载
- `/api/health` 健康检查

在服务器上：

```bash
git clone https://github.com/hygtrfdesw/-ai.git lingyu-pocket-ai
cd lingyu-pocket-ai
cp data/.config.example.yaml data/.config.yaml
```

编辑 `data/.config.yaml`，填你的 Ark 和豆包语音配置：

```yaml
ark:
  api_key: "你的火山方舟 API Key"
  model: "doubao-seed-2-0-mini-260428"
  base_url: "https://ark.cn-beijing.volces.com/api/v3"

tts:
  api_key: "你的豆包语音 API Key"
  voice_type: "你的克隆音色 ID"
```

启动：

```bash
docker compose up -d --build
docker compose logs -f
```

检查：

```bash
curl http://127.0.0.1:4173/api/health
```

如果是云服务器，还要在安全组/防火墙开放 `4173`，或者用 Nginx/Caddy 反代到 HTTPS。

## 再打包 APK

打开 GitHub 仓库的 `Actions -> Build Android Debug APK -> Run workflow`。

在 `api_base` 填你的公网后端地址，例如：

```text
https://lingyu-pocket-ai.onrender.com
```

构建完成后，在 `Artifacts` 下载 `lingyu-debug-apk`。

## 本地测试

本地同 WiFi 测试可以临时用电脑 IP：

```powershell
$env:ARK_API_KEY="你的 Ark Key"
$env:VOLC_TTS_API_KEY="你的豆包语音 Key"
$env:VOLC_TTS_VOICE_TYPE="你的音色 ID"
node server.mjs
```

手机端后端地址填：

```text
http://你的电脑局域网IP:4173
```

这个地址只适合测试，电脑关机后不可用。
