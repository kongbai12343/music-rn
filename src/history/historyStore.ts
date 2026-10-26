import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Song } from '@/api/musicTypes';

interface HistoryState {
  /** 最近使用的关键词排在前面，按完整关键词去重，最多保留 20 条。 */
  searches: string[];
  /** 最近播放的歌曲排在前面，按歌曲 ID 去重，最多保留 100 首。 */
  recentSongs: Song[];
  addSearch: (keyword: string) => void;
  clearSearches: () => void;
  addRecentSong: (song: Song) => void;
  clearRecentSongs: () => void;
}

// 搜索与播放历史是本地设备记录，不随账号切换清空，也不上传到 API 服务。
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      searches: [],
      recentSongs: [],
      addSearch: (keyword) =>
        set((state) => ({
          searches: [keyword, ...state.searches.filter((search) => search !== keyword)].slice(
            0,
            20,
          ),
        })),
      clearSearches: () => set({ searches: [] }),
      addRecentSong: (song) =>
        set((state) => ({
          recentSongs: [
            song,
            ...state.recentSongs.filter((recentSong) => recentSong.id !== song.id),
          ].slice(0, 100),
        })),
      clearRecentSongs: () => set({ recentSongs: [] }),
    }),
    {
      name: 'cloud-listening-history',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState) => {
        const history = persistedState as Pick<HistoryState, 'searches' | 'recentSongs'>;
        // 旧演示歌曲使用负数 ID，迁移时清除它们，同时保留真实歌曲与搜索记录。
        return {
          searches: history.searches ?? [],
          recentSongs: history.recentSongs?.filter((song) => song.id > 0) ?? [],
        };
      },
    },
  ),
);
