// Per doğrulayıcıları (spesifikasyon §4). Saf fonksiyonlar.
import { COLORS, type Face, type JokerAssignment, type Meld, type MeldKind, type PlacedTile, type Tile } from './types.ts';
import { isRealOkey, naturalFace } from './tiles.ts';

export interface ResolvedMeld {
  kind: MeldKind;
  tiles: PlacedTile[];
  value: number;
}

const isWild = (t: Tile, okey: Face) => isRealOkey(t, okey);

function hasDuplicateIds(tiles: Tile[]) {
  return new Set(tiles.map((t) => t.id)).size !== tiles.length;
}

function assignmentFor(t: Tile, assignments?: JokerAssignment[]): Face | undefined {
  const a = assignments?.find((x) => x.tileId === t.id);
  return a ? { color: a.color, number: a.number } : undefined;
}

export const meldValue = (tiles: PlacedTile[]) => tiles.reduce((s, p) => s + p.as.number, 0);

/**
 * Seri: aynı renk, ardışık en az 3 sayı (12-13-1 geçersiz).
 * Taşlar verilen sırada yorumlanır; tutmazsa doğal taşlar sıralanıp okeyler boşluklara yerleştirilir.
 */
export function resolveRun(tiles: Tile[], okey: Face, assignments?: JokerAssignment[]): PlacedTile[] | null {
  if (tiles.length < 3 || tiles.length > 13 || hasDuplicateIds(tiles)) return null;

  // 1) Açık joker ataması verilmişse onu doğrula.
  const assigned = tiles.map((t) => (isWild(t, okey) ? assignmentFor(t, assignments) : naturalFace(t, okey)));
  if (assignments && assignments.length > 0 && assigned.every(Boolean)) {
    const faces = assigned as Face[];
    const placed = tiles.map((tile, i) => ({ tile, as: faces[i] }));
    const sorted = [...placed].sort((a, b) => a.as.number - b.as.number);
    if (!isConsecutiveRun(sorted.map((p) => p.as))) return null;
    return sorted;
  }

  const naturals = tiles.filter((t) => !isWild(t, okey));
  if (naturals.length === 0) return null;
  const color = naturalFace(naturals[0], okey).color;
  if (naturals.some((t) => naturalFace(t, okey).color !== color)) return null;

  // 2) Verilen sırayla yorumla.
  const firstIdx = tiles.findIndex((t) => !isWild(t, okey));
  const start = naturalFace(tiles[firstIdx], okey).number - firstIdx;
  const end = start + tiles.length - 1;
  if (start >= 1 && end <= 13) {
    const ok = tiles.every((t, i) => isWild(t, okey) || naturalFace(t, okey).number === start + i);
    if (ok) return tiles.map((tile, i) => ({ tile, as: { color, number: start + i } }));
  }

  // 3) Sıralayıp boşlukları okeylerle doldur.
  const nat = [...naturals].sort((a, b) => naturalFace(a, okey).number - naturalFace(b, okey).number);
  const nums = nat.map((t) => naturalFace(t, okey).number);
  for (let i = 1; i < nums.length; i++) if (nums[i] === nums[i - 1]) return null;
  const wilds = tiles.filter((t) => isWild(t, okey));
  const lo = nums[0];
  const hi = nums[nums.length - 1];
  const gaps = hi - lo + 1 - nums.length;
  if (gaps > wilds.length) return null;
  let extra = wilds.length - gaps;
  let s = lo;
  let e = hi;
  while (extra > 0 && e < 13) { e++; extra--; }
  while (extra > 0 && s > 1) { s--; extra--; }
  if (extra > 0) return null;
  const out: PlacedTile[] = [];
  let w = 0;
  let n = 0;
  for (let v = s; v <= e; v++) {
    if (n < nat.length && nums[n] === v) out.push({ tile: nat[n++], as: { color, number: v } });
    else out.push({ tile: wilds[w++], as: { color, number: v } });
  }
  return out;
}

function isConsecutiveRun(faces: Face[]): boolean {
  if (faces.length < 3) return false;
  const c = faces[0].color;
  for (let i = 0; i < faces.length; i++) {
    if (faces[i].color !== c) return false;
    if (faces[i].number < 1 || faces[i].number > 13) return false;
    if (i > 0 && faces[i].number !== faces[i - 1].number + 1) return false;
  }
  return true;
}

