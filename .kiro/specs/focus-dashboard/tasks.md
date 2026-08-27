# Implementation Plan: Focus Dashboard

## Overview

Build a standalone, client-side productivity dashboard using plain HTML, CSS, and Vanilla JavaScript. The application is a single `index.html` at the project root that loads `css/style.css` and `js/app.js`. All state is persisted in the browser's LocalStorage via `StorageModule`. No build step, no external dependencies, no frameworks.

Implementation progresses in eight phases: scaffold → StorageModule → ThemeModule → GreetingModule → TimerModule → TodoModule → LinksModule → integration and polish.

---

## Tasks

- [ ] 1. Scaffold project structure and HTML shell
  - [ ] 1.1 Create the folder structure and `index.html`
    - Create root `index.html` with `<!DOCTYPE html>`, `lang="en"`, viewport meta tag
    - Add `<link>` to `css/style.css` and `<script defer src="js/app.js">` in `<head>`
    - Add five semantic section elements: `#greeting`, `#timer`, `#todo`, `#links`, and a `<button id="theme-toggle">` in the header
    - Each section gets the form/button scaffolding referenced by every module (ids: `name-input`, `btn-start`, `btn-stop`, `btn-reset`, `timer-display`, `timer-duration-input`, `todo-form`, `todo-input`, `todo-sort`, `todo-list`, `link-form`, `link-label`, `link-url`, `link-list`, `theme-toggle`)
    - _Requirements: 1.4, 1.5_
    - _Files: `index.html`_

  - [ ] 1.2 Create `css/style.css` with CSS custom properties and base layout
    - Define `:root` with light-theme tokens: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent`, `--border`, `--danger`, `--success`
    - Define `[data-theme="dark"]` override block with dark-theme token values
    - Write base reset, body layout, card styles for each section, button and form element styles, `.error-msg` inline error style, `.done` strike-through style for tasks
    - All colors use `var(--*)` tokens exclusively — no hardcoded hex values
    - _Requirements: 6.1, 6.3_
    - _Files: `css/style.css`_

  - [ ] 1.3 Create `js/app.js` with module stubs and DOMContentLoaded entry point
    - Create empty object stubs for `StorageModule`, `ThemeModule`, `GreetingModule`, `TimerModule`, `TodoModule`, `LinksModule` — each inside an IIFE or block scope to avoid global pollution
    - Write the `init()` function wired to `document.addEventListener('DOMContentLoaded', init)`
    - `init()` body: `StorageModule.loadAll()` → pass values into each module's `init()`
    - _Requirements: 1.1, 1.2_
    - _Files: `js/app.js`_

---

- [ ] 2. Implement `StorageModule`
  - [ ] 2.1 Implement `StorageModule` core methods
    - Define `KEYS` object with fixed key strings: `fd_userName`, `fd_theme`, `fd_todos`, `fd_links`, `fd_timerDuration`
    - Implement `get(key, defaultValue)`: wrap `localStorage.getItem` in `try/catch`; return `JSON.parse(item)` if key exists, else return `defaultValue`; catch any thrown exception and return `defaultValue`
    - Implement `set(key, value)`: wrap `localStorage.setItem(key, JSON.stringify(value))` in `try/catch`; swallow exceptions silently (in-memory state is unaffected)
    - Implement `remove(key)`: wrap `localStorage.removeItem(key)` in `try/catch`
    - Implement `loadAll()`: call `get()` for each key with its typed default (`''`, OS-preferred theme, `25`, `[]`, `[]`)
    - _Requirements: 1.3, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2_
    - _Files: `js/app.js`_

  - [ ]* 2.2 Write property test for `StorageModule` serialization round-trip
    - **Property 20: AppState serialization round-trip** — for any valid AppState value, `set(key, value)` then `get(key, null)` returns a deep-equal value
    - **Property 21: Default values for absent keys** — `get(key, defaultValue)` on an unwritten key returns `defaultValue` without throwing
    - **Property 22: LocalStorage failure isolation** — when `localStorage` throws, `StorageModule` catches and the caller sees no uncaught error
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 1.3, 8.1**
    - _Files: `js/app.test.js` (fast-check)_

  - [ ]* 2.3 Write unit tests for `StorageModule`
    - Test `get` with absent key returns default; with present key returns parsed value
    - Test `set` serializes correctly; test that a throwing `localStorage` does not propagate
    - Test `loadAll` returns all five fields with correct defaults when storage is empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1_
    - _Files: `js/app.test.js`_

---

- [ ] 3. Implement `ThemeModule`
  - [ ] 3.1 Implement `ThemeModule`
    - Implement `getPreferred()`: return `'dark'` if `window.matchMedia('(prefers-color-scheme: dark)').matches`, else `'light'`
    - Implement `apply(theme)`: validate that `theme` is `'light'` or `'dark'` (ignore invalid values); call `document.documentElement.setAttribute('data-theme', theme)`; update `#theme-toggle` `aria-label` (e.g. `"Switch to light mode"`) and inner icon text/class
    - Implement `init(savedTheme)`: call `apply(savedTheme ?? getPreferred())` — no flash because `init` is called before any render
    - Implement `toggle()`: flip `currentTheme`; call `apply()`; call `StorageModule.set(KEYS.THEME, currentTheme)`
    - Bind the `click` event on `#theme-toggle` to `toggle()` inside `init`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
    - _Files: `js/app.js`_

  - [ ]* 3.2 Write property test for `ThemeModule`
    - **Property 15: Theme toggle round-trip** — calling `toggle()` twice from any starting theme restores `currentTheme`, `data-theme`, and persisted value to original
    - **Property 16: Theme persistence on reload** — after `apply(theme)`, `StorageModule.get(KEYS.THEME)` returns that same value
    - **Validates: Requirements 6.3, 6.4**
    - _Files: `js/app.test.js`_

