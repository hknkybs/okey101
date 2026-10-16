import { SUITS, type Card, type Suit } from './types.ts';

export const SUIT_NAME: Record<Suit, string> = { S: 'Maça', H: 'Kupa', D: 'Karo', C: 'Sinek' };
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const isRed = (s: Suit) => s === 'H' || s === 'D';

/** Kart köşesindeki harf: iskambil destelerindeki uluslararası harfler (J Vale, Q Kız, K Papaz, A As). */
export function rankLabel(rank: number): string {
  return rank <= 10 ? String(rank) : { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank as 11 | 12 | 13 | 14];
}

const RANK_NAME: Record<number, string> = { 11: 'Vale', 12: 'Kız', 13: 'Papaz', 14: 'As' };

export function cardLabel(c: Card): string {
  return `${SUIT_NAME[c.suit]} ${RANK_NAME[c.rank] ?? c.rank}`;
}

/** 52 kart, joker yok. */
export function createDeck(makeId: () => string): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (let rank = 2; rank <= 14; rank++) deck.push({ id: makeId(), suit, rank });
  return deck;
}

export function shuffle<T>(arr: T[], randInt: (n: number) => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Görüntü sırası: renkler siyah/kırmızı dönüşümlü (♠ ♥ ♣ ♦), koz varsa en başta; renk içinde büyükten küçüğe. */
export function sortHand(hand: Card[], trump: Suit | null): Card[] {
  const base: Suit[] = ['S', 'H', 'C', 'D'];
  const order = trump ? [trump, ...base.filter((s) => s !== trump)] : base;
  return [...hand].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || b.rank - a.rank);
}
