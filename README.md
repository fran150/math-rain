# Math Rain

A small browser game for practicing simple sums and multiplication tables.

Equations fall from the sky. Type the answer directly; when the typed number
matches a visible equation, that equation disappears.

## Run

```bash
npm run dev
```

Then open `http://127.0.0.1:5173`.

## Records

Regular games save the player name, score, solved count, starting challenge, and
date in the browser's local storage. Calm practice does not save records.

## Calm practice controls

- `[` slows the rain down.
- `]` speeds the rain up.
- `\` resets practice speed.

The project intentionally avoids external dependencies for the first version.
