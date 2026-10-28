# PRD: Parish editor on admin.<domain> (variant C, "Opravila")

Status: planned · Author: Claude with the user · 2026-10-27
Research: [`tasks/research-editor-direction.md`](./research-editor-direction.md) · Prototype: [`tasks/prototype-editor.html`](./prototype-editor.html)

## 1. Introduction

The priest (msgr. dr. Blaž Jezeršek) and a few older helpers need to keep the website current: Masses and intentions, the weekly oznanila (bulletin), events and Verouk (religious education). Today this happens in Sanity Studio, a generic CMS that is hard for them to use and has no affordable per-section roles.

We build our own editor, shaped around the parish's tasks:

- It lives at `admin.<domain>`.
- The home screen is a to-do list ("Na vrsti"), with big buttons.
- A chat assistant (Claude) proposes changes as cards that a person confirms.
- Claude reads a photographed or handwritten bulletin into a draft. A person checks the flagged fields and publishes.
- Helpers see only their own sections. The priest decides per person whether their changes wait for his approval.

Content the editor manages moves from Sanity to our own Postgres database. The public website reads it from there.

## 2. Goals

- The priest publishes a week's bulletin from a phone photo in under 3 minutes, with no typing except corrections.
- Every write goes through one server-side permission check. A helper cannot change a section they don't have, from the screens or the chat.
- Nothing Claude produces reaches the public site without a person confirming it.
- Every change is recorded with who, what and when, and the latest change can be undone in one tap.
- Usable on a phone by someone who is not comfortable with computers: Slovenian, large tap targets, an option for larger text.

## 3. User stories

Fixed test clock for every criterion below: **Tuesday 2026-10-27, 10:00 Europe/Ljubljana**, injected through `src/lib/clock.ts`. Seed data is defined in §10, "Test data setup".

Weeks run **Sunday–Saturday** everywhere (site, editor, `bulletins.week_start`, Domov, assistant): the bulletin read on Sunday covers that Sunday through Saturday. `clock.weekStart()` is the one definition.

### US-001: Database and seed

**Description:** As a developer, I need the editor's content in Postgres so that the editor and the public site share one source of truth.

**Acceptance criteria:**
- [integration] After `npm run db:migrate && npm run db:seed` against an empty database, these hold:
  - `churches` has exactly 3 rows: `Marijina cerkev`, `Sv. Križ`, `Sv. Tomaž`.
  - `mass_schedule_entries` has exactly 6 rows, matching `studio/scripts/seed-parish-data.ts`.
  - `masses` has exactly 8 rows for 2026-10-25 … 2026-10-31.
- [integration] `ensureMasses("2026-11-01", "2026-11-07")` creates exactly 8 rows. Calling it a second time creates 0 rows: it is idempotent, through a unique key on (date, time, church_id).
- [integration] The mass on 2026-10-28 at 18:30 in `Marijina cerkev` has exactly one intention: kind `deceased`, text `Branko Babnik`.
- [unit] `ensureMasses` never creates a mass on a date that has a row in `mass_day_overrides` with `replaces_schedule = true`.

**Verification:** tests `web/src/db/seed.test.ts` and `web/src/lib/masses/ensure.test.ts`. Regression risk: none yet (new tables).

### US-002: Sign-in (magic link and Google), invite only

**Description:** As a helper, I want to sign in with a link sent to my email, without a password, so that I can't forget it.

**Acceptance criteria:**
- [integration] POST to the sign-in action with `marta@example.com` (an existing user) sends exactly one email through the mail adapter. The email contains a link to `https://admin.<domain>/prijava/potrdi?token=…`, and the token expires after 15 minutes.
- [integration] POST with `nekdo@example.com` (no user row) sends no email. The response is identical to the success case, so the action can't be used to find out which addresses exist.
- [integration] A magic-link token used twice: the second use returns the login screen with the text `Povezava je že bila uporabljena. Zahtevajte novo.` and creates no session.
- [integration] Google sign-in with a verified email that matches a user creates a session. A Google email with no user row is rejected with the text `Ta e-pošta nima dostopa. Prosite župnika za povabilo.`
- [integration] A request to `admin.<domain>/` with no session redirects to `/prijava`. A request to the public host for any `/admin` path returns 404.
- [browser] On `/prijava` at 390px: entering `blaz@example.com` and pressing `Pošlji povezavo` shows the heading `Preverite e-pošto` and the entered address. Zero console errors.
- [browser] `/prijava` at 1440px matches the prototype login screen (two columns: moss panel on the left, form on the right).

**Verification:** tests `web/src/auth/*.test.ts`. dev-browser: sign in as Marta through the dev mail outbox page `/dev/outbox` (development only). Regression risk: the public site's contact form also uses the mail adapter.

