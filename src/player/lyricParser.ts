export interface LyricLine {
  /** 歌词开始时间，单位为秒，与播放器的播放进度保持一致。 */
  time: number;
  text: string;
}

/**
 * 将一行中的多个 LRC 时间标签分别展开，应用毫秒偏移后按时间排序。
 * 无时间标签的元数据不生成歌词行；偏移后的负时间按 0 秒处理。
 */
export function parseLyrics(source: string): LyricLine[] {
  const offsetMilliseconds = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0);
  const lyricLines: LyricLine[] = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const text = rawLine.replace(/\[[^\]]*\]/g, '').trim();
    for (const timestamp of timestamps) {
      const seconds = Number(timestamp[2]);
      if (seconds >= 60) continue;
      // 小数是秒的小数部分：.5 表示 500 毫秒，.05 表示 50 毫秒，需在右侧补零。
      const fractionalMilliseconds = Number((timestamp[3] ?? '').padEnd(3, '0'));
      const timestampMilliseconds =
        (Number(timestamp[1]) * 60 + seconds) * 1000 + fractionalMilliseconds + offsetMilliseconds;
      lyricLines.push({ time: Math.max(0, timestampMilliseconds) / 1000, text });
    }
  }
  return lyricLines.sort((firstLine, secondLine) => firstLine.time - secondLine.time);
}

/** 输入须按时间升序排列；二分查找不晚于当前进度的最后一行，首行前返回 -1。 */
export function findActiveLyricIndex(lines: LyricLine[], currentTime: number): number {
  let lowerBound = 0;
  let upperBound = lines.length - 1;
  let activeIndex = -1;
  while (lowerBound <= upperBound) {
    const middleIndex = Math.floor((lowerBound + upperBound) / 2);
    if (lines[middleIndex]!.time <= currentTime) {
      activeIndex = middleIndex;
      lowerBound = middleIndex + 1;
    } else {
      upperBound = middleIndex - 1;
    }
  }
  return activeIndex;
}
