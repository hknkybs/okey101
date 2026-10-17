import { describe, expect, it } from 'vitest';
import { batakBotCommand } from '../src/batak/bot.ts';
import { createDeck } from '../src/batak/cards.ts';
import { BatakError } from '../src/batak/errors.ts';
import {
  actorOf,
  applyBatak,
  batakTimeoutCommand,
  batakViewFor,
  calculateBatakScore,
  createBatakMatch,
  legalCards,
  resolveTrick,
  startNextBatakRound,
} from '../src/batak/game.ts';
import { buildBatakRules } from '../src/batak/rules.ts';
import type { BatakMatch, Card, PlayedCard, Suit } from '../src/batak/types.ts';
import type { Rng } from '../src/shared/rng.ts';

function seededRng(seed = 1): Rng {
  let s = seed >>> 0;
  let n = 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return { randInt: (k) => Math.floor(next() * k), id: () => `c${++n}` };
}

let idc = 0;
const C = (suit: Suit, rank: number): Card => ({ id: `k${++idc}`, suit, rank });
const P = (seat: number, card: Card): PlayedCard => ({ seat, card });

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BatakError);
    expect((e as BatakError).code).toBe(code);
    return;
  }
  throw new Error(`${code} bekleniyordu`);
};

const IND = buildBatakRules();
const TEAM = buildBatakRules({ teamMode: true });

describe('süreler', () => {
  it('varsayılan kart süresi 60 sn, ihale 30 sn; 120 sn seçilebilir', () => {
    expect(IND.timers.playSeconds).toBe(60);
    expect(IND.timers.bidSeconds).toBe(30);
    const long = buildBatakRules({ turnSeconds: 120 });
    expect(long.timers.playSeconds).toBe(120);
    expect(long.timers.bidSeconds).toBe(60);
    expect(buildBatakRules({ turnSeconds: 15 }).timers.bidSeconds).toBe(20);
    expect(buildBatakRules({ turnSeconds: 500 }).timers.playSeconds).toBe(120);
  });
});

describe('deste ve dağıtım', () => {
  it('52 benzersiz kart, joker yok, her renk-değer bir kez', () => {
    let i = 0;
    const d = createDeck(() => `x${i++}`);
    expect(d).toHaveLength(52);
    expect(new Set(d.map((c) => `${c.suit}${c.rank}`)).size).toBe(52);
    expect(new Set(d.map((c) => c.id)).size).toBe(52);
  });

  it('4 oyuncuya 13’er kart; kayıp/çoğalma yok; ihale dağıtıcının solundan başlar', () => {
    const m = createBatakMatch(IND, seededRng(3), 2);
    expect(m.round.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(m.round.hands.flat().map((c) => `${c.suit}${c.rank}`)).size).toBe(52);
    expect(m.round.activeSeat).toBe(3);
    expect(m.round.phase).toBe('BIDDING');
  });
});