/** Grup: aynı sayı, farklı renklerden 3 veya 4 taş. */
export function resolveGroup(tiles: Tile[], okey: Face, assignments?: JokerAssignment[]): PlacedTile[] | null {
  if (tiles.length < 3 || tiles.length > 4 || hasDuplicateIds(tiles)) return null;
  const naturals = tiles.filter((t) => !isWild(t, okey));
  if (naturals.length === 0) return null;
  const number = naturalFace(naturals[0], okey).number;
  const used = new Set<string>();
  const out: PlacedTile[] = [];
  for (const t of naturals) {
    const f = naturalFace(t, okey);
    if (f.number !== number || used.has(f.color)) return null;
    used.add(f.color);
  }
  for (const t of tiles) {
    if (!isWild(t, okey)) {
      out.push({ tile: t, as: naturalFace(t, okey) });
      continue;
    }
    const a = assignmentFor(t, assignments);
    let color = a?.color;
    if (a && (a.number !== number || used.has(a.color))) return null;
    if (!color) color = COLORS.find((c) => !used.has(c));
    if (!color) return null;
    used.add(color);
    out.push({ tile: t, as: { color, number } });
  }
  return out;
}

/** Önce seri, sonra grup denenir. */
export function resolveMeld(tiles: Tile[], okey: Face, assignments?: JokerAssignment[]): ResolvedMeld | null {
  const run = resolveRun(tiles, okey, assignments);
  if (run) return { kind: 'run', tiles: run, value: meldValue(run) };
  const group = resolveGroup(tiles, okey, assignments);
  if (group) return { kind: 'group', tiles: group, value: meldValue(group) };
  return null;
}

/** Çift: aynı renk ve sayıdan iki taş. Okey joker olarak kullanılamaz (kendi yüzüyle sayılır). */
export function resolvePair(tiles: Tile[], okey: Face): PlacedTile[] | null {
  if (tiles.length !== 2 || hasDuplicateIds(tiles)) return null;
  const faceOf = (t: Tile): Face => (t.kind === 'F' ? okey : { color: t.color!, number: t.number! });
  const a = faceOf(tiles[0]);
  const b = faceOf(tiles[1]);
  if (a.color !== b.color || a.number !== b.number) return null;
  return tiles.map((tile) => ({ tile, as: faceOf(tile) }));
}

/**
 * Okeyi masadan alma: açık perdeki gerçek okeyin yerine onun temsil ettiği doğal taşı koyar.
 * Seride taş, okeyin temsil ettiği renk/sayı olmalı. Grupta okey eksik herhangi bir rengi
 * temsil edebildiğinden aynı sayıda, perde bulunmayan bir renk yeterlidir.
 * Başarılıysa yeni taş dizisini ve ele geçecek okeyi döndürür.
 */
export function resolveJokerSwap(meld: Meld, tile: Tile, okey: Face): { tiles: PlacedTile[]; joker: Tile } | null {
  if (meld.kind === 'pair' || isWild(tile, okey)) return null;
  if (meld.tiles.some((p) => p.tile.id === tile.id)) return null;
  const f = naturalFace(tile, okey);
  for (let i = 0; i < meld.tiles.length; i++) {
    const p = meld.tiles[i];
    if (!isWild(p.tile, okey)) continue;
    const fits =
      meld.kind === 'run'
        ? p.as.color === f.color && p.as.number === f.number
        : p.as.number === f.number && !meld.tiles.some((q, j) => j !== i && q.as.color === f.color);
    if (!fits) continue;
    const tiles = meld.tiles.slice();
    tiles[i] = { tile, as: f };
    return { tiles, joker: p.tile };
  }
  return null;
}

/** Açık bir pere taş işleme. Başarılıysa yeni taş dizisini döndürür. */
export function resolveLayoff(meld: Meld, tile: Tile, okey: Face, side?: 'start' | 'end'): PlacedTile[] | null {
  if (meld.kind === 'pair') return null;
  if (meld.tiles.some((p) => p.tile.id === tile.id)) return null;
  const wild = isWild(tile, okey);

  if (meld.kind === 'group') {
    if (meld.tiles.length >= 4) return null;
    const number = meld.tiles[0].as.number;
    const used = new Set(meld.tiles.map((p) => p.as.color));
    if (wild) {
      const color = COLORS.find((c) => !used.has(c))!;
      return [...meld.tiles, { tile, as: { color, number } }];
    }
    const f = naturalFace(tile, okey);
    if (f.number !== number || used.has(f.color)) return null;
    return [...meld.tiles, { tile, as: f }];
  }

  // run
  const color = meld.tiles[0].as.color;
  const s = meld.tiles[0].as.number;
  const e = meld.tiles[meld.tiles.length - 1].as.number;
  const atStart = (): PlacedTile[] => [{ tile, as: { color, number: s - 1 } }, ...meld.tiles];
  const atEnd = (): PlacedTile[] => [...meld.tiles, { tile, as: { color, number: e + 1 } }];
  if (wild) {
    if (side === 'start' && s > 1) return atStart();
    if (e < 13) return atEnd();
    if (s > 1) return atStart();
    return null;
  }
  const f = naturalFace(tile, okey);
  if (f.color !== color) return null;
  if (f.number === e + 1 && e < 13) return atEnd();
  if (f.number === s - 1 && s > 1) return atStart();
  return null;
}
