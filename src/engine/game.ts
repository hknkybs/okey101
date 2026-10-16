// Oyun motoru: durum makinesi, komut uygulama, skor. (spesifikasyon §5–§7)
// Saat, ağ ve DB kullanılmaz; rastgelelik `Rng` olarak enjekte edilir.
import { GameError } from './errors.ts';
import { meldValue, resolveJokerSwap, resolveLayoff, resolveMeld, resolvePair, type ResolvedMeld } from './melds.ts';
import { canTouchMeld, partnerOf, type Ruleset } from './rules.ts';
import { createTileSet, faceLabel, isRealOkey, okeyFromIndicator, shuffle, tileLabel, tilePenaltyValue } from './tiles.ts';
import {
  SEATS,
  type Command,
  type Face,
  type FinishType,
  type MatchState,
  type Meld,
  type MeldInput,
  type OpenPayload,
  type RoundResult,
  type RoundScore,
  type RoundState,
  type Tile,
} from './types.ts';

export interface Rng {
  randInt(n: number): number;
  id(): string;
}

export const nextSeat = (s: number) => (s + 1) % SEATS;
export const prevSeat = (s: number) => (s + SEATS - 1) % SEATS;

// ───────────────────────── Dağıtım ─────────────────────────

export function dealRound(roundNo: number, dealer: number, rng: Rng): RoundState {
  let tiles = shuffle(createTileSet(() => rng.id()), (n) => rng.randInt(n));
  // Gösterge normal taş olmalı: sahte okey denk gelirse desteye geri konup tekrar çekilir.
  const indIdx = tiles.findIndex((t) => t.kind === 'N');
  const indicator = tiles[indIdx];
  tiles = tiles.filter((_, i) => i !== indIdx);
  const okey = okeyFromIndicator(indicator);
  const starter = nextSeat(dealer);
  const hands: Tile[][] = [[], [], [], []];
  let p = 0;
  for (let k = 0; k < SEATS; k++) {
    const seat = (starter + k) % SEATS;
    const count = seat === starter ? 22 : 21;
    hands[seat] = tiles.slice(p, p + count);
    p += count;
  }
  return {
    roundNo,
    dealer,
    starter,
    indicator,
    okey,
    stock: tiles.slice(p), // 20 taş
    hands,
    discards: [[], [], [], []],
    melds: [],
    opened: [null, null, null, null],
    phase: 'ACTIONS', // başlayan oyuncu çekmeden atar (isterse önce açabilir)
    activeSeat: starter,
    turnNo: 1,
    meldSeq: 0,
    swappedJokers: [],
  };
}

export function createMatch(rules: Ruleset, rng: Rng, dealer = 0): MatchState {
  return {
    rules: structuredClone(rules),
    stateVersion: 1,
    status: 'ACTIVE',
    round: dealRound(1, dealer, rng),
    totals: [0, 0, 0, 0],
    wins: [0, 0, 0, 0],
    history: [],
    lastAction: { seat: null, text: '1. el başladı' },
  };
}

export function startNextRound(match: MatchState, rng: Rng): MatchState {
  if (match.status !== 'ROUND_OVER') throw new GameError('WRONG_PHASE');
  const m = structuredClone(match);
  const r = m.round;
  m.round = dealRound(r.roundNo + 1, nextSeat(r.dealer), rng);
  m.status = 'ACTIVE';
  m.stateVersion++;
  m.lastAction = { seat: null, text: `${m.round.roundNo}. el başladı` };
  return m;
}

// ───────────────────────── Doğrulama yardımcıları ─────────────────────────

function takeTiles(hand: Tile[], ids: string[]): Tile[] {
  if (new Set(ids).size !== ids.length) throw new GameError('INVALID_MELD', 'Aynı taş iki kez kullanılamaz.');
  return ids.map((id) => {
    const t = hand.find((x) => x.id === id);
    if (!t) throw new GameError('TILE_NOT_OWNED');
    return t;
  });
}

/** Açılış/per indirme doğrulaması. İstemci önizlemesi de bunu kullanır. */
export function validateMelds(hand: Tile[], inputs: MeldInput[], okey: Face): { melds: ResolvedMeld[]; total: number } {
  if (!Array.isArray(inputs) || inputs.length === 0) throw new GameError('INVALID_MELD');
  takeTiles(hand, inputs.flatMap((m) => m.tileIds)); // sahiplik + tekrar kontrolü
  const melds = inputs.map((inp, i) => {
    const r = resolveMeld(takeTiles(hand, inp.tileIds), okey, inp.jokerAssignments);
    if (!r) throw new GameError('INVALID_MELD', `${i + 1}. per geçerli seri/grup değil.`);
    return r;
  });
  return { melds, total: melds.reduce((s, m) => s + m.value, 0) };
}

