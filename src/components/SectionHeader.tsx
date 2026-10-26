import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/styles/theme';

/** 内容分区标题；仅提供 onPress 时显示操作入口，action 只决定入口文字。 */
export function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onPress ? (
        <Pressable onPress={onPress} style={styles.button} accessibilityRole="button">
          <Text style={styles.label}>{action ?? '查看更多'}</Text>
          <Ionicons name="chevron-forward" size={11} color={colors.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  button: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8D8D8',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    gap: 2,
  },
  label: { color: colors.secondary, fontSize: 10 },
});
