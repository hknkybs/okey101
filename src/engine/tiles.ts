import { COLORS, type Color, type Face, type Tile } from './types.ts';

export const COLOR_NAMES: Record<Color, string> = {
  R: 'Kırmızı',
  Y: 'Sarı',
  B: 'Mavi',
  K: 'Siyah',
};

/** 106 taşlık set: 4 renk × 1–13 × 2 kopya + 2 sahte okey. */
export function createTileSet(makeId: () => string): Tile[] {
  const tiles: Tile[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const color of COLORS) {
      for (let number = 1; number <= 13; number++) {
        tiles.push({ id: makeId(), kind: 'N', color, number });
      }
    }
  }
  tiles.push({ id: makeId(), kind: 'F' }, { id: makeId(), kind: 'F' });
  return tiles;
}

/** Fisher–Yates. `randInt(n)` 0..n-1 arasında tamsayı döndürür (dışarıdan enjekte edilir). */
export function shuffle<T>(arr: T[], randInt: (n: number) => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Gösterge c:n ise okey c:(n % 13 + 1). */
export function okeyFromIndicator(indicator: Tile): Face {
  if (indicator.kind !== 'N') throw new Error('Gösterge normal taş olmalı');
  return { color: indicator.color!, number: (indicator.number! % 13) + 1 };
}

/** Gerçek okey: okey renk/sayısındaki iki normal taş. Per içinde joker gibi davranır. */
export function isRealOkey(t: Tile, okey: Face): boolean {
  return t.kind === 'N' && t.color === okey.color && t.number === okey.number;
}

/** Taşın doğal yüz değeri. Sahte okey, gerçek okeyin temsil ettiği değerdedir. */
export function naturalFace(t: Tile, okey: Face): Face {
  if (t.kind === 'F') return { color: okey.color, number: okey.number };
  return { color: t.color!, number: t.number! };
}

export function faceKey(f: Face): string {
  return `${f.color}${f.number}`;
}

export function faceLabel(f: Face): string {
  return `${COLOR_NAMES[f.color]} ${f.number}`;
}

export function tileLabel(t: Tile, okey?: Face): string {
  if (t.kind === 'F') return okey ? `Sahte okey (${faceLabel(okey)})` : 'Sahte okey';
  const base = faceLabel({ color: t.color!, number: t.number! });
  return okey && isRealOkey(t, okey) ? `${base} (okey)` : base;
}

/** Elde kalan taşın ceza değeri (sahte okey etkin değeriyle). */
export function tilePenaltyValue(t: Tile, okey: Face): number {
  return naturalFace(t, okey).number;
}
