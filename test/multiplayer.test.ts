import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClientToServerEvents, Guess, JoinResult, RoomView, ServerToClientEvents } from '../shared/protocol';
import { createApp, sanitizeNickname, type App } from '../server/app';
import { seededRng } from '../server/questions';

type Client = Socket<ServerToClientEvents, ClientToServerEvents> & { state?: RoomView };

let app: App;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  app = createApp({ timing: { revealMs: 60_000, hostGraceMs: 50, seatGraceMs: 60_000 }, rng: seededRng(7) });
  await new Promise<void>((resolve) => app.http.listen(0, resolve));
  url = `http://localhost:${(app.http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await app.close();
});

async function client(): Promise<Client> {
  const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
  socket.on('room:state', (s) => (socket.state = s));
  clients.push(socket);
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  return socket;
}

function waitFor(socket: Client, predicate: (s: RoomView) => boolean): Promise<RoomView> {
  if (socket.state && predicate(socket.state)) return Promise.resolve(socket.state);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout, last phase: ${socket.state?.phase}`)), 2000);
    const listener = (s: RoomView) => {
      if (!predicate(s)) return;
      clearTimeout(timer);
      socket.off('room:state', listener);
      resolve(s);
    };
    socket.on('room:state', listener);
  });
}

const ack = <T>(emit: (cb: (r: T) => void) => void) => new Promise<T>((resolve) => emit(resolve));

function guessFor(state: RoomView, perfect: boolean): Guess {
  const q = state.question!;
  if (q.kind === 'numeric') return { kind: 'numeric', value: perfect ? 1 : q.slider.max };
  return { kind: 'reverse', code: 'HU' };
}

describe('private room multiplayer', () => {
  it('runs a full game for two players', async () => {
    const alice = await client();
    const bob = await client();

    const created = await ack<{ ok: boolean } & Partial<JoinResult>>((cb) =>
      alice.emit('room:create', { nickname: '  Alice\u0000 ' }, cb as never),
    );
    expect(created.ok).toBe(true);
    expect(created.code).toMatch(/^[A-Z]{4}$/);

    const joined = await ack<{ ok: boolean }>((cb) =>
      bob.emit('room:join', { code: created.code!.toLowerCase(), nickname: 'Alice' }, cb as never),
    );
    expect(joined.ok).toBe(true);

    const lobby = await waitFor(alice, (s) => s.players.length === 2);
    expect(lobby.players.map((p) => p.nickname)).toEqual(['Alice', 'Alice 2']);
    expect(lobby.players[0]!.isHost).toBe(true);

    // Only the host may change settings or start.
    expect(await ack((cb) => bob.emit('game:start', cb as never))).toEqual({ ok: false, error: 'not_host' });
    expect(await ack((cb) => alice.emit('room:settings', { rounds: 7 }, cb as never))).toMatchObject({ ok: false });
    expect(await ack((cb) => alice.emit('room:settings', { rounds: 5, mode: 'mixed' }, cb as never))).toEqual({ ok: true });
    expect(await ack((cb) => alice.emit('game:start', cb as never))).toEqual({ ok: true });

    for (let round = 1; round <= 5; round++) {
      const q = await waitFor(alice, (s) => s.phase === 'question' && s.round === round);
      expect(q.reveal).toBeNull();
      await waitFor(bob, (s) => s.phase === 'question' && s.round === round);

      expect(await ack((cb) => alice.emit('game:guess', guessFor(q, true), cb as never))).toEqual({ ok: true });
      // One guess per round.
      expect(await ack((cb) => alice.emit('game:guess', guessFor(q, true), cb as never))).toMatchObject({ ok: false });
      expect(await ack((cb) => bob.emit('game:guess', guessFor(q, false), cb as never))).toEqual({ ok: true });

      const reveal = await waitFor(alice, (s) => s.phase === 'reveal' && s.round === round);
      expect(reveal.reveal!.results).toHaveLength(2);
      expect(reveal.reveal!.source.sourceName.length).toBeGreaterThan(0);
      expect(await ack((cb) => alice.emit('game:next', cb as never))).toEqual({ ok: true });
    }

    const finished = await waitFor(bob, (s) => s.phase === 'finished');
    const total = finished.players.reduce((sum, p) => sum + p.score, 0);
    expect(total).toBeGreaterThan(0);

    expect(await ack((cb) => alice.emit('game:lobby', cb as never))).toEqual({ ok: true });
    const back = await waitFor(bob, (s) => s.phase === 'lobby');
    expect(back.players.every((p) => p.score === 0)).toBe(true);
  });

  it('lets a player resume their seat and hands over the host role', async () => {
    const alice = await client();
    const bob = await client();
    const created = await ack<JoinResult>((cb) => alice.emit('room:create', { nickname: 'Alice' }, cb as never));
    await ack((cb) => bob.emit('room:join', { code: created.code, nickname: 'Bob' }, cb as never));
    await waitFor(bob, (s) => s.players.length === 2);

    alice.disconnect();
    const handedOver = await waitFor(bob, (s) => s.players.find((p) => p.nickname === 'Bob')!.isHost);
    expect(handedOver.players.find((p) => p.nickname === 'Alice')!.connected).toBe(false);

    const again = await client();
    const resumed = await ack<{ ok: boolean } & Partial<JoinResult>>((cb) =>
      again.emit('room:resume', { code: created.code, token: created.token }, cb as never),
    );
    expect(resumed).toMatchObject({ ok: true, playerId: created.playerId });
    const state = await waitFor(bob, (s) => s.players.every((p) => p.connected));
    expect(state.players).toHaveLength(2);

    const bad = await ack((cb) => again.emit('room:resume', { code: created.code, token: 'nope' }, cb as never));
    expect(bad).toMatchObject({ ok: false, error: 'not_in_room' });
  });

  it('rejects unknown rooms and bad payloads', async () => {
    const c = await client();
    expect(await ack((cb) => c.emit('room:join', { code: 'ZZZZ', nickname: 'X' }, cb as never))).toMatchObject({
      ok: false,
      error: 'room_not_found',
    });
    expect(await ack((cb) => c.emit('room:create', { nickname: '   ' }, cb as never))).toMatchObject({
      ok: false,
      error: 'invalid_nickname',
    });
    expect(await ack((cb) => c.emit('game:guess', { kind: 'numeric', value: 5 }, cb as never))).toMatchObject({
      ok: false,
      error: 'not_in_room',
    });
  });
});

describe('sanitizeNickname', () => {
  it('trims, strips control characters and limits length', () => {
    expect(sanitizeNickname('  Tamás \n ')).toBe('Tamás');
    expect(sanitizeNickname('a'.repeat(40))).toHaveLength(16);
    expect(sanitizeNickname(42)).toBeNull();
  });
});
