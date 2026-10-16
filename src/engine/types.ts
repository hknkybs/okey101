// Oyun motorunun ortak tipleri. Hem sunucu hem istemci bu dosyayı kullanır.

export type Color = 'R' | 'Y' | 'B' | 'K'; // Kırmızı, Sarı, Mavi, Siyah
export const COLORS: Color[] = ['R', 'Y', 'B', 'K'];
export const SEATS = 4;

/** NORMAL (N) veya SAHTE OKEY (F). Sahte okeyde renk/sayı tutulmaz. */
export interface Tile {
  id: string;
  kind: 'N' | 'F';
  color?: Color;
  number?: number;
}

export interface Face {
  color: Color;
  number: number;
}

/** Masadaki bir perin içindeki taş + temsil ettiği değer. */
export interface PlacedTile {
  tile: Tile;
  as: Face;
}

export type MeldKind = 'run' | 'group' | 'pair';

export interface Meld {
  id: string;
  owner: number;
  kind: MeldKind;
  tiles: PlacedTile[];
}

export type OpenedType = null | 'melds' | 'pairs';

export interface JokerAssignment {
  tileId: string;
  color: Color;
  number: number;
}

export interface MeldInput {
  tileIds: string[];
  jokerAssignments?: JokerAssignment[];
}

export type OpenPayload =
  | { kind: 'melds'; melds: MeldInput[] }
  | { kind: 'pairs'; pairs: string[][] };

export type Command =
  | { type: 'draw_stock' }
  | { type: 'take_discard'; open?: OpenPayload }
  | { type: 'open_melds'; melds: MeldInput[] }
  | { type: 'open_pairs'; pairs: string[][] }
  | { type: 'layoff'; meldId: string; tileId: string; side?: 'start' | 'end' }
  | { type: 'swap_joker'; meldId: string; tileId: string }
  | { type: 'discard'; tileId: string };

export type Phase = 'DRAW' | 'ACTIONS' | 'ENDED';

export interface RoundState {
  roundNo: number;
  dealer: number;
  starter: number;
  indicator: Tile;
  okey: Face;
  stock: Tile[];
  hands: Tile[][];
  discards: Tile[][];
  melds: Meld[];
  opened: OpenedType[];
  phase: Phase;
  activeSeat: number;
  turnNo: number;
  meldSeq: number;
  /** Sıradaki oyuncunun bu tur masadan aldığı okeyler (o tur kullanma şartı için). */
  swappedJokers: string[];
}

export interface ScoreModifier {
  code: string;
  delta: number;
}

export interface RoundScore {
  seat: number;
  baseDelta: number;
  modifiers: ScoreModifier[];
  multiplier: number;
  finalDelta: number;
  reason: string;
}

export type FinishType = 'normal' | 'okey' | 'pairs' | 'okey_pairs' | 'stock_empty';

export interface RoundResult {
  roundNo: number;
  winner: number | null;
  finishType: FinishType;
  scores: RoundScore[];
  hands: Tile[][];
  okey: Face;
}

export type MatchStatus = 'ACTIVE' | 'ROUND_OVER' | 'ENDED';

export interface MatchState {
  rules: import('./rules.ts').Ruleset;
  stateVersion: number;
  status: MatchStatus;
  round: RoundState;
  totals: number[];
  wins: number[];
  history: RoundResult[];
  lastAction: { seat: number | null; text: string };
}
