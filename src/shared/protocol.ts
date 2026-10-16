// İstemci ↔ sunucu WebSocket mesaj sözleşmesi.
import type { BatakView } from '../batak/game.ts';
import type { BatakTableOptions } from '../batak/rules.ts';
import type { BatakCommand } from '../batak/types.ts';
import type { GameView } from '../engine/game.ts';
import type { BotLevel, TableOptions } from '../engine/rules.ts';
import type { Command } from '../engine/types.ts';

export type GameId = 'okey' | 'batak';
export const GAME_NAME: Record<GameId, string> = { okey: '101 Okey', batak: 'Batak' };

/** Her iki oyunun masa ayarlarında ortak olan alanlar (bekleme odası bunları kullanır). */
export type LobbyOptions = (Required<TableOptions> & { game?: 'okey' }) | (Required<BatakTableOptions> & { game?: 'batak' });

export interface SeatView {
  seat: number;
  name: string | null;
  isBot: boolean;
  botLevel?: BotLevel;
  ready: boolean;
  connected: boolean;
  botControlled: boolean;
  isOwner: boolean;
  isYou: boolean;
}

export interface LobbyView {
  id: string;
  game: GameId;
  code: string;
  name: string;
  isPrivate: boolean;
  status: 'WAITING' | 'PLAYING';
  options: LobbyOptions;
  rulesSummary: string[];
  seats: SeatView[];
  youAreOwner: boolean;
}

export interface LobbySummary {
  id: string;
  game: GameId;
  name: string;
  players: number;
  status: 'WAITING' | 'PLAYING';
  /** Liste satırında gösterilen kısa özet (ör. "10 el · 30 sn · eşli · kolay bot"). */
  info: string;
}

export interface PlayerInfo {
  name: string;
  isBot: boolean;
  /** Yalnız baştan bot olan koltuklar için. */
  botLevel?: BotLevel;
  connected: boolean;
  botControlled: boolean;
}

/** Sunucunun her oyun görünümüne eklediği ortak alanlar. */
export interface RoomViewExtras {
  matchId: string;
  players: PlayerInfo[];
  deadlineAt: number | null;
  nextRoundAt: number | null;
  serverTime: number;
}

export type OkeyClientView = GameView & RoomViewExtras & { game: 'okey' };
export type BatakClientView = BatakView & RoomViewExtras;
export type ClientGameView = OkeyClientView | BatakClientView;

export type ClientMsg =
  | { t: 'hello'; token?: string; name?: string }
  | { t: 'setName'; name: string }
  | { t: 'lobby.list' }
  | { t: 'lobby.create'; game?: GameId; name?: string; isPrivate?: boolean; options?: TableOptions | BatakTableOptions }
  | { t: 'lobby.join'; lobbyId?: string; code?: string }
  | { t: 'lobby.leave' }
  | { t: 'lobby.ready'; ready: boolean }
  | { t: 'lobby.sit'; seat: number }
  | { t: 'lobby.addBot'; seat?: number }
  | { t: 'lobby.removeBot'; seat: number }
  /** seat verilirse yalnız o bot koltuğu; verilmezse tüm botlar ve yeni eklenecek botların varsayılanı. */
  | { t: 'lobby.setBotLevel'; level: BotLevel; seat?: number }
  | { t: 'lobby.start' }
  | { t: 'quick.bots'; game?: GameId; options?: TableOptions | BatakTableOptions }
  | { t: 'quick.match'; game?: GameId }
  | { t: 'game.command'; commandId: string; expectedVersion: number; command: Command | BatakCommand }
  | { t: 'game.leave' }
  | { t: 'game.resume' }
  | { t: 'match.again' }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'welcome'; token: string; userId: string; name: string }
  | { t: 'lobbies'; list: LobbySummary[] }
  | { t: 'lobby'; lobby: LobbyView | null }
  | { t: 'game'; view: ClientGameView | null }
  | { t: 'rejected'; commandId: string; code: string; message: string }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong'; serverTime: number };
