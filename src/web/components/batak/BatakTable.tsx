import { useEffect, useMemo, useRef, useState } from 'react';
import { isRed, sortHand, SUIT_NAME, SUIT_SYMBOL } from '../../../batak/cards.ts';
import { partnerOf, teamOf } from '../../../batak/game.ts';
import { SUITS, type PlayedCard, type Suit } from '../../../batak/types.ts';
import type { BatakClientView } from '../../../shared/protocol.ts';
import { send, sendCommand } from '../../net.ts';
import { LeaveDialog } from '../LeaveDialog.tsx';
import { TurnTimer } from '../TurnTimer.tsx';
import { BatakResultModal, BatakScoreSheet } from './BatakResult.tsx';
import { CardBack, CardView } from './CardView.tsx';

type Pos = 'bottom' | 'left' | 'top' | 'right';

export function BatakTable({ view }: { view: BatakClientView }) {
  const me = view.yourSeat;
  const team = view.rules.mode === 'partnership';
  // Hamle bende mi (açık eşin sırasında ihaleci hamle yapar).
  const myTurn = view.status === 'ACTIVE' && view.actorSeat === me;
  const dummy = view.dummySeat;
  const iAmDummy = dummy === me;
  const [selected, setSelected] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  // Oyun saat yönünde döner: sıradaki oyuncu solda.
  const posOf = (seat: number): Pos => (['bottom', 'left', 'top', 'right'] as const)[(seat - me + 4) % 4];
  const name = (s: number) => (s === me ? 'Siz' : view.players[s]?.name ?? `Oyuncu ${s + 1}`);

  const hand = useMemo(() => sortHand(view.hand, view.trump), [view.hand, view.trump]);
  const legal = new Set(view.legalCardIds);
  const canPlay = myTurn && view.phase === 'PLAYING' && view.activeSeat === me;
  const canPlayDummy = myTurn && view.phase === 'PLAYING' && dummy !== null && view.activeSeat === dummy;
  const dummyHand = useMemo(() => sortHand(view.dummyHand, view.trump), [view.dummyHand, view.trump]);

  useEffect(() => setSelected(null), [view.stateVersion]);

  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(60);
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  const tapCard = (id: string) => {
    if (!(canPlay || canPlayDummy) || !legal.has(id)) return;
    if (selected === id) {
      sendCommand({ type: 'play_card', cardId: id });
      setSelected(null);
    } else setSelected(id);
  };

  // Ortadaki el: oynanmakta olan, yoksa son biten el (kimin aldığıyla birlikte).
  const showingLast = view.trick.length === 0 && !!view.lastTrick && view.phase === 'PLAYING';
  const trickCards: PlayedCard[] = view.trick.length ? view.trick : showingLast ? view.lastTrick!.cards : [];

  const bidderTricks =
    view.bidder === null ? 0 : team ? view.tricksWon[view.bidder] + view.tricksWon[partnerOf(view.bidder)] : view.tricksWon[view.bidder];

  const statusText = (() => {
    if (view.status !== 'ACTIVE') return 'Dağıtım bitti';
    if (view.phase === 'BIDDING') return myTurn ? (view.mustBid ? 'Herkes pas geçti: ihaleyi almalısınız' : 'Teklif verin ya da pas geçin') : `Teklif sırası: ${name(view.activeSeat)}`;
    if (view.phase === 'TRUMP') return myTurn ? 'Kozu seçin' : `${name(view.activeSeat)} kozu seçiyor…`;
    if (iAmDummy) return view.activeSeat === me ? 'Kartlarınız açık; eşiniz sizin yerinize oynuyor' : `Kartlarınız açık · Sıra: ${name(view.activeSeat)}`;
    if (!myTurn) return view.activeSeat === dummy ? `${name(view.actorSeat)}, eşinin açık elinden oynuyor` : `Sıra: ${name(view.activeSeat)}`;
    if (canPlayDummy) return selected ? 'Oynamak için karta tekrar dokunun' : 'Eşinizin açık elinden kart seçin (üstte)';
    return selected ? 'Oynamak için karta tekrar dokunun' : 'Kartınızı seçin';
  })();

  const bidOf = (seat: number) => {
    const mine = view.bidHistory.filter((b) => b.seat === seat);
    if (!mine.length) return null;
    const last = mine[mine.length - 1];
    return last.value === null ? 'Pas' : String(last.value);
  };

  return (
    <div className="table batak">
      <div className="topbar">
        <button className="btn small ghost" onClick={() => setShowLeave(true)} aria-label="Masadan kalk">
          ← Kalk
        </button>
        <div className="grow center small">
          <span className="narrow-hide">Dağıtım </span>
          {view.roundNo}/{view.roundLimit}
          <span className="sep">·</span>
          {view.trump ? (
            <span className={`trump-chip ${isRed(view.trump) ? 'red' : 'black'}`} title={`Koz: ${SUIT_NAME[view.trump]}`}>
              Koz {SUIT_SYMBOL[view.trump]}
            </span>
          ) : (
            <span className="muted" title="Koz henüz seçilmedi">
              Koz —
            </span>
          )}
          {team && (
            <>
              <span className="sep">·</span>
              Biz <strong>{view.totals[me]}</strong> – <strong>{view.totals[(me + 1) % 4]}</strong> Onlar
            </>
          )}
        </div>
        <button className="btn small ghost" onClick={() => setShowScores(true)}>
          Skor
        </button>
      </div>

      {view.bidder !== null && view.highBid !== null && (
        <div className="contract-bar small">
          İhale: <strong>{name(view.bidder)}</strong> {view.highBid}
          {view.phase === 'PLAYING' && (
            <>
              <span className="sep">·</span>
              {team ? 'Takım aldığı' : 'Aldığı'}: <strong className={bidderTricks >= view.highBid ? 'ok' : ''}>{bidderTricks}</strong>/{view.highBid}
              <span className="sep">·</span>
              {view.trickNo}. el
            </>
          )}
        </div>
      )}

      {dummy !== null && !iAmDummy && (
        <div className={`dummy-strip ${canPlayDummy ? 'can' : ''}`} aria-label={`${name(dummy)} açık eli`}>
          <div className="dl small">
            {name(dummy)}
            {team && dummy === partnerOf(me) ? ' (eşiniz)' : ''} · açık el
            {canPlayDummy && <strong> — sıra bu elde</strong>}
          </div>
          <div className="dummy-cards">
            {dummyHand.map((c) => (
              <CardView
                key={c.id}
                card={c}
                size="dummy"
                selected={selected === c.id}
                disabled={!canPlayDummy || !legal.has(c.id)}
                dim={canPlayDummy && !legal.has(c.id)}
                onClick={canPlayDummy ? () => tapCard(c.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <div className="batak-board">
        {[1, 2, 3].map((k) => {
          const seat = (me + k) % 4;
          return <BatakSeat key={seat} view={view} seat={seat} pos={posOf(seat)} bid={bidOf(seat)} />;
        })}

        <div className="trick-area" aria-label="Ortadaki el">
          {trickCards.map((p) => (
            <div key={p.card.id} className={`trick-slot ${posOf(p.seat)} ${showingLast ? 'faded' : ''}`}>
              <CardView card={p.card} size="trick" highlight={showingLast && view.lastTrick!.winner === p.seat} />
              {view.trump && p.card.suit === view.trump && trickCards[0].card.suit !== view.trump && (
                <span className="cut-tag" title="Renk yoktu, kozla kesti">
                  koz
                </span>
              )}
            </div>
          ))}
          {showingLast && <div className="trick-caption small">{name(view.lastTrick!.winner)} aldı</div>}
          {view.phase === 'BIDDING' && <BidHistory view={view} name={name} />}
        </div>
      </div>

      <div className="batak-panel">
        <div className={`status ${myTurn ? 'mine' : ''}`} aria-live="assertive">
          {statusText}
          {view.deadlineAt && myTurn && <TurnTimer deadline={view.deadlineAt} total={view.phase === 'PLAYING' ? view.rules.timers.playSeconds : view.rules.timers.bidSeconds} />}
        </div>

        {view.phase === 'BIDDING' && myTurn && (
          <div className="bid-grid" role="group" aria-label="Teklif">
            {Array.from({ length: 14 - view.minNextBid }, (_, i) => view.minNextBid + i).map((v) => (
              <button key={v} className="btn small bid-btn" onClick={() => sendCommand({ type: 'bid', value: v })}>
                {v}
              </button>
            ))}
            <button className="btn small ghost pass-btn" disabled={view.mustBid} onClick={() => sendCommand({ type: 'pass' })}>
              Pas
            </button>
          </div>
        )}

        {view.phase === 'TRUMP' && myTurn && (
          <div className="trump-grid" role="group" aria-label="Koz seçimi">
            {SUITS.map((s: Suit) => (
              <button key={s} className={`btn trump-btn ${isRed(s) ? 'red' : 'black'}`} onClick={() => sendCommand({ type: 'choose_trump', suit: s })}>
                <span className="sym">{SUIT_SYMBOL[s]}</span>
                <span className="small">
                  {SUIT_NAME[s]} · {view.hand.filter((c) => c.suit === s).length} kart
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view.players[me]?.botControlled && view.status === 'ACTIVE' && (
        <div className="auto-banner small">
          Süre aşımı nedeniyle yerinize bot oynuyor.
          <button className="btn tiny primary" onClick={() => send({ t: 'game.resume' })}>
            Kontrolü al
          </button>
        </div>
      )}

      <div className="my-info small">
        <span className={`status-inline ${myTurn ? 'mine' : ''}`} aria-hidden>
          {statusText}
        </span>
        <span>
          <strong>{name(me)}</strong>
          {bidOf(me) && view.phase === 'BIDDING' ? ` · teklif: ${bidOf(me)}` : ''}
          {view.bidder === me ? ' · ihaleci' : ''}
        </span>
        <span>
          Aldığınız el: <strong>{view.tricksWon[me]}</strong>
          {!team && (
            <>
              <span className="sep">·</span>Puan: <strong>{view.totals[me]}</strong>
            </>
          )}
        </span>
      </div>

      <div className={`batak-hand ${canPlay ? 'can' : ''}`}>
        {hand.map((c) => (
          <CardView
            key={c.id}
            card={c}
            selected={selected === c.id}
            disabled={canPlay && !legal.has(c.id)}
            dim={canPlay && !legal.has(c.id)}
            onClick={() => tapCard(c.id)}
          />
        ))}
      </div>

      {view.status !== 'ACTIVE' && view.lastResult && <BatakResultModal view={view} onLeave={() => setShowLeave(true)} />}
      {showScores && <BatakScoreSheet view={view} onClose={() => setShowScores(false)} />}
      {showLeave && <LeaveDialog view={view} onClose={() => setShowLeave(false)} />}
    </div>
  );
}

function BatakSeat({ view, seat, pos, bid }: { view: BatakClientView; seat: number; pos: Pos; bid: string | null }) {
  const p = view.players[seat];
  const team = view.rules.mode === 'partnership';
  const active = view.status === 'ACTIVE' && view.activeSeat === seat;
  const isPartner = team && seat === partnerOf(view.yourSeat);
  return (
    <div className={`seat-badge bseat ${pos} ${active ? 'active' : ''} ${team ? `team-${teamOf(seat)}` : ''}`}>
      <div className="who">
        <span className="nm">
          {p.isBot || p.botControlled ? '🤖 ' : ''}
          {p.name}
        </span>
        {!p.connected && (
          <span className="off" title="Bağlantı yok">
            ⚠︎
          </span>
        )}
      </div>
      <div className="meta small">
        <CardBack count={view.handCounts[seat]} />
        {isPartner && <span className="chip tiny partner">Eş</span>}
        {p.botLevel === 'easy' && <span className="chip tiny">Kolay</span>}
        {view.phase === 'BIDDING' && bid && <span className={`chip tiny ${bid === 'Pas' ? '' : 'ok'}`}>{bid}</span>}
        {view.bidder === seat && view.phase !== 'BIDDING' && <span className="chip tiny ok">İhale {view.highBid}</span>}
        {view.dummySeat === seat && <span className="chip tiny">Açık el</span>}
        {view.voids[seat]?.map((s) => (
          <span key={s} className={`chip tiny void ${isRed(s) ? 'red' : ''}`} title={`${SUIT_NAME[s]} kalmadı`}>
            {SUIT_SYMBOL[s]} yok
          </span>
        ))}
      </div>
      <div className="meta small">
        <span>
          El: <strong>{view.tricksWon[seat]}</strong>
        </span>
        {!team && <span className="score">{view.totals[seat]}</span>}
      </div>
      {active && view.deadlineAt && (
        <TurnTimer deadline={view.deadlineAt} total={view.phase === 'PLAYING' ? view.rules.timers.playSeconds : view.rules.timers.bidSeconds} bar />
      )}
    </div>
  );
}

function BidHistory({ view, name }: { view: BatakClientView; name: (s: number) => string }) {
  if (!view.bidHistory.length) return <div className="bid-history small muted">İhale {name((view.dealer + 1) % 4)} ile başlıyor</div>;
  return (
    <div className="bid-history small" aria-label="Teklifler">
      {view.bidHistory.slice(-8).map((b, i) => (
        <span key={i} className={`chip tiny ${b.value === null ? '' : 'ok'}`}>
          {name(b.seat)}: {b.value === null ? 'pas' : b.value}
        </span>
      ))}
    </div>
  );
}
