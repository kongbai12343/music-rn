import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/styles/theme';

/** 子页面标题栏；light 表示使用浅色文字适配深色背景，无返回历史时回到首页。 */
export function PageHeader({
  title,
  light = false,
  right,
}: {
  title: string;
  light?: boolean;
  /** 自定义右侧操作；未提供时保留与返回按钮等宽的占位，避免标题布局偏移。 */
  right?: React.ReactNode;
}) {
  const foreground = light ? colors.white : colors.text;
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}
        accessibilityLabel="返回"
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={25} color={foreground} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color: foreground }]}>
        {title}
      </Text>
      {right ?? <View style={styles.back} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '600', marginLeft: 8 },
});
