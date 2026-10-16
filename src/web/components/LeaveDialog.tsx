import { send } from '../net.ts';
import type { ClientGameView } from '../../shared/protocol.ts';

/** Masadan kalkma onayı (window.confirm yerine; uygulama içi tarayıcılarda/ana ekran modunda da çalışır). */
export function LeaveDialog({ view, onClose }: { view: ClientGameView; onClose: () => void }) {
  const othersAreBots = view.players.every((p, s) => s === view.yourSeat || p.isBot || p.botControlled);
  const ended = view.status === 'ENDED';
  let text: string;
  if (ended) text = 'Maç bitti. Lobiye dönebilirsiniz.';
  else if (othersAreBots) text = 'Masada başka oyuncu yok; kalkarsanız bu maç kapanır.';
  else text = 'Kalkarsanız yerinize bot oynar ve bu maça geri dönemezsiniz. Diğer oyuncular devam eder.';

  return (
    <div className="modal-back top" role="dialog" aria-modal="true" aria-labelledby="leave-title" onClick={onClose}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="leave-title">Masadan kalkılsın mı?</h2>
        <p className="muted">{text}</p>
        <div className="row">
          <button className="btn danger grow" onClick={() => send({ t: 'game.leave' })}>
            Masadan kalk
          </button>
          <button className="btn grow" onClick={onClose} autoFocus>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