export function validatePairs(hand: Tile[], pairs: string[][], okey: Face) {
  if (!Array.isArray(pairs) || pairs.length === 0) throw new GameError('PAIR_COUNT_TOO_LOW');
  takeTiles(hand, pairs.flat());
  return pairs.map((ids, i) => {
    const r = resolvePair(takeTiles(hand, ids), okey);
    if (!r) throw new GameError('INVALID_MELD', `${i + 1}. çift geçersiz.`);
    return r;
  });
}

// ───────────────────────── Komut uygulama ─────────────────────────

/**
 * Komutu uygular, yeni durumu döndürür. Geçersizse GameError fırlatır ve
 * girdi durumu hiç değişmez (atomik).
 */
export function applyCommand(match: MatchState, seat: number, cmd: Command): MatchState {
  if (match.status !== 'ACTIVE') throw new GameError('MATCH_NOT_ACTIVE');
  if (match.round.activeSeat !== seat) throw new GameError('NOT_YOUR_TURN');
  if (!cmd || typeof cmd !== 'object') throw new GameError('BAD_COMMAND');
  const m = structuredClone(match);
  const r = m.round;
  const hand = r.hands[seat];
  const rules = m.rules;

  switch (cmd.type) {
    case 'draw_stock': {
      if (r.phase !== 'DRAW') throw new GameError('WRONG_PHASE');
      const t = r.stock.shift();
      if (!t) throw new GameError('STOCK_EMPTY');
      hand.push(t);
      r.phase = 'ACTIONS';
      m.lastAction = { seat, text: 'desteden çekti' };
      break;
    }
    case 'take_discard': {
      if (r.phase !== 'DRAW') throw new GameError('WRONG_PHASE');
      const pile = r.discards[prevSeat(seat)];
      const t = pile[pile.length - 1];
      if (!t) throw new GameError('NO_DISCARD');
      pile.pop();
      hand.push(t);
      r.phase = 'ACTIONS';
      m.lastAction = { seat, text: `yandan aldı: ${tileLabel(t)}` };
      if (!r.opened[seat] && rules.discard.mustUseTakenDiscardToOpen) {
        if (!cmd.open) throw new GameError('MUST_USE_DISCARD_TO_OPEN');
        openWith(m, seat, cmd.open, t.id);
        m.lastAction = { seat, text: `yandan ${tileLabel(t)} alıp açtı` };
      } else if (cmd.open) {
        openWith(m, seat, cmd.open);
      }
      break;
    }
    case 'open_melds': {
      if (r.phase !== 'ACTIONS') throw new GameError('WRONG_PHASE');
      openWith(m, seat, { kind: 'melds', melds: cmd.melds });
      break;
    }
    case 'open_pairs': {
      if (r.phase !== 'ACTIONS') throw new GameError('WRONG_PHASE');
      openWith(m, seat, { kind: 'pairs', pairs: cmd.pairs });
      break;
    }
    case 'layoff': {
      if (r.phase !== 'ACTIONS') throw new GameError('WRONG_PHASE');
      if (!r.opened[seat]) throw new GameError('NOT_OPENED');
      const meld = r.melds.find((x) => x.id === cmd.meldId);
      if (!meld) throw new GameError('MELD_NOT_FOUND');
      if (!canTouchMeld(rules, seat, meld.owner)) throw new GameError('LAYOFF_NOT_ALLOWED');
      const [tile] = takeTiles(hand, [cmd.tileId]);
      if (hand.length <= 1) throw new GameError('MUST_KEEP_TILE');
      const next = resolveLayoff(meld, tile, r.okey, cmd.side);
      if (!next) throw new GameError('LAYOFF_INVALID');
      meld.tiles = next;
      removeFromHand(hand, [tile.id]);
      m.lastAction = { seat, text: `işledi: ${tileLabel(tile)}` };
      break;
    }
    case 'swap_joker': {
      if (r.phase !== 'ACTIONS') throw new GameError('WRONG_PHASE');
      if (!rules.joker.allowSwap) throw new GameError('SWAP_DISABLED');
      if (!r.opened[seat]) throw new GameError('NOT_OPENED');
      const meld = r.melds.find((x) => x.id === cmd.meldId);
      if (!meld) throw new GameError('MELD_NOT_FOUND');
      if (!canTouchMeld(rules, seat, meld.owner)) throw new GameError('LAYOFF_NOT_ALLOWED');
      const [tile] = takeTiles(hand, [cmd.tileId]);
      const res = resolveJokerSwap(meld, tile, r.okey);
      if (!res) throw new GameError('SWAP_INVALID');
      meld.tiles = res.tiles;
      removeFromHand(hand, [tile.id]);
      hand.push(res.joker);
      if (rules.joker.swapMustUseSameTurn) r.swappedJokers.push(res.joker.id);
      m.lastAction = { seat, text: `${tileLabel(tile)} koyup okeyi masadan aldı` };
      break;
    }
    case 'discard': {
      if (r.phase !== 'ACTIONS') throw new GameError('WRONG_PHASE');
      const [tile] = takeTiles(hand, [cmd.tileId]);
      // Masadan alınan okey bu tur masaya konmalı. Okeyi koyacak hiçbir yer yoksa
      // (işlenebilir per kalmadıysa) tur kilitlenmesin diye atışa izin verilir.
      if (unusedSwappedJokers(m, seat).some((j) => jokerPlaceable(m, seat, j))) {
        throw new GameError('JOKER_MUST_BE_USED');
      }
      removeFromHand(hand, [tile.id]);
      r.discards[seat].push(tile);
      m.lastAction = { seat, text: `attı: ${tileLabel(tile)}` };
      if (hand.length === 0) {
        endRound(m, seat, tile);
      } else {
        advanceTurn(m);
      }
      break;
    }
    default:
      throw new GameError('BAD_COMMAND');
  }
  m.stateVersion++;
  return m;
}

