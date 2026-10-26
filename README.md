# 云听

使用 Expo SDK 57、React Native、TypeScript 和 Expo Router 实现的非官方网易云音乐学习客户端。采用经典浅色红白视觉，主导航为发现、歌单、我的。

## React 前端开发者学习

如果你熟悉 React、TypeScript 和常见前端工程，但不会 Expo/RN，先看 [Expo/RN 学习指南](LEARNING.md)：重点是 RN 与 DOM/CSS 的差异、Expo Router、Provider 组合、项目数据流，以及 Web 与原生平台的边界。

## 运行

需要 Node.js 22.12+ 和 npm，推荐使用当前电脑上的 Node.js 24。本项目使用的依赖版本由 `package-lock.json` 固定。

```bash
npm ci
# 终端 1：直接启动 npm 包提供的 API 服务
npm run api:start
# 终端 2：启动 Web 预览，读取根目录 .env 中的接口地址
npm run web
```

在浏览器打开终端显示的 Web 地址，默认是 `http://localhost:8081`。当前使用网页检查界面和前台交互，不需要 Android SDK、模拟器或 APK。`android/` 生成的原生工程已删除，后续不为网页预览重新生成。

歌单、歌曲、封面、歌词和音源均来自已配置的真实 API。本地演示歌单、测试音频及生成脚本已移除；未配置 API 时明确提示配置，接口失败时显示错误与重试，不会用演示数据替代。

## npm 本地后端与 App 接入

`NeteaseCloudMusicApi@4.32.0` 作为开发依赖安装在项目根目录的 `node_modules/`，由根目录 `package-lock.json` 固定版本。`npm run api:start` 直接调用这个包提供的 `NeteaseCloudMusicApi` 命令，不需要额外的后端项目、启动脚本或配置模块，也不需要克隆 GitHub/GitLab。

网页代码不会导入这个服务端包，因此它不会进入网页业务包。API 与 Expo 仍是两个独立进程，需要分别保持运行。

不设置进程环境变量时，API 默认端口为 `3000`，监听所有网卡；如需限制监听地址或更改端口，可在启动终端中设置 `HOST`、`PORT`。根目录 `.env` 只配置 App 的 `EXPO_PUBLIC_API_BASE_URL`，这个 API 命令不会读取该文件。匿名会话文件由上游包自动写入系统临时目录，不需要在项目中维护。

启动后在电脑上访问：

```text
http://127.0.0.1:3000/banner?type=1
http://127.0.0.1:3000/personalized?limit=3
http://127.0.0.1:3000/cloudsearch?keywords=hello&limit=10
```

App 基础地址只包含协议、主机和端口，不包含具体接口路径。本机根目录 `.env` 已设置为 `http://192.168.110.30:3000`；电脑 IP 变化时需要更新。换一台电脑时按以下步骤配置：

1. 编辑项目根目录的 `.env`；文件不存在时新建。
2. 填入你的服务地址，例如：

   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000
   ```

3. 完全重启 Expo；如仍读到旧配置，用 `npx expo start --clear`。
4. 打开 App 的“设置与接口配置”，点击“检测接口连接”。

注意：

- 真机使用电脑局域网 IP，两者在同一网络；手机的 `localhost` 指向手机自身。
- Android 模拟器访问电脑可用 `http://10.0.2.2:3000`。
- 后端须监听可供局域网访问的网卡；确认防火墙放行端口。
- `.env` 中只放公开 API 地址，不要放 Cookie、密码或其他密钥。Expo 公共变量会进入应用包。
- HTTP 仅用于可信局域网开发；正式分发使用自己控制的 HTTPS 服务。
- 接口文档与实际拉取的代码版本可能不同，真实响应需要按你的服务版本联调。
- 本次 npm 安装检测到第三方依赖的安全告警，部分修复需要不兼容的版本调整。当前没有强制降级或更换上游版本；服务不得端口映射到公网，生产部署前须处理依赖与访问控制风险。

## 已实现的客户端范围

- 发现：Banner、推荐歌单、每日推荐入口、排行榜。
- 搜索：热搜、本地历史、输入建议、单曲和歌单结果分页。
- 歌单：详情、歌曲独立分页、播放全部、收藏及取消收藏。
- 播放：应用级共享播放器、迷你播放器、上一首/下一首、seek、顺序/随机/单曲循环、队列、同步歌词、黑胶旋转。
- 我的：个人信息、喜欢的音乐、用户歌单、本地最近播放。
- 账号：游客浏览、验证码登录、二维码登录流程、会话恢复和退出。

以上是源码实现范围，不等于所有真实接口和原生行为均已验收。本地 npm 后端已接入；真实账号登录、日推、收藏及设备播放仍需分别验收。

不包含云村、MV、播客、下载、会员购买、歌单编辑、评论发布，不提供版权/会员绕过。空音源和试听会明确提示。

## 原生播放与 Android 构建

以下仅供以后需要原生版本时使用，当前 Web 预览无需执行。

`expo-audio` 在根布局保有唯一实例。播放状态和进度来自原生播放器，页面不会另开计时器模拟进度。原生配置启用媒体播放前台服务及 iOS audio 后台模式，不申请麦克风权限。