### US-003: Sections, permissions and navigation

**Description:** As the priest, I want each helper to see and change only their own parts, so that nobody breaks something they don't look after.

**Acceptance criteria:**
- [unit] `can(user, section)` returns true for every section when `user.is_owner`. For Marta (sections `mase`, `oznanila`, `dogodki`) it returns false for `verouk` and `ljudje`.
- [integration] Every server action in `web/src/app/(admin)/**/actions.ts` calls `requireSection`. A test enumerates the exported actions and fails if one doesn't (a static check on the action registry).
- [integration] Ana (sections: `verouk` only) calling `addIntention` gets the error `forbidden`, and no `intentions` or `change_requests` row is created.
- [integration] Ana requesting `/teden` is redirected to `/` (Domov).
- [browser] Signed in as Ana at 1440px, the sidebar shows exactly `Domov`, `Verouk`, `Zgodovina`.
- [browser] Signed in as Marta at 390px, the tab bar shows `Domov`, `Maše`, `Oznanila`, `Več`, and `Več` opens a sheet listing `Dogodki` and `Zgodovina`.
- [browser] Signed in as Blaž at 1440px, the sidebar shows 7 items, and `Domov` has a badge with the text `2`.

**Verification:** tests `web/src/auth/permissions.test.ts` and `actions-registry.test.ts`. dev-browser: switch between three seeded users. Regression risk: every action.

### US-004: Domov (task home)

**Description:** As the priest, I want the first screen to tell me what needs doing this week, so that I don't have to look for it.

**Acceptance criteria:**
- [integration] The Domov loader for Blaž returns:
  - `nextMass` = 2026-10-27 18:30, Marijina cerkev, intention `Štefan Hrovat`.
  - `approvals.length` = 2.
  - `bulletinMissing` = `{week: "2026-11-01"}`.
  - `massesWithoutIntention` = [] (the Masses still ahead this week, Wednesday to Saturday, all have one). With the 2026-10-31 18:30 intention removed it is exactly that Mass; a pending intention counts as an intention.
- [integration] For Marta the same loader returns `approvals` = [] and `mine.length` = 2: her own items waiting for the priest.
- [browser] Blaž at 1440px:
  - The hero shows `18.30` and `Naslednja maša · danes`.
  - A card shows `2 spremembi čakata vašo potrditev`, with the rows `Nov namen † Ivana Kos` and `Nov dogodek: Čiščenje Marijine cerkve`.
- [browser] Clicking `Potrdi vse (2)` removes the approvals card, the sidebar badge disappears, and a toast reads `Vse je potrjeno in objavljeno.`. A reload confirms both changes persisted.
- [browser] Ana at 390px sees the hero `16.00` and `Naslednja ura verouka · danes`, and no Masses card.
- [browser] Domov at 1440px and 390px matches prototype C (section order: greeting, hero, Na vrsti, Hitro, Urejeno).

**Verification:** tests `web/src/app/(admin)/domov/loader.test.ts`. Regression risk: none.

### US-005: Week of Masses (Maše in nameni)

**Description:** As the priest or secretary, I want to see the week's Masses with their intentions and how they will look on the website.

**Acceptance criteria:**
- [integration] GET `/teden?w=2026-10-25` returns 8 masses in 7 day groups, Sunday 2026-10-25 first. In the next week, Sunday 2026-11-01 carries the feast label `Vsi sveti` and the pending `Ivana Kos`.
- [integration] GET `/teden?w=2026-11-08` (after `ensureMasses`) returns 8 masses with 0 intentions. The loader flag `isEmpty` is true.
- [browser] `/teden` shows the range `25.–31. oktober` (the same as the public `/masni-nameni`). Clicking `›` changes it to `1.–7. november` and shows the banner text `Redne maše so že vpisane po urniku.`
- [browser] Clicking `Na strani` shows the browser frame `zupnija-pirnice.si/svete-mase`, and the pending intention `Ivana Kos` is not in it. Clicking `Urejanje` shows it again, with the label `čaka potrditev · Marta`.
- [browser] At 390px the page has no horizontal scroll: `document.documentElement.scrollWidth <= 390`.

**Verification:** dev-browser flow over both weeks. Regression risk: the public `/svete-mase` page, which shares the date helpers in `web/src/lib/dates.ts`.

### US-006: One Mass: add or remove an intention, cancel, restore

**Description:** As the priest, I want to tap a Mass and change it there.