function removeFromHand(hand: Tile[], ids: string[]) {
  for (const id of ids) {
    const i = hand.findIndex((t) => t.id === id);
    if (i >= 0) hand.splice(i, 1);
  }
}

function openWith(m: MatchState, seat: number, payload: OpenPayload, mustIncludeId?: string) {
  const r = m.round;
  const hand = r.hands[seat];
  const rules = m.rules;
  const opened = r.opened[seat];
  let usedIds: string[];
  let newMelds: Omit<Meld, 'id'>[];

  if (payload?.kind === 'melds') {
    if (opened === 'pairs') throw new GameError('ALREADY_OPENED_OTHER', 'Çift açan oyuncu seri/grup açamaz.');
    const { melds, total } = validateMelds(hand, payload.melds, r.okey);
    if (!opened && total < rules.opening.minPoints) {
      throw new GameError('OPENING_BELOW_THRESHOLD', `Toplam ${total}, en az ${rules.opening.minPoints} gerekli.`);
    }
    usedIds = payload.melds.flatMap((x) => x.tileIds);
    newMelds = melds.map((x) => ({ owner: seat, kind: x.kind, tiles: x.tiles }));
    m.lastAction = { seat, text: opened ? `per indirdi (${total})` : `${total} ile açtı` };
  } else if (payload?.kind === 'pairs') {
    if (!rules.opening.allowPairs) throw new GameError('PAIRS_DISABLED');
    if (opened === 'melds') throw new GameError('ALREADY_OPENED_OTHER', 'Seri/grup ile açan oyuncu çift indiremez.');
    const pairs = validatePairs(hand, payload.pairs, r.okey);
    if (!opened && pairs.length < rules.opening.minPairs) {
      throw new GameError('PAIR_COUNT_TOO_LOW', `${pairs.length} çift, en az ${rules.opening.minPairs} gerekli.`);
    }
    usedIds = payload.pairs.flat();
    newMelds = pairs.map((tiles) => ({ owner: seat, kind: 'pair' as const, tiles }));
    m.lastAction = { seat, text: opened ? `${pairs.length} çift indirdi` : `${pairs.length} çift ile açtı` };
  } else {
    throw new GameError('BAD_COMMAND');
  }

  if (mustIncludeId && !usedIds.includes(mustIncludeId)) throw new GameError('MUST_USE_DISCARD_TO_OPEN');
  if (hand.length - usedIds.length < 1) throw new GameError('MUST_KEEP_TILE');

  removeFromHand(hand, usedIds);
  for (const nm of newMelds) r.melds.push({ id: `m${++r.meldSeq}`, ...nm });
  if (!opened) r.opened[seat] = payload.kind;
}

/** Bu tur masadan alınıp hâlâ elde duran okeyler. */
export function unusedSwappedJokers(m: MatchState, seat: number): Tile[] {
  const r = m.round;
  if (r.activeSeat !== seat || !r.swappedJokers?.length) return [];
  return r.hands[seat].filter((t) => r.swappedJokers.includes(t.id));
}

