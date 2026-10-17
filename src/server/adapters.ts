// Oyun modülleri: maç yöneticisi (room.ts) oyundan bağımsızdır, her oyun bu arayüzle bağlanır.
import { batakBotCommand } from '../batak/bot.ts';
import { actorOf, applyBatak, batakTimeoutCommand, batakViewFor, createBatakMatch, startNextBatakRound } from '../batak/game.ts';
import type { BatakRuleset } from '../batak/rules.ts';
import type { BatakCommand, BatakMatch } from '../batak/types.ts';
import { botNextCommand } from '../engine/bot.ts';
import { applyCommand, createMatch, startNextRound, timeoutCommands, viewFor } from '../engine/game.ts';
import type { Ruleset } from '../engine/rules.ts';
import type { Command, MatchState } from '../engine/types.ts';
import type { Rng } from '../shared/rng.ts';

export type GameId = 'okey' | 'batak';
export type BotStyle = 'smart' | 'basic';

export interface GameAdapter<S = unknown, C = unknown> {
  game: GameId;
  create(rng: Rng, dealer: number): S;
  apply(s: S, seat: number, cmd: C, rng: Rng): S;
  nextRound(s: S, rng: Rng): S;
  status(s: S): 'ACTIVE' | 'ROUND_OVER' | 'ENDED';
  version(s: S): number;
  roundNo(s: S): number;
  activeSeat(s: S): number;
  /** Değiştiğinde hamle süresi yeniden başlar. */
  turnKey(s: S): string;
  turnMs(s: S): number;
  graceMs(s: S): number;
  timeoutsBeforeBot(s: S): number;
  timeoutCommands(s: S): C[];
  botCommand(s: S, style: BotStyle): C;
  /** Bot hamlesinden önce bekleme (ör. tamamlanan eli görmek için). */
  botDelayMs?(s: S): number;
  view(s: S, seat: number): object;
  commandType(c: C): string;
}

export function okeyAdapter(rules: Ruleset): GameAdapter<MatchState, Command> {
  return {
    game: 'okey',
    create: (rng, dealer) => createMatch(rules, rng, dealer),
    apply: (s, seat, cmd) => applyCommand(s, seat, cmd),
    nextRound: (s, rng) => startNextRound(s, rng),
    status: (s) => s.status,
    version: (s) => s.stateVersion,
    roundNo: (s) => s.round.roundNo,
    activeSeat: (s) => s.round.activeSeat,
    turnKey: (s) => `${s.round.roundNo}:${s.round.turnNo}`,
    turnMs: (s) => s.rules.round.maxTurnSeconds * 1000,
    graceMs: (s) => s.rules.reconnect.graceSeconds * 1000,
    timeoutsBeforeBot: (s) => s.rules.reconnect.timeoutsBeforeBot,
    timeoutCommands: (s) => timeoutCommands(s),
    botCommand: (s, style) => botNextCommand(s, { style }),
    view: (s, seat) => ({ game: 'okey', ...viewFor(s, seat) }),
    commandType: (c) => c.type,
  };
}

export function batakAdapter(rules: BatakRuleset): GameAdapter<BatakMatch, BatakCommand> {
  return {
    game: 'batak',
    create: (rng, dealer) => createBatakMatch(rules, rng, dealer),
    apply: (s, seat, cmd, rng) => applyBatak(s, seat, cmd, rng),
    nextRound: (s, rng) => startNextBatakRound(s, rng),
    status: (s) => s.status,
    version: (s) => s.stateVersion,
    roundNo: (s) => s.round.roundNo,
    // Hamleyi yapan oyuncu: açık eşin sırasında ihaleci (bot/zaman aşımı da ona göre işler).
    activeSeat: (s) => actorOf(s.round, s.rules),
    // Her hamlede süre baştan başlar (ihale/koz/kart ayrı hamlelerdir).
    turnKey: (s) => `${s.round.roundNo}:${s.stateVersion}`,
    turnMs: (s) => (s.round.phase === 'PLAYING' ? s.rules.timers.playSeconds : s.rules.timers.bidSeconds) * 1000,
    graceMs: (s) => s.rules.timers.reconnectGraceSeconds * 1000,
    timeoutsBeforeBot: (s) => s.rules.timers.timeoutsBeforeBot,
    timeoutCommands: (s) => [batakTimeoutCommand(s)],
    botCommand: (s, style) => batakBotCommand(s, { style }),
    // Biten eli herkes görebilsin diye yeni el başında bot biraz daha bekler.
    botDelayMs: (s) => (s.round.phase === 'PLAYING' && s.round.trick.length === 0 && s.round.lastTrick ? 1600 : 0),
    view: (s, seat) => batakViewFor(s, seat),
    commandType: (c) => c.type,
  };
}
