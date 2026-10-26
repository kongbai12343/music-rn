import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { PlaylistCard } from '@/components/PlaylistCard';
import { PageStateView } from '@/components/PageStateView';
import { useLikedSongs, useUserPlaylists } from '@/account/accountQueries';
import { useAccountStore } from '@/account/accountStore';
import { useHistoryStore } from '@/history/historyStore';
import type { Playlist } from '@/api/musicTypes';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

function PlaylistShelf({
  title,
  playlists,
  cardWidth,
  emptyMessage,
}: {
  title: string;
  playlists: Playlist[];
  cardWidth: number;
  emptyMessage: string;
}) {
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.countText}>{playlists.length ? `${playlists.length} 个` : ''}</Text>
      </View>
      {playlists.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfContent}
        >
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} width={cardWidth} />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyShelf}>{emptyMessage}</Text>
      )}
    </View>
  );
}

export default function MineScreen() {
  const { width } = useWindowDimensions();
  const profile = useAccountStore((state) => state.profile);
  const hydrated = useAccountStore((state) => state.hydrated);
  const signOut = useAccountStore((state) => state.signOut);
  const recentSongs = useHistoryStore((state) => state.recentSongs);
  const [signingOut, setSigningOut] = useState(false);
  const userPlaylistsQuery = useUserPlaylists();
  const likedSongsQuery = useLikedSongs();
  const cardWidth = Math.max(112, Math.min(136, (width - 64) / 3));
  const userPlaylists = profile ? (userPlaylistsQuery.data ?? []) : [];
  // 按上游 subscribed 标记区分当前账号创建与收藏的歌单，不从歌单名称推断归属。
  const createdPlaylists = userPlaylists.filter((playlist) => !playlist.subscribed);
  const favoritePlaylists = userPlaylists.filter((playlist) => playlist.subscribed);
  const likedSongCount = profile ? likedSongsQuery.data?.length : undefined;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      Alert.alert('退出时发生错误', getErrorMessage(error));
    } finally {
      setSigningOut(false);
    }
  }

  // 会话恢复完成前显示加载状态，避免把尚未读取凭据的用户提前展示为未登录。
  function renderProfile() {
    if (!hydrated) {
      return (
        <View style={styles.profileCard}>
          <PageStateView loading />
        </View>
      );
    }
    if (!profile) {
      return (
        <View style={styles.profileCard}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-outline" size={30} color={colors.primary} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileTitle}>登录云听</Text>
            <Text style={styles.profileSubtitle}>登录后同步喜欢的音乐和个人歌单</Text>
          </View>
          <Pressable
            style={styles.loginButton}
            onPress={() => router.push('/login')}
            accessibilityRole="button"
          >
            <Text style={styles.loginButtonText}>去登录</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.profileCard}>
        {profile.avatarUrl ? (
          <Image
            source={{ uri: profile.avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
            accessibilityLabel={`${profile.nickname}的头像`}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-outline" size={30} color={colors.primary} />
          </View>
        )}
        <View style={styles.profileCopy}>
          <Text style={styles.profileTitle} numberOfLines={1}>
            {profile.nickname || '网易云音乐用户'}
          </Text>
          <Text style={styles.profileSubtitle}>账号已连接 · 喜欢与歌单将从服务端读取</Text>
        </View>
        <Pressable
          disabled={signingOut}
          style={styles.signOutButton}
          onPress={() => void handleSignOut()}
          accessibilityRole="button"
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={signingOut ? colors.muted : colors.secondary}
          />
          <Text style={[styles.signOutText, signingOut && { color: colors.muted }]}>
            {signingOut ? '退出中' : '退出'}
          </Text>
        </Pressable>
      </View>
    );
  }

  function renderPlaylistSection() {
    if (!profile) {
      return (
        <View style={styles.loginHint}>
          <Ionicons name="lock-closed-outline" size={19} color={colors.secondary} />
          <Text style={styles.loginHintText}>登录后，这里会展示你创建和收藏的真实歌单</Text>
          <Pressable onPress={() => router.push('/login')} accessibilityRole="button">
            <Text style={styles.loginHintAction}>去登录</Text>
          </Pressable>
        </View>
      );
    }
    if (userPlaylistsQuery.isPending)
      return (
        <View style={styles.queryState}>
          <PageStateView loading />
        </View>
      );
    if (userPlaylistsQuery.isError)
      return (
        <View style={styles.queryState}>
          <PageStateView
            title="个人歌单加载失败"
            message={getErrorMessage(userPlaylistsQuery.error)}
            onRetry={() => void userPlaylistsQuery.refetch()}
          />
        </View>
      );
    return (
      <>
        <PlaylistShelf
          title="我创建的歌单"
          playlists={createdPlaylists}
          cardWidth={cardWidth}
          emptyMessage="还没有创建歌单"
        />
        <PlaylistShelf
          title="我收藏的歌单"
          playlists={favoritePlaylists}
          cardWidth={cardWidth}
          emptyMessage="收藏的歌单会出现在这里"
        />
      </>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>我的</Text>
          <Text style={styles.pageSubtitle}>把喜欢的音乐，留给下一次打开</Text>
        </View>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="打开设置"
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ApiConfigurationNotice />
        {renderProfile()}
        <Text style={styles.sectionLabel}>快捷入口</Text>
        <View style={styles.quickGrid}>
          <Pressable
            style={styles.quickTile}
            onPress={() => router.push('/collection?type=liked')}
            accessibilityRole="button"
            accessibilityLabel="打开喜欢的音乐"
          >
            <View style={[styles.quickIcon, { backgroundColor: '#FFF0EF' }]}>
              <Ionicons name="heart" size={22} color={colors.primary} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>喜欢的音乐</Text>
              <Text style={styles.quickSubtitle}>
                {profile
                  ? likedSongsQuery.isPending
                    ? '同步中'
                    : `${likedSongCount ?? 0} 首`
                  : '登录后同步'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
          <Pressable
            style={styles.quickTile}
            onPress={() => router.push('/collection?type=recent')}
            accessibilityRole="button"
            accessibilityLabel="打开最近播放"
          >
            <View style={[styles.quickIcon, { backgroundColor: '#F2F4FF' }]}>
              <Ionicons name="time" size={22} color="#6677C9" />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle}>最近播放</Text>
              <Text style={styles.quickSubtitle}>
                {recentSongs.length ? `${recentSongs.length} 首` : '还没有记录'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        </View>
        <Text style={styles.sectionLabel}>我的歌单</Text>
        {renderPlaylistSection()}
        <Text style={styles.footer}>每次打开，都从喜欢的地方继续</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
  },
  pageTitle: { color: colors.text, fontSize: 26, fontWeight: '700' },
  pageSubtitle: { color: colors.secondary, fontSize: 11, marginTop: 8 },
  settingsButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 34 },
  profileCard: {
    minHeight: 92,
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#FFF8F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.canvas },
  avatarPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: { flex: 1, gap: 7 },
  profileTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  profileSubtitle: { color: colors.secondary, fontSize: 10, lineHeight: 17 },
  loginButton: {
    minWidth: 57,
    height: 32,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  loginButtonText: { color: colors.white, fontSize: 12 },
  signOutButton: {
    minHeight: 40,
    minWidth: 45,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  signOutText: { color: colors.secondary, fontSize: 10 },
  sectionLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },
  quickGrid: { marginHorizontal: 20, gap: 10 },
  quickTile: {
    minHeight: 70,
    borderRadius: 10,
    backgroundColor: colors.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 11,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCopy: { flex: 1, gap: 5 },
  quickTitle: { color: colors.text, fontSize: 13, fontWeight: '500' },
  quickSubtitle: { color: colors.secondary, fontSize: 10 },
  loginHint: {
    marginHorizontal: 20,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: colors.canvas,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginHintText: { flex: 1, color: colors.secondary, fontSize: 11, lineHeight: 17 },
  loginHintAction: { color: colors.primary, fontSize: 12 },
  queryState: { minHeight: 150 },
  shelf: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 18,
    paddingBottom: 4,
  },
  shelfHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 13,
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  countText: { color: colors.muted, fontSize: 10 },
  shelfContent: { paddingHorizontal: 20, gap: 12 },
  emptyShelf: { color: colors.muted, fontSize: 12, paddingHorizontal: 20, paddingBottom: 10 },
  footer: {
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 1,
  },
});
