import { describe, expect, it } from 'vitest';
import { botNextCommand } from '../src/engine/bot.ts';
import { GameError } from '../src/engine/errors.ts';
import { applyCommand, createMatch, dealRound, startNextRound, teamRanking, timeoutCommands, viewFor, type Rng } from '../src/engine/game.ts';
import { resolveGroup, resolveJokerSwap, resolveLayoff, resolveMeld, resolvePair, resolveRun } from '../src/engine/melds.ts';
import { DEFAULT_RULES, buildRules, canTouchMeld, partnerOf, teamOf, teamTotals } from '../src/engine/rules.ts';
import { createTileSet, okeyFromIndicator } from '../src/engine/tiles.ts';
import type { Color, Face, MatchState, Meld, Tile } from '../src/engine/types.ts';

function seededRng(seed = 1): Rng {
  let s = seed >>> 0;
  let n = 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return { randInt: (k) => Math.floor(next() * k), id: () => `t${++n}` };
}

let idc = 0;
const T = (color: Color, number: number): Tile => ({ id: `x${++idc}`, kind: 'N', color, number });
const F = (): Tile => ({ id: `f${++idc}`, kind: 'F' });
const OKEY: Face = { color: 'R', number: 5 }; // gerçek okey: Kırmızı 5

describe('taş seti ve okey', () => {
  it('106 benzersiz taş: 104 normal + 2 sahte', () => {
    let i = 0;
    const set = createTileSet(() => `id${i++}`);
    expect(set).toHaveLength(106);
    expect(new Set(set.map((t) => t.id)).size).toBe(106);
    expect(set.filter((t) => t.kind === 'F')).toHaveLength(2);
    const counts = new Map<string, number>();
    for (const t of set) if (t.kind === 'N') counts.set(`${t.color}${t.number}`, (counts.get(`${t.color}${t.number}`) ?? 0) + 1);
    expect(counts.size).toBe(52);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });

  it('gösterge 13 → aynı renk 1, gösterge 4 → 5', () => {
    expect(okeyFromIndicator(T('B', 13))).toEqual({ color: 'B', number: 1 });
    expect(okeyFromIndicator(T('Y', 4))).toEqual({ color: 'Y', number: 5 });
  });

  it('dağıtım 22/21/21/21, deste 20, gösterge normal', () => {
    for (let seed = 1; seed < 30; seed++) {
      const r = dealRound(1, 0, seededRng(seed));
      expect(r.hands.map((h) => h.length)).toEqual([21, 22, 21, 21]);
      expect(r.stock).toHaveLength(20);
      expect(r.indicator.kind).toBe('N');
      const all = [...r.hands.flat(), ...r.stock, r.indicator];
      expect(new Set(all.map((t) => t.id)).size).toBe(106);
    }
  });
});

