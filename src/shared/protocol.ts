// İstemci ↔ sunucu WebSocket mesaj sözleşmesi.
import type { GameView } from '../engine/game.ts';
import type { BotLevel, TableOptions } from '../engine/rules.ts';
import type { Command } from '../engine/types.ts';

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
  code: string;
  name: string;
  isPrivate: boolean;
  status: 'WAITING' | 'PLAYING';
  options: Required<TableOptions>;
  rulesSummary: string[];
  seats: SeatView[];
  youAreOwner: boolean;
}

export interface LobbySummary {
  id: string;
  name: string;
  players: number;
  status: 'WAITING' | 'PLAYING';
  roundLimit: number;
  turnSeconds: number;
  allowPairs: boolean;
  teamMode: boolean;
  /** Masadaki botların seviyesi; farklı seviyeler varsa 'mixed'. */
  botLevel: BotLevel | 'mixed';
}

export interface PlayerInfo {
  name: string;
  isBot: boolean;
  /** Yalnız baştan bot olan koltuklar için. */
  botLevel?: BotLevel;
  connected: boolean;
  botControlled: boolean;
}

export interface ClientGameView extends GameView {
  matchId: string;
  players: PlayerInfo[];
  deadlineAt: number | null;
  nextRoundAt: number | null;
  serverTime: number;
}

export type ClientMsg =
  | { t: 'hello'; token?: string; name?: string }
  | { t: 'setName'; name: string }
  | { t: 'lobby.list' }
  | { t: 'lobby.create'; name?: string; isPrivate?: boolean; options?: TableOptions }
  | { t: 'lobby.join'; lobbyId?: string; code?: string }
  | { t: 'lobby.leave' }
  | { t: 'lobby.ready'; ready: boolean }
  | { t: 'lobby.sit'; seat: number }
  | { t: 'lobby.addBot'; seat?: number }
  | { t: 'lobby.removeBot'; seat: number }
  /** seat verilirse yalnız o bot koltuğu; verilmezse tüm botlar ve yeni eklenecek botların varsayılanı. */
  | { t: 'lobby.setBotLevel'; level: BotLevel; seat?: number }
  | { t: 'lobby.start' }
  | { t: 'quick.bots'; options?: TableOptions }
  | { t: 'quick.match' }
  | { t: 'game.command'; commandId: string; expectedVersion: number; command: Command }
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
