import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MusicCover } from './MusicCover';
import { usePlaybackStore } from '@/player/playbackStore';
import type { Song } from '@/api/musicTypes';
import { colors } from '@/styles/theme';

/** 展示歌曲并高亮当前曲；播放队列由父页面的 onPress 建立，本组件不自行请求音源。 */
export function SongRow({
  song,
  index,
  onPress,
  showArtwork = false,
  trailing,
}: {
  song: Song;
  /** 从 0 开始的列表索引，显示时加 1；省略时不显示序号。 */
  index?: number;
  onPress: () => void;
  showArtwork?: boolean;
  /** 自定义行尾内容，用于替换默认的播放按钮。 */
  trailing?: React.ReactNode;
}) {
  const active = usePlaybackStore((state) => state.queue[state.currentIndex]?.id === song.id);
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`播放 ${song.title}，${song.artists}`}
      >
        {showArtwork ? (
          <MusicCover uri={song.artwork} size={46} radius={6} />
        ) : (
          <View style={styles.index}>
            {active ? (
              <Ionicons name="volume-medium" size={18} color={colors.primary} />
            ) : (
              <Text style={styles.indexText}>{index !== undefined ? index + 1 : ''}</Text>
            )}
          </View>
        )}
        <View style={styles.copy}>
          <Text style={[styles.title, active && { color: colors.primary }]} numberOfLines={1}>
            {song.title}
          </Text>
          <View style={styles.subtitleRow}>
            {song.fee === 1 || song.fee === 4 ? (
              <Text style={styles.badge}>{song.fee === 1 ? 'VIP' : '付费'}</Text>
            ) : null}
            <Text style={styles.subtitle} numberOfLines={1}>
              {song.artists}
              {song.album ? ` - ${song.album}` : ''}
            </Text>
          </View>
        </View>
      </Pressable>
      {trailing ?? (
        <Pressable
          onPress={onPress}
          style={styles.trailing}
          accessibilityRole="button"
          accessibilityLabel={`播放 ${song.title}`}
        >
          <Ionicons name="play-circle-outline" size={24} color="#B3B3B3" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 68, paddingHorizontal: 20 },
  main: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 64, gap: 12 },
  index: { width: 22, alignItems: 'center' },
  indexText: { fontSize: 16, color: colors.muted },
  copy: { flex: 1, gap: 6 },
  title: { color: colors.text, fontSize: 15 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subtitle: { color: colors.secondary, fontSize: 11, flex: 1 },
  badge: {
    fontSize: 8,
    borderWidth: 0.7,
    borderColor: colors.primary,
    borderRadius: 2,
    paddingHorizontal: 2,
    color: colors.primary,
  },
  trailing: {
    marginLeft: 8,
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
