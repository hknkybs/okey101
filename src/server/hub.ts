// Kimlik (misafir), lobi, eşleştirme ve mesaj yönlendirme. Bellek içi modüler monolit.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { buildBatakRules, describeBatakRules, normalizeBatakOptions, type BatakTableOptions } from '../batak/rules.ts';
import { BOT_LEVEL_LABEL, buildRules, describeRules, type BotLevel, type TableOptions } from '../engine/rules.ts';
import { GAME_NAME, type ClientMsg, type GameId, type LobbyOptions, type LobbySummary, type LobbyView, type ServerMsg } from '../shared/protocol.ts';
import { batakAdapter, okeyAdapter, type GameAdapter } from './adapters.ts';
import { log } from './log.ts';
import { MatchRoom, type RoomSeat } from './room.ts';

interface User {
  id: string;
  tokenHash: string;
  name: string;
  sockets: Set<WebSocket>;
  lobbyId: string | null;
  lastSeen: number;
}

interface LobbySeat {
  userId: string | null;
  isBot: boolean;
  botName?: string;
  botLevel?: BotLevel;
  ready: boolean;
}

interface Lobby {
  id: string;
  game: GameId;
  code: string;
  name: string;
  ownerId: string;
  isPrivate: boolean;
  options: LobbyOptions;
  seats: LobbySeat[];
  room: MatchRoom | null;
  createdAt: number;
  emptySince: number | null;
}

