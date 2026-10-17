import { useEffect, useState } from 'react';
import type { BatakTableOptions } from '../../batak/rules.ts';
import type { BotLevel, TableOptions } from '../../engine/rules.ts';
import { GAME_NAME, type GameId } from '../../shared/protocol.ts';
import { send, setSection, useApp } from '../net.ts';

/** Hamle süresi seçenekleri (sn). Çocuklarla oynayanlar için 90 ve 120 de var. */
const TURN_SECONDS = [15, 20, 30, 45, 60, 90, 120];

/** Her iki oyunun ana ekranı: hızlı oyun, eşleşme, masa oluşturma, davet kodu ve açık masalar. */
export function LobbyScreen({ game }: { game: GameId }) {
  const app = useApp();
  const lobbies = app.lobbies.filter((l) => l.game === game);
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
        <h1>{game === 'batak' ? '♠ ' : ''}{GAME_NAME[game]}</h1>
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

      {game === 'okey' ? (
        <button className="game-switch" onClick={() => setSection('batak')}>
          <span className="gs-icon" aria-hidden>
            ♠♥
          </span>
          <span className="grow">
            <strong>Batak oyna</strong>
            <span className="small muted block">İhaleli tekli ve eşli Batak</span>
          </span>
          <span aria-hidden>→</span>
        </button>
      ) : (
        <button className="game-switch back" onClick={() => setSection('okey')}>
          <span aria-hidden>←</span>
          <span className="grow">
            <strong>101 Okey'e dön</strong>
            <span className="small muted block">101 Okey ana ekranı</span>
          </span>
          <span className="gs-icon" aria-hidden>
            101
          </span>
        </button>
      )}

      <section className="hero-actions">
        <div className="quick-bots">
          <button className="btn primary big grow" onClick={() => send({ t: 'quick.bots', game, options: { teamMode: quickTeam, botLevel: quickLevel } })}>
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
        <button className="btn big" onClick={() => send({ t: 'quick.match', game })}>
          ⚡ Hızlı eşleş
        </button>
        <button className="btn big" onClick={() => setShowCreate((v) => !v)}>
          ＋ Masa oluştur
        </button>
      </section>

      {showCreate &&
        (game === 'batak' ? <CreateBatakTable onDone={() => setShowCreate(false)} /> : <CreateTable onDone={() => setShowCreate(false)} />)}

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
        {lobbies.length === 0 && <p className="muted">Şu an açık masa yok. Bir masa oluşturun veya hızlı eşleşin.</p>}
        <ul className="lobby-list">
          {lobbies.map((l) => (
            <li key={l.id}>
              <div>
                <strong>{l.name}</strong>
                <div className="muted small">
                  {l.players}/4 oyuncu · {l.info}
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
      <p className="muted small center">
        {game === 'okey'
          ? 'İpucu: Telefonda yatay tutmak ıstakayı büyütür. Ana ekrana ekleyerek uygulama gibi açabilirsiniz.'
          : 'İpucu: Kartınıza bir kez dokunup seçin, tekrar dokununca oynanır.'}
      </p>
    </div>
  );
}

function CreateTable({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [opts, setOpts] = useState<Required<TableOptions>>({
    roundLimit: 10,
    turnSeconds: 60,
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
        send({ t: 'lobby.create', game: 'okey', name: name || undefined, isPrivate, options: opts });
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
          {TURN_SECONDS.map((n) => (
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

function CreateBatakTable({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [opts, setOpts] = useState<Required<BatakTableOptions>>({
    teamMode: false,
    roundLimit: 10,
    turnSeconds: 60,
    minBid: 5,
    mustTrumpIfVoid: true,
    mustBeatIfPossible: false,
    allPassRedeal: false,
    openPartnerHand: true,
    minDefenderTricks: 0,
    botLevel: 'normal',
  });
  const minChoices = opts.teamMode ? [7, 8] : [4, 5];
  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        send({ t: 'lobby.create', game: 'batak', name: name || undefined, isPrivate, options: opts });
        onDone();
      }}
    >
      <label>
        Masa adı
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="isteğe bağlı" />
      </label>
      <label>
        Oyun türü
        <select
          value={opts.teamMode ? 'team' : 'solo'}
          onChange={(e) => {
            const teamMode = e.target.value === 'team';
            setOpts({ ...opts, teamMode, minBid: teamMode ? 8 : 5 });
          }}
        >
          <option value="solo">İhaleli tekli</option>
          <option value="team">İhaleli eşli</option>
        </select>
      </label>
      <label>
        Minimum ihale
        <select value={opts.minBid} onChange={(e) => setOpts({ ...opts, minBid: Number(e.target.value) })}>
          {minChoices.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Dağıtım sayısı
        <select value={opts.roundLimit} onChange={(e) => setOpts({ ...opts, roundLimit: Number(e.target.value) })}>
          {[1, 3, 5, 7, 10, 11].map((n) => (
            <option key={n} value={n}>
              {n} dağıtım
            </option>
          ))}
        </select>
      </label>
      <label>
        Kart süresi
        <select value={opts.turnSeconds} onChange={(e) => setOpts({ ...opts, turnSeconds: Number(e.target.value) })}>
          {TURN_SECONDS.map((n) => (
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
      {opts.teamMode && (
        <label className="check">
          <input type="checkbox" checked={opts.openPartnerHand} onChange={(e) => setOpts({ ...opts, openPartnerHand: e.target.checked })} />
          İhalecinin eşi kartlarını açar, o eli ihaleci oynar
        </label>
      )}
      <label className="wide">
        {opts.teamMode ? 'Rakip takım en az … el almalı' : 'İhaleye girmeyen her oyuncu en az … el almalı'}
        <select value={opts.minDefenderTricks} onChange={(e) => setOpts({ ...opts, minDefenderTricks: Number(e.target.value) })}>
          <option value={0}>Kapalı</option>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} el (alamazsa −ihale×10)
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={opts.mustTrumpIfVoid} onChange={(e) => setOpts({ ...opts, mustTrumpIfVoid: e.target.checked })} />
        Renk yoksa koz atmak zorunlu (koz da yoksa istenen kart)
      </label>
      <label className="check">
        <input type="checkbox" checked={opts.mustBeatIfPossible} onChange={(e) => setOpts({ ...opts, mustBeatIfPossible: e.target.checked })} />
        Yükseltme zorunlu (eli geçebiliyorsan geç)
      </label>
      <label className="check">
        <input type="checkbox" checked={opts.allPassRedeal} onChange={(e) => setOpts({ ...opts, allPassRedeal: e.target.checked })} />
        Herkes pas geçerse yeniden dağıt (kapalıysa son oyuncu ihaleyi alır)
      </label>
      <label className="check">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
        Özel masa (yalnız davet koduyla)
      </label>
      <button className="btn primary block">Oluştur</button>
    </form>
  );
}
