import { useEffect, useState } from 'react';
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
    screen = <GameTable view={app.game} />;
  } else if (app.lobby) {
    screen = <RoomScreen lobby={app.lobby} />;
  } else {
    screen = <LobbyScreen />;
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
