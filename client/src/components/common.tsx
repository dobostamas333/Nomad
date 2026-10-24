import { useEffect, useState } from 'react';
import type { PlayerView, RoomView } from '../../../shared/protocol';
import { game, useGame } from '../game';
import { STRINGS } from '../i18n';

export function useT() {
  return STRINGS[useGame().lang];
}

/** Current time on the server's clock, refreshed a few times per second. */
export function useServerNow(active = true): number {
  const { clockOffset } = useGame();
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now() + clockOffset), 200);
    setNow(Date.now() + clockOffset);
    return () => clearInterval(id);
  }, [active, clockOffset]);
  return now;
}

export function LangToggle() {
  const { lang } = useGame();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {(['hu', 'en'] as const).map((l) => (
        <button key={l} className={l === lang ? 'active' : ''} onClick={() => game.setLang(l)} aria-pressed={l === lang}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ room }: { room: RoomView }) {
  const t = useT();
  const { playerId } = useGame();
  const me = room.players.find((p) => p.id === playerId);
  const inGame = room.phase === 'question' || room.phase === 'reveal';
  return (
    <header className="top-bar">
      <button
        className="icon-button"
        aria-label={t.leave}
        onClick={() => {
          if (!inGame || confirm(t.leaveConfirm)) game.leave();
        }}
      >
        ✕
      </button>
      <div className="top-bar-center">
        {inGame ? (
          <span>
            {t.round} <strong>{room.round}</strong>/{room.totalRounds}
          </span>
        ) : (
          <span>
            {t.room} <strong className="mono">{room.code}</strong>
          </span>
        )}
      </div>
      <div className="top-bar-score">{me ? `${me.score.toLocaleString()} ${t.points}` : ''}</div>
    </header>
  );
}

export function TimerBar({ deadline, total }: { deadline: number | null; total: number }) {
  const now = useServerNow(deadline !== null);
  if (deadline === null) return null;
  const left = Math.max(0, deadline - now);
  const ratio = Math.min(1, left / total);
  return (
    <div className="timer" aria-label={`${Math.ceil(left / 1000)}`}>
      <div className={`timer-fill ${ratio < 0.25 ? 'urgent' : ''}`} style={{ transform: `scaleX(${ratio})` }} />
      <span className="timer-text">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

export function PlayerList({ players, showAnswered = false }: { players: PlayerView[]; showAnswered?: boolean }) {
  const t = useT();
  const { playerId } = useGame();
  return (
    <ul className="player-list">
      {players.map((p, i) => (
        <li key={p.id} className={`${p.id === playerId ? 'me' : ''} ${p.connected ? '' : 'offline'}`}>
          <span className="rank">{i + 1}</span>
          <span className="avatar" style={{ background: avatarColor(p.id) }}>
            {p.nickname.slice(0, 1).toUpperCase()}
          </span>
          <span className="name">
            {p.nickname}
            {p.id === playerId && <em> ({t.you})</em>}
            {p.isHost && <span className="badge">{t.host}</span>}
          </span>
          {showAnswered && <span className={`answered ${p.answered ? 'yes' : ''}`}>{p.answered ? '✓' : '…'}</span>}
          <span className="score">{p.score.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

export function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 45%)`;
}
