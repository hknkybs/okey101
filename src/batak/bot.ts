// Batak botu. Yalnız kendi elini ve herkese açık bilgiyi (oynanmış kartlar, ihale) kullanır.
import { isForcedBid, legalCards, minNextBid, partnerOf, resolveTrick } from './game.ts';
import { SUITS, type BatakCommand, type BatakMatch, type Card, type PlayedCard, type Suit } from './types.ts';

export interface BatakBotOptions {
  /** 'smart' (Normal) varsayılan; 'basic' (Kolay) basit tahmin ve oyun. */
  style?: 'smart' | 'basic';
}

const bySuit = (hand: Card[], s: Suit) => hand.filter((c) => c.suit === s).sort((a, b) => b.rank - a.rank);

/** Verilen koz rengiyle elin kaç el alabileceğine dair kaba tahmin. */
export function estimateTricks(hand: Card[], trump: Suit): number {
  let est = 0;
  const trumpLen = bySuit(hand, trump).length;
  for (const s of SUITS) {
    const cards = bySuit(hand, s);
    const len = cards.length;
    const has = (r: number) => cards.some((c) => c.rank === r);
    if (s === trump) {
      if (has(14)) est += 1;
      if (has(13)) est += len >= 2 ? 1 : 0.5;
      if (has(12)) est += len >= 3 ? 0.8 : 0.3;
      if (has(11)) est += len >= 4 ? 0.5 : 0;
      est += Math.max(0, len - 3) * 0.9; // uzun koz
    } else {
      if (has(14)) est += 0.95;
      if (has(13)) est += len >= 2 ? 0.75 : 0.2;
      if (has(12)) est += len >= 3 ? 0.35 : 0;
      // kısa renkte kozla kesme imkânı
      if (trumpLen >= 3) est += len === 0 ? 1 : len === 1 ? 0.6 : len === 2 ? 0.25 : 0;
    }
  }
  return est;
}

export function bestTrump(hand: Card[]): { suit: Suit; est: number } {
  return SUITS.map((suit) => ({ suit, est: estimateTricks(hand, suit) + bySuit(hand, suit).length * 0.01 })).sort(
    (a, b) => b.est - a.est,
  )[0];
}

export function batakBotCommand(m: BatakMatch, opts: BatakBotOptions = {}): BatakCommand {
  const smart = opts.style !== 'basic';
  const r = m.round;
  const seat = r.activeSeat;
  const hand = r.hands[seat];
  const rules = m.rules;

  if (r.phase === 'BIDDING') {
    const need = minNextBid(r, rules);
    if (isForcedBid(r, rules)) return { type: 'bid', value: need };
    const own = bestTrump(hand).est;
    let canTake = own;
    if (rules.mode === 'partnership') {
      const partner = partnerOf(seat);
      // Eşin kendi teklifi gücünü gösterir; hiç teklif vermediyse ortalama katkı varsayılır.
      const partnerBid = Math.max(0, ...r.bidHistory.filter((b) => b.seat === partner && b.value !== null).map((b) => b.value!));
      if (smart) {
        if (r.bidder === partner) return { type: 'pass' }; // eşin ihalesini gereksiz yere geçme
        canTake += partnerBid ? Math.max(3, partnerBid - 4.5) : r.passed[partner] ? 2 : 2.75;
      }
    }
    const max = smart ? Math.floor(canTake + 0.25) : Math.floor(own);
    return max >= need && need <= 13 ? { type: 'bid', value: need } : { type: 'pass' };
  }

  if (r.phase === 'TRUMP') return { type: 'choose_trump', suit: bestTrump(hand).suit };

  const legal = legalCards(hand, r.trick, r.trump!, r.trumpBroken, rules);
  const card = smart ? smartPlay(m, legal) : basicPlay(m, legal);
  return { type: 'play_card', cardId: card.id };
}

const low = (cs: Card[]) => [...cs].sort((a, b) => a.rank - b.rank)[0];
const high = (cs: Card[]) => [...cs].sort((a, b) => b.rank - a.rank)[0];

