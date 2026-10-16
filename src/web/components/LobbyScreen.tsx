import { useEffect, useState } from 'react';
import type { BotLevel, TableOptions } from '../../engine/rules.ts';
import { send, useApp } from '../net.ts';

export function LobbyScreen() {
  const app = useApp();
  const [code, setCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [quickTeam, setQuickTeam] = useState(false);
  const [quickLevel, setQuickLevel] = useState<BotLevel>('normal');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(app.me?.name ?? '');

  useEffect(() => {
    send({ t: 'lobby.list' });
    const id = setInterval(() => send({ t: 'lobby.list' }), 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <h1>101 Okey</h1>
        {editingName ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              send({ t: 'setName', name });
              setEditingName(false);
            }}
          >
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label="Ad" />
            <button className="btn small">Kaydet</button>
          </form>
        ) : (
          <button className="chip" onClick={() => setEditingName(true)} aria-label="Adı değiştir">
            👤 {app.me?.name} ✎
          </button>
        )}
      </header>

      <section className="hero-actions">
        <div className="quick-bots">
          <button className="btn primary big grow" onClick={() => send({ t: 'quick.bots', options: { teamMode: quickTeam, botLevel: quickLevel } })}>
            🤖 Botlarla hemen oyna
            <span className="small quick-sub">
              {quickTeam ? 'Eşli' : 'Tekli'} · {quickLevel === 'easy' ? 'Kolay' : 'Normal'} bot
            </span>
          </button>
          <div className="seg vertical" role="group" aria-label="Bot seviyesi">
            <button className={quickLevel === 'easy' ? 'on' : ''} onClick={() => setQuickLevel('easy')} aria-pressed={quickLevel === 'easy'}>
              Kolay
            </button>
            <button className={quickLevel === 'normal' ? 'on' : ''} onClick={() => setQuickLevel('normal')} aria-pressed={quickLevel === 'normal'}>
              Normal
            </button>
          </div>
          <div className="seg vertical" role="group" aria-label="Oyun türü">
            <button className={!quickTeam ? 'on' : ''} onClick={() => setQuickTeam(false)} aria-pressed={!quickTeam}>
              Tekli
            </button>
            <button className={quickTeam ? 'on' : ''} onClick={() => setQuickTeam(true)} aria-pressed={quickTeam}>
              Eşli
            </button>
          </div>
        </div>
        <button className="btn big" onClick={() => send({ t: 'quick.match' })}>
          ⚡ Hızlı eşleş
        </button>
        <button className="btn big" onClick={() => setShowCreate((v) => !v)}>
          ＋ Masa oluştur
        </button>
      </section>

      {showCreate && <CreateTable onDone={() => setShowCreate(false)} />}

      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) send({ t: 'lobby.join', code: code.trim() });
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Davet kodu"
          maxLength={6}
          aria-label="Davet kodu"
          style={{ flex: 1, textTransform: 'uppercase' }}
        />
        <button className="btn" disabled={code.trim().length < 6}>
          Katıl
        </button>
      </form>

      <section className="card">
        <h2>Açık masalar</h2>
        {app.lobbies.length === 0 && <p className="muted">Şu an açık masa yok. Bir masa oluşturun veya hızlı eşleşin.</p>}
        <ul className="lobby-list">
          {app.lobbies.map((l) => (
            <li key={l.id}>
              <div>
                <strong>{l.name}</strong>
                <div className="muted small">
                  {l.players}/4 oyuncu · {l.roundLimit} el · {l.turnSeconds} sn{l.allowPairs ? ' · çift açık' : ''}{l.teamMode ? ' · eşli' : ''}{l.botLevel === 'easy' ? ' · kolay bot' : l.botLevel === 'mixed' ? ' · karışık bot' : ''}
                </div>
              </div>
              {l.status === 'PLAYING' ? (
                <span className="chip">Oyunda</span>
              ) : (
                <button className="btn small" disabled={l.players >= 4} onClick={() => send({ t: 'lobby.join', lobbyId: l.id })}>
                  Otur
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="muted small center">İpucu: Telefonda yatay tutmak ıstakayı büyütür. Ana ekrana ekleyerek uygulama gibi açabilirsiniz.</p>
    </div>
  );
}

function CreateTable({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [opts, setOpts] = useState<Required<TableOptions>>({
    roundLimit: 10,
    turnSeconds: 30,
    allowPairs: true,
    onlyOwnMelds: false,
    allowJokerSwap: true,
    jokerSwapMustUse: false,
    teamMode: false,
    partnerOfWinnerExempt: true,
    botLevel: 'normal',
  });
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        send({ t: 'lobby.create', name: name || undefined, isPrivate, options: opts });
        onDone();
      }}
    >
      <label>
        Masa adı
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="isteğe bağlı" />
      </label>
      <label>
        El sayısı
        <select value={opts.roundLimit} onChange={(e) => setOpts({ ...opts, roundLimit: Number(e.target.value) })}>
          {[1, 3, 5, 7, 10, 11].map((n) => (
            <option key={n} value={n}>
              {n} el
            </option>
          ))}
        </select>
      </label>
      <label>
        Hamle süresi
        <select value={opts.turnSeconds} onChange={(e) => setOpts({ ...opts, turnSeconds: Number(e.target.value) })}>
          {[15, 20, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} sn
            </option>
          ))}
        </select>
      </label>
      <label>
        Bot seviyesi
        <select value={opts.botLevel} onChange={(e) => setOpts({ ...opts, botLevel: e.target.value as BotLevel })}>
          <option value="normal">Normal</option>
          <option value="easy">Kolay</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={opts.teamMode} onChange={(e) => setOpts({ ...opts, teamMode: e.target.checked })} />
        Eşli oyun (karşılıklı oturanlar takım)
      </label>
      {opts.teamMode && (
        <label className="check sub">
          <input
            type="checkbox"
            checked={opts.partnerOfWinnerExempt}
            onChange={(e) => setOpts({ ...opts, partnerOfWinnerExempt: e.target.checked })}
          />
          Bitirenin eşi ceza almaz
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={opts.allowPairs} onChange={(e) => setOpts({ ...opts, allowPairs: e.target.checked })} />
        Çift açma (5 çift)
      </label>
      <label className="check">
        <input type="checkbox" checked={opts.onlyOwnMelds} onChange={(e) => setOpts({ ...opts, onlyOwnMelds: e.target.checked })} />
        Sadece kendi perine işleme
      </label>
      <label className="check">
        <input type="checkbox" checked={opts.allowJokerSwap} onChange={(e) => setOpts({ ...opts, allowJokerSwap: e.target.checked })} />
        Okeyi masadan alma
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={opts.allowJokerSwap && opts.jokerSwapMustUse}
          disabled={!opts.allowJokerSwap}
          onChange={(e) => setOpts({ ...opts, jokerSwapMustUse: e.target.checked })}
        />
        Masadan alınan okey aynı tur kullanılmalı
      </label>
      <label className="check">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
        Özel masa (yalnız davet koduyla)
      </label>
      <button className="btn primary block">Oluştur</button>
    </form>
  );
}