const BOT_NAMES = ['Bot Ayşe', 'Bot Mehmet', 'Bot Zeynep', 'Bot Ali', 'Bot Elif', 'Bot Can'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function inviteCode() {
  const bytes = randomBytes(6);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function sanitizeName(raw: unknown): string {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 20);
  return s || `Misafir${Math.floor(Math.random() * 9000 + 1000)}`;
}

// ─────────────── oyuna özel masa ayarları ───────────────

const asGame = (g: unknown): GameId => (g === 'batak' ? 'batak' : 'okey');

function normalizeFor(game: GameId, o: unknown = {}): LobbyOptions {
  return game === 'batak'
    ? { ...normalizeBatakOptions(o as BatakTableOptions), game: 'batak' }
    : { ...normalizeOptions(o as TableOptions), game: 'okey' };
}

function rulesSummaryFor(game: GameId, o: LobbyOptions): string[] {
  return game === 'batak' ? describeBatakRules(buildBatakRules(o as BatakTableOptions)) : describeRules(buildRules(o as TableOptions));
}

function adapterFor(game: GameId, o: LobbyOptions): GameAdapter<unknown, { type: string }> {
  const a = game === 'batak' ? batakAdapter(buildBatakRules(o as BatakTableOptions)) : okeyAdapter(buildRules(o as TableOptions));
  return a as unknown as GameAdapter<unknown, { type: string }>;
}

/** Masa listesi satırı için kısa özet. */
function infoFor(game: GameId, o: LobbyOptions, botLevel: BotLevel | 'mixed'): string {
  const parts: string[] = [];
  if (game === 'batak') {
    const b = o as Required<BatakTableOptions>;
    parts.push(`${b.roundLimit} dağıtım`, `${b.turnSeconds} sn`, b.teamMode ? 'eşli' : 'tekli', `min ihale ${b.minBid}`);
  } else {
    const k = o as Required<TableOptions>;
    parts.push(`${k.roundLimit} el`, `${k.turnSeconds} sn`);
    if (k.allowPairs) parts.push('çift açık');
    if (k.teamMode) parts.push('eşli');
  }
  if (botLevel === 'easy') parts.push('kolay bot');
  else if (botLevel === 'mixed') parts.push('karışık bot');
  return parts.join(' · ');
}

function normalizeOptions(o: TableOptions = {}): Required<TableOptions> {
  const r = buildRules(o);
  return {
    roundLimit: r.match.roundLimit,
    turnSeconds: r.round.maxTurnSeconds,
    allowPairs: r.opening.allowPairs,
    onlyOwnMelds: r.layoff.onlyOwnMelds,
    allowJokerSwap: r.joker.allowSwap,
    jokerSwapMustUse: r.joker.swapMustUseSameTurn,
    teamMode: r.match.teamMode,
    partnerOfWinnerExempt: r.scoring.partnerOfWinnerExempt,
    botLevel: o.botLevel === 'easy' ? 'easy' : 'normal',
  };
}

export class Hub {
  private users = new Map<string, User>(); // id → user
  private byToken = new Map<string, string>(); // sha256(token) → userId
  private lobbies = new Map<string, Lobby>();
  private socketUser = new WeakMap<WebSocket, string>();

  constructor() {
    setInterval(() => this.sweep(), 5000).unref();
  }

  // ─────────────── bağlantı ───────────────

  onClose(ws: WebSocket) {
    const uid = this.socketUser.get(ws);
    if (!uid) return;
    const u = this.users.get(uid);
    if (!u) return;
    u.sockets.delete(ws);
    u.lastSeen = Date.now();
    if (u.sockets.size === 0) this.updatePresence(u, false);
  }

  handle(ws: WebSocket, msg: ClientMsg) {
    if (msg.t === 'hello') return this.hello(ws, msg.token, msg.name);
    if (msg.t === 'ping') return this.send(ws, { t: 'pong', serverTime: Date.now() });
    const uid = this.socketUser.get(ws);
    const u = uid ? this.users.get(uid) : undefined;
    if (!u) return this.send(ws, { t: 'error', code: 'UNAUTHENTICATED', message: 'Oturum bulunamadı.' });
    u.lastSeen = Date.now();

    switch (msg.t) {
      case 'setName':
        u.name = sanitizeName(msg.name);
        this.send(ws, { t: 'welcome', token: '', userId: u.id, name: u.name });
        if (u.lobbyId) this.pushLobby(this.lobbies.get(u.lobbyId)!);
        return;
      case 'lobby.list':
        return this.send(ws, { t: 'lobbies', list: this.lobbyList() });
      case 'lobby.create': {
        const lobby = this.createLobby(u, asGame(msg.game), msg.name, !!msg.isPrivate, msg.options);
        this.joinLobby(u, lobby);
        return;
      }
      case 'lobby.join': {
        const lobby = msg.code
          ? [...this.lobbies.values()].find((l) => l.code === String(msg.code).toUpperCase().trim())
          : msg.lobbyId
            ? this.lobbies.get(msg.lobbyId)
            : undefined;
        if (!lobby) return this.err(u, 'LOBBY_NOT_FOUND', 'Masa bulunamadı.');
        if (lobby.isPrivate && !msg.code && lobby.ownerId !== u.id) return this.err(u, 'LOBBY_PRIVATE', 'Bu masa davetle girilir.');
        return this.joinLobby(u, lobby);
      }
      case 'lobby.leave':
        return this.leaveLobby(u);
      case 'lobby.ready': {
        const lobby = this.lobbyOf(u);
        if (!lobby || lobby.room) return;
        const seat = lobby.seats.find((s) => s.userId === u.id);
        if (seat) seat.ready = !!msg.ready;
        this.pushLobby(lobby);
        return;
      }
      case 'lobby.sit': {
        const lobby = this.lobbyOf(u);
        const n = Number(msg.seat);
        if (!lobby || lobby.room || !(n >= 0 && n < 4)) return;
        const target = lobby.seats[n];
        if (target.userId || target.isBot) return this.err(u, 'SEAT_TAKEN', 'Koltuk dolu.');
        const cur = lobby.seats.find((s) => s.userId === u.id);
        if (cur) Object.assign(cur, { userId: null, ready: false });
        Object.assign(target, { userId: u.id, ready: false });
        this.pushLobby(lobby);
        return;
      }
      case 'lobby.addBot': {
        const lobby = this.lobbyOf(u);
        if (!lobby || lobby.room || lobby.ownerId !== u.id) return;
        const seats = msg.seat !== undefined ? [lobby.seats[Number(msg.seat)]] : lobby.seats;
        for (const s of seats) {
          if (s && !s.userId && !s.isBot) {
            Object.assign(s, { isBot: true, botName: this.botName(lobby), botLevel: lobby.options.botLevel, ready: true });
            if (msg.seat !== undefined) break;
          }
        }
        this.pushLobby(lobby);
        return;
      }
      case 'lobby.setBotLevel': {
        const lobby = this.lobbyOf(u);
        if (!lobby || lobby.room || lobby.ownerId !== u.id) return;
        const level: BotLevel = msg.level === 'easy' ? 'easy' : 'normal';
        if (msg.seat !== undefined) {
          const s = lobby.seats[Number(msg.seat)];
          if (!s?.isBot) return;
          s.botLevel = level;
        } else {
          lobby.options.botLevel = level;
          for (const s of lobby.seats) if (s.isBot) s.botLevel = level;
        }
        this.pushLobby(lobby);
        this.broadcastLobbyList();
        return;
      }
      case 'lobby.removeBot': {
        const lobby = this.lobbyOf(u);
        if (!lobby || lobby.room || lobby.ownerId !== u.id) return;
        const s = lobby.seats[Number(msg.seat)];
        if (s?.isBot) Object.assign(s, { isBot: false, botName: undefined, botLevel: undefined, ready: false });
        this.pushLobby(lobby);
        return;
      }
      case 'lobby.start': {
        const lobby = this.lobbyOf(u);
        if (!lobby || lobby.room) return;
        if (lobby.ownerId !== u.id) return this.err(u, 'NOT_OWNER', 'Oyunu yalnızca masa sahibi başlatabilir.');
        if (lobby.seats.some((s) => !s.userId && !s.isBot)) return this.err(u, 'SEATS_EMPTY', 'Dört koltuk dolmalı (boşları bot ile doldurabilirsiniz).');
        if (lobby.seats.some((s) => s.userId && !s.ready)) return this.err(u, 'NOT_READY', 'Tüm oyuncular hazır olmalı.');
        return this.startMatch(lobby);
      }
      case 'quick.bots': {
        this.leaveLobby(u, true);
        const game = asGame(msg.game);
        const team = !!(msg.options as { teamMode?: boolean } | undefined)?.teamMode;
        const lobby = this.createLobby(u, game, `${GAME_NAME[game]}: ${u.name}${team ? ' & Bot' : ''} vs Botlar`, true, msg.options);
        lobby.seats[0] = { userId: u.id, isBot: false, ready: true };
        for (let i = 1; i < 4; i++) {
          lobby.seats[i] = { userId: null, isBot: true, botName: this.botName(lobby), botLevel: lobby.options.botLevel, ready: true };
        }
        u.lobbyId = lobby.id;
        this.startMatch(lobby);
        return;
      }
      case 'quick.match': {
        const game = asGame(msg.game);
        const open = [...this.lobbies.values()]
          .filter((l) => l.game === game && !l.isPrivate && !l.room && l.seats.some((s) => !s.userId && !s.isBot))
          .sort((a, b) => a.createdAt - b.createdAt)[0];
        if (open && open.id !== u.lobbyId) return this.joinLobby(u, open);
        if (!open) {
          const lobby = this.createLobby(u, game, `${u.name} masası`, false, {});
          this.joinLobby(u, lobby);
        }
        return;
      }
      case 'game.command': {
        const lobby = this.lobbyOf(u);
        const room = lobby?.room;
        if (!room) return this.err(u, 'MATCH_NOT_ACTIVE', 'Aktif maç yok.');
        const res = room.command(u.id, String(msg.commandId), Number(msg.expectedVersion), msg.command);
        if (!res.ok) {
          this.send(ws, { t: 'rejected', commandId: String(msg.commandId), code: res.code, message: res.message });
          // Sürüm uyuşmazlığında kişiye özel tam snapshot gönder.
          const seat = room.seatOf(u.id);
          if (seat >= 0) this.send(ws, { t: 'game', view: room.viewFor(seat) });
        }
        return;
      }
      case 'game.leave': {
        const lobby = this.lobbyOf(u);
        const room = lobby?.room;
        if (room && room.status() !== 'ENDED') {
          const seat = room.seatOf(u.id);
          if (seat >= 0) room.leave(seat);
        }
        return this.leaveLobby(u);
      }
      case 'game.resume': {
        const room = this.lobbyOf(u)?.room;
        const seat = room ? room.seatOf(u.id) : -1;
        if (room && seat >= 0) room.resume(seat);
        return;
      }
      case 'match.again': {
        const lobby = this.lobbyOf(u);
        if (!lobby?.room || lobby.room.status() !== 'ENDED') return;
        this.resetLobby(lobby);
        return;
      }
    }
  }

  // ─────────────── kimlik ───────────────

  private hello(ws: WebSocket, token?: string, name?: string) {
    let u: User | undefined;
    let issued = '';
    if (token) {
      const uid = this.byToken.get(sha(String(token)));
      u = uid ? this.users.get(uid) : undefined;
    }
    if (!u) {
      issued = randomBytes(32).toString('hex');
      u = {
        id: randomUUID(),
        tokenHash: sha(issued),
        name: sanitizeName(name),
        sockets: new Set(),
        lobbyId: null,
        lastSeen: Date.now(),
      };
      this.users.set(u.id, u);
      this.byToken.set(u.tokenHash, u.id);
      log('user.created', { userId: u.id });
    } else if (name) {
      u.name = sanitizeName(name);
    }
    u.sockets.add(ws);
    u.lastSeen = Date.now();
    this.socketUser.set(ws, u.id);
    this.send(ws, { t: 'welcome', token: issued || String(token), userId: u.id, name: u.name });
    this.send(ws, { t: 'lobbies', list: this.lobbyList() });
    this.updatePresence(u, true);
    const lobby = this.lobbyOf(u);
    this.send(ws, { t: 'lobby', lobby: lobby ? this.lobbyView(lobby, u.id) : null });
    if (lobby?.room) {
      const seat = lobby.room.seatOf(u.id);
      if (seat >= 0) this.send(ws, { t: 'game', view: lobby.room.viewFor(seat) });
    }
  }

  private updatePresence(u: User, connected: boolean) {
    const lobby = this.lobbyOf(u);
    if (!lobby) return;
    if (lobby.room) {
      const seat = lobby.room.seatOf(u.id);
      if (seat >= 0) lobby.room.setConnected(seat, connected);
      if (connected) log('player.reconnected', { matchId: lobby.room.id, seat });
      else log('player.disconnected', { matchId: lobby.room.id, seat });
    }
    this.pushLobby(lobby);
  }

  // ─────────────── lobi ───────────────

  private createLobby(owner: User, game: GameId, name: string | undefined, isPrivate: boolean, options?: unknown): Lobby {
    const lobby: Lobby = {
      id: randomUUID(),
      game,
      code: inviteCode(),
      name: sanitizeName(name || `${owner.name} masası`).slice(0, 30),
      ownerId: owner.id,
      isPrivate,
      options: normalizeFor(game, options),
      seats: Array.from({ length: 4 }, () => ({ userId: null, isBot: false, ready: false })),
      room: null,
      createdAt: Date.now(),
      emptySince: null,
    };
    this.lobbies.set(lobby.id, lobby);
    log('lobby.created', { lobbyId: lobby.id, game, isPrivate });
    return lobby;
  }

  private joinLobby(u: User, lobby: Lobby) {
    if (u.lobbyId === lobby.id) {
      this.pushLobby(lobby);
      return;
    }
    if (lobby.room) return this.err(u, 'LOBBY_PLAYING', 'Bu masada oyun sürüyor.');
    const free = lobby.seats.find((s) => !s.userId && !s.isBot);
    if (!free) return this.err(u, 'LOBBY_FULL', 'Masa dolu.');
    this.leaveLobby(u, true);
    Object.assign(free, { userId: u.id, ready: false });
    u.lobbyId = lobby.id;
    this.pushLobby(lobby);
    this.broadcastLobbyList();
  }

  private leaveLobby(u: User, silent = false) {
    const lobby = this.lobbyOf(u);
    u.lobbyId = null;
    if (!silent) this.sendUser(u, { t: 'lobby', lobby: null });
    this.sendUser(u, { t: 'game', view: null });
    if (!lobby) return;
    if (lobby.room) {
      const seat = lobby.room.seatOf(u.id);
      if (seat >= 0 && lobby.room.status() !== 'ENDED') lobby.room.leave(seat);
    } else {
      const s = lobby.seats.find((x) => x.userId === u.id);
      if (s) Object.assign(s, { userId: null, ready: false });
    }
    const remaining = lobby.seats.filter((s) => {
      const other = s.userId ? this.users.get(s.userId) : undefined;
      return other && other.id !== u.id && other.lobbyId === lobby.id;
    });
    if (remaining.length === 0) {
      // Masada insan kalmadı: maçı ve lobiyi kapat.
      lobby.room?.close();
      this.lobbies.delete(lobby.id);
      log('lobby.closed', { lobbyId: lobby.id, reason: 'empty' });
      this.broadcastLobbyList();
      return;
    }
    if (lobby.ownerId === u.id) lobby.ownerId = remaining[0].userId!;
    this.pushLobby(lobby);
    this.broadcastLobbyList();
  }

  private resetLobby(lobby: Lobby) {
    lobby.room?.close();
    lobby.room = null;
    for (const s of lobby.seats) {
      const u = s.userId ? this.users.get(s.userId) : undefined;
      if (s.userId && (!u || u.lobbyId !== lobby.id)) Object.assign(s, { userId: null, ready: false });
      if (!s.isBot) s.ready = false;
    }
    if (!lobby.seats.some((s) => s.userId === lobby.ownerId)) {
      const next = lobby.seats.find((s) => s.userId);
      if (next) lobby.ownerId = next.userId!;
    }
    for (const s of lobby.seats) if (s.userId) this.sendUser(this.users.get(s.userId)!, { t: 'game', view: null });
    this.pushLobby(lobby);
    this.broadcastLobbyList();
  }

  private startMatch(lobby: Lobby) {
    const seats: RoomSeat[] = lobby.seats.map((s) => {
      const u = s.userId ? this.users.get(s.userId) : undefined;
      return {
        userId: s.userId,
        name: s.isBot ? s.botName! : (u?.name ?? 'Oyuncu'),
        isBot: s.isBot,
        botLevel: s.botLevel ?? lobby.options.botLevel,
        botControlled: false,
        left: false,
        connected: s.isBot || !!u?.sockets.size,
        disconnectedAt: null,
        timeouts: 0,
      };
    });
    lobby.room = new MatchRoom(
      seats,
      adapterFor(lobby.game, lobby.options),
      (room) => this.pushGame(lobby, room),
      () => this.pushLobby(lobby),
    );
    this.pushLobby(lobby);
    lobby.room.start();
    this.broadcastLobbyList();
  }

  /** Masadaki botların seviyesi: hepsi aynıysa o, değilse 'mixed'; bot yoksa varsayılan. */
  private botLevelOf(l: Lobby): BotLevel | 'mixed' {
    const levels = new Set(l.seats.filter((s) => s.isBot).map((s) => s.botLevel ?? l.options.botLevel));
    if (levels.size === 0) return l.options.botLevel;
    return levels.size === 1 ? [...levels][0] : 'mixed';
  }

  private botSummary(l: Lobby): string[] {
    const bots = l.seats.filter((s) => s.isBot);
    if (!bots.length) return [`Eklenecek botların seviyesi: ${BOT_LEVEL_LABEL[l.options.botLevel]}`];
    return [`Botlar: ${bots.map((s) => `${s.botName} (${BOT_LEVEL_LABEL[s.botLevel ?? l.options.botLevel]})`).join(', ')}`];
  }

  private botName(lobby: Lobby) {
    const used = new Set(lobby.seats.map((s) => s.botName));
    return BOT_NAMES.find((n) => !used.has(n)) ?? 'Bot';
  }

  private lobbyOf(u: User) {
    return u.lobbyId ? this.lobbies.get(u.lobbyId) : undefined;
  }

  private lobbyView(l: Lobby, viewerId: string): LobbyView {
    return {
      id: l.id,
      game: l.game,
      code: l.code,
      name: l.name,
      isPrivate: l.isPrivate,
      status: l.room ? 'PLAYING' : 'WAITING',
      options: l.options,
      rulesSummary: [...rulesSummaryFor(l.game, l.options), ...this.botSummary(l)],
      youAreOwner: l.ownerId === viewerId,
      seats: l.seats.map((s, i) => {
        const u = s.userId ? this.users.get(s.userId) : undefined;
        const rs = l.room?.seats[i];
        return {
          seat: i,
          name: s.isBot ? s.botName! : (u?.name ?? null),
          isBot: s.isBot,
          botLevel: s.isBot ? (s.botLevel ?? l.options.botLevel) : undefined,
          ready: s.isBot || s.ready,
          connected: s.isBot || !!u?.sockets.size,
          botControlled: !!rs?.botControlled,
          isOwner: !!s.userId && s.userId === l.ownerId,
          isYou: s.userId === viewerId,
        };
      }),
    };
  }

  private lobbyList(): LobbySummary[] {
    return [...this.lobbies.values()]
      .filter((l) => !l.isPrivate)
      .map((l) => ({
        id: l.id,
        game: l.game,
        name: l.name,
        players: l.seats.filter((s) => s.userId || s.isBot).length,
        status: l.room ? ('PLAYING' as const) : ('WAITING' as const),
        info: infoFor(l.game, l.options, this.botLevelOf(l)),
      }))
      .slice(0, 50);
  }

  private broadcastLobbyList() {
    const list = this.lobbyList();
    for (const u of this.users.values()) if (!u.lobbyId) this.sendUser(u, { t: 'lobbies', list });
  }

  private pushLobby(lobby: Lobby) {
    for (const s of lobby.seats) {
      const u = s.userId ? this.users.get(s.userId) : undefined;
      if (u && u.lobbyId === lobby.id) this.sendUser(u, { t: 'lobby', lobby: this.lobbyView(lobby, u.id) });
    }
  }

  private pushGame(lobby: Lobby, room: MatchRoom) {
    room.seats.forEach((s, i) => {
      if (!s.userId || s.left) return;
      const u = this.users.get(s.userId);
      if (u && u.lobbyId === lobby.id) this.sendUser(u, { t: 'game', view: room.viewFor(i) });
    });
  }

  // ─────────────── bakım ───────────────

  private sweep() {
    const now = Date.now();
    for (const l of this.lobbies.values()) {
      l.room?.checkGrace(now);
      const humansHere = l.seats.some((s) => {
        const u = s.userId ? this.users.get(s.userId) : undefined;
        return u && u.lobbyId === l.id && u.sockets.size > 0;
      });
      if (humansHere) l.emptySince = null;
      else if (!l.emptySince) l.emptySince = now;
      else if (now - l.emptySince > 10 * 60_000) {
        l.room?.close();
        this.lobbies.delete(l.id);
        for (const s of l.seats) {
          const u = s.userId ? this.users.get(s.userId) : undefined;
          if (u?.lobbyId === l.id) u.lobbyId = null;
        }
        log('lobby.closed', { lobbyId: l.id, reason: 'idle' });
        this.broadcastLobbyList();
      }
    }
    for (const u of this.users.values()) {
      if (u.sockets.size === 0 && !u.lobbyId && now - u.lastSeen > 24 * 3600_000) {
        this.users.delete(u.id);
        this.byToken.delete(u.tokenHash);
      }
    }
  }

  // ─────────────── gönderim ───────────────

  private send(ws: WebSocket, msg: ServerMsg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private sendUser(u: User, msg: ServerMsg) {
    for (const ws of u.sockets) this.send(ws, msg);
  }

  private err(u: User, code: string, message: string) {
    this.sendUser(u, { t: 'error', code, message });
  }
}
