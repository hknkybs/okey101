// Batak kural profili (spesifikasyon §2, §16). Maç başında dondurulur.
import type { BotLevel } from '../engine/rules.ts';

export type BatakMode = 'individual' | 'partnership';

export interface BatakRuleset {
  rulesetVersion: 1;
  mode: BatakMode;
  bidding: {
    minimumBid: number;
    /** Herkes pas: son oyuncu en az minimum teklif vermek zorunda, ya da yeniden dağıtım. */
    allPass: 'force_last' | 'redeal';
  };
  play: {
    mustTrumpIfVoid: boolean; // açılan renk yoksa koz atma zorunlu
    mustBeatIfPossible: boolean; // eli geçebiliyorsa geçmek zorunlu (yükseltme)
    mustLeadTrumpBeforeBroken: boolean; // koz açılmadan kozla çıkılamaz (yalnız koz kaldıysa serbest)
  };
  scoring: {
    nonBidderPerTrick: number; // tekli: ihale dışı oyuncuya el başına puan
    opponentsPerTrick: number; // eşli: rakip takıma el başına puan (varsayılan 0)
  };
  match: { roundLimit: number };
  timers: {
    bidSeconds: number;
    playSeconds: number;
    reconnectGraceSeconds: number;
    timeoutsBeforeBot: number;
  };
}

/** Lobide kullanıcıya açılan Batak masa ayarları. */
export interface BatakTableOptions {
  teamMode?: boolean; // eşli
  roundLimit?: number;
  turnSeconds?: number;
  minBid?: number;
  mustTrumpIfVoid?: boolean;
  mustBeatIfPossible?: boolean;
  allPassRedeal?: boolean;
  botLevel?: BotLevel;
}

export const DEFAULT_MIN_BID: Record<BatakMode, number> = { individual: 5, partnership: 8 };

export function buildBatakRules(o: BatakTableOptions = {}): BatakRuleset {
  const mode: BatakMode = o.teamMode ? 'partnership' : 'individual';
  return {
    rulesetVersion: 1,
    mode,
    bidding: {
      minimumBid: clamp(o.minBid ?? DEFAULT_MIN_BID[mode], 4, 9),
      allPass: o.allPassRedeal ? 'redeal' : 'force_last',
    },
    play: {
      mustTrumpIfVoid: !!o.mustTrumpIfVoid,
      mustBeatIfPossible: !!o.mustBeatIfPossible,
      mustLeadTrumpBeforeBroken: true,
    },
    scoring: { nonBidderPerTrick: 10, opponentsPerTrick: 0 },
    match: { roundLimit: clamp(o.roundLimit ?? 10, 1, 11) },
    timers: {
      bidSeconds: 20,
      playSeconds: clamp(o.turnSeconds ?? 30, 15, 60),
      reconnectGraceSeconds: 30,
      timeoutsBeforeBot: 3,
    },
  };
}

export function normalizeBatakOptions(o: BatakTableOptions = {}): Required<BatakTableOptions> {
  const r = buildBatakRules(o);
  return {
    teamMode: r.mode === 'partnership',
    roundLimit: r.match.roundLimit,
    turnSeconds: r.timers.playSeconds,
    minBid: r.bidding.minimumBid,
    mustTrumpIfVoid: r.play.mustTrumpIfVoid,
    mustBeatIfPossible: r.play.mustBeatIfPossible,
    allPassRedeal: r.bidding.allPass === 'redeal',
    botLevel: o.botLevel === 'easy' ? 'easy' : 'normal',
  };
}

function clamp(n: number, lo: number, hi: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

export function describeBatakRules(r: BatakRuleset): string[] {
  const partner = r.mode === 'partnership';
  return [
    partner ? 'İhaleli eşli: karşılıklı oturanlar takım (1–3 ve 2–4. koltuk)' : 'İhaleli tekli: herkes kendi için oynar',
    `Minimum ihale: ${r.bidding.minimumBid}, artış 1; pas geçen tekrar teklif veremez`,
    r.bidding.allPass === 'redeal'
      ? 'Herkes pas geçerse kartlar yeniden dağıtılır'
      : 'Herkes pas geçerse son oyuncu minimum teklifle ihaleyi almak zorunda',
    'İhaleyi alan kozu seçer ve ilk eli o açar',
    'Renge uymak zorunlu',
    r.play.mustTrumpIfVoid ? 'Açılan renk yoksa koz atmak zorunlu' : 'Açılan renk yoksa istenen kart atılabilir',
    r.play.mustBeatIfPossible ? 'Eli geçebiliyorsanız geçmek zorunlu (yükseltme)' : 'Yükseltme zorunluluğu yok',
    'Koz açılmadan kozla çıkılamaz (elde yalnız koz kaldıysa serbest)',
    partner
      ? `Puan: ihaleci takım tutarsa +ihale×10, batarsa −ihale×10${r.scoring.opponentsPerTrick ? `; rakip takıma el başına +${r.scoring.opponentsPerTrick}` : '; rakip takıma puan yok'}`
      : `Puan: ihaleci tutarsa +ihale×10, batarsa −ihale×10; diğerlerine aldıkları el×${r.scoring.nonBidderPerTrick}`,
    `İhale süresi ${r.timers.bidSeconds} sn, kart süresi ${r.timers.playSeconds} sn`,
    `Maç: ${r.match.roundLimit} dağıtım, yüksek puan kazanır`,
  ];
}
