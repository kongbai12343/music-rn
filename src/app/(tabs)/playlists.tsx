import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { PlaylistCard } from '@/components/PlaylistCard';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { neteaseApi } from '@/api/neteaseApi';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

export default function PlaylistsScreen() {
  const { width } = useWindowDimensions();
  // 与发现页使用相同查询键，复用推荐数据和刷新结果，而非创建互不关联的缓存。
  const playlistsQuery = useQuery({
    queryKey: ['public', 'recommended'],
    queryFn: ({ signal }) => neteaseApi.getRecommendedPlaylists(signal),
    enabled: apiConfig.isApiConfigured,
  });
  const playlists = playlistsQuery.data ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>歌单广场</Text>
          <Text style={styles.subtitle}>总有一首歌，刚好懂你</Text>
        </View>
        <Pressable
          onPress={() => router.push('/search')}
          accessibilityLabel="搜索歌单"
          style={styles.search}
        >
          <Ionicons name="search-outline" size={25} color={colors.text} />
        </Pressable>
      </View>
      <ApiConfigurationNotice />
      {!apiConfig.isApiConfigured ? (
        <PageStateView title="配置 API 后获取推荐歌单" />
      ) : playlistsQuery.isPending ? (
        <PageStateView loading />
      ) : playlistsQuery.isError ? (
        <PageStateView
          title="暂时无法获取歌单"
          message={getErrorMessage(playlistsQuery.error)}
          onRetry={() => void playlistsQuery.refetch()}
        />
      ) : (
        <FlatList
          data={playlists}
          numColumns={3}
          columnWrapperStyle={styles.columns}
          contentContainerStyle={styles.grid}
          keyExtractor={(playlist) => String(playlist.id)}
          renderItem={({ item: playlist }) => (
            <PlaylistCard playlist={playlist} width={(width - 64) / 3} />
          )}
          ListEmptyComponent={<PageStateView title="暂时没有推荐歌单" />}
          onRefresh={apiConfig.isApiConfigured ? () => void playlistsQuery.refetch() : undefined}
          refreshing={playlistsQuery.isRefetching}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 11, color: colors.secondary, marginTop: 8 },
  search: { padding: 8 },
  columns: { gap: 12, marginBottom: 20 },
  grid: { paddingHorizontal: 20, paddingBottom: 28 },
});
