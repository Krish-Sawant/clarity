# Clarity authentication

This folder owns shared Auth0 configuration and integration documentation. The existing folders stay in place:

```text
authentication/config.ts → ui/clarity-editorial (Next.js login and session)
ui /api/account         → BackEnd/api /api/me (verified Auth0 access token)
```

`npm run dev` at the repository root starts the UI at **http://127.0.0.1:3001**.

## Configure Auth0

1. In the Auth0 dashboard, create a **Regular Web Application** named Clarity.
2. Set Allowed Callback URLs to `http://127.0.0.1:3001/auth/callback`.
3. Set Allowed Logout URLs and Allowed Web Origins to `http://127.0.0.1:3001`.
4. Create an Auth0 **API** with identifier `https://clarity-api` and signing algorithm **RS256**. Use that identifier as `AUTH0_AUDIENCE` in both applications.
5. Copy `ui/clarity-editorial/.env.example` to `.env.local` in that same directory. Fill in the domain, client ID and client secret from the Regular Web Application. Generate `AUTH0_SECRET` with `openssl rand -hex 32`. Keep these values private.
6. Copy `BackEnd/api/.env.example` to `.env` in that same directory. Fill in the same domain and API audience. Keep `DEMO_MODE_ENABLED=false`.

Use exactly the same hostname in the browser and Auth0 settings; `localhost` and `127.0.0.1` are different origins. For deployment, replace the base URL and allowlists with the HTTPS deployment origin and generate a separate session secret.

## Run both servers

From the repository root:

```sh
python3 -m venv BackEnd/api/.venv
BackEnd/api/.venv/bin/pip install -r BackEnd/api/requirements.txt
BackEnd/api/.venv/bin/uvicorn app.main:app --app-dir BackEnd/api --reload --port 8001
```

In a second terminal:

```sh
npm run setup
npm run dev
```

Open `http://127.0.0.1:3001`. Unauthenticated visitors reach `/login`; login and signup use Auth0 Universal Login. After login, open `/account` and check the backend connection. It calls the same-origin `/api/account` adapter, which sends an Auth0 access token to the Python `/api/me` route. The API verifies signature, issuer, audience, expiry and subject before returning the identity and creating its user record. Log out using the UI link.

No Auth0 account configuration is automated. Until real credentials are supplied, private pages remain unavailable and the login page explains the missing setup. No mock login bypass is enabled.

## Security and scope

- The official Auth0 SDK handles OAuth state, PKCE, callback processing and encrypted HttpOnly session cookies. Passwords are entered at Auth0.
- Pages check the session on the server. API handlers independently check authentication; the backend independently validates access tokens. New private backend routes must use `current_user` and ownership checks in `app/auth/permissions.py`.
- Client secrets, session secrets and access tokens stay server-side. The SDK's browser access-token endpoint is disabled. `/api/account` is a fixed GET adapter, not an arbitrary URL proxy.
- The existing financial journey remains a synthetic, browser-session demo; login does not add persistent financial records. Logging out from the UI clears its session storage. Do not enter real financial data into the demo.

Reference: [official Auth0 Next.js SDK](https://github.com/auth0/nextjs-auth0).

## Verification

```sh
npm --prefix ui/clarity-editorial run typecheck
npm --prefix ui/clarity-editorial run lint
npm --prefix ui/clarity-editorial test
BackEnd/api/.venv/bin/pip install pytest httpx
PYTHONPATH=BackEnd/api BackEnd/api/.venv/bin/pytest BackEnd/api/tests
```

Live login, signup, callback and logout require your configured Auth0 tenant. Existing browser journey tests now require authenticated browser storage; they no longer have anonymous access to protected pages.

Run signed-out route protection checks with `npm --prefix ui/clarity-editorial run test:browser -- auth.spec.ts`.

To run the existing browser journeys, save a real signed-in browser session locally:

```sh
cd ui/clarity-editorial
mkdir -p .auth
npx playwright codegen --channel=chrome --save-storage=.auth/user.json http://127.0.0.1:3001/login
# Complete Auth0 login in the opened browser, then close that browser.
PLAYWRIGHT_AUTH_STATE=.auth/user.json npm run test:browser
```

The `.auth/` directory is ignored by Git because browser session state contains credentials. Renew the saved state if the session expires. The authentication tests always use an empty session, even when journey tests load saved state.