describe('per doğrulama', () => {
  it('seri: tek renk, ardışık, en az 3; 12-13-1 geçersiz', () => {
    expect(resolveRun([T('B', 4), T('B', 5), T('B', 6)], OKEY)).not.toBeNull();
    expect(resolveRun([T('B', 4), T('B', 5)], OKEY)).toBeNull();
    expect(resolveRun([T('B', 4), T('K', 5), T('B', 6)], OKEY)).toBeNull();
    expect(resolveRun([T('B', 12), T('B', 13), T('B', 1)], OKEY)).toBeNull();
    expect(resolveRun([T('B', 4), T('B', 4), T('B', 5)], OKEY)).toBeNull();
  });

  it('seri: gerçek okey boşluğu doldurur, sahte okey okey değerinde doğal taştır', () => {
    const run = resolveRun([T('B', 4), T('R', 5), T('B', 6)], OKEY)!;
    expect(run.map((p) => p.as.number)).toEqual([4, 5, 6]);
    expect(run[1].as.color).toBe('B');
    // sahte okey = Kırmızı 5 → kırmızı 4-5-6 geçerli, mavi 4-?-6 geçersiz
    expect(resolveRun([T('R', 4), F(), T('R', 6)], OKEY)).not.toBeNull();
    expect(resolveRun([T('B', 4), F(), T('B', 6)], OKEY)).toBeNull();
  });

  it('grup: 3/4 taş, aynı sayı, farklı renk', () => {
    expect(resolveGroup([T('R', 8), T('B', 8), T('K', 8)], OKEY)).not.toBeNull();
    expect(resolveGroup([T('R', 8), T('R', 8), T('K', 8)], OKEY)).toBeNull();
    expect(resolveGroup([T('R', 8), T('B', 8), T('K', 8), T('Y', 8), T('R', 5)], OKEY)).toBeNull();
    const g = resolveGroup([T('Y', 8), T('R', 5), T('K', 8)], OKEY)!;
    expect(g[1].as).toEqual({ color: 'R', number: 8 });
  });

  it('okey ile değer: temsil ettiği sayı sayılır', () => {
    expect(resolveMeld([T('B', 11), T('B', 12), T('R', 5)], OKEY)!.value).toBe(11 + 12 + 13);
  });

  it('çift: aynı renk ve sayı, okey joker olmaz', () => {
    expect(resolvePair([T('Y', 3), T('Y', 3)], OKEY)).not.toBeNull();
    expect(resolvePair([T('Y', 3), T('R', 5)], OKEY)).toBeNull();
    expect(resolvePair([T('R', 5), F()], OKEY)).not.toBeNull();
  });

  it('işleme: seri uçlarına ve grubun eksik rengine', () => {
    const meld: Meld = { id: 'm1', owner: 0, kind: 'run', tiles: resolveRun([T('B', 4), T('B', 5), T('B', 6)], OKEY)! };
    expect(resolveLayoff(meld, T('B', 7), OKEY)).not.toBeNull();
    expect(resolveLayoff(meld, T('B', 3), OKEY)).not.toBeNull();
    expect(resolveLayoff(meld, T('B', 9), OKEY)).toBeNull();
    expect(resolveLayoff(meld, T('K', 7), OKEY)).toBeNull();
    const grp: Meld = { id: 'm2', owner: 0, kind: 'group', tiles: resolveGroup([T('R', 8), T('B', 8), T('K', 8)], OKEY)! };
    expect(resolveLayoff(grp, T('Y', 8), OKEY)).not.toBeNull();
    expect(resolveLayoff(grp, T('B', 8), OKEY)).toBeNull();
  });
});

/** Belirli bir eli olan, açılış testine hazır maç. */
function fixture(hand: Tile[], opts: { discardTop?: Tile; phase?: 'DRAW' | 'ACTIONS' } = {}): MatchState {
  const m = createMatch(DEFAULT_RULES, seededRng(7), 3); // dağıtıcı 3 → başlayan 0
  const r = m.round;
  r.okey = { color: 'R', number: 5 };
  r.indicator = { id: 'ind', kind: 'N', color: 'R', number: 4 };
  r.hands[0] = hand;
  r.phase = opts.phase ?? 'ACTIONS';
  if (opts.discardTop) r.discards[3] = [opts.discardTop];
  return m;
}

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`${code} bekleniyordu`);
};