describe('ihale', () => {
  it('tekli minimum 5, eşli minimum 8; artış en az 1', () => {
    const m = createBatakMatch(IND, seededRng(1), 3); // ilk teklif koltuğu 0
    expectCode(() => applyBatak(m, 0, { type: 'bid', value: 4 }), 'INVALID_BID');
    let s = applyBatak(m, 0, { type: 'bid', value: 5 });
    expectCode(() => applyBatak(s, 1, { type: 'bid', value: 5 }), 'INVALID_BID');
    s = applyBatak(s, 1, { type: 'bid', value: 6 });
    expect(s.round.highBid).toBe(6);
    expect(s.round.bidder).toBe(1);
    const t = createBatakMatch(TEAM, seededRng(1), 3);
    expectCode(() => applyBatak(t, 0, { type: 'bid', value: 7 }), 'INVALID_BID');
    expect(applyBatak(t, 0, { type: 'bid', value: 8 }).round.highBid).toBe(8);
  });

  it('sıra dışı teklif reddedilir; pas geçen tekrar teklif veremez ve sıra onu atlar', () => {
    let s = createBatakMatch(IND, seededRng(1), 3);
    expectCode(() => applyBatak(s, 2, { type: 'pass' }), 'NOT_YOUR_TURN');
    s = applyBatak(s, 0, { type: 'pass' });
    s = applyBatak(s, 1, { type: 'bid', value: 5 });
    s = applyBatak(s, 2, { type: 'bid', value: 6 });
    s = applyBatak(s, 3, { type: 'pass' });
    expect(s.round.activeSeat).toBe(1); // 0 pas geçti, atlanır
    s = applyBatak(s, 1, { type: 'pass' });
    // 0, 3, 1 pas → ihale 2'de kapanır, koz seçimine geçer
    expect(s.round.phase).toBe('TRUMP');
    expect(s.round.activeSeat).toBe(2);
    expect(s.round.bidder).toBe(2);
  });

  it('herkes pas (varsayılan): son oyuncu pas geçemez, minimum teklifi vermek zorunda', () => {
    let s = createBatakMatch(IND, seededRng(1), 3);
    for (const seat of [0, 1, 2]) s = applyBatak(s, seat, { type: 'pass' });
    expect(batakViewFor(s, 3).mustBid).toBe(true);
    expectCode(() => applyBatak(s, 3, { type: 'pass' }), 'MUST_BID');
    s = applyBatak(s, 3, { type: 'bid', value: 5 });
    expect(s.round.phase).toBe('TRUMP');
    expect(batakTimeoutCommand(applyBatak(createBatakMatch(IND, seededRng(1), 3), 0, { type: 'pass' }))).toEqual({ type: 'pass' });
  });

  it('herkes pas (yeniden dağıt varyantı): kartlar yeniden dağıtılır, dağıtıcı ilerler', () => {
    const rules = buildBatakRules({ allPassRedeal: true });
    const rng = seededRng(9);
    let s = createBatakMatch(rules, rng, 3);
    const before = s.round.hands[0].map((c) => c.id).join();
    for (const seat of [0, 1, 2, 3]) s = applyBatak(s, seat, { type: 'pass' }, rng);
    expect(s.round.phase).toBe('BIDDING');
    expect(s.round.dealer).toBe(0);
    expect(s.round.activeSeat).toBe(1);
    expect(s.round.roundNo).toBe(1);
    expect(s.round.hands[0].map((c) => c.id).join()).not.toBe(before);
  });

  it('13 teklifi ihaleyi hemen kapatır; koz yalnız ihaleci tarafından, ihaleden sonra seçilir', () => {
    let s = createBatakMatch(IND, seededRng(1), 3);
    expectCode(() => applyBatak(s, 0, { type: 'choose_trump', suit: 'H' }), 'WRONG_PHASE');
    s = applyBatak(s, 0, { type: 'bid', value: 13 });
    expect(s.round.phase).toBe('TRUMP');
    expectCode(() => applyBatak(s, 1, { type: 'choose_trump', suit: 'H' }), 'NOT_YOUR_TURN');
    s = applyBatak(s, 0, { type: 'choose_trump', suit: 'H' });
    expect(s.round.trump).toBe('H');
    expect(s.round.phase).toBe('PLAYING');
    expect(s.round.activeSeat).toBe(0); // ilk eli ihaleci açar
  });
});

