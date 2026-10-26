import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { PlaylistCard } from '@/components/PlaylistCard';
import { SongRow } from '@/components/SongRow';
import { PageStateView } from '@/components/PageStateView';
import { apiConfig } from '@/config/apiConfig';
import { useHistoryStore } from '@/history/historyStore';
import { usePlaybackStore } from '@/player/playbackStore';
import { neteaseApi } from '@/api/neteaseApi';
import type { Song } from '@/api/musicTypes';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

// 必须与 neteaseApi 的歌曲、歌单搜索 limit 一致，否则后续分页的条目偏移会出错。
const SEARCH_PAGE_SIZE = 30;

type SearchTab = 'songs' | 'playlists';

/** 本地筛选历史与热搜时忽略大小写；空关键词匹配所有已存在的字符串。 */
function matchesKeyword(value: string | undefined, keyword: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()));
}

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  // 输入值与提交关键词分开管理，只有确认搜索后才加载完整结果分页。
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('songs');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputReference = useRef<TextInput>(null);
  const isMountedReference = useRef(true);
  const historySearches = useHistoryStore((state) => state.searches);
  const addSearch = useHistoryStore((state) => state.addSearch);
  const clearSearches = useHistoryStore((state) => state.clearSearches);

  useEffect(() => {
    isMountedReference.current = true;
    return () => {
      isMountedReference.current = false;
    };
  }, []);

  useEffect(() => {
    const focusTimer = setTimeout(() => inputReference.current?.focus(), 80);
    return () => clearTimeout(focusTimer);
  }, []);

  const hotSearchQuery = useQuery({
    queryKey: ['public', 'hot-searches'],
    queryFn: ({ signal }) => neteaseApi.getHotSearches(signal),
    enabled: apiConfig.isApiConfigured,
  });

  const songSearchQuery = useInfiniteQuery({
    queryKey: ['public', 'search-songs', submittedKeyword],
    queryFn: ({ pageParam, signal }) => neteaseApi.searchSongs(submittedKeyword, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * SEARCH_PAGE_SIZE : undefined,
    enabled: Boolean(apiConfig.isApiConfigured && submittedKeyword),
  });

  const playlistSearchQuery = useInfiniteQuery({
    queryKey: ['public', 'search-playlists', submittedKeyword],
    queryFn: ({ pageParam, signal }) =>
      neteaseApi.searchPlaylists(submittedKeyword, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * SEARCH_PAGE_SIZE : undefined,
    enabled: Boolean(apiConfig.isApiConfigured && submittedKeyword),
  });

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword || submittedKeyword || !apiConfig.isApiConfigured) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;
    // 等待输入稳定后再请求建议；关键词变化时取消旧请求，防止旧结果覆盖新输入。
    const suggestionTimer = setTimeout(() => {
      void neteaseApi
        .getSuggestions(trimmedKeyword, abortController.signal)
        .then((nextSuggestions) => {
          if (!cancelled && isMountedReference.current) setSuggestions(nextSuggestions.slice(0, 8));
        })
        .catch(() => {
          if (!cancelled && isMountedReference.current) setSuggestions([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      abortController.abort();
      clearTimeout(suggestionTimer);
    };
  }, [keyword, submittedKeyword]);

  const hotSearches = useMemo(() => hotSearchQuery.data ?? [], [hotSearchQuery.data]);
  const songResults = useMemo(
    () => songSearchQuery.data?.pages.flatMap((page) => page.songs) ?? [],
    [songSearchQuery.data],
  );
  const playlistResults = useMemo(
    () => playlistSearchQuery.data?.pages.flatMap((page) => page.playlists) ?? [],
    [playlistSearchQuery.data],
  );
  const filteredHistory = useMemo(
    () => historySearches.filter((search) => matchesKeyword(search, keyword.trim())),
    [historySearches, keyword],
  );
  const filteredHotSearches = useMemo(
    () => hotSearches.filter((search) => matchesKeyword(search, keyword.trim())),
    [hotSearches, keyword],
  );

  const submitSearch = useCallback(
    (nextKeyword = keyword) => {
      const normalizedKeyword = nextKeyword.trim();
      if (!normalizedKeyword) return;
      Keyboard.dismiss();
      addSearch(normalizedKeyword);
      setKeyword(normalizedKeyword);
      setSubmittedKeyword(normalizedKeyword);
      setSuggestions([]);
    },
    [addSearch, keyword],
  );

  const handleKeywordChange = useCallback(
    (nextKeyword: string) => {
      setKeyword(nextKeyword);
      setSuggestions([]);
      // 已提交的关键词一旦被修改，就回到建议与历史界面，不继续展示旧关键词的搜索结果。
      if (submittedKeyword && nextKeyword.trim() !== submittedKeyword) setSubmittedKeyword('');
    },
    [submittedKeyword],
  );

  // 搜索播放仅使用当前已加载的结果，不主动把尚未请求的后续页加入队列。
  const openSongResults = useCallback((songs: Song[], songIndex: number) => {
    usePlaybackStore.getState().playSongs(songs, songIndex);
    router.push('/player');
  }, []);

  const leaveSearch = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  const showNextSongs = useCallback(() => {
    if (!songSearchQuery.hasNextPage || songSearchQuery.isFetchingNextPage) return;
    void songSearchQuery.fetchNextPage();
  }, [songSearchQuery]);

  const showNextPlaylists = useCallback(() => {
    if (!playlistSearchQuery.hasNextPage || playlistSearchQuery.isFetchingNextPage) return;
    void playlistSearchQuery.fetchNextPage();
  }, [playlistSearchQuery]);

  function renderSearchLanding() {
    const hasKeyword = Boolean(keyword.trim());
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.landingContent}
      >
        <ApiConfigurationNotice />
        {hasKeyword && suggestions.length ? (
          <View style={styles.suggestionPanel}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                style={styles.suggestionRow}
                onPress={() => submitSearch(suggestion)}
                accessibilityRole="button"
              >
                <Ionicons name="search-outline" size={17} color={colors.secondary} />
                <Text numberOfLines={1} style={styles.suggestionText}>
                  {suggestion}
                </Text>
                <Ionicons name="arrow-up-outline" size={17} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>搜索历史</Text>
            {historySearches.length ? (
              <Pressable
                onPress={clearSearches}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="清空搜索历史"
              >
                <Ionicons name="trash-outline" size={17} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          {historySearches.length ? (
            <View style={styles.chipWrap}>
              {(hasKeyword ? filteredHistory : historySearches).map((search) => (
                <Pressable
                  key={search}
                  style={styles.chip}
                  onPress={() => submitSearch(search)}
                  accessibilityRole="button"
                >
                  <Ionicons name="time-outline" size={14} color={colors.secondary} />
                  <Text style={styles.chipText}>{search}</Text>
                </Pressable>
              ))}
              {hasKeyword && !filteredHistory.length ? (
                <Text style={styles.emptyHint}>没有匹配的历史记录</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyHint}>搜索过的内容会保存在这里</Text>
          )}
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>热搜榜</Text>
            {apiConfig.isApiConfigured && hotSearchQuery.isFetching ? (
              <Text style={styles.loadingHint}>更新中</Text>
            ) : null}
          </View>
          {!apiConfig.isApiConfigured ? (
            <Text style={styles.emptyHint}>配置 API 后加载热搜榜</Text>
          ) : hotSearchQuery.isError ? (
            <View style={styles.inlineError}>
              <Text style={styles.errorText}>{getErrorMessage(hotSearchQuery.error)}</Text>
              <Pressable onPress={() => void hotSearchQuery.refetch()} accessibilityRole="button">
                <Text style={styles.retryText}>重试</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.chipWrap}>
              {(hasKeyword ? filteredHotSearches : hotSearches).map((search, index) => (
                <Pressable
                  key={`${search}-${index}`}
                  style={[styles.chip, index < 3 && styles.hotChip]}
                  onPress={() => submitSearch(search)}
                  accessibilityRole="button"
                >
                  {index < 3 ? (
                    <Text style={styles.hotRank}>{index + 1}</Text>
                  ) : (
                    <Ionicons name="flame-outline" size={14} color={colors.primary} />
                  )}
                  <Text style={styles.chipText}>{search}</Text>
                </Pressable>
              ))}
              {hasKeyword && !filteredHotSearches.length ? (
                <Text style={styles.emptyHint}>没有匹配的热搜词</Text>
              ) : null}
            </View>
          )}
        </View>
        <Text style={styles.landingFooter}>输入关键词，去遇见下一首喜欢的歌</Text>
      </ScrollView>
    );
  }

  function renderSongs() {
    if (!apiConfig.isApiConfigured) return <PageStateView title="配置 API 后搜索歌曲" />;
    if (songSearchQuery.isPending) return <PageStateView loading />;
    if (songSearchQuery.isError)
      return (
        <PageStateView
          title="歌曲搜索失败"
          message={getErrorMessage(songSearchQuery.error)}
          onRetry={() => void songSearchQuery.refetch()}
        />
      );
    return (
      <FlatList
        data={songResults}
        keyExtractor={(song, index) => `${song.id}-${index}`}
        renderItem={({ item: song, index }) => (
          <SongRow
            song={song}
            index={index}
            showArtwork
            onPress={() => openSongResults(songResults, index)}
          />
        )}
        onEndReached={apiConfig.isApiConfigured ? showNextSongs : undefined}
        onEndReachedThreshold={0.65}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={songResults.length ? styles.resultsList : styles.emptyResults}
        ListEmptyComponent={<PageStateView title="没有找到相关歌曲" message="换个关键词试试吧" />}
        ListFooterComponent={
          apiConfig.isApiConfigured && songSearchQuery.isFetchingNextPage ? (
            <PageStateView loading />
          ) : null
        }
      />
    );
  }

  function renderPlaylists() {
    if (!apiConfig.isApiConfigured) return <PageStateView title="配置 API 后搜索歌单" />;
    if (playlistSearchQuery.isPending) return <PageStateView loading />;
    if (playlistSearchQuery.isError)
      return (
        <PageStateView
          title="歌单搜索失败"
          message={getErrorMessage(playlistSearchQuery.error)}
          onRetry={() => void playlistSearchQuery.refetch()}
        />
      );
    return (
      <FlatList
        data={playlistResults}
        numColumns={2}
        keyExtractor={(playlist, index) => `${playlist.id}-${index}`}
        columnWrapperStyle={styles.playlistColumns}
        renderItem={({ item: playlist }) => (
          <PlaylistCard playlist={playlist} width={(width - 52) / 2} />
        )}
        onEndReached={apiConfig.isApiConfigured ? showNextPlaylists : undefined}
        onEndReachedThreshold={0.65}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          playlistResults.length ? styles.playlistResults : styles.emptyResults
        }
        ListEmptyComponent={<PageStateView title="没有找到相关歌单" message="换个关键词试试吧" />}
        ListFooterComponent={
          apiConfig.isApiConfigured && playlistSearchQuery.isFetchingNextPage ? (
            <PageStateView loading />
          ) : null
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={leaveSearch}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.secondary} />
          <TextInput
            ref={inputReference}
            value={keyword}
            onChangeText={handleKeywordChange}
            onSubmitEditing={() => submitSearch()}
            placeholder="搜索歌曲、歌手或歌单"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="搜索关键词"
          />
          {keyword ? (
            <Pressable
              onPress={() => handleKeywordChange('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="清除关键词"
            >
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={leaveSearch} style={styles.cancelButton} accessibilityRole="button">
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
      </View>
      {submittedKeyword ? (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeading}>
            <Text style={styles.resultsTitle} numberOfLines={1}>
              “{submittedKeyword}”
            </Text>
          </View>
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'songs' && styles.activeTab]}
              onPress={() => setActiveTab('songs')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'songs' }}
            >
              <Text style={[styles.tabText, activeTab === 'songs' && styles.activeTabText]}>
                歌曲
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'playlists' && styles.activeTab]}
              onPress={() => setActiveTab('playlists')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'playlists' }}
            >
              <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>
                歌单
              </Text>
            </Pressable>
          </View>
          <ApiConfigurationNotice />
          {activeTab === 'songs' ? renderSongs() : renderPlaylists()}
        </View>
      ) : (
        renderSearchLanding()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 8,
  },
  backButton: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flex: 1,
    height: 40,
    borderRadius: 22,
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 7,
  },
  input: { flex: 1, height: 40, color: colors.text, fontSize: 14, paddingVertical: 0 },
  cancelButton: { minWidth: 40, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontSize: 13 },
  landingContent: { paddingBottom: 34 },
  suggestionPanel: {
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingBottom: 5,
  },
  suggestionRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  suggestionText: { flex: 1, color: colors.text, fontSize: 14 },
  section: { paddingHorizontal: 20, paddingTop: 25 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  loadingHint: { color: colors.muted, fontSize: 11 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hotChip: { backgroundColor: colors.primarySoft },
  hotRank: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  chipText: { color: colors.secondary, fontSize: 12 },
  emptyHint: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  inlineError: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12 },
  errorText: { color: colors.secondary, fontSize: 12, flex: 1 },
  retryText: { color: colors.primary, fontSize: 12 },
  landingFooter: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 40,
  },
  resultsContainer: { flex: 1 },
  resultsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 7,
    paddingBottom: 15,
    gap: 9,
  },
  resultsTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '600' },
  tabs: {
    height: 43,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingHorizontal: 20,
    gap: 22,
  },
  tab: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { color: colors.secondary, fontSize: 13 },
  activeTabText: { color: colors.primary, fontWeight: '600' },
  resultsList: { paddingTop: 6, paddingBottom: 30 },
  playlistResults: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  playlistColumns: { justifyContent: 'space-between', marginBottom: 20 },
  emptyResults: { flexGrow: 1, justifyContent: 'center' },
});
