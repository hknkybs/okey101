// Görsel tema (Klasik / 8-bit). Yalnız görünümü değiştirir; cihazda hatırlanır.
import { useSyncExternalStore } from 'react';

export type Theme = 'classic' | 'pixel';
const KEY = 'okey101.theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'pixel' ? 'pixel' : 'classic';
  } catch {
    return 'classic';
  }
}

let current: Theme = read();

/** <html data-theme="..."> ile stilleri değiştirir; ilk çizimden önce çağrılır. */
export function applyTheme(t: Theme = current) {
  current = t;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'pixel' ? '#1a1c2c' : '#0f4d3a');
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* gizli sekme */
  }
  applyTheme(t);
  listeners.forEach((l) => l());
}

export const useTheme = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