**Acceptance criteria:**
- [integration] Blaž: `addIntention({massId: <2026-11-01 10:00>, text: "Jože Novak", kind: "deceased"})` creates one published intention and one `history` row labelled `Nov namen † Jože Novak`.
- [integration] Marta, same call: creates no `intentions` row. It creates one `change_requests` row with status `pending`, action `intention.add`, created_by Marta.
- [integration] `addIntention` with text `""` returns the validation error `Vpišite, za koga je namen.` Text longer than 200 characters returns `Največ 200 znakov.`
- [integration] Blaž: `cancelMass({massId: <2026-10-28 18:30>, reason: "Župnik je na duhovnih vajah.", intentionHandling: "next"})` does all of the following:
  - sets status `cancelled` and stores the reason;
  - moves the intention `Branko Babnik` to the 2026-10-29 07:00 mass, with `moved_from_mass_id` set;
  - writes 1 history row.
- [integration] `cancelMass` on a mass that has intentions, without `intentionHandling`, returns the error `Izberite, kaj naj bo z namenom.`
- [integration] `restoreMass` sets status back to `scheduled` and clears the reason. Moved intentions stay where they were moved.
- [browser] Clicking the Wednesday 18.30 row opens a panel titled `18.30 · Marijina cerkev`. Clicking `Odpovej mašo` → `Prestavi na naslednjo mašo` → `Potrdi odpoved` closes the panel. The row then shows the pill `Odpade`, and Thursday 7.00 lists `Branko Babnik` with the pill `prestavljen`.
- [browser] In the same panel, `Potrdi odpoved` is disabled until one intention option is chosen.

**Verification:** tests `web/src/app/(admin)/teden/actions.test.ts`. Regression risk: the public "Danes" block and `MassList`, which must render a cancelled mass struck through with its reason.

### US-007: Approvals (change requests)

**Description:** As the priest, I want helpers' changes to wait for me when I've chosen that for them.

**Acceptance criteria:**
- [integration] `approve(changeRequestId)` by Blaž applies the stored action through the same function the owner path uses. It sets status `approved`, `decided_by` = Blaž and `decided_at`, and writes one history row prefixed `Potrjeno:`.
- [integration] `reject(id)` sets status `rejected` and changes no content rows.
- [integration] Marta calling `approve` on any request returns `forbidden`.
- [integration] When Blaž sets Marta's `requires_approval = false`, her next `addIntention` publishes directly and creates no change request.
- [integration] Approving a request whose target mass has since been cancelled returns the error `Maša je bila medtem odpovedana.`, and the request stays pending.
- [browser] As Marta: adding the intention `Ana Kos` to Sunday 10.00 shows the toast `Poslano župniku v potrditev.`, and the row shows a dashed `Ana Kos` with the pill `čaka župnika`. After switching to Blaž, Domov lists `Nov namen † Ana Kos`, and `Zavrni` removes it from both the list and the week.

**Verification:** tests `web/src/lib/changes/*.test.ts`. Regression risk: every action that can be pending.

### US-008: Upload a bulletin, Claude reads it, check, publish

**Description:** As the priest, I want to photograph the handwritten oznanila and have them on the website after checking only what's uncertain.

**Acceptance criteria:**
- [integration] Uploading `fixtures/oznanila-rokopis.jpg` stores the file under `UPLOAD_DIR` with its sha256 and creates a `bulletins` row with week_start `2026-11-01` and status `reading`. It calls `runClaude` once.
- [integration] That `runClaude` call spawns `claude-pool` with:
  - `-p`, `--output-format json` and `--model claude-opus-5-5`;
  - `--allowedTools Read` and `--disallowedTools Bash,Edit,Write,WebFetch,WebSearch`;
  - a working directory holding only a copy of the upload.
- [integration] With `runClaude` mocked to return `fixtures/extract-rokopis.json`, the draft has 8 items and 3 notices. Exactly 2 items are flagged:
  - field `text`, options `Jože Novak` / `Jože Nosak`;
  - field `time`, options `17:30` / `18:30`.
- [unit] `flagScheduleMismatches(draft, schedule)` flags every item whose time doesn't match a regular-schedule mass on that date and church, even when the model returned no flag for it.
- [integration] `publishBulletin` while any flag is unresolved returns `Najprej preverite označena mesta.` and publishes nothing.
- [integration] With the flags resolved, `publishBulletin` by Blaž does all of the following:
  - creates 8 intentions in week 2026-11-01;
  - changes the 2026-11-06 mass time to 17:30 when that option was chosen;
  - stores 3 `bulletin_notices`;
  - sets status `published` and writes one history row `Objava oznanil 1.–7. november`.
