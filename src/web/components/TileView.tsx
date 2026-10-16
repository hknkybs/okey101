import { isRealOkey, tileLabel } from '../../engine/tiles.ts';
import type { Color, Face, Tile } from '../../engine/types.ts';

// Renkleri yalnızca renkle değil şekille de ayırt etmek için (erişilebilirlik).
export const COLOR_SYMBOL: Record<Color, string> = { R: '♥', Y: '◆', B: '●', K: '♣' };

interface Props {
  tile: Tile;
  okey?: Face;
  as?: Face; // per içindeki temsil (okey için)
  size?: 'rack' | 'meld' | 'mini' | 'center';
  /** Istakada ters çevrilmiş (yalnız sahibine özel görünüm; atılamaz). */
  faceDown?: boolean;
  selected?: boolean;
  highlight?: boolean;
  dim?: boolean;
  badge?: string;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function TileView({ tile, okey, as, size = 'rack', faceDown, selected, highlight, dim, badge, onClick, draggable, onDragStart }: Props) {
  const fake = tile.kind === 'F';
  const real = !!okey && isRealOkey(tile, okey);
  const shownAs = real && as ? as : null; // okey per içinde neyi temsil ediyor
  const color = fake ? (okey?.color ?? 'K') : tile.color!;
  const cls = [
    'tile',
    `sz-${size}`,
    `c-${color}`,
    fake ? 'fake' : '',
    real ? 'okey' : '',
    selected ? 'selected' : '',
    highlight ? 'highlight' : '',
    dim ? 'dim' : '',
    onClick ? 'clickable' : '',
    faceDown ? 'back facedown' : '',
  ].join(' ');
  const content = fake ? (
    <>
      <span className="num">★</span>
      {okey && <span className="sub">{okey.number}</span>}
    </>
  ) : (
    <>
      <span className="num">{tile.number}</span>
      <span className="sym">{COLOR_SYMBOL[tile.color!]}</span>
    </>
  );
  const label = faceDown
    ? `${tileLabel(tile, okey)}, ters çevrili (atılamaz; çift dokunarak çevirin)`
    : tileLabel(tile, okey) + (shownAs ? `, ${shownAs.number} yerine` : '');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={cls}
      onClick={onClick}
      aria-label={label}
      aria-pressed={onClick ? !!selected : undefined}
      title={label}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {faceDown ? (
        <span className="lock" aria-hidden>
          🔒
        </span>
      ) : (
        <>
          {content}
          {real && <span className="okey-mark" aria-hidden>{shownAs ? shownAs.number : 'OK'}</span>}
        </>
      )}
      {badge && <span className="badge">{badge}</span>}
    </Tag>
  );
}

export function TileBack({ count, size = 'meld' }: { count?: number; size?: 'meld' | 'rack' | 'center' }) {
  return (
    <div className={`tile back sz-${size}`} aria-hidden>
      {count !== undefined && <span className="num">{count}</span>}
    </div>
  );
}
