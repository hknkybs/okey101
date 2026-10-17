import { cardLabel, isRed, rankLabel, SUIT_SYMBOL } from '../../../batak/cards.ts';
import type { Card } from '../../../batak/types.ts';

interface Props {
  card: Card;
  size?: 'hand' | 'trick' | 'mini' | 'dummy';
  selected?: boolean;
  disabled?: boolean;
  dim?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}

/** İskambil kartı: köşede değer + renk sembolü, ortada büyük sembol. Renkler sembolle de ayırt edilir. */
export function CardView({ card, size = 'hand', selected, disabled, dim, highlight, onClick }: Props) {
  const cls = [
    'pcard',
    `pc-${size}`,
    isRed(card.suit) ? 'red' : 'black',
    selected ? 'selected' : '',
    dim ? 'dim' : '',
    highlight ? 'highlight' : '',
    onClick && !disabled ? 'clickable' : '',
  ].join(' ');
  const inner = (
    <>
      <span className="corner">
        <span className="rk">{rankLabel(card.rank)}</span>
        <span className="st">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="pip" aria-hidden>
        {SUIT_SYMBOL[card.suit]}
      </span>
    </>
  );
  if (!onClick) {
    return (
      <div className={cls} aria-label={cardLabel(card)} title={cardLabel(card)}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={disabled}
      aria-label={cardLabel(card) + (disabled ? ', oynanamaz' : '')}
      aria-pressed={!!selected}
      title={cardLabel(card)}
    >
      {inner}
    </button>
  );
}

export function CardBack({ count }: { count: number }) {
  return (
    <div className="pcard pc-mini back" aria-label={`${count} kart`}>
      <span className="cnt">{count}</span>
    </div>
  );
}
