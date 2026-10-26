import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConfigurationNotice } from '@/components/ApiConfigurationNotice';
import { PageHeader } from '@/components/PageHeader';
import { apiConfig } from '@/config/apiConfig';
import { useAccountStore } from '@/account/accountStore';
import { neteaseApi } from '@/api/neteaseApi';
import { colors } from '@/styles/theme';
import { getErrorMessage } from '@/utils/formatters';

type LoginMode = 'phone' | 'qr';
type QrStatus = 'idle' | 'waiting' | 'confirming' | 'expired' | 'confirmed' | 'error';

interface QrState {
  image?: string;
  status: QrStatus;
  message?: string;
}

// 不同服务版本可能返回完整图片地址或裸 Base64，后者需要补齐图片数据前缀。
function normalizeQrImage(image: string): string {
  if (image.startsWith('data:') || image.startsWith('http://') || image.startsWith('https://'))
    return image;
  return `data:image/png;base64,${image}`;
}

/** 只校验输入是否为 5 至 15 位数字，不代表号码真实有效；区号固定为 86，由服务端进一步验证。 */
function validatePhoneNumber(phone: string): string | null {
  if (!phone) return '请输入手机号';
  if (!/^\d{5,15}$/.test(phone)) return '请输入正确的手机号';
  return null;
}

