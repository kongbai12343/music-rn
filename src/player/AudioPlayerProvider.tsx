/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- expo-audio 的原生对象需要直接修改属性，副作用负责同步音源与原生播放状态。 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { usePlaybackStore } from './playbackStore';
import { useHistoryStore } from '@/history/historyStore';
import { useAccountStore } from '@/account/accountStore';
import { neteaseApi } from '@/api/neteaseApi';
import type { Song } from '@/api/musicTypes';
import { getErrorMessage } from '@/utils/formatters';

interface PlaybackContextValue {
  song?: Song;
  playing: boolean;
  /** 实际播放进度，单位为秒，不是页面定时器推算的进度。 */
  position: number;
  /** 当前加载音源的实际时长，单位为秒；试听音源可能短于歌曲元数据时长。 */
  duration: number;
  loading: boolean;
  error: string | null;
  isTrial: boolean;
  toggle: () => Promise<void>;
  /** 跳转目标使用秒数，内部会将位置限制在当前音源的有效时长内。 */
  seek: (position: number) => Promise<void>;
  retry: () => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

/** 在根布局保留唯一音频实例，页面只订阅状态，切换路由不会重新创建播放器。 */
export function AudioPlayerProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const song = usePlaybackStore((state) => state.queue[state.currentIndex]);
  const revision = usePlaybackStore((state) => state.revision);
  const mode = usePlaybackStore((state) => state.mode);
  // 账号凭据影响音源权限，Cookie 变化时须按新会话重新解析当前歌曲。
  const cookie = useAccountStore((state) => state.cookie);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const audioModePromise = useRef<Promise<void> | null>(null);
  const sourceExpiration = useRef(0);

  useEffect(() => {
    audioModePromise.current = setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
      allowsRecording: false,
    });
    audioModePromise.current.catch(() => setError('无法初始化音频模式，请重启应用后重试'));
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    let removeStatusListener: (() => void) | undefined;
    let hasStarted = false;
    let hasFinished = false;
    // Android 不接受 replace(null)，新音源解析完成前保留旧音源但立即暂停。
    player.pause();
    if (Platform.OS !== 'web') player.clearLockScreenControls();
    setError(null);
    setIsTrial(false);
    if (!song) {
      setResolving(false);
      return;
    }

    async function resolveAndPlaySong() {
      setResolving(true);
      try {
        await audioModePromise.current;
        const source = await neteaseApi.getSongSource(song!.id, abortController.signal);
        if (abortController.signal.aborted) return;
        if (!source.url)
          throw new Error(source.message ?? '这首歌暂时无法播放，可能受版权、会员或付费限制');
        sourceExpiration.current = source.expiresAt;
        setIsTrial(source.isTrial);
        player.replace({ uri: source.url });
        player.loop = usePlaybackStore.getState().mode === 'repeat-one';
        if (Platform.OS !== 'web') {
          player.setActiveForLockScreen(true, {
            title: song!.title,
            artist: song!.artists,
            albumTitle: song!.album,
            artworkUrl: song!.artwork || undefined,
          });
        }
        const subscription = player.addListener('playbackStatusUpdate', (nativeStatus) => {
          // 快速切歌时旧回调可能仍在到达，必须核对取消状态和当前播放版本。
          if (abortController.signal.aborted || usePlaybackStore.getState().revision !== revision)
            return;
          if (nativeStatus.error) {
            setError('音源加载或播放失败，请重试；若仍失败，可切换另一首歌曲');
            return;
          }
          // 只有实际开始播放才记录历史，点击后加载失败的歌曲不计入最近播放。
          if (nativeStatus.playing && !hasStarted) {
            hasStarted = true;
            useHistoryStore.getState().addRecentSong(song!);
          }
          if (nativeStatus.playing && nativeStatus.currentTime < 0.5) hasFinished = false;
          // 结束事件可能重复到达；单曲循环交给原生播放器，其他模式只自动切歌一次。
          if (
            nativeStatus.didJustFinish &&
            hasStarted &&
            !hasFinished &&
            usePlaybackStore.getState().mode !== 'repeat-one'
          ) {
            hasFinished = true;
            usePlaybackStore.getState().next(false);
          }
        });
        removeStatusListener = () => subscription.remove();
        player.play();
      } catch (playbackError) {
        if (!abortController.signal.aborted) setError(getErrorMessage(playbackError));
      } finally {
        if (!abortController.signal.aborted) setResolving(false);
      }
    }
    void resolveAndPlaySong();
    return () => {
      // 切歌或退出提供器时取消旧请求并解除监听，阻止旧音源覆盖新歌曲。
      abortController.abort();
      removeStatusListener?.();
    };
    // 循环模式单独同步，不能加入此副作用的依赖，否则切换模式会重新加载音源。
  }, [song, revision, player, cookie]);

  useEffect(() => {
    player.loop = mode === 'repeat-one';
  }, [mode, player]);

  useEffect(() => {
    if (!song || error || status.isLoaded || resolving) return;
    // 接口请求已有独立超时；这里另设 20 秒限制，处理拿到地址后音频仍无法加载的情况。
    const timeout = setTimeout(() => {
      player.pause();
      setError('音源加载超时，请检查网络后重试');
    }, 20000);
    return () => clearTimeout(timeout);
  }, [song, revision, error, status.isLoaded, resolving, player]);

  const retry = useCallback(() => {
    const state = usePlaybackStore.getState();
    state.selectSong(state.currentIndex);
  }, []);

  const toggle = useCallback(async () => {
    if (!song || resolving) return;
    if (status.playing) {
      player.pause();
      return;
    }
    // 音源地址有有效期，过期或播放失败后要重新解析，不能直接恢复旧地址。
    if (error || Date.now() >= sourceExpiration.current) {
      retry();
      return;
    }
    try {
      const requestedRevision = usePlaybackStore.getState().revision;
      if (
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration - 0.1)
      )
        await player.seekTo(0);
      // 等待跳转完成时可能已切歌，此时不能再对新歌曲执行旧的恢复播放操作。
      if (usePlaybackStore.getState().revision === requestedRevision) player.play();
    } catch {
      setError('无法开始播放，请重试');
    }
  }, [
    song,
    resolving,
    status.playing,
    status.didJustFinish,
    status.duration,
    status.currentTime,
    error,
    player,
    retry,
  ]);

  const seek = useCallback(
    async (position: number) => {
      if (!status.isLoaded || resolving || error) return;
      try {
        await player.seekTo(Math.min(Math.max(0, position), status.duration));
      } catch {
        setError('无法跳转播放位置，请重试');
      }
    },
    [status.isLoaded, status.duration, resolving, error, player],
  );

  const value = useMemo(
    () => ({
      song,
      playing: status.playing,
      position: status.currentTime,
      duration: status.duration,
      loading: resolving || Boolean(song && !error && (!status.isLoaded || status.isBuffering)),
      error,
      isTrial,
      toggle,
      seek,
      retry,
    }),
    [
      song,
      status.playing,
      status.currentTime,
      status.duration,
      status.isLoaded,
      status.isBuffering,
      resolving,
      error,
      isTrial,
      toggle,
      seek,
      retry,
    ],
  );
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

/** 读取共享播放状态和控制方法；必须在 AudioPlayerProvider 的子组件中调用。 */
export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (!context) throw new Error('usePlayback must be used inside AudioPlayerProvider');
  return context;
}
