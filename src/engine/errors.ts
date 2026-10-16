export const ERROR_MESSAGES = {
  NOT_YOUR_TURN: 'Sıra sizde değil.',
  WRONG_PHASE: 'Bu hamle şu anda yapılamaz.',
  STALE_STATE: 'Oyun durumu güncellendi, lütfen tekrar deneyin.',
  TILE_NOT_OWNED: 'Bu taş elinizde değil.',
  INVALID_MELD: 'Geçersiz per.',
  OPENING_BELOW_THRESHOLD: 'Açılış toplamı yetersiz.',
  PAIR_COUNT_TOO_LOW: 'Çift sayısı yetersiz.',
  PAIRS_DISABLED: 'Bu masada çift açma kapalı.',
  MUST_USE_DISCARD_TO_OPEN: 'Yandan alınan taşla bu tur açmanız gerekir.',
  NOT_OPENED: 'Önce elinizi açmalısınız.',
  ALREADY_OPENED_OTHER: 'Bu açılış türü sizin açılışınızla uyumlu değil.',
  MUST_KEEP_TILE: 'Atmak için elinizde en az bir taş kalmalı.',
  NO_DISCARD: 'Alınabilecek yandan taş yok.',
  STOCK_EMPTY: 'Deste bitti.',
  LAYOFF_INVALID: 'Bu taş bu pere işlenemez.',
  SWAP_INVALID: 'Bu taş bu perdeki okeyin yerine konamaz.',
  JOKER_MUST_BE_USED: 'Masadan aldığınız okeyi bu tur masaya koymalısınız (işleyin veya per indirin).',
  SWAP_DISABLED: 'Bu masada okeyi masadan alma kapalı.',
  LAYOFF_NOT_ALLOWED: 'Bu masada yalnızca kendi perlerinize işleyebilirsiniz.',
  MELD_NOT_FOUND: 'Per bulunamadı.',
  MATCH_NOT_ACTIVE: 'Maç aktif değil.',
  DEADLINE_EXPIRED: 'Hamle süresi doldu.',
  RATE_LIMITED: 'Çok hızlı istek gönderiyorsunuz.',
  BAD_COMMAND: 'Geçersiz komut.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class GameError extends Error {
  constructor(public code: ErrorCode, detail?: string) {
    super(detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code]);
  }
}
