import { useState } from 'react';

export function Login({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="page narrow">
      <div className="brand">
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>101 Okey</h1>
        <p className="muted">Dört kişilik çevrimiçi 101 Okey. Telefondan ve bilgisayardan oynayın.</p>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <label htmlFor="name">Görünen adınız</label>
        <input
          id="name"
          autoFocus
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="örn. Hakan"
          autoComplete="nickname"
        />
        <button className="btn primary block" disabled={!name.trim()}>
          Misafir olarak devam et
        </button>
      </form>
    </div>
  );
}
