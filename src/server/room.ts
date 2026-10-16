// Maç başına tekil yazma otoritesi. Tüm komutlar burada sıralı uygulanır.
import { randomInt, randomUUID } from 'node:crypto';
import { botNextCommand } from '../engine/bot.ts';
import { GameError } from '../engine/errors.ts';
import { applyCommand, createMatch, startNextRound, timeoutCommands, viewFor, type Rng } from '../engine/game.ts';
import type { BotLevel, Ruleset } from '../engine/rules.ts';
import type { Command, MatchState } from '../engine/types.ts';
import type { ClientGameView, PlayerInfo } from '../shared/protocol.ts';
import { log } from './log.ts';

/** Kriptografik RNG; tohum istemciye hiçbir zaman gönderilmez. */
export const cryptoRng: Rng = { randInt: (n) => randomInt(n), id: () => randomUUID() };

export interface RoomSeat {
  userId: string | null;
  name: string;
  isBot: boolean; // baştan bot koltuğu
  botLevel: BotLevel; // baştan bot koltuğunun seviyesi
  botControlled: boolean; // insan koltuğunu bot devraldı (kopma / zaman aşımı / ayrılma)
  left: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  timeouts: number;
}

type CommandResult = { ok: true } | { ok: false; code: string; message: string };

const BOT_DELAY_MS = [700, 1300];
const NEXT_ROUND_MS = 9000;

export class MatchRoom {
  readonly id = randomUUID();
  state: MatchState;
  deadlineAt: number | null = null;
  nextRoundAt: number | null = null;
  private timer: NodeJS.Timeout | null = null;
  private turnKey = '';
  private recent = new Map<string, CommandResult>();
  private closed = false;

  constructor(
    public seats: RoomSeat[],
    rules: Ruleset,
    private onChange: (room: MatchRoom) => void,
    private onEnded: (room: MatchRoom) => void,
  ) {
    this.state = createMatch(rules, cryptoRng, randomInt(4));
    log('match.started', { matchId: this.id, rulesetVersion: rules.rulesetVersion });
  }

  start() {
    this.schedule();
    this.onChange(this);
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
  }

  seatOf(userId: string) {
    return this.seats.findIndex((s) => s.userId === userId && !s.left);
  }

  isAutomated(seat: number) {
    const s = this.seats[seat];
    return s.isBot || s.botControlled;
  }

  /** Oyuncu komutu: idempotency + sürüm kontrolü + motor doğrulaması. */
  command(userId: string, commandId: string, expectedVersion: number, cmd: Command): CommandResult {
    const seat = this.seatOf(userId);
    if (seat < 0) return { ok: false, code: 'NOT_IN_MATCH', message: 'Bu maçta değilsiniz.' };
    const key = `${seat}:${commandId}`;
    const prev = this.recent.get(key);
    if (prev) return prev;
    let res: CommandResult;
    if (expectedVersion !== this.state.stateVersion) {
      res = { ok: false, code: 'STALE_STATE', message: 'Oyun durumu güncellendi, lütfen tekrar deneyin.' };
    } else if (this.deadlineAt && Date.now() > this.deadlineAt + 500 && this.state.round.activeSeat === seat) {
      res = { ok: false, code: 'DEADLINE_EXPIRED', message: 'Hamle süresi doldu.' };
    } else {
      res = this.apply(seat, cmd, 'PLAYER');
      if (res.ok) this.seats[seat].timeouts = 0;
    }
    this.recent.set(key, res);
    if (this.recent.size > 500) this.recent.delete(this.recent.keys().next().value!);
    return res;
  }

  private apply(seat: number, cmd: Command, source: 'PLAYER' | 'BOT' | 'AUTO_TIMEOUT'): CommandResult {
    try {
      this.state = applyCommand(this.state, seat, cmd);
      log('game.command', {
        matchId: this.id,
        round: this.state.round.roundNo,
        version: this.state.stateVersion,
        seat,
        type: cmd.type,
        source,
      });
      this.schedule();
      this.onChange(this);
      return { ok: true };
    } catch (e) {
      if (e instanceof GameError) return { ok: false, code: e.code, message: e.message };
      log('game.error', { matchId: this.id, error: String(e) });
      return { ok: false, code: 'INTERNAL', message: 'Beklenmeyen hata.' };
    }
  }

