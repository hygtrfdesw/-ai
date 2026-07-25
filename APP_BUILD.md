# 屿 手机 App 打包说明

## 现在已经完成

- 已用 Capacitor 生成 Android 工程：`android/`
- 手机端前端资源目录：`mobile-www/`
- 云端 APK 构建流程：`.github/workflows/android-debug.yml`
- App 权限已加入：麦克风、相机、定位、联网

## 重要

手机 App 不能调用你电脑上的 `localhost` 后端。要让别人也能用，需要先把 `server.mjs` 部署到公网服务器，然后把公网地址写进 App。

例如后端地址：
```text
https://your-domain.com
```

不要把 Ark API Key、豆包语音 Key 写进前端或 App 里。它们只应该放在服务器环境变量里。

## 电脑关机也能用

电脑关机后还要能用，必须把后端部署到云服务器。当前项目已经准备好 Docker 部署文件：

- `Dockerfile`
- `.dockerignore`
- `render.yaml`

可以部署到 Render、Railway、Zeabur、火山云服务器、阿里云、腾讯云等支持 Node/Docker 的平台。

云服务器环境变量至少要填：

```text
ARK_API_KEY=你的火山方舟 API Key
ARK_MODEL=doubao-seed-2-0-mini-260428
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLC_TTS_API_KEY=你的豆包语音 API Key
VOLC_TTS_VOICE_TYPE=你的克隆音色 ID
```

如果要云记忆，再填：

```text
BMOB_APP_ID=你的 Bmob Application ID
BMOB_REST_KEY=你的 Bmob REST API Key
BMOB_BASE_URL=https://api.codenow.cn/1/classes
BMOB_MEMORY_CLASS=LingyuMemory
```

部署成功后访问：

```text
https://你的后端域名/api/health
```

如果返回 `ok: true`，说明后端在线。

## GitHub 云端打包 APK

1. 把整个项目上传到 GitHub。
2. 在仓库 `Settings -> Secrets and variables -> Actions` 添加：
```text
MOBILE_API_BASE=https://your-domain.com
```

3. 打开 `Actions -> Build Android Debug APK`。
4. 点 `Run workflow`。
5. 如果没有添加 Secret，也可以在 `api_base` 输入框手动填后端公网地址。
6. 构建完成后，在 `Artifacts` 下载 `lingyu-debug-apk`。

注意：不要用 `192.168.x.x` 这种局域网地址做正式 APK。它只在手机和电脑连同一个 WiFi、电脑开机时可用。

## 本地准备手机资源

```powershell
$env:MOBILE_API_BASE="https://your-domain.com"
node scripts/prepare-mobile.mjs
npx cap sync android
```

## 本地打 APK

本地需要安装：

- JDK 21
- Android Studio / Android SDK

然后运行：
```powershell
cd android
.\gradlew.bat assembleDebug
```

生成位置：
```text
android/app/build/outputs/apk/debug/app-debug.apk
```
