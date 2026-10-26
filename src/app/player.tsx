import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MusicCover } from '@/components/MusicCover';
import { LyricsView } from '@/components/LyricsView';
import { apiConfig } from '@/config/apiConfig';
import { useAccountStore } from '@/account/accountStore';
import { useLikedSongs, useToggleLike } from '@/account/accountQueries';
import { usePlayback } from '@/player/AudioPlayerProvider';
import { usePlaybackStore } from '@/player/playbackStore';
import { colors } from '@/styles/theme';
import { formatTime, getErrorMessage } from '@/utils/formatters';

const modeNames = { sequential: '顺序播放', shuffle: '随机播放', 'repeat-one': '单曲循环' };

/** 唱片旋转只是跟随 playing 的视觉动画，不参与音频播放或进度计算。 */
function VinylRecord({
  size,
  playing,
  artwork,
}: {
  size: number;
  playing: boolean;
  artwork: string;
}) {
  const [rotation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!playing) {
      rotation.stopAnimation();
      return;
    }
    let cancelled = false;
    function rotateFrom(position: number) {
      // 从暂停时保留的角度继续，以剩余转角计算时长，避免恢复播放后跳回起点或变速。
      Animated.timing(rotation, {
        toValue: 1,
        duration: Math.max(1, (1 - position) * 20000),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          rotation.setValue(0);
          rotateFrom(0);
        }
      });
    }
    rotation.stopAnimation((position) => rotateFrom(position));
    return () => {
      cancelled = true;
      rotation.stopAnimation();
    };
  }, [playing, rotation]);
  return (
    <Animated.View
      style={[
        styles.record,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [
            {
              rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
            },
          ],
        },
      ]}
    >
      {[0.91, 0.83, 0.74].map((scale) => (
        <View
          key={scale}
          style={[
            styles.recordGroove,
            { width: size * scale, height: size * scale, borderRadius: size },
          ]}
        />
      ))}
      <MusicCover uri={artwork} size={size * 0.64} radius={size} />
      <View style={styles.recordCenter} />
    </Animated.View>
  );
}

