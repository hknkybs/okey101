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
    /** Eşli: koz seçilince ihalecinin eşi kartlarını açar (herkes görür), eşin elini ihaleci oynar. */
    openPartnerHand: boolean;
  };
  scoring: {
    nonBidderPerTrick: number; // tekli: ihale dışı oyuncuya el başına puan
    opponentsPerTrick: number; // eşli: rakip takıma el başına puan (varsayılan 0)
    /**
     * İhaleye girmeyenlerin en az alması gereken el (0 = kapalı). Eşli: rakip takımın toplamı;
     * tekli: ihaleye girmeyen her oyuncu. Alamayan ihale×10 puan kaybeder.
     */
    minDefenderTricks: number;
  };
  match: { roundLimit: number };
  hints: {
    /** Renge uymayan oyuncunun hangi rengi kalmadığını ekranda göster (varsayılan kapalı: oyuncu kendisi takip eder). */
    showVoids: boolean;
  };
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
  openPartnerHand?: boolean;
  minDefenderTricks?: number;
  showVoids?: boolean;
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
      // Yaygın kural: açılan renk yoksa koz atmak zorunlu, koz da yoksa istenen kart.
      mustTrumpIfVoid: o.mustTrumpIfVoid ?? true,
      mustBeatIfPossible: !!o.mustBeatIfPossible,
      mustLeadTrumpBeforeBroken: true,
      openPartnerHand: mode === 'partnership' && (o.openPartnerHand ?? true),
    },
    scoring: { nonBidderPerTrick: 10, opponentsPerTrick: 0, minDefenderTricks: clamp(o.minDefenderTricks ?? 0, 0, 4) },
    match: { roundLimit: clamp(o.roundLimit ?? 10, 1, 11) },
    hints: { showVoids: !!o.showVoids },
    timers: {
      // İhale/koz süresi kart süresinin yarısı, en az 20 sn (60 sn → 30 sn, 120 sn → 60 sn).
      bidSeconds: Math.max(20, Math.round(clamp(o.turnSeconds ?? 60, 15, 120) / 2)),
      playSeconds: clamp(o.turnSeconds ?? 60, 15, 120),
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
    openPartnerHand: r.mode === 'partnership' ? r.play.openPartnerHand : (o.openPartnerHand ?? true),
    minDefenderTricks: r.scoring.minDefenderTricks,
    showVoids: r.hints.showVoids,
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
    ...(partner && r.play.openPartnerHand
      ? ['Koz seçilince ihalecinin eşi kartlarını açar (herkes görür); eşin elini ihaleci oynar, eş izler']
      : []),
    'Renge uymak zorunlu',
    r.play.mustTrumpIfVoid
      ? 'Açılan renk yoksa koz atmak zorunlu; koz da yoksa istenen kart atılır'
      : 'Açılan renk yoksa istenen kart atılabilir (koz zorunlu değil)',
    r.play.mustBeatIfPossible ? 'Eli geçebiliyorsanız geçmek zorunlu (yükseltme)' : 'Yükseltme zorunluluğu yok',
    'Koz açılmadan kozla çıkılamaz (elde yalnız koz kaldıysa serbest)',
    partner
      ? `Puan: ihaleci takım tutarsa +ihale×10, batarsa −ihale×10${r.scoring.opponentsPerTrick ? `; rakip takıma el başına +${r.scoring.opponentsPerTrick}` : '; rakip takıma puan yok'}`
      : `Puan: ihaleci tutarsa +ihale×10, batarsa −ihale×10; diğerlerine aldıkları el×${r.scoring.nonBidderPerTrick}`,
    ...(r.scoring.minDefenderTricks
      ? [
          partner
            ? `Rakip takım en az ${r.scoring.minDefenderTricks} el almalı; alamazsa −ihale×10`
            : `İhaleye girmeyen her oyuncu en az ${r.scoring.minDefenderTricks} el almalı; alamayan −ihale×10`,
        ]
      : []),
    ...(r.hints.showVoids ? ['İpucu açık: renge uymayan oyuncunun hangi rengi kalmadığı gösterilir'] : []),
    `İhale süresi ${r.timers.bidSeconds} sn, kart süresi ${r.timers.playSeconds} sn`,
    `Maç: ${r.match.roundLimit} dağıtım, yüksek puan kazanır`,
  ];
}
