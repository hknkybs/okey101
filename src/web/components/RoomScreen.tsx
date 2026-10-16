import type { LobbyView } from '../../shared/protocol.ts';
import { send, toast } from '../net.ts';

const LEVEL = { easy: 'Kolay', normal: 'Normal' } as const;

export function RoomScreen({ lobby }: { lobby: LobbyView }) {
  const me = lobby.seats.find((s) => s.isYou);
  const owner = lobby.youAreOwner;
  const inviteUrl = `${location.origin}/?code=${lobby.code}`;
  const allFilled = lobby.seats.every((s) => s.name);
  const allReady = lobby.seats.every((s) => !s.name || s.ready);
  const bots = lobby.seats.filter((s) => s.isBot);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: '101 Okey', text: `Masama gel! Kod: ${lobby.code}`, url: inviteUrl });
      else {
        await navigator.clipboard.writeText(inviteUrl);
        toast('Davet bağlantısı kopyalandı');
      }
    } catch {
      /* iptal */
    }
  };

  return (
    <div className="page narrow">
      <header className="page-head">
        <button className="btn small ghost" onClick={() => send({ t: 'lobby.leave' })}>
          ← Çık
        </button>
        <h1 className="grow">{lobby.name}</h1>
      </header>

      <section className="card invite">
        <div>
          <div className="muted small">Davet kodu</div>
          <div className="code">{lobby.code}</div>
        </div>
        <button className="btn" onClick={share}>
          Paylaş
        </button>
      </section>

      {lobby.options.teamMode && (
        <p className="muted small">Eşli masa: karşılıklı oturanlar takımdır (1–3 ve 2–4). Eşinizi seçmek için boş koltuğa "Otur" deyin.</p>
      )}
      <section className={`seats ${lobby.options.teamMode ? 'team' : ''}`}>
        {lobby.seats.map((s) => (
          <div key={s.seat} className={`seat-card ${s.isYou ? 'you' : ''}`}>
            <div className="seat-no">
              Koltuk {s.seat + 1}
              {lobby.options.teamMode && (
                <span className={`chip tiny team-tag team-${s.seat % 2}`}>
                  Takım {s.seat % 2 === 0 ? 'A' : 'B'}
                  {me && s.seat !== me.seat && s.seat % 2 === me.seat % 2 ? ' · eşiniz' : ''}
                </span>
              )}
            </div>
            {s.name ? (
              <>
                <div className="seat-name">
                  {s.isBot ? '🤖 ' : ''}
                  {s.name}
                  {s.isOwner ? ' 👑' : ''}
                </div>
                <div className={`seat-status ${s.ready ? 'ok' : ''}`}>
                  {!s.connected ? 'Bağlantı yok' : s.ready ? '✓ Hazır' : 'Bekleniyor'}
                </div>
                {s.isBot &&
                  (owner ? (
                    <div className="seg small-seg" role="group" aria-label={`${s.name} seviyesi`}>
                      {(['easy', 'normal'] as const).map((lv) => (
                        <button
                          key={lv}
                          className={s.botLevel === lv ? 'on' : ''}
                          aria-pressed={s.botLevel === lv}
                          onClick={() => send({ t: 'lobby.setBotLevel', level: lv, seat: s.seat })}
                        >
                          {LEVEL[lv]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="small muted">Seviye: {LEVEL[s.botLevel ?? 'normal']}</div>
                  ))}
                {owner && s.isBot && (
                  <button className="btn small ghost" onClick={() => send({ t: 'lobby.removeBot', seat: s.seat })}>
                    Botu çıkar
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="seat-name muted">Boş</div>
                <div className="row">
                  <button className="btn small ghost" onClick={() => send({ t: 'lobby.sit', seat: s.seat })}>
                    Otur
                  </button>
                  {owner && (
                    <button className="btn small" onClick={() => send({ t: 'lobby.addBot', seat: s.seat })}>
                      + Bot
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </section>

      {owner && (
        <section className="card row bot-level">
          <span className="grow">
            {bots.length ? 'Tüm botlar' : 'Eklenecek botlar'}
            <span className="small muted block">Her bot koltuğundan ayrı da seçebilirsiniz</span>
          </span>
          <div className="seg" role="group" aria-label="Tüm botların seviyesi">
            {(['easy', 'normal'] as const).map((lv) => {
              const on = bots.length ? bots.every((b) => b.botLevel === lv) : lobby.options.botLevel === lv;
              return (
                <button key={lv} className={on ? 'on' : ''} aria-pressed={on} onClick={() => send({ t: 'lobby.setBotLevel', level: lv })}>
                  {LEVEL[lv]}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="row wrap">
        {me && (
          <button className={`btn ${me.ready ? '' : 'primary'}`} onClick={() => send({ t: 'lobby.ready', ready: !me.ready })}>
            {me.ready ? 'Hazır değilim' : 'Hazırım'}
          </button>
        )}
        {owner && !allFilled && (
          <button className="btn" onClick={() => send({ t: 'lobby.addBot' })}>
            Boşları botla doldur
          </button>
        )}
        {owner && (
          <button className="btn primary" disabled={!allFilled || !allReady} onClick={() => send({ t: 'lobby.start' })}>
            Oyunu başlat
          </button>
        )}
      </section>
      {!owner && <p className="muted small">Masa sahibi herkes hazır olduğunda oyunu başlatır.</p>}

      <section className="card">
        <h2>Masa kuralları</h2>
        <ul className="rules">
          {lobby.rulesSummary.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
