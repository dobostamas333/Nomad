import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type {
  Ack,
  ClientToServerEvents,
  ErrorCode,
  Guess,
  JoinResult,
  RoomSettings,
  ServerToClientEvents,
} from '../shared/protocol';
import { NICKNAME_MAX } from '../shared/protocol';
import { defaultGameData, type GameData } from './dataset';
import type { Room } from './room';
import { RoomManager, type RoomManagerOptions } from './rooms';

interface SocketData {
  roomCode?: string;
  playerId?: string;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface AppOptions extends RoomManagerOptions {
  data?: GameData;
  /** Directory of the built client; served when it exists. */
  staticDir?: string;
}

export interface App {
  http: HttpServer;
  io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
  rooms: RoomManager;
  close: () => Promise<void>;
}

export function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICKNAME_MAX);
  return name.length > 0 ? name : null;
}

function isGuess(value: unknown): value is Guess {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    (g.kind === 'numeric' && typeof g.value === 'number') ||
    (g.kind === 'reverse' && typeof g.code === 'string' && g.code.length <= 3)
  );
}

export function createApp(options: AppOptions = {}): App {
  const data = options.data ?? defaultGameData();
  const app = express();
  app.disable('x-powered-by');

  // Only what the answer picker needs, never the stats.
  const countryList = data.byFame
    .map((c) => ({ code: c.code, name: c.name }))
    .sort((a, b) => a.name.en.localeCompare(b.name.en));
  app.get('/api/countries', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').json(countryList);
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, datasetGeneratedAt: data.dataset.generatedAt });
  });

  const staticDir = options.staticDir;
  if (staticDir && existsSync(staticDir)) {
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders: (res, path) => {
          if (path.includes('/assets/')) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get(/^(?!\/(api|socket\.io)\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: staticDir });
    });
  }

  const http = createServer(app);
  const io: App['io'] = new Server(http, { serveClient: false, pingInterval: 10_000, pingTimeout: 8_000 });

  const broadcast = (room: Room) => io.to(room.code).emit('room:state', room.toView());
  const rooms = new RoomManager(data, broadcast, options);

  io.on('connection', (socket: GameSocket) => {
    const currentRoom = () => (socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined);
    const playerId = () => socket.data.playerId ?? '';

    const leaveCurrent = (permanently: boolean) => {
      const room = currentRoom();
      if (room && socket.data.playerId) {
        void socket.leave(room.code);
        if (permanently) room.removePlayer(socket.data.playerId);
        else room.disconnect(socket.data.playerId);
      }
      socket.data = {};
    };

    const seat = (room: Room, id: string, token: string, ack: (r: Ack<JoinResult>) => void) => {
      socket.data = { roomCode: room.code, playerId: id };
      void socket.join(room.code);
      ack({ ok: true, code: room.code, playerId: id, token });
      socket.emit('room:state', room.toView());
    };

    /** Wraps a handler so a malformed payload can never crash the server. */
    const guard =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        const ack = args[args.length - 1];
        try {
          fn(...args);
        } catch (err) {
          console.error('socket handler failed', err);
          if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' satisfies ErrorCode });
        }
      };

    const reply = (ack: unknown, result: { ok: true } | { ok: false; error: ErrorCode }) => {
      if (typeof ack === 'function') ack(result.ok ? { ok: true } : result);
    };

    socket.on(
      'room:create',
      guard((payload, ack) => {
        const nickname = sanitizeNickname(payload?.nickname);
        if (!nickname) return ack({ ok: false, error: 'invalid_nickname' });
        leaveCurrent(true);
        const room = rooms.create();
        if (!room) return ack({ ok: false, error: 'server_busy' });
        const added = room.addPlayer(nickname);
        if (!added.ok) {
          rooms.discardIfEmpty(room);
          return ack(added);
        }
        seat(room, added.value.id, added.value.token, ack);
      }),
    );

    socket.on(
      'room:join',
      guard((payload, ack) => {
        const nickname = sanitizeNickname(payload?.nickname);
        if (!nickname) return ack({ ok: false, error: 'invalid_nickname' });
        const room = typeof payload.code === 'string' ? rooms.get(payload.code) : undefined;
        if (!room) return ack({ ok: false, error: 'room_not_found' });
        if (room.code !== socket.data.roomCode) leaveCurrent(true);
        const added = room.addPlayer(nickname);
        if (!added.ok) return ack(added);
        seat(room, added.value.id, added.value.token, ack);
      }),
    );

    socket.on(
      'room:resume',
      guard((payload, ack) => {
        const room = typeof payload?.code === 'string' ? rooms.get(payload.code) : undefined;
        if (!room) return ack({ ok: false, error: 'room_not_found' });
        if (typeof payload.token !== 'string') return ack({ ok: false, error: 'invalid_payload' });
        const resumed = room.resume(payload.token);
        if (!resumed.ok) return ack(resumed);
        seat(room, resumed.value.id, resumed.value.token, ack);
      }),
    );

    socket.on('room:leave', guard(() => leaveCurrent(true)));

    socket.on(
      'room:settings',
      guard((patch: Partial<RoomSettings>, ack) => {
        const room = currentRoom();
        if (!room) return reply(ack, { ok: false, error: 'not_in_room' });
        if (typeof patch !== 'object' || patch === null) return reply(ack, { ok: false, error: 'invalid_payload' });
        reply(ack, room.updateSettings(playerId(), patch));
      }),
    );

    socket.on(
      'game:start',
      guard((ack) => {
        const room = currentRoom();
        reply(ack, room ? room.start(playerId()) : { ok: false, error: 'not_in_room' });
      }),
    );

    socket.on(
      'game:guess',
      guard((guess, ack) => {
        const room = currentRoom();
        if (!room) return reply(ack, { ok: false, error: 'not_in_room' });
        if (!isGuess(guess)) return reply(ack, { ok: false, error: 'invalid_payload' });
        reply(ack, room.guess(playerId(), guess));
      }),
    );

    socket.on(
      'game:next',
      guard((ack) => {
        const room = currentRoom();
        reply(ack, room ? room.next(playerId()) : { ok: false, error: 'not_in_room' });
      }),
    );

    socket.on(
      'game:lobby',
      guard((ack) => {
        const room = currentRoom();
        reply(ack, room ? room.backToLobby(playerId()) : { ok: false, error: 'not_in_room' });
      }),
    );

    socket.on('disconnect', () => leaveCurrent(false));
  });

  return {
    http,
    io,
    rooms,
    close: async () => {
      rooms.closeAll();
      await io.close();
    },
  };
}
