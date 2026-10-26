import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/PageHeader';
import { SongRow } from '@/components/SongRow';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { useAccountStore } from '@/account/accountStore';
import { useLikedSongs } from '@/account/accountQueries';
import { useHistoryStore } from '@/history/historyStore';
import { usePlaybackStore } from '@/player/playbackStore';
import { neteaseApi } from '@/api/neteaseApi';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

/** type=recent 显示设备本地记录，不要求登录；其他值进入当前账号的喜欢列表。 */
export default function CollectionScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const isRecent = type === 'recent';
  const recentSongs = useHistoryStore((state) => state.recentSongs);
  const profile = useAccountStore((state) => state.profile);
  const likedIds = useLikedSongs();
  // 喜欢列表只返回歌曲 ID，详情按每批 50 个补全；ID 列表变化时使用新的详情缓存键。
  const songDetails = useInfiniteQuery({
    queryKey: ['account', profile?.id, 'liked-details', likedIds.data],
    queryFn: ({ pageParam, signal }) =>
      neteaseApi.getSongDetails(likedIds.data?.slice(pageParam, pageParam + 50) ?? [], signal),
    initialPageParam: 0,
    getNextPageParam: (_, pages) =>
      pages.length * 50 < (likedIds.data?.length ?? 0) ? pages.length * 50 : undefined,
    enabled: !isRecent && Boolean(profile && likedIds.data?.length) && apiConfig.isApiConfigured,
  });
  const songs = isRecent ? recentSongs : (songDetails.data?.pages.flat() ?? []);
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <PageHeader title={isRecent ? '最近播放' : '我喜欢的音乐'} />
      {!isRecent && !profile ? (
        <>
          <PageStateView
            title="登录后同步你喜欢的音乐"
            message={
              !apiConfig.isApiConfigured ? '请先配置 NeteaseCloudMusicApi 地址' : undefined
            }
          />
          <Pressable style={styles.login} onPress={() => router.push('/login')}>
            <Text style={styles.loginText}>去登录</Text>
          </Pressable>
        </>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(song) => String(song.id)}
          renderItem={({ item, index }) => (
            <SongRow
              song={item}
              index={index}
              showArtwork
              onPress={() => {
                usePlaybackStore.getState().playSongs(songs, index);
                router.push('/player');
              }}
            />
          )}
          onEndReached={() => {
            if (!isRecent && songDetails.hasNextPage && !songDetails.isFetchingNextPage)
              void songDetails.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <PageStateView
              loading={!isRecent && (likedIds.isFetching || songDetails.isFetching)}
              title={isRecent ? '还没有播放记录' : '还没有喜欢的音乐'}
              message={
                likedIds.error || songDetails.error
                  ? getErrorMessage(likedIds.error ?? songDetails.error)
                  : '听一首喜欢的歌，留住此刻的心情'
              }
              onRetry={
                likedIds.isError
                  ? () => void likedIds.refetch()
                  : songDetails.isError
                    ? () => void songDetails.refetch()
                    : undefined
              }
            />
          }
          ListFooterComponent={
            songDetails.isFetchingNextPage && !isRecent ? <PageStateView loading /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  login: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  loginText: { color: 'white', fontSize: 14 },
});