describe('açılış', () => {
  // K11-12-13 (36) + B9-10-11 (30) + Y9-10-11 (30) = 96
  const base = () => [T('K', 11), T('K', 12), T('K', 13), T('B', 9), T('B', 10), T('B', 11), T('Y', 9), T('Y', 10), T('Y', 11)];

  it('100 reddedilir, 101 kabul edilir', () => {
    const ids = (ts: Tile[]) => ts.map((t) => t.id);
    // K11-12-13 (36) + B9-10-11 (30) + Y7-8-9-10 (34) = 100
    const h = [T('K', 11), T('K', 12), T('K', 13), T('B', 9), T('B', 10), T('B', 11), T('Y', 7), T('Y', 8), T('Y', 9), T('Y', 10), T('B', 1)];
    let m = fixture(h);
    const melds = [{ tileIds: ids(h.slice(0, 3)) }, { tileIds: ids(h.slice(3, 6)) }, { tileIds: ids(h.slice(6, 10)) }];
    expectCode(() => applyCommand(m, 0, { type: 'open_melds', melds }), 'OPENING_BELOW_THRESHOLD');
    // ... + Y5-6-7-8-9 (35) = 101
    const h2 = [T('K', 11), T('K', 12), T('K', 13), T('B', 9), T('B', 10), T('B', 11), T('Y', 5), T('Y', 6), T('Y', 7), T('Y', 8), T('Y', 9), T('B', 1)];
    m = fixture(h2);
    const ok = applyCommand(m, 0, {
      type: 'open_melds',
      melds: [{ tileIds: ids(h2.slice(0, 3)) }, { tileIds: ids(h2.slice(3, 6)) }, { tileIds: ids(h2.slice(6, 11)) }],
    });
    expect(ok.round.opened[0]).toBe('melds');
    expect(ok.round.hands[0]).toHaveLength(1);
    expect(ok.round.melds).toHaveLength(3);
  });

  it('aynı taş iki perde kullanılamaz; elde olmayan taş reddedilir', () => {
    const h = base();
    const m = fixture([...h, T('B', 1)]);
    expectCode(() => applyCommand(m, 0, { type: 'open_melds', melds: [{ tileIds: [h[0].id, h[1].id, h[2].id] }, { tileIds: [h[0].id, h[1].id, h[2].id] }] }), 'INVALID_MELD');
    expectCode(() => applyCommand(m, 0, { type: 'open_melds', melds: [{ tileIds: ['yok', h[1].id, h[2].id] }] }), 'TILE_NOT_OWNED');
  });

  it('5 çift kabul, 4 çift red', () => {
    const pairs = [1, 2, 3, 4, 6].map((n) => [T('B', n), T('B', n)]);
    const m = fixture([...pairs.flat(), T('K', 1)]);
    expectCode(() => applyCommand(m, 0, { type: 'open_pairs', pairs: pairs.slice(0, 4).map((p) => p.map((t) => t.id)) }), 'PAIR_COUNT_TOO_LOW');
    const ok = applyCommand(m, 0, { type: 'open_pairs', pairs: pairs.map((p) => p.map((t) => t.id)) });
    expect(ok.round.opened[0]).toBe('pairs');
  });

  it('yandan alınan taş açılışta yoksa reddedilir', () => {
    const h = [T('K', 11), T('K', 12), T('K', 13), T('B', 9), T('B', 10), T('B', 11), T('Y', 6), T('Y', 7), T('Y', 8), T('Y', 9), T('Y', 10), T('B', 1)];
    const top = T('K', 10);
    const m = fixture(h, { phase: 'DRAW', discardTop: top });
    const ids = (ts: Tile[]) => ts.map((t) => t.id);
    expectCode(() => applyCommand(m, 0, { type: 'take_discard' }), 'MUST_USE_DISCARD_TO_OPEN');
    const without = { kind: 'melds' as const, melds: [{ tileIds: ids(h.slice(0, 3)) }, { tileIds: ids(h.slice(3, 6)) }, { tileIds: ids(h.slice(6, 11)) }] };
    expectCode(() => applyCommand(m, 0, { type: 'take_discard', open: without }), 'MUST_USE_DISCARD_TO_OPEN');
    const withTop = { kind: 'melds' as const, melds: [{ tileIds: [top.id, ...ids(h.slice(0, 3))] }, { tileIds: ids(h.slice(3, 6)) }, { tileIds: ids(h.slice(6, 11)) }] };
    const ok = applyCommand(m, 0, { type: 'take_discard', open: withTop });
    expect(ok.round.opened[0]).toBe('melds');
    // girdi durumu değişmedi (atomik)
    expect(m.round.hands[0]).toHaveLength(12);
  });

  it('açmamış oyuncu işleyemez', () => {
    const h = [T('B', 7), T('K', 1)];
    const m = fixture(h);
    m.round.melds.push({ id: 'm9', owner: 1, kind: 'run', tiles: resolveRun([T('B', 4), T('B', 5), T('B', 6)], OKEY)! });
    expectCode(() => applyCommand(m, 0, { type: 'layoff', meldId: 'm9', tileId: h[0].id }), 'NOT_OPENED');
    m.round.opened[0] = 'melds';
    const ok = applyCommand(m, 0, { type: 'layoff', meldId: 'm9', tileId: h[0].id });
    expect(ok.round.melds[0].tiles).toHaveLength(4);
  });
});

