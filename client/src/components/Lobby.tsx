import { useState } from 'react';
import { SETTING_CHOICES, type RoomSettings, type RoomView } from '../../../shared/protocol';
import { game, useGame } from '../game';
import { PlayerList, useT } from './common';

function Choice<K extends keyof RoomSettings>({
  label,
  name,
  room,
  editable,
  render,
}: {
  label: string;
  name: K;
  room: RoomView;
  editable: boolean;
  render: (value: RoomSettings[K]) => string;
}) {
  const current = room.settings[name];
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="segmented">
        {(SETTING_CHOICES[name] as RoomSettings[K][]).map((value) => (
          <button
            key={String(value)}
            className={value === current ? 'active' : ''}
            disabled={!editable}
            aria-pressed={value === current}
            onClick={() => void game.updateSettings({ [name]: value })}
          >
            {render(value)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Lobby({ room }: { room: RoomView }) {
  const t = useT();
  const { playerId } = useGame();
  const isHost = room.players.some((p) => p.id === playerId && p.isHost);
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${location.origin}/?room=${room.code}`;

  const invite = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Nomad', text: `${t.room}: ${room.code}`, url: inviteUrl });
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <main className="screen lobby">
      <section className="room-code-card">
        <span className="muted">{t.roomCode}</span>
        <strong className="room-code mono">{room.code}</strong>
        <button className="secondary" onClick={invite}>
          {copied ? t.copied : `🔗 ${t.invite}`}
        </button>
      </section>

      <section>
        <h2>
          {t.players} <span className="muted">({room.players.length})</span>
        </h2>
        <PlayerList players={room.players} />
      </section>

      <section className="settings">
        <Choice label={t.mode} name="mode" room={room} editable={isHost} render={(v) => t.modes[v]} />
        <p className="hint">{t.modeHints[room.settings.mode]}</p>
        <Choice label={t.rounds} name="rounds" room={room} editable={isHost} render={(v) => String(v)} />
        <Choice label={t.time} name="secondsPerRound" room={room} editable={isHost} render={(v) => `${v} ${t.seconds}`} />
        <Choice label={t.difficulty} name="difficulty" room={room} editable={isHost} render={(v) => t.difficulties[v]} />
      </section>

      <div className="sticky-actions">
        {isHost ? (
          <button className="primary big" onClick={() => void game.start()}>
            {t.start}
          </button>
        ) : (
          <p className="waiting">{t.waitingForHost}</p>
        )}
      </div>
    </main>
  );
}
