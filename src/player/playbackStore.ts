import { create } from 'zustand';
import type { Song } from '@/api/musicTypes';
import { getNextQueueIndex, type PlaybackMode } from './playbackQueue';

interface PlaybackState {
  queue: Song[];
  currentIndex: number;
  /** 每次需要重新加载音源时递增；即使重选同一首歌，也能触发播放重试。 */
  revision: number;
  mode: PlaybackMode;
  queueVisible: boolean;
  /** 用传入歌曲替换整个队列，index 从 0 开始；空列表不会清空现有队列。 */
  playSongs: (songs: Song[], index?: number) => void;
  selectSong: (index: number) => void;
  /** 默认视为手动切歌；传 false 表示自然结束触发，返回 false 表示不再切换歌曲。 */
  next: (manual?: boolean) => boolean;
  /** 按队列顺序回退，首曲回到末曲；随机模式下也不追溯之前的随机播放顺序。 */
  previous: () => void;
  cycleMode: () => void;
  removeSong: (index: number) => void;
  openQueue: () => void;
  closeQueue: () => void;
}

// 这里只管理队列和播放指令，实际音频实例、进度与错误由 AudioPlayerProvider 管理。
export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  revision: 0,
  mode: 'sequential',
  queueVisible: false,
  playSongs: (songs, index = 0) => {
    if (!songs.length) return;
    set((state) => ({
      queue: songs,
      currentIndex: Math.max(0, Math.min(index, songs.length - 1)),
      revision: state.revision + 1,
    }));
  },
  selectSong: (index) => {
    if (!get().queue[index]) return;
    set((state) => ({ currentIndex: index, revision: state.revision + 1 }));
  },
  next: (manual = true) => {
    const state = get();
    const nextIndex = getNextQueueIndex(state.queue.length, state.currentIndex, state.mode, manual);
    if (nextIndex === null) return false;
    set({ currentIndex: nextIndex, revision: state.revision + 1 });
    return true;
  },
  previous: () => {
    const state = get();
    if (!state.queue.length) return;
    set({
      currentIndex: (state.currentIndex - 1 + state.queue.length) % state.queue.length,
      revision: state.revision + 1,
    });
  },
  cycleMode: () =>
    set((state) => ({
      mode:
        state.mode === 'sequential'
          ? 'shuffle'
          : state.mode === 'shuffle'
            ? 'repeat-one'
            : 'sequential',
    })),
  removeSong: (index) =>
    set((state) => {
      if (!state.queue[index]) return state;
      const queue = state.queue.filter((_, songIndex) => songIndex !== index);
      // 删除当前曲之前的项只修正索引；只有删除当前曲才需要切换并重新加载音源。
      const currentIndex =
        index < state.currentIndex
          ? state.currentIndex - 1
          : Math.min(state.currentIndex, Math.max(0, queue.length - 1));
      return {
        queue,
        currentIndex,
        revision: index === state.currentIndex ? state.revision + 1 : state.revision,
      };
    }),
  openQueue: () => set({ queueVisible: true }),
  closeQueue: () => set({ queueVisible: false }),
}));