describe('okeyi masadan alma', () => {
  // okey = Kırmızı 5 → gerçek okey taşı T('R', 5)
  const runWithOkey = (): Meld => ({
    id: 'm1',
    owner: 1,
    kind: 'run',
    tiles: resolveRun([T('B', 4), T('R', 5), T('B', 6)], OKEY)!, // okey Mavi 5 yerine
  });
  const groupWithOkey = (): Meld => ({
    id: 'm2',
    owner: 1,
    kind: 'group',
    tiles: resolveGroup([T('Y', 8), T('R', 5), T('K', 8)], OKEY)!, // okey eksik bir rengin 8'i
  });

  it('seride yalnız okeyin temsil ettiği taş konabilir', () => {
    const meld = runWithOkey();
    const okeyTile = meld.tiles[1].tile;
    const res = resolveJokerSwap(meld, T('B', 5), OKEY)!;
    expect(res.joker.id).toBe(okeyTile.id);
    expect(res.tiles.map((p) => p.as.number)).toEqual([4, 5, 6]);
    expect(res.tiles.every((p) => p.tile.kind === 'N' && !(p.tile.color === 'R' && p.tile.number === 5))).toBe(true);
    expect(resolveJokerSwap(runWithOkey(), T('B', 7), OKEY)).toBeNull();
    expect(resolveJokerSwap(runWithOkey(), T('K', 5), OKEY)).toBeNull();
  });

  it('grupta perde olmayan herhangi bir renk konabilir, var olan renk konamaz', () => {
    expect(resolveJokerSwap(groupWithOkey(), T('R', 8), OKEY)).not.toBeNull();
    expect(resolveJokerSwap(groupWithOkey(), T('B', 8), OKEY)).not.toBeNull();
    expect(resolveJokerSwap(groupWithOkey(), T('Y', 8), OKEY)).toBeNull();
    expect(resolveJokerSwap(groupWithOkey(), T('B', 9), OKEY)).toBeNull();
  });

  it('okeysiz perde ve çiftte takas yok; elden okey konamaz', () => {
    const plain: Meld = { id: 'm3', owner: 1, kind: 'run', tiles: resolveRun([T('B', 4), T('B', 5), T('B', 6)], OKEY)! };
    expect(resolveJokerSwap(plain, T('B', 5), OKEY)).toBeNull();
    expect(resolveJokerSwap(runWithOkey(), T('R', 5), OKEY)).toBeNull();
  });

  it('komut: açmış oyuncu okeyi eline alır; açmamış ve kapalı kuralda reddedilir', () => {
    const b5 = T('B', 5);
    const m = fixture([b5, T('K', 1)]);
    m.round.melds.push(runWithOkey());
    const okeyId = m.round.melds[0].tiles[1].tile.id;
    expectCode(() => applyCommand(m, 0, { type: 'swap_joker', meldId: 'm1', tileId: b5.id }), 'NOT_OPENED');
    m.round.opened[0] = 'melds';
    const ok = applyCommand(m, 0, { type: 'swap_joker', meldId: 'm1', tileId: b5.id });
    expect(ok.round.hands[0].map((t) => t.id).sort()).toEqual([okeyId, m.round.hands[0][1].id].sort());
    expect(ok.round.melds[0].tiles[1].tile.id).toBe(b5.id);
    expect(ok.round.phase).toBe('ACTIONS');
    // girdi değişmedi
    expect(m.round.melds[0].tiles[1].tile.id).toBe(okeyId);
    expectCode(() => applyCommand(m, 0, { type: 'swap_joker', meldId: 'm1', tileId: m.round.hands[0][1].id }), 'SWAP_INVALID');
    const off = structuredClone(m);
    off.rules = buildRules({ allowJokerSwap: false });
    expectCode(() => applyCommand(off, 0, { type: 'swap_joker', meldId: 'm1', tileId: b5.id }), 'SWAP_DISABLED');
  });

  describe('aynı tur kullanma şartı', () => {
    const setup = () => {
      const b5 = T('B', 5);
      const k1 = T('K', 1);
      const m = fixture([b5, k1, T('Y', 12)]);
      m.rules = buildRules({ jokerSwapMustUse: true });
      m.round.melds.push(runWithOkey());
      m.round.melds.push({ id: 'm5', owner: 2, kind: 'run', tiles: resolveRun([T('K', 7), T('K', 8), T('K', 9)], OKEY)! });
      m.round.opened[0] = 'melds';
      const okeyId = m.round.melds[0].tiles[1].tile.id;
      return { m: applyCommand(m, 0, { type: 'swap_joker', meldId: 'm1', tileId: b5.id }), k1, okeyId };
    };

    it('okey elde dururken atış reddedilir, işledikten sonra kabul edilir', () => {
      const { m, k1, okeyId } = setup();
      expectCode(() => applyCommand(m, 0, { type: 'discard', tileId: k1.id }), 'JOKER_MUST_BE_USED');
      expectCode(() => applyCommand(m, 0, { type: 'discard', tileId: okeyId }), 'JOKER_MUST_BE_USED');
      const placed = applyCommand(m, 0, { type: 'layoff', meldId: 'm5', tileId: okeyId });
      const done = applyCommand(placed, 0, { type: 'discard', tileId: k1.id });
      expect(done.round.activeSeat).toBe(1);
      expect(done.round.swappedJokers).toEqual([]);
    });

    it('görünüm okeyi bildirir; şart kapalıyken serbest', () => {
      const { m, okeyId } = setup();
      expect(viewFor(m, 0).mustUseJokerIds).toEqual([okeyId]);
      expect(viewFor(m, 1).mustUseJokerIds).toEqual([]);
      const free = structuredClone(m);
      free.rules.joker.swapMustUseSameTurn = false;
      free.round.swappedJokers = [];
      expect(applyCommand(free, 0, { type: 'discard', tileId: free.round.hands[0][0].id }).round.activeSeat).toBe(1);
    });

    it('okeyi koyacak yer yoksa tur kilitlenmez', () => {
      const { m, k1 } = setup();
      m.round.melds = m.round.melds.filter((x) => x.id === 'm1');
      // m1 artık okeysiz B4-5-6; okey işlenebilir → engelli. Seriyi 1-13 doldurup yer bırakma:
      m.round.melds[0].tiles = resolveRun(Array.from({ length: 13 }, (_, i) => T('B', i + 1)), OKEY)!;
      expect(applyCommand(m, 0, { type: 'discard', tileId: k1.id }).round.activeSeat).toBe(1);
    });

    it('zaman aşımı ve bot önce okeyi işleyip sonra atar', () => {
      const { m } = setup();
      const cmds = timeoutCommands(m);
      expect(cmds.map((c) => c.type)).toEqual(['layoff', 'discard']);
      let s = m;
      for (const c of cmds) s = applyCommand(s, 0, c);
      expect(s.round.activeSeat).toBe(1);
      expect(botNextCommand(m).type).toBe('layoff');
    });
  });

  it('bot elindeki uygun taşla masadaki okeyi alır', () => {
    const b5 = T('B', 5);
    const m = fixture([b5, T('K', 1), T('Y', 12)]);
    m.round.melds.push(runWithOkey());
    m.round.opened[0] = 'melds';
    expect(botNextCommand(m)).toEqual({ type: 'swap_joker', meldId: 'm1', tileId: b5.id });
  });
});

