import { asArray, asNumber, asRecord, asString } from './apiRequest';
import type { Banner, Playlist, Song, UserProfile } from './musicTypes';

// 网易云图片地址统一使用 HTTPS，避免 HTTPS 网页加载封面时被混合内容策略拦截。
export function adaptImageUrl(value: unknown): string {
  const imageUrl = asString(value);
  return imageUrl.startsWith('http://') ? imageUrl.replace('http://', 'https://') : imageUrl;
}

export function adaptSong(value: unknown): Song {
  const record = asRecord(value);
  // 详情接口使用 al/ar/dt，部分搜索响应使用 album/artists/duration，统一为客户端模型。
  const album = asRecord(record.al ?? record.album);
  const artists = asArray(record.ar ?? record.artists)
    .map((artist) => asString(asRecord(artist).name))
    .filter(Boolean);
  return {
    id: asNumber(record.id),
    title: asString(record.name) || '未命名歌曲',
    artists: artists.join(' / ') || '未知歌手',
    album: asString(album.name),
    artwork: adaptImageUrl(album.picUrl ?? record.picUrl),
    duration: asNumber(record.dt ?? record.duration) / 1000,
    fee: asNumber(record.fee ?? asRecord(record.privilege).fee),
  };
}

/** 兼容推荐歌单与歌单详情的不同封面、播放次数字段，不包含歌曲列表。 */
export function adaptPlaylist(value: unknown): Playlist {
  const record = asRecord(value);
  const creator = asRecord(record.creator);
  return {
    id: asNumber(record.id),
    name: asString(record.name) || '未命名歌单',
    coverUrl: adaptImageUrl(record.coverImgUrl ?? record.picUrl),
    playCount: asNumber(record.playCount ?? record.playcount),
    trackCount: asNumber(record.trackCount),
    creator: asString(creator.nickname),
    description: asString(record.description),
    subscribed: Boolean(record.subscribed),
  };
}

export function adaptProfile(value: unknown): UserProfile | null {
  const record = asRecord(value);
  const userId = asNumber(record.userId);
  // 游客或无效会话可能返回空资料，不能将其转换成一个伪造的已登录用户。
  if (!userId) return null;
  return {
    id: userId,
    nickname: asString(record.nickname),
    avatarUrl: adaptImageUrl(record.avatarUrl),
  };
}

/** 缺少 bannerId 时用目标 ID 与列表索引构造展示键，不能将该键当成歌曲或歌单 ID。 */
export function adaptBanner(value: unknown, index: number): Banner {
  const record = asRecord(value);
  return {
    id: String(record.bannerId ?? `${record.targetId ?? ''}-${index}`),
    imageUrl: adaptImageUrl(record.pic ?? record.imageUrl),
    title: asString(record.typeTitle),
    targetId: asNumber(record.targetId),
    targetType: asNumber(record.targetType),
  };
}
