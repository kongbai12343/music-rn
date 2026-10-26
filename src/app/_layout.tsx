import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PlaybackQueueModal } from '@/components/PlaybackQueueModal';
import { useAccountStore } from '@/account/accountStore';
import { AudioPlayerProvider } from '@/player/AudioPlayerProvider';
import { queryClient } from '@/config/queryClient';
import { colors } from '@/styles/theme';

/** 在全局查询上下文内恢复会话，统一托管路由、共享音频实例和播放队列弹窗。 */
function AppNavigation() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  // 标签页布局已有迷你播放器，完整播放页也不需要它，避免同一页面重复显示控件。
  const showMiniPlayer = segments[0] !== '(tabs)' && segments[0] !== 'player';
  const usesDarkBackground = segments[0] === 'player' || segments[0] === 'playlist';
  useEffect(() => {
    void useAccountStore.getState().restore();
  }, []);
  return (
    <AudioPlayerProvider>
      <View style={styles.container}>
        <StatusBar style={usesDarkBackground ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.white },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="player"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
        </Stack>
        {showMiniPlayer ? (
          <View style={{ paddingBottom: insets.bottom }}>
            <MiniPlayer />
          </View>
        ) : null}
      </View>
      <PlaybackQueueModal />
    </AudioPlayerProvider>
  );
}

/** 安全区和查询客户端必须包在导航外层，保证页面与全局播放器共享同一份上下文。 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppNavigation />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.white } });
