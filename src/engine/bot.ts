// Basit bot: boş koltukları doldurmak ve zaman aşımında devralmak için.
// Deterministiktir; yalnız kendi elini ve açık bilgileri kullanır.
import { jokerLayoffTarget, lowestTile, nextSeat, prevSeat, unusedSwappedJokers } from './game.ts';
import { resolveJokerSwap, resolveLayoff } from './melds.ts';
import { canTouchMeld, partnerOf } from './rules.ts';
import { COLORS, type Color, type Command, type Face, type MatchState, type MeldInput, type Tile } from './types.ts';
import { faceKey, isRealOkey, naturalFace } from './tiles.ts';

interface Candidate {
  faces: Face[]; // doğal taşlar
  jokers: number; // gereken gerçek okey sayısı
  value: number;
  /** okeylerin per içindeki sırası (seriler için doğru diziliş) */
  layout: (Face | 'J')[];
}

interface Solution {
  melds: MeldInput[];
  total: number;
  used: Set<string>;
}

function buildCandidates(counts: Map<string, number>, wildCount: number): Candidate[] {
  const has = (c: Color, n: number) => (counts.get(`${c}${n}`) ?? 0) > 0;
  const out: Candidate[] = [];
  const maxJ = Math.min(wildCount, 2);
  for (const color of COLORS) {
    for (let s = 1; s <= 11; s++) {
      for (let e = s + 2; e <= 13; e++) {
        const layout: (Face | 'J')[] = [];
        let missing = 0;
        for (let n = s; n <= e; n++) {
          if (has(color, n)) layout.push({ color, number: n });
          else { layout.push('J'); missing++; }
        }
        if (missing > maxJ || layout.length - missing < 2) continue;
        if (layout[0] === 'J' && layout[layout.length - 1] === 'J') continue;
        const faces = layout.filter((x): x is Face => x !== 'J');
        out.push({ faces, jokers: missing, value: ((s + e) * (e - s + 1)) / 2, layout });
      }
    }
  }
  for (let n = 1; n <= 13; n++) {
    const present = COLORS.filter((c) => has(c, n));
    const subsets: Color[][] = [];
    if (present.length === 4) subsets.push(present, ...present.map((x) => present.filter((y) => y !== x)));
    else if (present.length >= 1) subsets.push(present);
    for (const sub of subsets) {
      for (let j = 0; j <= maxJ; j++) {
        const size = sub.length + j;
        if (size < 3 || size > 4 || sub.length < 2) continue;
        const faces = sub.map((c) => ({ color: c, number: n }));
        out.push({ faces, jokers: j, value: n * size, layout: [...faces, ...Array(j).fill('J')] });
      }
    }
  }
  return out.sort((a, b) => b.value - a.value || a.jokers - b.jokers);
}