/** Okeyin işlenebileceği ilk per (elde atılacak bir taş kalması şartıyla). */
export function jokerLayoffTarget(m: MatchState, seat: number, joker: Tile): Meld | null {
  const r = m.round;
  if (r.hands[seat].length <= 1) return null;
  for (const meld of r.melds) {
    if (!canTouchMeld(m.rules, seat, meld.owner)) continue;
    if (resolveLayoff(meld, joker, r.okey)) return meld;
  }
  return null;
}

const jokerPlaceable = (m: MatchState, seat: number, joker: Tile) => !!jokerLayoffTarget(m, seat, joker);

function advanceTurn(m: MatchState) {
  const r = m.round;
  r.activeSeat = nextSeat(r.activeSeat);
  r.turnNo++;
  r.phase = 'DRAW';
  r.swappedJokers = [];
  // Varsayılan (§5.3 basitleştirilmiş): sıradaki oyuncunun çekeceği taş yoksa el kapanır.
  if (r.stock.length === 0) endRound(m, null);
}

// ───────────────────────── El sonu ve skor ─────────────────────────

function endRound(m: MatchState, winner: number | null, lastTile?: Tile) {
  const r = m.round;
  r.phase = 'ENDED';
  let finishType: FinishType = 'stock_empty';
  if (winner !== null) {
    const okeyFinish = !!lastTile && isRealOkey(lastTile, r.okey);
    const pairFinish = r.opened[winner] === 'pairs';
    finishType = okeyFinish && pairFinish ? 'okey_pairs' : okeyFinish ? 'okey' : pairFinish ? 'pairs' : 'normal';
  }
  const scores = calculateRoundScore(r, m.rules, winner, finishType);
  const result: RoundResult = {
    roundNo: r.roundNo,
    winner,
    finishType,
    scores,
    hands: r.hands.map((h) => h.slice()),
    okey: r.okey,
  };
  m.history.push(result);
  for (const s of scores) m.totals[s.seat] += s.finalDelta;
  if (winner !== null) m.wins[winner]++;
  m.status = r.roundNo >= m.rules.match.roundLimit ? 'ENDED' : 'ROUND_OVER';
  m.lastAction =
    winner === null ? { seat: null, text: 'Deste bitti, el kapandı' } : { seat: winner, text: 'eli bitirdi!' };
}

export function calculateRoundScore(
  r: RoundState,
  rules: Ruleset,
  winner: number | null,
  finishType: FinishType,
): RoundScore[] {
  let multiplier = 1;
  if (finishType === 'okey' || finishType === 'okey_pairs') multiplier *= rules.scoring.doubleOnOkeyFinish ? 2 : 1;
  if (finishType === 'pairs' || finishType === 'okey_pairs') multiplier *= rules.scoring.doubleOnPairFinish ? 2 : 1;

  return r.hands.map((hand, seat) => {
    const modifiers: { code: string; delta: number }[] = [];
    let baseDelta: number;
    let reason: string;
    if (seat === winner) {
      baseDelta = rules.scoring.winnerDelta;
      reason = 'Eli bitirdi';
    } else if (winner !== null && rules.match.teamMode && rules.scoring.partnerOfWinnerExempt && seat === partnerOf(winner)) {
      baseDelta = 0;
      reason = 'Eşi eli bitirdi';
    } else if (r.opened[seat]) {
      const okeys = hand.filter((t) => isRealOkey(t, r.okey));
      baseDelta = hand.filter((t) => !isRealOkey(t, r.okey)).reduce((s, t) => s + tilePenaltyValue(t, r.okey), 0);
      if (okeys.length && rules.joker.heldPenalty) {
        modifiers.push({ code: 'OKEY_HELD', delta: rules.joker.heldPenalty * okeys.length });
      }
      reason = `Açmış oyuncu; elde kalan ${hand.length} taş`;
    } else {
      baseDelta = rules.scoring.unopenedPenalty;
      reason = 'Açmamış oyuncu';
    }
    const raw = baseDelta + modifiers.reduce((s, x) => s + x.delta, 0);
    return { seat, baseDelta, modifiers, multiplier, finalDelta: raw * multiplier, reason };
  });
}

/** Maç sonu sıralaması: toplam ceza artan, eşitse galibiyet çok olan önde. */
export function ranking(totals: number[], wins: number[]): number[] {
  return [0, 1, 2, 3].sort((a, b) => totals[a] - totals[b] || wins[b] - wins[a] || a - b);
}

/** Eşli maç sıralaması: takım toplamı artan, eşitse takım galibiyeti. Dönen: takım numaraları. */
export function teamRanking(totals: number[], wins: number[]): number[] {
  const t = [totals[0] + totals[2], totals[1] + totals[3]];
  const w = [wins[0] + wins[2], wins[1] + wins[3]];
  return [0, 1].sort((a, b) => t[a] - t[b] || w[b] - w[a] || a - b);
}

