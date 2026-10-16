// Batak oyun motorunun tipleri (ihaleli tekli ve ihaleli eşli).
import type { BatakRuleset } from './rules.ts';

export type Suit = 'S' | 'H' | 'D' | 'C'; // Maça, Kupa, Karo, Sinek
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

/** rank: 2..10, 11=Vale, 12=Kız, 13=Papaz, 14=As */
export interface Card {
  id: string;
  suit: Suit;
  rank: number;
}

export interface PlayedCard {
  seat: number;
  card: Card;
}

export type BatakPhase = 'BIDDING' | 'TRUMP' | 'PLAYING' | 'ENDED';

export interface BidEntry {
  seat: number;
  value: number | null; // null = pas
}

export interface BatakRound {
  roundNo: number;
  dealer: number;
  hands: Card[][];
  phase: BatakPhase;
  activeSeat: number;
  // ihale
  bidHistory: BidEntry[];
  passed: boolean[];
  highBid: number | null;
  bidder: number | null;
  // oyun
  trump: Suit | null;
  trumpBroken: boolean;
  trick: PlayedCard[];
  trickNo: number; // 1..13
  tricksWon: number[];
  lastTrick: { cards: PlayedCard[]; winner: number } | null;
  played: Card[]; // bu dağıtımda oynanmış tüm kartlar (herkese açık bilgi)
}

export type BatakCommand =
  | { type: 'bid'; value: number }
  | { type: 'pass' }
  | { type: 'choose_trump'; suit: Suit }
  | { type: 'play_card'; cardId: string };

export interface BatakRoundScore {
  seat: number;
  bid: number | null; // yalnız ihaleci için
  tricks: number;
  baseScore: number;
  finalScore: number;
  reason: string;
}

export interface BatakRoundResult {
  roundNo: number;
  bidder: number;
  bid: number;
  trump: Suit;
  tricksWon: number[];
  /** ihaleci (veya takımı) sözünü tuttu mu */
  made: boolean;
  /** eşli oyunda ihaleci takımın toplam aldığı el */
  bidderTricks: number;
  scores: BatakRoundScore[];
}

export type BatakStatus = 'ACTIVE' | 'ROUND_OVER' | 'ENDED';

export interface BatakMatch {
  rules: BatakRuleset;
  stateVersion: number;
  status: BatakStatus;
  round: BatakRound;
  /** Tekli: oyuncu toplamı. Eşli: takım toplamı her iki eşte aynı değerle tutulur. */
  totals: number[];
  history: BatakRoundResult[];
  lastAction: { seat: number | null; text: string };
}