/** Elden en yüksek toplamlı ayrık per kümesini bulur (sınırlı arama). */
export function findBestMelds(hand: Tile[], okey: Face, mustIncludeId?: string): Solution {
  const wilds = hand.filter((t) => isRealOkey(t, okey));
  const naturals = hand.filter((t) => !isRealOkey(t, okey));
  const counts = new Map<string, number>();
  for (const t of naturals) {
    const k = faceKey(naturalFace(t, okey));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const cands = buildCandidates(counts, wilds.length);
  let best: { picks: Candidate[]; total: number } = { picks: [], total: 0 };
  let nodes = 0;
  const picks: Candidate[] = [];
  const LIMIT = 40000;

  const dfs = (from: number, jokersLeft: number, total: number) => {
    if (++nodes > LIMIT) return;
    if (total > best.total) best = { picks: picks.slice(), total };
    for (let i = from; i < cands.length; i++) {
      const c = cands[i];
      if (c.jokers > jokersLeft) continue;
      if (!c.faces.every((f) => (counts.get(faceKey(f)) ?? 0) > 0)) continue;
      // aynı per içinde aynı yüz iki kez geçmez, sayaç kontrolü yeterli
      for (const f of c.faces) counts.set(faceKey(f), counts.get(faceKey(f))! - 1);
      picks.push(c);
      dfs(i, jokersLeft - c.jokers, total + c.value);
      picks.pop();
      for (const f of c.faces) counts.set(faceKey(f), counts.get(faceKey(f))! + 1);
      if (nodes > LIMIT) return;
    }
  };
  dfs(0, wilds.length, 0);

  // Yüzleri gerçek taş kimliklerine eşle; zorunlu taş varsa önce onu kullan.
  const pool = new Map<string, Tile[]>();
  for (const t of naturals) {
    const k = faceKey(naturalFace(t, okey));
    if (!pool.has(k)) pool.set(k, []);
    pool.get(k)!.push(t);
  }
  for (const list of pool.values()) list.sort((a, b) => (a.id === mustIncludeId ? -1 : b.id === mustIncludeId ? 1 : 0));
  const wildPool = [...wilds].sort((a, b) => (a.id === mustIncludeId ? -1 : b.id === mustIncludeId ? 1 : 0));
  const used = new Set<string>();
  const melds: MeldInput[] = best.picks.map((c) => ({
    tileIds: c.layout.map((x) => {
      const t = x === 'J' ? wildPool.shift()! : pool.get(faceKey(x))!.shift()!;
      used.add(t.id);
      return t.id;
    }),
  }));
  return { melds, total: best.total, used };
}

function findPairs(hand: Tile[], okey: Face): string[][] {
  const byFace = new Map<string, Tile[]>();
  for (const t of hand) {
    const f = t.kind === 'F' ? okey : { color: t.color!, number: t.number! };
    const k = faceKey(f);
    if (!byFace.has(k)) byFace.set(k, []);
    byFace.get(k)!.push(t);
  }
  const pairs: string[][] = [];
  for (const list of byFace.values()) {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i].id, list[i + 1].id]);
  }
  return pairs;
}

export interface BotOptions {
  /**
   * 'smart' (varsayılan): atışı sıradaki rakibe göre seçer, eşli oyunda eş/rakip durumunu tartar.
   * 'basic': eski basit davranış (karşılaştırma ve ileride "kolay bot" için).
   */
  style?: 'smart' | 'basic';
}

/** İşleme önceliği: eşli oyunda önce kendi ve eşin perleri, sonra rakip perleri. */
function meldsByPriority(m: MatchState, seat: number) {
  const mine = (owner: number) => owner === seat || (m.rules.match.teamMode && owner === partnerOf(seat));
  return [...m.round.melds].sort((a, b) => Number(!mine(a.owner)) - Number(!mine(b.owner)));
}

function canLayoffSomewhere(m: MatchState, seat: number, tile: Tile): { meldId: string } | null {
  const r = m.round;
  for (const meld of meldsByPriority(m, seat)) {
    if (!canTouchMeld(m.rules, seat, meld.owner)) continue;
    if (resolveLayoff(meld, tile, r.okey)) return { meldId: meld.id };
  }
  return null;
}

