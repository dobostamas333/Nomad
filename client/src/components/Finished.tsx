import type { RoomView } from '../../../shared/protocol';
import { game, useGame } from '../game';
import { avatarColor, PlayerList, useT } from './common';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Finished({ room }: { room: RoomView }) {
  const t = useT();
  const { playerId } = useGame();
  const isHost = room.players.some((p) => p.id === playerId && p.isHost);
  const podium = room.players.slice(0, 3);

  return (
    <main className="screen finished">
      <h1 className="title-sm">{t.finalStandings}</h1>
      <div className="podium">
        {podium.map((p, i) => (
          <div key={p.id} className={`podium-step place-${i + 1}`}>
            <span className="medal">{MEDALS[i]}</span>
            <span className="avatar big" style={{ background: avatarColor(p.id) }}>
              {p.nickname.slice(0, 1).toUpperCase()}
            </span>
            <span className="name">{p.nickname}</span>
            <strong>{p.score.toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <PlayerList players={room.players} />
      <div className="sticky-actions column">
        {isHost ? (
          <>
            <button className="primary big" onClick={() => void game.start()}>
              {t.playAgain}
            </button>
            <button className="secondary" onClick={() => void game.backToLobby()}>
              {t.backToLobby}
            </button>
          </>
        ) : (
          <p className="waiting">{t.waitingForHost}</p>
        )}
        <button className="ghost" onClick={() => game.leave()}>
          {t.leave}
        </button>
      </div>
    </main>
  );
}
