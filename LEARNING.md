# 给熟悉 React 的前端开发者：Expo 与 React Native 学习指南

这份说明假设你已经熟悉 JavaScript、TypeScript、React、组件、Hooks、异步请求和常见前端工程。这里不再讲 `map`、`useState`、`props` 等 React 基础，而是专门解释这个项目里你需要补上的 **Expo、React Native、Expo Router，以及 Web 与原生平台的边界**。

本项目当前主要通过 Web 学习和预览，但代码目标仍然是 Expo + React Native。你可以把它当成一个“用 React 写、由不同渲染器运行”的项目：React 的组件思维仍然成立，DOM、CSS、浏览器 API 和原生模块的使用方式需要调整。

## 1. 先建立正确的运行模型

这个项目有两个互相独立的进程：

- **Expo 客户端**：`src/` 里的页面、组件、状态和请求代码，浏览器或原生应用运行它。
- **本地 API 服务**：`npm run api:start` 启动的 `NeteaseCloudMusicApi`，负责向上游接口请求网易云数据。

完整的数据路径通常是：

```text
页面 -> neteaseApi -> requestApi -> 本地 API 服务 -> 上游音乐接口
页面 <- responseAdapters <- 统一的数据模型
```

`node_modules/` 里的第三方包不是本项目的业务代码，第一轮不要进去阅读，也不要直接修改。真正值得学习的是项目如何在 `src/api/` 这一层隔离外部服务。

### React 与 React Native 的关键差异

React 的组件、props、state、Hooks 和渲染模型不变，变化主要在渲染目标：

- `View` 大致对应 Web 的 `div`，但它不是 DOM 节点。
- `Text` 用来显示文字；文字不能像 Web 中那样直接放在普通容器里。
- `Pressable` 处理点击和按压状态，常用于替代 `button`。
- `TextInput` 替代 `input`，事件通常使用 `onChangeText`、`onSubmitEditing`。
- `Image` 或本项目使用的 `expo-image` 替代 `img`。
- `FlatList` 适合长列表，职责类似“带虚拟化的列表组件”，不是简单的 `map`。
- 样式是 JavaScript 对象，通过 `StyleSheet.create`、数组和内联对象组合，不使用 CSS 选择器、级联或伪类。

RN 样式中的数字通常是逻辑尺寸，不直接等同于 CSS 像素；默认主轴是纵向，`flexDirection`、`alignItems`、`justifyContent` 的用法仍然熟悉，但布局细节与浏览器 CSS 不能完全类比。颜色、字号、间距等公共值集中在 `src/styles/theme.ts`。

### Expo 与 React Native 的分工

- **React Native**：提供跨平台渲染和基础原生组件。
- **Expo**：提供开发服务器、模块、配置和构建工具，例如 `expo-image`、`expo-audio`、`expo-secure-store`。
- **Expo Router**：建立在 React Navigation 之上的文件路由系统，根据 `src/app/` 文件结构生成页面和导航。

Expo 不是 API 服务，也不是一个替代 React 的 UI 框架。你在这里主要学习的是“React 组件如何运行在 RN/Expo 环境中”。

## 2. 这个项目最需要补的 RN/Expo 知识

按优先级理解下面几个主题即可：

1. RN 基础组件与样式：`View`、`Text`、`Pressable`、`ScrollView`、`FlatList`、`StyleSheet`。
2. Expo Router：`_layout.tsx`、`index.tsx`、`[id].tsx`、路由分组和 `router.push`。
3. Expo 上下文与模块：`SafeAreaProvider`、`expo-image`、`expo-audio`、`expo-secure-store`。
4. Web 与原生差异：`react-native-web`、`Platform.OS`、浏览器音频限制、安全区和原生后台能力。
5. 本项目的状态边界：TanStack Query 管服务端数据，Zustand 管客户端共享状态。

不要先学 Expo 的全部 API。学习一个功能时，只补这个功能实际用到的模块。

## 3. 你应该如何运行和观察这个项目

运行方法的完整说明在 [README.md](README.md)。当前先只学习 Web，不需要 Android SDK、模拟器或 APK。

依赖未安装时，在项目根目录执行一次：

```bash
npm ci
```

然后使用两个终端：

```bash
# 终端 1：API 服务
npm run api:start

# 终端 2：Expo Web 开发服务
npm run web
```

浏览器打开 Web 终端显示的地址，通常是 `http://localhost:8081`。API 默认运行在 `3000` 端口。根目录 `.env` 中的 `EXPO_PUBLIC_API_BASE_URL` 决定客户端请求哪个 API 地址，修改后需要重启 Expo。

