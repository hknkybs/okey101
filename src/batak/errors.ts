export const BATAK_ERRORS = {
  NOT_YOUR_TURN: 'Sıra sizde değil.',
  WRONG_PHASE: 'Bu hamle şu anda yapılamaz.',
  STALE_STATE: 'Oyun durumu güncellendi, lütfen tekrar deneyin.',
  CARD_NOT_OWNED: 'Bu kart elinizde değil.',
  INVALID_BID: 'Geçersiz teklif.',
  PLAYER_ALREADY_PASSED: 'Pas geçtiniz; bu dağıtımda tekrar teklif veremezsiniz.',
  MUST_BID: 'Herkes pas geçti; ihaleyi almak zorundasınız.',
  MUST_FOLLOW_SUIT: 'Açılan renge uymak zorundasınız.',
  MUST_TRUMP: 'Açılan renk elinizde yok; koz atmak zorundasınız.',
  MUST_BEAT: 'Eli geçebiliyorsunuz; geçen bir kart oynamalısınız.',
  TRUMP_NOT_BROKEN: 'Koz henüz açılmadı; kozla çıkamazsınız.',
  INVALID_TRUMP: 'Geçersiz koz.',
  MATCH_NOT_ACTIVE: 'Maç aktif değil.',
  BAD_COMMAND: 'Geçersiz komut.',
} as const;

export type BatakErrorCode = keyof typeof BATAK_ERRORS;

export class BatakError extends Error {
  constructor(
    public code: BatakErrorCode,
    detail?: string,
  ) {
    super(detail ? `${BATAK_ERRORS[code]} ${detail}` : BATAK_ERRORS[code]);
  }
}
