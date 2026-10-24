import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Lang, Localized } from '../../shared/dataset';
import type {
  Ack,
  ClientToServerEvents,
  ErrorCode,
  Guess,
  JoinResult,
  RoomSettings,
  RoomView,
  ServerToClientEvents,
} from '../../shared/protocol';

export interface CountryOption {
  code: string;
  name: Localized;
}

export interface GameState {
  connected: boolean;
  room: RoomView | null;
  playerId: string | null;
  /** serverTime - clientTime, to show accurate countdowns. */
  clockOffset: number;
  countries: CountryOption[];
  lang: Lang;
}

const SESSION_KEY = 'nomad.session';
const LANG_KEY = 'nomad.lang';
const NICKNAME_KEY = 'nomad.nickname';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode: the game still works, it just won't remember.
  }
}

function initialLang(): Lang {
  const saved = read(LANG_KEY);
  if (saved === 'hu' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('hu') ? 'hu' : 'en';
}

type Session = Pick<JoinResult, 'code' | 'token'>;

export type ClientError = ErrorCode | 'network';
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ClientError };
const NETWORK_ERROR = { ok: false, error: 'network' } as const;

class GameClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private listeners = new Set<() => void>();
  state: GameState = {
    connected: false,
    room: null,
    playerId: null,
    clockOffset: 0,
    countries: [],
    lang: initialLang(),
  };

  constructor() {
    this.socket = io({ transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => {
      this.set({ connected: true });
      void this.resume();
    });
    this.socket.on('disconnect', () => this.set({ connected: false }));
    this.socket.on('room:state', (room) => {
      this.set({ room, clockOffset: room.serverTime - Date.now() });
    });
    void this.loadCountries();
  }

  private async loadCountries(): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch('/api/countries');
        if (res.ok) return this.set({ countries: (await res.json()) as CountryOption[] });
      } catch {
        // retried below
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  get savedNickname(): string {
    return read(NICKNAME_KEY) ?? '';
  }

  setLang(lang: Lang): void {
    write(LANG_KEY, lang);
    document.documentElement.lang = lang;
    this.set({ lang });
  }

  private request<T = object>(emit: (cb: (r: Ack<T>) => void) => void): Promise<Result<T>> {
    if (!this.socket.connected) return Promise.resolve(NETWORK_ERROR);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(NETWORK_ERROR), 8000);
      emit((r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
  }

  private seated(r: Result<JoinResult>): Result<JoinResult> {
    if (r.ok) {
      write(SESSION_KEY, JSON.stringify({ code: r.code, token: r.token } satisfies Session));
      this.set({ playerId: r.playerId });
    }
    return r;
  }

  private async resume(): Promise<void> {
    let session: Session | null = null;
    try {
      session = JSON.parse(read(SESSION_KEY) ?? 'null') as Session | null;
    } catch {
      session = null;
    }
    if (!session) return;
    const r = await this.request<JoinResult>((cb) => this.socket.emit('room:resume', session, cb));
    if (r.ok) this.seated(r);
    else if (r.error !== 'network') {
      write(SESSION_KEY, null);
      this.set({ room: null, playerId: null });
    }
  }

  async create(nickname: string) {
    write(NICKNAME_KEY, nickname);
    return this.seated(await this.request<JoinResult>((cb) => this.socket.emit('room:create', { nickname }, cb)));
  }

  async join(code: string, nickname: string) {
    write(NICKNAME_KEY, nickname);
    return this.seated(await this.request<JoinResult>((cb) => this.socket.emit('room:join', { code, nickname }, cb)));
  }

  leave(): void {
    this.socket.emit('room:leave');
    write(SESSION_KEY, null);
    this.set({ room: null, playerId: null });
  }

  updateSettings(patch: Partial<RoomSettings>) {
    return this.request((cb) => this.socket.emit('room:settings', patch, cb));
  }
  start() {
    return this.request((cb) => this.socket.emit('game:start', cb));
  }
  guess(guess: Guess) {
    return this.request((cb) => this.socket.emit('game:guess', guess, cb));
  }
  next() {
    return this.request((cb) => this.socket.emit('game:next', cb));
  }
  backToLobby() {
    return this.request((cb) => this.socket.emit('game:lobby', cb));
  }
}

export const game = new GameClient();

export function useGame(): GameState {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}
