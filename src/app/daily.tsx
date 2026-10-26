import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { PageHeader } from '@/components/PageHeader';
import { SongRow } from '@/components/SongRow';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { useAccountStore } from '@/account/accountStore';
import { usePlaybackStore } from '@/player/playbackStore';
import { neteaseApi } from '@/api/neteaseApi';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

export default function DailyScreen() {
  const profile = useAccountStore((state) => state.profile);
  // 每日推荐依赖用户身份，游客 Cookie 不足以启用查询；缓存必须按账号隔离。
  const dailyQuery = useQuery({
    queryKey: ['account', profile?.id, 'daily'],
    queryFn: ({ signal }) => neteaseApi.getDailySongs(signal),
    enabled: apiConfig.isApiConfigured && Boolean(profile),
  });
  const songs = dailyQuery.data ?? [];
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <PageHeader title="每日推荐" />
      <ApiConfigurationNotice />
      <FlatList
        data={songs}
        keyExtractor={(song) => String(song.id)}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['#D28773', '#825E60']} style={styles.hero}>
              <Text style={styles.date}>
                {new Date().getDate()}
                <Text style={styles.month}> / {new Date().getMonth() + 1}</Text>
              </Text>
              <Text style={styles.heroCopy}>根据你的音乐口味，每天为你更新</Text>
            </LinearGradient>
            <Pressable
              style={styles.playAll}
              onPress={() => {
                if (songs.length) {
                  usePlaybackStore.getState().playSongs(songs);
                  router.push('/player');
                }
              }}
              disabled={!songs.length}
            >
              <Ionicons name="play-circle" size={27} color={colors.text} />
              <Text style={styles.playAllText}>播放全部</Text>
            </Pressable>
          </>
        }
        renderItem={({ item, index }) => (
          <SongRow
            song={item}
            showArtwork
            onPress={() => {
              usePlaybackStore.getState().playSongs(songs, index);
              router.push('/player');
            }}
          />
        )}
        ListEmptyComponent={
          !apiConfig.isApiConfigured ? (
            <PageStateView title="配置 API 并登录后获取每日推荐" />
          ) : !profile ? (
            <View>
              <PageStateView title="登录后，遇见更懂你的音乐" />
              <Pressable style={styles.login} onPress={() => router.push('/login')}>
                <Text style={styles.loginText}>去登录</Text>
              </Pressable>
            </View>
          ) : (
            <PageStateView
              loading={dailyQuery.isPending}
              title="推荐暂时不可用"
              message={dailyQuery.error ? getErrorMessage(dailyQuery.error) : undefined}
              onRetry={dailyQuery.isError ? () => void dailyQuery.refetch() : undefined}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  hero: { paddingHorizontal: 24, paddingVertical: 38 },
  date: { fontSize: 62, color: 'white', fontWeight: '600' },
  month: { fontSize: 24, fontWeight: '400' },
  heroCopy: { color: '#FFFFFFB5', fontSize: 11, marginTop: 12 },
  playAll: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 10 },
  playAllText: { fontSize: 16, color: colors.text, fontWeight: '600' },
  login: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  loginText: { color: 'white', fontSize: 14 },
});
