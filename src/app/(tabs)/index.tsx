import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { MusicCover } from '@/components/MusicCover';
import { PlaylistCard } from '@/components/PlaylistCard';
import { SectionHeader } from '@/components/SectionHeader';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { usePlaybackStore } from '@/player/playbackStore';
import { neteaseApi } from '@/api/neteaseApi';
import type { Banner } from '@/api/musicTypes';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

const shortcuts = [
  { title: '每日推荐', icon: 'calendar-outline', path: '/daily' },
  { title: '歌单', icon: 'musical-notes-outline', path: '/(tabs)/playlists' },
  { title: '排行榜', icon: 'podium-outline', path: '/rankings' },
  { title: '最近播放', icon: 'time-outline', path: '/collection?type=recent' },
] as const;

export default function DiscoveryScreen() {
  const { width } = useWindowDimensions();
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannersQuery = useQuery({
    queryKey: ['public', 'banners'],
    queryFn: ({ signal }) => neteaseApi.getBanners(signal),
    enabled: apiConfig.isApiConfigured,
  });
  const playlistsQuery = useQuery({
    queryKey: ['public', 'recommended'],
    queryFn: ({ signal }) => neteaseApi.getRecommendedPlaylists(signal),
    enabled: apiConfig.isApiConfigured,
  });
  const rankingsQuery = useQuery({
    queryKey: ['public', 'toplists'],
    queryFn: ({ signal }) => neteaseApi.getToplists(signal),
    enabled: apiConfig.isApiConfigured,
  });
  const playlists = playlistsQuery.data ?? [];
  const rankings = rankingsQuery.data?.slice(0, 3) ?? [];
  const bannerWidth = Math.max(200, width - 40);
  const cardWidth = Math.max(100, Math.min(144, (width - 64) / 3));

  /** 仅处理歌曲和歌单目标；不打开上游活动外链，也不为其他跳转类型伪造页面。 */
  async function openBanner(banner: Banner) {
    try {
      if (banner.targetType === 1000 && banner.targetId)
        router.push({ pathname: '/playlist/[id]', params: { id: banner.targetId } });
      if (banner.targetType === 1 && banner.targetId) {
        const songs = await neteaseApi.getSongDetails([banner.targetId]);
        if (songs.length) {
          usePlaybackStore.getState().playSongs(songs);
          router.push('/player');
        }
      }
    } catch (error) {
      Alert.alert('暂时无法打开', getErrorMessage(error));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.search}
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel="搜索音乐"
        >
          <Ionicons name="search" size={18} color="#A6A6A6" />
          <Text style={styles.placeholder}>搜索歌曲、歌单，发现你的心动音乐</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.settings}
          accessibilityLabel="打开设置"
        >
          <Ionicons name="options-outline" size={25} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={playlistsQuery.isRefetching || bannersQuery.isRefetching}
            onRefresh={() => {
              if (apiConfig.isApiConfigured) {
                void playlistsQuery.refetch();
                void bannersQuery.refetch();
                void rankingsQuery.refetch();
              }
            }}
          />
        }
      >
        <View style={styles.bannerContainer}>
          {!apiConfig.isApiConfigured ? null : bannersQuery.isPending ? (
            <View style={styles.bannerLoading}>
              <PageStateView loading />
            </View>
          ) : bannersQuery.isError ? (
            <PageStateView
              title="Banner 加载失败"
              message={getErrorMessage(bannersQuery.error)}
              onRetry={() => void bannersQuery.refetch()}
            />
          ) : (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) =>
                  setBannerIndex(Math.round(event.nativeEvent.contentOffset.x / bannerWidth))
                }
                style={{ width: bannerWidth }}
              >
                {bannersQuery.data?.map((banner) => (
                  <Pressable
                    key={banner.id}
                    onPress={() => void openBanner(banner)}
                    disabled={!banner.targetId || ![1, 1000].includes(banner.targetType ?? 0)}
                    style={[styles.banner, { width: bannerWidth }]}
                  >
                    <Image
                      source={banner.imageUrl}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    <View style={styles.bannerTag}>
                      <Text style={styles.bannerTagText}>{banner.title}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.dots}>
                {bannersQuery.data?.map((banner, index) => (
                  <View
                    key={banner.id}
                    style={[styles.dot, index === bannerIndex && styles.activeDot]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
        <View style={styles.shortcuts}>
          {shortcuts.map((shortcut) => (
            <Pressable
              key={shortcut.title}
              style={styles.shortcut}
              onPress={() => router.push(shortcut.path)}
              accessibilityRole="button"
            >
              <LinearGradient colors={['#FF6563', '#E73734']} style={styles.shortcutIcon}>
                <Ionicons name={shortcut.icon} size={25} color="white" />
                {shortcut.title === '每日推荐' ? (
                  <Text style={styles.date}>{new Date().getDate()}</Text>
                ) : null}
              </LinearGradient>
              <Text style={styles.shortcutText}>{shortcut.title}</Text>
            </Pressable>
          ))}
        </View>
        <ApiConfigurationNotice />
        <View style={styles.section}>
          <SectionHeader
            title="推荐歌单"
            action="歌单广场"
            onPress={() => router.push('/(tabs)/playlists')}
          />
          {!apiConfig.isApiConfigured ? (
            <PageStateView title="配置 API 后获取推荐歌单" />
          ) : playlistsQuery.isPending ? (
            <PageStateView loading />
          ) : playlistsQuery.isError ? (
            <PageStateView
              title="歌单加载失败"
              message={getErrorMessage(playlistsQuery.error)}
              onRetry={() => void playlistsQuery.refetch()}
            />
          ) : !playlists.length ? (
            <PageStateView title="暂时没有推荐歌单" />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontal}
            >
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} width={cardWidth} />
              ))}
            </ScrollView>
          )}
        </View>
        <View style={styles.section}>
          <SectionHeader
            title="排行榜"
            action="查看全部"
            onPress={() => router.push('/rankings')}
          />
          {!apiConfig.isApiConfigured ? (
            <PageStateView title="配置 API 后获取排行榜" />
          ) : rankingsQuery.isPending ? (
            <PageStateView loading />
          ) : rankingsQuery.isError ? (
            <PageStateView title="排行榜加载失败" onRetry={() => void rankingsQuery.refetch()} />
          ) : !rankings.length ? (
            <PageStateView title="暂时没有排行榜" />
          ) : (
            rankings.map((playlist) => (
              <Pressable
                key={playlist.id}
                style={styles.rank}
                onPress={() =>
                  router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })
                }
              >
                <MusicCover uri={playlist.coverUrl} size={76} radius={8} />
                <View style={styles.rankCopy}>
                  <Text style={styles.rankTitle}>{playlist.name}</Text>
                  <Text style={styles.rankHint}>正在流行的音乐，都在这里</Text>
                  <Text numberOfLines={1} style={styles.rankTrack}>
                    {playlist.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" color="#B0B0B0" size={17} />
              </Pressable>
            ))
          )}
        </View>
        <Text style={styles.footer}>音乐，是生活里的另一种语言</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 14,
  },
  search: {
    flex: 1,
    height: 36,
    backgroundColor: '#F5F5F5',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 7,
  },
  placeholder: { fontSize: 11, color: '#A6A6A6', flex: 1 },
  settings: { height: 36, width: 25, justifyContent: 'center' },
  bannerContainer: { marginHorizontal: 20 },
  banner: { height: 148, borderRadius: 10, overflow: 'hidden' },
  bannerTag: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
  },
  bannerTagText: { color: 'white', fontSize: 9 },
  bannerLoading: { height: 148, backgroundColor: colors.canvas, borderRadius: 10 },
  dots: { flexDirection: 'row', gap: 4, position: 'absolute', bottom: 8, alignSelf: 'center' },
  dot: { height: 4, width: 4, borderRadius: 4, backgroundColor: '#FFFFFF75' },
  activeDot: { backgroundColor: colors.primary },
  shortcuts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 26,
    paddingVertical: 24,
  },
  shortcut: { alignItems: 'center', gap: 9 },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: { fontSize: 11, color: '#444444' },
  date: { position: 'absolute', top: 21, color: 'white', fontSize: 8 },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 22,
    paddingBottom: 18,
  },
  horizontal: { paddingHorizontal: 20, gap: 12 },
  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  rankCopy: { flex: 1, gap: 7 },
  rankTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rankHint: { fontSize: 10, color: colors.muted },
  rankTrack: { color: colors.secondary, fontSize: 11 },
  footer: {
    textAlign: 'center',
    color: '#C2C2C2',
    fontSize: 10,
    marginVertical: 24,
    letterSpacing: 2,
  },
});