- [integration] The same action by Marta creates one change request `bulletin.publish` and sets the bulletin status to `pending`.
- [integration] With the extractor returning `{readable: false, reason: "blurry"}`, the bulletin gets status `unreadable` and no draft. No content rows change.
- [integration] When the reply is not valid JSON for the draft schema (zod), `runClaude` is retried exactly once. If the second reply is also invalid, the bulletin gets status `unreadable`.
- [integration] When `claude-pool` exits with code `75` (every account full), the bulletin gets status `ai_busy` and the page shows `Pomočnik je trenutno zaseden. Poskusite čez nekaj minut ali vpišite ročno.` No content rows change.
- [integration] An upload over 20 MB, or of a type outside jpeg/png/heic/webp/pdf/xlsx/csv/ods, is rejected with `Datoteka je prevelika (največ 20 MB).` or `Te vrste datoteke ne znam prebrati.`
- [browser] On `/oznanila/nalozi`, choosing the fixture image shows the step `Claude bere` and the handwritten preview. Within 60 s it shows `2 mesti za preveriti`, and the publish button reads `Najprej preverite 2 označeni mesti` and is disabled.
- [browser] Clicking `Jože Novak`, then `18.30, po urniku`, enables `Objavi oznanila`. Clicking it shows `Oznanila so objavljena`, and `/teden?w=2026-11-01` lists `Jože Novak` on Tuesday.
- [browser] With the unreadable fixture, the page shows `Tega lista ni mogoče prebrati` and the buttons `Fotografiraj znova`, `Izberi drugo datoteko`, `Vpiši ročno`.
- [browser] Review at 1440px matches the prototype: the sheet on the left, the draft on the right, numbered flags in gold, the sticky action bar.

**Verification:** tests `web/src/lib/bulletin/*.test.ts`. `claude-pool` is never spawned in CI: `runClaude` is mocked. A manual check with `npm run eval:bulletin` runs the real `claude-pool` on 3 fixtures and prints field accuracy. Regression risk: the public `/oznanila` page.

### US-009: Events (Dogodki)

**Description:** As the secretary, I want to add a parish event without help.

**Acceptance criteria:**
- [integration] `saveEvent({title: "Srečanje ključarjev", date: "2026-11-05", time: "08:00", place: "Marijina cerkev"})` by Blaž creates one event. The same call by Marta creates one change request and no event.
- [integration] An empty title returns `Vpišite naslov.` A missing date or time returns `Izberite datum in uro.`
- [integration] Only the owner can call `deleteEvent`. Marta gets `forbidden`.
- [browser] `/dogodki` lists 4 events under the month heading `november`. Adding `Srečanje ključarjev` as Blaž adds a fifth row with day box `5` and `čet`.

**Verification:** tests `web/src/app/(admin)/dogodki/actions.test.ts`. Regression risk: the public events list and the homepage section.

### US-010: Verouk

**Description:** As the catechist, I want to cancel this week's lesson and tell parents why.

**Acceptance criteria:**
- [integration] Ana: `cancelLesson({groupId: <4.–6. razred>, date: "2026-10-28", message: "Zaradi jesenskih počitnic."})` creates one `catechesis_cancellations` row and one history row.
- [integration] The same call by Marta returns `forbidden`.
- [browser] Ana clicking `Ta teden odpade` on `4.–6. razred`, entering the message and pressing `Potrdi odpoved` makes the card show `Odpade`, with the message in italics. The public `/verouk` page shows the message under that group.

**Verification:** tests `web/src/app/(admin)/verouk/actions.test.ts`. Regression risk: the public Verouk page.

### US-011: People and access

**Description:** As the priest, I want to invite helpers and decide what each of them may change.

**Acceptance criteria:**
- [integration] `invite({name: "Petra Kovač", email: "petra@example.com", sections: ["dogodki"], requiresApproval: true})` creates one user with `invited_at` set and sends one email containing the sign-in link.
- [integration] Inviting an email that already exists returns `Ta oseba že ima dostop.`
- [integration] `updateAccess(marta, {sections: ["mase"]})` takes effect on Marta's next request. Her `saveEvent` call then returns `forbidden`.
- [integration] `revokeAccess(marta)` deletes all her sessions and sets `disabled_at`. Her next request redirects to `/prijava`.
- [integration] Nobody, including the owner, can call `revokeAccess` on the owner, and only the owner can call any people action.
- [browser] `/ljudje` lists 4 people. Tone shows `povabilo poslano, še ni prijavljen`. In the invite panel, choosing the `Katehist` preset turns on only the `Verouk` switch.

**Verification:** tests `web/src/app/(admin)/ljudje/actions.test.ts`. Regression risk: auth.

### US-012: History and undo

**Description:** As anyone, I want to see what changed and undo my last change if I made a mistake.

