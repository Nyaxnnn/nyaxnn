# Mizan — private budgeting & net worth tracker

A local-first budgeting app built around zero-based (envelope) budgeting, spending
insights, and manual net worth/investment tracking. There is no backend, no
account, and no analytics — your data lives only in this browser's storage on
this device, in a per-browser IndexedDB database.

## Running it

No build step, no dependencies, no `npm install`. It's plain HTML/CSS/JS.

You do need to serve it over HTTP (not open the file directly with `file://`) —
browsers restrict IndexedDB and service workers on the `file://` protocol.
From this folder:

```
python3 -m http.server 8743
```

Then open **http://localhost:8743** in a browser (Safari, Chrome, or Edge all work).

To run it later, `cd` into this folder and run the same command again — or use
any other static file server you like (e.g. `npx serve`, Caddy, nginx).

## Installing it on your devices

Because it's a Progressive Web App, it installs like a native app and works offline:

- **iPhone (Safari):** open the URL → Share → "Add to Home Screen".
- **Mac (Safari or Chrome):** open the URL → File/Share menu → "Add to Dock" (Safari) or the install icon in the address bar (Chrome).
- **Windows (Edge/Chrome):** open the URL → install icon in the address bar → "Install".

Each device you install it on has its **own separate copy of the data** — see
Syncing below.

### Hosting it so you can reach the URL from your phone

Running `python3 -m http.server` only serves it on your Mac's own network
address, not the public internet. Two low-effort ways to get a stable URL you
can open from your phone too:

1. **Same Wi-Fi network:** find your Mac's local IP (`ipconfig getifaddr en0`)
   and open `http://<that-ip>:8743` from your phone while both devices are on
   the same Wi-Fi.
2. **A real URL from anywhere:** deploy the folder to a free static host —
   [Vercel](https://vercel.com), [Netlify](https://netlify.com), or
   [GitHub Pages](https://pages.github.com) all work with zero configuration
   for a plain static site like this one. This only publishes the *app code*
   (HTML/CSS/JS) — your financial data never touches that host, since it's
   generated and stored locally in each browser after the page loads.

## Syncing between phone, PC, and Mac

By design, there is no server-side sync — that's what keeps this private. Each
device's data is independent. To move data between devices:

1. On the source device: **Settings → Export backup (.json)**. This downloads
   a single JSON file with everything — accounts, transactions, budget,
   balances.
2. Get that file onto the other device (AirDrop, a USB cable, a private
   note-to-self, whatever you're already comfortable with).
3. On the destination device: **Settings → Import backup**. This *replaces*
   whatever is currently on that device with the contents of the file, so
   import into your "primary" device's latest export, not the other way
   around.

A sane routine: pick one device as primary (e.g. your phone, since you'll log
expenses on the go), export from it every so often, and import into your
Mac/PC when you want to look at the bigger picture. It's a few taps, not real-time
sync — that trade-off is what avoids needing any server at all.

**Back up before clearing browser data.** Browser "clear site data," private
browsing cleanup, or reinstalling the OS will wipe IndexedDB. Export
periodically the same way you'd back up anything else you care about.

## Logging daily spending

The **Track** tab is the fast path for daily use: a big amount field, one-tap
category chips, and an "Add expense" button that doesn't navigate away, so you
can log several purchases in a row. Every entry is a normal transaction under
the hood — it immediately counts against that category's envelope (you'll see
a toast confirming the updated spent/allocated amount) and shows up in Budget
and Insights right away. Below the quick-add form is a day-by-day log of the
month so far, with a subtotal per day.

The **Transactions** tab is the same underlying data, but built for reviewing
and filtering (by account, category, search) rather than fast entry.

## How the budgeting works

Zero-based / envelope budgeting, the method behind YNAB:

- Every SAR you earn (an **Income** transaction) adds to a **To Be Budgeted**
  pool, shown at the top of the Dashboard and Budget tab.
- You assign that pool into **categories** (envelopes) on the Budget tab —
  Rent, Groceries, Investing, etc.
- Spending (an **Expense** transaction) draws down the category you assign it to.
- Unspent amounts **roll forward** to next month automatically; overspending
  carries forward as a deficit you'll want to cover.
- Categories have an optional default **monthly target** — "Fill from targets"
  on the Budget tab applies all of them at once instead of typing every
  amount by hand each month.

Categories start pre-seeded (Rent, Groceries, Transport, Utilities, Dining
Out, Entertainment, Emergency Fund, Investing) — edit, rename, or delete any
of them from the Budget tab.

## How net worth / investing works

Accounts come in two flavors:

- **Cash / bank** accounts: balance is computed automatically from your
  transactions (starting balance + income − expenses ± transfers). This is
  for the account(s) you actually log day-to-day spending against.
- **Savings / investment** accounts: no bank link, no transactions needed —
  you periodically type in the current balance (from your bank app, Malaa,
  your broker, wherever) via "Update balance." Each entry is a dated
  snapshot, which is what draws the net worth trend line on the Net Worth
  tab.

This app doesn't move money or place trades — it's a ledger, not a broker. It
gives you a place to see, in one number, whether you're actually getting
richer month over month.

## Project structure

```
index.html            App shell + PWA meta tags
manifest.json          PWA install metadata
service-worker.js      Offline caching (app code only, never your data)
css/style.css           All styling
js/db.js               IndexedDB schema + queries (the only place touching storage)
js/budget-logic.js      Zero-based budgeting math (rollover, To Be Budgeted)
js/networth-logic.js    Cash balance + net worth aggregation
js/charts.js            Dependency-free SVG bar/line/donut chart renderers
js/ui.js                Modal/toast helpers shared across views
js/*-form.js            Add/edit modals for transactions, categories, accounts
js/views/*.js           One render function per screen (Dashboard, Track, Budget, …)
js/router.js, main.js   Hash router + app bootstrap, first-run category seeding
icons/                  PWA icons (generated locally, no external assets)
```

No framework, no bundler, no external CDN scripts — every request the app
makes after the first page load is to `localhost`/its own origin (for the
service worker) or nowhere at all.
