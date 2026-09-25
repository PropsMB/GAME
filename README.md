# Arena Shooter — własny hosting

Samodzielny multiplayer top-down shooter. Serwer Node.js (WebSocket) + statyczny klient HTML — bez konta Claude, bez logowania.

## Uruchomienie lokalnie (test)

```
npm install
npm start
```

Otwórz `http://localhost:3000` w przeglądarce. Otwórz drugą kartę/urządzenie w tej samej sieci pod adresem `http://TWOJE_IP:3000`, żeby przetestować multiplayer.

## Wdrożenie online (darmowe opcje)

### Render.com (najprostsze)
1. Załóż darmowe konto na render.com.
2. New → Web Service → wgraj ten folder jako repo (GitHub) albo użyj "Deploy from a Git repository".
3. Build command: `npm install`
4. Start command: `npm start`
5. Render nada Ci publiczny adres typu `https://twoja-gra.onrender.com`.
6. Wyślij ten link znajomym — bez logowania do czegokolwiek.

### Railway.app / Fly.io
Analogicznie — wgraj folder, ustaw `npm start` jako komendę startową, port pobierany jest automatycznie z `process.env.PORT`.

### Własny VPS
```
git clone <twoje repo> arena-shooter
cd arena-shooter
npm install
npm start
```
Dla stałego działania użyj `pm2 start server.js` albo `systemd`. Postaw nginx jako reverse proxy z certyfikatem SSL (Let's Encrypt), żeby działało po `wss://`.

## Jak to działa

- `server.js` — serwer WebSocket: przekazuje pozycje graczy, strzały, trafienia, zabójstwa i synchronizuje power-upy między wszystkimi podłączonymi.
- `public/index.html` — cała gra (canvas), łączy się przez WebSocket z tym samym hostem, na którym jest wystawiona (nie trzeba nic konfigurować — adres serwera jest wykrywany automatycznie z adresu strony).

## Zamiana w .exe

Po wdrożeniu gry pod publicznym adresem (np. `https://twoja-gra.onrender.com`) możesz zrobić dokładnie to samo co poprzednio:

```
npx nativefier "https://twoja-gra.onrender.com" --name "Arena Shooter" --single-instance
```

Tym razem bez ekranu logowania do Claude — bo strona jest w pełni Twoja.
