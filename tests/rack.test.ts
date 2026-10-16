import { describe, expect, it } from 'vitest';
import { findBestMelds } from '../src/engine/bot.ts';
import { dealRound, type Rng } from '../src/engine/game.ts';
import { arrange, RACK_COLS, RACK_SLOTS } from '../src/web/rack.ts';

function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  let n = 0;
  return {
    randInt: (k) => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return Math.floor((s / 2 ** 32) * k);
    },
    id: () => `t${++n}`,
  };
}

describe('ıstaka dizme', () => {
  const hands = Array.from({ length: 60 }, (_, i) => {
    const r = dealRound(1, i % 4, seededRng(i + 1));
    return { hand: r.hands[(i % 4 + 1) % 4], okey: r.okey }; // 22 taşlı el
  });

  for (const mode of ['smart', 'color', 'pairs'] as const) {
    it(`${mode}: tüm taşlar tam bir kez, 26 yuva`, () => {
      for (const { hand, okey } of hands) {
        const slots = arrange(hand, okey, mode);
        expect(slots).toHaveLength(RACK_SLOTS);
        const ids = slots.filter(Boolean);
        expect(ids.sort()).toEqual(hand.map((t) => t.id).sort());
      }
    });
  }

  it('akıllı dizmede perler bitişik durur ve iki sıraya bölünmez', () => {
    for (const { hand, okey } of hands) {
      const slots = arrange(hand, okey, 'smart');
      for (const m of findBestMelds(hand, okey).melds) {
        const pos = m.tileIds.map((id) => slots.indexOf(id)).sort((a, b) => a - b);
        expect(pos[pos.length - 1] - pos[0]).toBe(pos.length - 1); // bitişik
        expect(Math.floor(pos[0] / RACK_COLS)).toBe(Math.floor(pos[pos.length - 1] / RACK_COLS)); // aynı sıra
      }
    }
  });

  it('boş yer varsa per ile sonraki grup arasında boşluk bırakılır', () => {
    let gapsAfterMelds = 0;
    for (const { hand, okey } of hands) {
      const slots = arrange(hand, okey, 'smart');
      for (const m of findBestMelds(hand, okey).melds) {
        const last = Math.max(...m.tileIds.map((id) => slots.indexOf(id)));
        if ((last + 1) % RACK_COLS !== 0 && slots[last + 1] === null) gapsAfterMelds++;
      }
    }
    expect(gapsAfterMelds).toBeGreaterThan(0);
  });
});
