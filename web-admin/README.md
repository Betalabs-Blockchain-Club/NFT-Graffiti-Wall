# Graffiti Wall moderation app

Staff-only React app for reviewing pending, minted, and hidden artwork. The admin bearer token is held in React memory, sent as an `Authorization: Bearer` header, and cleared after five minutes without interaction or when **Lock session** is pressed. A server-side 401 clears the session and returns to sign-in with an explanation.

## Run against the mock API

From the repository root, start the fixture API:

```sh
npm run mock -w @graffiti/web-admin
```

Then in another terminal:

```sh
npm run dev -w @graffiti/web-admin
```

Open the Vite URL and sign in with `mock-admin-token` (or the value supplied as `ADMIN_TOKEN` to the mock). The mock starts with pending, minted, and hidden examples. Approve and hide actions update the API's in-memory state, so changes remain after refreshing the browser while the mock process stays running. Restarting the mock resets its fixtures.

## Connect to the real API

Set `VITE_API_URL` to the backend origin and `VITE_IPFS_GATEWAY` to a public gateway. These are public frontend settings; never configure an admin token in a `VITE_*` variable. Enter the backend's `ADMIN_TOKEN` only in the sign-in form. The backend must enforce bearer authorization independently for moderation routes.
