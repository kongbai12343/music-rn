export type PlaybackMode = 'sequential' | 'shuffle' | 'repeat-one';

/**
 * 计算下一首索引，null 表示停止；手动切歌不受单曲循环限制。
 * 顺序模式自动播放到队尾时停止，手动切到队尾之后则回到首曲。
 * randomValue 可传入固定随机值，便于确定性验证随机播放的边界行为。
 */
export function getNextQueueIndex(
  queueLength: number,
  currentIndex: number,
  mode: PlaybackMode,
  manual: boolean,
  randomValue = Math.random(),
): number | null {
  if (queueLength < 1) return null;
  if (mode === 'repeat-one' && !manual) return currentIndex;
  if (mode === 'shuffle' && queueLength > 1) {
    // 从排除当前曲的候选区间取随机值，再映射回原队列，保证不连续选中当前曲。
    const alternativeIndex = Math.floor(
      Math.min(0.999999, Math.max(0, randomValue)) * (queueLength - 1),
    );
    return alternativeIndex >= currentIndex ? alternativeIndex + 1 : alternativeIndex;
  }
  const nextIndex = currentIndex + 1;
  if (nextIndex < queueLength) return nextIndex;
  return manual ? 0 : null;
}
