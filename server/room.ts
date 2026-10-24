import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ErrorCode,
  Guess,
  Phase,
  PlayerResult,
  Reveal,
  RoomSettings,
  RoomView,
  SourceRef,
} from '../shared/protocol';
import { DEFAULT_SETTINGS, MAX_PLAYERS, REVEAL_SECONDS, SETTING_CHOICES } from '../shared/protocol';
import { distanceKm, scoreCountryGuess, scoreNumericGuess } from '../shared/scoring';
import type { GameData } from './dataset';
import { generateQuestions, type Question, type Rng } from './questions';

export interface RoomTiming {
  revealMs: number;
  /** A disconnected host hands over the room after this long. */
  hostGraceMs: number;
  /** A disconnected player loses their seat after this long. */
  seatGraceMs: number;
}

export const DEFAULT_TIMING: RoomTiming = {
  revealMs: REVEAL_SECONDS * 1000,
  hostGraceMs: 15_000,
  seatGraceMs: 5 * 60_000,
};

interface Player {
  id: string;
  token: string;
  nickname: string;
  score: number;
  connected: boolean;
  joinedAt: number;
  dropTimer?: NodeJS.Timeout;
}

type Result<T = void> = { ok: true; value: T } | { ok: false; error: ErrorCode };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: ErrorCode): Result<never> => ({ ok: false, error });

/**
 * One game room. The room is the single source of truth: clients only send
 * intents (join, guess, start...) and receive the resulting public view.
 */
export class Room {
  readonly code: string;
  settings: RoomSettings = { ...DEFAULT_SETTINGS };
  phase: Phase = 'lobby';
  private players = new Map<string, Player>();
  private hostId: string | null = null;
  private questions: Question[] = [];
  private round = 0;
  private guesses = new Map<string, Guess>();
  private deadline: number | null = null;
  private reveal: Reveal | null = null;
  private phaseTimer?: NodeJS.Timeout;
  private hostTimer?: NodeJS.Timeout;

  constructor(
    code: string,
    private readonly data: GameData,
    private readonly onChange: (room: Room) => void,
    private readonly onEmpty: (room: Room) => void,
    private readonly timing: RoomTiming = DEFAULT_TIMING,
    private readonly rng: Rng = Math.random,
  ) {
    this.code = code;
  }

  get playerCount(): number {
    return this.players.size;
  }

  // ---- membership -------------------------------------------------------

  addPlayer(nickname: string): Result<Player> {
    if (this.players.size >= MAX_PLAYERS) return fail('room_full');
    const player: Player = {
      id: randomUUID(),
      token: randomBytes(18).toString('base64url'),
      nickname: this.uniqueNickname(nickname),
      score: 0,
      connected: true,
      joinedAt: Date.now(),
    };
    this.players.set(player.id, player);
    this.hostId ??= player.id;
    this.changed();
    return ok(player);
  }

  resume(token: string): Result<Player> {
    const player = [...this.players.values()].find((p) => p.token === token);
    if (!player) return fail('not_in_room');
    clearTimeout(player.dropTimer);
    player.connected = true;
    if (player.id === this.hostId) this.setHost(player.id);
    // The handover already happened while everyone was away: take over the room.
    else if (!this.hostTimer && !this.players.get(this.hostId ?? '')?.connected) this.setHost(player.id);
    this.changed();
    return ok(player);
  }

  disconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.dropTimer = setTimeout(() => this.removePlayer(playerId), this.timing.seatGraceMs);
    if (playerId === this.hostId) {
      clearTimeout(this.hostTimer);
      this.hostTimer = setTimeout(() => {
        this.hostTimer = undefined;
        this.handOverHost();
      }, this.timing.hostGraceMs);
    }
    this.maybeEndRound();
    this.changed();
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    clearTimeout(player.dropTimer);
    this.players.delete(playerId);
    this.guesses.delete(playerId);
    if (this.players.size === 0) {
      this.destroy();
      this.onEmpty(this);
      return;
    }
    if (playerId === this.hostId) this.handOverHost(true);
    this.maybeEndRound();
    this.changed();
  }

  destroy(): void {
    clearTimeout(this.phaseTimer);
    clearTimeout(this.hostTimer);
    for (const p of this.players.values()) clearTimeout(p.dropTimer);
  }

  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  // ---- host actions -----------------------------------------------------

  updateSettings(playerId: string, patch: Partial<RoomSettings>): Result {
    if (!this.isHost(playerId)) return fail('not_host');
    if (this.phase !== 'lobby' && this.phase !== 'finished') return fail('game_in_progress');
    const next = { ...this.settings };
    for (const key of Object.keys(SETTING_CHOICES) as (keyof RoomSettings)[]) {
      if (patch[key] === undefined) continue;
      if (!(SETTING_CHOICES[key] as unknown[]).includes(patch[key])) return fail('invalid_payload');
      (next as Record<string, unknown>)[key] = patch[key];
    }
    this.settings = next;
    this.changed();
    return ok(undefined);
  }

  start(playerId: string): Result {
    if (!this.isHost(playerId)) return fail('not_host');
    if (this.phase === 'question' || this.phase === 'reveal') return fail('game_in_progress');
    for (const p of this.players.values()) p.score = 0;
    this.questions = generateQuestions(this.data, this.settings, this.rng);
    this.round = 0;
    this.startRound();
    return ok(undefined);
  }

  /** Host skips the rest of the reveal countdown. */
  next(playerId: string): Result {
    if (!this.isHost(playerId)) return fail('not_host');
    if (this.phase !== 'reveal') return fail('invalid_payload');
    this.advance();
    return ok(undefined);
  }

  backToLobby(playerId: string): Result {
    if (!this.isHost(playerId)) return fail('not_host');
    clearTimeout(this.phaseTimer);
    this.phase = 'lobby';
    this.round = 0;
    this.reveal = null;
    this.deadline = null;
    for (const p of this.players.values()) p.score = 0;
    this.changed();
    return ok(undefined);
  }

  // ---- gameplay ---------------------------------------------------------

  guess(playerId: string, guess: Guess): Result {
    if (!this.players.has(playerId)) return fail('not_in_room');
    const q = this.questions[this.round - 1];
    if (this.phase !== 'question' || !q) return fail('invalid_payload');
    if (this.guesses.has(playerId)) return fail('invalid_payload');
    if (guess.kind !== q.public.kind) return fail('invalid_payload');
    if (guess.kind === 'numeric' && !(Number.isFinite(guess.value) && guess.value > 0)) {
      return fail('invalid_payload');
    }
    if (guess.kind === 'reverse' && !this.data.byCode.has(guess.code)) return fail('invalid_payload');
    this.guesses.set(playerId, guess);
    this.changed();
    this.maybeEndRound();
    return ok(undefined);
  }

  private startRound(): void {
    clearTimeout(this.phaseTimer);
    this.round += 1;
    this.guesses.clear();
    this.reveal = null;
    this.phase = 'question';
    const ms = this.settings.secondsPerRound * 1000;
    this.deadline = Date.now() + ms;
    this.phaseTimer = setTimeout(() => this.endRound(), ms);
    this.changed();
  }

  private maybeEndRound(): void {
    if (this.phase !== 'question') return;
    const active = [...this.players.values()].filter((p) => p.connected);
    if (active.length > 0 && active.every((p) => this.guesses.has(p.id))) this.endRound();
  }

  private endRound(): void {
    if (this.phase !== 'question') return;
    clearTimeout(this.phaseTimer);
    const q = this.questions[this.round - 1]!;
    const results: PlayerResult[] = [...this.players.values()].map((p) => {
      const g = this.guesses.get(p.id) ?? null;
      const result = this.score(q, g);
      p.score += result.points;
      return { playerId: p.id, guess: g, ...result };
    });
    results.sort((a, b) => b.points - a.points);

    if (q.public.kind === 'numeric') {
      const stat = q.country.stats[q.stat!]!;
      this.reveal = { kind: 'numeric', answer: stat.value, source: this.sourceRef(q, stat.source, stat.year), results };
    } else {
      this.reveal = {
        kind: 'reverse',
        answer: { code: q.country.code, name: q.country.name },
        source: this.sourceRef(q, q.country.stats.population!.source, q.country.stats.population!.year),
        results,
      };
    }
    this.phase = 'reveal';
    this.deadline = Date.now() + this.timing.revealMs;
    this.phaseTimer = setTimeout(() => this.advance(), this.timing.revealMs);
    this.changed();
  }

  private advance(): void {
    clearTimeout(this.phaseTimer);
    if (this.round >= this.questions.length) {
      this.phase = 'finished';
      this.deadline = null;
      this.changed();
    } else {
      this.startRound();
    }
  }

  private score(q: Question, g: Guess | null): { points: number; distanceKm?: number } {
    if (!g) return { points: 0 };
    if (g.kind === 'numeric') {
      return { points: scoreNumericGuess(q.stat!, g.value, q.country.stats[q.stat!]!.value) };
    }
    const guessed = this.data.byCode.get(g.code);
    if (!guessed) return { points: 0 };
    const correct = guessed.code === q.country.code;
    const km = correct ? 0 : Math.round(distanceKm(guessed.latlng, q.country.latlng));
    return { points: scoreCountryGuess(correct, km), distanceKm: km };
  }

  private sourceRef(q: Question, source: SourceRef['source'], year?: number): SourceRef {
    const info = this.data.dataset.sources[source];
    return { source, sourceName: info.name, sourceUrl: info.url, year, wiki: q.country.wiki };
  }

  // ---- helpers ----------------------------------------------------------

  private handOverHost(force = false): void {
    const current = this.hostId ? this.players.get(this.hostId) : undefined;
    if (!force && current?.connected) return;
    const candidates = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const next = candidates.find((p) => p.connected) ?? candidates[0];
    if (next) this.setHost(next.id);
    this.changed();
  }

  private setHost(playerId: string): void {
    clearTimeout(this.hostTimer);
    this.hostTimer = undefined;
    this.hostId = playerId;
  }

  private uniqueNickname(nickname: string): string {
    const taken = new Set([...this.players.values()].map((p) => p.nickname.toLowerCase()));
    if (!taken.has(nickname.toLowerCase())) return nickname;
    for (let i = 2; ; i++) {
      const candidate = `${nickname.slice(0, 13)} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  private changed(): void {
    this.onChange(this);
  }

  toView(): RoomView {
    const q = this.phase === 'question' || this.phase === 'reveal' ? this.questions[this.round - 1] : undefined;
    return {
      code: this.code,
      phase: this.phase,
      settings: this.settings,
      players: [...this.players.values()]
        .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          score: p.score,
          connected: p.connected,
          isHost: p.id === this.hostId,
          answered: this.guesses.has(p.id),
        })),
      round: this.round,
      totalRounds: this.phase === 'lobby' ? this.settings.rounds : this.questions.length,
      question: q?.public ?? null,
      deadline: this.deadline,
      reveal: this.phase === 'reveal' ? this.reveal : null,
      serverTime: Date.now(),
    };
  }
}
