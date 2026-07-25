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

## GitHub 云端打包 APK

1. 把整个项目上传到 GitHub。
2. 在仓库 `Settings -> Secrets and variables -> Actions` 添加：
```text
MOBILE_API_BASE=https://your-domain.com
```

3. 打开 `Actions -> Build Android Debug APK`。
4. 点 `Run workflow`。
5. 构建完成后，在 `Artifacts` 下载 `lingyu-debug-apk`。

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