**Acceptance criteria:**
- [integration] Every content action writes exactly one `history` row with `user_id`, `section`, `label`, and `before`/`after` JSON for each affected row.
- [integration] `undo(historyId)` by its author restores every affected row to `before` and writes one history row `Razveljavljeno: <label>`.
- [integration] `undo` fails with `Tega ni več mogoče razveljaviti, ker je bilo medtem spremenjeno.` when any affected row's `updated_at` is newer than the history row.
- [integration] `undo` of someone else's change by a non-owner returns `forbidden`.
- [browser] After adding an intention, the toast shows `Razveljavi`. Clicking it removes the intention, and the toast reads `Razveljavljeno: Nov namen † Jože Novak`.
- [browser] `/zgodovina` as Ana lists only Verouk entries. As Blaž it lists all of them.

**Verification:** tests `web/src/lib/history/*.test.ts`. Regression risk: every action.

### US-013: Assistant (chat with proposal cards)

**Description:** As the priest, I want to write "odpovej mašo v sredo" and get a change to confirm.

**Acceptance criteria:**
- [integration] The assistant prompt only contains data and proposal types for the user's sections:
  - Ana's prompt contains the Verouk lessons and the proposal type `cancel_lesson`, and no masses.
  - Blaž's prompt also contains this week's and next week's masses, and the proposal types `add_intention`, `cancel_mass`, `event` and `open_upload`.
- [integration] The assistant never writes content. After a turn whose reply holds a `cancel_mass` proposal, the `masses` table is unchanged and the response contains one proposal of type `cancel_mass` with the target mass id.
- [integration] The assistant runs `claude-pool -p` with `--output-format json` and `--disallowedTools` covering every built-in tool, so it can read nothing but the prompt. The reply is validated against the proposal schema (zod). A proposal whose mass id is not in the prompt's data is dropped.
- [integration] Confirming a proposal calls the same server action as the screens, with the same permission and approval checks. A proposal forged by the client with Ana's session and type `cancel_mass` returns `forbidden`.
- [integration] With `runClaude` mocked to return `{reply: "…", proposals: [{type: "add_intention", massId: <2026-11-01 08:00>, text: "Jože Novak", kind: "deceased", kindIsGuess: true}]}`, the card carries `kindIsGuess: true`.
- [integration] On `claude-pool` exit code `75`, the chat shows `Pomočnik je trenutno zaseden. Spremembo lahko naredite tudi na zaslonu.`
- [browser] Opening the assistant on Domov shows a greeting containing `Ta teden je 8 maš`. Sending `Odpovej mašo v sredo` shows a card `Maša odpade` for `sreda, 28. oktober, 18.30, Marijina cerkev`, with the button `Najprej izberite zgoraj` disabled until an intention option is chosen.
- [browser] Sending text that matches no tool returns a reply that lists what the assistant can do, and creates no card.

**Verification:** tests `web/src/lib/assistant/*.test.ts` (`runClaude` mocked). Manual check: `npm run eval:assistant` runs 20 Slovenian commands through the real `claude-pool` and reports how many produce the expected proposal. Regression risk: none.

### US-014: The public site reads the new data

**Description:** As a parishioner, I want the website to show what the priest published, right away.

**Acceptance criteria:**
- [integration] `getWeekMasses("2026-10-27")` (public data layer, week 2026-10-25 … 31) returns the same 8 masses and published intentions as the editor loader. It never returns a pending intention or a pending event.
- [integration] After `publishBulletin`, `revalidateTag("masses")` and `revalidateTag("bulletins")` are called once each.
- [browser] After Blaž cancels Wednesday 18.30 in the editor, reloading the public `/svete-mase` within 5 seconds shows `Odpade` on that mass, with the reason.
- [browser] The public pages `/`, `/svete-mase`, `/oznanila`, `/dogodki` and `/verouk` return 200 with zero console errors after the switch.

**Verification:** dev-browser on both hosts. Regression risk: high, since every public page that showed Masses, bulletins, events or Verouk changes its data source.

### US-015: Hosting and backups

**Description:** As the developer, I need the editor deployed and the data safe.

**Acceptance criteria:**
- [integration] `infra/compose.yml` defines `db` (postgres:17) with a named volume and an uploads volume mounted into `web`. Traefik routes `admin.${DOMAIN}` to the same `web` service.
- [integration] The `web` image contains `claude` (Claude Code CLI, pinned version), `python3` and `claude-pool` (pinned release). Tokens are not in the image. Compose mounts:
  - the host's `/etc/claude-pool` read-only as `CLAUDE_POOL_DIR`;
  - a writable volume for `CLAUDE_POOL_STATE` and `CLAUDE_CONFIG_DIR`.
- [integration] `docker compose exec web claude-pool --pool-check` exits 0 on t4a.
- [integration] `scripts/backup.sh` writes `pg_dump` output and a tar of `UPLOAD_DIR` to `BACKUP_DIR`, named with the date, keeps 30 daily copies, and exits non-zero on failure.
- [integration] `scripts/restore.sh <file>` restored into an empty database gives the same row counts as the source.

