/** 客户端统一的数据模型，不直接暴露上游各接口的原始字段结构。 */
export interface Song {
  id: number;
  title: string;
  artists: string;
  album: string;
  artwork: string;
  /** 时长单位为秒，响应适配层负责将上游毫秒值转换为秒。 */
  duration: number;
  /** 上游付费标记仅用于界面提示，是否可播放仍以音源接口返回为准。 */
  fee?: number;
}

export interface Playlist {
  id: number;
  name: string;
  coverUrl: string;
  playCount: number;
  trackCount: number;
  creator?: string;
  description?: string;
  subscribed?: boolean;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  targetId?: number;
  /** 上游跳转类型；当前首页仅处理 1（歌曲）和 1000（歌单），其他类型不启用跳转。 */
  targetType?: number;
}

export interface UserProfile {
  id: number;
  nickname: string;
  avatarUrl: string;
}

export interface SongPage {
  songs: Song[];
  /** 上游缺少总数时按已加载数量估算，继续翻页应以 hasMore 为准。 */
  total: number;
  hasMore: boolean;
}

export interface PlaylistPage {
  playlists: Playlist[];
  /** 上游缺少总数时按已加载数量估算，继续翻页应以 hasMore 为准。 */
  total: number;
  hasMore: boolean;
}

export interface SongSource {
  /** 空地址表示当前没有可用音源，不使用本地音频或其他来源绕过限制。 */
  url: string | null;
  /** 表示上游只提供试听片段，不应将拿到地址等同于拥有完整歌曲播放权限。 */
  isTrial: boolean;
  /** 客户端计算的音源刷新时刻，使用 Unix 毫秒时间戳，与 Date.now() 比较。 */
  expiresAt: number;
  message?: string;
}
