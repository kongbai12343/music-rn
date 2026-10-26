import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/styles/theme';

/** 共用的加载、空内容和错误提示；loading 时使用加载标题，传入 onRetry 才显示重试按钮。 */
export function PageStateView({
  loading,
  title,
  message,
  onRetry,
}: {
  loading?: boolean;
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name="musical-notes-outline" size={38} color="#C9C9C9" />
      )}
      <Text style={styles.title}>
        {loading ? '正在为你寻找好音乐' : (title ?? '这里还没有内容')}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>重新加载</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 46, paddingHorizontal: 32, alignItems: 'center', gap: 14 },
  title: { color: colors.secondary, fontSize: 15 },
  message: { color: colors.secondary, fontSize: 12, lineHeight: 21, textAlign: 'center' },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: { color: colors.primary, fontSize: 13 },
});