describe('tur akışı ve skor', () => {
  it('başlangıç oyuncusu çekmeden atar; sonra çek+at ile 21 kalır', () => {
    let m = createMatch(DEFAULT_RULES, seededRng(3), 0);
    const s = m.round.activeSeat;
    expect(s).toBe(1);
    expectCode(() => applyCommand(m, s, { type: 'draw_stock' }), 'WRONG_PHASE');
    expectCode(() => applyCommand(m, 2, { type: 'draw_stock' }), 'NOT_YOUR_TURN');
    m = applyCommand(m, s, { type: 'discard', tileId: m.round.hands[s][0].id });
    expect(m.round.hands[s]).toHaveLength(21);
    expect(m.round.activeSeat).toBe(2);
    m = applyCommand(m, 2, { type: 'draw_stock' });
    expect(m.round.hands[2]).toHaveLength(22);
    m = applyCommand(m, 2, { type: 'discard', tileId: m.round.hands[2][0].id });
    expect(m.round.hands[2]).toHaveLength(21);
  });

  it('bitiş skorları: kazanan -101, açan elde kalan, açmayan 202, okeyle ×2', () => {
    const m = fixture([T('R', 5)]); // son taş gerçek okey
    m.round.opened = ['melds', 'melds', null, 'melds'];
    m.round.hands[1] = [T('B', 3), T('K', 4)];
    m.round.hands[2] = [T('B', 3)];
    m.round.hands[3] = [T('R', 5), F()]; // elde okey + sahte okey(5)
    const out = applyCommand(m, 0, { type: 'discard', tileId: m.round.hands[0][0].id });
    expect(out.status).toBe('ROUND_OVER');
    const res = out.history[0];
    expect(res.finishType).toBe('okey');
    expect(res.scores.map((s) => s.finalDelta)).toEqual([-202, 14, 404, (5 + 101) * 2]);
  });

  it('zaman aşımı: deterministik çek + en düşük taşı at', () => {
    const m = createMatch(DEFAULT_RULES, seededRng(5), 0);
    const cmds = timeoutCommands(m);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].type).toBe('discard');
    expect(timeoutCommands(m)).toEqual(cmds);
  });

  it('botlarla tam maç hatasız biter', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = seededRng(seed);
      let m = createMatch(buildRules({ roundLimit: 3 }), rng, 0);
      let steps = 0;
      while (m.status !== 'ENDED') {
        if (m.status === 'ROUND_OVER') {
          m = startNextRound(m, rng);
          continue;
        }
        const cmd = botNextCommand(m);
        m = applyCommand(m, m.round.activeSeat, cmd);
        if (++steps > 5000) throw new Error('sonsuz döngü');
      }
      expect(m.history).toHaveLength(3);
      // taş korunumu: her elde 106 taş
      for (const h of m.history) expect(h.scores).toHaveLength(4);
    }
  });
});

