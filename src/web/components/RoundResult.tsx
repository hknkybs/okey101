import { useEffect, useState } from 'react';
import { ranking, teamRanking } from '../../engine/game.ts';
import { teamOf, teamTotals } from '../../engine/rules.ts';
import type { FinishType } from '../../engine/types.ts';
import type { OkeyClientView as ClientGameView } from '../../shared/protocol.ts';
import { send, serverNow } from '../net.ts';
import { TileView } from './TileView.tsx';

const FINISH: Record<FinishType, string> = {
  normal: 'Normal bitiş',
  okey: 'Okeyle bitiş (×2)',
  pairs: 'Çiftten bitiş (×2)',
  okey_pairs: 'Çiftten okeyle bitiş (×4)',
  stock_empty: 'Deste bitti — bitiren yok',
};

const MOD: Record<string, string> = { OKEY_HELD: 'elde okey' };

/** Takım adı: oyuncunun kendi takımı "Biz". */
export function teamLabel(view: ClientGameView, team: number) {
  const seats = [team, team + 2].map((s) => (s === view.yourSeat ? 'Siz' : view.players[s].name));
  return `${team === teamOf(view.yourSeat) ? 'Biz' : 'Onlar'} (${seats.join(' & ')})`;
}

export function RoundResultModal({ view, onLeave }: { view: ClientGameView; onLeave: () => void }) {
  const r = view.lastResult!;
  const ended = view.status === 'ENDED';
  const name = (s: number) => (s === view.yourSeat ? 'Siz' : view.players[s].name);
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(id);
  }, []);
  const left = view.nextRoundAt ? Math.max(0, Math.ceil((view.nextRoundAt - now) / 1000)) : null;

  const totals = view.seats.map((s) => s.total);
  const wins = view.seats.map((s) => s.wins);
  const order = ranking(totals, wins);
  const team = view.rules.match.teamMode;
  const tTotals = teamTotals(totals);
  const tOrder = teamRanking(totals, wins);
  const tDelta = [0, 1].map((t) => r.scores.filter((s) => teamOf(s.seat) === t).reduce((a, s) => a + s.finalDelta, 0));
  const draw = team ? tTotals[0] === tTotals[1] : totals[order[0]] === totals[order[1]];

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="rr-title">
      <div className="modal">
        <h2 id="rr-title">
          {ended ? 'Maç bitti' : `${r.roundNo}. el bitti`}
        </h2>
        <p className="muted">
          {r.winner !== null ? (
            <>
              <strong>{name(r.winner)}</strong> eli bitirdi · {FINISH[r.finishType]}
            </>
          ) : (
            FINISH[r.finishType]
          )}
        </p>
        <div className="table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th>Oyuncu</th>
                <th>Hesap</th>
                <th>El</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {r.scores.map((s) => (
                <tr key={s.seat} className={s.seat === view.yourSeat ? 'me' : ''}>
                  <td>{name(s.seat)}</td>
                  <td className="small">
                    {s.reason}: {s.baseDelta}
                    {s.modifiers.map((m) => ` + ${m.delta} (${MOD[m.code] ?? m.code})`).join('')}
                    {s.multiplier !== 1 ? ` × ${s.multiplier}` : ''}
                  </td>
                  <td className={s.finalDelta < 0 ? 'good' : ''}>{s.finalDelta > 0 ? `+${s.finalDelta}` : s.finalDelta}</td>
                  <td>
                    <strong>{view.seats[s.seat].total}</strong>
                  </td>
                </tr>
              ))}
              {team &&
                [0, 1].map((t) => (
                  <tr key={`t${t}`} className={`total ${t === teamOf(view.yourSeat) ? 'me' : ''}`}>
                    <td colSpan={2}>{teamLabel(view, t)}</td>
                    <td>{tDelta[t] > 0 ? `+${tDelta[t]}` : tDelta[t]}</td>
                    <td>
                      <strong>{tTotals[t]}</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary className="small">Elde kalan taşlar</summary>
          {r.hands.map((h, s) => (
            <div key={s} className="hand-reveal">
              <span className="small">{name(s)}</span>
              <div className="meld-row">
                {h.map((t) => (
                  <TileView key={t.id} tile={t} okey={r.okey} size="mini" />
                ))}
                {h.length === 0 && <span className="small muted">—</span>}
              </div>
            </div>
          ))}
        </details>

        {ended ? (
          <>
            <h3>Final sıralaması</h3>
            {draw && <p className="muted small">Beraberlik — eşitlikte galibiyet sayısı belirleyicidir.</p>}
            {team ? (
              <ol className="ranking">
                {tOrder.map((t, i) => (
                  <li key={t} className={t === teamOf(view.yourSeat) ? 'me' : ''}>
                    {i === 0 ? '🏆 ' : ''}
                    {teamLabel(view, t)} — {tTotals[t]} puan, {wins[t] + wins[t + 2]} galibiyet
                    <div className="small muted">
                      {[t, t + 2].map((s) => `${name(s)}: ${totals[s]}`).join(' · ')}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <ol className="ranking">
                {order.map((s, i) => (
                  <li key={s} className={s === view.yourSeat ? 'me' : ''}>
                    {i === 0 ? '🏆 ' : ''}
                    {name(s)} — {view.seats[s].total} puan, {view.seats[s].wins} galibiyet
                  </li>
                ))}
              </ol>
            )}
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
            <p className="center muted">Sonraki el {left !== null ? `${left} sn` : 'birazdan'} içinde başlıyor…</p>
            <button className="btn small ghost block" onClick={onLeave}>
              Masadan kalk
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ScoreSheet({ view, onClose }: { view: ClientGameView; onClose: () => void }) {
  const name = (s: number) => (s === view.yourSeat ? 'Siz' : view.players[s].name);
  return (
    <div className="modal-back" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Skor tablosu</h2>
        <div className="table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th>El</th>
                {[0, 1, 2, 3].map((s) => (
                  <th key={s}>{name(s)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.history.map((h) => (
                <tr key={h.roundNo}>
                  <td>{h.roundNo}</td>
                  {h.deltas.map((d, s) => (
                    <td key={s} className={h.winner === s ? 'good' : ''}>
                      {d}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="total">
                <td>Σ</td>
                {view.seats.map((s) => (
                  <td key={s.seat}>
                    <strong>{s.total}</strong>
                  </td>
                ))}
              </tr>
              {view.rules.match.teamMode &&
                [0, 1].map((t) => (
                  <tr key={`t${t}`} className={t === teamOf(view.yourSeat) ? 'me' : ''}>
                    <td colSpan={5}>
                      {teamLabel(view, t)}: <strong>{teamTotals(view.seats.map((s) => s.total))[t]}</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <h3>Kurallar</h3>
        <ul className="rules small">
          <li>Açılış en az {view.rules.opening.minPoints} puan{view.rules.opening.allowPairs ? ` veya ${view.rules.opening.minPairs} çift` : ''}</li>
          <li>Bitiren {view.rules.scoring.winnerDelta}, açmayan +{view.rules.scoring.unopenedPenalty}, açan elde kalan toplamı</li>
          <li>Elde kalan okey +{view.rules.joker.heldPenalty}; okeyle/çiftten bitiş ×2</li>
          {view.rules.joker.allowSwap && (
            <li>
              Açtıysanız, masadaki okeyin temsil ettiği taşı koyup okeyi alabilirsiniz
              {view.rules.joker.swapMustUseSameTurn ? ' (alınan okey aynı tur masaya konmalı)' : ''}
            </li>
          )}
          {view.rules.match.teamMode && (
            <li>
              Eşli: takım puanı iki oyuncunun toplamı{view.rules.scoring.partnerOfWinnerExempt ? '; bitirenin eşi ceza almaz' : ''}
            </li>
          )}
          <li>Düşük puan kazanır</li>
        </ul>
        <button className="btn block" onClick={onClose}>
          Kapat
        </button>
      </div>
    </div>
  );
}