```bash
# 需要 Android SDK、JDK 17 和对应的 SDK/NDK
npm run android
```

开发 APK 依赖 Metro，并不是离线可启动的正式安装包。后台能力必须在 development/release build 上测试，不能以 Expo Go 或浏览器测试替代。

Windows 的 Android 模拟器建议使用 LAN 监听模式，避免 `--host localhost` 仅绑定 IPv6 而 ADB 转发走 IPv4：

```bash
npx expo start --dev-client --host lan
adb reverse tcp:8081 tcp:8081
```

首次打开 development build 会显示 Expo 开发菜单，点击 Continue 进入 App。这不是应用本身的页面。

```bash
# 本地 development APK
npx expo prebuild --platform android
cd android
./gradlew :app:assembleDebug --no-daemon
# 产物: android/app/build/outputs/apk/debug/app-debug.apk
```

如果使用 EAS，先配置你自己的 Expo 账号与项目，再运行：

```bash
npx eas-cli build --platform android --profile preview
```

`preview` 配置生成包含 JS 的测试 APK；正式上架使用自己的签名。不要将临时调试签名当作生产签名。

## iOS

Windows 无法本地使用 Xcode 编译或运行 iOS Simulator。iOS 构建配置已包含在 `app.config.ts` 和 `eas.json`，可用 macOS 或 EAS 云构建：

```bash
npx eas-cli build --platform ios --profile development
```

真机安装需要对应 Apple 开发者账号、签名和设备配置；本项目不会伪造凭据或绕过签名。

## 检查与待验收

```bash
npm run typecheck
npm run lint
npm test
npx expo install --check
```

重点测试覆盖 LRC 多时间戳、毫秒精度、offset、空歌词、顺序/随机/循环队列边界，以及 Cookie 不进 URL、请求缓存隔离、HTTP 认证失败、二维码等待状态和不同歌曲响应格式的适配。

本机已验证：TypeScript、ESLint、8 项测试、Expo 依赖兼容检查，以及 Web 首页从真实 API 加载推荐歌单。此前进行过 Android development APK 构建和模拟器测试，但生成的原生目录与测试音频现已删除，这些历史检查不等于当前真实音源和原生能力已验收。

本地后端已通过 App 请求层的真实只读检查：Banner、推荐歌单、排行榜、搜索、歌单首批歌曲、歌词和一个可用音源地址。新游客注册在本次检查中返回 `code: 400`，已报告而不是模拟成功；公开接口仍可依赖服务端初始化的匿名会话返回数据。尚未验证真实账号与真机网络，也未把“拿到音源地址”等同于设备播放成功。

仍须实测：

- 真实服务的搜索、分页、受限歌曲、Cookie 恢复及收藏闭环。
- Android/iOS 锁屏超过数分钟、后台跨曲播放、媒体信息更新、音频中断和耳机拔出。
- `expo-audio` 的单播放器系统媒体 API 不提供应用队列的上一首/下一首事件；系统 seek 按钮不能当作切歌。当前应用内切歌已实现，但系统队列切歌未实现、不能标为完成。若这是必需项，须在原生验收后评估调整播放器方案。
- 后台自动换曲目前依赖播放结束事件进入应用控制器，不能仅凭前台成功就承诺 iOS 长期后台可靠性。
- iOS 真机安全区和原生交互。

## 核心目录

- `src/app/`：Expo Router 路由页面。`(tabs)/index.tsx` 是发现首页，`(tabs)/mine.tsx` 是我的页面，`playlist/[id].tsx` 是歌单详情；`_layout.tsx`、`index.tsx`、`[id].tsx` 保留框架约定名称。
- `src/account/`：账号模块。`accountStore.ts` 管理登录会话与安全存储，`accountQueries.ts` 提供喜欢的音乐、用户歌单及喜欢/取消喜欢歌曲的 Hook。
- `src/player/`：播放模块。`AudioPlayerProvider.tsx` 管理共享音频播放器，`playbackStore.ts` 保存播放状态，`playbackQueue.ts` 处理切歌规则，`lyricParser.ts` 解析带时间戳的歌词。
- `src/history/historyStore.ts`：本地搜索历史与最近播放记录。
- `src/api/`：网易云 API。`neteaseApi.ts` 提供业务接口，`apiRequest.ts` 处理 HTTP 请求、Cookie 与接口错误，`responseAdapters.ts` 转换响应数据，`musicTypes.ts` 定义歌曲、歌单和用户等数据类型。
- `src/components/`：共享界面组件。`MusicCover.tsx` 是音乐封面，`PageStateView.tsx` 显示加载、空内容与错误状态，`PlaybackQueueModal.tsx` 是播放队列弹窗；其余按界面用途命名。
- `src/config/`：配置。`apiConfig.ts` 读取并校验 API 地址，`queryClient.ts` 配置接口缓存与重试策略。
- `src/styles/theme.ts`：主题颜色与间距。
- `src/utils/formatters.ts`：播放次数、时长与错误提示等展示辅助函数。

视觉参考采用[网易云音乐 6.0 公开介绍中的经典界面](http://ent.people.com.cn/n1/2019/0327/c1012-30999007.html)的布局语言，但未使用官方 logo，也不是官方应用或最新版全量复刻。
