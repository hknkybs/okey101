// Istaka (rack) düzeni istemci tarafında tutulur; oyun komutu değildir.
import { findBestMelds } from '../engine/bot.ts';
import { naturalFace } from '../engine/tiles.ts';
import type { Face, Tile } from '../engine/types.ts';

export const RACK_COLS = 13;
export const RACK_SLOTS = RACK_COLS * 2;

const COLOR_ORDER = { R: 0, Y: 1, B: 2, K: 3 } as const;

const byColorNum = (okey: Face) => (a: Tile, b: Tile) => {
  const fa = naturalFace(a, okey);
  const fb = naturalFace(b, okey);
  return COLOR_ORDER[fa.color] - COLOR_ORDER[fb.color] || fa.number - fb.number || (a.id < b.id ? -1 : 1);
};

/** Grupları boşlukla ayırarak yerleştirir; sığmazsa boşlukları atar. */
function layout(groups: Tile[][]): (string | null)[] {
  const total = groups.reduce((s, g) => s + g.length, 0);
  const withGaps = total + Math.max(0, groups.length - 1) <= RACK_SLOTS;
  const slots: (string | null)[] = [];
  groups.forEach((g, i) => {
    // Bir grubu iki satır arasında bölmemeye çalış.
    const col = slots.length % RACK_COLS;
    if (withGaps && slots.length < RACK_COLS && col + g.length > RACK_COLS && g.length <= RACK_COLS) {
      const pad = RACK_COLS - col;
      const stillNeeded = total - countTiles(slots) + (groups.length - 1 - i);
      if (slots.length + pad + stillNeeded <= RACK_SLOTS) for (let k = 0; k < pad; k++) slots.push(null);
    }
    for (const t of g) slots.push(t.id);
    if (withGaps && i < groups.length - 1) slots.push(null);
  });
  const trimmed = slots.slice(0, RACK_SLOTS);
  // Taşmayı önle: sığmayanları sona ekle
  const placed = new Set(trimmed.filter(Boolean));
  const missing = groups.flat().filter((t) => !placed.has(t.id));
  for (const t of missing) {
    const i = trimmed.indexOf(null);
    if (i >= 0) trimmed[i] = t.id;
    else trimmed.push(t.id);
  }
  while (trimmed.length < RACK_SLOTS) trimmed.push(null);
  return trimmed;
}

const countTiles = (s: (string | null)[]) => s.filter(Boolean).length;

export type ArrangeMode = 'smart' | 'color' | 'pairs';

export function arrange(hand: Tile[], okey: Face, mode: ArrangeMode): (string | null)[] {
  const sorted = [...hand].sort(byColorNum(okey));
  if (mode === 'color') {
    const groups: Tile[][] = [];
    for (const t of sorted) {
      const c = naturalFace(t, okey).color;
      const last = groups[groups.length - 1];
      if (last && naturalFace(last[0], okey).color === c) last.push(t);
      else groups.push([t]);
    }
    return layout(groups);
  }
  if (mode === 'pairs') {
    const byFace = new Map<string, Tile[]>();
    for (const t of sorted) {
      const f = t.kind === 'F' ? okey : { color: t.color!, number: t.number! };
      const k = `${f.color}${f.number}`;
      byFace.set(k, [...(byFace.get(k) ?? []), t]);
    }
    const pairs = [...byFace.values()].filter((g) => g.length >= 2);
    const singles = [...byFace.values()].filter((g) => g.length < 2).flat();
    return layout([...pairs, singles].filter((g) => g.length));
  }
  const sol = findBestMelds(hand, okey);
  const byId = new Map(hand.map((t) => [t.id, t]));
  const melds = sol.melds.map((m) => m.tileIds.map((id) => byId.get(id)!));
  const rest = sorted.filter((t) => !sol.used.has(t.id));
  return layout([...melds, ...(rest.length ? [rest] : [])]);
}

/** Sunucudan gelen yeni ele göre mevcut düzeni korur; yeni taşları son boş yuvaya koyar. */
export function syncRack(prev: (string | null)[], hand: Tile[], okey: Face): (string | null)[] {
  if (!prev.length) return arrange(hand, okey, 'smart');
  const ids = new Set(hand.map((t) => t.id));
  const slots = prev.map((id) => (id && ids.has(id) ? id : null));
  while (slots.length < RACK_SLOTS) slots.push(null);
  const placed = new Set(slots.filter(Boolean));
  for (const t of hand) {
    if (placed.has(t.id)) continue;
    const i = slots.lastIndexOf(null);
    if (i >= 0) slots[i] = t.id;
    else slots.push(t.id);
  }
  return slots;
}

/** Seçili taşları hedef yuvadan itibaren boş yuvalara taşır. */
export function moveTiles(rack: (string | null)[], ids: string[], target: number): (string | null)[] {
  const slots = rack.map((id) => (id && ids.includes(id) ? null : id));
  let cursor = target;
  for (const id of ids) {
    let i = slots.indexOf(null, cursor);
    if (i < 0) i = slots.indexOf(null);
    if (i < 0) return rack;
    slots[i] = id;
    cursor = i + 1;
  }
  return slots;
}

export function swapOrMove(rack: (string | null)[], id: string, target: number): (string | null)[] {
  const from = rack.indexOf(id);
  if (from < 0 || from === target) return rack;
  const slots = rack.slice();
  slots[from] = slots[target];
  slots[target] = id;
  return slots;
}
