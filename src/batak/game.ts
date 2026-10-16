// Batak oyun motoru: dağıtım, ihale, koz, kart oynama, el (trick) çözümü ve puan (spesifikasyon §3–§7).
// Saf ve deterministik: saat, ağ, DB yok; rastgelelik Rng ile enjekte edilir.
import type { Rng } from '../shared/rng.ts';
import { cardLabel, createDeck, shuffle, SUIT_NAME } from './cards.ts';
import { BatakError } from './errors.ts';
import type { BatakRuleset } from './rules.ts';
import {
  SUITS,
  type BatakCommand,
  type BatakMatch,
  type BatakRound,
  type BatakRoundResult,
  type BatakRoundScore,
  type Card,
  type PlayedCard,
  type Suit,
} from './types.ts';

export const nextSeat = (s: number) => (s + 1) % 4;
export const partnerOf = (s: number) => (s + 2) % 4;
export const teamOf = (s: number) => s % 2;

// ───────────────────────── Dağıtım ─────────────────────────

export function dealBatakRound(roundNo: number, dealer: number, rng: Rng): BatakRound {
  const deck = shuffle(createDeck(() => rng.id()), (n) => rng.randInt(n));
  const hands = [0, 1, 2, 3].map((i) => deck.slice(i * 13, i * 13 + 13));
  return {
    roundNo,
    dealer,
    hands,
    phase: 'BIDDING',
    activeSeat: nextSeat(dealer), // ihale dağıtıcının solundan başlar
    bidHistory: [],
    passed: [false, false, false, false],
    highBid: null,
    bidder: null,
    trump: null,
    trumpBroken: false,
    trick: [],
    trickNo: 1,
    tricksWon: [0, 0, 0, 0],
    lastTrick: null,
    played: [],
  };
}

export function createBatakMatch(rules: BatakRuleset, rng: Rng, dealer = 0): BatakMatch {
  return {
    rules: structuredClone(rules),
    stateVersion: 1,
    status: 'ACTIVE',
    round: dealBatakRound(1, dealer, rng),
    totals: [0, 0, 0, 0],
    history: [],
    lastAction: { seat: null, text: '1. dağıtım: ihale başladı' },
  };
}

export function startNextBatakRound(m: BatakMatch, rng: Rng): BatakMatch {
  if (m.status !== 'ROUND_OVER') throw new BatakError('WRONG_PHASE');
  const n = structuredClone(m);
  n.round = dealBatakRound(m.round.roundNo + 1, nextSeat(m.round.dealer), rng);
  n.status = 'ACTIVE';
  n.stateVersion++;
  n.lastAction = { seat: null, text: `${n.round.roundNo}. dağıtım: ihale başladı` };
  return n;
}

// ───────────────────────── İhale ─────────────────────────

/** Sıradaki geçerli en düşük teklif. */
export const minNextBid = (r: BatakRound, rules: BatakRuleset) =>
  r.highBid === null ? rules.bidding.minimumBid : r.highBid + 1;

/** Diğer üç oyuncu pas geçti ve hiç teklif yok: aktif oyuncu pas geçemez (force_last). */
export const isForcedBid = (r: BatakRound, rules: BatakRuleset) =>
  rules.bidding.allPass === 'force_last' && r.highBid === null && r.passed.filter(Boolean).length === 3;

// ───────────────────────── Kart kuralları ─────────────────────────

/** Elin kazananı: koz varsa en yüksek koz, yoksa açılan renkteki en yüksek kart. */
export function resolveTrick(cards: PlayedCard[], trump: Suit): number {
  let best = cards[0];
  for (const pc of cards.slice(1)) {
    const c = pc.card;
    if (c.suit === best.card.suit && c.rank > best.card.rank) best = pc;
    else if (c.suit === trump && best.card.suit !== trump) best = pc;
  }
  return best.seat;
}