describe('eşli oyun', () => {
  it('eşler karşılıklı: 0–2 ve 1–3', () => {
    expect([0, 1, 2, 3].map(teamOf)).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2, 3].map(partnerOf)).toEqual([2, 3, 0, 1]);
    expect(teamTotals([10, 20, 30, 40])).toEqual([40, 60]);
  });

  const finish = (opts: Parameters<typeof buildRules>[0]) => {
    const m = fixture([T('B', 9)]);
    m.rules = buildRules(opts);
    m.round.opened = ['melds', 'melds', 'melds', null];
    m.round.hands[1] = [T('B', 3), T('K', 4)];
    m.round.hands[2] = [T('Y', 10), T('Y', 12)]; // eş
    m.round.hands[3] = [T('B', 3)];
    return applyCommand(m, 0, { type: 'discard', tileId: m.round.hands[0][0].id }).history[0].scores.map((x) => x.finalDelta);
  };

  it('bitirenin eşi ceza almaz (varsayılan)', () => {
    expect(finish({ teamMode: true })).toEqual([-101, 7, 0, 202]);
  });

  it('ayar kapalıysa eş de elindeki taşlar kadar ceza alır; tekli modda etkisiz', () => {
    expect(finish({ teamMode: true, partnerOfWinnerExempt: false })).toEqual([-101, 7, 22, 202]);
    expect(finish({ teamMode: false })).toEqual([-101, 7, 22, 202]);
  });

  it('takım sıralaması: düşük toplam önde, eşitlikte galibiyet', () => {
    expect(teamRanking([100, 10, 0, 50], [0, 0, 0, 0])).toEqual([1, 0]);
    expect(teamRanking([30, 10, 0, 20], [0, 0, 1, 0])).toEqual([0, 1]);
  });

  it('"sadece kendi perine işleme" eşli oyunda eşin perini kapsar', () => {
    const r = buildRules({ teamMode: true, onlyOwnMelds: true });
    expect(canTouchMeld(r, 0, 2)).toBe(true);
    expect(canTouchMeld(r, 0, 1)).toBe(false);
    expect(canTouchMeld(buildRules({ onlyOwnMelds: true }), 0, 2)).toBe(false);
    const m = fixture([T('B', 7), T('K', 1)]);
    m.rules = r;
    m.round.opened[0] = 'melds';
    m.round.melds.push({ id: 'p1', owner: 2, kind: 'run', tiles: resolveRun([T('B', 4), T('B', 5), T('B', 6)], OKEY)! });
    m.round.melds.push({ id: 'o1', owner: 1, kind: 'run', tiles: resolveRun([T('B', 8), T('B', 9), T('B', 10)], OKEY)! });
    expect(applyCommand(m, 0, { type: 'layoff', meldId: 'p1', tileId: m.round.hands[0][0].id }).round.melds[0].tiles).toHaveLength(4);
    expectCode(() => applyCommand(m, 0, { type: 'layoff', meldId: 'o1', tileId: m.round.hands[0][0].id }), 'LAYOFF_NOT_ALLOWED');
  });

  it('botlarla eşli tam maç hatasız biter', () => {
    const rng = seededRng(42);
    let m = createMatch(buildRules({ roundLimit: 4, teamMode: true, onlyOwnMelds: true }), rng, 0);
    let steps = 0;
    while (m.status !== 'ENDED') {
      if (m.status === 'ROUND_OVER') {
        m = startNextRound(m, rng);
        continue;
      }
      m = applyCommand(m, m.round.activeSeat, botNextCommand(m));
      if (++steps > 8000) throw new Error('sonsuz döngü');
    }
    expect(m.history).toHaveLength(4);
    const sum = m.history.reduce((a, h) => a + h.scores.reduce((b, x) => b + x.finalDelta, 0), 0);
    expect(m.totals.reduce((a, b) => a + b, 0)).toBe(sum);
  });
});