describe('kart kuralları', () => {
  it('renge uyma zorunlu', () => {
    const hand = [C('S', 5), C('S', 9), C('H', 14)];
    const legal = legalCards(hand, [P(0, C('S', 10))], 'H', true, IND);
    expect(legal.map((c) => c.suit)).toEqual(['S', 'S']);
  });

  it('koz açılmadan kozla çıkılamaz; elde yalnız koz kaldıysa serbest', () => {
    const hand = [C('H', 5), C('S', 9)];
    expect(legalCards(hand, [], 'H', false, IND).map((c) => c.suit)).toEqual(['S']);
    expect(legalCards(hand, [], 'H', true, IND)).toHaveLength(2);
    expect(legalCards([C('H', 5), C('H', 7)], [], 'H', false, IND)).toHaveLength(2);
  });

  it('renk yoksa: varsayılanda koz zorunlu, koz da yoksa istenen kart; ayarla serbest', () => {
    // Koz Kupa, yer Maça, elde maça yok
    const hand = [C('H', 5), C('D', 9)];
    const trick = [P(0, C('S', 10))];
    expect(IND.play.mustTrumpIfVoid).toBe(true);
    expect(TEAM.play.mustTrumpIfVoid).toBe(true);
    expect(legalCards(hand, trick, 'H', false, IND).map((c) => c.suit)).toEqual(['H']);
    // koz da yoksa her kart serbest
    expect(legalCards([C('D', 9), C('C', 3)], trick, 'H', false, IND)).toHaveLength(2);
    const free = buildBatakRules({ mustTrumpIfVoid: false });
    expect(legalCards(hand, trick, 'H', false, free)).toHaveLength(2);
  });

  it('yükseltme zorunluluğu: kapalıyken serbest, açıkken geçen kart zorunlu', () => {
    const hand = [C('S', 5), C('S', 12)];
    const trick = [P(0, C('S', 10))];
    expect(legalCards(hand, trick, 'H', true, IND)).toHaveLength(2);
    const beat = buildBatakRules({ mustBeatIfPossible: true });
    expect(legalCards(hand, trick, 'H', true, beat).map((c) => c.rank)).toEqual([12]);
    // açılan renk koz değilken elde koz varsa renkle geçmek mümkün değil → serbest
    expect(legalCards(hand, [...trick, P(1, C('H', 2))], 'H', true, beat)).toHaveLength(2);
    // renk yok + koz zorunlu + yükseltme: daha büyük koz zorunlu
    const both = buildBatakRules({ mustBeatIfPossible: true, mustTrumpIfVoid: true });
    expect(legalCards([C('H', 3), C('H', 9), C('D', 4)], [P(0, C('S', 10)), P(1, C('H', 5))], 'H', true, both).map((c) => c.rank)).toEqual([9]);
  });

  it('el kazananı: koz kozsuzdan üstün; aynı renkte büyük kazanır; koz yoksa açılan renk', () => {
    expect(resolveTrick([P(0, C('S', 10)), P(1, C('S', 14)), P(2, C('D', 14)), P(3, C('S', 2))], 'H')).toBe(1);
    expect(resolveTrick([P(0, C('S', 10)), P(1, C('S', 14)), P(2, C('H', 2)), P(3, C('S', 2))], 'H')).toBe(2);
    expect(resolveTrick([P(0, C('S', 10)), P(1, C('H', 3)), P(2, C('H', 9)), P(3, C('S', 2))], 'H')).toBe(2);
  });

  it('yanlış renk, elde olmayan kart ve sıra dışı kart durumu değiştirmez', () => {
    let s = createBatakMatch(IND, seededRng(5), 3);
    s = applyBatak(s, 0, { type: 'bid', value: 5 });
    for (const seat of [1, 2, 3]) s = applyBatak(s, seat, { type: 'pass' });
    s = applyBatak(s, 0, { type: 'choose_trump', suit: 'S' });
    expectCode(() => applyBatak(s, 0, { type: 'play_card', cardId: s.round.hands[1][0].id }), 'CARD_NOT_OWNED');
    expectCode(() => applyBatak(s, 1, { type: 'play_card', cardId: s.round.hands[1][0].id }), 'NOT_YOUR_TURN');
    const lead = s.round.hands[0].find((c) => c.suit !== 'S')!;
    const s2 = applyBatak(s, 0, { type: 'play_card', cardId: lead.id });
    const off = s2.round.hands[1].find((c) => c.suit !== lead.suit);
    if (off && s2.round.hands[1].some((c) => c.suit === lead.suit)) {
      expectCode(() => applyBatak(s2, 1, { type: 'play_card', cardId: off.id }), 'MUST_FOLLOW_SUIT');
    }
    expect(s.round.hands[0]).toHaveLength(13);
  });
});

