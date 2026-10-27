# 云听

一个使用 Expo、React Native、TypeScript 和 Expo Router 开发的音乐客户端学习项目，可进行 Web 预览，并保留 Android 和 iOS 构建配置。

## 使用与版权声明

> 本项目仅供 React Native 和 Expo 技术学习与交流，不是网易云音乐官方应用，也不提供任何音乐内容、会员权益或版权授权。

- 禁止利用本项目侵犯著作权、商标权、隐私权或其他合法权益，禁止绕过付费、会员及版权限制。
- 未经相关权利人明确授权，不得将项目涉及的名称、界面素材、音乐、封面、歌词、接口数据等用于商业运营、收费服务或再次分发。
- 音乐、封面、歌词、商标及相关数据的权利归各自权利人所有。使用者应遵守所在地法律法规和相关服务条款，并自行确认数据来源及使用方式已获得授权。
- 本仓库的 MIT 许可仅适用于仓库作者有权许可的源代码，不代表对任何第三方内容、商标、接口或数据授予许可。
- 因违法、侵权或违反第三方服务条款使用本项目所产生的责任，由使用者自行承担。

如认为仓库中的内容侵犯了你的合法权益，可通过仓库 Issue 联系处理。

## 主要功能

- 发现：Banner、推荐歌单、每日推荐和排行榜。
- 搜索：热搜、历史记录、搜索建议、单曲和歌单分页。
- 歌单：详情、歌曲分页、播放全部和收藏。
- 播放：播放队列、进度控制、切歌、循环模式和同步歌词。
- 我的：个人信息、喜欢的音乐、用户歌单和最近播放。
- 账号：游客浏览、验证码登录、二维码登录、会话恢复和退出。

以上是源码实现范围，真实账号功能和原生后台播放仍需实机验证。

## 快速开始

需要 Node.js 22.12+ 和 npm。

```bash
npm ci
```

项目需要同时运行 API 服务和 Expo。请打开两个终端：

```bash
# 终端 1：启动本地 API，默认端口为 3000
npm run api:start

# 终端 2：启动 Web 预览
npm run web
```

Web 默认地址为 `http://localhost:8081`。

## 配置 API 地址

在项目根目录创建或修改 `.env`：

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000
```

地址根据运行环境填写：

- Web：`http://127.0.0.1:3000`
- Android 模拟器：`http://10.0.2.2:3000`
- 真机：使用电脑的局域网 IP，并确保手机和电脑连接同一网络。

修改 `.env` 后需要重启 Expo。如果配置没有更新，运行：

```bash
npx expo start --clear
```

`.env` 中不要保存 Cookie、密码或其他密钥。Expo 的公开环境变量会写入应用包。

本地 API 仅用于开发，请勿直接暴露到公网。

## 原生运行与构建

运行 Android 项目需要 Android SDK 和 JDK 17：

```bash
npm run android
```

使用 EAS 构建测试安装包：

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile development
```

Windows 无法在本地使用 Xcode 构建 iOS，需要使用 macOS 或 EAS 云构建。

## 代码检查

```bash
npm run typecheck
npm run lint
npm test
npx expo install --check
```

## 主要目录

- `src/app/`：页面和路由。
- `src/api/`：API 请求、响应转换和数据类型。
- `src/account/`：登录状态和账号数据。
- `src/player/`：播放器、播放队列和歌词解析。
- `src/components/`：共享组件。
- `src/config/`：API 和请求缓存配置。
- `src/history/`：搜索历史和最近播放。
- `src/styles/`：主题样式。
- `src/utils/`：通用工具函数。
