## Scope (from your answers)

1. **Two new football variants** — full duplicates of existing Instant + Championship, drawing only from football teams.
2. **Instant Virtual behavior** — remove global countdown; shootout starts per-user immediately on Place Bet.
3. **Championship auto-restart** — on completion, immediately reshuffle 16 random teams and start again.
4. **Top-right logo** — new admin control for a corner logo (near bell/avatar).
5. Fix 404 on Virtual page.
6. Fix Championship "invalid input value for enum app_role: super_admin" start error.
7. Fix team delete timeout.
8. Admin control for the create-account left-side hero image.
9. Auto validation + resizing on logo/OG uploads with clear errors.

---

## 1. Database migration (single file)

**Fix `app_role` in RPC** — `championship_start` currently checks `'super_admin'::app_role`, but the enum has no such value. Rewrite the guard to admin-only (or add a `moderator` fallback — enum has `admin`, `moderator`). Also add `championship_tick` to auto-restart when a tournament completes and the arena is open.

**Add football sport tag**
- `teams.sport text default 'generic'` (`'generic' | 'football'`)
- Backfill: mark existing teams as `generic`. Admin flags football teams in Clans panel.

**Championship variants** — `tournaments.kind` already text; add two new kinds:
- `championship_football` (parallel to `championship_virtual`)
- Instant matches already keyed by `is_virtual`; add `matches.sport text default 'generic'` so football-instant rounds can be filtered.

**App settings additions**
- `virtual_cycle_running_football boolean` (per-user instant is trigger-based, but keep an admin open/closed flag)
- `virtual_championship_football_enabled boolean`
- `virtual_championship_auto_restart boolean default true`
- `platform_logo_corner_url text` (top-right logo)
- `auth_hero_image_url text` (login/register left-side hero)

**Team delete performance** — add `SECURITY DEFINER` RPC `delete_teams_bulk(uuid[])` that:
- Deletes dependent `bet_selections`, `bets`, `odds`, `tournament_matches`, `matches`, `players` in one statement each with `WHERE team_id = ANY(...)`, then `teams`.
- Runs with a raised local statement_timeout.
- Admin-only guard via `has_role(auth.uid(), 'admin')`.
Wire admin panels to call this RPC instead of `.delete().in('id', ids)`.

**Championship auto-restart trigger** — extend `championship_tick` so when a `championship_virtual` or `championship_football` tournament flips to `completed`, if `virtual_championship_auto_restart` is on and the arena is open, insert a fresh `scheduled` tournament with a 30s delay and immediately draft 16 random teams from the matching sport pool.

## 2. Frontend

**Virtual hub (`/virtual/`)** — grid becomes 4 cards:
- Instant Virtual (existing)
- Championship Virtual (existing)
- Instant E-Football (new — football pool)
- Championship E-Football (new — football pool)

**404 fix** — the 404 at `/virtual/championship` is the missing `championship_start` execute path (RPC crashes on super_admin enum). Once migration lands, page loads normally. Also add `errorComponent`/`notFoundComponent` to both new routes.

**Instant Virtual rework** — remove the global round countdown UI. Replace with a "Ready to shoot" state. On Place Bet click, call a new server function `start_user_shootout(bet_id)` (or extend existing `user_virtual_rounds` insert) that:
- Creates a private round for that user only
- Runs the animation client-side (existing shootout animation) from the returned seed
- No other user's timing is affected.
Global cycle worker is untouched — it just no longer drives the instant page.

**New routes**
- `src/routes/virtual.football.tsx` (instant football, near-identical to `virtual.instant.tsx`, filters teams by `sport='football'`)
- `src/routes/virtual.football-championship.tsx` (mirror of `virtual.championship.tsx` with `kind='championship_football'`)

**Register/Login hero** — read `auth_hero_image_url` from `app_settings`; render on left half. Fall back to bundled `auth-gangster.jpg`.

**Top-right logo** — Layout header adds a small logo near the bell/avatar area, sourced from `platform_logo_corner_url`.

**Image upload validation** — new `validateAndResizeImage()` util used by `ImageSettingControl`:
- Rejects non-image MIME types.
- For logos: enforces max 2MB, min 128×128, resizes to 512×512 fit-contain.
- For OG images: enforces 1200×630 (or close aspect), resizes/pads to exact 1200×630.
- Shows toast with specific error ("File too small — must be at least 128×128", etc.)
- Uses `canvas` in-browser resize; no server involvement.

## 3. Admin

**Categorized within existing admin page** (no new page) — Virtual admin panel splits into tabs:
- Instant (generic)
- Instant (football)
- Championship (generic) — with **Auto-restart** switch
- Championship (football) — with **Auto-restart** switch

**Clans admin** — team edit dialog gets a "Sport" selector (`generic` / `football`) so admin can tag existing teams as football teams for the football pool. Bulk-tag button in Teams tab.

**Branding admin** — add two new slots:
- Corner logo (top-right)
- Auth-page hero image (left half of login/register)
Both use the new validated `ImageSettingControl`.

## 4. Technical notes

- Migration order: enum guard fix (`admin` only), then columns, then bulk-delete RPC, then auto-restart tick.
- `championship_tick` becomes the single scheduler heartbeat for both `_virtual` and `_football` kinds.
- Instant-shootout per-user uses existing `user_virtual_rounds` table (already there per schema).
- Bulk delete RPC runs `SET LOCAL statement_timeout = '60s'` and deletes in FK-safe order.
- Image validation is pure browser; server just stores the resulting URL as before.

## Out of scope
- New bet market types for football (using existing markets).
- Redesigning the admin sidebar again.
- Rewriting the global virtual cycle worker (still exists for background matches page).

Say go and I'll ship it in one pass.