describe('puan', () => {
  const roundWith = (tricks: number[], bidder: number, bid: number) => {
    const m = createBatakMatch(IND, seededRng(1), 0);
    const r = m.round;
    r.tricksWon = tricks;
    r.bidder = bidder;
    r.highBid = bid;
    r.trump = 'S';
    return r;
  };

  it('tekli: tutarsa +ihale×10, batarsa −ihale×10, diğerleri el×10; fazla el bonus yok', () => {
    expect(calculateBatakScore(roundWith([6, 3, 2, 2], 0, 5), IND).scores.map((s) => s.finalScore)).toEqual([50, 30, 20, 20]);
    expect(calculateBatakScore(roundWith([4, 3, 3, 3], 0, 5), IND).scores.map((s) => s.finalScore)).toEqual([-50, 30, 30, 30]);
  });

  it('en az el kuralı (tekli): ihaleye girmeyen oyuncu N el alamazsa −ihale×10', () => {
    const rules = buildBatakRules({ minDefenderTricks: 2 });
    // ihaleci 0 (6 dedi, 8 aldı); 1 → 3 el, 2 → 1 el (battı), 3 → 1 el (battı)
    const res = calculateBatakScore(roundWith([8, 3, 1, 1], 0, 6), rules);
    expect(res.scores.map((s) => s.finalScore)).toEqual([60, 30, -60, -60]);
    expect(calculateBatakScore(roundWith([8, 3, 1, 1], 0, 6), IND).scores.map((s) => s.finalScore)).toEqual([60, 30, 10, 10]);
  });

  it('en az el kuralı (eşli): rakip takım toplamı N altındaysa takım −ihale×10', () => {
    const rules = buildBatakRules({ teamMode: true, minDefenderTricks: 3 });
    // ihaleci takım 0+2: 6+5 = 11; rakip 1+3: 1+1 = 2 < 3 → rakip battı
    expect(calculateBatakScore(roundWith([6, 1, 5, 1], 0, 9), rules).scores.map((s) => s.finalScore)).toEqual([90, -90, 90, -90]);
    // rakip 3 el aldıysa ceza yok
    expect(calculateBatakScore(roundWith([5, 2, 5, 1], 0, 9), rules).scores.map((s) => s.finalScore)).toEqual([90, 0, 90, 0]);
    expect(buildBatakRules({ minDefenderTricks: 9 }).scoring.minDefenderTricks).toBe(4);
  });

  it('eşli: takım toplamı sayılır; rakip takıma varsayılan puan yok', () => {
    const r = roundWith([5, 2, 3, 3], 0, 8); // takım 0: 5+3 = 8
    const res = calculateBatakScore(r, TEAM);
    expect(res.bidderTricks).toBe(8);
    expect(res.made).toBe(true);
    expect(res.scores.map((s) => s.finalScore)).toEqual([80, 0, 80, 0]);
    const fail = calculateBatakScore(roundWith([4, 3, 3, 3], 2, 8), TEAM);
    expect(fail.scores.map((s) => s.finalScore)).toEqual([-80, 0, -80, 0]);
  });
});

function playOut(m: BatakMatch, rng: Rng, style: 'smart' | 'basic' = 'smart') {
  let steps = 0;
  while (m.status !== 'ENDED') {
    if (m.status === 'ROUND_OVER') {
      m = startNextBatakRound(m, rng);
      continue;
    }
    m = applyBatak(m, actorOf(m.round, m.rules), batakBotCommand(m, { style }), rng);
    if (++steps > 10000) throw new Error('sonsuz döngü');
  }
  return m;
}

describe('tam maç', () => {
  it('botlarla tekli ve eşli maçlar hatasız biter; her dağıtım 13 el', () => {
    for (const rules of [IND, TEAM, buildBatakRules({ mustBeatIfPossible: true, mustTrumpIfVoid: true, allPassRedeal: true })]) {
      for (let seed = 1; seed <= 6; seed++) {
        const rng = seededRng(seed);
        const m = playOut(createBatakMatch({ ...rules, match: { roundLimit: 3 } }, rng, 0), rng, seed % 2 ? 'smart' : 'basic');
        expect(m.history).toHaveLength(3);
        for (const h of m.history) expect(h.tricksWon.reduce((a, b) => a + b, 0)).toBe(13);
        if (rules.mode === 'partnership') {
          expect(m.totals[0]).toBe(m.totals[2]);
          expect(m.totals[1]).toBe(m.totals[3]);
        }
      }
    }
  });

  it('zaman aşımı hamlesi her zaman yasal ve deterministik', () => {
    const rng = seededRng(4);
    let m = createBatakMatch(IND, rng, 0);
    let steps = 0;
    while (m.status === 'ACTIVE' && steps++ < 200) {
      const c = batakTimeoutCommand(m);
      expect(batakTimeoutCommand(m)).toEqual(c);
      m = applyBatak(m, m.round.activeSeat, c, rng);
    }
    expect(m.status).not.toBe('ACTIVE');
  });

  it('görünüm: yalnız kendi eli; diğerlerinin kartları sızmaz', () => {
    const m = createBatakMatch(TEAM, seededRng(2), 0);
    const v = batakViewFor(m, 1);
    const json = JSON.stringify(v);
    expect(v.hand.map((c) => c.id).sort()).toEqual(m.round.hands[1].map((c) => c.id).sort());
    for (const seat of [0, 2, 3]) for (const c of m.round.hands[seat]) expect(json).not.toContain(`"${c.id}"`);
    expect(v.handCounts).toEqual([13, 13, 13, 13]);
  });
});

