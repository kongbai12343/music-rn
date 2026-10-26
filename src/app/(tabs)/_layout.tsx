import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '@/components/MiniPlayer';
import { colors } from '@/styles/theme';

const tabItems = [
  { name: 'index', label: '发现', icon: 'compass-outline', activeIcon: 'compass' },
  { name: 'playlists', label: '歌单', icon: 'albums-outline', activeIcon: 'albums' },
  { name: 'mine', label: '我的', icon: 'musical-notes-outline', activeIcon: 'musical-notes' },
] as const;

/**
 * 逐步提取自定义 tabBar 收到的 props 类型：
 *
 * 1. typeof Tabs
 *    获取 Tabs 组件本身的类型。
 *
 * 2. ComponentProps<typeof Tabs>
 *    获取 Tabs 组件的全部 props 类型，例如 children、screenOptions、tabBar 等。
 *
 * 3. ComponentProps<typeof Tabs>['tabBar']
 *    从全部 props 中取出 tabBar 属性的类型。
 *    结果通常是：((props: TabBarProps) => ReactNode) | undefined，
 *    因为 tabBar 可能不传。
 *
 * 4. NonNullable<...>
 *    去掉上一步类型中的 undefined，得到 tabBar 函数本身的类型：
 *    (props: TabBarProps) => ReactNode。
 *
 * 5. Parameters<...>
 *    获取这个函数的参数类型，结果是一个元组：[props: TabBarProps]。
 *
 * 6. [0]
 *    取出元组的第一个元素，最终得到 TabBarProps。
 */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** 将迷你播放器放在标签栏上方，并统一处理底部安全区，避免各标签页重复占位。 */
function MusicTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.white, paddingBottom: insets.bottom }}>
      <MiniPlayer />
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = tabItems.find((item) => item.name === route.name);
          if (!tab) return null;
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                // 保留导航库的 tabPress 事件，允许页面监听器阻止本次切换。
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.icon, active && styles.activeIcon]}>
                <Ionicons
                  name={active ? tab.activeIcon : tab.icon}
                  size={23}
                  color={active ? colors.white : '#858585'}
                />
              </View>
              <Text style={[styles.label, active && { color: colors.primary }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <MusicTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="playlists" />
      <Tabs.Screen name="mine" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 62,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  activeIcon: { backgroundColor: colors.primary },
  label: { fontSize: 10, color: '#858585' },
});
