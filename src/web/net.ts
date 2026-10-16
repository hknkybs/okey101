// WebSocket bağlantısı + basit global store (useSyncExternalStore).
import { useSyncExternalStore } from 'react';
import type { BatakCommand } from '../batak/types.ts';
import type { Command } from '../engine/types.ts';
import type { ClientGameView, ClientMsg, GameId, LobbySummary, LobbyView, ServerMsg } from '../shared/protocol.ts';

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info';
}

export interface AppState {
  conn: 'idle' | 'connecting' | 'open' | 'closed';
  me: { userId: string; name: string } | null;
  lobbies: LobbySummary[];
  lobby: LobbyView | null;
  game: ClientGameView | null;
  clockOffset: number; // serverTime - localTime
  /** Hangi oyunun ana ekranındayız (cihazda hatırlanır). */
  section: GameId;
  toasts: Toast[];
}

const TOKEN_KEY = 'okey101.token';
const SECTION_KEY = 'okey101.section';
const NAME_KEY = 'okey101.name';

const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* gizli sekme */
  }
};

let state: AppState = {
  conn: 'idle',
  me: null,
  lobbies: [],
  lobby: null,
  game: null,
  clockOffset: 0,
  section: safeGet(SECTION_KEY) === 'batak' ? 'batak' : 'okey',
  toasts: [],
};
const listeners = new Set<() => void>();
const set = (patch: Partial<AppState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const useApp = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

export const getState = () => state;

let ws: WebSocket | null = null;
let retry = 0;
let toastSeq = 0;
let pendingJoinCode: string | null = new URLSearchParams(location.search).get('code');

export function setSection(section: GameId) {
  safeSet(SECTION_KEY, section);
  set({ section });
  window.scrollTo(0, 0);
}

export function storedName() {
  return safeGet(NAME_KEY);
}

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const t = { id: ++toastSeq, text, kind };
  set({ toasts: [...state.toasts, t].slice(-3) });
  setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), kind === 'error' ? 3500 : 2500);
}

export function connect(name?: string) {
  if (name) safeSet(NAME_KEY, name);
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  set({ conn: 'connecting' });
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}/ws`);
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    set({ conn: 'open' });
    send({ t: 'hello', token: safeGet(TOKEN_KEY) ?? undefined, name: safeGet(NAME_KEY) ?? undefined });
  };
  sock.onmessage = (ev) => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    onMessage(msg);
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    set({ conn: 'closed' });
    const delay = Math.min(8000, 500 * 2 ** retry++);
    setTimeout(() => connect(), delay);
  };
}

function onMessage(msg: ServerMsg) {
  switch (msg.t) {
    case 'welcome':
      if (msg.token) safeSet(TOKEN_KEY, msg.token);
      safeSet(NAME_KEY, msg.name);
      set({ me: { userId: msg.userId, name: msg.name } });
      if (pendingJoinCode) {
        send({ t: 'lobby.join', code: pendingJoinCode });
        pendingJoinCode = null;
        history.replaceState(null, '', location.pathname);
      }
      break;
    case 'lobbies':
      set({ lobbies: msg.list });
      break;
    case 'lobby':
      set({ lobby: msg.lobby });
      // Bir masaya girildiyse (ör. davet koduyla) kalkınca o oyunun ana ekranına dönülsün.
      if (msg.lobby && msg.lobby.game !== state.section) setSection(msg.lobby.game);
      break;
    case 'game':
      set({
        game: msg.view,
        clockOffset: msg.view ? msg.view.serverTime - Date.now() : state.clockOffset,
      });
      break;
    case 'rejected':
      toast(msg.message, 'error');
      break;
    case 'error':
      toast(msg.message, 'error');
      break;
    case 'pong':
      break;
  }
}

export function send(msg: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else toast('Bağlantı yok, yeniden bağlanılıyor…', 'error');
}

function uuid() {
  // HTTP (güvenli olmayan bağlam) altında crypto.randomUUID olmayabilir — örn. telefondan LAN IP ile.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* düş */
    }
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function sendCommand(command: Command | BatakCommand) {
  const g = state.game;
  if (!g) return;
  send({ t: 'game.command', commandId: uuid(), expectedVersion: g.stateVersion, command });
}

export const serverNow = () => Date.now() + state.clockOffset;