describe('açık eş (eşli: ihalecinin eşi kartlarını açar, o eli ihaleci oynar)', () => {
  /** Koltuk 0 ihaleyi 8 ile alır, Maça koz; açık eş koltuk 2. */
  const setup = (rules = TEAM) => {
    let s = createBatakMatch(rules, seededRng(11), 3);
    s = applyBatak(s, 0, { type: 'bid', value: 8 });
    for (const seat of [1, 2, 3]) s = applyBatak(s, seat, { type: 'pass' });
    return s;
  };

  it('kartlar koz seçilene kadar kapalı, sonra herkese açık', () => {
    const s = setup();
    expect(batakViewFor(s, 1).dummySeat).toBeNull();
    expect(batakViewFor(s, 1).dummyHand).toEqual([]);
    const p = applyBatak(s, 0, { type: 'choose_trump', suit: 'S' });
    for (const viewer of [0, 1, 2, 3]) {
      const v = batakViewFor(p, viewer);
      expect(v.dummySeat).toBe(2);
      expect(v.dummyHand.map((c) => c.id).sort()).toEqual(p.round.hands[2].map((c) => c.id).sort());
    }
    // Rakiplerin kartları yine gizli.
    const json = JSON.stringify(batakViewFor(p, 1));
    for (const c of p.round.hands[3]) expect(json).not.toContain(`"${c.id}"`);
  });

  it('eşin sırasında eş oynayamaz; ihaleci eşin elinden oynar, kendi elinden oynayamaz', () => {
    let s = applyBatak(setup(), 0, { type: 'choose_trump', suit: 'S' });
    // 0 açar, 1 oynar, sıra 2'de (açık eş)
    const lead = batakTimeoutCommand(s);
    s = applyBatak(s, 0, lead);
    s = applyBatak(s, 1, batakTimeoutCommand(s));
    expect(s.round.activeSeat).toBe(2);
    expect(actorOf(s.round, s.rules)).toBe(0);
    const dummyCard = batakTimeoutCommand(s) as { type: 'play_card'; cardId: string };
    expectCode(() => applyBatak(s, 2, dummyCard), 'NOT_YOUR_TURN');
    expectCode(() => applyBatak(s, 0, { type: 'play_card', cardId: s.round.hands[0][0].id }), 'CARD_NOT_OWNED');
    expect(batakViewFor(s, 0).legalCardIds).toContain(dummyCard.cardId);
    expect(batakViewFor(s, 2).legalCardIds).toEqual([]);
    const after = applyBatak(s, 0, dummyCard);
    expect(after.round.hands[2]).toHaveLength(12);
    expect(after.round.trick.map((p) => p.seat)).toEqual([0, 1, 2]);
  });

  it('kural kapalıyken eş kendi elini oynar ve kartları gizli kalır', () => {
    let s = applyBatak(setup(buildBatakRules({ teamMode: true, openPartnerHand: false })), 0, { type: 'choose_trump', suit: 'S' });
    expect(batakViewFor(s, 1).dummySeat).toBeNull();
    s = applyBatak(s, 0, batakTimeoutCommand(s));
    s = applyBatak(s, 1, batakTimeoutCommand(s));
    expect(actorOf(s.round, s.rules)).toBe(2);
    expect(applyBatak(s, 2, batakTimeoutCommand(s)).round.hands[2]).toHaveLength(12);
  });

  it('tekli oyunda açık eş yok', () => {
    expect(buildBatakRules({ openPartnerHand: true }).play.openPartnerHand).toBe(false);
  });
});

describe('renk kalmadı bilgisi', () => {
  it('renge uymayan oyuncunun o rengi kalmadığı herkese açık kaydedilir', () => {
    let m = createBatakMatch(IND, seededRng(21), 3);
    m = applyBatak(m, 0, { type: 'bid', value: 5 });
    for (const seat of [1, 2, 3]) m = applyBatak(m, seat, { type: 'pass' });
    m = applyBatak(m, 0, { type: 'choose_trump', suit: 'S' });
    // Kurgu: 0 kupa açar, 1'in elinde kupa yok
    const r = m.round;
    r.hands[0] = [C('H', 9), C('D', 2)];
    r.hands[1] = [C('S', 5), C('C', 3)];
    r.hands[2] = [C('H', 4), C('C', 9)];
    r.hands[3] = [C('H', 7), C('D', 5)];
    m = applyBatak(m, 0, { type: 'play_card', cardId: r.hands[0][0].id });
    m = applyBatak(m, 1, { type: 'play_card', cardId: m.round.hands[1][0].id }); // koz ile keser
    expect(m.round.voids[1]).toEqual(['H']);
    expect(m.round.voids[0]).toEqual([]);
    expect(batakViewFor(m, 3).voids[1]).toEqual(['H']);
  });
});
