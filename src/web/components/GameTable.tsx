import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveJokerSwap, resolveLayoff, resolveMeld, resolvePair } from '../../engine/melds.ts';
import type { Meld, Tile } from '../../engine/types.ts';
import { canTouchMeld, partnerOf, teamOf, teamTotals } from '../../engine/rules.ts';
import type { OkeyClientView as ClientGameView } from '../../shared/protocol.ts';
import { send, sendCommand, toast } from '../net.ts';
import { arrange, moveTiles, RACK_COLS, swapOrMove, syncRack, type ArrangeMode } from '../rack.ts';
import { findBestMelds } from '../../engine/bot.ts';
import { isRealOkey, naturalFace } from '../../engine/tiles.ts';
import { LeaveDialog } from './LeaveDialog.tsx';
import { RoundResultModal, ScoreSheet } from './RoundResult.tsx';
import { TileBack, TileView } from './TileView.tsx';
import { TurnTimer } from './TurnTimer.tsx';

interface Staged {
  id: number;
  tileIds: string[];
}

let stageSeq = 0;

export function GameTable({ view }: { view: ClientGameView }) {
  const me = view.yourSeat;
  const okey = view.okey;
  const roundKey = `${view.matchId}:${view.roundNo}`;
  const opened = view.seats[me].opened;
  const myTurn = view.status === 'ACTIVE' && view.activeSeat === me;
  const prev = (me + 3) % 4;
  const prevTop = view.seats[prev].discards.at(-1) ?? null;
  const mustUseDiscard = view.rules.discard.mustUseTakenDiscardToOpen && !opened;

  const [rack, setRack] = useState<(string | null)[]>([]);
  const rackKey = useRef('');
  const prevHandIds = useRef<Set<string>>(new Set());
  const [newTileId, setNewTileId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [staging, setStaging] = useState<Staged[]>([]);
  const [pairsMode, setPairsMode] = useState(false);
  const [takeMode, setTakeMode] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  // Eli sunucu durumuyla eşitle (düzen korunur).
  useEffect(() => {
    const fresh = rackKey.current !== roundKey;
    if (fresh) {
      rackKey.current = roundKey;
      setStaging([]);
      setSelected([]);
      setTakeMode(false);
      setPairsMode(false);
      setNewTileId(null);
      setFlipped(new Set());
    } else {
      const added = view.hand.filter((t) => !prevHandIds.current.has(t.id));
      if (added.length === 1) setNewTileId(added[0].id);
    }
    prevHandIds.current = new Set(view.hand.map((t) => t.id));
    setRack((r) => syncRack(fresh ? [] : r, view.hand, okey));
  }, [view.hand, roundKey, okey]);

  // Yandan alma modu yalnız kendi çekme fazımızda geçerli.
  const takeValid = takeMode && myTurn && view.phase === 'DRAW' && !!prevTop;
  useEffect(() => {
    if (takeMode && !takeValid) setTakeMode(false);
  }, [takeMode, takeValid]);
  const pending = takeValid ? prevTop : null;

  const tilesById = useMemo(() => {
    const m = new Map<string, Tile>(view.hand.map((t) => [t.id, t]));
    if (pending) m.set(pending.id, pending);
    return m;
  }, [view.hand, pending]);

  // Elde olmayan taşları seçimden/hazırlıktan temizle.
  useEffect(() => {
    setSelected((s) => s.filter((id) => tilesById.has(id)));
    setStaging((st) => {
      const next = st.map((g) => ({ ...g, tileIds: g.tileIds.filter((id) => tilesById.has(id)) })).filter((g) => g.tileIds.length);
      return next.length === st.length && next.every((g, i) => g.tileIds.length === st[i].tileIds.length) ? st : next;
    });
  }, [tilesById]);

  // Sıra bize geldiğinde titreşim + duyuru.
  const wasMyTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) navigator.vibrate?.(60);
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  const stagedIds = new Set(staging.flatMap((g) => g.tileIds));
  const tilesOf = (ids: string[]) => ids.map((id) => tilesById.get(id)!).filter(Boolean);

  // ── Hazırlık alanı doğrulaması (istemci önizlemesi; kesin karar sunucuda) ──
  const stagedInfo = staging.map((g) => {
    const tiles = tilesOf(g.tileIds);
    if (pairsMode) {
      const p = resolvePair(tiles, okey);
      return { g, tiles, placed: p, valid: !!p, value: 0 };
    }
    const r = resolveMeld(tiles, okey);
    return { g, tiles, placed: r?.tiles ?? null, valid: !!r, value: r?.value ?? 0 };
  });
  const stagedTotal = stagedInfo.reduce((s, x) => s + x.value, 0);
  const allValid = stagedInfo.length > 0 && stagedInfo.every((x) => x.valid);
  const remainingAfter = view.hand.length + (pending ? 1 : 0) - stagedIds.size;
  const includesPending = !pending || stagedIds.has(pending.id);
  let openBlocker: string | null = null;
  if (!allValid) openBlocker = 'Geçersiz per var';
  else if (remainingAfter < 1) openBlocker = 'Atmak için bir taş bırakın';
  else if (!includesPending) openBlocker = 'Yandan aldığınız taşı kullanın';
  else if (!opened && !pairsMode && stagedTotal < view.rules.opening.minPoints) openBlocker = `${stagedTotal}/${view.rules.opening.minPoints}`;
  else if (!opened && pairsMode && staging.length < view.rules.opening.minPairs) openBlocker = `${staging.length}/${view.rules.opening.minPairs} çift`;
  else if (opened === 'melds' && pairsMode) openBlocker = 'Seri/grup ile açtınız';
  else if (opened === 'pairs' && !pairsMode) openBlocker = 'Çift ile açtınız';
  const phaseOk = myTurn && (view.phase === 'ACTIONS' || (view.phase === 'DRAW' && !!pending));
  const canOpen = phaseOk && !openBlocker;

  // ── Eylemler ──
  // Çift dokunuşla ters çevrilen taşlar (yalnız istemcide; ters taş atılamaz — okeyi yanlışlıkla atmamak için).
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const toggleFlip = (id: string) =>
    setFlipped((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const orderedSelection = () => {
    const pos = (id: string) => {
      const i = rack.indexOf(id);
      return i < 0 ? 999 : i;
    };
    return [...selected].sort((a, b) => pos(a) - pos(b));
  };

  const addToStaging = () => {
    const ids = orderedSelection();
    if (pairsMode && ids.length !== 2) return toast('Çift için 2 taş seçin', 'error');
    if (!pairsMode && ids.length < 3) return toast('Per için en az 3 taş seçin', 'error');
    const tiles = tilesOf(ids);
    if (pairsMode ? !resolvePair(tiles, okey) : !resolveMeld(tiles, okey)) {
      toast(pairsMode ? 'Bu iki taş çift değil' : 'Bu taşlar geçerli seri/grup değil', 'error');
      return;
    }
    setStaging((st) => [...st, { id: ++stageSeq, tileIds: ids }]);
    setSelected([]);
  };

  const submitOpen = () => {
    if (!canOpen) return;
    const payload = pairsMode
      ? ({ kind: 'pairs', pairs: staging.map((g) => g.tileIds) } as const)
      : ({ kind: 'melds', melds: staging.map((g) => ({ tileIds: g.tileIds })) } as const);
    if (pending) sendCommand({ type: 'take_discard', open: payload });
    else if (payload.kind === 'pairs') sendCommand({ type: 'open_pairs', pairs: payload.pairs });
    else sendCommand({ type: 'open_melds', melds: payload.melds });
  };

  const drawStock = () => {
    if (!myTurn || view.phase !== 'DRAW') return;
    setTakeMode(false);
    sendCommand({ type: 'draw_stock' });
  };

  const tapPrevDiscard = () => {
    if (!myTurn || view.phase !== 'DRAW' || !prevTop) return;
    if (!mustUseDiscard) return sendCommand({ type: 'take_discard' });
    if (takeMode) {
      setTakeMode(false);
      return;
    }
    setTakeMode(true);
    setSelected((s) => [...s, prevTop.id]);
    toast('Yandan alınan taşla açılış perlerini hazırlayın, sonra "Al ve Aç"');
  };

  const discard = () => {
    if (!myTurn || view.phase !== 'ACTIONS' || selected.length !== 1) return;
    if (jokerBlocksDiscard) return toast('Önce masadan aldığınız okeyi masaya koyun', 'error');
    if (flipped.has(selected[0])) return toast('Ters çevrilmiş taş atılamaz. Çift dokunarak çevirin.', 'error');
    sendCommand({ type: 'discard', tileId: selected[0] });
    setSelected([]);
  };

  const single = selected.length === 1 ? tilesById.get(selected[0]) : undefined;
  const canLayoff = myTurn && view.phase === 'ACTIONS' && !!opened && !!single && single.id !== pending?.id;
  const layoffTargets = new Set(
    canLayoff
      ? view.melds
          .filter((m) => canTouchMeld(view.rules, me, m.owner))
          .filter((m) => resolveLayoff(m, single!, okey))
          .map((m) => m.id)
      : [],
  );
  // Okeyi masadan alma: seçili taş, açık perdeki okeyin temsil ettiği taşsa.
  const swapTargets = new Set(
    canLayoff && view.rules.joker.allowSwap
      ? view.melds
          .filter((m) => canTouchMeld(view.rules, me, m.owner))
          .filter((m) => resolveJokerSwap(m, single!, okey))
          .map((m) => m.id)
      : [],
  );
  // Aynı perde hem işleme hem okey alma mümkünse (grupta) oyuncuya sorulur.
  const [meldChoice, setMeldChoice] = useState<string | null>(null);
  useEffect(() => setMeldChoice(null), [selected, view.stateVersion]);

  const layoff = (meldId: string) => {
    if (!single) return;
    sendCommand({ type: 'layoff', meldId, tileId: single.id });
    setSelected([]);
  };
  const swapJoker = (meldId: string) => {
    if (!single) return;
    sendCommand({ type: 'swap_joker', meldId, tileId: single.id });
    setSelected([]);
  };
  const onMeld = (m: Meld) => {
    const canL = layoffTargets.has(m.id);
    const canS = swapTargets.has(m.id);
    if (canL && canS) setMeldChoice(m.id);
    else if (canS) swapJoker(m.id);
    else if (canL) layoff(m.id);
  };

  // Masadan alınan okeyi aynı tur koyma şartı (sunucudaki kuralın önizlemesi).
  const mustUseJokers = view.mustUseJokerIds.filter((id) => tilesById.has(id));
  const jokerBlocksDiscard =
    view.hand.length > 1 &&
    mustUseJokers.some((id) =>
      view.melds.some((m) => canTouchMeld(view.rules, me, m.owner) && resolveLayoff(m, tilesById.get(id)!, okey)),
    );

  const onSlot = (i: number) => {
    const id = rack[i];
    if (id && !stagedIds.has(id)) {
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && prev.id === id && now - prev.t < 350) {
        // İkinci dokunuş: ilk dokunuşun seçimini geri al ve taşı çevir.
        lastTap.current = null;
        toggleSelect(id);
        toggleFlip(id);
        return;
      }
      lastTap.current = { id, t: now };
      return toggleSelect(id);
    }
    if (!id) {
      const movable = orderedSelection().filter((x) => rack.includes(x));
      if (movable.length) {
        setRack((r) => moveTiles(r, movable, i));
        setSelected((s) => s.filter((x) => !movable.includes(x)));
      }
    }
  };

  const doArrange = (mode: ArrangeMode) => {
    setRack(arrange(view.hand, okey, mode));
    setSelected([]);
  };

  const name = (s: number) => view.players[s]?.name ?? `Oyuncu ${s + 1}`;
  const statusText = (() => {
    if (view.status !== 'ACTIVE') return 'El bitti';
    if (!myTurn) return `Sıra: ${name(view.activeSeat)}`;
    if (view.phase === 'DRAW') return pending ? 'Yandan alınan taşla açın' : 'Desteden çekin ya da yandan alın';
    if (jokerBlocksDiscard) return 'Masadan aldığınız okeyi bu tur masaya koyun';
    return view.turnNo === 1 && view.hand.length === 22 ? 'İlk taşınızı atın' : 'Açın / işleyin, sonra bir taş atın';
  })();

  // Eldeki taşların toplamı ve açılış için kurulabilecek en iyi per toplamı (önizleme).
  const handStats = useMemo(() => {
    const okeys = view.hand.filter((t) => isRealOkey(t, okey)).length;
    const sum = view.hand.filter((t) => !isRealOkey(t, okey)).reduce((s, t) => s + naturalFace(t, okey).number, 0);
    const meldTotal = findBestMelds(view.hand, okey).total;
    const faces = new Map<string, number>();
    for (const t of view.hand) {
      const k = t.kind === 'F' ? `${okey.color}${okey.number}` : `${t.color}${t.number}`;
      faces.set(k, (faces.get(k) ?? 0) + 1);
    }
    const pairs = [...faces.values()].reduce((s, n) => s + Math.floor(n / 2), 0);
    return { sum, okeys, meldTotal, pairs };
  }, [view.hand, okey]);
  const minPoints = view.rules.opening.minPoints;

  const opponents = [(me + 2) % 4, (me + 3) % 4, (me + 1) % 4]; // üst, sol, sağ
  const meldsByOwner = [0, 1, 2, 3]
    .map((s) => ({ seat: s, melds: view.melds.filter((m) => m.owner === s) }))
    .filter((x) => x.melds.length);

  return (
    <div className="table">
      <div className="topbar">
        <button className="btn small ghost" onClick={() => setShowLeave(true)} aria-label="Masadan kalk">
          ← Kalk
        </button>
        <div className="grow center small">
          <span className="narrow-hide">El </span>
          {view.roundNo}/{view.roundLimit}
          {view.rules.match.teamMode && (
            <>
              <span className="sep">·</span>
              <TeamScore view={view} />
            </>
          )}
          <span className="sep">·</span>
          <span title="Okey">
            <span className="narrow-hide">Okey: </span>
            <strong className={`c-${okey.color}`}>{view.okeyLabel}</strong>
          </span>
        </div>
        <button className="btn small ghost" onClick={() => setShowScores(true)}>
          Skor
        </button>
      </div>

      <div className="upper">
      <div className="opponents">
        {opponents.map((s, k) => (
          <SeatBadge key={s} view={view} seat={s} pos={['top', 'left', 'right'][k]} />
        ))}
      </div>

      <div className="center-strip">
        <button
          className={`stock ${myTurn && view.phase === 'DRAW' ? 'can' : ''}`}
          onClick={drawStock}
          disabled={!myTurn || view.phase !== 'DRAW'}
          aria-label={`Desteden çek, ${view.stockCount} taş kaldı`}
        >
          <TileBack count={view.stockCount} size="center" />
          <span className="small">Deste</span>
        </button>
        <div className="indicator" aria-label="Gösterge">
          <TileView tile={view.indicator} size="center" />
          <span className="small">Gösterge</span>
        </div>
        <div className="last-action small" aria-live="polite">
          {view.lastAction.seat !== null ? <strong>{name(view.lastAction.seat)}</strong> : null} {view.lastAction.text}
        </div>
      </div>
      </div>

      <div className="melds-area">
        {meldsByOwner.length === 0 && <div className="muted small center pad">Henüz açılan per yok</div>}
        {meldsByOwner.map(({ seat, melds }) => (
          <div key={seat} className="meld-owner">
            <div className="owner-name small">
              {seat === me ? 'Siz' : name(seat)}
              {view.rules.match.teamMode && seat === partnerOf(me) ? ' (eşiniz)' : ''}
            </div>
            <div className="meld-row">
              {melds.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`meld ${layoffTargets.has(m.id) ? 'target' : ''} ${swapTargets.has(m.id) ? 'swap' : ''} ${meldChoice === m.id ? 'chosen' : ''}`}
                  onClick={() => onMeld(m)}
                  disabled={!layoffTargets.has(m.id) && !swapTargets.has(m.id)}
                  aria-label={`${m.kind === 'run' ? 'Seri' : m.kind === 'group' ? 'Grup' : 'Çift'}${swapTargets.has(m.id) ? ', okeyi almak için dokunun' : layoffTargets.has(m.id) ? ', işlemek için dokunun' : ''}`}
                >
                  {swapTargets.has(m.id) && (
                    <span className="swap-hint" aria-hidden>
                      Okeyi al
                    </span>
                  )}
                  {m.tiles.map((p) => (
                    <TileView key={p.tile.id} tile={p.tile} as={p.as} okey={okey} size="meld" />
                  ))}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {staging.length > 0 && (
        <div className="staging">
          <div className="staging-head small">
            <span>
              {pairsMode ? `Çiftler: ${staging.length}` : `Hazırlanan perler: ${stagedTotal}`}
              {!opened && !pairsMode && ` / ${view.rules.opening.minPoints}`}
              {!opened && pairsMode && ` / ${view.rules.opening.minPairs}`}
            </span>
            <button className="link" onClick={() => setStaging([])}>
              Temizle
            </button>
          </div>
          <div className="meld-row">
            {stagedInfo.map(({ g, tiles, placed, valid }) => (
              <button
                key={g.id}
                type="button"
                className={`meld staged ${valid ? '' : 'invalid'}`}
                onClick={() => setStaging((st) => st.filter((x) => x.id !== g.id))}
                aria-label="Hazırlanan per, geri almak için dokunun"
              >
                {(placed ?? tiles.map((tile) => ({ tile, as: undefined }))).map((p) => (
                  <TileView key={p.tile.id} tile={p.tile} as={p.as} okey={okey} size="meld" />
                ))}
              </button>
            ))}
          </div>
        </div>
      )}

      {view.players[me].botControlled && view.status === 'ACTIVE' && (
        <div className="auto-banner small">
          Süre aşımı nedeniyle yerinize bot oynuyor.
          <button className="btn tiny primary" onClick={() => send({ t: 'game.resume' })}>
            Kontrolü al
          </button>
        </div>
      )}

      <div className="lower">
      <div className="action-bar">
        <div className={`status ${myTurn ? 'mine' : ''}`} aria-live="assertive">
          {statusText}
          {view.deadlineAt && <TurnTimer deadline={view.deadlineAt} total={view.rules.round.maxTurnSeconds} />}
        </div>
        <div className="actions">
          {meldChoice && (
            <>
              <button className="btn small" onClick={() => layoff(meldChoice)}>
                İşle
              </button>
              <button className="btn small primary" onClick={() => swapJoker(meldChoice)}>
                Okeyi al
              </button>
            </>
          )}
          {selected.length >= (pairsMode ? 2 : 3) && (
            <button className="btn small" onClick={addToStaging}>
              {pairsMode ? 'Çift yap' : 'Per yap'}
            </button>
          )}
          {staging.length > 0 && (
            <button className="btn small primary" disabled={!canOpen} onClick={submitOpen}>
              {pending ? 'Al ve Aç' : opened ? 'İndir' : 'Aç'}
              {openBlocker && phaseOk ? ` (${openBlocker})` : ''}
            </button>
          )}
          {view.rules.opening.allowPairs && opened !== 'melds' && (
            <button
              className={`btn small ghost ${pairsMode ? 'on' : ''}`}
              onClick={() => {
                setPairsMode((v) => !v);
                setStaging([]);
              }}
              aria-pressed={pairsMode}
            >
              Çift
            </button>
          )}
          {myTurn && view.phase === 'ACTIONS' && (
            <button
              className="btn small danger"
              disabled={selected.length !== 1 || selected[0] === pending?.id || jokerBlocksDiscard || flipped.has(selected[0])}
              onClick={discard}
              title={jokerBlocksDiscard ? 'Önce masadan aldığınız okeyi koyun' : undefined}
            >
              At
            </button>
          )}
        </div>
      </div>

      <div className="discard-row">
        <div className="pile">
          <span className="small muted">{name(prev)} attı</span>
          {prevTop ? (
            <TileView
              tile={prevTop}
              okey={okey}
              size="rack"
              selected={!!pending && selected.includes(prevTop.id)}
              highlight={myTurn && view.phase === 'DRAW'}
              badge={pending ? 'geçici' : undefined}
              onClick={
                myTurn && view.phase === 'DRAW'
                  ? () => (pending ? (stagedIds.has(pending.id) ? undefined : toggleSelect(pending.id)) : tapPrevDiscard())
                  : undefined
              }
            />
          ) : (
            <div className="tile sz-rack empty" />
          )}
          {pending && (
            <button className="link small" onClick={() => setTakeMode(false)}>
              Vazgeç
            </button>
          )}
        </div>
        <div className="mid">
        <div className="hand-stats small" aria-live="polite">
          {opened ? (
            <span title="El biterse açmış oyuncu olarak yazılacak ceza">
              Elde kalan: <strong>{handStats.sum}</strong>
              {handStats.okeys > 0 && <span className="muted"> + okey</span>}
            </span>
          ) : (
            <>
              <span title="Elinizdeki taşların sayı toplamı">
                Toplam <strong>{handStats.sum}</strong>
              </span>
              <span className={handStats.meldTotal >= minPoints ? 'ok' : ''} title="Elinizden kurulabilecek perlerin en yüksek toplamı">
                Per <strong>{handStats.meldTotal}</strong>/{minPoints}
              </span>
              {view.rules.opening.allowPairs && (
                <span className={handStats.pairs >= view.rules.opening.minPairs ? 'ok' : ''} title="Elinizdeki çift sayısı">
                  Çift <strong>{handStats.pairs}</strong>/{view.rules.opening.minPairs}
                </span>
              )}
            </>
          )}
        </div>
        <div className="arrange">
          <button className="btn tiny ghost" onClick={() => doArrange('smart')}>
            Diz
          </button>
          <button className="btn tiny ghost" onClick={() => doArrange('color')}>
            Renk
          </button>
          <button className="btn tiny ghost" onClick={() => doArrange('pairs')}>
            Çift
          </button>
        </div>
        </div>
        <div className="pile">
          <span className="small muted">Sizin attığınız</span>
          {view.seats[me].discards.at(-1) ? (
            <TileView tile={view.seats[me].discards.at(-1)!} okey={okey} size="rack" />
          ) : (
            <button
              type="button"
              className={`tile sz-rack empty ${myTurn && view.phase === 'ACTIONS' && selected.length === 1 ? 'drop' : ''}`}
              onClick={discard}
              aria-label="Seçili taşı at"
            />
          )}
        </div>
      </div>
      </div>

      <div className="rack" style={{ ['--cols' as string]: RACK_COLS }}>
        {rack.map((id, i) => {
          const t = id ? tilesById.get(id) : undefined;
          return (
            <div
              key={i}
              className="slot"
              onClick={() => !t && onSlot(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dragged = e.dataTransfer.getData('text/plain');
                if (dragged && rack.includes(dragged)) setRack((r) => swapOrMove(r, dragged, i));
              }}
            >
              {t && (
                <TileView
                  tile={t}
                  okey={okey}
                  selected={selected.includes(t.id)}
                  dim={stagedIds.has(t.id)}
                  faceDown={flipped.has(t.id)}
                  badge={mustUseJokers.includes(t.id) ? 'koy' : t.id === newTileId ? 'yeni' : undefined}
                  onClick={() => onSlot(i)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      {view.status !== 'ACTIVE' && view.lastResult && <RoundResultModal view={view} onLeave={() => setShowLeave(true)} />}
      {showLeave && <LeaveDialog view={view} onClose={() => setShowLeave(false)} />}
      {showScores && <ScoreSheet view={view} onClose={() => setShowScores(false)} />}
    </div>
  );
}

function SeatBadge({ view, seat, pos }: { view: ClientGameView; seat: number; pos: string }) {
  const s = view.seats[seat];
  const p = view.players[seat];
  const active = view.status === 'ACTIVE' && view.activeSeat === seat;
  const top = s.discards.at(-1);
  return (
    <div className={`seat-badge ${pos} ${active ? 'active' : ''} ${view.rules.match.teamMode ? `team-${teamOf(seat)}` : ''}`}>
      <div className="who">
        <span className="nm">
          {p.isBot || p.botControlled ? '🤖 ' : ''}
          {p.name}
        </span>
        {!p.connected && <span className="off" title="Bağlantı yok">⚠︎</span>}
      </div>
      <div className="meta small">
        <span aria-label={`${s.handCount} taş`}>🀫 {s.handCount}</span>
        {view.rules.match.teamMode && seat === partnerOf(view.yourSeat) && <span className="chip tiny partner">Eş</span>}
        {p.botLevel === 'easy' && <span className="chip tiny">Kolay</span>}
        {s.opened && <span className="chip tiny ok">{s.opened === 'pairs' ? 'Çift' : 'Açtı'}</span>}
        <span className="score">{s.total}</span>
      </div>
      {active && view.deadlineAt && <TurnTimer deadline={view.deadlineAt} total={view.rules.round.maxTurnSeconds} bar />}
      {top && (
        <div className="badge-discard">
          <TileView tile={top} okey={view.okey} size="mini" />
        </div>
      )}
    </div>
  );
}

function TeamScore({ view }: { view: ClientGameView }) {
  const t = teamTotals(view.seats.map((s) => s.total));
  const mine = teamOf(view.yourSeat);
  return (
    <span title="Takım puanları">
      Biz <strong>{t[mine]}</strong> – <strong>{t[1 - mine]}</strong> Onlar
    </span>
  );
}