---

- [ ] 4. Implement `GreetingModule`
  - [ ] 4.1 Implement `GreetingModule` core logic
    - Implement `getGreetingPhrase()`: read `new Date().getHours()`; return `"Good night"` (0–5), `"Good morning"` (6–11), `"Good afternoon"` (12–17), `"Good evening"` (18–23)
    - Implement `formatDateTime()`: return `{ time: "HH:MM", date: "Weekday, Month D, YYYY" }` using `Date` methods and `Intl.DateTimeFormat` or manual formatting; zero-pad hours/minutes
    - Implement `render()`: set greeting text via `textContent` using the phrase plus stored name (e.g. `"Good morning, Alice"`); set time and date spans
    - _Requirements: 2.1, 2.2_
    - _Files: `js/app.js`_

  - [ ] 4.2 Implement `GreetingModule` name editing and clock
    - Implement `setUserName(name)`: trim input; if empty/whitespace-only, do nothing and keep previous; otherwise save via `StorageModule.set(KEYS.USER_NAME, trimmed)` and call `render()`
    - Implement `startClock()`: call `setInterval(render, 30_000)` to refresh time/date every 30 seconds
    - Implement `init(userName)`: set internal `currentName = userName`; call `render()`; bind `change` event on `#name-input` to `setUserName`; call `startClock()`
    - _Requirements: 2.3, 2.4, 2.5, 2.6_
    - _Files: `js/app.js`_

  - [ ]* 4.3 Write property test for `GreetingModule`
    - **Property 12: Greeting phrase covers all 24 hours** — for any integer hour in `[0, 23]`, `getGreetingPhrase()` returns exactly one of the four phrases with no overlap
    - **Property 13: DateTime formatter output format** — for any `Date`, `formatDateTime().time` matches `HH:MM` and `.date` matches `Weekday, Month D, YYYY`
    - **Property 14: User name round-trip persistence** — for any non-empty, non-whitespace `name`, after `setUserName(name)` the stored value equals `name.trim()`
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.6**
    - _Files: `js/app.test.js`_

  - [ ]* 4.4 Write unit tests for `GreetingModule`
    - Test all four hour-boundary cases (0, 6, 12, 18) and edge hours (5, 11, 17, 23)
    - Test whitespace-only name is rejected; empty string is rejected; valid name updates state
    - _Requirements: 2.1, 2.5_
    - _Files: `js/app.test.js`_

