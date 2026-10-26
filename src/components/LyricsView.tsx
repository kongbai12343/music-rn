import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PageStateView } from './PageStateView';
import { usePlayback } from '@/player/AudioPlayerProvider';
import { findActiveLyricIndex, parseLyrics } from '@/player/lyricParser';
import { neteaseApi } from '@/api/neteaseApi';

/** 按共享播放器的真实进度高亮并滚动歌词，点击某行时跳转到该行的开始时间。 */
export function LyricsView() {
  const playback = usePlayback();
  const lyricsQuery = useQuery({
    queryKey: ['public', 'lyrics', playback.song?.id],
    queryFn: ({ signal }) => neteaseApi.getLyrics(playback.song!.id, signal),
    enabled: Boolean(playback.song),
  });
  const source = lyricsQuery.data ?? '';
  // 原生播放进度频繁更新，歌词只在原文变化时重新解析，不随每次进度更新重复解析。
  const lines = useMemo(() => parseLyrics(source), [source]);
  const activeIndex = findActiveLyricIndex(lines, playback.position);
  const listRef = useRef<FlatList>(null);
  useEffect(() => {
    if (activeIndex >= 0)
      listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.5, animated: true });
  }, [activeIndex]);
  if (playback.song && lyricsQuery.isPending) return <PageStateView loading />;
  if (!lines.length)
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {lyricsQuery.isError ? '歌词加载失败，点此重试' : '纯音乐，请欣赏旋律'}
        </Text>
        {lyricsQuery.isError ? (
          <Pressable onPress={() => void lyricsQuery.refetch()}>
            <Text style={styles.retry}>重新加载</Text>
          </Pressable>
        ) : null}
      </View>
    );
  // getItemLayout 的行高 58 和顶部偏移 130 须与样式一致，否则歌词定位会偏移。
  return (
    <FlatList
      ref={listRef}
      data={lines}
      keyExtractor={(line, index) => `${line.time}-${index}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      getItemLayout={(_, index) => ({ length: 58, offset: 130 + 58 * index, index })}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => void playback.seek(item.time)}
          style={styles.line}
          accessibilityRole="button"
        >
          <Text style={[styles.text, index === activeIndex && styles.active]} numberOfLines={2}>
            {item.text || '···'}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 130, paddingBottom: 160 },
  line: { height: 58, justifyContent: 'center', paddingHorizontal: 26 },
  text: { textAlign: 'center', color: '#FFFFFF65', fontSize: 16, lineHeight: 26 },
  active: { color: '#FFFFFF', fontWeight: '600', fontSize: 17 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { color: '#FFFFFF90', fontSize: 14 },
  retry: { color: 'white', fontSize: 12 },
});
