import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/PageHeader';
import { apiConfig } from '@/config/apiConfig';
import { useHistoryStore } from '@/history/historyStore';
import { neteaseApi } from '@/api/neteaseApi';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

export default function SettingsScreen() {
  const [cleared, setCleared] = useState(false);
  // 检测仅由按钮触发且不自动重试；成功只证明推荐接口可达，不代表登录或播放已验证。
  const connection = useQuery({
    queryKey: ['public', 'connection-check'],
    queryFn: ({ signal }) => neteaseApi.getRecommendedPlaylists(signal),
    enabled: false,
    retry: false,
  });
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <PageHeader title="设置与接口配置" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Ionicons name="headset-outline" size={35} color={colors.primary} />
          <Text style={styles.brandTitle}>云听</Text>
          <Text style={styles.muted}>经典音乐界面 · 非官方学习项目</Text>
        </View>
        <Text style={styles.heading}>API 服务</Text>
        <Text style={styles.muted}>
          {apiConfig.isApiConfigured
            ? '已配置地址，真实接口能力仍需联调'
            : apiConfig.hasInvalidApiUrl
              ? '地址格式无效，请使用 http:// 或 https://'
              : '未配置，请填写 API 地址后重启 Expo'}
        </Text>
        <View style={styles.code}>
          <Text selectable style={styles.codeText}>
            {apiConfig.apiBaseUrl || 'EXPO_PUBLIC_API_BASE_URL=\nhttp://你的电脑局域网IP:3000'}
          </Text>
        </View>
        <Text style={styles.description}>
          编辑项目根目录的 .env，文件不存在时新建，填写服务地址后重启 Expo。真机不能使用手机自己的
          localhost；Android 模拟器访问电脑可使用
          http://10.0.2.2:3000。服务器需允许局域网连接，并检查防火墙。
        </Text>
        <Pressable
          disabled={!apiConfig.isApiConfigured || connection.isFetching}
          style={[styles.button, !apiConfig.isApiConfigured && { opacity: 0.4 }]}
          onPress={() => void connection.refetch()}
        >
          <Text style={styles.buttonText}>
            {connection.isFetching ? '正在检测…' : '检测接口连接'}
          </Text>
        </Pressable>
        {connection.isSuccess ? (
          <Text style={styles.result}>服务可达，推荐歌单接口响应成功</Text>
        ) : connection.isError ? (
          <Text style={styles.error}>{getErrorMessage(connection.error)}</Text>
        ) : null}
        <Text style={styles.heading}>本地记录</Text>
        <Pressable
          style={styles.row}
          onPress={() => {
            useHistoryStore.getState().clearSearches();
            useHistoryStore.getState().clearRecentSongs();
            setCleared(true);
          }}
        >
          <Text style={styles.rowText}>
            {cleared ? '本地搜索与播放记录已清理' : '清理搜索与最近播放记录'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
        </Pressable>
        <Text style={styles.heading}>使用说明</Text>
        <Text style={styles.description}>
          歌单、歌曲、封面、歌词和音源均从已配置的 API
          获取，不提供本地演示内容。本项目不破解版权、会员或付费限制，未配置 API
          时无法浏览曲库、播放或登录。原生后台与系统控制需设备验证，浏览器不能作为原生能力的验收依据。正式分发必须使用可信
          HTTPS 服务。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: 24, paddingBottom: 40 },
  brand: { alignItems: 'center', gap: 10, marginVertical: 20 },
  brandTitle: { fontSize: 23, fontWeight: '600', color: colors.text },
  muted: { fontSize: 12, color: colors.secondary, lineHeight: 22 },
  heading: { fontSize: 16, fontWeight: '600', marginTop: 26, marginBottom: 12, color: colors.text },
  code: { padding: 16, backgroundColor: colors.canvas, borderRadius: 8, marginVertical: 12 },
  codeText: { fontFamily: 'monospace', fontSize: 12, color: colors.text, lineHeight: 22 },
  description: { fontSize: 12, color: colors.secondary, lineHeight: 23 },
  button: {
    borderRadius: 24,
    backgroundColor: colors.primary,
    padding: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { fontSize: 14, color: 'white' },
  result: { marginTop: 14, color: '#42856D', fontSize: 12 },
  error: { marginTop: 14, color: colors.primary, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowText: { color: colors.text, fontSize: 13 },
});