---

- [ ] 5. Checkpoint — StorageModule, ThemeModule, GreetingModule
  - Ensure all tests pass, ask the user if questions arise.

---

- [ ] 6. Implement `TimerModule`
  - [ ] 6.1 Implement `TimerModule` state and display
    - Define internal state: `{ durationMinutes, secondsLeft, intervalId, isRunning }`
    - Implement `formatMMSS(seconds)`: return zero-padded `MM:SS` string; handle `0 ≤ seconds ≤ 3600`
    - Implement `updateDisplay()`: set `#timer-display` text to `formatMMSS(secondsLeft)`
    - Implement `init(durationMinutes)`: set state, call `updateDisplay()`, bind Start/Stop/Reset button events, bind duration-input change event
    - _Requirements: 3.1, 3.9_
    - _Files: `js/app.js`_

  - [ ] 6.2 Implement `TimerModule` start, stop, reset
    - Implement `start()`: guard if already running; set `isRunning = true`; call `setInterval(tick, 1000)` and store handle in `intervalId`
    - Implement `stop()`: call `clearInterval(intervalId)`; set `isRunning = false`; preserve `secondsLeft`
    - Implement `reset()`: call `stop()`; set `secondsLeft = durationMinutes * 60`; call `updateDisplay()`
    - _Requirements: 3.2, 3.4, 3.5_
    - _Files: `js/app.js`_

  - [ ] 6.3 Implement `TimerModule.tick()` and completion
    - Implement `tick()`: decrement `secondsLeft` by 1; call `updateDisplay()`; update `document.title` to `"(MM:SS) Focus Dashboard"`; if `secondsLeft === 0` call `onComplete()`
    - Implement `onComplete()`: call `clearInterval`; set `isRunning = false`; play audible beep via `AudioContext` (wrap in `try/catch` for browsers without Web Audio API); display completion message in the timer section via `textContent`; reset `document.title` to `"Focus Dashboard"`
    - Clamp `secondsLeft` to `>= 0` as a defensive guard after decrement
    - _Requirements: 3.3, 3.6, 3.9, 8.5_
    - _Files: `js/app.js`_

  - [ ] 6.4 Implement `TimerModule.setDuration()`
    - Implement `setDuration(minutes)`: parse to integer; clamp to `[1, 60]`; if value was clamped, display inline validation message; set `durationMinutes`; call `StorageModule.set(KEYS.TIMER_DURATION, durationMinutes)`; call `reset()`; update duration input value to clamped number
    - Bind the `change` (or `blur`) event on `#timer-duration-input` to `setDuration`
    - _Requirements: 3.7, 3.8_
    - _Files: `js/app.js`_

  - [ ]* 6.5 Write property tests for `TimerModule`
    - **Property 7: Timer tick decrements exactly one per call** — for any state with `isRunning === true` and `secondsLeft > 0`, one `tick()` call decreases `secondsLeft` by exactly 1
    - **Property 8: Timer secondsLeft invariant** — after any sequence of `start()`, `stop()`, `reset()`, `tick()`, `secondsLeft` stays in `[0, durationMinutes × 60]`
    - **Property 9: Duration clamping** — for any numeric input `n`, `setDuration(n)` sets `durationMinutes = clamp(n, 1, 60)` and `secondsLeft = durationMinutes × 60`
    - **Property 10: Timer display format matches state** — for any `secondsLeft` in `[0, 3600]`, `formatMMSS(secondsLeft)` zero-pads both minutes and seconds to two digits
    - **Property 11: Timer title format while running** — while running, `document.title` equals `"(MM:SS) Focus Dashboard"` with matching `formatMMSS`
    - **Validates: Requirements 3.2, 3.5, 3.7, 3.8, 3.9, 3.3, 3.1**
    - _Files: `js/app.test.js`_

  - [ ]* 6.6 Write unit tests for `TimerModule`
    - Test `formatMMSS` at 0, 59, 60, 1499, 1500 seconds
    - Test `reset()` restores `secondsLeft` to `durationMinutes * 60`
    - Test `onComplete()` does not throw when Web Audio API is absent (mock `AudioContext`)
    - _Requirements: 3.1, 3.5, 3.6, 8.5_
    - _Files: `js/app.test.js`_

