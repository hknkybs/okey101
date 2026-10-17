import { useEffect, useState } from 'react';
import { BatakTable } from './components/batak/BatakTable.tsx';
import { GameTable } from './components/GameTable.tsx';
import { LobbyScreen } from './components/LobbyScreen.tsx';
import { Login } from './components/Login.tsx';
import { RoomScreen } from './components/RoomScreen.tsx';
import { connect, storedName, useApp } from './net.ts';

export function App() {
  const app = useApp();
  const [hasName, setHasName] = useState(() => !!storedName());

  useEffect(() => {
    if (hasName) connect();
  }, [hasName]);

  let screen;
  if (!hasName) {
    screen = (
      <Login
        onSubmit={(name) => {
          connect(name);
          setHasName(true);
        }}
      />
    );
  } else if (!app.me) {
    screen = <div className="center-msg">Bağlanılıyor…</div>;
  } else if (app.game) {
    screen = app.game.game === 'batak' ? <BatakTable view={app.game} /> : <GameTable view={app.game} />;
  } else if (app.lobby) {
    screen = <RoomScreen lobby={app.lobby} />;
  } else {
    screen = <LobbyScreen key={app.section} game={app.section} />;
  }

  return (
    <>
      {screen}
      {hasName && app.conn === 'closed' && <div className="conn-banner">Bağlantı koptu, yeniden bağlanılıyor…</div>}
      <div className="toasts" role="status" aria-live="polite">
        {app.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
