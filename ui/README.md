# The app

Expo and React Native: one codebase for iPhone, Android and the web.

```bash
npm install
npx expo start          # a QR code for Expo Go, and a browser build on w
```

`.env.local` holds the one setting that matters, the address of the api the app
talks to. It is not committed; copy the line below into a new file of that name:

```
EXPO_PUBLIC_URL_BASE=https://news360-api-hh4th4joma-ew.a.run.app
```

## Publishing the web build

```bash
./deploy-firebase.sh    # https://haezrach-hakatan.web.app - the address people get
./deploy-web.sh <api-host>   # the older Vercel copy, if it is still wanted
```

The head of every page, and so what a shared link shows in WhatsApp, is
[app/+html.tsx](app/+html.tsx). The picture it points at is `public/og.png`, drawn
from [assets/og-card-source.html](assets/og-card-source.html).