**Verification:** a restore drill on a scratch database before go-live. Regression risk: the current public deploy.

## 4. Functional requirements

- FR-1: The editor is served only on `admin.<domain>`. The proxy (`web/src/proxy.ts`) routes by Host header. Admin routes return 404 on the public host.
- FR-2: Sign-in uses magic links (15 minutes, single use) and Google. Only emails present in `users`, and not disabled, can sign in. Sessions last 30 days and are revoked when access is removed.
- FR-3: The sections are `mase`, `oznanila`, `dogodki` and `verouk`. `ljudje` is owner-only. Exactly one owner exists.
- FR-4: Every write is a server action that calls `requireSection(section)` first, then either applies the change or, if `user.requires_approval`, stores a `change_request`.
- FR-5: Applying a change and approving a change request run the same function, so the rules can't drift apart.
- FR-6: Every applied change writes a `history` row holding `before`/`after` snapshots. Undo is allowed for the author, or the owner, while the affected rows are unchanged since.
- FR-7: Masses are generated from `mass_schedule_entries` for today through +8 weeks by `ensureMasses`, idempotently. A generated mass that has no intentions and was never edited is regenerated when the schedule changes. An edited mass is never overwritten.
- FR-8: Cancelling a Mass that has intentions requires a choice: move them to the next Mass, or keep them on the cancelled Mass, which isn't shown publicly.
- FR-9: All AI calls go through **claude-pool** (decision by the user, 2026-10-27). One server module, `web/src/lib/ai/runClaude.ts`, does the following:
  - spawns `claude-pool -p <prompt> --output-format json --model claude-opus-5-5`, with an explicit `--allowedTools` / `--disallowedTools` list;
  - runs it in a fresh temp directory with a 120 s timeout;
  - parses the `result` field, records `pool_account` in the log, and maps exit code `75` to `AiBusyError`.
  - Bulletin reading: the upload is copied into the temp directory, and only `Read` is allowed. xlsx/ods are converted to CSV text on the server first. The prompt includes the target week's regular Masses, the churches and the draft JSON schema. The reply is validated with zod and retried once if invalid.
- FR-10: The draft marks an item as flagged when the model reports low confidence, or when FR-11 finds a mismatch. A bulletin can't be published while a flag is open.
- FR-11: `flagScheduleMismatches` runs on the server after extraction and flags any time, date or church that doesn't match the week's generated Masses.
- FR-12: The assistant also runs through `runClaude`, with every built-in tool disallowed. The prompt holds the user's section data, the conversation so far and the reply schema `{reply, proposals[]}`. The server validates the reply and drops proposals that point at ids it didn't send. Confirming a proposal calls the FR-4 action.
- FR-13: Assistant conversations are kept in the browser tab only and resent with each turn. They are not stored on the server in v1.
- FR-13a: AI is optional. When claude-pool is busy (exit `75`) or fails, every task still works by hand: manual intentions, `Vpiši ročno` for bulletins, and screen actions instead of chat.
- FR-14: The public site reads masses, intentions, bulletins, events and Verouk from Postgres through `web/src/lib/data/*`. Every editor write calls `revalidateTag` for the affected tag.
- FR-15: Uploads are stored on disk under `UPLOAD_DIR`, up to 20 MB, as jpeg/png/heic/webp/pdf/xlsx/csv/ods. They are served to the editor only, never publicly.
- FR-16: The UI is in Slovenian, follows prototype C, has 44 px minimum tap targets, and has a per-user "Večje črke" setting (root font size 112.5 %) stored on the user row.
- FR-17: Times are shown as `18.30` and dates as `sreda, 28. oktober`, using the existing helpers in `web/src/lib/dates.ts`. A week reads `25.–31. oktober` (`formatWeekSpan`) on both sides; short days in tight rows read `tor 3. nov` (`formatDayShort`). Churches use the short name (`Marijina cerkev`) in lists, rows and pills, and the full name only on the church's own page and church headings.

## 5. Non-goals (v1)

- Editing content that stays in Sanity for now: articles, galleries, pages, sacraments, documents, parish groups, settings, churches and the regular schedule. These are seeded once and are not editable in the new editor until v2.
- Email-in channel (`oznanila@…` → draft).
- Push or email notifications for pending approvals. The badge on Domov is the signal in v1.
- Storing chat history, voice dictation, multi-parish support.
- The editor working offline.

## 6. Design considerations

