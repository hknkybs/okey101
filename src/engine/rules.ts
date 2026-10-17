// Kural profili. Spesifikasyon §2 ve §17'deki varsayılanlar.
// Tur başladıktan sonra değişmez; maç başında kopyalanır.

export interface Ruleset {
  rulesetVersion: 1;
  opening: {
    minPoints: number; // normal açılış barajı (101)
    minPairs: number; // çift açma için en az çift sayısı (5)
    allowPairs: boolean; // çift açma serbest mi
  };
  discard: {
    mustUseTakenDiscardToOpen: boolean; // açmamış oyuncu yandan aldığı taşla açmak zorunda
  };
  joker: {
    heldPenalty: number; // elde kalan her gerçek okey için ek ceza
    allowSwap: boolean; // açmış oyuncu masadaki okeyin yerine temsil ettiği taşı koyup okeyi alabilir
    swapMustUseSameTurn: boolean; // masadan alınan okey aynı tur masaya konmalı (işleme veya yeni per)
  };
  scoring: {
    unopenedPenalty: number;
    winnerDelta: number;
    doubleOnOkeyFinish: boolean;
    doubleOnPairFinish: boolean;
    partnerOfWinnerExempt: boolean; // eşli oyunda bitirenin eşi ceza almaz
  };
  layoff: {
    onlyOwnMelds: boolean; // yalnızca kendi perlerine işleme
  };
  round: {
    maxTurnSeconds: number;
  };
  match: {
    roundLimit: number;
    teamMode: boolean; // eşli oyun: karşılıklı oturanlar (0–2, 1–3) takım
  };
  reconnect: {
    graceSeconds: number;
    timeoutsBeforeBot: number; // ardışık zaman aşımından sonra koltuğu bot devralır
  };
}

export const DEFAULT_RULES: Ruleset = {
  rulesetVersion: 1,
  opening: { minPoints: 101, minPairs: 5, allowPairs: true },
  discard: { mustUseTakenDiscardToOpen: true },
  joker: { heldPenalty: 101, allowSwap: true, swapMustUseSameTurn: false },
  scoring: {
    unopenedPenalty: 202,
    winnerDelta: -101,
    doubleOnOkeyFinish: true,
    doubleOnPairFinish: true,
    partnerOfWinnerExempt: true,
  },
  layoff: { onlyOwnMelds: false },
  round: { maxTurnSeconds: 60 },
  match: { roundLimit: 10, teamMode: false },
  reconnect: { graceSeconds: 30, timeoutsBeforeBot: 3 },
};

/** Lobide kullanıcıya açılan ayarlar. */
export interface TableOptions {
  roundLimit?: number;
  turnSeconds?: number;
  allowPairs?: boolean;
  onlyOwnMelds?: boolean;
  allowJokerSwap?: boolean;
  jokerSwapMustUse?: boolean;
  teamMode?: boolean;
  partnerOfWinnerExempt?: boolean;
  /** Boş koltukları dolduran botların seviyesi (kural profili değildir, yalnız masa ayarı). */
  botLevel?: BotLevel;
}

export type BotLevel = 'easy' | 'normal';
export const BOT_LEVEL_LABEL: Record<BotLevel, string> = { easy: 'Kolay', normal: 'Normal' };

export function buildRules(opts: TableOptions = {}): Ruleset {
  const r: Ruleset = structuredClone(DEFAULT_RULES);
  if (opts.roundLimit !== undefined) r.match.roundLimit = clamp(Math.round(opts.roundLimit), 1, 11);
  if (opts.turnSeconds !== undefined) r.round.maxTurnSeconds = clamp(Math.round(opts.turnSeconds), 15, 120);
  if (opts.allowPairs !== undefined) r.opening.allowPairs = !!opts.allowPairs;
  if (opts.onlyOwnMelds !== undefined) r.layoff.onlyOwnMelds = !!opts.onlyOwnMelds;
  if (opts.allowJokerSwap !== undefined) r.joker.allowSwap = !!opts.allowJokerSwap;
  if (opts.teamMode !== undefined) r.match.teamMode = !!opts.teamMode;
  if (opts.partnerOfWinnerExempt !== undefined) r.scoring.partnerOfWinnerExempt = !!opts.partnerOfWinnerExempt;
  if (opts.jokerSwapMustUse !== undefined) r.joker.swapMustUseSameTurn = !!opts.jokerSwapMustUse;
  return r;
}

// ───────── Eşli oyun yardımcıları ─────────

/** Takım no: 0 → koltuk 0 ve 2, 1 → koltuk 1 ve 3. */
export const teamOf = (seat: number) => seat % 2;
export const partnerOf = (seat: number) => (seat + 2) % 4;

/** Oyuncu bu pere işleyebilir / okey alabilir mi? Eşli oyunda "kendi peri" eşin perlerini de kapsar. */
export function canTouchMeld(r: Ruleset, seat: number, owner: number): boolean {
  if (!r.layoff.onlyOwnMelds) return true;
  return owner === seat || (r.match.teamMode && owner === partnerOf(seat));
}

export const teamTotals = (totals: number[]) => [totals[0] + totals[2], totals[1] + totals[3]];

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/** Lobi/masa özeti için okunabilir kural listesi. */
export function describeRules(r: Ruleset): string[] {
  return [
    `Açılış: en az ${r.opening.minPoints} puan`,
    r.opening.allowPairs ? `Çift açma: en az ${r.opening.minPairs} çift` : 'Çift açma: kapalı',
    r.discard.mustUseTakenDiscardToOpen
      ? 'Yandan alınan taşla o tur açmak zorunlu (açmamış oyuncu için)'
      : 'Yandan taş alma serbest',
    ...(r.match.teamMode
      ? [
          'Eşli oyun: karşılıklı oturanlar takım (1–3 ve 2–4. koltuk), takım puanı iki oyuncunun toplamı',
          r.scoring.partnerOfWinnerExempt ? 'Bitirenin eşi ceza almaz' : 'Bitirenin eşi de elindeki taşlar kadar ceza alır',
        ]
      : []),
    r.layoff.onlyOwnMelds
      ? r.match.teamMode
        ? 'Sadece kendi ve eşinin perlerine işleme'
        : 'Sadece kendi perlerine işleme'
      : 'Tüm açık perlere işleme',
    `Bitiren: ${r.scoring.winnerDelta}, açmayan: +${r.scoring.unopenedPenalty}, açan: elde kalan toplamı`,
    `Elde kalan gerçek okey: +${r.joker.heldPenalty}`,
    r.joker.allowSwap
      ? `Okeyi masadan alma: açmış oyuncu, okeyin temsil ettiği taşı koyup okeyi alabilir${
          r.joker.swapMustUseSameTurn ? ' (alınan okey aynı tur masaya konmalı)' : ''
        }`
      : 'Okeyi masadan alma: kapalı',
    'Okeyle bitiş ×2, çiftten bitiş ×2 (birlikte ×4)',
    `Hamle süresi: ${r.round.maxTurnSeconds} sn`,
    `Maç: ${r.match.roundLimit} el`,
  ];
}
