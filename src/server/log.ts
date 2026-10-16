// Yapılandırılmış log. Token, gizli el ve davet kodu loglanmaz.
export function log(event: string, data: Record<string, unknown> = {}) {
  if (process.env.LOG_LEVEL === 'silent') return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}