- **Prototype:** `tasks/prototype-editor.html` (local file; the earlier published artifact was deleted by the user). **Chosen variant: C (Opravila)**. The user asked for "the UI of the whole app completely polished". The prototype covers every screen: Domov, Maše in nameni (edit and "Na strani" preview), Mass panel, Oznanila list, upload → reading → review → published/error, Dogodki, Verouk, Ljudje in dostop, Zgodovina, assistant panel, login, profile with "Večje črke", and the phone tab bar.
- **States shown in the prototype:** empty week, Claude reading, flagged fields, unreadable file, a helper's change waiting for the priest, restricted view (catechist), all done ("Vse je urejeno."), login and link sent, desktop and phone, light and dark.
- **Skipped states:** pagination (lists are at most a few dozen rows per week or month) and long content (intention text is limited to 200 characters, and wrapping is already exercised by `iz družin Pretnar in Jesihar`).
- **Tokens:** reuse `web/src/app/globals.css` (paper/stone/moss/gold, Newsreader and Source Sans 3). The handwriting face Caveat is used only on the source-sheet preview of mock fixtures. A real upload shows the photo.
- **Reuse:** `MassRow`/`ChurchPill`/`StatusPill` styling from `web/src/components/masses/MassList.tsx` for the "Na strani" preview, so the preview really matches the site.
- The prototype is binding: the implementation must match its layout, copy, type scale and states. "Close enough" is a defect.

## 7. Technical considerations

- **Stack:** one Next.js 16 app (`web/`) serves both hosts. Admin routes live in `src/app/(admin)`. Data: Postgres 17 + Drizzle ORM + drizzle-kit migrations. Auth: Better Auth with the magic-link plugin and the Google provider. Mail: the existing Resend adapter (`src/lib/mail.ts`). AI: `claude-pool` over the Claude Code CLI, called from the server (FR-9).
- **Tables:**
  - `users` (name, email, title, is_owner, requires_approval, big_text, invited_at, disabled_at, last_seen_at) and `user_sections`, plus Better Auth's `session`, `account`, `verification`;
  - `churches`, `mass_schedule_entries`, `mass_day_overrides`, `masses` (date, time, church_id, type, status, cancel_reason, source, edited_at) and `intentions` (mass_id, kind, text, position, moved_from_mass_id);
  - `events`, `catechesis_groups`, `catechesis_cancellations`;
  - `bulletins` (week_start unique, status, upload_id, draft jsonb, published_at/by) and `bulletin_notices`;
  - `uploads`, `change_requests` (section, action, target, payload jsonb, status, created_by, decided_by), `history` (user_id, section, label, changes jsonb, created_at).
- **AI provider:** claude-pool, by the user's decision. It uses the pooled subscription accounts' usage, so there is no per-token bill.
  - Known risk: claude-pool's own README says using several accounts to get around usage limits breaks Anthropic's terms. If those accounts are restricted, the AI features stop.
  - FR-13a keeps the editor fully usable without AI.
  - Expect each call to take 5–30 s, including CLI start-up. The UI shows the reading state for the whole call.
- **Privacy:** intentions name deceased and living people. Pool tokens stay on the host (`/etc/claude-pool`, mode 2770), never in the image or the repo. Uploads aren't public. Backups go to the off-site target named in Open questions.
- **Prompt injection:** uploaded files and chat text are data. The bulletin run can only `Read` its temp directory, the chat run has no tools at all, and every proposal is re-checked on the server before it can be confirmed.
- **Migration order:**
  1. DB and seed;
  2. editor behind `admin.` with real data;
  3. switch the public pages to the new data layer, one route at a time;
  4. remove the GROQ queries for the moved types;
  5. hide the moved types in Sanity Studio.
- **Testing (new to this repo):**
  - Vitest for `[unit]` and `[integration]`. Integration tests run against a real Postgres from `compose.test.yml`, truncated between tests, with `runClaude` and the mail adapter mocked.
  - dev-browser for `[browser]`.
  - Real-model checks are separate npm scripts (`eval:bulletin`, `eval:assistant`) that spawn the real `claude-pool`. They never run in CI.

## 8. Success metrics

- The priest publishes 4 weekly bulletins in a row from phone photos with no help.
- The median time from upload to published is under 3 minutes.
- Zero wrong names or times reach the public site in the first 2 months: every reading error is caught by a flag or by the person checking.
- Marta and Ana each complete their first task without asking how.

## 9. Open questions

- Off-site backup target: another server, Backblaze B2, or the priest's Google Drive?
- Should the public website show the bulletin's notices as text, the uploaded PDF, or both?
- Sanity content outside the editor (articles, galleries, pages): move to Postgres in v2, or keep Sanity for those long term?
- Does `admin.<domain>` need to be hidden from search engines beyond `noindex` (for example, IP allow-listing)? We assume no.
- Who should get the approval badge if the priest is away for weeks: a second owner, or a delegate role?

## 10. Verification checklist

### Per-change coverage

