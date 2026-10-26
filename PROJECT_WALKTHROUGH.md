# 从源码学 React Native 与 Expo：云听项目详解

这份文档不是知识点清单，而是一份配着源码读的项目教程。目标是：你看完一个功能之后，知道它的界面如何用 RN 写出来、Expo 提供了什么能力、代码为什么这样组织，以及自己下一步可以改什么。

原来的 [LEARNING.md](LEARNING.md) 保留不变。这份教程以当前项目源码为依据，覆盖两个路由布局、全部 11 个页面，以及页面背后的共享组件、数据层和音频模块。

默认你认识 React 的组件、props、state 和基本 Hook。遇到这些概念，会解释它们在本项目里的用途，但重点放在 **React Native 与 Expo 中你还不熟悉的部分**。没有必要先把所有第三方库学完，再回来看项目。

## 目录

1. [先认识你正在运行的东西](#runtime)
2. [项目用了哪些库，各自负责什么](#dependencies)
3. [源码应该按什么顺序看](#reading-order)
4. [应用入口、配置和两个布局](#entry-and-layouts)
5. [先读懂 RN 的界面写法与共享组件](#rn-basics)
6. [逐页讲解：全部 11 个页面](#screens)
7. [共享播放器：Expo API 如何真正播放音乐](#shared-player)
8. [数据、缓存、共享状态和本地存储](#data-and-state)
9. [把整个项目串起来的三条功能链](#feature-flows)
10. [Web、Expo Go、开发构建和原生构建的边界](#platforms)
11. [按轮次学习和动手，不要同时改一大块](#practice)
12. [遇到问题怎么定位，以及去哪里查文档](#debugging)

第一天只做一条主线就够：第 2 章认识库的分工，第 4 章看入口与布局，第 5 章认识 RN 组件，再配着源码读 6.1 歌单广场。后面的搜索、账号和音频分轮次读，不用一次消化完整份文档。

---

<a id="runtime"></a>

## 1. 先认识你正在运行的东西

### 1.1 React、React Native、Expo 不是三个相互替代的框架

可以把它们的分工理解为：

- **React**：组件、状态、Hook，以及根据状态更新界面的机制。
- **React Native，简称 RN**：`View`、`Text`、`Pressable` 等界面组件，以及面向原生平台的渲染和 API。
- **Expo**：围绕 RN 的开发工具、配置、构建能力和模块，例如图片、音频、安全存储。
- **Expo Router**：用文件结构组织页面和导航。它建立在 React Navigation 之上，不是另一套 React 渲染器。

你仍然写 React 函数组件，但不是靠 `<div>`、`<button>` 和 CSS 文件实现界面。

在 Android/iOS 上，RN 组件连接原生平台的界面能力；在本项目的 Web 预览中，`react-native-web` 把 RN 的组件与 API 适配到浏览器。**原生运行不是把这个网页塞进 WebView，Web 预览也不能验证所有原生行为。**

### 1.2 客户端和 API 服务是两个程序

```text
浏览器 / Android App / iOS App
  |
  | 运行 src/ 中的 Expo + RN 客户端
  | 发出 HTTP 请求
  v
本地 NeteaseCloudMusicApi 服务
  |
  | 请求上游服务
  v
网易云音乐接口
```

`npm run web` 不会顺便启动音乐 API，`npm run api:start` 也不会启动客户端。

如果依赖尚未安装，先在根目录运行 `npm ci`。然后开两个终端：

```bash
# 终端一：本地音乐 API，默认端口 3000
npm run api:start
```

```bash
# 终端二：Expo Web 开发服务
npm run web
```

打开第二个终端显示的网页地址，不要把 API 的 `3000` 端口当成 App 页面。详细环境要求见 [README.md](README.md)。

客户端通过根目录 `.env` 读取 API 地址，例如：

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000
```

这里的地址必须换成你的实际服务地址；它只是示例，不是可直接使用的默认值。

- 当前电脑上的浏览器可以访问同机的 `127.0.0.1`。
- 真机访问电脑服务时要用电脑的局域网 IP；手机的 `localhost` 是手机自己。
- Android 模拟器访问电脑服务通常可用 `10.0.2.2`。
- 修改 `.env` 后按本项目的运行方式重启 Expo。
- `EXPO_PUBLIC_` 变量会进入客户端包，不能放密码、Cookie 或密钥。

### 1.3 第一次学习时只关注这几个位置

- `src/app/`：页面和路由布局。
- `src/components/`：页面使用的界面零件。
- `src/player/`：音频实例、队列规则、歌词解析。
- `src/api/`：请求服务和转换数据。
- `src/account/`、`src/history/`：会话和本地记录。

`node_modules/` 是依赖，`dist/` 是 Web 导出产物。第一轮不要从它们读起，也不要直接修改它们。

---

<a id="dependencies"></a>

## 2. 项目用了哪些库，各自负责什么

以下依据 [package.json](package.json) 和源码中的实际调用整理。**安装了一个库，不等于页面直接使用了它。** 框架配套依赖、构建插件和业务中调用的 API 要分开看。

核心版本声明是 React `19.2.3`、RN `0.86.3`、Expo `^57.0.27`、Expo Router `~57.0.25`。这些是 `package.json` 的声明，实际安装结果由 `package-lock.json` 固定，不应把版本范围当成精确安装版本。

### 2.1 基础运行与导航

**`react`**

- 提供组件、`useState`、`useEffect`、Context 等。
- 本项目的页面、组件和 Provider 都用它。
- 学 RN 并不意味着重学一套状态机制；变化主要在组件、布局、平台 API 和导航行为。

**`react-native`**

- 提供 `View`、`Text`、`Pressable`、`TextInput`、`ScrollView`、`FlatList`、`Modal` 等组件。
- 还提供 `StyleSheet`、`Animated`、`Keyboard`、`Alert`、`Platform` 和 `useWindowDimensions`。
- 学习入口是歌单广场和共享组件；高级一点的 API 在搜索、播放器和队列弹窗中。

**`expo`**

- 提供 `expo start`、项目配置和 Expo 模块的运行基础。
- 不负责向网易云接口请求数据，也不替代 React。
- 配置入口是 `app.config.ts`，运行命令在 `package.json`。

**`expo-router`**

- 提供文件路由、`Stack`、`Tabs`、`router`、`useLocalSearchParams`、`useSegments`、`useFocusEffect`。
- `src/app/_layout.tsx` 组织根导航，`src/app/(tabs)/_layout.tsx` 组织三个标签页。
- 歌单详情学习动态参数，登录页学习焦点生命周期。

**`react-native-safe-area-context`**

- 提供 `SafeAreaProvider`、`SafeAreaView`、`useSafeAreaInsets`。
- 让页面避开状态栏、刘海和底部手势区域。
- 本项目的安全区组件来自这个库，不是从 `react-native` 引入的同名组件。

**`react-native-screens`**

- 为导航库提供原生屏幕支持，有助于原生导航的生命周期和性能管理。
- 当前业务源码没有直接导入它；先理解 Router 的页面和布局，不必先读这个包的实现。

**`expo-linking`**

- 提供应用链接和深链接相关能力，也是 Router 体系的配套依赖。
- `app.config.ts` 定义了 `cloud-listening` URL scheme。
- 当前页面没有直接调用它。首页 Banner 也没有使用它打开活动外链，不能把库已安装理解为外链业务已实现。

### 2.2 图片、图标、渐变、状态栏和滑块

**`expo-image`**

- 提供本项目使用的 `Image`，支持图片适配、缓存和过渡。
- 出现在 `MusicCover`、发现页 Banner、我的头像、登录二维码中。
- 重点认识 `source`、`contentFit`、`transition`、`cachePolicy`。
- 它不是 RN 自带的 `Image`；看到同名组件时先看 import。

**`@expo/vector-icons`**

- 本项目使用其中的 `Ionicons`，例如搜索、播放、返回、爱心图标。
- `name` 选择图标，`size` 控制尺寸，`color` 控制颜色。
- 图标只是外观；点击和无障碍语义由外层 `Pressable` 等组件负责。

**`expo-font`**

- 提供字体加载能力；字体型图标与 Expo 生态会用到它。
- 当前业务源码没有自定义字体加载流程，也没有直接调用 `useFonts`。
- 不需要因为装了它，就去源码里寻找一段不存在的字体业务。

**`expo-linear-gradient`**

- 提供 `LinearGradient`，用多个颜色生成渐变容器。
- 用在发现页快捷入口、歌单详情、每日推荐和完整播放器。
- 它可以包住子组件，不只是生成一张背景图。

**`expo-status-bar`**

- 根布局里的 `StatusBar` 根据路由选择状态栏文字的明暗。
- `style="light"` 指浅色状态栏内容，不是把整个页面改成浅色主题。
- 它不会替页面留出安全区空间。

**`@react-native-community/slider`**

- 提供完整播放器的进度滑块。
- `onValueChange` 显示拖动位置，`onSlidingComplete` 才调用音频 seek。
- 它是第三方组件，不是 RN 核心组件，也不是音频播放器。

### 2.3 音频

**`expo-audio`**

- 提供真正的音频实例、状态订阅、播放/暂停/跳转、音频模式和原生锁屏媒体信息接口。
- 实际调用集中在 `src/player/AudioPlayerProvider.tsx`。
- 重点 API：`useAudioPlayer`、`useAudioPlayerStatus`、`setAudioModeAsync`，以及音频实例上的 `replace`、`play`、`pause`、`seekTo`。
- 项目使用的是 `expo-audio`，不是旧教程中常见的 `expo-av`。不要照搬另一套播放器 API。

### 2.4 服务端数据与客户端状态

**`@tanstack/react-query`**

- 管理服务端数据的请求状态、内存缓存、重试、分页和写操作后的刷新。
- `useQuery` 用于普通查询；`useInfiniteQuery` 用于分页；`useMutation` 用于喜欢、收藏等写操作。
- `QueryClientProvider` 在根布局提供统一的查询客户端。
- 它不直接替你实现业务接口；`queryFn` 仍然调用 `neteaseApi`。

**`zustand`**

- 管理多个页面共享的客户端状态。
- `playbackStore` 保存队列和播放模式；`accountStore` 保存会话；`historyStore` 保存本地记录。
- 读取 Hook 可以订阅状态，`getState()` 可以在事件和非组件逻辑中读取当前值、调用动作。
- 它本身不是音频引擎，也不是 HTTP 客户端。

**`@react-native-async-storage/async-storage`**

- 异步键值存储，本项目通过 Zustand 的 `persist` 中间件保存搜索历史和最近播放。
- 调用入口是 `src/history/historyStore.ts`。
- 不是加密凭据存储；不要拿它保存登录 Cookie。

**`expo-secure-store`**

- 本项目用它在 Android/iOS 保存和删除登录凭据。
- 调用入口是 `src/account/accountStore.ts`。
- 当前代码明确跳过 Web 持久存储：Web 会话只在内存中，整页刷新后不能依靠这个模块恢复登录。

### 2.5 Web 和开发/构建配套

**`react-dom` 与 `react-native-web`**

- 为 Web 预览提供浏览器渲染和 RN 组件适配。
- 页面仍然 import RN 组件，业务代码没有直接调用 `ReactDOM.createRoot`。
- 不能据此在跨平台业务组件里随意使用 `document` 或浏览器专属 API。

**`expo-dev-client`**

- 支持自定义 development build 的开发客户端体验。
- `start:dev` 使用 `expo start --dev-client`，`eas.json` 中的 development 配置启用开发客户端。
- 它不是 Web 预览必需的页面功能；启动 Metro 也不会自动替你构建和安装原生客户端。

**`expo-build-properties`**

- 是配置插件，用来设置原生构建属性。
- 当前配置控制 Android 是否允许明文 HTTP：非 production 构建允许局域网 HTTP，production 禁止。
- 这是原生构建配置，不是页面运行时按钮。

**`expo-constants`**

- 提供 Expo 应用和运行环境常量，是当前依赖中的配套模块。
- 当前 `src/` 没有直接调用它；API 地址也不是通过它读取，而是读取 `process.env.EXPO_PUBLIC_API_BASE_URL`。

**`react-native-reanimated` 与 `react-native-worklets`**

- 提供更高级的动画、worklet 运行等能力。
- 当前业务源码没有直接导入这两个包。
- **唱片旋转使用的是 RN 自带的 `Animated`，不是 Reanimated。** 先学项目正在使用的动画实现，不要混淆两套 API。

### 2.6 开发依赖

- `typescript`：类型检查。本项目启用 `strict` 和 `noUncheckedIndexedAccess`。
- `@types/react`、`@types/node`：React 和 Node 环境的类型声明，不是运行时组件库。
- `eslint`、`eslint-config-expo`：检查代码规则和 Expo/React 相关用法。
- `prettier`：格式化代码和文档，不负责判断功能是否正确。
- `tsx`：执行 TypeScript 测试，`npm test` 使用 `tsx --test`。
- `NeteaseCloudMusicApi`：通过 `api:start` 启动独立的 Node 服务。虽然放在 devDependencies，它仍是真正运行的后端程序；客户端不 import 它。

项目没有安装 Axios、Redux、NativeWind，也没有用 CSS class 来实现页面样式。HTTP 使用 `fetch`，状态使用 Zustand 和 Query，样式使用 RN 样式对象。

---

<a id="reading-order"></a>

## 3. 源码应该按什么顺序看

### 3.1 总原则：先有界面，再追数据，最后看平台能力

不要按文件夹顺序从头读到底，也不要从最长的播放器或登录文件开始。

读一个页面时固定按这个顺序：

1. **找到 `export default function`**：确认哪个函数是路由页面。
2. **看主要的 `return`**：先对应屏幕上的区域。
3. **看组件 import**：哪些是 RN/Expo 的，哪些是项目自己写的。
4. **看数据来源**：查询、store、路由参数，还是页面本地 state。
5. **看点击事件**：导航、更新状态、请求服务，分别在哪里发生。
6. **看 `styles`**：选一块界面，从 JSX 的样式名称追到底部对象。
7. **最后看副作用与清理**：计时器、取消请求、焦点、音频监听。

第一遍不要求理解每一条样式或每一种错误保护。先能解释一个正常操作从哪里开始、到哪里结束。

### 3.2 第一轮：入口和基础界面

按这个顺序打开：

1. [package.json](package.json)：看 `main`、核心依赖和运行脚本。
2. [app.config.ts](app.config.ts)：区分 App 配置与页面代码。
3. [根布局](src/app/_layout.tsx)：看 Provider 和 Stack 的作用域。
4. [标签布局](<src/app/(tabs)/_layout.tsx>)：看三个 Tab 与 MiniPlayer。
5. [主题](src/styles/theme.ts)、[PageStateView](src/components/PageStateView.tsx)。
6. [PlaylistCard](src/components/PlaylistCard.tsx)、[MusicCover](src/components/MusicCover.tsx)。
7. [歌单广场](<src/app/(tabs)/playlists.tsx>)：第一次读完整页面。

**本轮要能回答**：为什么不用 `App.tsx`？`Text` 和 `View` 有什么区别？一个歌单卡片的图片、文字和点击区域分别在哪？

### 3.3 第二轮：列表、动态路由和查询

1. [发现页](<src/app/(tabs)/index.tsx>)：ScrollView、Banner、渐变、刷新。
2. [排行榜](src/app/rankings.tsx)：复用 FlatList 与查询缓存。
3. [歌单详情](src/app/playlist/[id].tsx)：动态参数、列表头、分页。
4. [SongRow](src/components/SongRow.tsx)：歌曲行和当前曲高亮。
5. [每日推荐](src/app/daily.tsx)：用户身份、列表头和嵌套 Text。

追数据时只读当前功能涉及的方法：`musicTypes -> neteaseApi -> apiRequest -> responseAdapters`。不要为了推荐歌单一次读完所有登录接口。

### 3.4 第三轮：输入、账号和本地记录

1. [搜索](src/app/search.tsx)：TextInput、键盘、建议、分页。
2. [historyStore](src/history/historyStore.ts)：搜索历史从哪里保存。
3. [我的](<src/app/(tabs)/mine.tsx>)：会话恢复和个人歌单。
4. [collection](src/app/collection.tsx)：一个页面如何支持两种来源。
5. [登录](src/app/login.tsx)：手机号输入、二维码、焦点清理。
6. [accountStore](src/account/accountStore.ts)、[accountQueries](src/account/accountQueries.ts)。
7. [设置](src/app/settings.tsx)：手动查询和本地清理。

**本轮要能回答**：切换页面、返回、组件卸载是同一件事吗？为什么刷新 Web 后历史还在，账号不一定还在？

### 3.5 第四轮：真正的音频与完整播放器

1. [playbackStore](src/player/playbackStore.ts)：先认识队列、索引和 revision。
2. [playbackQueue](src/player/playbackQueue.ts)：手动与自动切歌规则。
3. [AudioPlayerProvider](src/player/AudioPlayerProvider.tsx)：Expo 音频 API。
4. [MiniPlayer](src/components/MiniPlayer.tsx)：最小的播放器界面。
5. [完整播放器](src/app/player.tsx)：Slider、Animated、歌词切换。
6. [PlaybackQueueModal](src/components/PlaybackQueueModal.tsx)：RN Modal。
7. [lyricParser](src/player/lyricParser.ts)、[LyricsView](src/components/LyricsView.tsx)。

**本轮要能回答**：哪个模块负责发声？切换页面为何不重建音频？拖动进度时显示的位置与实际播放位置为何要分开？

### 3.6 第五轮：回头读可靠性和构建

最后再读请求超时、旧任务保护、账号缓存隔离、存储写入串行化，以及 [eas.json](eas.json) 和测试。

这些逻辑很重要，但如果你还不认识 `FlatList` 就先钻进会话版本号，很容易只看见细节而失去主线。

---

<a id="entry-and-layouts"></a>

## 4. 应用入口、配置和两个布局

### 4.1 入口为什么不是 App.tsx

`package.json` 中：

```json
{
  "main": "expo-router/entry"
}
```

上面只展示 package.json 的入口字段，不是让你替换整个文件。它表示入口由 Expo Router 接管。Router 识别 `src/app/` 中的路由文件，先渲染布局，再把当前路由页面放进去。

这里有两种容易混淆的“入口”：

- **应用入口/全局布局**：`src/app/_layout.tsx`。
- **默认首页**：`src/app/(tabs)/index.tsx`。

首页不是 App 的全部。播放器、查询上下文和安全区不能只放在首页组件里，否则它们的作用域和生命周期会跟首页绑定。

### 4.2 路由文件的命名就是路由信息

```text
src/app/
  _layout.tsx             根布局
  (tabs)/
    _layout.tsx           标签布局
    index.tsx             发现，URL 为 /
    playlists.tsx         歌单广场，URL 为 /playlists
    mine.tsx              我的，URL 为 /mine
  playlist/
    [id].tsx              歌单详情，如 /playlist/123
  search.tsx              /search
  rankings.tsx            /rankings
  daily.tsx               /daily
  collection.tsx          /collection，可附带 ?type=recent
  login.tsx               /login
  settings.tsx            /settings
  player.tsx              /player
```

- `_layout.tsx` 是布局，不是独立的业务页面。
- `index.tsx` 是目录的默认页面。
- `[id].tsx` 是动态参数页面，不是字面上叫 `[id]` 的固定页面。
- `(tabs)` 是分组，不进入 URL，但在内部路由结构和 `useSegments()` 中仍有意义。
- `router.push('/(tabs)/playlists')` 可以明确指定分组中的页面；浏览器地址不会因此多出一个 `(tabs)`。
- 路由目录内的普通文件可能成为路由，所以可复用组件放在 `src/components/`，不要随手塞进 `src/app/`。

### 4.3 app.config.ts：配置何时生效

文件导出一个 `ExpoConfig` 对象，值得认识的配置如下：

- `name`：应用显示名称。
- `slug`：Expo 项目标识的一部分，不是页面路由。
- `orientation: 'portrait'`：声明竖屏方向；浏览器窗口尺寸仍可变化。
- `scheme: 'cloud-listening'`：应用链接 scheme。
- `ios.bundleIdentifier`、`android.package`：原生应用标识。
- `web.bundler: 'metro'`：Web 也通过 Metro 打包。
- `web.output: 'single'`：单页应用式 Web 导出，不是为每个路由独立生成业务源码。
- `experiments.typedRoutes`：启用路由类型支持，让 TypeScript 更容易发现路由拼写错误。

`plugins` 中包含 Router、安全存储、音频和构建属性插件。

**配置插件的重点是修改原生工程配置。** 例如后台音频、Android 明文 HTTP 设置，不是改完保存就能在现有原生安装包里全部生效；需要生成/更新并重新构建原生客户端。修改普通页面文字则通常能通过开发环境的 Fast Refresh 看到变化。

当前音频配置启用后台播放、禁用录音，Android 还阻止麦克风权限。项目只播放音乐，没有录音功能，不应为了播放去申请麦克风。

### 4.4 根布局：Provider 为什么这样套

源码的主结构是：

```text
RootLayout
  SafeAreaProvider
    QueryClientProvider
      AppNavigation
        AudioPlayerProvider
          View
            StatusBar
            Stack
              当前路由，包括嵌套的 Tabs
            MiniPlayer（按路由条件显示）
          PlaybackQueueModal
```

逐层理解：

1. `SafeAreaProvider` 提供设备安全区信息，后代才能使用安全区组件和 Hook。
2. `QueryClientProvider client={queryClient}` 提供同一个查询客户端，页面才能共享缓存。
3. `AppNavigation` 在这些上下文里面调用 `useSafeAreaInsets`，并触发会话恢复。
4. `AudioPlayerProvider` 保有全局音频实例，包住路由页面和队列弹窗。
5. `Stack` 切换页面，但音频 Provider 不随单个页面切换而重建。

这不是“Provider 越多越好”，而是每种能力要包在它的消费者外面。

### 4.5 Stack：页面导航的容器

源码节选：

```tsx
<Stack
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: colors.white },
    animation: 'slide_from_right',
  }}
>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen
    name="player"
    options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
  />
</Stack>
```

- `screenOptions` 设置这个 Stack 的默认页面选项。
- `headerShown: false` 隐藏导航库自带标题栏，项目用 `PageHeader` 等自己画标题。
- `contentStyle` 控制页面内容背景，不是页面内部每一个 Text 的样式。
- `Stack.Screen` 在这里配置对应路由的选项，不是 import 页面组件后手动渲染。
- `player` 特别设置为全屏模态呈现，从下方进入。
- 其他路由仍由文件系统识别；这里没有逐个写出来，不表示搜索、设置不存在。

原生页面切换的呈现和动画选项在 Web 上不一定有相同效果，不能只看浏览器来判断移动端转场。

### 4.6 useSegments、StatusBar 和 MiniPlayer 的位置

根布局读取：

```tsx
const segments = useSegments();
const insets = useSafeAreaInsets();
const showMiniPlayer = segments[0] !== '(tabs)' && segments[0] !== 'player';
const usesDarkBackground = segments[0] === 'player' || segments[0] === 'playlist';
```

`useSegments()` 返回当前路由的文件结构片段，而不是你自己用字符串拆分浏览器 URL。

- 标签页已有自己的 MiniPlayer，根布局不重复画。
- 完整播放器不需要再叠一条 MiniPlayer。
- 搜索、设置等其他页面由根布局显示 MiniPlayer，并加上底部安全区 padding。
- 播放器和歌单详情用深色头部，状态栏内容切成浅色。

MiniPlayer 本身在没有当前歌曲时返回 `null`。布局决定它“在哪里”，组件决定它“有没有内容”。

### 4.7 标签布局：Tabs 和自定义底栏

`src/app/(tabs)/_layout.tsx` 用：

```tsx
<Tabs tabBar={(props) => <MusicTabBar {...props} />} screenOptions={{ headerShown: false }}>
  <Tabs.Screen name="index" />
  <Tabs.Screen name="playlists" />
  <Tabs.Screen name="mine" />
</Tabs>
```

`tabBar` 替换默认底栏外观，但页面切换仍由导航库管理，不是自己用一个 `useState` 在三个组件之间切换。

`MusicTabBar` 收到导航库传入的 `state` 和 `navigation`：

- `state.routes`：标签路由列表。
- `state.index`：当前选中的路由索引。
- `route.key`：导航系统的路由实例标识，不是业务中的歌曲 ID。
- `navigation.navigate(route.name)`：切到对应标签。

点击标签时，代码先 `navigation.emit({ type: 'tabPress', ... })`，只有事件没有被阻止才导航。这保留了导航库的事件语义，不应只为了缩短代码把它删掉。

底栏外层负责 `paddingBottom: insets.bottom`，MiniPlayer 放在标签按钮上方。三个标签页面主要处理顶部安全区，不各自重复处理同一块底栏安全区。

`accessibilityRole="tab"` 和 `accessibilityState={{ selected: active }}` 向辅助技术说明这是标签、是否选中。红色图标和文字只是视觉反馈，不能替代语义。

### 4.8 import 中的 @/ 是什么

```tsx
import { MiniPlayer } from '@/components/MiniPlayer';
import { QueryClientProvider } from '@tanstack/react-query';
```

- `@/components/MiniPlayer` 指项目自己的文件。`tsconfig.json` 中的 `@/* -> ./src/*` 定义了路径别名，避免很多层 `../../`。
- `@tanstack/react-query` 是安装的 npm 包，前面的 `@tanstack` 是包的 scope，不是同一个路径别名。
- `import type` 只导入 TypeScript 类型，不会因为导入一个类型就创建组件或运行服务。
- `.tsx` 文件可以写 JSX；普通 `.ts` 文件通常放类型、工具、store 和不含 JSX 的逻辑。

读 import 是判断一个能力属于 RN、Expo、第三方库还是本项目代码的最直接方法。

---

<a id="rn-basics"></a>

## 5. 先读懂 RN 的界面写法与共享组件

### 5.1 View 和 Text：先别把它们当成 DOM

```tsx
<View style={styles.header}>
  <Text style={styles.title}>歌单广场</Text>
  <Text style={styles.subtitle}>总有一首歌，刚好懂你</Text>
</View>
```

- `View` 是布局容器，负责排列、背景、间距等。
- `Text` 负责显示文字。跨平台 RN 中，普通可见文本应放在 `Text` 中，不能照搬 `<div>一段文字</div>` 写成 `<View>一段文字</View>`。
- `Text` 可以嵌套 `Text`，例如每日推荐里的大号日期和小号月份。
- `numberOfLines={1}` 或 `{2}` 控制最多显示的行数，常用来避免标题撑坏卡片或歌曲行。

样式不是任意 CSS 属性集合。不要直接加 `display: grid`、CSS 选择器或 `className`，期待本项目自动获得 Web CSS 的能力。

### 5.2 Pressable：可点击区域与事件

`PlaylistCard` 的点击逻辑是：

```tsx
<Pressable
  style={{ width }}
  onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
  accessibilityRole="button"
  accessibilityLabel={`歌单：${playlist.name}`}
>
```

- `onPress` 是 RN 的按压事件，不是 DOM 的 `onClick`。
- 点击区域是整个 `Pressable` 包住的卡片，不只是里面的播放图标。
- 这段代码只是进歌单详情，并没有立即播放音乐。
- `disabled` 可以阻止按压，但要让用户看出禁用状态，往往还需配合颜色或透明度样式。
- `hitSlop` 可扩大触摸命中范围，搜索清空图标和队列关闭按钮都用了它；它不改变视觉尺寸，也不能无限越过父容器边界。

Pressable 还可以根据按压状态计算样式。例如下面是练习写法，不是当前卡片源码：

```tsx
style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
```

不要把图标的 `name="play"` 理解成播放行为。真正的行为来自外层事件函数。

### 5.3 StyleSheet：样式怎么找到、怎么覆盖

源码中的样式通常在文件底部：

```tsx
const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 11, color: colors.secondary, marginTop: 8 },
});
```

- `StyleSheet.create` 组织 RN 样式定义，不是在运行时插入一张 CSS 样式表。
- `style={styles.title}` 使用一个样式对象。
- `style={[styles.title, active && { color: colors.primary }]}` 组合多个样式，后面的有效样式覆盖前面的同名属性。
- `style={{ width }}` 适合由数据计算的动态尺寸。
- 没有网页里的 CSS 选择器级联，也没有把字体颜色随意写在外层 View 就传给所有文字的机制。项目通常直接给 Text 设置颜色。

`fontSize: 26`、`padding: 20` 等数字是 RN 的逻辑尺寸。不要直接把它们理解为设备物理像素；Web 适配后的显示也不能代替真机尺寸验证。

### 5.4 Flexbox：为什么横向布局总要写 flexDirection

RN 容器默认主轴是纵向，而不是 Web Flexbox 常见的默认横向。

以标签栏为例：

```tsx
bar: {
  height: 62,
  flexDirection: 'row',
  borderTopWidth: StyleSheet.hairlineWidth,
  borderTopColor: colors.line,
},
tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
```

- `flexDirection: 'row'`：三个标签横向排列。
- 每个标签 `flex: 1`：分享主轴上可用的空间。
- `alignItems`：交叉轴对齐；`justifyContent`：主轴对齐。
- `gap`：同一个布局容器内子项的间距。
- `StyleSheet.hairlineWidth`：适合细分隔线的设备相关宽度，不是固定写死的 1。

页面根容器经常写 `flex: 1`，是让页面占满导航分配的空间。它不是“让元素充满整个手机屏幕”的独立命令，仍然受父布局约束。

### 5.5 安全区不是随手给页面加 paddingTop: 30

```tsx
<SafeAreaView edges={['top']} style={styles.screen}>
```

`edges={['top']}` 表示只处理顶部安全区。不同设备的刘海、状态栏、手势区域不同，不能拿一个固定数值代替。

- 标签页的底部由标签布局处理。
- 普通子页面的底部由根布局的播放器区域配合安全区处理。
- 完整播放器自行处理 `['top', 'bottom']`。
- 队列弹窗用 `useSafeAreaInsets()` 计算底部 padding。

`StatusBar` 管状态栏的呈现，`SafeAreaView` 管内容避让，两者不是同一个功能。

### 5.6 ScrollView 与 FlatList：不是随便挑一个

**ScrollView** 通常把子项都渲染出来，适合有限数量的内容区块。发现页用它组合 Banner、快捷入口、推荐歌单和少量排行榜。

**FlatList** 使用虚拟化列表机制，适合歌曲、搜索结果等可能很长的数据列表。它尽量只保留需要的渲染窗口，而不是简单地把全部数据 `map` 成节点。

FlatList 最先要认识：

- `data`：列表数据。
- `renderItem`：每项如何渲染，接收 `item` 和 `index` 等信息。
- `keyExtractor`：给每项一个用于识别的字符串 key。
- `numColumns`：多列布局。本项目是规则网格，不是瀑布流。
- `columnWrapperStyle`：多列模式每一行外层的样式。
- `ListHeaderComponent`：随列表滚动的头部。
- `ListEmptyComponent`：数据为空时的内容。
- `ListFooterComponent`：列表尾部，例如下一页加载提示。
- `onEndReached`：接近末尾时通知你，**不会自动向接口请求下一页**。

`style` 控制滚动组件外层，`contentContainerStyle` 控制内部内容容器。把列表留白写错地方，会出现滚动区域和内容间距不符合预期的问题。

不要在一个同方向的 ScrollView 里随意塞长 FlatList。歌单详情通过 `ListHeaderComponent` 把头部合进列表，就是为了让歌曲与头部使用同一条纵向滚动主线。

### 5.7 PlaylistCard 与 MusicCover：一块界面如何拆成组件

[PlaylistCard](src/components/PlaylistCard.tsx) 接收 `playlist` 和可选 `width`：

- `width` 同时控制卡片宽度和方形封面尺寸。
- `MusicCover` 展示封面。
- 绝对定位的 View 展示播放次数和装饰性播放图标。
- `Text numberOfLines={2}` 显示名称。
- 卡片点击传歌单 ID，不把整个 API 响应塞进路由。

[MusicCover](src/components/MusicCover.tsx) 把图片细节集中处理：

```tsx
<Image
  source={{ uri }}
  style={StyleSheet.absoluteFill}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
/>
```

- `source={{ uri }}` 指定图片地址；这是 `expo-image` 的用法。
- `StyleSheet.absoluteFill` 是填满父容器的绝对定位样式，父容器仍然要有尺寸。
- `contentFit="cover"` 保持比例填满区域，多余部分可能裁切。
- `transition={200}` 声明图片显示的过渡时长，单位毫秒。
- `cachePolicy="memory-disk"` 声明缓存策略；缓存实现和持久性仍受平台限制。
- 外层 `overflow: 'hidden'` 配合圆角，裁掉越出边界的图片。
- 没有 `uri` 时显示音符占位，不造一张假封面。当前代码没有单独实现“有效地址但图片请求失败”的错误占位分支。

### 5.8 另外四个基础组件怎么看

**[PageHeader](src/components/PageHeader.tsx)**

- 用 View、Text、Pressable 自己画标题栏。
- `router.canGoBack()` 有历史时返回，否则 `router.replace('/')` 回首页。
- `right` 接收自定义右侧节点，没有时留一个占位，让布局保持一致。
- `light` 只是切文字和图标颜色，不负责设置整页背景。

**[SectionHeader](src/components/SectionHeader.tsx)**

- 显示内容区块标题和可选操作。
- 是否显示操作入口由 `onPress` 决定；只传 `action` 不会凭空出现按钮。
- `action ?? '查看更多'` 提供默认文字，是普通 React 组件参数设计，不是 Expo 特性。

**[PageStateView](src/components/PageStateView.tsx)**

- `loading` 时显示 RN 的 `ActivityIndicator` 和加载文字。
- 不加载时显示空/错误标题和可选 message。
- 传了 `onRetry` 才有重试按钮。
- 它不发请求，页面负责决定调用哪个 `refetch()`。

**[ApiConfigurationNotice](src/components/ApiConfigurationNotice.tsx)**

- 已配置合法地址就不显示，缺失或格式错误时给出设置入口。
- “地址已配置”和“服务能连通”是两件事。
- 点击只是去设置页；这个组件不探测网络。

### 5.9 SongRow：共享界面，不把所有行为写死在里面

[SongRow](src/components/SongRow.tsx) 被歌单、搜索、每日推荐和 collection 共用，主要参数是：

- `song`：要展示的统一 Song 对象。
- `index`：可选的从 0 开始索引，显示时加 1。
- `showArtwork`：显示封面，还是序号/当前曲图标。
- `onPress`：由父页面提供如何播放，组件不自己请求音源。
- `trailing`：可选的行尾节点，替换默认播放按钮。

它从 playbackStore 订阅当前歌曲 ID 是否等于这一行 song.id，给标题加红色。**歌曲行按 ID 高亮，而队列弹窗按队列索引高亮**；如果同一首重复出现，两种高亮语义不一样。

布局是一个横向 View：左侧主 Pressable 使用 `flex: 1`，内部有封面/序号和文字区；右侧独立 Pressable 是默认播放入口。文字区也有 `flex: 1`，再配合 `numberOfLines={1}`，让长歌名截断，而不是把右侧按钮挤出屏幕。

VIP/付费标签根据 song.fee 展示，不能据此保证或否定可播放性。父页面决定队列，音源接口决定当前实际权限，这个组件只负责展示与传出点击。

---

<a id="screens"></a>

## 6. 逐页讲解：全部 11 个页面

下面按适合学习的顺序讲，而不是按默认打开顺序讲。每个页面都先对应界面，再看数据与事件，最后看 RN/Expo 的关键用法。

页面索引：

- [6.1 歌单广场](#screen-playlists)：FlatList、多列、响应式宽度。
- [6.2 发现](#screen-discovery)：ScrollView、Banner、渐变、刷新。
- [6.3 排行榜](#screen-rankings)：列表和查询缓存复用。
- [6.4 歌单详情](#screen-playlist-detail)：路由参数、分页、收藏。
- [6.5 每日推荐](#screen-daily)：列表头、嵌套 Text、用户身份。
- [6.6 搜索](#screen-search)：TextInput、键盘、防抖和分页。
- [6.7 我的](#screen-mine)：头像、账号恢复、歌单货架。
- [6.8 喜欢/最近播放](#screen-collection)：路由查询参数、两种数据来源。
- [6.9 登录](#screen-login)：移动输入、二维码、useFocusEffect。
- [6.10 设置](#screen-settings)：手动查询、selectable、本地清理。
- [6.11 完整播放器](#screen-player)：Slider、Animated、共享音频控制。

<a id="screen-playlists"></a>

### 6.1 歌单广场：第一次读一个完整 RN 页面

**文件**：[src/app/(tabs)/playlists.tsx](<src/app/(tabs)/playlists.tsx>)。

**界面结构**：

```text
SafeAreaView，只处理顶部安全区
  顶部标题 + 搜索按钮
  API 配置提示
  未配置 / 加载 / 错误提示
  或三列 FlatList
    每项一个 PlaylistCard
```

#### 数据部分

```tsx
const playlistsQuery = useQuery({
  queryKey: ['public', 'recommended'],
  queryFn: ({ signal }) => neteaseApi.getRecommendedPlaylists(signal),
  enabled: apiConfig.isApiConfigured,
});
const playlists = playlistsQuery.data ?? [];
```

这是 Query，不是 Expo 的 API：

- `queryKey` 是缓存标识，不是接口 URL。
- `queryFn` 才实际取数据，这里调用推荐歌单接口。
- `signal` 被一路传给 `fetch`，允许取消不再需要的请求。
- `enabled` 防止未配置服务地址时自动请求。
- `data ?? []` 给列表一个数组，避免尚未返回时访问 undefined。

当查询被禁用且没有数据时，`isPending` 也可能为 true，它不总是等于“正在发网络请求”。所以源码先判断未配置，再判断加载。真正是否在请求，要结合 `isFetching` 等状态看。

#### 列表部分

源码节选：

```tsx
<FlatList
  data={playlists}
  numColumns={3}
  columnWrapperStyle={styles.columns}
  contentContainerStyle={styles.grid}
  keyExtractor={(playlist) => String(playlist.id)}
  renderItem={({ item: playlist }) => <PlaylistCard playlist={playlist} width={(width - 64) / 3} />}
/>
```

`useWindowDimensions()` 返回当前窗口尺寸，窗口改变时会更新。这里用 `width` 做响应式计算：

- 页面左右留白各 20，共 40。
- 三列之间有两个 12 的间距，共 24。
- `(width - 64) / 3` 把剩余空间分给三张卡片。

这就是项目里的响应式布局，不是 CSS 媒体查询。

#### 下拉刷新与状态分支

源码还传了 `onRefresh` 和 `refreshing={playlistsQuery.isRefetching}`。前者触发重新查询，后者控制刷新指示状态；原生下拉手势与 Web 上的表现要分别验证。

- 未配置：提示配置。
- 初次等待数据：PageStateView loading。
- 请求失败：展示错误，按钮调用 `refetch()`。
- 成功但空数组：FlatList 的 ListEmptyComponent。
- 成功有数据：三列卡片。

**看完应能解释**：卡片宽度如何算？数据来自哪里？重试和导航是不是同一个动作？

<a id="screen-discovery"></a>

### 6.2 发现页：多区块、图片轮播、渐变与刷新

**文件**：[src/app/(tabs)/index.tsx](<src/app/(tabs)/index.tsx>)。

**界面结构**：顶部搜索/设置固定在滚动内容外；下方 ScrollView 包含 Banner、快捷入口、推荐歌单、排行榜和页脚。

#### 三个查询彼此独立

- `['public', 'banners']`：Banner。
- `['public', 'recommended']`：推荐歌单，和歌单广场共享缓存。
- `['public', 'toplists']`：排行榜完整数据，首页只 `slice(0, 3)` 展示前三个。

所以某一区块失败，不必把整个页面变成一张失败页。各个区块自行显示加载和重试。

#### Banner 是横向 ScrollView，不是第三方轮播组件

源码的关键属性是：

```tsx
horizontal
pagingEnabled
showsHorizontalScrollIndicator={false}
onMomentumScrollEnd={(event) =>
  setBannerIndex(Math.round(event.nativeEvent.contentOffset.x / bannerWidth))
}
```

- `horizontal`：横向滚动。
- `pagingEnabled`：按滚动视口尺寸分页，平台行为仍需验证。
- `onMomentumScrollEnd`：滑动惯性停止时读取位置。
- `event.nativeEvent.contentOffset.x`：RN 滚动事件中的横向偏移量，不是 DOM 的 `scrollLeft`。
- 偏移除以每页宽度，得到当前页索引，控制下方圆点高亮。

源码没有自动轮播计时器。这是用户手动滑动的 Banner，不要把 `pagingEnabled` 理解成自动播放。

Banner 的 `Image` 使用 absoluteFill 填满卡片；外层圆角和 overflow hidden 裁切图片。推荐卡片的横向列表数量有限，所以这里使用 ScrollView，而不是必须给每个区块都套 FlatList。

#### 渐变快捷入口和点击目标

快捷入口的红色背景来自：

```tsx
<LinearGradient colors={['#FF6563', '#E73734']} style={styles.shortcutIcon}>
```

渐变只负责显示；外层 Pressable 调用 `router.push(shortcut.path)`。

`openBanner` 只处理两种上游目标：

- `targetType === 1000`：去 `/playlist/[id]`。
- `targetType === 1`：先取歌曲详情，再设置播放队列，去 `/player`。

其他类型被禁用，不打开活动外链，也没有伪造对应页面。

#### RefreshControl 的职责

外层 ScrollView 通过 `refreshControl={<RefreshControl ... />}` 获得刷新交互。`onRefresh` 同时重新取三类数据。

当前 `refreshing` 只组合推荐歌单和 Banner 的 `isRefetching`，没有包含排行榜状态。这是源码现状，不是 RN 要求排行榜不能参加刷新状态。读代码时要区分“框架规则”与“本项目选择”。

**练习观察**：缩放浏览器窗口，看 Banner 与卡片宽度变化；找到 `bannerWidth` 和 `cardWidth` 两个不同计算，解释为什么不是所有元素都同宽。

<a id="screen-rankings"></a>

### 6.3 排行榜：用一个熟悉页面练习组件和缓存复用

**文件**：[src/app/rankings.tsx](src/app/rankings.tsx)。

页面结构与歌单广场相近：SafeAreaView、PageHeader、配置提示、状态分支、三列 FlatList。

值得注意的是：

```tsx
queryKey: ['public', 'toplists'];
```

它与发现页一致。发现页只截取数据来显示，不是请求层只返回三项；排行榜页展示完整返回列表。

- `PlaylistCard` 一样负责封面和动态路由跳转。
- `columnWrapperStyle` 使用 `justifyContent: 'space-between'` 排列每行。
- `contentContainerStyle` 给内容加左右 padding 与上下留白。
- 当前本页没有传 `onRefresh`，不能因为使用了 FlatList 就认为必然有下拉刷新。

**看完应能解释**：相同组件为何能用于不同页面？相同 queryKey 的两页为什么可能不重复发首屏请求？

<a id="screen-playlist-detail"></a>

### 6.4 歌单详情：动态路由、分页列表、收藏和播放全部

**文件**：[src/app/playlist/[id].tsx](src/app/playlist/[id].tsx)。

这是第一个同时组合路由参数、两种查询、写操作和播放器入口的页面，建议分四次读。

#### 第一次：读参数和界面

```tsx
const { id } = useLocalSearchParams<{ id: string }>();
const playlistId = Number(id);
const validId = Number.isSafeInteger(playlistId) && playlistId > 0;
```

- `useLocalSearchParams` 读取当前路由参数。
- 类型标注帮助写代码，但不是运行时校验；路由仍属于外部输入。
- 转成正安全整数后才启用请求，避免非法 URL 直接请求接口。

界面是一条纵向 FlatList：

```text
SafeAreaView + 深色 PageHeader
  FlatList
    ListHeaderComponent
      LinearGradient 歌单信息
        封面、名称、创建者、介绍、收藏按钮
      播放全部行
    SongRow 歌曲列表
    ListEmptyComponent 状态提示
    ListFooterComponent 下一页状态
```

`PageHeader light` 适应深色背景；顶部歌单信息是渐变容器，歌曲区白色背景。`playAllRow` 的负 margin 与上部圆角，让白色区域略微覆盖渐变区域，这是布局实现，不是导航的特殊能力。

#### 第二次：读详情与歌曲分页

详情使用 `useQuery`，歌曲列表使用 `useInfiniteQuery`，它们是两种独立数据：

- `/playlist/detail`：名称、封面、收藏状态等元信息。
- `/playlist/track/all`：按 offset 和 limit 取歌曲，每批 50 首。路径含 `all` 不代表当前一次返回全歌单。

歌曲分页中的关键逻辑：

```tsx
initialPageParam: 0,
getNextPageParam: (lastPage, pages) =>
  lastPage.hasMore ? pages.reduce((total, page) => total + page.songs.length, 0) : undefined,
```

`pageParam` 在这里是已经跳过的条目数，不是第几页。`undefined` 表示没有下一页。

查询结果是 `data.pages`，页面通过 `flatMap` 合成已经加载的歌曲数组。

```tsx
onEndReached={() => {
  if (songsQuery.hasNextPage && !songsQuery.isFetchingNextPage)
    void songsQuery.fetchNextPage();
}}
onEndReachedThreshold={0.4}
```

`0.4` 是相对于可见列表长度的阈值，不是“总歌单加载了 40%”。触底事件可能多次发生，所以还要检查是否有下一页、是否已经在加载。

#### 第三次：读点击一首与播放全部

点击歌曲行：

```tsx
usePlaybackStore.getState().playSongs(queue, index);
router.push('/player');
```

先更新全局队列，再打开播放器。导航本身不负责播放，真正音频逻辑在全局 Provider。

当前点击单行使用的是页面已加载歌曲。**播放全部** 不同：如果仍有后续页，`playAll()` 会补齐剩余分页再建立队列。

补齐逻辑中包含：

- `loadingQueue` 阻止重复点击。
- AbortController 取消旧补齐请求。
- 按歌曲 ID 排除重复项。
- 服务声称有下一页却只返回旧歌曲时抛错。
- 最多补请求 200 页，避免异常分页无限循环。

这些是业务可靠性代码，不是 FlatList 自带功能。也要注意：这里的清理由 `useEffect` 的卸载/依赖变化触发，不像二维码登录那样使用 `useFocusEffect`，所以不要把所有页面任务都描述成“失焦立即停止”。

#### 第四次：读收藏

`useMutation` 调用 `subscribePlaylist(playlistId, !playlist?.subscribed)`，成功后使当前账号查询失效，再从服务端同步。

- 没配置 API：去设置。
- 没有 profile：去登录。
- 请求中：禁用收藏按钮。
- 请求失败：调用 RN `Alert.alert`。

`Alert` 是原生提示 API，本项目不能依赖它在 Web 与原生上表现完全一致。Web 预览的错误分支也应单独验证。

**看完应能解释**：详情信息和歌曲为何拆开？点第一首和播放全部为何可能得到不同队列长度？

<a id="screen-daily"></a>

### 6.5 每日推荐：列表头、嵌套文字和登录门槛

**文件**：[src/app/daily.tsx](src/app/daily.tsx)。

数据查询：

```tsx
queryKey: ['account', profile?.id, 'daily'],
enabled: apiConfig.isApiConfigured && Boolean(profile),
```

每日推荐依赖用户身份。游客可能有 Cookie，但没有 profile，不能因此启用个人推荐。

RN 重点：

- 页面使用 FlatList，渐变日期区和“播放全部”放在 `ListHeaderComponent`。
- 日期 Text 内嵌月份 Text，外层大字号，内层覆盖为小字号；这是 RN 文字内部排版。
- 没有歌曲时仍可显示列表头；ListEmptyComponent 负责提示。
- 没有登录时，提示和登录按钮放在 View 内组合。
- 播放全部按钮在空列表时 `disabled`，避免创建无意义的空队列。
- SongRow 传 `showArtwork` 显示封面，点击时用当前歌曲数组和索引建立队列。

当前日推 queryKey 没有包含日期，因此不要把页面上的当日日期理解为“到午夜自动重新查询”的实现。真实数据更新还要看缓存和接口行为。

**看完应能解释**：View 里放 Text，与 Text 里嵌 Text，有什么不同？“有凭据”和“有用户身份”为何分开？

<a id="screen-search"></a>

### 6.6 搜索：TextInput、键盘、建议和双列表分页

**文件**：[src/app/search.tsx](src/app/search.tsx)。

这个文件较长，先忽略底部全部样式，找四块：输入框、未提交界面、歌曲结果、歌单结果。

#### 两个关键词为什么不是多余的

- `keyword`：输入框当前文字。
- `submittedKeyword`：用户确认搜索后的关键词。

输入时展示建议、筛选历史和热搜；提交之后才取完整分页结果。修改已提交词时清空 submittedKeyword，回到输入界面，不继续拿旧结果冒充新关键词结果。

#### TextInput 与 Web input 的差异

源码节选：

```tsx
<TextInput
  ref={inputReference}
  value={keyword}
  onChangeText={handleKeywordChange}
  onSubmitEditing={() => submitSearch()}
  placeholder="搜索歌曲、歌手或歌单"
  placeholderTextColor={colors.muted}
  style={styles.input}
  returnKeyType="search"
  autoCapitalize="none"
  autoCorrect={false}
  accessibilityLabel="搜索关键词"
/>
```

- `onChangeText` 直接接收文本字符串，不需要 `event.target.value`。
- `onSubmitEditing` 响应输入提交。
- `returnKeyType="search"` 提示软键盘使用搜索动作样式，具体呈现由平台决定。
- `autoCapitalize="none"` 禁止自动大写，`autoCorrect={false}` 禁止自动纠正。
- `placeholderTextColor` 是组件属性，不是 CSS 的 `::placeholder`。
- ref 指向 TextInput 的组件实例，`.focus()` 是 RN 提供的能力，不是查询 DOM。

页面进入后用 80 毫秒计时器尝试 focus，清理时取消计时器。这个延时是项目的处理方式，不是 Expo 规定必须等 80 毫秒。

`submitSearch()` 中调用 `Keyboard.dismiss()` 收起键盘，同时保存本地历史。

#### 为什么列表里还要写 keyboardShouldPersistTaps

建议列表和歌曲列表使用：

```tsx
keyboardShouldPersistTaps = 'handled';
```

表示键盘出现时，已由子组件处理的点击不会只被用来收起键盘。它有助于用户直接点击建议或歌曲，而不是第一次点击仅关闭键盘。

这是滚动容器的键盘交互选项，不等于让键盘永远不关闭。

#### 搜索建议的防抖和取消

建议查询等输入稳定 300 毫秒后才发起：

1. 用定时器延后请求，降低逐字请求数量。
2. 关键词变化时清理计时器。
3. AbortController 取消旧请求。
4. 更新前检查取消标记与组件是否还挂载，防止旧结果覆盖当前输入。

这套建议逻辑是普通 React 副作用与网络取消，不是 Expo 专属搜索 API。

#### 歌曲和歌单分页

两种 `useInfiniteQuery` 都使用提交词作为 queryKey 的一部分，每批 30 条：

```tsx
getNextPageParam: (lastPage, allPages) =>
  lastPage.hasMore ? allPages.length * SEARCH_PAGE_SIZE : undefined,
```

返回的是 offset：0、30、60，不是 0、1、2。

- 歌曲结果用 SongRow，一列。
- 歌单结果用 PlaylistCard，两列，卡片宽度 `(width - 52) / 2`。
- `activeTab` 是本页内部 state 控制的分类，不是 Expo Router 的 Tabs 导航。
- 当前两类查询都由“已提交关键词”启用，不只启用正在看的分类，所以提交后两类查询都可能发起请求。
- 触底时调用对应的 `fetchNextPage()`。
- 搜索结果播放只使用当前已经加载的歌曲，不自动补完所有结果页。

源码为结果项组合 `${id}-${index}` 作为 key，允许同一个 ID 在结果里出现多次。key 解决列表识别问题，不是播放顺序的控制器。

**看完应能解释**：键盘输入、查询建议、确认搜索、触底分页是四个不同事件吗？其中哪一步会记录历史？

<a id="screen-mine"></a>

### 6.7 我的：账号恢复、头像、歌单货架和退出

**文件**：[src/app/(tabs)/mine.tsx](<src/app/(tabs)/mine.tsx>)。

界面分为账号卡片、喜欢/最近播放入口、创建/收藏歌单两个货架。

#### 三种账号界面

`renderProfile()` 按状态分支：

1. `hydrated === false`：恢复任务尚未完成，先显示加载。
2. 没 profile：显示登录入口。
3. 有 profile：显示头像、昵称和退出按钮。

`hydrated` 不是“已经登录”，是“启动恢复已经结束”。如果直接用 profile 是否为空判断，会在存储尚未读取时过早展示未登录。

头像使用 `expo-image`，`contentFit="cover"` 配合圆形 borderRadius；缺头像时显示图标占位。

#### PlaylistShelf 是本文件的普通组件

它接收标题、歌单数组、卡片宽度和空提示，不是一个路由页面。

- 外层垂直 ScrollView 组织整个页面。
- 每个货架使用横向 ScrollView 组织 PlaylistCard。
- 数据为空时显示 Text 提示。
- 卡片宽度用 `useWindowDimensions()` 加最小/最大值计算，不一直跟窗口无限放大。

创建/收藏分类使用 `playlist.subscribed` 字段过滤。这是本项目依赖的接口语义，不是 RN 能自动知道歌单属于谁。用户歌单接口当前最多取 1000 个，没有继续分页。

#### 退出为何有 signingOut

- `signingOut` 防止重复操作，并显示“退出中”。
- `signOut()` 来自 accountStore，负责清凭据和个人缓存。
- 本地搜索、最近播放并不随退出清空。
- 个人歌单和喜欢列表来自 accountQueries，不是在此页自己写 fetch。

**看完应能解释**：页面本地 state、Zustand 状态、Query 数据各自存了什么？

<a id="screen-collection"></a>

### 6.8 collection：一个路由，两种完全不同的数据来源

**文件**：[src/app/collection.tsx](src/app/collection.tsx)。

路由分别是 `/collection?type=recent` 和 `/collection?type=liked`。

```tsx
const { type } = useLocalSearchParams<{ type: string }>();
const isRecent = type === 'recent';
```

只有 `recent` 进入本地最近播放分支，其他值走喜欢列表分支。路径参数和查询参数都可以通过 Router 参数 Hook 读取，但要按业务规则处理。

#### 最近播放

- 数据直接来自 `useHistoryStore`。
- 不要求登录，不需要先请求 liked IDs。
- 记录属于设备本地，不等于上游账号听歌记录。

#### 喜欢的音乐

- `useLikedSongs()` 先取得歌曲 ID 数组，不是完整歌曲对象。
- `useInfiniteQuery` 再每批切 50 个 ID，调用 `getSongDetails()` 补全。
- queryKey 包含用户 ID 和喜欢 ID 列表，避免账号或列表变化后继续复用错误详情。
- `onEndReached` 仅在喜欢分支且有下一页时加载。
- 没有 profile 时显示登录提示。

两种来源最后都交给同一个 FlatList 和 SongRow。**复用 UI 不意味着它们的数据必须用同一种方式获取。**

`ListFooterComponent` 只在喜欢详情加载下一批时显示加载。当前没有独立的下一页错误尾部提示，不能把歌单详情的完整错误处理自动归到所有列表上。

**看完应能解释**：为什么喜欢列表要分两步请求？最近播放为什么刷新后还能出现？

<a id="screen-login"></a>

### 6.9 登录：移动端输入、二维码图片与页面焦点

**文件**：[src/app/login.tsx](src/app/login.tsx)。

先分成手机号验证码和二维码两条流程，不要同时逐行读两套异步逻辑。

#### 手机号表单的 RN API

- 手机输入 `keyboardType="phone-pad"`。
- 验证码输入 `keyboardType="number-pad"`。
- `maxLength` 控制最大输入长度。
- `onChangeText` 清理字符并更新 state。
- 外层 ScrollView 使用 `keyboardShouldPersistTaps="handled"`。
- 按钮请求中用 `disabled` 和透明度/文字状态反馈。

`keyboardType` 是输入体验提示，不是校验器。粘贴内容和 Web 输入都可能不符合要求，所以源码仍校验手机号、清理字符。

当前手机号只检查 5 至 15 位数字，区号固定 86，不代表号码真实有效。验证码输入移除空白，不应因为使用 number-pad 就宣称代码保证了纯数字。

同意说明通过 Pressable + 图标实现：

```tsx
accessibilityRole="checkbox"
accessibilityState={{ checked: consentGiven }}
```

视觉上的勾选图标和无障碍的 checkbox 状态同时更新。这不是 RN 自带的 Checkbox 组件。

#### 验证码冷却与登录完成

发短信成功后才启动 60 秒本地冷却。定时器每秒减一，清理时取消；服务端仍可能有自己的限流。

登录成功调用 `setSession(cookie, profile)`，再：

```tsx
router.replace('/(tabs)/mine');
```

`replace` 替换当前登录页面，避免成功后返回键又回到本次登录表单。它不表示清空全部导航历史。

#### 二维码使用 expo-image，不在客户端自己画二维码

流程为：取 key -> 请求二维码图片 -> 轮询状态 -> 验证 Cookie 对应资料 -> 建立会话。

接口可能返回完整图片地址，也可能返回 Base64。`normalizeQrImage()` 为裸 Base64 补 `data:image/png;base64,` 前缀。

二维码图片使用 `contentFit="contain"`，完整显示内容，避免 cover 裁掉可扫描区域。过期时叠加绝对定位的半透明 View 和刷新按钮。

#### useFocusEffect：本页最重要的 Expo Router API

源码在二维码流程中使用 `useFocusEffect(useCallback(...))`：

- 页面获得焦点且当前是二维码模式时开始任务。
- 切换模式、刷新二维码、页面失焦或卸载时清理旧任务。
- 清理 AbortController 和下一次轮询计时器。
- 请求完成后再安排 2 秒后的下次请求，避免 setInterval 造成慢请求重叠。

移动导航经常保留上一个页面，因此“跳转离开”不一定卸载组件。只写 `useEffect(..., [])` 的卸载清理，不能保证二维码在不可见时停止。

状态码 800、801、802、803 分别代表过期、等待扫码、等待确认、成功。请求层允许这些正常业务状态，不把等待扫码当异常。

成功之后还要用新 Cookie 验证用户资料，再保存会话，不是拿到一个字符串就假装登录成功。

**看完应能解释**：页面焦点与组件挂载有何区别？二维码为什么用 contain？手机键盘类型为何不能代替输入验证？

<a id="screen-settings"></a>

### 6.10 设置：手动触发的查询与可选择文字

**文件**：[src/app/settings.tsx](src/app/settings.tsx)。

这个页面没有输入框去实时改 API 地址。它显示当前配置，并提示编辑 `.env` 后重启 Expo。

连接检测查询：

```tsx
const connection = useQuery({
  queryKey: ['public', 'connection-check'],
  queryFn: ({ signal }) => neteaseApi.getRecommendedPlaylists(signal),
  enabled: false,
  retry: false,
});
```

`enabled: false` 关闭自动执行，但按钮可以调用 `connection.refetch()` 手动执行。

- 没有合法 API 地址或正在检测时禁用按钮。
- `isFetching` 控制“正在检测”文字。
- 成功只证明推荐接口响应，不证明登录、音源或后台播放正常。
- `retry: false` 避免用户一次点击检测触发自动重试。

配置文字使用 `<Text selectable>`，允许用户选择文本；这不是 HTML 的 input，也不是剪贴板 API。

清理按钮调用 historyStore 的两个动作，`cleared` 只是本页用于显示完成文字的临时状态，不表示退出账号或清空音频队列。

**看完应能解释**：disabled query 为什么还能 refetch？编辑 `.env` 与点击检测有什么区别？

<a id="screen-player"></a>

### 6.11 完整播放器：控制共享音频，不创建第二个播放器

**文件**：[src/app/player.tsx](src/app/player.tsx)。

先抓住两行：

```tsx
const playback = usePlayback();
const queue = usePlaybackStore();
```

- `playback` 提供真实音频状态和控制方法。
- `queue` 提供队列、切歌、模式和弹窗动作。
- 这个页面没有调用 `useAudioPlayer()`，因此不会与 MiniPlayer 各开一个音频实例。

#### 主要界面

```text
LinearGradient 全屏背景
  MusicCover 绝对定位，低透明度背景封面
  SafeAreaView，处理顶部和底部
    返回、歌名、歌手
    没有歌曲：引导去搜索/配置
    有歌曲：
      唱片 或 LyricsView
      喜欢按钮、歌词切换按钮
      错误/试听提示
      Slider 进度条
      模式、上一首、播放/暂停、下一首、队列
```

`useWindowDimensions()` 同时读宽高：

```tsx
const discSize = Math.min(310, width - 74, height * 0.4);
```

唱片要适应可用宽度，也要避免在矮屏幕上挤掉控制区。这不是只按屏幕宽度缩放的一张图片。

#### Slider：为什么有 dragPosition

真实进度会持续更新。如果拖动时仍直接显示播放器进度，手指位置可能被后续状态更新拉回。

- `onSlidingStart`：开始显示拖动位置。
- `onValueChange`：只更新本页临时 dragPosition。
- `onSlidingComplete`：清掉临时位置，调用 `playback.seek(position)`。
- `value={dragPosition ?? playback.position}`：拖动时显示手指位置，平时显示实际进度。
- 进度值与 duration 都是秒，不是百分比或毫秒。
- 加载或错误时禁用 Slider。

`maximumValue={Math.max(1, playback.duration)}` 避免尚未加载时最大值为 0，并不代表真实歌曲至少有一秒。

#### Animated：唱片旋转与音频是两条线

本文件的 `VinylRecord` 使用 RN `Animated`：

1. 用惰性 useState 初始化一个稳定的 `Animated.Value(0)`。
2. `Animated.timing` 让值向 1 变化。
3. `Easing.linear` 保持匀速。
4. `interpolate` 把 0 到 1 映射为 `0deg` 到 `360deg`。
5. 通过 `Animated.View` 的 `transform` 旋转整个唱片。

`useNativeDriver: true` 在支持的原生动画属性上将动画交给原生驱动。这里动画的是 transform，不能照搬这个选项去动画任意布局尺寸；Web 的执行方式也不能等同于原生。

暂停时 `stopAnimation()`，恢复时读取保留的位置，只完成剩余转角；一圈完成后重置为 0 再开始下一圈。20 秒是一圈的视觉时长，**不用于推算歌曲进度**。

#### 控制按钮分别操作哪层

- 播放/暂停：`playback.toggle()`，操作音频实例。
- 上一首/下一首：queue 动作，改变当前索引。
- 切模式：`queue.cycleMode()`。
- 打开队列：`queue.openQueue()`，让全局 Modal 显示。
- 点错误：`playback.retry()`，重新解析当前歌曲音源。
- 喜欢：accountQueries 的 mutation，不是本页单独持久保存一个爱心布尔值。
- `showLyrics`：只决定本页显示唱片还是歌词，不停止音频。

喜欢操作会先检查配置和 profile。当前喜欢状态来自当前账号喜欢 ID 列表，乐观更新、回滚与刷新在 accountQueries 中。

**看完应能解释**：唱片在转是否能证明声音在播放？拖 Slider 为什么不每次变化都 seek？返回上一页为什么音乐仍可继续？

---

<a id="shared-player"></a>

## 7. 共享播放器：Expo API 如何真正播放音乐

这一章把完整播放器背后的三个界面组件和核心 Provider 接起来。不要把一个“播放器页面”理解成播放器的全部。

### 7.1 队列 store 与音频 Provider 分工

[playbackStore](src/player/playbackStore.ts) 管：

- `queue`：待播放歌曲数组。
- `currentIndex`：当前项。
- `revision`：需要重新加载当前音源的版本号。
- `mode`：顺序、随机、单曲循环。
- `queueVisible`：队列弹窗开关。

[AudioPlayerProvider](src/player/AudioPlayerProvider.tsx) 管：

- 音频实例和原生/Web 音频状态。
- 取音源、替换音源、播放、暂停、跳转。
- 加载、错误、试听、地址过期。
- 原生媒体信息与结束事件。

`revision` 的意义是：重选同一首歌时，song 对象或 ID 可能没有变化，但仍然要重试加载；版本变化让副作用知道这是一次新的播放任务。

### 7.2 useAudioPlayer 和 useAudioPlayerStatus

源码：

```tsx
const player = useAudioPlayer(null, { updateInterval: 200 });
const status = useAudioPlayerStatus(player);
```

- `useAudioPlayer` 创建并管理音频实例，初始不提供音源。
- Hook 的生命周期随 Provider；Provider 在根布局中，不随单个页面离开而卸载。
- `updateInterval: 200` 声明状态更新间隔，单位毫秒，不是页面用计时器每 200 毫秒给进度加值。
- `useAudioPlayerStatus` 订阅实例状态，提供 playing、currentTime、duration、isLoaded、isBuffering 等。

页面看到的进度来自 `status.currentTime`，时长来自实际音源的 `status.duration`。Song 元数据中的 duration 不用于冒充实际试听片段时长。

### 7.3 setAudioModeAsync：音频行为配置

源码调用：

```tsx
setAudioModeAsync({
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: 'doNotMix',
  allowsRecording: false,
});
```

分别表达静音模式下播放、请求后台播放行为、不与其他音频混合的中断策略，以及不录音。

这些配置有平台适用范围。尤其后台播放，还需要原生配置、正确构建和设备验收；不能只加一个布尔值就承诺所有平台长期后台可靠。

Provider 将初始化 Promise 保存在 ref 中，解析歌曲时先等待它，避免音频模式尚未设置就开始播放。

### 7.4 一首歌曲被加载的具体步骤

当 song、revision 或会话 Cookie 改变时，音源副作用会运行：

1. 立即暂停旧音频。
2. 清除旧错误和试听标记；原生端清旧锁屏控制信息。
3. 为当前任务创建 AbortController。
4. 调用 `neteaseApi.getSongSource(song.id)`。
5. 没有 URL 就显示真实错误，不换成本地假音频。
6. 保存音源过期时间和试听标记。
7. `player.replace({ uri: source.url })` 替换音源。
8. 根据播放模式同步 `player.loop`。
9. 原生端调用 `setActiveForLockScreen` 设置歌名、歌手、专辑和封面。
10. 添加 `playbackStatusUpdate` 监听，再调用 `player.play()`。

切歌或任务结束时取消旧请求并移除监听，防止旧歌曲的慢响应覆盖新歌曲。

模式变化用另一个副作用只更新 `player.loop`，不会为了切换循环模式重新加载整首音源。

### 7.5 为什么监听里还要检查 revision

网络取消和监听移除都需要时间，快速切歌时仍可能收到旧回调。

源码同时检查：

- 当前任务是否已取消。
- store 的 revision 是否仍与启动任务时一致。

只有当前任务才可以写入播放历史或触发自动下一首。第一次实际收到 playing 才加入最近播放，点击后加载失败不计入历史。

自然播放结束时，非单曲循环调用 `next(false)`；单曲循环交给音频实例的 loop。结束事件可能重复，代码用 hasFinished 避免重复切歌。

### 7.6 toggle、seek 和 retry

**toggle**：正在播放就 pause；暂停时若音源失效/出错则 retry；如果已到结尾，先 seekTo(0) 再播放。

**seek**：音源已加载且没有错误才调用 `player.seekTo(...)`，目标被限制在 0 到实际时长之间。

**retry**：重新 select 当前索引并递增 revision，从头走音源解析任务。

请求层有 12 秒 HTTP 超时；Provider 另外对“拿到 URL 但音频仍未加载”设置 20 秒限制。这是两种不同的等待，不能只给网络 fetch 超时就覆盖音频加载问题。

### 7.7 MiniPlayer：同一份能力的另一套 UI

[MiniPlayer](src/components/MiniPlayer.tsx) 使用 `usePlayback()`：

- 无当前歌曲时不显示。
- 顶部细进度线用 `position / duration` 计算百分比宽度。
- 点击封面/歌名去完整播放器。
- 播放/暂停按钮调用同一个 toggle。
- loading 时显示 ActivityIndicator。
- 队列按钮只打开全局弹窗。

它不建立音频实例，也不维护一个独立的播放进度。因此完整播放器、MiniPlayer 和歌词能同步，而不是各自用 setInterval 模拟。

### 7.8 PlaybackQueueModal：RN Modal 不是 Router 页面

[PlaybackQueueModal](src/components/PlaybackQueueModal.tsx) 的核心属性：

```tsx
<Modal
  visible={state.queueVisible}
  animationType="slide"
  transparent
  onRequestClose={state.closeQueue}
>
```

- `visible` 控制显示。
- `animationType` 声明进入/退出动画。
- `transparent` 允许内容背后透出；遮罩颜色仍由内部 View 设置。
- `onRequestClose` 处理系统请求关闭，Android 返回键是重要场景。
- Modal 的原生行为和 Web 适配仍需分别观察。

内部 overlay 通过 `justifyContent: 'flex-end'` 把 sheet 放底部，绝对铺满的 Pressable 点击遮罩关闭，sheet 用安全区 inset 设置底部留白。

与播放器的 `presentation: 'fullScreenModal'` 区分：

- 完整播放器是 **Router 的页面呈现方式**。
- 播放队列是 **RN Modal 组件**，不改变 `/player` 等当前路由。

列表按队列索引选歌、高亮、删除，key 使用 ID + index，支持相同歌曲重复入队。删除当前曲之前的项只调整索引；删除当前曲才需要重新加载。

### 7.9 LyricsView：真实进度、FlatList 定位和 seek

[LyricsView](src/components/LyricsView.tsx) 先查询 LRC 原文，再用 [lyricParser](src/player/lyricParser.ts) 解析成 `{ time, text }[]`。

- `useMemo` 只在歌词原文变化时重新解析。
- `findActiveLyricIndex(lines, playback.position)` 根据实际秒数找当前行。
- `useRef<FlatList>` 保存列表实例。
- 当前行变化时调用 `scrollToIndex({ index, viewPosition: 0.5, animated: true })`，让目标行靠近中间。
- 点击某行调用 `playback.seek(item.time)`，不是只把文字高亮改掉。

列表用固定布局信息：

```tsx
getItemLayout={(_, index) => ({ length: 58, offset: 130 + 58 * index, index })}
```

58 对应行高，130 对应顶部 padding。虚拟列表可能还没测量远处的行，有 `getItemLayout` 就能计算位置；如果只改样式行高、不改这里，自动滚动会错位。

歌词解析是普通 TypeScript，不是 Expo API。解析器支持多个时间标签、秒的小数精度和 offset，并通过二分查找定位活动行。

无时间行时当前界面显示“纯音乐，请欣赏旋律”；接口失败会提供重试。这是当前 UI 的归类方式，并不证明所有缺少同步歌词的歌曲事实上都是纯音乐。

---

<a id="data-and-state"></a>

## 8. 数据、缓存、共享状态和本地存储

现在已经看过页面，再看这些文件就能知道它们服务谁，而不是只见抽象函数。

### 8.1 为什么有四层 API 文件

```text
页面 / Query Hook
  neteaseApi.ts        业务方法和接口路径
    apiRequest.ts     HTTP、会话、取消、超时、错误
  responseAdapters.ts 转成客户端统一模型
  musicTypes.ts       定义客户端模型
```

以推荐歌单为例：

1. 页面调用 `getRecommendedPlaylists(signal)`。
2. 业务层请求 `/personalized`，limit 为 18。
3. 请求层 POST 到配置地址，解析 JSON。
4. 业务层读 response.result，每项交给 adaptPlaylist。
5. 页面收到统一的 Playlist 数组，不需要到处兼容 picUrl 和 coverImgUrl。

这是跨平台项目的业务组织方式，不是 RN 规定必须拆四个文件。

### 8.2 responseAdapters：类型声明不能自动修正真实响应

`Song` 的客户端字段是 title、artists、album、artwork、duration 等，但上游可能返回：

- 详情：`name`、`ar`、`al`、`dt`。
- 搜索：`name`、`artists`、`album`、`duration`。

适配层统一这些差异，并把毫秒时长除以 1000 转成秒。

`asRecord`、`asArray`、`asString`、`asNumber` 处理未知类型；它们不是完整 schema 验证，也不会把任意数值字符串自动转换成 number。

`adaptProfile` 遇到没有有效 userId 的资料返回 null，不凭空创造一个已登录用户。

### 8.3 apiRequest：fetch 并不需要 Axios

本项目的请求层主要做这些事：

- 检查基础地址。
- 选择当前或显式传入的 Cookie。
- 使用 JSON POST body，不把凭据放 URL。
- `credentials: 'omit'`，不使用浏览器自动附带 Cookie。
- URL 加单调递增 timestamp，规避上游只按 URL 缓存造成的请求参数/会话混用。
- 连接取消信号并设置 12 秒超时。
- HTTP 错误优先于 body 中的业务 code。
- 认证失败通知账号模块，但只清理对应旧凭据。

这里使用 React Native 支持的 fetch 请求能力，页面不用判断自己是 Web 还是 Android 再改写一套请求。

`configureSessionAccessors` 由账号模块注入取 Cookie 和失效处理方法，避免请求层直接反向 import accountStore 形成循环依赖。

Cookie 在 body 里也仍然是敏感信息，不等于自动安全。服务地址必须可信，正式服务使用 HTTPS；不要打印或把 Cookie 发给别人。

### 8.4 Query 的缓存保存在哪里

[queryClient](src/config/queryClient.ts) 创建全局实例，默认设置：

- `staleTime: 120000`：两分钟内视为新鲜数据。
- `gcTime: 600000`：没有活动订阅后，缓存可保留十分钟。
- 只读查询最多额外重试一次，部分认证/参数/限流错误不自动重试。
- `refetchOnWindowFocus: false`：不因 Web 窗口重新获焦自动刷新。
- mutation 不自动重试，避免写操作重复提交。

staleTime 不是每两分钟自动请求一次，gcTime 也不是从首次获取时起固定十分钟删除。它们分别描述数据新鲜度与非活动缓存回收。

当前 Query 缓存是内存缓存，没有配置磁盘持久化。刷新整个 Web 页面，不应指望缓存和队列像历史记录一样保留下来。

个人数据 queryKey 包含 `['account', userId, ...]`；退出/换账号时先取消请求再移除缓存，避免旧账号在途数据重新写回来。

### 8.5 Zustand：订阅和 getState 的区别

```tsx
const profile = useAccountStore((state) => state.profile);
```

这是组件订阅，profile 变化时组件可以更新。只订阅自己需要的切片，通常比订阅整个 store 更明确。

```tsx
usePlaybackStore.getState().playSongs(songs, index);
```

这是在事件里取得当前动作并执行，不在这里建立一个 React 渲染订阅。`getState()` 很适合事件和服务层逻辑，但不能靠它代替界面上的响应式订阅。

当前完整播放器和队列组件订阅整个 playbackStore，这是源码现状，不是要求所有组件都这样写。

### 8.6 两种本地存储，两个安全等级

**historyStore + AsyncStorage**

- 保存 searches 和 recentSongs。
- Zustand persist 把状态序列化后交给 AsyncStorage。
- 搜索最多 20 条，最近播放最多 100 首，新的记录排前面并去重。
- 原生存储是异步的，启动恢复不是必然同步完成。
- 本地历史不因账号退出清空，也不上传 API。

源码中的 `storage: createJSONStorage(() => AsyncStorage)` 把 Zustand 的持久化数据转换成字符串存储格式，读取后再还原。页面调用 addSearch 等动作，不需要各自重复写 AsyncStorage.setItem；保存动作由中间件完成。

**accountStore + SecureStore**

- 原生端保存 Cookie，恢复时再向服务验证用户资料。
- Web 只保存在内存中，刻意不写浏览器持久存储。
- 存储写入/删除串行执行，防止退出后慢写入又恢复旧凭据。
- sessionRevision 防止旧登录/恢复任务覆盖新会话。
- 临时网络故障与确定凭据失效分开处理，不因为一次离线就随意删除已保存会话。

这里直接使用三个 Expo API：

- `SecureStore.getItemAsync(secureSessionKey)`：异步读取字符串或 null。
- `SecureStore.setItemAsync(secureSessionKey, JSON.stringify({ cookie }))`：保存序列化后的凭据数据。
- `SecureStore.deleteItemAsync(secureSessionKey)`：退出或确认失效后删除。

这些方法返回 Promise，读取/写入必须考虑等待与失败。SecureStore 不会自动向服务端验证凭据，恢复资料仍由 neteaseApi 完成；安全存储也不能替代可信 HTTPS 服务。

**playbackStore** 没有 persist。它保存当前运行过程的队列，不提供重启 App 后自动恢复队列的能力。

### 8.7 喜欢歌曲为什么有乐观更新

[accountQueries](src/account/accountQueries.ts) 中的 useToggleLike：

1. 取消旧喜欢列表查询。
2. 保存旧缓存快照。
3. 先更新当前账号的喜欢 ID 列表，让爱心及时反馈。
4. 发真实接口请求。
5. 失败时回滚快照。
6. 结束后使喜欢列表和详情缓存失效，同步服务端结果。

每步还检查账号是否变化，避免旧操作改到新账号。

乐观更新是交互设计，不是伪造成功；失败仍要回滚和展示错误。第一轮不要把这段保护当成练习对象随意删掉。

---

<a id="feature-flows"></a>

## 9. 把整个项目串起来的三条功能链

下面是调用关系示意，不是需要复制进项目的完整代码；实际参数和错误分支请对照前面的源码链接。

### 9.1 看歌单，然后打开详情

```text
歌单广场
  useQuery，queryKey 为 ['public', 'recommended']
    neteaseApi.getRecommendedPlaylists
      requestApi('/personalized')
        本地 API -> 上游
      adaptPlaylist -> Playlist[]
  FlatList -> PlaylistCard -> MusicCover
  点击卡片
    router.push({ pathname: '/playlist/[id]', params: { id } })
歌单详情
  useLocalSearchParams -> 校验 playlistId
  useQuery 取详情 + useInfiniteQuery 取歌曲
  SongRow 展示歌曲
```

你可以从 PlaylistCard 的 onPress 出发，先 F12 追路由，再 F12 追接口，而不是把所有文件一起摊开。

### 9.2 搜索一首歌，到真实播放与本地记录

```text
TextInput 输入 -> keyword
  300ms 后取建议
确认搜索 -> submittedKeyword + 写搜索历史
  useInfiniteQuery -> /cloudsearch -> Song[]
点击 SongRow
  playbackStore.playSongs -> queue/currentIndex/revision 更新
  router.push('/player')
根布局中的 AudioPlayerProvider 收到新任务
  /song/url/v1 -> 音源地址
  player.replace -> player.play
  useAudioPlayerStatus -> 真实进度
  实际开始 playing -> historyStore.addRecentSong
MiniPlayer / PlayerScreen / LyricsView 同步读取状态
```

导航和音频副作用不必按肉眼可见的严格先后执行；它们被同一次操作触发。关键是音频实例归根布局管理，不归新打开的页面管理。

### 9.3 登录后喜欢当前歌曲

```text
登录页 -> 真实接口返回 Cookie 和资料
  accountStore.setSession
    清旧个人缓存
    原生写 SecureStore / Web 只写内存
    更新 profile 和 cookie
  router.replace('/(tabs)/mine')
播放器点击爱心
  useToggleLike
    取消旧查询、保存快照、乐观更新 ID 列表
    /like 请求
    失败回滚 / 完成刷新
喜欢的音乐页面
  /likelist -> ID 数组
  /song/detail -> 分批补全 Song[]
  FlatList 展示
```

本地最近播放与这条账号链无关。不要把“最近播放看得到”误认为“账号登录恢复正常”。

---

<a id="platforms"></a>

## 10. Web、Expo Go、开发构建和原生构建的边界

### 10.1 当前学习从 Web 开始，但不要把 RN 学成普通网页

Web 可以观察：

- RN 组件组合和大部分布局。
- Router 路径、参数和页面内容。
- 接口、缓存、账号界面状态。
- 搜索、队列、歌词、前台播放器交互。

Web 不能代替验证：

- 真机安全区、软键盘、返回键、原生手势与转场。
- SecureStore 的设备持久化。
- 原生音频中断、耳机拔出、静音模式。
- 长时间后台、锁屏媒体控制、Android 服务行为。

浏览器还有自动播放策略、标签页后台限制和自己的网络/CORS规则。拿到了音源 URL，也不意味着浏览器或设备已经成功解码和播放。

### 10.2 Platform.OS 应该用在哪里

本项目在 accountStore 和 AudioPlayerProvider 中判断 `Platform.OS !== 'web'`：

- 非 Web 才读写安全凭据存储。
- 非 Web 才设置/清除原生锁屏媒体控制。

这说明有明确的平台边界。不要为了布局上的小问题就在所有页面塞满 Platform 分支；能靠共享组件和弹性布局完成的部分，优先共享。

### 10.3 Expo Go 与 development build 的区别

- Expo Go 是预先构建的通用运行容器，其可用原生模块和配置由这个容器决定。
- development build 是按项目原生模块与配置构建的开发客户端，可以搭配 `expo-dev-client`。
- 本项目的 `npm run start:dev` 只启动开发服务器，前提是原生设备上有相应客户端；它不是构建 APK 的命令。
- 后台播放等能力必须在相应原生构建中测试，不能拿 Expo Go 或 Web 的前台表现当完整验收。

### 10.4 这些命令分别处于哪一层

- `npm run web`：开发服务器和 Web 预览。
- `npm run start`：通用 Expo 开发服务器。
- `npm run android` / `npm run ios`：通过 `expo run:*` 构建和运行本地原生 App，需要对应环境。
- `npx expo prebuild`：从 Expo 配置生成/更新原生工程，不只是编译 TypeScript。
- `npm run export:web`：生成 Web 导出产物，不是 APK/IPA。
- `npx eas-cli build ...`：使用 EAS 构建，需要自己的账号、项目和签名配置。

Windows 不能本地运行 Xcode 或 iOS Simulator。当前只学 Web 时不需要为了看页面生成 android/ios 目录；需要原生时再按 README 搭建环境。

新增 Expo/RN 原生依赖时，优先用 `npx expo install <包名>` 配合当前 SDK 选择兼容版本，不要把某个教程中的版本号直接抄进 package.json。

### 10.5 当前代码的能力边界也要学清楚

- 应用内上一首/下一首已经写在队列逻辑中。
- 当前使用的 expo-audio 单播放器系统媒体 API 没有把系统上一首/下一首事件接到应用队列；锁屏 seek 不等于切歌。
- 后台自动换曲依赖播放结束事件进入应用控制器，不能只凭前台成功保证 iOS 长期后台可靠。
- 音源为空、试听、版权/会员限制会如实提示，不做绕过。
- 源码包含真实登录流程，不等于所有账号和服务版本已经验收。

学项目时，既要看“写了什么”，也要能分清“配置意图”“已实现逻辑”“实际设备验证”三者。

---

<a id="practice"></a>

## 11. 按轮次学习和动手，不要同时改一大块

每轮只选一个主要目标。先读，自己复述，再改小地方观察。下面是练习建议，这份教程没有替你修改任何业务代码。

### 第一轮：能看懂一张卡片和一个列表

读第 4、5 章与 6.1。

动手：

1. 改歌单广场副标题，确认修改来自哪个 Text。
2. 改 `styles.title.fontSize`，观察文字变化。
3. 改卡片圆角，找到 MusicCover 的 radius 参数与容器 overflow 的关系。
4. 给搜索按钮增加按压透明度，练习 Pressable 的 style 回调。

完成标准：不靠 AI 修改，自己找到文字、间距、封面尺寸和点击事件的对应代码。

### 第二轮：能说清路由和安全区

读第 4 章与 6.2、6.3、6.4 的参数部分。

动手：

1. 分别从首页、歌单卡片进入详情，看地址与文件如何对应。
2. 在 Web 直接打开一个合法详情地址，观察 PageHeader 无历史时的回退策略。
3. 找到 Tab 底部 inset 和页面 edges，解释为什么不是每个页面都加上下安全区。

完成标准：能区分 Stack、Tabs、动态参数、普通查询参数和 RN Modal。

### 第三轮：能处理加载、空内容、失败和刷新

读 6.1、6.4、6.10 与第 8 章 Query 部分。

动手：

1. 找到歌单广场的四类界面分支，不改成一个笼统的“没有数据”。
2. 在设置页手动检测服务，观察 isFetching 与 isPending 的区别。
3. 临时停止本地 API，观察查询错误与重试，然后恢复服务。
4. 在歌单详情触底，查看 offset 如何增长。

完成标准：能从页面追到业务方法与实际接口路径，理解 refetch 和 fetchNextPage 的区别。

### 第四轮：能做符合移动交互的输入页

读 6.6、6.9。

动手：

1. 修改搜索 placeholder，明确它不是 CSS 伪元素。
2. 在搜索页输入、修改、清空、提交，观察两种关键词 state。
3. 找到 Keyboard.dismiss 和 keyboardShouldPersistTaps 各自负责的事件。
4. 读二维码清理函数，不需要使用真实账号就先解释离开页面如何停止任务。

完成标准：不再用 event.target.value 和组件卸载的 Web 习惯解释全部 RN 输入/导航行为。

### 第五轮：能区分账号、设备记录和缓存

读 6.7、6.8 与第 8 章存储部分。

动手：

1. 搜索几个词，刷新 Web，观察本地历史恢复。
2. 对照代码解释为什么账号恢复与历史恢复不同。
3. 找出 queryKey 中用户 ID 的位置，解释切换账号时为什么要清个人缓存。
4. 使用设置页清理记录，确认不是退出账号或清播放队列。

完成标准：能分清 Query 内存缓存、Zustand 内存状态、AsyncStorage 历史、SecureStore 凭据。

### 第六轮：能控制一份共享音频

读 6.11 与第 7 章。

动手：

1. 播放可用歌曲，切去搜索/我的，再从 MiniPlayer 回播放器。
2. 找到 playing、position、duration 的唯一来源。
3. 修改唱片视觉旋转时长，确认音频进度不会随之变快。
4. 修改歌词行高时同步 getItemLayout，理解定位公式。

完成标准：能画出“页面事件 -> 队列 -> Provider -> expo-audio -> UI 状态”的链路。

### 第七轮：尝试独立增加一个小 RN 界面

完成前六轮后再做，不在刚开始时碰凭据和音源核心逻辑。

建议任选一个：

- 在设置页增加一个纯展示区块，用 View、Text 和 Pressable 实现展开/收起说明。
- 在搜索历史区增加“只显示最近五条/显示全部”的本页切换，不改变持久化结构。
- 为一个按钮加更明确的 accessibilityLabel 和按压反馈。

先写清输入、状态、界面和事件，再实现。不是“把整个页面换一种框架”，而是在现有 RN 组件和样式体系里独立完成一个小闭环。

---

<a id="debugging"></a>

## 12. 遇到问题怎么定位，以及去哪里查文档

### 12.1 先区分问题所在层

**页面打不开或编译失败**

看 Expo 开发终端，检查 import、路由文件、TypeScript/JSX 和依赖。不要先排查音乐接口。

**页面出来，但没有歌单**

检查 API 进程是否启动、apiConfig 是否有效、设置页检测结果和请求错误。配置合法不代表端口可达。

**有歌单，但歌播放不了**

分清拿不到 URL、拿到试听 URL、播放器加载失败、浏览器自动播放限制或设备音频问题。歌曲 fee 标签只是提示，最终以音源返回为准。

**布局错位或点击不到**

检查父容器尺寸、flex、contentContainerStyle、绝对定位、overflow、safe area 和 hitSlop。浏览器看着正常仍要考虑真机触摸与软键盘。

**离开页面后任务仍运行**

检查它依赖组件卸载清理还是页面失焦清理；查询取消信号是否真正传到 fetch；计时器/监听是否移除。

**刷新后记录丢了或账号不在**

先看该状态是否有 persist、使用哪种存储、是否在 Web 分支跳过持久化。不要把所有 state 都当成自动保存。

### 12.2 修改后如何检查

先观察实际修改的界面，再按修改范围选择命令：

```bash
npm run typecheck
npm run lint
```

改切歌规则、歌词解析或请求适配时，再运行：

```bash
npm test
```

- `tests/playback.test.ts` 验证歌词时间和播放队列边界。
- `tests/netease.test.ts` 验证请求 Cookie、缓存隔离、认证失败、二维码等待状态和响应适配。
- 当前测试是 Node 纯逻辑/请求层测试，不是 RN 页面点击测试，也不会证明真实原生后台播放正确。
- `npm run export:web` 检查 Web 生产打包，不是原生构建或真实接口验收。

### 12.3 查 API 时先查正确的来源

先看 import，再找官方文档：

- [React Native 组件与 API](https://reactnative.dev/docs/components-and-apis)：View、Text、Pressable、TextInput、FlatList、Modal、Animated 等。
- [React Native Flexbox](https://reactnative.dev/docs/flexbox)：布局主轴、交叉轴、flex 与间距。
- [Expo Router](https://docs.expo.dev/router/introduction/)：文件路由、布局、Stack、Tabs、参数与焦点 Hook。
- [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/)：本项目 Image 的属性，不要查错成 RN Image。
- [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/)：音频模式、播放器、状态与平台限制。
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)：安全存储与平台支持。
- [Expo Safe Areas](https://docs.expo.dev/develop/user-interface/safe-areas/)：安全区与 safe-area-context。
- [TanStack Query React](https://tanstack.com/query/latest/docs/framework/react/overview)：查询、分页、mutation 和缓存状态。
- [Zustand](https://zustand.docs.pmnd.rs/getting-started/introduction)：store、订阅和 persist。
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)：开发客户端与 Expo Go 的区别。

Expo 文档的 latest 页面会随版本变化，查阅时选择与项目 SDK 匹配的版本；RN 与各第三方库也要对照已安装版本。不要把另一版本中存在的 API 当成当前项目必然可用。

### 12.4 让 AI 帮你学习，而不是替你跳过学习

可以这样问：

> 按 PROJECT_WALKTHROUGH.md 的 6.1，解释歌单广场里 FlatList 的每个属性。先对应页面，再解释 API，不改代码，最后给我一个小练习。

> 我能看懂 player.tsx，但不懂为什么返回后音频不停止。请从根布局、AudioPlayerProvider 和 useAudioPlayer 的生命周期解释，不要扩展到无关库。

> 请检查我对 useFocusEffect 的理解是否正确，再用登录页的清理函数举例。不要替我重写整个登录页。

每读完一个功能，自己写四句话：**谁提供数据、谁画界面、点击改变了什么、离开页面后什么继续存在。** 能把这四句话对应到源码，就说明你在理解这个 RN/Expo 项目，而不是只记了一串 API 名字。