  /** Durum değiştikten sonra zamanlayıcıları yeniden kurar. */
  private schedule() {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const m = this.state;

    if (m.status === 'ENDED') {
      this.deadlineAt = null;
      this.nextRoundAt = null;
      this.onEnded(this);
      return;
    }
    if (m.status === 'ROUND_OVER') {
      this.deadlineAt = null;
      this.nextRoundAt = Date.now() + NEXT_ROUND_MS;
      this.timer = setTimeout(() => {
        this.state = startNextRound(this.state, cryptoRng);
        this.nextRoundAt = null;
        this.schedule();
        this.onChange(this);
      }, NEXT_ROUND_MS);
      return;
    }

    const seat = m.round.activeSeat;
    const key = `${m.round.roundNo}:${m.round.turnNo}`;
    if (key !== this.turnKey) {
      this.turnKey = key;
      this.deadlineAt = Date.now() + m.rules.round.maxTurnSeconds * 1000;
    }
    if (this.isAutomated(seat)) {
      const delay = BOT_DELAY_MS[0] + randomInt(BOT_DELAY_MS[1] - BOT_DELAY_MS[0]);
      this.timer = setTimeout(() => this.botStep(), delay);
    } else {
      this.timer = setTimeout(() => this.onTimeout(), Math.max(0, this.deadlineAt! - Date.now()));
    }
  }

  private botStep() {
    const seat = this.state.round.activeSeat;
    let cmd: Command;
    try {
      // Kolay bot eski basit mantıkla oynar. Bir insanın yerine geçici oynayan bot her zaman normal seviyededir.
      const s = this.seats[seat];
      cmd = botNextCommand(this.state, { style: s.isBot && s.botLevel === 'easy' ? 'basic' : 'smart' });
    } catch {
      cmd = timeoutCommands(this.state)[0];
    }
    const res = cmd ? this.apply(seat, cmd, 'BOT') : { ok: false as const, code: 'X', message: '' };
    if (!res.ok) {
      // Bot hatalı komut ürettiyse deterministik zaman aşımı hamlesine düş.
      for (const c of timeoutCommands(this.state)) if (!this.apply(seat, c, 'AUTO_TIMEOUT').ok) break;
    }
  }

  private onTimeout() {
    const seat = this.state.round.activeSeat;
    const s = this.seats[seat];
    s.timeouts++;
    if (s.timeouts >= this.state.rules.reconnect.timeoutsBeforeBot) {
      s.botControlled = true;
      log('seat.bot_takeover', { matchId: this.id, seat, reason: 'timeouts' });
    }
    const cmds = timeoutCommands(this.state);
    for (const c of cmds) {
      if (!this.apply(seat, c, 'AUTO_TIMEOUT').ok) break;
    }
    if (cmds.length === 0) this.schedule();
  }

  setConnected(seat: number, connected: boolean) {
    const s = this.seats[seat];
    s.connected = connected;
    s.disconnectedAt = connected ? null : Date.now();
    if (connected && !s.left && s.botControlled) {
      s.botControlled = false;
      s.timeouts = 0;
      this.schedule();
    }
    this.onChange(this);
  }

  /** Kopma penceresi aşılırsa koltuğu bot devralır. */
  checkGrace(now: number) {
    const grace = this.state.rules.reconnect.graceSeconds * 1000;
    let changed = false;
    for (const s of this.seats) {
      if (!s.isBot && !s.botControlled && !s.connected && s.disconnectedAt && now - s.disconnectedAt > grace) {
        s.botControlled = true;
        changed = true;
      }
    }
    if (changed) {
      this.schedule();
      this.onChange(this);
    }
  }

  /** Bot devraldıktan sonra oyuncu kontrolü geri alır. */
  resume(seat: number) {
    const s = this.seats[seat];
    if (s.left || !s.botControlled) return;
    s.botControlled = false;
    s.timeouts = 0;
    this.schedule();
    this.onChange(this);
  }

  leave(seat: number) {
    const s = this.seats[seat];
    s.left = true;
    s.botControlled = true;
    s.connected = false;
    s.name = `${s.name} (ayrıldı)`;
    this.schedule();
    this.onChange(this);
  }

  hasConnectedHumans() {
    return this.seats.some((s) => !s.isBot && !s.left && s.connected);
  }

  viewFor(seat: number): ClientGameView {
    const players: PlayerInfo[] = this.seats.map((s) => ({
      name: s.name,
      isBot: s.isBot,
      botLevel: s.isBot ? s.botLevel : undefined,
      connected: s.isBot || s.connected,
      botControlled: s.botControlled,
    }));
    return {
      ...viewFor(this.state, seat),
      matchId: this.id,
      players,
      deadlineAt: this.state.status === 'ACTIVE' ? this.deadlineAt : null,
      nextRoundAt: this.nextRoundAt,
      serverTime: Date.now(),
    };
  }
}