**Change 1: Sign-in (US-002)**
- [ ] Frontend: email field, `Pošlji povezavo`, Google button, `Preverite e-pošto` state
- [ ] Validation: an invalid email blocks submit; an unknown email sends nothing but gives the same response
- [ ] Backend: one `verification` row per request; the token is single use and expires after 15 minutes
- [ ] Round-trip: link → session → Domov; reload keeps the session
- [ ] Edge cases: reused link, expired link, disabled user
- [ ] Role scoping: N/A (applies before sections)

**Change 2: Intentions and Mass status (US-006, US-007)**
- [ ] Frontend: Mass panel, kind chips, `Odpovej mašo`, intention choice
- [ ] Validation: empty text, more than 200 characters, a missing intention choice on cancel
- [ ] Backend: `intentions` row or `change_requests` row depending on `requires_approval`
- [ ] Round-trip: add → reload `/teden` → still there; public page after revalidate
- [ ] Edge cases: cancel a Mass with 2 intentions; approve after the target was cancelled
- [ ] Role scoping: Ana gets `forbidden`; Marta is pending; Blaž publishes

**Change 3: Bulletin pipeline (US-008)**
- [ ] Frontend: 4-step indicator, reading state, numbered flags, disabled publish, error card
- [ ] Validation: size and type limits; publishing with open flags
- [ ] Backend: upload stored with sha256; draft JSON; schedule-mismatch flags; publish writes 8 intentions and 3 notices
- [ ] Round-trip: publish → `/teden?w=2026-11-01` → public `/oznanila`
- [ ] Edge cases: unreadable fixture; xlsx fixture; a re-upload for the same week replaces the draft but not a published bulletin
- [ ] Role scoping: Marta → change request; Ana can't see the route

**Change 4: Events (US-009)**, **Change 5: Verouk (US-010)**, **Change 6: People (US-011)**, **Change 7: History and undo (US-012)**, **Change 8: Assistant (US-013)**, **Change 9: Public data layer (US-014)**
- [ ] Each change has frontend, validation, backend, round-trip, edge-case and role-scoping criteria in its story above, each with a matching test file

### Test data setup

`npm run db:seed:test` creates exactly the following. The clock is fixed to 2026-10-27 10:00.

- **Churches:** 3. **Schedule entries:** 6, as in `studio/scripts/seed-parish-data.ts`.
- **Masses:** 16, covering 2026-10-25 … 2026-11-07 (two Sunday–Saturday weeks).
  - Week 1 has 6 published intentions from the October bulletin (Monday to Saturday).
  - Week 2 has none published, and 1 pending (`Ivana Kos`, 2026-11-01 08:00, created by Marta).
- **Users:**
  - `blaz@example.com`: owner;
  - `marta@example.com`: mase, oznanila, dogodki; requires approval;
  - `ana@example.com`: verouk;
  - `tone@example.com`: dogodki, invited, never signed in;
  - `disabled@example.com`: disabled.
- **Events:** 4 (1, 2, 7 and 13 November). The 7 November event is pending, created by Marta.
- **Verouk:** 3 groups, on Tuesday 16.00, Wednesday 16.30 and Friday 17.30.
- **Bulletins:**
  - week 2026-10-18: published;
  - week 2026-10-25: published;
  - week 2026-11-01: no row, so it counts as missing.
- **Fixtures:**
  - `oznanila-rokopis.jpg` and `extract-rokopis.json` (2 flags);
  - `oznanila.pdf` and `extract-pdf.json` (0 flags);
  - `nameni.xlsx`;
  - `zamegljena.jpg` and `extract-unreadable.json`.
- **Divergent counts:**
  - approvals for Blaž = 2, for Marta = 0;
  - masses without intention still ahead this week = 0;
  - next week = 8.
- **Cleanup:** the test database is truncated per test file. The dev seed persists.

### Browser end-to-end

- [ ] Seed per above; run with `TEST_NOW=2026-10-27T10:00:00+01:00`
- [ ] Every `[browser]` criterion driven in dev-browser, with the DOM asserted, zero console errors and network 2xx
- [ ] Happy path:
  1. Marta adds `Ana Kos`.
  2. Blaž approves it, then uploads the handwritten fixture, resolves 2 flags and publishes.
  3. The public `/svete-mase` shows week 2 with `Jože Novak`.
  4. Ana cancels the Wednesday lesson, and public `/verouk` shows the message.
- [ ] Visual parity against `tasks/prototype-editor.html`, variant C, at 1440px and 390px. For each screen (Domov, Teden, Mass panel, upload review, Dogodki, Verouk, Ljudje, Zgodovina, assistant, login), report section order, copy, type scale, spacing, colors and empty states as matching or differing.

### Suite gates

- [ ] `npm run test` (Vitest unit + integration) passes in `web/`
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Evidence reported as test output and dev-browser assertions, not "looks good"
