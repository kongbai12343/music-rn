import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/styles/theme';

/**
 * 共用的音乐封面：size 指定方形尺寸，不传时须通过 style 提供容器尺寸。
 * 未提供 uri 时显示占位图标，不使用虚构封面替代真实图片。
 */
export function MusicCover({
  uri,
  size,
  radius = 8,
  style,
}: {
  uri?: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.container,
        size ? { width: size, height: size } : undefined,
        { borderRadius: radius },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <Ionicons
            name="musical-notes-outline"
            size={size ? size * 0.4 : 32}
            color={colors.muted}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: colors.canvas },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
