import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: '云听',
  slug: 'cloud-listening',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'cloud-listening',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.cloudlistening.music',
  },
  android: {
    package: 'com.cloudlistening.music',
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
  },
  web: { bundler: 'metro', output: 'single', name: '云听' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-audio',
      {
        // 后台播放需要原生构建支持；客户端不录音，不能因此申请麦克风权限。
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
        recordAudioAndroid: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-build-properties',
      // 局域网开发允许 HTTP，production 构建关闭明文访问，正式服务应使用 HTTPS。
      { android: { usesCleartextTraffic: process.env.EAS_BUILD_PROFILE !== 'production' } },
    ],
  ],
  experiments: { typedRoutes: true },
};

export default config;
