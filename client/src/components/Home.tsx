import { useState, type FormEvent } from 'react';
import { NICKNAME_MAX, ROOM_CODE_LENGTH } from '../../../shared/protocol';
import { game, useGame, type ClientError } from '../game';
import { LangToggle, useT } from './common';

function roomFromUrl(): string {
  return (new URLSearchParams(location.search).get('room') ?? '').toUpperCase().slice(0, ROOM_CODE_LENGTH);
}

export function Home() {
  const t = useT();
  const { connected } = useGame();
  const [nickname, setNickname] = useState(game.savedNickname);
  const [code, setCode] = useState(roomFromUrl);
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const invited = roomFromUrl().length === ROOM_CODE_LENGTH;

  const run = async (action: () => Promise<{ ok: boolean; error?: ClientError }>) => {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'invalid_payload');
    else history.replaceState(null, '', location.pathname);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    void run(() => game.join(code, nickname));
  };

  return (
    <main className="screen home">
      <div className="home-top">
        <LangToggle />
      </div>
      <div className="logo" aria-hidden>
        🌍
      </div>
      <h1 className="title">Nomad</h1>
      <p className="tagline">{t.tagline}</p>

      <label className="field">
        <span>{t.nickname}</span>
        <input
          value={nickname}
          maxLength={NICKNAME_MAX}
          placeholder={t.nicknamePlaceholder}
          autoComplete="nickname"
          enterKeyHint="go"
          onChange={(e) => setNickname(e.target.value)}
        />
      </label>

      {!invited && (
        <>
          <button className="primary big" disabled={busy || !connected} onClick={() => run(() => game.create(nickname))}>
            {t.createRoom}
          </button>
          <div className="divider">
            <span>{t.or}</span>
          </div>
        </>
      )}

      <form className="join-row" onSubmit={join}>
        <input
          className="code-input mono"
          aria-label={t.roomCode}
          placeholder={t.roomCode}
          value={code}
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
        <button
          className={invited ? 'primary' : 'secondary'}
          type="submit"
          disabled={busy || !connected || code.length !== ROOM_CODE_LENGTH}
        >
          {t.join}
        </button>
      </form>

      {error && <p className="error">{t.errors[error]}</p>}
      {!connected && <p className="muted">{t.reconnecting}</p>}

      <p className="how-to">{t.howTo}</p>
    </main>
  );
}
