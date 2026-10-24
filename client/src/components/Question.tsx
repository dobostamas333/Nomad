import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicQuestion, RoomView } from '../../../shared/protocol';
import { flagEmoji, formatNumber, parseTypedNumber, searchKey, SLIDER_STEPS, sliderToValue, valueToSlider } from '../format';
import { game, useGame, type CountryOption } from '../game';
import { TimerBar, useT } from './common';

type NumericQuestion = Extract<PublicQuestion, { kind: 'numeric' }>;
type ReverseQuestion = Extract<PublicQuestion, { kind: 'reverse' }>;

export function QuestionScreen({ room }: { room: RoomView }) {
  const t = useT();
  const { playerId } = useGame();
  const q = room.question!;
  const me = room.players.find((p) => p.id === playerId);
  const connected = room.players.filter((p) => p.connected);
  const answered = connected.filter((p) => p.answered).length;

  return (
    <main className="screen question">
      <TimerBar deadline={room.deadline} total={room.settings.secondsPerRound * 1000} />
      {q.kind === 'numeric' ? (
        <NumericGuess key={room.round} q={q} locked={!!me?.answered} />
      ) : (
        <ReverseGuess key={room.round} q={q} locked={!!me?.answered} />
      )}
      {me?.answered && <p className="waiting">{t.waitingOthers(answered, connected.length)}</p>}
    </main>
  );
}

function useSubmit() {
  const [sending, setSending] = useState(false);
  return {
    sending,
    submit: async (send: () => Promise<unknown>) => {
      setSending(true);
      navigator.vibrate?.(15);
      await send();
      setSending(false);
    },
  };
}

function NumericGuess({ q, locked }: { q: NumericQuestion; locked: boolean }) {
  const t = useT();
  const { lang } = useGame();
  const [pos, setPos] = useState(SLIDER_STEPS / 2);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const { sending, submit } = useSubmit();
  const value = sliderToValue(q.stat, pos, q.slider);
  const hold = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const nudge = (delta: number) => setPos((p) => Math.min(SLIDER_STEPS, Math.max(0, p + delta)));
  const startHold = (delta: number) => {
    nudge(delta);
    clearInterval(hold.current);
    hold.current = setInterval(() => nudge(delta), 90);
  };
  const stopHold = () => clearInterval(hold.current);
  useEffect(() => stopHold, []);

  const applyTyped = () => {
    const n = parseTypedNumber(typed, lang);
    if (n !== null) setPos(valueToSlider(q.stat, n, q.slider));
    setTyping(false);
  };

  return (
    <>
      <section className="prompt">
        <div className="flag" aria-hidden>
          {flagEmoji(q.country.code)}
        </div>
        <h1 className="country-name">{q.country.name[lang]}</h1>
        <p className="stat-question">{t.statQuestion[q.stat]}</p>
      </section>

      <section className="guess-panel">
        {typing ? (
          <form
            className="typed"
            onSubmit={(e) => {
              e.preventDefault();
              applyTyped();
            }}
          >
            <input
              autoFocus
              inputMode="decimal"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onBlur={applyTyped}
              aria-label={t.typeExact}
            />
            <span className="unit">{t.unit[q.stat]}</span>
          </form>
        ) : (
          <button
            className="value-display"
            disabled={locked}
            onClick={() => {
              setTyped(String(value).replace('.', lang === 'hu' ? ',' : '.'));
              setTyping(true);
            }}
            aria-label={t.typeExact}
          >
            <span className="value">{formatNumber(q.stat, value, lang)}</span>
            <span className="unit">{t.unit[q.stat]}</span>
            {!locked && <span className="edit-hint">✎</span>}
          </button>
        )}

        <div className="slider-row">
          <button
            className="nudge"
            disabled={locked}
            aria-label="−"
            onPointerDown={() => startHold(-1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={SLIDER_STEPS}
            value={pos}
            disabled={locked}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label={t.statName[q.stat]}
          />
          <button
            className="nudge"
            disabled={locked}
            aria-label="+"
            onPointerDown={() => startHold(1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
          >
            +
          </button>
        </div>
        <div className="slider-scale muted">
          <span>{formatNumber(q.stat, q.slider.min, lang)}</span>
          <span>{formatNumber(q.stat, q.slider.max, lang)}</span>
        </div>
      </section>

      <div className="sticky-actions">
        <button
          className="primary big"
          disabled={locked || sending}
          onClick={() => submit(() => game.guess({ kind: 'numeric', value }))}
        >
          {locked ? `✓ ${t.submitted}` : t.submit}
        </button>
      </div>
    </>
  );
}

function ReverseGuess({ q, locked }: { q: ReverseQuestion; locked: boolean }) {
  const t = useT();
  const { lang, countries } = useGame();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<CountryOption | null>(null);
  const { sending, submit } = useSubmit();

  const indexed = useMemo(
    () => countries.map((c) => ({ c, primary: searchKey(c.name[lang]), other: searchKey(c.name[lang === 'hu' ? 'en' : 'hu']) })),
    [countries, lang],
  );
  const matches = useMemo(() => {
    const k = searchKey(query);
    if (!k) return [];
    const starts = indexed.filter((x) => x.primary.startsWith(k) || x.primary.includes(` ${k}`));
    const rest = indexed.filter((x) => !starts.includes(x) && (x.primary.includes(k) || x.other.includes(k)));
    return [...starts, ...rest].slice(0, 6).map((x) => x.c);
  }, [indexed, query]);

  return (
    <>
      <section className="prompt">
        <p className="stat-question">{t.whichCountry}</p>
        <span className="continent-chip">📍 {t.continents[q.continent]}</span>
      </section>

      <section className="clues">
        {q.clues.map((clue) => (
          <div className="clue" key={clue.stat}>
            <span className="clue-label">{t.statName[clue.stat]}</span>
            <span className="clue-value">
              {formatNumber(clue.stat, clue.value, lang)} <small>{t.unit[clue.stat]}</small>
            </span>
          </div>
        ))}
      </section>

      <section className="country-picker">
        {picked ? (
          <button className="picked" disabled={locked} onClick={() => setPicked(null)}>
            <span className="flag-sm">{flagEmoji(picked.code)}</span>
            {picked.name[lang]}
            {!locked && <span className="muted"> ✕</span>}
          </button>
        ) : (
          <>
            <input
              value={query}
              placeholder={t.searchCountry}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <ul className="suggestions">
                {matches.map((c) => (
                  <li key={c.code}>
                    <button
                      onClick={() => {
                        setPicked(c);
                        setQuery('');
                      }}
                    >
                      <span className="flag-sm">{flagEmoji(c.code)}</span>
                      {c.name[lang]}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && <li className="muted">{t.noMatch}</li>}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="sticky-actions">
        <button
          className="primary big"
          disabled={locked || sending || !picked}
          onClick={() => picked && submit(() => game.guess({ kind: 'reverse', code: picked.code }))}
        >
          {locked ? `✓ ${t.submitted}` : t.submit}
        </button>
      </div>
    </>
  );
}