/** Botun bir sonraki tek komutu. Tur bitene kadar tekrar çağrılır. */
export function botNextCommand(m: MatchState, opts: BotOptions = {}): Command {
  const r = m.round;
  const seat = r.activeSeat;
  const hand = r.hands[seat];
  const opened = r.opened[seat];
  const rules = m.rules;

  if (r.phase === 'DRAW') {
    const pile = r.discards[prevSeat(seat)];
    const top = pile[pile.length - 1];
    // yandan gelen gerçek okey her zaman cazip; açmışsa al
    if (top && isRealOkey(top, r.okey) && (opened || !rules.discard.mustUseTakenDiscardToOpen)) {
      return { type: 'take_discard' };
    }
    if (top) {
      if (opened) {
        if (opened === 'melds' && canLayoffSomewhere(m, seat, top)) return { type: 'take_discard' };
      } else if (rules.discard.mustUseTakenDiscardToOpen) {
        const withTop = [...hand, top];
        const sol = findBestMelds(withTop, r.okey, top.id);
        if (sol.total >= rules.opening.minPoints && sol.used.has(top.id) && sol.used.size < withTop.length) {
          return { type: 'take_discard', open: { kind: 'melds', melds: sol.melds } };
        }
      }
    }
    if (r.stock.length > 0) return { type: 'draw_stock' };
    if (top) return { type: 'take_discard' };
    return { type: 'draw_stock' };
  }

  // ACTIONS
  if (!opened) {
    const sol = findBestMelds(hand, r.okey);
    if (sol.total >= rules.opening.minPoints && sol.used.size < hand.length) {
      return { type: 'open_melds', melds: sol.melds };
    }
    if (rules.opening.allowPairs) {
      const pairs = findPairs(hand, r.okey);
      if (pairs.length >= rules.opening.minPairs) {
        const take = pairs.slice(0, Math.min(pairs.length, Math.floor((hand.length - 1) / 2)));
        if (take.length >= rules.opening.minPairs) return { type: 'open_pairs', pairs: take };
      }
    }
  } else {
    if (opened === 'melds') {
      const sol = findBestMelds(hand, r.okey);
      if (sol.melds.length > 0 && sol.used.size < hand.length) return { type: 'open_melds', melds: sol.melds };
    } else {
      const pairs = findPairs(hand, r.okey);
      if (pairs.length > 0 && pairs.length * 2 < hand.length) return { type: 'open_pairs', pairs };
    }
    // Masadaki okeyi almak her zaman cazip: önce takas, sonra işleme.
    if (rules.joker.allowSwap) {
      for (const t of hand) {
        if (isRealOkey(t, r.okey)) continue;
        for (const meld of r.melds) {
          if (!canTouchMeld(rules, seat, meld.owner)) continue;
          if (resolveJokerSwap(meld, t, r.okey)) return { type: 'swap_joker', meldId: meld.id, tileId: t.id };
        }
      }
    }
    if (hand.length > 1) {
      for (const t of hand) {
        if (isRealOkey(t, r.okey)) continue; // okeyi elde tut
        const target = canLayoffSomewhere(m, seat, t);
        if (target) return { type: 'layoff', meldId: target.meldId, tileId: t.id };
      }
    }
  }
  // Masadan alınan okeyi aynı tur koyma şartı: atmadan önce işle.
  for (const j of unusedSwappedJokers(m, seat)) {
    const target = jokerLayoffTarget(m, seat, j);
    if (target) return { type: 'layoff', meldId: target.id, tileId: j.id };
  }
  const pick = opts.style === 'basic' ? chooseDiscardBasic(m, seat) : chooseDiscardSmart(m, seat);
  return { type: 'discard', tileId: pick.id };
}

function chooseDiscardBasic(m: MatchState, seat: number): Tile {
  const r = m.round;
  const hand = r.hands[seat];
  if (hand.length === 1) return hand[0];
  const { used } = findBestMelds(hand, r.okey);
  const pairKeys = new Set(
    r.opened[seat] === 'pairs' || !r.opened[seat] ? findPairs(hand, r.okey).flat() : [],
  );
  const free = hand.filter((t) => !used.has(t.id) && !isRealOkey(t, r.okey));
  const pref = free.filter((t) => !pairKeys.has(t.id));
  const pool = pref.length ? pref : free.length ? free : hand;
  // Yüksek değerli serbest taşı at (elde kalırsa ceza büyür); rakibin işlemesine izin veren taştan kaçın.
  const nextOpenedMelds = r.melds.length > 0;
  const sorted = [...pool].sort((a, b) => naturalFace(b, r.okey).number - naturalFace(a, r.okey).number);
  if (nextOpenedMelds) {
    const safe = sorted.filter((t) => !canLayoffSomewhere(m, seat, t));
    if (safe.length) return safe[0];
  }
  return sorted[0] ?? lowestTile(hand, r.okey);
}

