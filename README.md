# YASS — Yass's Assistive Software System

A desktop app for tracking office/kitchen food inventory, expiration dates, and recurring tasks. Built with Tauri 2, Rust, SolidJS, and SQLite.



## Features

- **Inventory tracking** with expiration dates, locations, and quantities
- **Buy Again** — quick re-ordering of items you've had before, sorted by purchase frequency
- **Recurring tasks** with configurable intervals (daily, weekly, etc.)
- **CSV file import** with smart defaults and review step
- **Calendar view** of received items, expirations, and tasks
- **Dashboard** with expiring-soon alerts and gamified analytics
- **Full audit trail** — nothing is ever deleted, everything is logged
- **Work schedule awareness** — expiration badges account for Mon/Wed/Fri schedules

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) or npm

On Windows, you also need the [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and WebView2 (included in Windows 11, install separately on Windows 10).

## Setup

```bash
# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The production build outputs an installer to `src-tauri/target/release/bundle/`.

## Data

All data is stored locally in a SQLite database. Nothing leaves your machine. The database location depends on your OS:

- **Windows:** `%APPDATA%/com.yass.app/yass.db`
- **macOS:** `~/Library/Application Support/com.yass.app/yass.db`
- **Linux:** `~/.local/share/com.yass.app/yass.db`

## CSV Import Format

```
name,expiration_date
Milk,2026-03-20
Eggs,
Bread,2026-03-15
```

- **name** — required
- **expiration_date** — YYYY-MM-DD format, can be left blank (you'll set it in the review step)

Items with expiration dates are imported immediately. Items without dates go to a review screen where you can set them using the date shorthand.

## Date Input Shorthand

The expiration date field accepts shorthand for fast one-handed entry. Any non-digit key works as a month/day separator — hit whatever is closest to your fingers.

| Input | Result | Notes |
|-------|--------|-------|
| `25` | March 25 | Day only — uses current month |
| `5` | March 5 | Single digit day |
| `325` | March 25 | 3-digit compact: M + DD |
| `1225` | December 25 | 4-digit compact: MM + DD |
| `3/25` | March 25 | Any separator works |
| `3 25` | March 25 | Space works too |
| `3~25` | March 25 | Tilde, backtick, whatever |
| `1!5` | January 5 | Shift+1 is right there |
| `2026-03-25` | March 25, 2026 | Full ISO date passed through |

Invalid dates (Feb 31, month 13, etc.) are rejected. Shorthand dates that land in the past are auto-bumped forward:

- **Day-only** (e.g. `5` on March 28) → bumps to next month (April 5)
- **Month+day** (e.g. `1~5` on March 10) → bumps to next year (January 5, 2027)
- **Full ISO dates** are never bumped

## Keyboard Shortcuts

Designed for one-handed (left hand) use. No mouse needed for the daily workflow. **No simultaneous key chords** — every shortcut is a single key press or a quick double-tap. Inside a form, press `Escape` first to close it, then press any shortcut.

### Global (any page)

| Key | Action |
|-----|--------|
| `1` | Tasks |
| `2` | Inventory |
| `3` | Buy Again |
| `C` | Calendar |
| `D` | Dashboard (Home) |
| `4` | Import |
| `5` | History |
| `W` | What's Next — jump to the most urgent action |
| `Space` | Activate focused link or button |
| `Escape` | Close form, modal, or picker |
| `` ` `` | Backspace (in text fields) — left-hand delete |

### `W` — What's Next

Pressing `W` queries across all pages and navigates to the single most urgent action. Press `F` to do it. Repeat.

**Priority order:**

1. **Scheduled tasks** due today (priority > 0 or has a due time), ordered by time
2. **Items expiring today**
3. **Low-priority tasks** due today (default)
4. **Items expiring soon** (within 5 days)
5. **All caught up!**

### `F` — Universal "Do It" Key

| Page | `F` does |
|------|----------|
| Tasks (`1`) | Mark the first due task as done |
| Inventory (`2`) | Toss selected items, or toss the first expiring item if none selected |
| Buy Again (`3`) | Restock selected items |

### `Z` — Undo Last Action

| Page | `Z` undoes |
|------|------------|
| Inventory (`2`) | Last toss or remove — restores the item(s) |
| Tasks (`1`) | Last completion — restores previous due date |
| Buy Again (`3`) | Last restock or hide — deletes restocked items or unhides |

Only the most recent action per page is kept. Persists across navigation.

### List Navigation

| Key | Action |
|-----|--------|
| `R` | Next row (or jump into list from above) |
| `T` | Previous row (or jump to last row from above) |
| `Q` / `E` | Move between elements within the current row |

### Modal Navigation

| Key | Action |
|-----|--------|
| `Q` / `E` | Cycle between buttons |
| `F` | Confirm |
| `W` / `Escape` | Cancel and close |

### Other Page Shortcuts

| Key | Page | Action |
|-----|------|--------|
| `A` | Tasks, Inventory | Add new item/task |
| `S` | Inventory | Select expiring soon (<5 days) |
| `S` | Buy Again | Select out-of-stock items |
| `SS` | Inventory, Buy Again | Select / deselect all (double-tap S) |
| `Q` / `E` | Calendar | Previous / next month |

### Task Priority

Tasks have two priority levels:

- **Low** (default) — runs after expiring items are handled
- **Scheduled** — runs before everything else, can have a due time

### Time Input Shorthand

Due time uses the same left-hand-only philosophy. Bare digits = PM, trailing non-digit = AM.

| Input | Result | Notes |
|-------|--------|-------|
| `9~` | 9:00 AM | Any trailing non-digit = AM |
| `9` | 9:00 PM | Bare = PM |
| `12` | 12:00 PM | Noon |
| `12~` | 12:00 AM | Midnight |
| `1e` | 1:00 AM | `e` works as AM marker |
| `5` | 5:00 PM | |

Hours only (1-12). No minutes — this is just a reminder, not a calendar.

### Daily Workflow Example

1. Open app → `W` `F` `W` `F` `W` `F` (work through everything in priority order)
2. Or manually: `1` → `F` `F` `F` (knock out due tasks)
3. `2` → `S` → `F` → `F` (select expiring → toss → confirm)
4. `2` → `A` → fill form → `Tab` → `Space` (add new items)
5. `3` → `S` → set dates → `F` → `F` (select out-of-stock → restock → confirm)

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## Stack

- **Backend:** Rust + Tauri 2 + sqlx (SQLite, WAL mode)
- **Frontend:** SolidJS + TypeScript + TailwindCSS v4 + Vite
- **Data:** SQLite with embedded migrations, ledger-style soft deletes
