import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { PageHeader } from '@/components/PageHeader';
import { PlaylistCard } from '@/components/PlaylistCard';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { neteaseApi } from '@/api/neteaseApi';
import { getErrorMessage } from '@/utils/formatters';

export default function RankingsScreen() {
  const { width } = useWindowDimensions();
  // 与发现页共用完整榜单缓存；首页只截取前几个展示，本页展示整个返回列表。
  const rankings = useQuery({
    queryKey: ['public', 'toplists'],
    queryFn: ({ signal }) => neteaseApi.getToplists(signal),
    enabled: apiConfig.isApiConfigured,
  });
  const playlists = rankings.data ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <PageHeader title="排行榜" />
      <ApiConfigurationNotice />
      {!apiConfig.isApiConfigured ? (
        <PageStateView title="配置 API 后获取排行榜" />
      ) : rankings.isError ? (
        <PageStateView
          title="排行榜加载失败"
          message={getErrorMessage(rankings.error)}
          onRetry={() => void rankings.refetch()}
        />
      ) : apiConfig.isApiConfigured && rankings.isPending ? (
        <PageStateView loading />
      ) : (
        <FlatList
          data={playlists}
          numColumns={3}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.columns}
          keyExtractor={(playlist) => String(playlist.id)}
          renderItem={({ item }) => <PlaylistCard playlist={item} width={(width - 64) / 3} />}
          ListEmptyComponent={<PageStateView title="暂时没有排行榜" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  list: { paddingHorizontal: 20, paddingVertical: 12 },
  columns: { justifyContent: 'space-between', marginBottom: 20 },
});
