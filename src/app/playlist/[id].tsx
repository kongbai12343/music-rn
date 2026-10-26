import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { MusicCover } from '@/components/MusicCover';
import { PageHeader } from '@/components/PageHeader';
import { SongRow } from '@/components/SongRow';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { useAccountStore } from '@/account/accountStore';
import { usePlaybackStore } from '@/player/playbackStore';
import { queryClient } from '@/config/queryClient';
import { neteaseApi } from '@/api/neteaseApi';
import type { Song } from '@/api/musicTypes';
import { colors } from '@/styles/theme';
import { formatPlayCount, getErrorMessage } from '@/utils/formatters';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = Number(id);
  // 路由参数属于外部输入，仅允许正安全整数，非法地址不发起接口请求。
  const validId = Number.isSafeInteger(playlistId) && playlistId > 0;
  const profile = useAccountStore((state) => state.profile);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const queueRequest = useRef<AbortController | null>(null);
  useEffect(() => () => queueRequest.current?.abort(), [playlistId]);
  // 歌单收藏状态取决于当前账号，详情和歌曲缓存都需要按账号隔离。
  const detail = useQuery({
    queryKey: ['account', profile?.id ?? 'guest', 'playlist', playlistId],
    queryFn: ({ signal }) => neteaseApi.getPlaylist(playlistId, signal),
    enabled: validId && apiConfig.isApiConfigured,
  });
  const songsQuery = useInfiniteQuery({
    queryKey: ['account', profile?.id ?? 'guest', 'playlist-songs', playlistId],
    queryFn: ({ pageParam, signal }) => neteaseApi.getPlaylistSongs(playlistId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.reduce((total, page) => total + page.songs.length, 0) : undefined,
    enabled: validId && apiConfig.isApiConfigured,
  });
  const playlist = detail.data;
  const songs = songsQuery.data?.pages.flatMap((page) => page.songs) ?? [];
  const subscribe = useMutation({
    mutationFn: () => neteaseApi.subscribePlaylist(playlistId, !playlist?.subscribed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['account', profile?.id ?? 'guest'] });
    },
    onError: (error) => Alert.alert('收藏失败', getErrorMessage(error)),
  });

  function playSongs(queue: Song[], index = 0) {
    usePlaybackStore.getState().playSongs(queue, index);
    router.push('/player');
  }

  async function playAll() {
    if (!songs.length || loadingQueue) return;
    if (!songsQuery.hasNextPage) {
      playSongs(songs);
      return;
    }
    queueRequest.current?.abort();
    const abortController = new AbortController();
    queueRequest.current = abortController;
    setLoadingQueue(true);
    try {
      // “播放全部”要补齐列表尚未加载的歌曲；最多请求 200 页，避免异常分页无限循环。
      const queue = [...songs];
      let hasMore = true;
      for (let pageNumber = 0; hasMore && pageNumber < 200; pageNumber++) {
        const page = await neteaseApi.getPlaylistSongs(
          playlistId,
          queue.length,
          abortController.signal,
        );
        if (abortController.signal.aborted) return;
        const existingIds = new Set(queue.map((song) => song.id));
        const additionalSongs = page.songs.filter((song) => !existingIds.has(song.id));
        // 服务声称还有下一页却只返回旧歌曲时停止，不能继续反复请求同一个偏移量。
        if (!additionalSongs.length && page.hasMore)
          throw new Error('服务返回了重复的歌曲分页，请检查 API 版本后重试');
        queue.push(...additionalSongs);
        hasMore = page.hasMore;
      }
      if (hasMore) throw new Error('歌单超出本次队列加载上限，请先播放已加载歌曲');
      playSongs(queue);
    } catch (error) {
      if (!abortController.signal.aborted) Alert.alert('歌单加载失败', getErrorMessage(error));
    } finally {
      if (!abortController.signal.aborted) setLoadingQueue(false);
    }
  }

  function toggleSubscribe() {
    if (!apiConfig.isApiConfigured) {
      router.push('/settings');
      return;
    }
    if (!profile) {
      router.push('/login');
      return;
    }
    subscribe.mutate();
  }

  if (!validId)
    return (
      <SafeAreaView style={styles.screen}>
        <PageHeader title="歌单" />
        <PageStateView title="歌单地址无效" />
      </SafeAreaView>
    );
  if (!apiConfig.isApiConfigured)
    return (
      <SafeAreaView style={styles.screen}>
        <PageHeader title="歌单" />
        <ApiConfigurationNotice />
        <PageStateView title="配置 API 后获取歌单内容" />
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: '#526359' }]}>
      <PageHeader title="歌单" light />
      <FlatList
        data={songs}
        keyExtractor={(song) => String(song.id)}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={() => {
          if (songsQuery.hasNextPage && !songsQuery.isFetchingNextPage)
            void songsQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => (
          <View style={styles.songBackground}>
            <SongRow song={item} index={index} onPress={() => playSongs(songs, index)} />
          </View>
        )}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['#526359', '#344440']} style={styles.hero}>
              {playlist ? (
                <>
                  <View style={styles.heroTop}>
                    <View>
                      <MusicCover uri={playlist.coverUrl} size={128} radius={9} />
                      <View style={styles.playCount}>
                        <Ionicons name="play-outline" size={10} color="white" />
                        <Text style={styles.playCountText}>
                          {formatPlayCount(playlist.playCount)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.heroCopy}>
                      <Text numberOfLines={3} style={styles.name}>
                        {playlist.name}
                      </Text>
                      <Text style={styles.creator}>{playlist.creator ?? '网易云音乐'}</Text>
                      <Text numberOfLines={2} style={styles.description}>
                        {playlist.description || '戴上耳机，一起听见生活的美好'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={toggleSubscribe}
                    disabled={subscribe.isPending}
                    style={styles.subscribe}
                  >
                    <Ionicons
                      name={playlist.subscribed ? 'checkmark' : 'add'}
                      size={18}
                      color="white"
                    />
                    <Text style={styles.subscribeText}>
                      {subscribe.isPending
                        ? '正在同步…'
                        : playlist.subscribed
                          ? '已收藏'
                          : '收藏歌单'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <PageStateView
                  loading={detail.isPending && apiConfig.isApiConfigured}
                  title="歌单信息加载失败"
                  message={detail.error ? getErrorMessage(detail.error) : undefined}
                  onRetry={detail.isError ? () => void detail.refetch() : undefined}
                />
              )}
            </LinearGradient>
            <View style={styles.playAllRow}>
              <Pressable
                style={styles.playAll}
                onPress={() => void playAll()}
                disabled={!songs.length || loadingQueue}
              >
                <Ionicons name="play-circle" size={26} color={colors.text} />
                <Text style={styles.playAllText}>
                  {loadingQueue ? '正在加载完整歌单…' : '播放全部'}{' '}
                  <Text style={styles.total}>({playlist?.trackCount ?? songs.length})</Text>
                </Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.songBackground}>
            <PageStateView
              loading={songsQuery.isPending}
              title="暂时没有可显示的歌曲"
              message={songsQuery.error ? getErrorMessage(songsQuery.error) : undefined}
              onRetry={songsQuery.isError ? () => void songsQuery.refetch() : undefined}
            />
          </View>
        }
        ListFooterComponent={
          songsQuery.isFetchingNextPage ? (
            <View style={styles.songBackground}>
              <PageStateView loading />
            </View>
          ) : songsQuery.isFetchNextPageError ? (
            <View style={styles.songBackground}>
              <PageStateView title="下一页加载失败" onRetry={() => void songsQuery.fetchNextPage()} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { backgroundColor: colors.white },
  hero: { padding: 20, paddingBottom: 28 },
  heroTop: { flexDirection: 'row', gap: 18 },
  heroCopy: { flex: 1, gap: 12, paddingTop: 3 },
  name: { color: 'white', fontSize: 18, lineHeight: 26, fontWeight: '600' },
  creator: { color: '#FFFFFFB0', fontSize: 11 },
  description: { color: '#FFFFFF70', fontSize: 10, lineHeight: 17 },
  playCount: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  playCountText: { color: 'white', fontSize: 9 },
  subscribe: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 24,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 10,
    marginTop: 24,
  },
  subscribeText: { color: 'white', fontSize: 13 },
  playAllRow: {
    backgroundColor: 'white',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: -16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  playAll: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playAllText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  total: { fontSize: 12, fontWeight: '400', color: colors.secondary },
  songBackground: { backgroundColor: 'white' },
});
