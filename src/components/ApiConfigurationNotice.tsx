import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { apiConfig } from '@/config/apiConfig';
import { colors } from '@/styles/theme';

/** 只提示地址未配置或格式错误；已配置不代表服务可达，实际连接检测在设置页完成。 */
export function ApiConfigurationNotice() {
  if (apiConfig.isApiConfigured) return null;
  return (
    <Pressable
      style={styles.notice}
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
    >
      <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
      <Text style={styles.text}>
        {apiConfig.hasInvalidApiUrl ? 'API 地址格式错误' : '尚未配置 API 服务'}
        ，点击查看配置方式
      </Text>
      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: { color: '#C96862', fontSize: 11, flex: 1 },
});
