import { useEffect } from 'react';
import { TopBar, useT } from './components/common';
import { Finished } from './components/Finished';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { QuestionScreen } from './components/Question';
import { RevealScreen } from './components/Reveal';
import { useGame } from './game';

export function App() {
  const { room, connected, lang } = useGame();
  const t = useT();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  if (!room) return <Home />;

  return (
    <div className="app">
      <TopBar room={room} />
      {!connected && <div className="banner">{t.reconnecting}</div>}
      {room.phase === 'lobby' && <Lobby room={room} />}
      {room.phase === 'question' && room.question && <QuestionScreen room={room} />}
      {room.phase === 'reveal' && room.reveal && <RevealScreen room={room} />}
      {room.phase === 'finished' && <Finished room={room} />}
    </div>
  );
}