/** Bu kart elde şu an kazanıyor olur muydu? */
function wouldWin(trick: PlayedCard[], seat: number, card: Card, trump: Suit) {
  return resolveTrick([...trick, { seat, card }], trump) === seat;
}

function basicPlay(m: BatakMatch, legal: Card[]): Card {
  const r = m.round;
  if (r.trick.length === 0) return high(legal);
  const winners = legal.filter((c) => wouldWin(r.trick, r.activeSeat, c, r.trump!));
  return winners.length ? high(winners) : low(legal);
}

function smartPlay(m: BatakMatch, legal: Card[]): Card {
  const r = m.round;
  const seat = r.activeSeat;
  const trump = r.trump!;
  const hand = r.hands[seat];
  const team = m.rules.mode === 'partnership';
  const partner = partnerOf(seat);
  const onBidderSide = r.bidder === seat || (team && r.bidder === partner);

  // Bir kart "patron" mu: aynı renkte daha yüksek, henüz oynanmamış ve bende olmayan kart kalmadı mı?
  const gone = new Set(r.played.map((c) => `${c.suit}${c.rank}`));
  const mine = new Set(hand.map((c) => `${c.suit}${c.rank}`));
  const isMaster = (c: Card) => {
    for (let k = c.rank + 1; k <= 14; k++) if (!gone.has(`${c.suit}${k}`) && !mine.has(`${c.suit}${k}`)) return false;
    return true;
  };
  const trumpsOut = 13 - r.played.filter((c) => c.suit === trump).length - hand.filter((c) => c.suit === trump).length;

  if (r.trick.length === 0) {
    // İhaleci tarafı: elde patron koz varsa ve dışarıda koz kaldıysa kozları topla.
    const masterTrumps = legal.filter((c) => c.suit === trump && isMaster(c));
    if (onBidderSide && masterTrumps.length && trumpsOut > 0) return high(masterTrumps);
    // Patron koz olmayan kart: güvenli el.
    const masters = legal.filter((c) => c.suit !== trump && isMaster(c));
    if (masters.length) return high(masters);
    // Yoksa en uzun koz dışı renkten küçük kart.
    const nonTrump = legal.filter((c) => c.suit !== trump);
    const pool = nonTrump.length ? nonTrump : legal;
    const longest = [...SUITS].sort((a, b) => bySuit(pool, b).length - bySuit(pool, a).length)[0];
    return low(bySuit(pool, longest).length ? bySuit(pool, longest) : pool);
  }

  const lastToPlay = r.trick.length === 3;
  const currentWinner = resolveTrick(r.trick, trump);
  const partnerWinning = team && currentWinner === partner;
  const winners = legal.filter((c) => wouldWin(r.trick, seat, c, trump));

  // Eş eli alıyorsa ve sonuncuysak ya da eşin kartı patronsa: kart harcama.
  if (partnerWinning) {
    const partnerCard = r.trick.find((p) => p.seat === partner)!.card;
    const safe = lastToPlay || partnerCard.suit === trump || isMaster(partnerCard);
    if (safe) return discardChoice(legal, trump, isMaster);
  }

  if (winners.length) {
    if (lastToPlay) return low(winners);
    // Sonra oynayanlar da var: patron kartla kazanabiliyorsak onu, yoksa en düşük kazananı oyna.
    const masterWinners = winners.filter((c) => c.suit === trump || isMaster(c));
    return masterWinners.length ? low(masterWinners) : low(winners);
  }
  return discardChoice(legal, trump, isMaster);
}

/** Kaybedilecek elde: patron ve koz harcamadan en düşük kartı at; tercihen en kısa renkten. */
function discardChoice(legal: Card[], trump: Suit, isMaster: (c: Card) => boolean): Card {
  const plain = legal.filter((c) => c.suit !== trump && !isMaster(c));
  const pool = plain.length ? plain : legal.filter((c) => c.suit !== trump).length ? legal.filter((c) => c.suit !== trump) : legal;
  const shortest = [...SUITS].filter((s) => bySuit(pool, s).length).sort((a, b) => bySuit(pool, a).length - bySuit(pool, b).length)[0];
  return low(bySuit(pool, shortest));
}