/** Oynanabilir kartlar (sunucu doğrulaması ve istemci önizlemesi aynı fonksiyonu kullanır). */
export function legalCards(hand: Card[], trick: PlayedCard[], trump: Suit, trumpBroken: boolean, rules: BatakRuleset): Card[] {
  if (trick.length === 0) {
    if (rules.play.mustLeadTrumpBeforeBroken && !trumpBroken) {
      const nonTrump = hand.filter((c) => c.suit !== trump);
      return nonTrump.length ? nonTrump : hand;
    }
    return hand;
  }
  const lead = trick[0].card.suit;
  const follow = hand.filter((c) => c.suit === lead);
  if (follow.length) {
    if (!rules.play.mustBeatIfPossible) return follow;
    // Açılan renk koz değilken elde koz varsa, renkle eli geçmek mümkün değildir.
    if (lead !== trump && trick.some((p) => p.card.suit === trump)) return follow;
    const best = Math.max(...trick.filter((p) => p.card.suit === lead).map((p) => p.card.rank));
    const over = follow.filter((c) => c.rank > best);
    return over.length ? over : follow;
  }
  const trumps = hand.filter((c) => c.suit === trump);
  if (rules.play.mustTrumpIfVoid && trumps.length) {
    if (!rules.play.mustBeatIfPossible) return trumps;
    const bestTrump = Math.max(0, ...trick.filter((p) => p.card.suit === trump).map((p) => p.card.rank));
    const over = trumps.filter((c) => c.rank > bestTrump);
    return over.length ? over : trumps;
  }
  return hand;
}

function rejectReason(card: Card, hand: Card[], trick: PlayedCard[], trump: Suit): BatakError {
  if (trick.length === 0) return new BatakError('TRUMP_NOT_BROKEN');
  const lead = trick[0].card.suit;
  if (hand.some((c) => c.suit === lead)) {
    return card.suit !== lead ? new BatakError('MUST_FOLLOW_SUIT') : new BatakError('MUST_BEAT');
  }
  return card.suit !== trump ? new BatakError('MUST_TRUMP') : new BatakError('MUST_BEAT');
}

// ───────────────────────── Komut uygulama ─────────────────────────

/**
 * Komutu uygular ve yeni durumu döndürür; geçersizse BatakError fırlatır, girdi değişmez.
 * `rng` yalnız herkes pas geçip yeniden dağıtım gerektiğinde ('redeal' kuralı) kullanılır.
 */
export function applyBatak(m: BatakMatch, seat: number, cmd: BatakCommand, rng?: Rng): BatakMatch {
  if (m.status !== 'ACTIVE') throw new BatakError('MATCH_NOT_ACTIVE');
  if (m.round.activeSeat !== seat) throw new BatakError('NOT_YOUR_TURN');
  if (!cmd || typeof cmd !== 'object') throw new BatakError('BAD_COMMAND');
  const n = structuredClone(m);
  const r = n.round;
  const rules = n.rules;

  switch (cmd.type) {
    case 'bid': {
      if (r.phase !== 'BIDDING') throw new BatakError('WRONG_PHASE');
      if (r.passed[seat]) throw new BatakError('PLAYER_ALREADY_PASSED');
      const v = Number(cmd.value);
      const min = minNextBid(r, rules);
      if (!Number.isInteger(v) || v < min || v > 13) throw new BatakError('INVALID_BID', `En az ${min}, en fazla 13.`);
      r.highBid = v;
      r.bidder = seat;
      r.bidHistory.push({ seat, value: v });
      n.lastAction = { seat, text: `${v} dedi` };
      advanceAuction(n, rng);
      break;
    }
    case 'pass': {
      if (r.phase !== 'BIDDING') throw new BatakError('WRONG_PHASE');
      if (isForcedBid(r, rules)) throw new BatakError('MUST_BID', `En az ${rules.bidding.minimumBid} teklif verin.`);
      r.passed[seat] = true;
      r.bidHistory.push({ seat, value: null });
      n.lastAction = { seat, text: 'pas' };
      advanceAuction(n, rng);
      break;
    }
    case 'choose_trump': {
      if (r.phase !== 'TRUMP') throw new BatakError('WRONG_PHASE');
      if (!SUITS.includes(cmd.suit)) throw new BatakError('INVALID_TRUMP');
      r.trump = cmd.suit;
      r.phase = 'PLAYING';
      r.activeSeat = r.bidder!; // ilk eli ihaleci açar
      n.lastAction = { seat, text: `kozu ${SUIT_NAME[cmd.suit]} seçti` };
      break;
    }
    case 'play_card': {
      if (r.phase !== 'PLAYING') throw new BatakError('WRONG_PHASE');
      const hand = r.hands[seat];
      const card = hand.find((c) => c.id === cmd.cardId);
      if (!card) throw new BatakError('CARD_NOT_OWNED');
      const legal = legalCards(hand, r.trick, r.trump!, r.trumpBroken, rules);
      if (!legal.some((c) => c.id === card.id)) throw rejectReason(card, hand, r.trick, r.trump!);
      r.hands[seat] = hand.filter((c) => c.id !== card.id);
      r.trick.push({ seat, card });
      r.played.push(card);
      if (card.suit === r.trump) r.trumpBroken = true;
      n.lastAction = { seat, text: cardLabel(card) };
      if (r.trick.length === 4) {
        const winner = resolveTrick(r.trick, r.trump!);
        r.tricksWon[winner]++;
        r.lastTrick = { cards: r.trick, winner };
        r.trick = [];
        n.lastAction = { seat: winner, text: `eli aldı (${r.trickNo}. el)` };
        if (r.trickNo === 13) {
          endRound(n);
        } else {
          r.trickNo++;
          r.activeSeat = winner;
        }
      } else {
        r.activeSeat = nextSeat(seat);
      }
      break;
    }
    default:
      throw new BatakError('BAD_COMMAND');
  }
  n.stateVersion++;
  return n;
}

