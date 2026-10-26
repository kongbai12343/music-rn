import assert from 'node:assert/strict';
import test from 'node:test';
import { findActiveLyricIndex, parseLyrics } from '../src/player/lyricParser';
import { getNextQueueIndex } from '../src/player/playbackQueue';

test('LRC supports multiple timestamps, fractional seconds, metadata, CRLF and offset', () => {
  const lyrics = parseLyrics(
    '[ar:artist]\r\n[offset:-150]\r\n[00:05.25][01:02.005]同一行\r\n[00:02.5]先出现\r\n[00:66.00]非法时间',
  );
  assert.deepEqual(lyrics, [
    { time: 2.35, text: '先出现' },
    { time: 5.1, text: '同一行' },
    { time: 61.855, text: '同一行' },
  ]);
  assert.equal(findActiveLyricIndex(lyrics, 1), -1);
  assert.equal(findActiveLyricIndex(lyrics, 5.1), 1);
  assert.equal(findActiveLyricIndex(lyrics, 90), 2);
  assert.equal(findActiveLyricIndex([], 20), -1);
});

test('automatic sequential playback stops at the end instead of skipping indefinitely', () => {
  assert.equal(getNextQueueIndex(0, 0, 'sequential', false), null);
  assert.equal(getNextQueueIndex(3, 1, 'sequential', false), 2);
  assert.equal(getNextQueueIndex(3, 2, 'sequential', false), null);
  assert.equal(getNextQueueIndex(3, 2, 'sequential', true), 0);
});

test('repeat-one repeats automatically but still allows explicit next', () => {
  assert.equal(getNextQueueIndex(3, 1, 'repeat-one', false), 1);
  assert.equal(getNextQueueIndex(3, 1, 'repeat-one', true), 2);
});

test('shuffle never selects the current song when alternatives are available', () => {
  for (const currentIndex of [0, 1, 2, 3]) {
    for (const randomValue of [0, 0.2, 0.5, 0.99, 1]) {
      const nextIndex = getNextQueueIndex(4, currentIndex, 'shuffle', true, randomValue);
      assert.notEqual(nextIndex, currentIndex);
      assert.ok(nextIndex !== null && nextIndex >= 0 && nextIndex < 4);
    }
  }
});
