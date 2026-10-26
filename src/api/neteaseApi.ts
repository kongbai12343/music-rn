import { adaptBanner, adaptPlaylist, adaptProfile, adaptSong } from './responseAdapters';
import { ApiError, asArray, asNumber, asRecord, asString, requestApi } from './apiRequest';
import type {
  Banner,
  Playlist,
  PlaylistPage,
  Song,
  SongPage,
  SongSource,
  UserProfile,
} from './musicTypes';

/** 封装真实业务接口并统一响应结构；HTTP、凭据和错误处理由请求层负责。 */
export const neteaseApi = {
  async getBanners(signal?: AbortSignal): Promise<Banner[]> {
    const response = await requestApi('/banner', { type: 1 }, { signal });
    return asArray(response.banners)
      .map(adaptBanner)
      .filter((banner) => banner.imageUrl);
  },
  async getRecommendedPlaylists(signal?: AbortSignal): Promise<Playlist[]> {
    const response = await requestApi('/personalized', { limit: 18 }, { signal });
    return asArray(response.result).map(adaptPlaylist);
  },
  async getToplists(signal?: AbortSignal): Promise<Playlist[]> {
    const response = await requestApi('/toplist', {}, { signal });
    return asArray(response.list).map(adaptPlaylist);
  },
  /** offset 为跳过的条目数而非页码，每页 30 首；缺少总数时按是否满页判断后续页。 */
  async searchSongs(keywords: string, offset = 0, signal?: AbortSignal): Promise<SongPage> {
    const response = await requestApi(
      '/cloudsearch',
      { keywords, type: 1, limit: 30, offset },
      { signal },
    );
    const result = asRecord(response.result);
    const songs = asArray(result.songs).map(adaptSong);
    const total = asNumber(result.songCount, offset + songs.length);
    return {
      songs,
      total,
      hasMore: result.songCount === undefined ? songs.length === 30 : offset + songs.length < total,
    };
  },
  /** 与歌曲搜索采用相同的条目偏移规则，每页请求 30 个歌单。 */
  async searchPlaylists(keywords: string, offset = 0, signal?: AbortSignal): Promise<PlaylistPage> {
    const response = await requestApi(
      '/cloudsearch',
      { keywords, type: 1000, limit: 30, offset },
      { signal },
    );
    const result = asRecord(response.result);
    const playlists = asArray(result.playlists).map(adaptPlaylist);
    const total = asNumber(result.playlistCount, offset + playlists.length);
    return {
      playlists,
      total,
      hasMore:
        result.playlistCount === undefined
          ? playlists.length === 30
          : offset + playlists.length < total,
    };
  },
  async getHotSearches(signal?: AbortSignal): Promise<string[]> {
    const response = await requestApi('/search/hot/detail', {}, { signal });
    return asArray(response.data)
      .map((item) => asString(asRecord(item).searchWord))
      .filter(Boolean);
  },
  async getSuggestions(keywords: string, signal?: AbortSignal): Promise<string[]> {
    const response = await requestApi('/search/suggest', { keywords, type: 'mobile' }, { signal });
    return asArray(asRecord(response.result).allMatch)
      .map((item) => asString(asRecord(item).keyword))
      .filter(Boolean);
  },
  /** 返回歌单元信息；完整歌曲列表需通过 getPlaylistSongs 分页获取。 */
  async getPlaylist(id: number, signal?: AbortSignal): Promise<Playlist> {
    const response = await requestApi('/playlist/detail', { id }, { signal });
    const playlist = adaptPlaylist(response.playlist);
    if (!playlist.id) throw new ApiError('歌单不存在或当前账号无权访问', 404);
    return playlist;
  },
  /** 上游路径虽含 all，仍只请求每页 50 首；offset 是条目偏移量，不能当成页码。 */
  async getPlaylistSongs(id: number, offset = 0, signal?: AbortSignal): Promise<SongPage> {
    const response = await requestApi('/playlist/track/all', { id, offset, limit: 50 }, { signal });
    const songs = asArray(response.songs).map(adaptSong);
    const total = asNumber(response.total, offset + songs.length);
    return {
      songs,
      total,
      hasMore: response.total === undefined ? songs.length === 50 : offset + songs.length < total,
    };
  },
  async getDailySongs(signal?: AbortSignal): Promise<Song[]> {
    const response = await requestApi('/recommend/songs', {}, { signal, authenticated: true });
    return asArray(asRecord(response.data).dailySongs ?? response.recommend).map(adaptSong);
  },
  async getSongDetails(ids: number[], signal?: AbortSignal): Promise<Song[]> {
    if (!ids.length) return [];
    const response = await requestApi('/song/detail', { ids: ids.join(',') }, { signal });
    return asArray(response.songs).map(adaptSong);
  },
  async getSongSource(id: number, signal?: AbortSignal): Promise<SongSource> {
    const response = await requestApi('/song/url/v1', { id, level: 'standard' }, { signal });
    const data = asRecord(asArray(response.data)[0]);
    return {
      url: asString(data.url) || null,
      isTrial: Boolean(data.freeTrialInfo),
      // expi 按秒计，扣除 15 秒缓冲后转换为刷新时刻；间隔至少 30 秒，缺失时按 300 秒估算。
      expiresAt: Date.now() + Math.max(30, asNumber(data.expi, 300) - 15) * 1000,
      message: data.url ? undefined : '这首歌暂时没有可播放音源，可能受版权、会员或付费限制',
    };
  },
  /** 返回尚未解析的 LRC 原文，歌词时间轴由 lyricParser 统一处理。 */
  async getLyrics(id: number, signal?: AbortSignal): Promise<string> {
    const response = await requestApi('/lyric', { id }, { signal });
    return asString(asRecord(response.lrc).lyric);
  },
  /** 一次请求最多 1000 个用户歌单，包含创建与收藏两类，目前不继续分页。 */
  async getUserPlaylists(uid: number, signal?: AbortSignal): Promise<Playlist[]> {
    const response = await requestApi(
      '/user/playlist',
      { uid, limit: 1000 },
      { signal, authenticated: true },
    );
    return asArray(response.playlist).map(adaptPlaylist);
  },
  async getLikedIds(uid: number, signal?: AbortSignal): Promise<number[]> {
    const response = await requestApi('/likelist', { uid }, { signal, authenticated: true });
    return asArray(response.ids)
      .map((value) => asNumber(value))
      .filter((id) => id > 0);
  },
  async likeSong(id: number, liked: boolean, signal?: AbortSignal): Promise<void> {
    await requestApi('/like', { id, like: liked }, { signal, authenticated: true });
  },
  /** subscribed 为目标收藏状态，上游 t=1 表示收藏，t=2 表示取消收藏。 */
  async subscribePlaylist(id: number, subscribed: boolean, signal?: AbortSignal): Promise<void> {
    await requestApi(
      '/playlist/subscribe',
      { id, t: subscribed ? 1 : 2 },
      { signal, authenticated: true },
    );
  },
  // 短信发送和验证码登录均固定使用中国大陆区号 86，不携带已有账号的 Cookie。
  async sendCaptcha(phone: string, signal?: AbortSignal): Promise<void> {
    await requestApi('/captcha/sent', { phone, ctcode: 86 }, { signal, cookie: null });
  },
  async loginWithCaptcha(
    phone: string,
    captcha: string,
    signal?: AbortSignal,
  ): Promise<{ cookie: string; profile: UserProfile }> {
    const response = await requestApi(
      '/login/cellphone',
      { phone, captcha, countrycode: 86 },
      { signal, cookie: null },
    );
    const cookie = asString(response.cookie);
    const profile = adaptProfile(response.profile);
    if (!cookie || !profile)
      throw new ApiError('服务未返回有效的登录凭证或用户资料，请检查服务版本', 0);
    return { cookie, profile };
  },
  async getLoginStatus(signal?: AbortSignal): Promise<UserProfile | null> {
    const response = await requestApi('/login/status', {}, { signal });
    return adaptProfile(asRecord(response.data).profile ?? response.profile);
  },
  /** 显式校验指定 Cookie，可在新凭据尚未写入账号状态时验证资料；无用户资料返回 null。 */
  async getLoginStatusForCookie(cookie: string, signal?: AbortSignal): Promise<UserProfile | null> {
    const response = await requestApi('/login/status', {}, { signal, cookie });
    return adaptProfile(asRecord(response.data).profile ?? response.profile);
  },
  /** 获取游客凭据；anonimous 是上游接口的实际拼写，不应改成 anonymous。 */
  async getGuestCookie(signal?: AbortSignal): Promise<string | null> {
    const response = await requestApi('/register/anonimous', {}, { signal, cookie: null });
    return asString(response.cookie) || null;
  },
  async getQrKey(signal?: AbortSignal): Promise<string> {
    const response = await requestApi('/login/qr/key', {}, { signal, cookie: null });
    const key = asString(asRecord(response.data).unikey);
    if (!key) throw new ApiError('无法生成登录二维码，请检查服务版本', 0);
    return key;
  },
  async createQr(key: string, signal?: AbortSignal): Promise<{ image: string; url: string }> {
    const response = await requestApi(
      '/login/qr/create',
      { key, qrimg: true },
      { signal, cookie: null },
    );
    const data = asRecord(response.data);
    const image = asString(data.qrimg);
    if (!image) throw new ApiError('服务未返回二维码图片，请稍后重试', 0);
    return { image, url: asString(data.qrurl) };
  },
  // 800 为过期，801 为等待扫码，802 为等待确认，803 为成功，都属于正常轮询状态。
  async checkQr(
    key: string,
    signal?: AbortSignal,
  ): Promise<{ code: number; cookie?: string; message?: string }> {
    const response = await requestApi(
      '/login/qr/check',
      { key, noCookie: true },
      { signal, cookie: null, acceptedCodes: [800, 801, 802, 803] },
    );
    return { code: asNumber(response.code), cookie: asString(response.cookie) || undefined };
  },
  async logout(signal?: AbortSignal): Promise<void> {
    await requestApi('/logout', {}, { signal });
  },
};