`package.json` 中值得先认识的脚本：

- `start`：启动通用 Expo 开发服务器。
- `web`：以 Web 平台启动 Expo。
- `api:start`：启动本地网易云 API 服务。
- `typecheck`：运行 TypeScript 类型检查。
- `lint`：运行 ESLint。
- `test`：运行当前的纯逻辑测试。
- `export:web`：生成 Web 静态导出，用于检查生产构建是否能打包。

## 4. 这个项目的 React Native 文件对应关系

- `src/app/`：Expo Router 页面和布局，不是传统 React 项目里的普通组件目录。
- `src/components/`：可复用 UI 组件。
- `src/api/`：接口请求、响应适配和业务数据类型。
- `src/account/`：会话和账号相关查询。
- `src/player/`：播放队列、原生音频实例和歌词。
- `src/history/`：使用 AsyncStorage 持久化的本地历史。
- `src/config/`：API 地址和 TanStack Query 配置。
- `src/styles/`：主题 token。
- `src/utils/`：与平台无关的展示工具函数。

几个 Expo Router 约定：

- `src/app/_layout.tsx`：根布局，负责全局 Provider、Stack、共享播放器和播放队列弹窗。
- `src/app/(tabs)/_layout.tsx`：标签栏布局；`(tabs)` 是路由分组名，不会成为 URL 的一段。
- `src/app/(tabs)/index.tsx`：发现页，`index` 是该目录的默认页面。
- `src/app/playlist/[id].tsx`：动态路由，`[id]` 从 URL 参数中读取具体歌单 ID。
- `router.push(...)`：导航到另一个路由；`useLocalSearchParams`：在页面中读取路由参数。

这个项目没有要求你寻找传统的 `App.tsx` 作为业务入口。`package.json` 的 `main` 是 `expo-router/entry`，路由框架会接管页面入口。

## 5. 前端开发者需要特别适应的 RN 约定

### 没有 DOM，也不要用 DOM 思路排查

这些组件最终不一定对应浏览器节点：不要在业务代码中依赖 `document.querySelector`、CSS class 选择器、事件冒泡或直接修改 DOM。要通过 props、state、Hook 和 RN 组件提供的能力完成交互。

当前 Web 预览由 `react-native-web` 适配，所以浏览器里看起来像网页，但它不是普通 React DOM 项目。能在 Web 中运行，不代表使用了 DOM API，也不代表 Android/iOS 的行为完全相同。

### 样式不是 CSS 文件

本项目的样式主要位于每个文件底部的 `StyleSheet.create`：

- `style={styles.title}`：使用一个样式对象。
- `style={[styles.title, active && styles.active]}`：按顺序合并样式，后面的有效样式可能覆盖前面的同名属性。
- `style={{ width }}`：适合少量动态值，不要把大段样式都写成内联对象。
- 没有 CSS 选择器、媒体查询和级联；响应式布局通常使用 `useWindowDimensions`、Flexbox 和条件样式。

### 生命周期和页面焦点不是一回事

移动端页面可能被导航系统保留而不卸载，因此“离开页面”不一定触发组件卸载。二维码轮询使用 `useFocusEffect`，搜索建议和音频请求使用 AbortController，都是为了在页面失焦或输入变化时停止旧任务。

阅读 `src/app/login.tsx` 时，重点看清 `useFocusEffect` 的清理函数；阅读 `src/app/search.tsx` 时，重点看建议请求如何取消。不要只用 Web 开发中常见的“组件卸载时清理”来推断移动导航行为。

### 平台 API 必须单独验证

`Platform.OS`、`expo-audio`、`expo-secure-store`、安全区、键盘、后台播放都可能在 Web 与原生之间有差异。当前项目明确以 Web 作为学习和前台界面预览环境；浏览器验证通过，不能等价证明原生后台音频、锁屏控制和安全存储已经通过。

## 6. 推荐的代码阅读顺序

你已经会 React，所以不要从工具函数开始。先看“应用如何组合”，再追一个简单页面的完整数据流，最后进入播放器和账号这些平台相关代码。

### 阶段一：先看应用组合，而不是业务细节

按以下顺序打开：

1. `package.json`：确认入口是 `expo-router/entry`，以及 Expo SDK、React Native、Router 的版本。
2. `src/app/_layout.tsx`：看根 Provider、Stack、共享播放器和队列弹窗。
3. `src/app/(tabs)/_layout.tsx`：看自定义标签栏和迷你播放器怎样组合。
4. `src/app/(tabs)/index.tsx`：看发现页如何作为一个普通路由页面被渲染。

