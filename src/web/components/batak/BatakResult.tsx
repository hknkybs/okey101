import { useEffect, useState } from 'react';
import { SUIT_NAME, SUIT_SYMBOL } from '../../../batak/cards.ts';
import { batakRanking, partnerOf, teamOf } from '../../../batak/game.ts';
import type { BatakClientView } from '../../../shared/protocol.ts';
import { send, serverNow } from '../../net.ts';

const teamName = (view: BatakClientView, t: number) => {
  const names = [t, t + 2].map((s) => (s === view.yourSeat ? 'Siz' : view.players[s].name));
  return `${t === teamOf(view.yourSeat) ? 'Biz' : 'Onlar'} (${names.join(' & ')})`;
};

export function BatakResultModal({ view, onLeave }: { view: BatakClientView; onLeave: () => void }) {
  const r = view.lastResult!;
  const ended = view.status === 'ENDED';
  const team = view.rules.mode === 'partnership';
  const name = (s: number) => (s === view.yourSeat ? 'Siz' : view.players[s].name);
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(id);
  }, []);
  const left = view.nextRoundAt ? Math.max(0, Math.ceil((view.nextRoundAt - now) / 1000)) : null;
  const order = batakRanking({ totals: view.totals, rules: view.rules });
  const top = order.map((x) => view.totals[x]);
  const draw = top.length > 1 && top[0] === top[1];

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="br-title">
      <div className="modal">
        <h2 id="br-title">{ended ? 'Maç bitti' : `${r.roundNo}. dağıtım bitti`}</h2>
        <p className="muted">
          <strong>{team ? teamName(view, teamOf(r.bidder)) : name(r.bidder)}</strong> {r.bid} ihale ({SUIT_SYMBOL[r.trump]} {SUIT_NAME[r.trump]} koz),{' '}
          {r.bidderTricks} el aldı — <strong className={r.made ? 'ok' : 'bad'}>{r.made ? 'sözünü tuttu' : 'battı'}</strong>
        </p>
        <div className="table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th>Oyuncu</th>
                <th>Aldığı el</th>
                <th>Hesap</th>
                {!team && <th>Puan</th>}
                {!team && <th>Toplam</th>}
              </tr>
            </thead>
            <tbody>
              {r.scores.map((s) => (
                <tr key={s.seat} className={s.seat === view.yourSeat ? 'me' : ''}>
                  <td>
                    {name(s.seat)}
                    {s.seat === r.bidder ? ' (ihaleci)' : ''}
                  </td>
                  <td>{s.tricks}</td>
                  <td className="small">{s.reason}</td>
                  {!team && <td className={s.finalScore < 0 ? 'bad' : 'good'}>{s.finalScore > 0 ? `+${s.finalScore}` : s.finalScore}</td>}
                  {!team && (
                    <td>
                      <strong>{view.totals[s.seat]}</strong>
                    </td>
                  )}
                </tr>
              ))}
              {team &&
                [0, 1].map((t) => {
                  const delta = r.scores[t].finalScore;
                  return (
                    <tr key={`t${t}`} className={`total ${t === teamOf(view.yourSeat) ? 'me' : ''}`}>
                      <td colSpan={2}>{teamName(view, t)}</td>
                      <td>
                        {r.tricksWon[t] + r.tricksWon[partnerOf(t)]} el · {delta > 0 ? `+${delta}` : delta}
                      </td>
                      <td>
                        <strong>{view.totals[t]}</strong>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {ended ? (
          <>
            <h3>Final sıralaması</h3>
            {draw && <p className="muted small">Beraberlik var.</p>}
            <ol className="ranking">
              {order.map((x, i) => (
                <li key={x} className={(team ? x === teamOf(view.yourSeat) : x === view.yourSeat) ? 'me' : ''}>
                  {i === 0 && !draw ? '🏆 ' : ''}
                  {team ? teamName(view, x) : name(x)} — {view.totals[x]} puan
                </li>
              ))}
            </ol>
            <div className="row">
              <button className="btn primary" onClick={() => send({ t: 'match.again' })}>
                Tekrar oyna
              </button>
              <button className="btn" onClick={() => send({ t: 'game.leave' })}>
                Lobiye dön
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="center muted">Sonraki dağıtım {left !== null ? `${left} sn` : 'birazdan'} içinde başlıyor…</p>
            <button className="btn small ghost block" onClick={onLeave}>
              Masadan kalk
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function BatakScoreSheet({ view, onClose }: { view: BatakClientView; onClose: () => void }) {
  const team = view.rules.mode === 'partnership';
  const name = (s: number) => (s === view.yourSeat ? 'Siz' : view.players[s].name);
  const cols = team ? [0, 1] : [0, 1, 2, 3];
  return (
    <div className="modal-back" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Skor tablosu</h2>
        <div className="table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                <th>İhale</th>
                {cols.map((c) => (
                  <th key={c}>{team ? teamName(view, c) : name(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.history.map((h) => (
                <tr key={h.roundNo}>
                  <td>{h.roundNo}</td>
                  <td className="small">
                    {name(h.bidder)} {h.bid} {h.made ? '✓' : '✗'}
                  </td>
                  {cols.map((c) => (
                    <td key={c} className={h.deltas[c] < 0 ? 'bad' : ''}>
                      {h.deltas[c]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Σ</td>
                {cols.map((c) => (
                  <td key={c}>
                    <strong>{view.totals[c]}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <h3>Kurallar</h3>
        <ul className="rules small">
          <li>Minimum ihale {view.rules.bidding.minimumBid}; pas geçen tekrar teklif veremez</li>
          <li>Renge uymak zorunlu; koz açılmadan kozla çıkılamaz</li>
          {view.rules.play.mustTrumpIfVoid && <li>Renk yoksa koz atmak zorunlu</li>}
          {view.rules.play.mustBeatIfPossible && <li>Eli geçebiliyorsanız geçmek zorunlu</li>}
          <li>
            {team
              ? 'İhaleci takım tutarsa +ihale×10, batarsa −ihale×10'
              : 'İhaleci tutarsa +ihale×10, batarsa −ihale×10; diğerleri aldıkları el×10'}
          </li>
          <li>Yüksek puan kazanır</li>
        </ul>
        <button className="btn block" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}