/**
 * Atılan taşı yalnız sıradaki oyuncu alabilir; o da her zaman rakiptir (eşli oyunda eş karşıda oturur).
 * Bu yüzden her serbest taş puanlanır:
 *  - elde kalırsa ceza büyüten yüksek taşlar atılmaya daha uygundur,
 *  - sıradaki rakibin işleyebileceği taş tehlikelidir (rakip bitmeye yakınsa çok daha tehlikeli),
 *  - sıradaki rakibin daha önce attığı yüzler ona yaramıyordur (güvenli),
 *  - eşli oyunda eş bitmeye yakınsa ve bitirenin eşi ceza almıyorsa kendi cezamız muhtemelen
 *    sıfırlanacağından güvenlik ön plana çıkar; rakip bitmeye yakınsa elde yüksek taş bırakmamak önemlidir.
 * Bot yalnızca herkesin gördüğü bilgiyi kullanır (eşinin elini görmez).
 */
function chooseDiscardSmart(m: MatchState, seat: number): Tile {
  const r = m.round;
  const hand = r.hands[seat];
  if (hand.length === 1) return hand[0];
  const rules = m.rules;
  const team = rules.match.teamMode;
  const next = nextSeat(seat);
  const partner = partnerOf(seat);
  const { used } = findBestMelds(hand, r.okey);
  const pairIds = new Set(r.opened[seat] === 'pairs' || !r.opened[seat] ? findPairs(hand, r.okey).flat() : []);

  const near = (s: number) => !!r.opened[s] && r.hands[s].length <= 3;
  const urgency = (s: number) => (near(s) ? 4 - r.hands[s].length : 0); // 1..3
  const opponents = [0, 1, 2, 3].filter((s) => s !== seat && !(team && s === partner));
  const partnerNear = team && near(partner) && rules.scoring.partnerOfWinnerExempt;
  const opponentNear = opponents.some(near);

  // Değer ağırlığı: rakip bitmek üzereyken yüksek taşı elden çıkar; eş bitmek üzereyken güvenliğe odaklan.
  let valueWeight = 1;
  if (r.opened[seat] && opponentNear) valueWeight = 1.5;
  if (partnerNear) valueWeight = 0.3;
  const dangerWeight = partnerNear ? 2 : 1;

  // Per olma potansiyeli: aynı renkte ±1/±2 komşu veya aynı sayıda farklı renk.
  const faces = hand.map((t) => ({ t, f: naturalFace(t, r.okey) }));
  const potential = (t: Tile) => {
    const f = naturalFace(t, r.okey);
    let p = 0;
    for (const o of faces) {
      if (o.t.id === t.id || isRealOkey(o.t, r.okey)) continue;
      if (o.f.color === f.color && Math.abs(o.f.number - f.number) === 1) p += 2;
      else if (o.f.color === f.color && Math.abs(o.f.number - f.number) === 2) p += 1;
      else if (o.f.number === f.number && o.f.color !== f.color) p += 2;
    }
    return p;
  };
  const opened = !!r.opened[seat];

  const nextDiscardFaces = new Set(r.discards[next].map((t) => faceKey(naturalFace(t, r.okey))));
  const nextCanUse = (t: Tile) =>
    !!r.opened[next] &&
    r.melds.some((meld) => canTouchMeld(rules, next, meld.owner) && resolveLayoff(meld, t, r.okey));

  const score = (t: Tile) => {
    if (isRealOkey(t, r.okey)) return -10000;
    const n = naturalFace(t, r.okey).number;
    // Açmamışken yüksek taşlar 101 barajı için değerlidir: düşük ve potansiyelsiz taşı at.
    // Açtıktan sonra elde kalan taş ceza olduğundan yüksek taşı elden çıkar.
    let v = opened ? n * valueWeight - potential(t) * 3 : -n * 0.8 - potential(t) * 10;
    if (used.has(t.id)) v -= 1000;
    if (pairIds.has(t.id)) v -= 40;
    if (nextCanUse(t)) v -= (50 + urgency(next) * 40) * dangerWeight;
    if (nextDiscardFaces.has(faceKey(naturalFace(t, r.okey)))) v += 5;
    return v;
  };
  return [...hand].sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1))[0];
}