先画出这棵树：

```text
SafeAreaProvider
└─ QueryClientProvider
   └─ AppNavigation
      └─ AudioPlayerProvider
         ├─ Stack（各个路由页面）
         ├─ MiniPlayer（部分页面）
         └─ PlaybackQueueModal
```

重点不是背 Provider，而是理解它们的作用域：为什么页面可以调用 `useQuery`，为什么任意页面都能调用 `usePlayback`，为什么切换路由后播放器仍然存在。

**过关标准：能解释“页面路由”和“全局能力”分别在哪里定义，以及为什么播放器不应该放在某一个具体页面内部。**

### 阶段二：看懂一个界面零件

按顺序打开：

1. [src/components/SectionHeader.tsx](src/components/SectionHeader.tsx)。
2. [src/components/PlaylistCard.tsx](src/components/PlaylistCard.tsx)。
3. [src/components/MusicCover.tsx](src/components/MusicCover.tsx)。
4. [src/styles/theme.ts](src/styles/theme.ts)。

读组件时，不必从 import 一路逐字读到底。先找 `return (...)`，对应网页上看到的内容，再向上看输入参数，最后看底部的样式。

常见组件可以这样理解：

- `View`：摆放其他内容的容器。
- `Text`：显示文字。
- `Pressable`：可以响应点击的区域。
- `Image`：显示图片。
- `StyleSheet.create`：集中定义字号、颜色、间距等样式。

重点看 `PlaylistCard`：父页面传进来 `playlist`，卡片显示 `playlist.name`，将 `playlist.coverUrl` 交给 `MusicCover`，用 `formatPlayCount` 显示播放次数。点击时通过 `router.push` 打开歌单详情。

**过关标准：能找到歌单名称、封面、播放次数和点击行为分别由哪几行代码决定。**

### 阶段三：看懂一个完整但比较简单的页面

打开 [src/app/(tabs)/playlists.tsx](<src/app/(tabs)/playlists.tsx>)。

虽然默认首页是“发现”，但先看“歌单广场”更容易：它主要处理一种列表数据，而发现页同时处理 Banner、推荐歌单和排行榜。

这个页面可以分成三部分：

1. 顶部引入需要的组件和函数。
2. `PlaylistsScreen` 中查询歌单，并决定显示加载、错误还是内容。
3. 底部 `styles` 控制布局。

重点看：

```ts
const playlistsQuery = useQuery({
  queryKey: ['public', 'recommended'],
  queryFn: ({ signal }) => neteaseApi.getRecommendedPlaylists(signal),
  enabled: apiConfig.isApiConfigured,
});
const playlists = playlistsQuery.data ?? [];
```

先把 `useQuery` 理解成“帮页面管理这次数据查询的工具”：

- `queryKey`：缓存的标识。同一个查询标识可以复用已有数据，它不是接口地址。
- `queryFn`：真正获取数据的函数。这里调用 `getRecommendedPlaylists`。
- `enabled`：是否允许自动发起查询；没配置 API 地址时不自动请求。
- `signal`：传给请求层的取消信号，让旧请求在不再需要时有机会被取消。
- `data`：查询成功后得到的数据。
- `isPending`：尚未得到成功数据的状态；本页先区分未配置，再用它显示加载提示。
- `isError`：本次查询失败。
- `refetch`：重新获取数据。

再看 `FlatList`：`data` 是要展示的列表，`renderItem` 说明“列表中每一项怎么画”，这里每一项使用一个 `PlaylistCard`。

**过关标准：能说清楚数据没到、请求失败、请求成功这三种情况下，页面分别显示什么。**

### 阶段四：顺着调用，看懂数据从哪里来

按这个顺序打开，不必一口气读完每个文件：

1. `src/api/musicTypes.ts`：先看 `Playlist`，认识页面需要哪些字段。
2. `src/api/neteaseApi.ts`：只看 `getRecommendedPlaylists`。
3. `src/config/apiConfig.ts`：看 API 基础地址从哪里来。
4. `src/api/apiRequest.ts`：先找 `fetch`，理解请求地址、请求体和返回 JSON。
5. `src/api/responseAdapters.ts`：只看 `adaptPlaylist`，理解字段转换。

**JSON** 是接口中常见的数据格式，可以先理解成用文字传输的对象和数组。请求成功后，程序还需要解析它，才能读取其中的字段。

第一次读 `apiRequest.ts` 时，先理解“构造地址 -> 发出请求 -> 读取响应 -> 出错时抛出异常”。Cookie、取消、超时和缓存隔离可以第二遍再读。