/** 完整播放器只展示和控制全局播放状态，切换页面不会创建新音频实例或重置队列。 */
export default function PlayerScreen() {
  const playback = usePlayback();
  const queue = usePlaybackStore();
  const profile = useAccountStore((state) => state.profile);
  const likedSongs = useLikedSongs();
  const toggleLike = useToggleLike();
  const [showLyrics, setShowLyrics] = useState(false);
  // 拖动时临时显示手指位置，松手后才跳转音频，避免播放器进度更新干扰拖动。
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const { width, height } = useWindowDimensions();
  const discSize = Math.min(310, width - 74, height * 0.4);
  const liked = Boolean(playback.song && likedSongs.data?.includes(playback.song.id));

  function likeCurrentSong() {
    if (!playback.song) return;
    if (!apiConfig.isApiConfigured) {
      router.push('/settings');
      return;
    }
    if (!profile) {
      router.push('/login');
      return;
    }
    toggleLike.mutate(
      { id: playback.song.id, liked: !liked },
      { onError: (error) => Alert.alert('操作失败', getErrorMessage(error)) },
    );
  }

  return (
    <LinearGradient colors={['#53645E', '#2B3D3C', '#172B31']} style={styles.screen}>
      <MusicCover
        uri={playback.song?.artwork}
        style={[StyleSheet.absoluteFill, { opacity: 0.13 }]}
        radius={0}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
            accessibilityLabel="收起播放器"
          >
            <Ionicons name="chevron-down" size={29} color="white" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.songTitle}>
              {playback.song?.title ?? '每一首歌，都有一个故事'}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {playback.song?.artists ?? '选择一首喜欢的音乐开始播放'}
            </Text>
          </View>
          <View style={styles.back} />
        </View>
        {!playback.song ? (
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" color="#FFFFFF65" size={72} />
            <Text style={styles.emptyText}>让音乐陪你一会</Text>
            <Pressable
              style={styles.browseButton}
              onPress={() => router.push(apiConfig.isApiConfigured ? '/search' : '/settings')}
            >
              <Text style={styles.browseText}>
                {apiConfig.isApiConfigured ? '去搜索歌曲' : '配置 API 服务'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.main}>
              {showLyrics ? (
                <LyricsView />
              ) : (
                <Pressable
                  style={styles.discContainer}
                  onPress={() => setShowLyrics(true)}
                  accessibilityRole="button"
                  accessibilityLabel="显示歌词"
                >
                  <View
                    style={[
                      styles.toneArm,
                      {
                        left: width / 2 + 6,
                        transform: [{ rotate: playback.playing ? '-24deg' : '-44deg' }],
                      },
                    ]}
                  >
                    <View style={styles.armPivot} />
                    <View style={styles.armLine} />
                    <View style={styles.armHead} />
                  </View>
                  <View
                    style={[
                      styles.recordHalo,
                      { width: discSize + 16, height: discSize + 16, borderRadius: discSize },
                    ]}
                  >
                    <VinylRecord
                      size={discSize}
                      playing={playback.playing}
                      artwork={playback.song.artwork}
                    />
                  </View>
                  <Text style={styles.discHint}>轻触唱片，查看歌词</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.utilities}>
              <Pressable
                onPress={likeCurrentSong}
                disabled={toggleLike.isPending}
                style={styles.utility}
                accessibilityLabel={liked ? '取消喜欢' : '喜欢歌曲'}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={27}
                  color={liked ? '#FF6262' : '#FFFFFFA0'}
                />
              </Pressable>
              <Pressable
                onPress={() => setShowLyrics(!showLyrics)}
                style={styles.utility}
                accessibilityLabel={showLyrics ? '显示唱片' : '显示歌词'}
              >
                <View style={[styles.lyricIcon, showLyrics && { borderColor: '#FFFFFF' }]}>
                  <Text style={[styles.lyricLabel, showLyrics && { color: '#FFFFFF' }]}>词</Text>
                </View>
              </Pressable>
            </View>
            {playback.error ? (
              <Pressable onPress={playback.retry} style={styles.error}>
                <Text style={styles.errorText}>{playback.error} · 点击重试</Text>
              </Pressable>
            ) : playback.isTrial ? (
              <Text style={styles.notice}>受限音源 · 正在播放试听片段</Text>
            ) : (
              <View style={styles.noticeSpace} />
            )}
            <View style={styles.seekRow}>
              <Text style={styles.time}>{formatTime(dragPosition ?? playback.position)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(1, playback.duration)}
                value={dragPosition ?? playback.position}
                disabled={playback.loading || Boolean(playback.error)}
                minimumTrackTintColor="#FFFFFFA0"
                maximumTrackTintColor="#FFFFFF20"
                thumbTintColor="#FFFFFF"
                onSlidingStart={(position) => setDragPosition(position)}
                onValueChange={(position) => setDragPosition(position)}
                onSlidingComplete={(position) => {
                  setDragPosition(null);
                  void playback.seek(position);
                }}
                accessibilityLabel="播放进度"
              />
              <Text style={styles.time}>{formatTime(playback.duration)}</Text>
            </View>
            <View style={styles.controls}>
              <Pressable
                onPress={queue.cycleMode}
                style={styles.smallControl}
                accessibilityLabel={modeNames[queue.mode]}
              >
                <Ionicons
                  name={queue.mode === 'shuffle' ? 'shuffle' : 'repeat'}
                  size={26}
                  color="#FFFFFFB0"
                />
                {queue.mode === 'repeat-one' ? <Text style={styles.repeatOne}>1</Text> : null}
              </Pressable>
              <Pressable
                onPress={queue.previous}
                style={styles.smallControl}
                accessibilityLabel="上一首"
              >
                <Ionicons name="play-skip-back" size={30} color="white" />
              </Pressable>
              <Pressable
                onPress={() => void playback.toggle()}
                style={styles.playButton}
                accessibilityLabel={playback.playing ? '暂停' : '播放'}
              >
                {playback.loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Ionicons
                    name={playback.playing ? 'pause' : 'play'}
                    size={35}
                    color="white"
                    style={!playback.playing ? { marginLeft: 4 } : undefined}
                  />
                )}
              </Pressable>
              <Pressable
                onPress={() => queue.next()}
                style={styles.smallControl}
                accessibilityLabel="下一首"
              >
                <Ionicons name="play-skip-forward" size={30} color="white" />
              </Pressable>
              <Pressable
                onPress={queue.openQueue}
                style={styles.smallControl}
                accessibilityLabel="播放队列"
              >
                <Ionicons name="list-outline" size={28} color="#FFFFFFB0" />
              </Pressable>
            </View>
            <View style={styles.dots}>
              <View style={[styles.dot, !showLyrics && styles.activeDot]} />
              <View style={[styles.dot, showLyrics && styles.activeDot]} />
            </View>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.player },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 68 },
  back: { width: 36, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center', gap: 6 },
  songTitle: { color: 'white', fontSize: 18, fontWeight: '500' },
  artist: { fontSize: 12, color: '#FFFFFF75' },
  main: { flex: 1, overflow: 'hidden', marginTop: 6 },
  discContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 24 },
  recordHalo: {
    backgroundColor: '#FFFFFF0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF16',
  },
  record: {
    backgroundColor: '#111416',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#24282A',
  },
  recordGroove: { position: 'absolute', borderWidth: 1, borderColor: '#34383A70' },
  recordCenter: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 6,
    backgroundColor: '#112626',
    borderWidth: 2,
    borderColor: '#E0E0E060',
  },
  toneArm: {
    position: 'absolute',
    top: 0,
    width: 35,
    height: 145,
    zIndex: 2,
    transformOrigin: 'top center',
  },
  armPivot: {
    width: 24,
    height: 24,
    borderRadius: 14,
    backgroundColor: '#D1D4D1',
    borderWidth: 7,
    borderColor: '#8B9692',
    alignSelf: 'center',
  },
  armLine: { backgroundColor: '#C3CBC7', width: 5, height: 98, alignSelf: 'center' },
  armHead: {
    backgroundColor: '#ABB6B1',
    width: 16,
    height: 28,
    borderRadius: 3,
    alignSelf: 'center',
    transform: [{ rotate: '-15deg' }],
  },
  discHint: { color: '#FFFFFF45', fontSize: 10, marginTop: 28, letterSpacing: 2 },
  utilities: { flexDirection: 'row', justifyContent: 'center', gap: 64, marginTop: 5 },
  utility: { width: 52, height: 46, alignItems: 'center', justifyContent: 'center' },
  lyricIcon: {
    width: 24,
    height: 23,
    borderWidth: 1.2,
    borderColor: '#FFFFFF90',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricLabel: { color: '#FFFFFF90', fontSize: 13 },
  notice: { textAlign: 'center', color: '#FFFFFF65', fontSize: 9, marginTop: 7, height: 22 },
  noticeSpace: { height: 29 },
  error: { paddingHorizontal: 25, paddingTop: 7, minHeight: 29 },
  errorText: { color: '#FFBCB3', fontSize: 10, textAlign: 'center', lineHeight: 16 },
  seekRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, height: 35 },
  slider: { flex: 1, height: 34, marginHorizontal: 7 },
  time: { color: '#FFFFFF65', fontSize: 10, width: 30, textAlign: 'center' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginTop: 16,
    marginBottom: 20,
  },
  smallControl: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: 66,
    height: 66,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#FFFFFFD0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOne: {
    color: 'white',
    fontSize: 8,
    position: 'absolute',
    top: 19,
    backgroundColor: '#273C3E',
  },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', paddingBottom: 12 },
  dot: { width: 4, height: 4, borderRadius: 4, backgroundColor: '#FFFFFF20' },
  activeDot: { backgroundColor: '#FFFFFF75' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26 },
  emptyText: { color: '#FFFFFF90', fontSize: 15 },
  browseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF65',
    borderRadius: 24,
  },
  browseText: { color: 'white', fontSize: 13 },
});
