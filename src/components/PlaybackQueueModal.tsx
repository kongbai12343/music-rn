import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaybackStore } from '@/player/playbackStore';
import { colors } from '@/styles/theme';

const modeTitles = { sequential: '顺序播放', shuffle: '随机播放', 'repeat-one': '单曲循环' };

/** 直接操作全局播放队列；选择、删除和高亮都按队列索引处理，支持同一歌曲重复入队。 */
export function PlaybackQueueModal() {
  const state = usePlaybackStore();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={state.queueVisible}
      animationType="slide"
      transparent
      onRequestClose={state.closeQueue}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={state.closeQueue}
          accessibilityLabel="关闭队列"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>
              当前播放 <Text style={styles.count}>({state.queue.length})</Text>
            </Text>
            <Pressable onPress={state.closeQueue} accessibilityLabel="关闭队列" hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.secondary} />
            </Pressable>
          </View>
          <Pressable style={styles.mode} onPress={state.cycleMode} accessibilityRole="button">
            <Ionicons
              name={state.mode === 'shuffle' ? 'shuffle' : 'repeat'}
              size={20}
              color={colors.secondary}
            />
            <Text style={styles.modeText}>{modeTitles[state.mode]}</Text>
          </Pressable>
          <FlatList
            data={state.queue}
            keyExtractor={(song, index) => `${song.id}-${index}`}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>播放一首喜欢的歌，队列就会出现在这里</Text>
            }
            renderItem={({ item: song, index }) => (
              <View style={styles.row}>
                <Pressable
                  style={styles.song}
                  onPress={() => state.selectSong(index)}
                  accessibilityRole="button"
                >
                  {index === state.currentIndex ? (
                    <Ionicons name="volume-medium" size={16} color={colors.primary} />
                  ) : null}
                  <Text
                    style={[
                      styles.songText,
                      index === state.currentIndex && { color: colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {song.title}
                    <Text style={styles.artist}> - {song.artists}</Text>
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => state.removeSong(index)}
                  style={styles.remove}
                  accessibilityLabel={`从队列移除 ${song.title}`}
                >
                  <Ionicons name="close" size={19} color="#B5B5B5" />
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000065', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: 280,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 4,
    alignSelf: 'center',
    backgroundColor: '#E2E2E2',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 20,
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.text },
  count: { color: colors.secondary, fontSize: 13 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    paddingVertical: 18,
  },
  modeText: { fontSize: 12, color: colors.secondary },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  song: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  songText: { fontSize: 14, color: colors.text, flex: 1 },
  artist: { color: colors.secondary, fontSize: 11 },
  remove: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  empty: { color: colors.secondary, padding: 24, textAlign: 'center', fontSize: 12 },
});
