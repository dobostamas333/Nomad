/**
 * Socket.IO protocol between the game client and the authoritative server.
 * The server never sends an answer before the round's reveal phase.
 */
import type { Continent, Localized, SourceId } from './dataset';
import type { StatId } from './stats';

export type GameMode = 'numeric' | 'reverse' | 'mixed';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface RoomSettings {
  mode: GameMode;
  rounds: number;
  secondsPerRound: number;
  difficulty: Difficulty;
}

export const SETTING_CHOICES = {
  mode: ['numeric', 'reverse', 'mixed'] as GameMode[],
  rounds: [5, 10, 15],
  secondsPerRound: [15, 20, 30, 45],
  difficulty: ['easy', 'medium', 'hard'] as Difficulty[],
};

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: 'mixed',
  rounds: 10,
  secondsPerRound: 20,
  difficulty: 'easy',
};

export const MAX_PLAYERS = 12;
export const NICKNAME_MAX = 16;
export const ROOM_CODE_LENGTH = 4;
export const REVEAL_SECONDS = 10;

export interface CountryRef {
  code: string;
  name: Localized;
}

export interface Clue {
  stat: StatId;
  value: number;
  year?: number;
}

export type PublicQuestion =
  | {
      kind: 'numeric';
      country: CountryRef;
      stat: StatId;
      slider: { min: number; max: number };
    }
  | {
      kind: 'reverse';
      continent: Continent;
      clues: Clue[];
    };

export interface SourceRef {
  source: SourceId;
  sourceName: string;
  sourceUrl: string;
  year?: number;
  wiki: Partial<Localized>;
}

export type Guess = { kind: 'numeric'; value: number } | { kind: 'reverse'; code: string };

export interface PlayerResult {
  playerId: string;
  guess: Guess | null;
  points: number;
  /** Reverse mode: distance between the guessed and the correct country. */
  distanceKm?: number;
}

export type Reveal =
  | { kind: 'numeric'; answer: number; source: SourceRef; results: PlayerResult[] }
  | { kind: 'reverse'; answer: CountryRef; source: SourceRef; results: PlayerResult[] };

export interface PlayerView {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  answered: boolean;
}

export type Phase = 'lobby' | 'question' | 'reveal' | 'finished';

export interface RoomView {
  code: string;
  phase: Phase;
  settings: RoomSettings;
  players: PlayerView[];
  round: number;
  totalRounds: number;
  question: PublicQuestion | null;
  /** Server timestamp (ms) when the current phase ends, if timed. */
  deadline: number | null;
  reveal: Reveal | null;
  serverTime: number;
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

export type ErrorCode =
  | 'invalid_nickname'
  | 'room_not_found'
  | 'room_full'
  | 'game_in_progress'
  | 'not_host'
  | 'invalid_payload'
  | 'not_in_room'
  | 'server_busy';

export interface JoinResult {
  code: string;
  playerId: string;
  /** Secret used to resume the seat after a reconnect. */
  token: string;
}

export interface ClientToServerEvents {
  'room:create': (p: { nickname: string }, ack: (r: Ack<JoinResult>) => void) => void;
  'room:join': (p: { code: string; nickname: string }, ack: (r: Ack<JoinResult>) => void) => void;
  'room:resume': (p: { code: string; token: string }, ack: (r: Ack<JoinResult>) => void) => void;
  'room:leave': () => void;
  'room:settings': (p: Partial<RoomSettings>, ack: (r: Ack) => void) => void;
  'game:start': (ack: (r: Ack) => void) => void;
  'game:guess': (p: Guess, ack: (r: Ack) => void) => void;
  'game:next': (ack: (r: Ack) => void) => void;
  'game:lobby': (ack: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomView) => void;
}