`responseAdapters.ts` 的存在，是因为上游接口返回的字段不完全一致。例如封面可能叫 `coverImgUrl` 或 `picUrl`，页面统一使用 `coverUrl`，就不用在每个页面处理两套名字。

**过关标准：能解释为什么页面不直接使用所有上游原始字段，以及 `Playlist` 类型和真实接口数据有什么区别。**

### 阶段五：理解 Expo Router 的动态路由

现在追踪一次点击和参数传递：

1. 在 `src/components/PlaylistCard.tsx` 找 `router.push`。
2. 看它如何把 `playlist.id` 填入 `/playlist/[id]`。
3. 打开 `src/app/playlist/[id].tsx`，看 `useLocalSearchParams` 如何取得 `id`。
4. 继续看 `playlistId` 的校验、查询键和 `neteaseApi.getPlaylist(playlistId)`。

这里与 Web Router 的核心思想相同，但路由文件本身就是路由配置的一部分。`[id].tsx` 是一个页面模板，不是某一首固定歌单；不同的参数会让同一个页面请求不同数据。

**过关标准：能解释一个 `PlaylistCard` 为什么只需要传 id，而不需要把整个歌单对象塞进下一个页面。**

### 阶段六：理解“多个页面共享状态”和播放

先读 `src/history/historyStore.ts`，再读 `src/player/playbackStore.ts`。

这里使用 **Zustand** 管理共享状态。可以把 store 理解成多个页面共用的一个数据存放处：搜索页和设置页都能操作历史，详情页和播放器都能操作播放队列。

先认清两类数据：

- `useQuery` 管理从服务端取得的数据，例如歌单列表及其加载状态。
- store 管理客户端的共享状态，例如当前队列、当前曲索引、本地历史。

然后追踪播放：

1. 详情页调用 `playSongs`，更新队列和当前曲索引。
2. `AudioPlayerProvider.tsx` 订阅这些变化，调用 `getSongSource` 获取音源地址。
3. 音频实例加载地址并开始播放，报告进度与状态。
4. `MiniPlayer.tsx` 和 `app/player.tsx` 读取共享播放状态，显示控件并发送控制指令。

**`playbackStore.ts` 不负责真正发出声音，`AudioPlayerProvider.tsx` 才负责音频实例。** 这也是切换页面后，音乐不必重新开始的原因。

这个阶段再读 `playbackQueue.ts` 的切歌规则；需要理解歌词时再读 `lyricParser.ts`，最后读 `LyricsView.tsx`。

**过关标准：能区分“选择下一首歌”和“让音频开始播放”，知道迷你播放器与完整播放器不是两个独立音频实例。**

### 阶段七：最后学习搜索、账号和复杂异步行为

建议顺序：

1. `src/app/search.tsx`：输入词与提交词、搜索建议、分页。
2. `src/account/accountStore.ts`：用户资料、凭据、恢复与退出。
3. `src/account/accountQueries.ts`：个人数据查询与喜欢状态更新。
4. `src/app/login.tsx`：验证码流程、二维码轮询、离开页面时取消任务。

这里有几个进阶问题：

- 输入词刚变，旧的请求可能还没完成，怎样避免旧结果覆盖新结果？
- 为什么喜欢列表的缓存要包含用户 ID？
- 为什么有游客 Cookie 也不代表用户已经登录？
- 二维码轮询为什么不能在离开页面后继续执行？

等前面的基础掌握后再研究这些问题，不需要在第一轮学习时一次解决。

## 7. 用“推荐歌单”串起一次完整阅读

这是最适合你第一次追踪的业务功能：

1. `app/(tabs)/playlists.tsx` 要显示推荐歌单，交给 `useQuery` 管理查询。
2. `neteaseApi.getRecommendedPlaylists` 调用 `/personalized`。
3. `apiRequest.requestApi` 拼接 `.env` 配置的基础地址，以 POST 方式发送请求。
4. 本地 API 服务处理请求，返回包含 `result` 的数据。
5. `responseAdapters.adaptPlaylist` 把每一项转换成客户端统一的歌单结构。
6. 查询结果交回页面，`FlatList` 为每一项显示 `PlaylistCard`。
7. 点击卡片，把 id 传给 `playlist/[id].tsx`，详情页请求对应歌单。

注意：有缓存时可能直接复用数据，未必每次进入页面都重新请求。上面描述的是需要取新数据时的主线。

第一遍只要能沿着这条主线找到相应函数，就已经不是“完全不知道项目怎么工作”了。

