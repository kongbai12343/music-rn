import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MusicCover } from './MusicCover';
import type { Playlist } from '@/api/musicTypes';
import { formatPlayCount } from '@/utils/formatters';

/** 歌单卡片的 width 同时决定卡片宽度与方形封面尺寸；点击进入详情，并不直接播放。 */
export function PlaylistCard({ playlist, width = 116 }: { playlist: Playlist; width?: number }) {
  return (
    <Pressable
      style={{ width }}
      onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
      accessibilityRole="button"
      accessibilityLabel={`歌单：${playlist.name}`}
    >
      <MusicCover uri={playlist.coverUrl} size={width} radius={8} />
      <View style={styles.count}>
        <Ionicons name="play-outline" size={11} color="white" />
        <Text style={styles.countText}>{formatPlayCount(playlist.playCount)}</Text>
      </View>
      <View style={styles.play}>
        <Ionicons name="play" size={13} color="white" />
      </View>
      <Text numberOfLines={2} style={styles.name}>
        {playlist.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  count: {
    position: 'absolute',
    right: 6,
    top: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  countText: { color: 'white', fontSize: 10, textShadowColor: '#333', textShadowRadius: 4 },
  play: {
    position: 'absolute',
    right: 8,
    bottom: 50,
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF30',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  name: { fontSize: 12, color: '#333333', lineHeight: 18, height: 42, marginTop: 8 },
});
