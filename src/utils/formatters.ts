/** 播放次数不足一万时保留原值，万级向下取整，亿级保留一位小数。 */
export function formatPlayCount(count: number): string {
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1)}亿`;
  if (count >= 10_000) return `${Math.floor(count / 10_000)}万`;
  return String(count);
}

/**
 * 将秒数显示为 分钟:两位秒数，分钟不拆分为小时。
 * 舍弃小数部分，负数、NaN 和无穷值按 0 秒处理，避免音频尚未加载时显示异常。
 */
export function formatTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

/** 提取 Error 的消息；其他抛出值使用统一提示，避免直接向用户展示未知数据。 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '暂时无法获取内容，请稍后重试';
}