// ───────────────────────── Zaman aşımı ─────────────────────────

/**
 * Süre dolduğunda otomatik hamle (§12): gerekirse desteden çek, sonra en düşük
 * değerli taşı at (gerçek okey son tercih). Eşitlikte renk sırası ve id ile deterministik.
 */
export function timeoutCommands(m: MatchState): Command[] {
  const seat = m.round.activeSeat;
  const cmds: Command[] = [];
  let s = m;
  const push = (c: Command) => {
    cmds.push(c);
    s = applyCommand(s, seat, c);
  };
  if (s.round.phase === 'DRAW') {
    if (s.round.stock.length === 0) return cmds;
    push({ type: 'draw_stock' });
  }
  // Masadan alınan okey o tur kullanılmalıysa önce onu işle.
  try {
    for (const j of unusedSwappedJokers(s, seat)) {
      const target = jokerLayoffTarget(s, seat, j);
      if (target) push({ type: 'layoff', meldId: target.id, tileId: j.id });
    }
  } catch {
    /* işleme başarısızsa yalnız atışa düş */
  }
  cmds.push({ type: 'discard', tileId: lowestTile(s.round.hands[seat], s.round.okey).id });
  return cmds;
}

const COLOR_ORDER = { R: 0, Y: 1, B: 2, K: 3 } as const;

export function lowestTile(hand: Tile[], okey: Face): Tile {
  const pool = hand.some((t) => !isRealOkey(t, okey)) ? hand.filter((t) => !isRealOkey(t, okey)) : hand;
  return [...pool].sort((a, b) => {
    const fa = a.kind === 'F' ? okey : { color: a.color!, number: a.number! };
    const fb = b.kind === 'F' ? okey : { color: b.color!, number: b.number! };
    return fa.number - fb.number || COLOR_ORDER[fa.color] - COLOR_ORDER[fb.color] || (a.id < b.id ? -1 : 1);
  })[0];
}

// ───────────────────────── Oyuncuya özel görünüm ─────────────────────────

export interface PublicSeat {
  seat: number;
  handCount: number;
  opened: RoundState['opened'][number];
  discards: Tile[];
  total: number;
  wins: number;
}

export interface GameView {
  yourSeat: number;
  stateVersion: number;
  status: MatchState['status'];
  roundNo: number;
  roundLimit: number;
  phase: RoundState['phase'];
  activeSeat: number;
  dealer: number;
  turnNo: number;
  indicator: Tile;
  okey: Face;
  okeyLabel: string;
  stockCount: number;
  hand: Tile[];
  seats: PublicSeat[];
  melds: Meld[];
  lastAction: MatchState['lastAction'];
  lastResult: RoundResult | null;
  /** Bu tur masadan aldığınız ve masaya koymanız gereken okeyler. */
  mustUseJokerIds: string[];
  history: { roundNo: number; winner: number | null; finishType: FinishType; deltas: number[] }[];
  rules: Ruleset;
}

/** Yalnız kendi taşları + açık bilgiler. Stok sırası ve rakip elleri asla gönderilmez. */
export function viewFor(m: MatchState, seat: number): GameView {
  const r = m.round;
  const roundOver = m.status !== 'ACTIVE';
  return {
    yourSeat: seat,
    stateVersion: m.stateVersion,
    status: m.status,
    roundNo: r.roundNo,
    roundLimit: m.rules.match.roundLimit,
    phase: r.phase,
    activeSeat: r.activeSeat,
    dealer: r.dealer,
    turnNo: r.turnNo,
    indicator: r.indicator,
    okey: r.okey,
    okeyLabel: faceLabel(r.okey),
    stockCount: r.stock.length,
    hand: r.hands[seat] ?? [],
    seats: [0, 1, 2, 3].map((s) => ({
      seat: s,
      handCount: r.hands[s].length,
      opened: r.opened[s],
      discards: r.discards[s],
      total: m.totals[s],
      wins: m.wins[s],
    })),
    melds: r.melds,
    lastAction: m.lastAction,
    // El bittiğinde tüm eller sonuç ekranında açılır.
    mustUseJokerIds: r.activeSeat === seat ? unusedSwappedJokers(m, seat).map((t) => t.id) : [],
    lastResult: roundOver ? (m.history[m.history.length - 1] ?? null) : null,
    history: m.history.map((h) => ({
      roundNo: h.roundNo,
      winner: h.winner,
      finishType: h.finishType,
      deltas: h.scores.map((s) => s.finalDelta),
    })),
    rules: m.rules,
  };
}

export { meldValue };
