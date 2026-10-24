import type { PlayerResult, PlayerView, PublicQuestion, Reveal, RoomView } from '../../../shared/protocol';
import type { Lang } from '../../../shared/dataset';
import { accuracyLabel } from '../../../shared/scoring';
import { flagEmoji, formatNumber, SLIDER_STEPS, valueToSlider } from '../format';
import { game, useGame } from '../game';
import { avatarColor, PlayerList, useServerNow, useT } from './common';

export function RevealScreen({ room }: { room: RoomView }) {
  const t = useT();
  const { lang, playerId, countries } = useGame();
  const reveal = room.reveal!;
  const q = room.question!;
  const now = useServerNow();
  const secondsLeft = room.deadline ? Math.max(0, Math.ceil((room.deadline - now) / 1000)) : 0;
  const isHost = room.players.some((p) => p.id === playerId && p.isHost);
  const mine = reveal.results.find((r) => r.playerId === playerId);
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const countryName = (code: string) => countries.find((c) => c.code === code)?.name[lang] ?? code;
  const wiki = reveal.source.wiki[lang] ?? reveal.source.wiki.en;

  return (
    <main className="screen reveal">
      {mine && (
        <div className={`verdict ${accuracyLabel(mine.points)}`}>
          <span>{t.accuracy[accuracyLabel(mine.points)]}</span>
          <strong>+{mine.points}</strong>
        </div>
      )}

      <section className="answer-card">
        <span className="muted">{t.correctAnswer}</span>
        {reveal.kind === 'numeric' && q.kind === 'numeric' ? (
          <>
            <div className="answer-country">
              {flagEmoji(q.country.code)} {q.country.name[lang]} · {t.statName[q.stat]}
            </div>
            <div className="answer-value">
              {formatNumber(q.stat, reveal.answer, lang, true)} <small>{t.unit[q.stat]}</small>
            </div>
            <GuessScale q={q} reveal={reveal} players={byId} />
          </>
        ) : reveal.kind === 'reverse' ? (
          <div className="answer-value">
            {flagEmoji(reveal.answer.code)} {reveal.answer.name[lang]}
          </div>
        ) : null}
        <p className="source">
          {t.source}:{' '}
          <a href={reveal.source.sourceUrl} target="_blank" rel="noreferrer">
            {reveal.source.sourceName}
          </a>
          {reveal.source.year ? ` (${reveal.source.year})` : ''}
          {wiki && (
            <>
              {' · '}
              <a href={wiki} target="_blank" rel="noreferrer">
                {t.wikiArticle}
              </a>
            </>
          )}
        </p>
      </section>

      <ul className="results">
        {reveal.results.map((r) => {
          const p = byId.get(r.playerId);
          if (!p) return null;
          return (
            <li key={r.playerId} className={r.playerId === playerId ? 'me' : ''}>
              <span className="avatar" style={{ background: avatarColor(p.id) }}>
                {p.nickname.slice(0, 1).toUpperCase()}
              </span>
              <span className="result-text">
                <span className="name">{p.nickname}</span>
                <span className="guess">{describeGuess(r, q, lang, t, countryName)}</span>
              </span>
              <span className="points">+{r.points}</span>
            </li>
          );
        })}
      </ul>

      <section>
        <PlayerList players={room.players} />
      </section>

      <div className="sticky-actions">
        {isHost ? (
          <button className="primary big" onClick={() => void game.next()}>
            {t.next} ({secondsLeft})
          </button>
        ) : (
          <p className="waiting">{t.nextIn(secondsLeft)}</p>
        )}
      </div>
    </main>
  );
}

function describeGuess(
  r: PlayerResult,
  q: PublicQuestion,
  lang: Lang,
  t: ReturnType<typeof useT>,
  countryName: (code: string) => string,
): string {
  if (!r.guess) return t.noGuess;
  if (r.guess.kind === 'numeric' && q.kind === 'numeric') {
    return `${formatNumber(q.stat, r.guess.value, lang)} ${t.unit[q.stat]}`;
  }
  if (r.guess.kind === 'reverse') {
    const name = `${flagEmoji(r.guess.code)} ${countryName(r.guess.code)}`;
    return r.distanceKm ? `${name} · ${t.away(r.distanceKm)}` : name;
  }
  return '';
}

/** The slider axis with the real answer and everyone's guesses on it. */
function GuessScale({
  q,
  reveal,
  players,
}: {
  q: Extract<PublicQuestion, { kind: 'numeric' }>;
  reveal: Extract<Reveal, { kind: 'numeric' }>;
  players: Map<string, PlayerView>;
}) {
  const { playerId } = useGame();
  const at = (v: number) => `${(valueToSlider(q.stat, v, q.slider) / SLIDER_STEPS) * 100}%`;
  return (
    <div className="guess-scale" aria-hidden>
      <div className="scale-line" />
      {reveal.results.map((r) =>
        r.guess?.kind === 'numeric' ? (
          <span
            key={r.playerId}
            className={`scale-dot ${r.playerId === playerId ? 'me' : ''}`}
            style={{ left: at(r.guess.value), background: avatarColor(r.playerId) }}
          >
            {players.get(r.playerId)?.nickname.slice(0, 1).toUpperCase()}
          </span>
        ) : null,
      )}
      <span className="scale-answer" style={{ left: at(reveal.answer) }} />
    </div>
  );
}
