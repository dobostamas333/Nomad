import { randomInt } from 'node:crypto';
import { ROOM_CODE_LENGTH } from '../shared/protocol';
import type { GameData } from './dataset';
import type { Rng } from './questions';
import { DEFAULT_TIMING, Room, type RoomTiming } from './room';

/** No I, L, O or digits: codes are read aloud and typed on phones. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_ROOMS = 5000;

export interface RoomManagerOptions {
  timing?: RoomTiming;
  rng?: Rng;
}

/**
 * Keeps track of live rooms. Matchmaking and ranked play will create rooms
 * through the same manager, so private rooms are only one way in.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(
    private readonly data: GameData,
    private readonly onChange: (room: Room) => void,
    private readonly options: RoomManagerOptions = {},
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  create(): Room | null {
    if (this.rooms.size >= MAX_ROOMS) return null;
    let code: string;
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(
      code,
      this.data,
      this.onChange,
      (r) => this.rooms.delete(r.code),
      this.options.timing ?? DEFAULT_TIMING,
      this.options.rng,
    );
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  /** Removes a room that never got a player (e.g. the creator's request failed). */
  discardIfEmpty(room: Room): void {
    if (room.playerCount === 0) {
      room.destroy();
      this.rooms.delete(room.code);
    }
  }

  closeAll(): void {
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
  }
}
