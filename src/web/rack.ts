// Istaka (rack) düzeni istemci tarafında tutulur; oyun komutu değildir.
import { findBestMelds } from '../engine/bot.ts';
import { isRealOkey, naturalFace } from '../engine/tiles.ts';
import type { Face, Tile } from '../engine/types.ts';

export const RACK_COLS = 13;
export const RACK_SLOTS = RACK_COLS * 2;

const COLOR_ORDER = { R: 0, Y: 1, B: 2, K: 3 } as const;

const byColorNum = (okey: Face) => (a: Tile, b: Tile) => {
  const fa = naturalFace(a, okey);
  const fb = naturalFace(b, okey);
  return COLOR_ORDER[fa.color] - COLOR_ORDER[fb.color] || fa.number - fb.number || (a.id < b.id ? -1 : 1);
};

interface Group {
  tiles: Tile[];
  meld: boolean; // per ise bölünmez ve kenarlarına öncelikle boşluk konur
  gi?: number; // bölme sırasında kaynak grubun sırası
}

/**
 * Grupları iki sıralı ıstakaya yerleştirir:
 *  - grup sırası korunur ve hiçbir grup iki sıraya bölünmez; sıralar mümkün olduğunca dengelenir,
 *  - her sıradaki boş yuvalar gruplar arasına boşluk olarak dağıtılır (önce perlerin kenarları,
 *    sonra renkler arası); boşluk yetmezse gruplar yan yana kalır,
 *  - hiçbir bölünme sığmazsa taşlar sırayla doldurulur.
 */
function layout(groups: Group[]): (string | null)[] {
  // Sıraları iki satıra bölecek noktayı seç: per içinden geçemez, kalan taş grupları bölünebilir.
  const tiles = groups.flatMap((g, gi) => g.tiles.map((t, ti) => ({ t, gi, first: ti === 0 })));
  const n = tiles.length;
  let bestCut = -1;
  let bestScore = Infinity;
  for (let c = 0; c <= n; c++) {
    if (c > RACK_COLS || n - c > RACK_COLS) continue;
    const inside = c > 0 && c < n && tiles[c].gi === tiles[c - 1].gi;
    if (inside && groups[tiles[c].gi].meld) continue;
    const score = Math.abs(c - (n - c)) + (inside ? 2.5 : 0); // grup sınırını tercih et; çok dengesizse renk grubunu böl
    if (score < bestScore) {
      bestScore = score;
      bestCut = c;
    }
  }
  if (bestCut < 0) return flat(groups);
  const toGroups = (part: typeof tiles): Group[] => {
    const out: Group[] = [];
    for (const x of part) {
      const last = out[out.length - 1];
      if (last && last.gi === x.gi) last.tiles.push(x.t);
      else out.push({ tiles: [x.t], meld: groups[x.gi].meld, gi: x.gi });
    }
    return out;
  };
  return [...row(toGroups(tiles.slice(0, bestCut))), ...row(toGroups(tiles.slice(bestCut)))];
}

function row(groups: Group[]): (string | null)[] {
  const tiles = groups.reduce((s, g) => s + g.tiles.length, 0);
  let free = RACK_COLS - tiles;
  // Sınır i: groups[i] ile groups[i+1] arası. Per kenarları önce boşluk alır.
  const bounds = groups.slice(0, -1).map((g, i) => ({ i, prio: g.meld || groups[i + 1].meld ? 0 : 1 }));
  const gapAfter = new Set<number>();
  for (const b of [...bounds].sort((x, y) => x.prio - y.prio || x.i - y.i)) {
    if (free <= 0) break;
    gapAfter.add(b.i);
    free--;
  }
  const out: (string | null)[] = [];
  groups.forEach((g, i) => {
    out.push(...g.tiles.map((t) => t.id));
    if (gapAfter.has(i)) out.push(null);
  });
  while (out.length < RACK_COLS) out.push(null);
  return out;
}

function flat(groups: Group[]): (string | null)[] {
  const ids: (string | null)[] = groups.flatMap((g) => g.tiles.map((t) => t.id));
  while (ids.length < RACK_SLOTS) ids.push(null);
  return ids;
}

/** Taşları renklere ayırır (her renk kendi içinde sıralı); elde kalan gerçek okeyler ayrı grup olur. */
function byColorGroups(tiles: Tile[], okey: Face): Group[] {
  const okeys = tiles.filter((t) => isRealOkey(t, okey));
  const groups: Group[] = [];
  for (const t of [...tiles].filter((t) => !isRealOkey(t, okey)).sort(byColorNum(okey))) {
    const last = groups[groups.length - 1];
    if (last && naturalFace(last.tiles[0], okey).color === naturalFace(t, okey).color) last.tiles.push(t);
    else groups.push({ tiles: [t], meld: false });
  }
  return okeys.length ? [...groups, { tiles: okeys, meld: false }] : groups;
}

export type ArrangeMode = 'smart' | 'color' | 'pairs';

export function arrange(hand: Tile[], okey: Face, mode: ArrangeMode): (string | null)[] {
  const sorted = [...hand].sort(byColorNum(okey));
  if (mode === 'color') return layout(byColorGroups(hand, okey));
  if (mode === 'pairs') {
    const byFace = new Map<string, Tile[]>();
    for (const t of sorted) {
      const f = t.kind === 'F' ? okey : { color: t.color!, number: t.number! };
      const k = `${f.color}${f.number}`;
      byFace.set(k, [...(byFace.get(k) ?? []), t]);
    }
    const pairs = [...byFace.values()].filter((g) => g.length >= 2);
    const singles = [...byFace.values()].filter((g) => g.length < 2).flat();
    return layout([...pairs.map((tiles) => ({ tiles, meld: true })), ...byColorGroups(singles, okey)]);
  }
  // Akıllı: önce kurulabilecek perler (büyükten küçüğe), sonra kalanlar renk renk.
  const sol = findBestMelds(hand, okey);
  const byId = new Map(hand.map((t) => [t.id, t]));
  const melds = sol.melds.map((m) => m.tileIds.map((id) => byId.get(id)!)).sort((a, b) => b.length - a.length);
  const rest = hand.filter((t) => !sol.used.has(t.id));
  return layout([...melds.map((tiles) => ({ tiles, meld: true })), ...byColorGroups(rest, okey)]);
}

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