---

- [ ] 7. Implement `TodoModule`
  - [ ] 7.1 Implement `TodoModule` helpers and state
    - Implement `normalize(text)`: `text.trim().replace(/\s+/g, ' ').toLowerCase()`
    - Implement `isDuplicate(text, excludeId = null)`: iterate `state.todos`; skip task if `task.id === excludeId`; return `true` if `normalize(task.text) === normalize(text)`
    - Implement `generateId()`: use `crypto.randomUUID()` if available, else `Date.now().toString() + Math.random()`
    - Define internal `state.todos` array
    - _Requirements: 4.2, 4.6_
    - _Files: `js/app.js`_

  - [ ] 7.2 Implement `TodoModule.addTask()` and `renderTasks()`
    - Implement `addTask(text)`: trim input; show `"Task cannot be empty"` if blank; call `isDuplicate` and show `"Task already exists"` if true; create `{ id, text: trimmed, done: false, createdAt: Date.now() }`; push to `state.todos`; call `StorageModule.set`; call `renderTasks()`; clear and focus input
    - Implement `renderTasks()`: clear `#todo-list`; for each task create `<li>` with: checkbox (bound to `toggleDone`), `<span>` with `task.text` set via `textContent`, an edit button, a delete button; apply `.done` class if `task.done === true`; append using DOM methods only — no `innerHTML` for user content
    - _Requirements: 4.1, 4.3, 4.4, 4.10_
    - _Files: `js/app.js`_

  - [ ] 7.3 Implement `TodoModule` toggle, delete, and sort
    - Implement `toggleDone(id)`: find task by id; flip `done`; call `StorageModule.set`; call `renderTasks()`
    - Implement `deleteTask(id)`: filter out task with matching id; call `StorageModule.set`; call `renderTasks()`
    - Implement `sortTasks(by)`: `'date'` → sort by `createdAt` ascending; `'name'` → case-insensitive alphabetical by `text`; `'status'` → incomplete tasks first; call `renderTasks()` without persisting sort order
    - Bind `#todo-sort` `change` event to `sortTasks`
    - _Requirements: 4.7, 4.8, 4.9_
    - _Files: `js/app.js`_

  - [ ] 7.4 Implement `TodoModule` inline edit
    - Implement `editTask(id, newText)`: trim `newText`; show error if empty; call `isDuplicate(newText, id)` and show error if duplicate (self-exclusion); update `task.text`; call `StorageModule.set`; call `renderTasks()`
    - In `renderTasks()`, wire the edit button per task: clicking replaces the `<span>` with a pre-filled `<input>`; confirm on Enter key or `blur`; cancel on Escape (restore original text); call `editTask` on confirm
    - _Requirements: 4.5, 4.6_
    - _Files: `js/app.js`_

  - [ ] 7.5 Implement `TodoModule.init()`
    - Set `state.todos = todos` (passed from `StorageModule.loadAll()`)
    - Call `renderTasks()`
    - Bind `#todo-form` `submit` event: `e.preventDefault()`, call `addTask(#todo-input.value)`
    - _Requirements: 4.1_
    - _Files: `js/app.js`_

  - [ ]* 7.6 Write property tests for `TodoModule`
    - **Property 1: No duplicate tasks after addTask** — for any task list and non-empty text, if `addTask(text)` succeeds, `state.todos` contains exactly one task with matching `normalize(text)`
    - **Property 2: Whitespace-only and empty inputs are rejected** — for any all-whitespace string, `addTask` / `editTask` / `setUserName` leave state unchanged
    - **Property 3: Task toggle idempotence** — calling `toggleDone(id)` twice restores `done` to original value; state is persisted after each call
    - **Property 4: Task deletion removes the task** — after `deleteTask(id)`, no task with that id remains in `state.todos`; persisted list reflects removal
    - **Property 5: Sort correctness** — `sortTasks('name')` produces case-insensitive alphabetical order; `'date'` ascending `createdAt`; `'status'` incomplete before complete
    - **Property 6: Edit duplicate prevention excludes self** — proposed `newText` matching a different task is rejected; matching the same task succeeds
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 4.9, 2.5**
    - _Files: `js/app.test.js`_

  - [ ]* 7.7 Write unit tests for `TodoModule`
    - Test `normalize` with extra spaces, tabs, mixed case, leading/trailing whitespace
    - Test `isDuplicate` with empty list, exact match, case-insensitive match, self-exclusion
    - Test `addTask` clears input and returns focus; `deleteTask` reduces list length by 1
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8_
    - _Files: `js/app.test.js`_