## 8. 做哪些小练习最合适

每次只修改一个目标，先备份要改的文件或记录原值，不要让 AI 一次替你改一大块。

1. **修改文字**：在 `app/(tabs)/playlists.tsx` 把“总有一首歌，刚好懂你”改成自己写的一句。保存，观察网页变化。
2. **修改样式**：只修改该页 `styles.title` 的字号。理解 JSX 的 `style={styles.title}` 与底部样式对象的对应关系。
3. **练习传参**：在 `SectionHeader.tsx` 看 `action ?? '查看更多'`，到发现页找一处 `SectionHeader`，给它传入不同的 `action` 文字，观察覆盖默认值的效果。
4. **追踪数据**：不修改接口，找到 `getRecommendedPlaylists` 的返回值是怎么成为 `FlatList.data` 的。
5. **观察失败**：先记下 `.env` 原值，临时把 API 地址改成同机一个确认没有服务监听的端口，重启 Web，观察错误提示；然后恢复原地址并再次重启。不需要修改请求层来制造错误。

开始阶段不要拿凭据存储、请求取消或播放器核心逻辑当练习对象。这些代码看起来只改一行，也可能影响账号安全或异步行为。

## 9. 在 Cursor 里怎么读代码

- `Ctrl + P`：输入文件名，快速打开文件。
- `Ctrl + Shift + F`：在项目中搜索文字，比如“歌单广场”，找到它在哪个文件。
- `F12` 或 Ctrl 点击函数名：跳到定义。例如从 `getRecommendedPlaylists` 跳到接口实现。
- 鼠标悬停在变量上：看它的类型，确认它是一个对象、数组，还是查询结果。
- `.md` 是说明文档；可以通过编辑器预览查看这份指南和 README。

阅读每一段代码时，用这四个问题做笔记：

1. 它接收什么输入？
2. 它返回什么数据，或者更新什么状态？
3. 谁调用它，它又调用谁？
4. 成功、失败或没有数据时，用户会看到什么？

如果向 AI 提问，尽量指定文件和目标。例如：“解释 `PlaylistCard.tsx` 的参数与点击事件，先不要修改代码”，比“解释全部项目”更容易获得你能消化的答案。

## 10. 修改后怎么知道有没有弄坏

先在网页上验证你改的内容，再按需要执行检查：

```bash
npm run typecheck
npm run lint
```

- `typecheck` 检查类型，例如参数应当是数字却传了字符串。
- `lint` 检查代码规则，例如 Hook 的使用方式。它们不能证明所有真实接口都正常。

等你开始修改歌词或切歌规则时，再结合现有测试学习：

```bash
npm test
```

测试也是“给定输入，检查输出”的示例。例如 `tests/playback.test.ts` 展示了顺序播放到队尾、手动下一首和随机播放的预期行为。第一轮不需要先研究整个测试框架。

遇到问题，先区分是哪一层：

- 页面打不开：先看 Web 终端是否启动成功，以及是否有编译错误。
- 页面打开但没有歌单：检查 API 终端、`.env` 地址，再到设置页检测连接。
- 有歌单但某首歌不能播放：可能是版权、会员、音源或浏览器播放限制，不一定是你的代码写错。
- 只有登录相关功能失败：先看接口反馈，不要为了让界面“看起来成功”而删掉错误处理。

不要把 Cookie 或验证码贴给 AI，也不要将没有访问控制的本地 API 服务暴露到公网。Web 学习和预览成功，也不等于 Android/iOS 的后台与锁屏播放已经验证。

## 11. 今天从哪里开始

不用把整份指南一次学完。既然你已经会 React，今天按下面顺序做：

1. 运行 `npm run api:start` 和 `npm run web`，确认 Web 预览与 API 是两个独立进程。
2. 打开 `src/app/_layout.tsx` 和 `src/app/(tabs)/_layout.tsx`，画出 Provider、Stack、标签栏和播放器的关系。
3. 打开 `src/app/(tabs)/playlists.tsx`，沿着 `useQuery -> neteaseApi -> requestApi -> PlaylistCard` 追完推荐歌单数据流。
4. 修改 `PlaylistCard` 或歌单页面的一处 RN 样式，观察 `StyleSheet` 和 `react-native-web` 的效果。
5. 最后再看 `src/app/playlist/[id].tsx`，理解 Expo Router 的动态参数。

**之后每次沿着一个功能读下去：先理解 RN 渲染差异，再看页面，再看数据，最后进入原生模块。不要按文件夹顺序机械地从头读到尾。**
