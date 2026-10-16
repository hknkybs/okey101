/** Oyun motorlarına dışarıdan enjekte edilen rastgelelik (sunucuda kriptografik). */
export interface Rng {
  randInt(n: number): number;
  id(): string;
}