---

- [ ] 8. Checkpoint — TimerModule and TodoModule
  - Ensure all tests pass, ask the user if questions arise.

---

- [ ] 9. Implement `LinksModule`
  - [ ] 9.1 Implement `LinksModule` helpers, `addLink()`, and `renderLinks()`
    - Implement `validateUrl(url)`: wrap `new URL(url)` in `try/catch`; return `true` if it does not throw, `false` otherwise
    - Implement `addLink(label, url)`: trim both; if `label` is empty show `"Label cannot be empty"`; call `validateUrl` — if false show `"Please enter a valid URL (include https://)"` ; check if `url` already exists in `state.links` — if so show duplicate error; create `{ id: generateId(), label: trimmed, url }`; push to `state.links`; call `StorageModule.set`; call `renderLinks()`
    - Implement `renderLinks()`: clear `#link-list`; for each link create an `<a>` element; set `href` from stored (validated) URL only; set `target="_blank" rel="noopener noreferrer"`; set `textContent = link.label` (no `innerHTML`); add delete button bound to `deleteLink(link.id)`; append to `#link-list`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 8.3, 8.4_
    - _Files: `js/app.js`_

  - [ ] 9.2 Implement `LinksModule.deleteLink()` and `init()`
    - Implement `deleteLink(id)`: filter out link with matching id; call `StorageModule.set`; call `renderLinks()`
    - Implement `init(links)`: set `state.links = links`; call `renderLinks()`; bind `#link-form` `submit` event: `e.preventDefault()`, call `addLink(#link-label.value, #link-url.value)`
    - _Requirements: 5.6_
    - _Files: `js/app.js`_

  - [ ]* 9.3 Write property tests for `LinksModule`
    - **Property 17: URL validation rejects non-parseable URLs** — for any string where `new URL(url)` throws, `addLink` does not mutate `state.links`
    - **Property 18: Duplicate URL rejection** — for any URL already in `state.links`, `addLink` with the same URL leaves `state.links` unchanged
    - **Property 19: Link deletion removes the link** — after `deleteLink(id)`, no link with that id remains in `state.links`; persisted list reflects removal
    - **Validates: Requirements 5.2, 5.3, 5.6**
    - _Files: `js/app.test.js`_

  - [ ]* 9.4 Write unit tests for `LinksModule`
    - Test `validateUrl` with valid `https://` URLs, `http://` URLs, missing protocol, empty string, and gibberish
    - Test `addLink` with empty label; with duplicate URL; with a valid new link (list length increases by 1)
    - _Requirements: 5.2, 5.4_
    - _Files: `js/app.test.js`_

