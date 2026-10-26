import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MusicCover } from './MusicCover';
import { usePlayback } from '@/player/AudioPlayerProvider';
import { usePlaybackStore } from '@/player/playbackStore';
import { colors } from '@/styles/theme';

/** 订阅全局播放器的底部控制栏，不创建新的音频实例；没有当前歌曲时不显示。 */
export function MiniPlayer() {
  const playback = usePlayback();
  const openQueue = usePlaybackStore((state) => state.openQueue);
  if (!playback.song) return null;
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.progress,
          {
            width: `${Math.min(100, playback.duration ? (playback.position / playback.duration) * 100 : 0)}%`,
          },
        ]}
      />
      <Pressable
        style={styles.song}
        onPress={() => router.push('/player')}
        accessibilityRole="button"
        accessibilityLabel="打开完整播放器"
      >
        <MusicCover uri={playback.song.artwork} size={38} radius={30} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {playback.song.title}
            <Text style={styles.artist}> - {playback.song.artists}</Text>
          </Text>
          <Text numberOfLines={1} style={styles.hint}>
            {playback.error
              ? '播放失败，点击重试'
              : playback.isTrial
                ? '试听片段'
                : '横跨每个页面，音乐都在这里'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={styles.control}
        onPress={() => void playback.toggle()}
        accessibilityRole="button"
        accessibilityLabel={playback.playing ? '暂停' : '播放'}
      >
        {playback.loading ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Ionicons
            name={playback.playing ? 'pause-circle-outline' : 'play-circle-outline'}
            size={31}
            color={colors.text}
          />
        )}
      </Pressable>
      <Pressable
        style={styles.control}
        onPress={openQueue}
        accessibilityRole="button"
        accessibilityLabel="打开播放队列"
      >
        <Ionicons name="list-outline" size={28} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  progress: { position: 'absolute', height: 1, left: 0, top: 0, backgroundColor: colors.primary },
  song: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  copy: { flex: 1, gap: 5 },
  title: { fontSize: 12, color: colors.text },
  artist: { color: colors.secondary, fontSize: 11 },
  hint: { color: colors.muted, fontSize: 10 },
  control: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
});
