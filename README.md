# Harmony Shake ⚗

A planner for cooking **[Party] Harmony Draught – Edania** in Black Desert.
It tracks your ingredient stock, calculates everything needed for _N_ draughts down to raw materials, and can read your in-game storage from a screenshot.
Item names are shown in Thai and English.

- **Calculator:** pick a target and quantity. It shows every crafting step, the raw materials needed vs. what you have, what's missing (with a copyable shopping list), and how many you can craft right now.
- **Stock:** an editable inventory table, with change history and JSON backup / restore.
- **Scan screenshot:** paste a storage screenshot. The app finds the slot grid and cuts out each slot. Claude then reads the items and amounts, and you review and confirm before your stock changes. Slots you confirm are remembered, so later scans recognise the same items instantly.
- **Recipes & items:** edit any recipe, yield, substitute group, Thai name or icon.
- **Token log:** what each screenshot scan cost.

---

## Requirements

| Tool | Version | Needed for |
|---|---|---|
| [Node.js](https://nodejs.org/) | **20.19+** or **22.12+** (LTS recommended) | running the app |
| [Python](https://www.python.org/) | 3.10+ | *optional*: downloading item icons, regenerating recipe data |
| Anthropic API key | — | *optional*: only for **Scan screenshot** ([get one here](https://console.anthropic.com/)) |

Check your versions:

```bash
node --version
```

```bash
python --version
```

---

## Run it locally

### 1. Get the code

```bash
git clone https://github.com/EpistemeHobo/harmony_shake.git
```

```bash
cd harmony_shake
```

### 2. Install dependencies (first time only)

```bash
npm install
```

### 3. Item icons (only if `public/icons/` is missing)

The item icons come from [bdocodex.com](https://bdocodex.com) and may not be included in the repository.
If the `public/icons/` folder is empty or missing, download them once (this takes a few minutes, because it pauses between requests to be polite to bdocodex):

```bash
python scripts/fetch_icons.py
```

```bash
python scripts/build_seed.py
```

The app works without icons too. Items then show a letter placeholder.

### 4. Start the app

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. Keep the terminal window open while you use the app. Press `Ctrl+C` in it to stop.

### 5. (Optional) Enable screenshot scanning

Open **Settings** in the app and paste your Anthropic API key.
Then choose a model: Opus 5.5 is the most accurate, and Sonnet 5.5 / Haiku 4.5 are cheaper.

---

## Using the screenshot scanner

1. **Paste** (`Ctrl+V`), drop, or choose screenshots of your storage. Crop them to just the slot grid.
2. **Check the grid.** It's detected automatically and drawn over the screenshot.
   - Drag the red (top-left) and blue (bottom-right) handles to fit it.
   - Adjust the column/row count.
   - Click a slot to mark it empty or occupied.
   
   The grid is remembered for screenshots of the same size.
3. **Scan, then audit.** Each row shows the slot picture, the ingredient (picker with icons) and the amount. Fix anything wrong. Big stacks shown as `196.8K` are rounded by the game; type the exact count if you need it.
4. **Confirm & save** updates your stock and teaches the app those slot pictures for next time.

A full storage page costs roughly $0.10–0.40 with Opus 5.5. See the **Token log** tab for actual numbers.

---

## Where your data lives

Everything is stored **in your browser** (`localStorage`) for the address you open: stock, history, recipe edits, learned slots, and your API key.

- Nothing is sent anywhere except screenshots, which go to `api.anthropic.com` when you click **Scan**.
- **Your API key is never written to any file** and is removed from exported backups.
- Data is tied to the browser **and** the port: `localhost:5173` and `localhost:5174` have separate storage. If the app suddenly looks empty, check you're on port 5173. If 5173 was busy, Vite picks the next port; close the other server and restart.
- To move data to another browser or PC, use **Stock → Export backup**, then **Import backup**. Re-enter the API key afterwards.

---

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | start the development server (hot reload) |
| `npm run build` | type-check and build a static site into `dist/` |
| `npm run preview` | serve the built `dist/` locally |
| `npm run lint` | lint the code |
| `python scripts/fetch_icons.py` | download missing item icons + grades from bdocodex (safe to re-run) |
| `python scripts/build_seed.py` | regenerate `src/seed.ts` from `harmony_tree_bdocodex.json` and the icon list |

---

## Recipe data and assumptions

Recipes were collected from [bdocodex.com](https://bdocodex.com) on 2026-10-06 and are stored in `harmony_tree_bdocodex.json`.
Everything below can be changed in **Recipes & items**:

- A normal Alchemy craft yields **3** on average; Elixir of Edania yields 1.
- A higher-grade (blue frame) elixir counts as **3** of its base (green frame) version. This matches the in-game recipe variants: ×10 blue instead of ×30 green.
- The final Party recipe uses **3× Elixir of Edania** instead of 1× Strong Elixir of Edania, which saves the Blue Reagent.
- Substitute ingredients use their in-game worth, e.g. a High-quality herb counts as 6.
- Spellbound Catalyst can't be crafted. It's bought from the Old Moon Manager.

---

## Deploy to fly.io

The deployed site is a static build served by an unprivileged nginx container (`Dockerfile`, `deploy/nginx.conf`, `fly.toml`).
There is no backend: every user's data and API key stay in their own browser.

1. Install the [fly CLI](https://fly.io/docs/flyctl/install/) and log in:

   ```bash
   fly auth login
   ```

2. Create the app once. Keep the existing `fly.toml`, and change `app = "harmony-shake"` to a unique name if that one is taken:

   ```bash
   fly launch --no-deploy --copy-config
   ```

3. Deploy (also used for every later update):

   ```bash
   fly deploy
   ```

### Security measures

| Layer | Protection |
|---|---|
| Content-Security-Policy | Only the site's own scripts run; network access only to itself and `api.anthropic.com`. An injected script can't run or send a user's API key anywhere. |
| Framing | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (no clickjacking). |
| Transport | `force_https`, HSTS (2 years). |
| Other headers | `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera/mic/location off), `COOP`/`CORP` same-origin. |
| Abuse limits | GET/HEAD only, 1 KB max request body, short timeouts, 20 req/s per client (burst 80), 30 connections per client, Fly concurrency cap, hidden server version, dotfiles never served. |
| Container | Non-root nginx; only the built files are shipped (no source, scripts, backups or `.env`). |
| App | Imported backups are validated and cleaned (icons limited to image data or `/icons/` files, sizes capped, API key never imported); the screenshot reader's answers are treated as untrusted data; bdocodex links accept numeric ids only. |
| Dev server | The icon writer (`/__api/icons`) exists only under `npm run dev`, accepts only same-machine, same-page JSON requests, and is absent from the deployed site. |

Users who want maximum safety can run their own copy from source (see **Settings → User data policy** in the app).

---

## Project layout

```
src/
  App.tsx              tabs / layout
  calc.ts              crafting-tree calculator
  store.ts             app state + localStorage persistence
  grid.ts              screenshot slot-grid detection
  cells.ts             cell cutting, empty-slot detection, learned matching
  vision.ts            Claude API call for reading cells
  seed.ts              default items/recipes (generated, don't edit by hand)
  components/          one file per page + shared widgets
scripts/               Python data tools (bdocodex icons, seed generation)
public/icons/          item icons (downloaded)
```

---

## Disclaimer

Fan-made tool, not affiliated with Pearl Abyss.
Black Desert and its item artwork are trademarks / copyright of Pearl Abyss.
Item data and icons come from [bdocodex.com](https://bdocodex.com).