---

- [ ] 10. Integration wiring and polish
  - [ ] 10.1 Wire all modules in `init()` and verify event bindings
    - Confirm `init()` calls each module's `init()` in the correct order: `ThemeModule` first (before render to avoid theme flash), then `GreetingModule`, `TimerModule`, `TodoModule`, `LinksModule`
    - Verify all DOM element ids in `index.html` match the ids referenced in `js/app.js`
    - Ensure `document.title` resets to `"Focus Dashboard"` when the timer is not running
    - _Requirements: 1.1, 1.2, 1.4_
    - _Files: `index.html`, `js/app.js`_

  - [ ] 10.2 Apply XSS prevention audit and security hardening
    - Audit every DOM write in all six modules — replace any `innerHTML` usage on user-supplied data with `textContent` or safe DOM construction
    - Confirm `LinksModule.renderLinks()` only places the stored (already-validated) URL into `href`, never raw user input
    - Confirm no use of `eval`, `Function()`, or dynamic `<script>` injection anywhere in `app.js`
    - _Requirements: 4.10, 5.7, 8.3, 8.4_
    - _Files: `js/app.js`_

  - [ ] 10.3 Apply error-handling and graceful degradation
    - Confirm all `localStorage` calls are inside `try/catch` in `StorageModule`
    - Confirm `AudioContext` / `onComplete` beep is inside `try/catch` with silent failure
    - Confirm the app renders and operates normally when `localStorage` throws on every call (test by temporarily overriding `localStorage.setItem` in DevTools)
    - Add a `noscript` message in `index.html` for browsers with JS disabled
    - _Requirements: 8.1, 8.2, 8.5_
    - _Files: `index.html`, `js/app.js`_

  - [ ]* 10.4 Write integration tests for full-session flows
    - Test: add 3 tasks → reload (simulate via `StorageModule.loadAll()`) → all 3 tasks present
    - Test: set timer to 1 min → start → tick 60 times → `onComplete` fires; `secondsLeft === 0`
    - Test: add link → reload → link present; delete link → reload → link absent
    - Test: set theme to dark → reload → `data-theme === 'dark'`
    - _Requirements: 1.1, 1.2, 3.6, 4.1, 5.6, 6.4, 7.1_
    - _Files: `js/app.test.js`_

---

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The design uses Vanilla JavaScript — no TypeScript, no npm, no framework
- fast-check is listed in the design's testing strategy for property tests; include it only if tests are added (it can be loaded from a CDN in a test HTML file or via a `<script>` tag for browser-based testing)
- All correctness properties from the design document (Properties 1–22) are covered by the property test sub-tasks above
- Checkpoints at tasks 5, 8, and 11 provide incremental validation gates
- Because `js/app.js` is the single code file, most tasks modify it; `index.html` and `css/style.css` are only touched during the scaffold phase (task 1) and final wiring (task 10.1)
- `generateId()` is shared between `TodoModule` and `LinksModule` — implement it once as a top-level helper inside `app.js`

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2"] },
    { "id": 7, "tasks": ["6.3"] },
    { "id": 8, "tasks": ["6.4"] },
    { "id": 9, "tasks": ["6.5", "6.6", "7.1"] },
    { "id": 10, "tasks": ["7.2"] },
    { "id": 11, "tasks": ["7.3"] },
    { "id": 12, "tasks": ["7.4"] },
    { "id": 13, "tasks": ["7.5"] },
    { "id": 14, "tasks": ["7.6", "7.7", "9.1"] },
    { "id": 15, "tasks": ["9.2"] },
    { "id": 16, "tasks": ["9.3", "9.4", "10.1"] },
    { "id": 17, "tasks": ["10.2", "10.3"] },
    { "id": 18, "tasks": ["10.4"] }
  ]
}
```