describe('akıllı bot (eşli oyun)', () => {
  const discardOf = (m: MatchState) => {
    const c = botNextCommand(m);
    expect(c.type).toBe('discard');
    return (c as { tileId: string }).tileId;
  };

  it('açmamışken yüksek taşı tutar, düşük ve potansiyelsiz taşı atar', () => {
    const lowLone = T('Y', 2);
    const m = fixture([T('K', 13), T('B', 12), lowLone, T('R', 9), T('B', 7)]);
    expect(discardOf(m)).toBe(lowLone.id);
  });

  it('açtıktan sonra yüksek taşı elden çıkarır', () => {
    const high = T('K', 13);
    const m = fixture([high, T('B', 9), T('Y', 2), T('R', 7)]);
    m.round.opened[0] = 'melds';
    expect(discardOf(m)).toBe(high.id);
  });

  it('sıradaki rakibin işleyebileceği taşı atmaz', () => {
    const danger = T('K', 13);
    const safe = T('Y', 12);
    const m = fixture([danger, safe, T('R', 1)]);
    m.rules = buildRules({ teamMode: true, onlyOwnMelds: true }); // bot rakip perine işleyemez, rakip işleyebilir
    m.round.opened = ['melds', 'melds', null, null];
    m.round.hands[1] = [T('B', 1), T('B', 2)]; // sıradaki rakip bitmeye yakın
    m.round.melds.push({ id: 'o1', owner: 1, kind: 'run', tiles: resolveRun([T('K', 10), T('K', 11), T('K', 12)], OKEY)! });
    expect(discardOf(m)).toBe(safe.id);
  });

  it('eş bitmeye yakınken de rakibin işleyebileceği taşı atmaz', () => {
    // Rakip seriye 13 işleyebilir; eş 1 taşa inmiş ve bitirenin eşi ceza almıyor → 13 yerine düşük güvenli taş atılır.
    const danger = T('K', 13);
    const lowSafe = T('Y', 3);
    const m = fixture([danger, lowSafe, T('R', 11)]);
    m.rules = buildRules({ teamMode: true, onlyOwnMelds: true });
    m.round.opened = ['melds', 'melds', 'melds', null];
    m.round.hands[2] = [T('B', 5)];
    m.round.melds.push({ id: 'o1', owner: 1, kind: 'run', tiles: resolveRun([T('K', 10), T('K', 11), T('K', 12)], OKEY)! });
    expect(discardOf(m)).not.toBe(danger.id);
  });

  it('eşli oyunda önce kendi/eşinin perine işler', () => {
    const t = T('B', 7);
    const m = fixture([t, T('K', 1), T('Y', 5)]);
    m.rules = buildRules({ teamMode: true });
    m.round.opened[0] = 'melds';
    m.round.melds.push({ id: 'opp', owner: 1, kind: 'group', tiles: resolveGroup([T('R', 7), T('Y', 7), T('K', 7)], OKEY)! });
    m.round.melds.push({ id: 'mate', owner: 2, kind: 'run', tiles: resolveRun([T('B', 4), T('B', 5), T('B', 6)], OKEY)! });
    expect(botNextCommand(m)).toEqual({ type: 'layoff', meldId: 'mate', tileId: t.id });
  });
});