export default function LoginScreen() {
  const [loginMode, setLoginMode] = useState<LoginMode>('phone');
  const [phone, setPhone] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [sendingCaptcha, setSendingCaptcha] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrRefreshToken, setQrRefreshToken] = useState(0);
  const [qrState, setQrState] = useState<QrState>({ status: 'idle' });
  const isMountedReference = useRef(true);

  useEffect(() => {
    isMountedReference.current = true;
    return () => {
      isMountedReference.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const cooldownTimer = setTimeout(
      () => setCooldownSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearTimeout(cooldownTimer);
  }, [cooldownSeconds]);

  // 路由失焦时页面未必卸载，轮询必须随焦点停止；切换登录方式或刷新也要取消旧任务。
  useFocusEffect(
    useCallback(() => {
      if (loginMode !== 'qr') return;

      if (!apiConfig.isApiConfigured) {
        setQrState({
          status: 'error',
          message: '请先在设置中配置 API 地址，二维码登录才能连接真实服务',
        });
        return;
      }

      const abortController = new AbortController();
      const isActive = () => !abortController.signal.aborted && isMountedReference.current;
      let pollingTimer: ReturnType<typeof setTimeout> | undefined;

      async function startQrLogin() {
        setQrState({ status: 'waiting', message: '正在获取登录二维码' });
        try {
          const qrKey = await neteaseApi.getQrKey(abortController.signal);
          const qr = await neteaseApi.createQr(qrKey, abortController.signal);
          if (!isActive()) return;
          const image = normalizeQrImage(qr.image);
          setQrState({ status: 'waiting', image });

          async function pollQrStatus() {
            try {
              const result = await neteaseApi.checkQr(qrKey, abortController.signal);
              if (!isActive()) return;
              if (result.code === 800) {
                setQrState({ status: 'expired', image, message: '二维码已过期，请刷新后重试' });
                return;
              }
              if (result.code === 803) {
                if (!result.cookie) throw new Error('服务未返回有效登录凭据，请刷新二维码后重试');
                // 新 Cookie 还未写入账号状态，先显式用它验证用户资料，再正式建立会话。
                const profile = await neteaseApi.getLoginStatusForCookie(
                  result.cookie,
                  abortController.signal,
                );
                if (!isActive()) return;
                if (!profile) throw new Error('服务未返回有效用户资料，请检查 API 版本后重试');
                await useAccountStore.getState().setSession(result.cookie, profile);
                if (!isActive()) return;
                setQrState({ status: 'confirmed', image, message: '登录成功' });
                router.replace('/(tabs)/mine');
                return;
              }
              setQrState({
                status: result.code === 802 ? 'confirming' : 'waiting',
                image,
                message:
                  result.code === 802 ? '已扫码，请在手机上确认登录' : '请使用网易云音乐 App 扫码',
              });
              // 本次请求完成后再安排下一次轮询，避免慢请求重叠、乱序更新扫码状态。
              pollingTimer = setTimeout(() => void pollQrStatus(), 2000);
            } catch (error) {
              if (isActive())
                setQrState({ status: 'error', image, message: getErrorMessage(error) });
            }
          }

          await pollQrStatus();
        } catch (error) {
          if (isActive()) setQrState({ status: 'error', message: getErrorMessage(error) });
        }
      }

      void startQrLogin();
      return () => {
        abortController.abort();
        clearTimeout(pollingTimer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 刷新标记用于主动重建二维码与轮询任务，必须保留为依赖。
    }, [loginMode, qrRefreshToken]),
  );

  const requireConsent = useCallback(() => {
    if (consentGiven) return true;
    setErrorMessage('请先同意使用说明，再进行登录');
    return false;
  }, [consentGiven]);

  const sendCaptcha = useCallback(async () => {
    const normalizedPhone = phone.trim();
    const phoneError = validatePhoneNumber(normalizedPhone);
    if (phoneError) {
      setErrorMessage(phoneError);
      return;
    }
    if (!requireConsent() || sendingCaptcha || cooldownSeconds > 0) return;
    Keyboard.dismiss();
    setErrorMessage(null);
    setSendingCaptcha(true);
    try {
      await neteaseApi.sendCaptcha(normalizedPhone);
      if (!isMountedReference.current) return;
      // 只有服务确认发送成功才启动本地 60 秒冷却；服务端仍可能施加额外频率限制。
      setCooldownSeconds(60);
    } catch (error) {
      if (isMountedReference.current) setErrorMessage(getErrorMessage(error));
    } finally {
      if (isMountedReference.current) setSendingCaptcha(false);
    }
  }, [cooldownSeconds, phone, requireConsent, sendingCaptcha]);

  const loginWithCaptcha = useCallback(async () => {
    const normalizedPhone = phone.trim();
    const normalizedCaptcha = captcha.trim();
    const phoneError = validatePhoneNumber(normalizedPhone);
    if (phoneError) {
      setErrorMessage(phoneError);
      return;
    }
    if (!normalizedCaptcha) {
      setErrorMessage('请输入短信验证码');
      return;
    }
    if (!requireConsent() || loggingIn) return;
    Keyboard.dismiss();
    setErrorMessage(null);
    setLoggingIn(true);
    try {
      const session = await neteaseApi.loginWithCaptcha(normalizedPhone, normalizedCaptcha);
      if (!isMountedReference.current) return;
      await useAccountStore.getState().setSession(session.cookie, session.profile);
      if (!isMountedReference.current) return;
      router.replace('/(tabs)/mine');
    } catch (error) {
      if (isMountedReference.current) setErrorMessage(getErrorMessage(error));
    } finally {
      if (isMountedReference.current) setLoggingIn(false);
    }
  }, [captcha, loggingIn, phone, requireConsent]);

  const refreshQrCode = useCallback(() => {
    setErrorMessage(null);
    setQrRefreshToken((token) => token + 1);
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <PageHeader title="登录云听" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <ApiConfigurationNotice />
        <View style={styles.intro}>
          <View style={styles.logo}>
            <Ionicons name="headset-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>登录后，音乐更懂你</Text>
          <Text style={styles.subtitle}>同步喜欢的音乐与个人歌单</Text>
        </View>
        <View style={styles.modeTabs}>
          <Pressable
            style={[styles.modeTab, loginMode === 'phone' && styles.activeModeTab]}
            onPress={() => {
              setLoginMode('phone');
              setErrorMessage(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: loginMode === 'phone' }}
          >
            <Text style={[styles.modeText, loginMode === 'phone' && styles.activeModeText]}>
              短信登录
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeTab, loginMode === 'qr' && styles.activeModeTab]}
            onPress={() => {
              setLoginMode('qr');
              setErrorMessage(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: loginMode === 'qr' }}
          >
            <Text style={[styles.modeText, loginMode === 'qr' && styles.activeModeText]}>
              扫码登录
            </Text>
          </Pressable>
        </View>
        {loginMode === 'phone' ? (
          <View style={styles.form}>
            <View style={styles.inputRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.secondary} />
              <TextInput
                value={phone}
                onChangeText={(value) => {
                  setPhone(value.replace(/\D/g, ''));
                  setErrorMessage(null);
                }}
                placeholder="手机号"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                maxLength={15}
                style={styles.input}
                accessibilityLabel="手机号"
              />
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="keypad-outline" size={20} color={colors.secondary} />
              <TextInput
                value={captcha}
                onChangeText={(value) => {
                  setCaptcha(value.replace(/\s/g, ''));
                  setErrorMessage(null);
                }}
                placeholder="短信验证码"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={8}
                style={styles.input}
                accessibilityLabel="短信验证码"
              />
              <Pressable
                disabled={sendingCaptcha || cooldownSeconds > 0}
                onPress={() => void sendCaptcha()}
                style={styles.sendButton}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.sendText,
                    (sendingCaptcha || cooldownSeconds > 0) && styles.disabledText,
                  ]}
                >
                  {sendingCaptcha
                    ? '发送中'
                    : cooldownSeconds > 0
                      ? `${cooldownSeconds}s 后重发`
                      : '获取验证码'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.consent}
              onPress={() => {
                setConsentGiven((value) => !value);
                setErrorMessage(null);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentGiven }}
            >
              <Ionicons
                name={consentGiven ? 'checkbox' : 'square-outline'}
                size={19}
                color={consentGiven ? colors.primary : colors.muted}
              />
              <Text style={styles.consentText}>
                我已知晓这是非官方的个人学习客户端，不收集或保存密码，仅通过验证码完成登录。
              </Text>
            </Pressable>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={17} color={colors.primary} />
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              </View>
            ) : null}
            <Pressable
              disabled={loggingIn}
              style={[styles.primaryButton, loggingIn && styles.disabledButton]}
              onPress={() => void loginWithCaptcha()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{loggingIn ? '正在登录…' : '登录'}</Text>
            </Pressable>
            <Text style={styles.formHint}>
              验证码由服务端发送，错误信息会如实展示，不会模拟登录成功。
            </Text>
          </View>
        ) : (
          <View style={styles.qrSection}>
            <View style={styles.qrFrame}>
              {qrState.image ? (
                <Image
                  source={{ uri: qrState.image }}
                  contentFit="contain"
                  style={styles.qrImage}
                  accessibilityLabel="网易云音乐登录二维码"
                />
              ) : (
                <Ionicons name="qr-code-outline" size={82} color="#D3D3D3" />
              )}
              {qrState.status === 'expired' ? (
                <View style={styles.qrMask}>
                  <Text style={styles.qrMaskText}>二维码已过期</Text>
                  <Pressable
                    style={styles.qrRefreshButton}
                    onPress={refreshQrCode}
                    accessibilityRole="button"
                  >
                    <Text style={styles.qrRefreshText}>刷新二维码</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <Text style={styles.qrStatus}>
              {qrState.status === 'confirming'
                ? '已扫码，请确认'
                : qrState.status === 'confirmed'
                  ? '二维码已确认'
                  : qrState.status === 'expired'
                    ? '请刷新二维码'
                    : qrState.status === 'error'
                      ? '二维码暂不可用'
                      : '请使用网易云音乐 App 扫码'}
            </Text>
            <Text style={styles.qrMessage}>
              {qrState.message ?? '二维码仅在当前页面可见时轮询，离开页面会自动停止。'}
            </Text>
            {qrState.status === 'error' ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={refreshQrCode}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>重新获取二维码</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>隐私与安全</Text>
            <Text style={styles.noticeText}>
              云听不要求输入密码。登录凭据只交给已配置的服务地址处理，具体服务能力请以接口响应为准。
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 40 },
  intro: { alignItems: 'center', paddingTop: 16, paddingBottom: 25 },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.secondary, fontSize: 12, marginTop: 8 },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    height: 45,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: 28,
  },
  modeTab: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeModeTab: { borderBottomColor: colors.primary },
  modeText: { color: colors.secondary, fontSize: 14 },
  activeModeText: { color: colors.primary, fontWeight: '600' },
  form: { marginHorizontal: 24, paddingTop: 25 },
  inputRow: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  input: { flex: 1, minHeight: 50, color: colors.text, fontSize: 14, paddingVertical: 0 },
  sendButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 9 },
  sendText: { color: colors.primary, fontSize: 12 },
  disabledText: { color: colors.muted },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 22, minHeight: 42 },
  consentText: { color: colors.secondary, fontSize: 11, lineHeight: 19, flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: colors.primarySoft,
    padding: 11,
    borderRadius: 7,
    marginTop: 14,
  },
  errorMessage: { color: colors.primary, fontSize: 12, lineHeight: 18, flex: 1 },
  primaryButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 23,
  },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  formHint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
  },
  qrSection: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 25 },
  qrFrame: {
    width: 220,
    height: 220,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrImage: { width: 190, height: 190 },
  qrMask: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFFE8',
    gap: 11,
  },
  qrMaskText: { color: colors.text, fontSize: 14 },
  qrRefreshButton: {
    paddingHorizontal: 17,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  qrRefreshText: { color: colors.white, fontSize: 12 },
  qrStatus: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 20 },
  qrMessage: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  qrWarning: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 7,
    padding: 11,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 17,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 12 },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 24,
    marginTop: 28,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  noticeCopy: { flex: 1, gap: 5 },
  noticeTitle: { color: colors.text, fontSize: 12, fontWeight: '600' },
  noticeText: { color: colors.secondary, fontSize: 11, lineHeight: 18 },
});