function advanceAuction(n: BatakMatch, rng?: Rng) {
  const r = n.round;
  const passedCount = r.passed.filter(Boolean).length;
  // Teklif varsa ve diğer herkes pas geçtiyse ya da 13 söylendiyse ihale kapanır.
  if (r.bidder !== null && (passedCount === 3 || r.highBid === 13)) {
    r.phase = 'TRUMP';
    r.activeSeat = r.bidder;
    n.lastAction = { seat: r.bidder, text: `ihaleyi ${r.highBid} ile aldı` };
    return;
  }
  if (passedCount === 4) {
    // Yalnız 'redeal' kuralında mümkün: aynı dağıtım numarasıyla yeniden dağıt, dağıtıcı ilerler.
    if (!rng) throw new Error('Yeniden dağıtım için rng gerekli');
    n.round = dealBatakRound(r.roundNo, nextSeat(r.dealer), rng);
    n.lastAction = { seat: null, text: 'Herkes pas geçti, kartlar yeniden dağıtıldı' };
    return;
  }
  let s = nextSeat(r.activeSeat);
  while (r.passed[s]) s = nextSeat(s);
  r.activeSeat = s;
}

// ───────────────────────── Puan ─────────────────────────

function endRound(n: BatakMatch) {
  const r = n.round;
  r.phase = 'ENDED';
  const result = calculateBatakScore(r, n.rules);
  n.history.push(result);
  for (const s of result.scores) n.totals[s.seat] += s.finalScore;
  n.status = r.roundNo >= n.rules.match.roundLimit ? 'ENDED' : 'ROUND_OVER';
  n.lastAction = {
    seat: result.bidder,
    text: result.made ? `sözünü tuttu (${result.bidderTricks}/${result.bid})` : `battı (${result.bidderTricks}/${result.bid})`,
  };
}

export function calculateBatakScore(r: BatakRound, rules: BatakRuleset): BatakRoundResult {
  const bidder = r.bidder!;
  const bid = r.highBid!;
  const partnership = rules.mode === 'partnership';
  const bidderTricks = partnership ? r.tricksWon[bidder] + r.tricksWon[partnerOf(bidder)] : r.tricksWon[bidder];
  const made = bidderTricks >= bid;
  const contract = made ? bid * 10 : -bid * 10;

  const scores: BatakRoundScore[] = [0, 1, 2, 3].map((seat) => {
    const tricks = r.tricksWon[seat];
    if (partnership) {
      const myTeam = teamOf(seat) === teamOf(bidder);
      const teamTricks = tricks + r.tricksWon[partnerOf(seat)];
      const score = myTeam ? contract : teamTricks * rules.scoring.opponentsPerTrick;
      return {
        seat,
        bid: seat === bidder ? bid : null,
        tricks,
        baseScore: score,
        finalScore: score,
        reason: myTeam
          ? `İhaleci takım: ${bidderTricks}/${bid} el, ${made ? 'tuttu' : 'battı'}`
          : rules.scoring.opponentsPerTrick
            ? `Rakip takım: ${teamTricks} el × ${rules.scoring.opponentsPerTrick}`
            : `Rakip takım: ${teamTricks} el`,
      };
    }
    if (seat === bidder) {
      return { seat, bid, tricks, baseScore: contract, finalScore: contract, reason: `İhale ${bid}, aldığı ${tricks}: ${made ? 'tuttu' : 'battı'}` };
    }
    const score = tricks * rules.scoring.nonBidderPerTrick;
    return { seat, bid: null, tricks, baseScore: score, finalScore: score, reason: `${tricks} el × ${rules.scoring.nonBidderPerTrick}` };
  });
  return { roundNo: r.roundNo, bidder, bid, trump: r.trump!, tricksWon: r.tricksWon.slice(), made, bidderTricks, scores };
}

/** Maç sıralaması. Tekli: koltuklar puana göre. Eşli: takım numaraları (0 = 1–3. koltuk). */
export function batakRanking(m: Pick<BatakMatch, 'totals' | 'rules'>): number[] {
  if (m.rules.mode === 'partnership') return [0, 1].sort((a, b) => m.totals[b] - m.totals[a] || a - b);
  return [0, 1, 2, 3].sort((a, b) => m.totals[b] - m.totals[a] || a - b);
}

// ───────────────────────── Zaman aşımı ─────────────────────────

const SUIT_ORDER: Suit[] = ['S', 'H', 'D', 'C'];

/** Süre dolunca deterministik yasal hamle (§11). */
export function batakTimeoutCommand(m: BatakMatch): BatakCommand {
  const r = m.round;
  const hand = r.hands[r.activeSeat];
  if (r.phase === 'BIDDING') {
    return isForcedBid(r, m.rules) ? { type: 'bid', value: m.rules.bidding.minimumBid } : { type: 'pass' };
  }
  if (r.phase === 'TRUMP') {
    const len = (s: Suit) => hand.filter((c) => c.suit === s).length;
    const suit = [...SUIT_ORDER].sort((a, b) => len(b) - len(a) || SUIT_ORDER.indexOf(a) - SUIT_ORDER.indexOf(b))[0];
    return { type: 'choose_trump', suit };
  }
  const legal = legalCards(hand, r.trick, r.trump!, r.trumpBroken, m.rules);
  const card = [...legal].sort((a, b) => a.rank - b.rank || SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit))[0];
  return { type: 'play_card', cardId: card.id };
}

// ───────────────────────── Oyuncuya özel görünüm ─────────────────────────

export interface BatakView {
  game: 'batak';
  yourSeat: number;
  stateVersion: number;
  status: BatakMatch['status'];
  roundNo: number;
  roundLimit: number;
  phase: BatakRound['phase'];
  activeSeat: number;
  dealer: number;
  hand: Card[];
  handCounts: number[];
  bidHistory: BatakRound['bidHistory'];
  passed: boolean[];
  highBid: number | null;
  bidder: number | null;
  minNextBid: number;
  mustBid: boolean;
  trump: Suit | null;
  trumpBroken: boolean;
  trick: PlayedCard[];
  trickNo: number;
  tricksWon: number[];
  lastTrick: BatakRound['lastTrick'];
  /** Sıra sizdeyse oynayabileceğiniz kartlar. */
  legalCardIds: string[];
  totals: number[];
  lastAction: BatakMatch['lastAction'];
  lastResult: BatakRoundResult | null;
  history: { roundNo: number; bidder: number; bid: number; made: boolean; deltas: number[] }[];
  rules: BatakRuleset;
}

/** Yalnız kendi eli + herkese açık bilgi. Rakiplerin ve eşin kartları asla gönderilmez. */
export function batakViewFor(m: BatakMatch, seat: number): BatakView {
  const r = m.round;
  const myTurn = m.status === 'ACTIVE' && r.activeSeat === seat && r.phase === 'PLAYING';
  return {
    game: 'batak',
    yourSeat: seat,
    stateVersion: m.stateVersion,
    status: m.status,
    roundNo: r.roundNo,
    roundLimit: m.rules.match.roundLimit,
    phase: r.phase,
    activeSeat: r.activeSeat,
    dealer: r.dealer,
    hand: r.hands[seat] ?? [],
    handCounts: r.hands.map((h) => h.length),
    bidHistory: r.bidHistory,
    passed: r.passed,
    highBid: r.highBid,
    bidder: r.bidder,
    minNextBid: minNextBid(r, m.rules),
    mustBid: isForcedBid(r, m.rules),
    trump: r.trump,
    trumpBroken: r.trumpBroken,
    trick: r.trick,
    trickNo: r.trickNo,
    tricksWon: r.tricksWon,
    lastTrick: r.lastTrick,
    legalCardIds: myTurn ? legalCards(r.hands[seat], r.trick, r.trump!, r.trumpBroken, m.rules).map((c) => c.id) : [],
    totals: m.totals,
    lastAction: m.lastAction,
    lastResult: m.status !== 'ACTIVE' ? (m.history[m.history.length - 1] ?? null) : null,
    history: m.history.map((h) => ({ roundNo: h.roundNo, bidder: h.bidder, bid: h.bid, made: h.made, deltas: h.scores.map((s) => s.finalScore) })),
    rules: m.rules,
  };
}
