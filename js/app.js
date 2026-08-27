/**
 * Focus Dashboard — app.js
 *
 * All application logic lives here, organised into six plain-object modules:
 *   StorageModule   – LocalStorage read / write with error isolation
 *   ThemeModule     – Light / dark theme toggle
 *   GreetingModule  – Time-aware greeting + live clock + user name
 *   TimerModule     – Pomodoro countdown timer
 *   TodoModule      – Task CRUD with duplicate prevention and sort
 *   LinksModule     – Quick-access URL buttons
 *
 * Rules enforced throughout:
 *   • Every localStorage call is inside try/catch
 *   • All user-supplied content written via element.textContent (never innerHTML)
 *   • Link href is set only from the already-validated stored URL
 *   • No eval, no Function(), no dynamic <script> injection
 */

'use strict';

/* ============================================================
   SHARED HELPER — generateId
   Used by TodoModule and LinksModule.
   ============================================================ */

/**
 * Returns a unique string ID.
 * Prefers crypto.randomUUID() when available; falls back to a
 * timestamp + random-number combination.
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/* ============================================================
   MODULE 1 — StorageModule
   Single access point for all LocalStorage I/O.
   Every operation is wrapped in try/catch; errors are silently
   swallowed so the rest of the app continues with in-memory state.
   ============================================================ */

const StorageModule = (() => {

  /** Fixed key names — these never change. */
  const KEYS = Object.freeze({
    USER_NAME:      'fd_userName',
    THEME:          'fd_theme',
    TODOS:          'fd_todos',
    LINKS:          'fd_links',
    TIMER_DURATION: 'fd_timerDuration',
  });

  /**
   * Read a value from LocalStorage.
   * @param {string} key
   * @param {*} defaultValue - Returned when the key is absent or an error occurs.
   * @returns {*} Parsed value or defaultValue.
   */
  function get(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (_err) {
      return defaultValue;
    }
  }

  /**
   * Write a value to LocalStorage (JSON-serialised).
   * Errors are silently caught; in-memory state is unaffected.
   * @param {string} key
   * @param {*} value
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_err) {
      // Storage unavailable (e.g. private mode quota) — continue silently.
    }
  }

  /**
   * Remove a key from LocalStorage.
   * @param {string} key
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_err) {
      // Ignore.
    }
  }

  /**
   * Load all persisted values at once, supplying typed defaults for any
   * key that has never been written.
   *
   * The 'theme' default is determined by the OS preference at call-time via
   * a lightweight media-query check (ThemeModule is not yet initialised here,
   * so we inline the logic).
   *
   * @returns {{ userName:string, theme:string, timerDuration:number, todos:Array, links:Array }}
   */
  function loadAll() {
    const osPrefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    return {
      userName:      get(KEYS.USER_NAME,      ''),
      theme:         get(KEYS.THEME,          osPrefersDark ? 'dark' : 'light'),
      timerDuration: get(KEYS.TIMER_DURATION, 25),
      todos:         get(KEYS.TODOS,          []),
      links:         get(KEYS.LINKS,          []),
    };
  }

  return { KEYS, get, set, remove, loadAll };
})();

/* ============================================================
   MODULE 2 — ThemeModule
   Controls the light / dark theme by toggling the data-theme
   attribute on <html>.  Must be initialised FIRST to prevent
   a flash of the wrong theme.
   ============================================================ */

const ThemeModule = (() => {

  let currentTheme = 'light';

  /**
   * Read the OS colour-scheme preference.
   * @returns {'light'|'dark'}
   */
  function getPreferred() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * Apply a theme to the document.
   * Also updates the toggle button's aria-label and icon.
   * Invalid values are silently ignored (per Requirement 6.5).
   * @param {'light'|'dark'} theme
   */
  function apply(theme) {
    if (theme !== 'light' && theme !== 'dark') return;

    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    const btn  = document.getElementById('theme-toggle');
    const icon = btn && btn.querySelector('.theme-icon');

    if (theme === 'dark') {
      if (btn)  btn.setAttribute('aria-label', 'Switch to light mode');
      if (icon) icon.textContent = '☀️';
    } else {
      if (btn)  btn.setAttribute('aria-label', 'Switch to dark mode');
      if (icon) icon.textContent = '🌙';
    }
  }

  /**
   * Toggle between light and dark, then persist.
   */
  function toggle() {
    const next = currentTheme === 'light' ? 'dark' : 'light';
    apply(next);
    StorageModule.set(StorageModule.KEYS.THEME, next);
  }

  /**
   * Initialise the module.
   * Applies the saved theme (or OS preference) and wires the toggle button.
   * @param {string|null} savedTheme
   */
  function init(savedTheme) {
    apply(savedTheme || getPreferred());

    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, toggle, apply, getPreferred };
})();

/* ============================================================
   MODULE 3 — GreetingModule
   Displays a time-aware greeting, a live clock (refreshed every
   30 s), and the user's saved name.
   ============================================================ */

const GreetingModule = (() => {

  let currentName = '';

  /**
   * Return a greeting phrase based on the current hour.
   * 0–5   → "Good night"
   * 6–11  → "Good morning"
   * 12–17 → "Good afternoon"
   * 18–23 → "Good evening"
   * @returns {string}
   */
  function getGreetingPhrase() {
    const hour = new Date().getHours();
    if (hour >= 0  && hour <= 5)  return 'Good night';
    if (hour >= 6  && hour <= 11) return 'Good morning';
    if (hour >= 12 && hour <= 17) return 'Good afternoon';
    return 'Good evening';
  }

  /**
   * Format the current date and time.
   * @returns {{ time: string, date: string }}
   *   time  — "HH:MM" (24-hour, zero-padded)
   *   date  — "Weekday, Month D, YYYY"
   */
  function formatDateTime() {
    const now  = new Date();
    const hh   = String(now.getHours()).padStart(2, '0');
    const mm   = String(now.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;

    const date = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });

    return { time, date };
  }

  /**
   * Update the greeting section DOM with current phrase, name, time, date.
   * All writes use textContent — never innerHTML.
   */
  function render() {
    const phrase = getGreetingPhrase();
    const { time, date } = formatDateTime();

    const elPhrase = document.getElementById('greeting-phrase');
    const elName   = document.getElementById('greeting-name');
    const elTime   = document.getElementById('greeting-time');
    const elDate   = document.getElementById('greeting-date');

    if (elPhrase) elPhrase.textContent = phrase;
    if (elTime)   elTime.textContent   = time;
    if (elDate)   elDate.textContent   = date;

    if (elName) {
      elName.textContent = currentName ? `, ${currentName}` : '';
    }
  }

  /**
   * Validate and save the user's name.
   * Whitespace-only strings are silently rejected (Requirement 2.5).
   * @param {string} name
   */
  function setUserName(name) {
    const trimmed = name.trim();
    if (trimmed.length === 0) return; // reject empty / whitespace-only

    currentName = trimmed;
    StorageModule.set(StorageModule.KEYS.USER_NAME, trimmed);
    render();
  }

  /**
   * Start a 30-second interval to keep the clock up-to-date.
   */
  function startClock() {
    setInterval(render, 30_000);
  }

  /**
   * Initialise the module.
   * @param {string} userName – Saved name from StorageModule.
   */
  function init(userName) {
    currentName = (userName || '').trim();
    render();

    const nameInput = document.getElementById('name-input');
    if (nameInput) {
      // Pre-fill the input with the stored name so the user can see it.
      nameInput.value = currentName;
      nameInput.addEventListener('change', (e) => setUserName(e.target.value));
    }

    startClock();
  }

  return { init, getGreetingPhrase, formatDateTime, setUserName, render };
})();

/* ============================================================
   MODULE 4 — TimerModule
   Pomodoro countdown timer with start / stop / reset.
   Ticks once per second, updates the document title while
   running, plays an AudioContext beep on completion.
   ============================================================ */

const TimerModule = (() => {

  // Internal state
  const state = {
    durationMinutes: 25,
    secondsLeft:     1500,  // 25 * 60
    intervalId:      null,
    isRunning:       false,
  };

  /**
   * Format a total number of seconds as zero-padded MM:SS.
   * Accepts values in [0, 3600].
   * @param {number} totalSeconds
   * @returns {string}
   */
  function formatMMSS(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  /** Write the current secondsLeft to the #timer-display element. */
  function updateDisplay() {
    const el = document.getElementById('timer-display');
    if (el) el.textContent = formatMMSS(state.secondsLeft);
  }

  /** Show or clear a message in the #timer-msg element. */
  function showMsg(text) {
    const el = document.getElementById('timer-msg');
    if (el) el.textContent = text;
  }

  /**
   * Play a short audible beep via the Web Audio API.
   * Entire call is wrapped in try/catch so absence of AudioContext
   * never crashes the app (Requirement 8.5).
   */
  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx        = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type            = 'sine';
      oscillator.frequency.value = 880; // A5 note

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.8);

      // Close the context after the beep finishes to free resources.
      oscillator.addEventListener('ended', () => { ctx.close(); });
    } catch (_err) {
      // Web Audio API unavailable — continue silently.
    }
  }

  /**
   * Called when the countdown reaches zero.
   * Cleans up the interval, plays a beep, shows a notification,
   * and resets the document title.
   */
  function onComplete() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning  = false;

    playBeep();
    showMsg('🎉 Session complete! Take a break.');
    document.title = 'Focus Dashboard';
  }

  /**
   * One tick of the countdown — called every 1 000 ms by setInterval.
   * Decrements secondsLeft, updates the display and document title.
   * Guards secondsLeft >= 0 at all times (Requirement 3.9).
   */
  function tick() {
    state.secondsLeft = Math.max(0, state.secondsLeft - 1);

    updateDisplay();
    document.title = `(${formatMMSS(state.secondsLeft)}) Focus Dashboard`;

    if (state.secondsLeft === 0) {
      onComplete();
    }
  }

  /** Start the countdown. Guard against double-start. */
  function start() {
    if (state.isRunning) return;
    state.isRunning = true;
    showMsg(''); // clear any previous completion message
    state.intervalId = setInterval(tick, 1000);
  }

  /**
   * Stop (pause) the countdown.
   * secondsLeft is preserved so the timer can be resumed.
   */
  function stop() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning  = false;
  }

  /** Reset to the full duration. */
  function reset() {
    stop();
    state.secondsLeft = state.durationMinutes * 60;
    updateDisplay();
    showMsg('');
    document.title = 'Focus Dashboard';
  }

  /**
   * Accept a new duration in minutes.
   * Values outside [1, 60] are clamped with a visible warning.
   * @param {number|string} minutes
   */
  function setDuration(minutes) {
    let n = parseInt(minutes, 10);

    if (isNaN(n)) n = 1;

    const clamped = Math.min(60, Math.max(1, n));

    if (clamped !== n) {
      showMsg(`Duration clamped to ${clamped} minute${clamped === 1 ? '' : 's'}.`);
    } else {
      showMsg('');
    }

    // Update the input field to reflect the clamped value.
    const input = document.getElementById('timer-duration-input');
    if (input) input.value = clamped;

    state.durationMinutes = clamped;
    StorageModule.set(StorageModule.KEYS.TIMER_DURATION, clamped);
    reset();
  }

  /**
   * Initialise the module.
   * @param {number} durationMinutes – Saved duration from StorageModule.
   */
  function init(durationMinutes) {
    state.durationMinutes = Math.min(60, Math.max(1, Number(durationMinutes) || 25));
    state.secondsLeft     = state.durationMinutes * 60;
    state.isRunning       = false;
    state.intervalId      = null;

    updateDisplay();

    // Pre-fill the duration input.
    const durInput = document.getElementById('timer-duration-input');
    if (durInput) {
      durInput.value = state.durationMinutes;
      // 'change' fires when the user commits (Tab, Enter, click away).
      durInput.addEventListener('change', (e) => setDuration(e.target.value));
    }

    const btnStart = document.getElementById('btn-start');
    const btnStop  = document.getElementById('btn-stop');
    const btnReset = document.getElementById('btn-reset');

    if (btnStart) btnStart.addEventListener('click', start);
    if (btnStop)  btnStop.addEventListener('click', stop);
    if (btnReset) btnReset.addEventListener('click', reset);
  }

  return { init, start, stop, reset, tick, setDuration, formatMMSS, updateDisplay };
})();

/* ============================================================
   MODULE 5 — TodoModule
   Full CRUD task list with duplicate prevention and three
   sort modes.  Inline editing is supported.
   ============================================================ */

const TodoModule = (() => {

  const state = { todos: [] };

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Canonical form for duplicate comparison.
   * Trims, collapses internal whitespace, lowercases.
   * @param {string} text
   * @returns {string}
   */
  function normalize(text) {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Check whether a normalised version of `text` already exists
   * in the task list, optionally excluding a task by id (for edits).
   * @param {string} text
   * @param {string|null} excludeId
   * @returns {boolean}
   */
  function isDuplicate(text, excludeId) {
    const n = normalize(text);
    return state.todos.some(
      (t) => t.id !== excludeId && normalize(t.text) === n
    );
  }

  /** Persist the current task list to LocalStorage. */
  function persist() {
    StorageModule.set(StorageModule.KEYS.TODOS, state.todos);
  }

  /** Show or clear the inline error below the todo form. */
  function showError(msg) {
    const el = document.getElementById('todo-error');
    if (el) el.textContent = msg;
  }

  // ── Render ───────────────────────────────────────────────

  /**
   * Rebuild the #todo-list from state.todos.
   * Respects the currently selected sort option.
   * All user content is written via textContent.
   */
  function renderTasks() {
    const list = document.getElementById('todo-list');
    if (!list) return;

    // Build a working copy sorted according to the sort control.
    const sortEl  = document.getElementById('todo-sort');
    const sortBy  = sortEl ? sortEl.value : 'date';
    const sorted  = [...state.todos];

    if (sortBy === 'name') {
      sorted.sort((a, b) =>
        normalize(a.text).localeCompare(normalize(b.text))
      );
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => Number(a.done) - Number(b.done));
    } else {
      // 'date' — ascending by createdAt
      sorted.sort((a, b) => a.createdAt - b.createdAt);
    }

    // Clear existing items.
    while (list.firstChild) list.removeChild(list.firstChild);

    sorted.forEach((task) => {
      const li       = document.createElement('li');
      li.className   = 'task-item' + (task.done ? ' done' : '');
      li.dataset.id  = task.id;

      // Checkbox
      const checkbox    = document.createElement('input');
      checkbox.type     = 'checkbox';
      checkbox.checked  = task.done;
      checkbox.setAttribute('aria-label', `Mark "${task.text}" as ${task.done ? 'incomplete' : 'complete'}`);
      checkbox.addEventListener('change', () => toggleDone(task.id));

      // Text span
      const textSpan       = document.createElement('span');
      textSpan.className   = 'task-text';
      textSpan.textContent = task.text; // textContent — never innerHTML

      // Action buttons container
      const actions     = document.createElement('div');
      actions.className = 'task-actions';

      // Edit button
      const editBtn       = document.createElement('button');
      editBtn.className   = 'btn btn-edit';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('aria-label', `Edit task: ${task.text}`);
      editBtn.addEventListener('click', () => startInlineEdit(li, task));

      // Delete button
      const delBtn       = document.createElement('button');
      delBtn.className   = 'btn btn-danger';
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('aria-label', `Delete task: ${task.text}`);
      delBtn.addEventListener('click', () => deleteTask(task.id));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(checkbox);
      li.appendChild(textSpan);
      li.appendChild(actions);

      list.appendChild(li);
    });
  }

  // ── Inline edit ──────────────────────────────────────────

  /**
   * Replace the task text span with an editable <input>.
   * Confirm on Enter or blur; cancel on Escape.
   * @param {HTMLElement} li   - The list item element.
   * @param {Object}      task - The task object.
   */
  function startInlineEdit(li, task) {
    // Find or bail on the text span.
    const textSpan = li.querySelector('.task-text');
    if (!textSpan) return;

    const input       = document.createElement('input');
    input.type        = 'text';
    input.className   = 'task-edit-input';
    input.value       = task.text;
    input.maxLength   = 200;
    input.setAttribute('aria-label', 'Edit task text');

    // Swap span for input.
    li.replaceChild(input, textSpan);
    input.focus();
    input.select();

    let committed = false;

    function commit() {
      if (committed) return;
      committed = true;
      editTask(task.id, input.value);
    }

    function cancel() {
      if (committed) return;
      committed = true;
      renderTasks(); // re-render restores original text
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    input.addEventListener('blur', commit);
  }

  // ── CRUD operations ───────────────────────────────────────

  /**
   * Add a new task.
   * Validates non-empty and duplicate (normalised comparison).
   * @param {string} text
   */
  function addTask(text) {
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      showError('Task cannot be empty');
      return;
    }

    if (isDuplicate(trimmed, null)) {
      showError('Task already exists');
      return;
    }

    showError(''); // clear any previous error

    const task = {
      id:        generateId(),
      text:      trimmed,
      done:      false,
      createdAt: Date.now(),
    };

    state.todos.push(task);
    persist();
    renderTasks();

    // Clear and refocus the input (Requirement 4.4).
    const input = document.getElementById('todo-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  /**
   * Confirm an inline edit.
   * Validates non-empty, and duplicate (excluding the task itself).
   * @param {string} id
   * @param {string} newText
   */
  function editTask(id, newText) {
    const trimmed = newText.trim();

    if (trimmed.length === 0) {
      showError('Task cannot be empty');
      renderTasks(); // restore original display
      return;
    }

    if (isDuplicate(trimmed, id)) {
      showError('Task already exists');
      renderTasks();
      return;
    }

    showError('');

    const task = state.todos.find((t) => t.id === id);
    if (task) {
      task.text = trimmed;
      persist();
      renderTasks();
    }
  }

  /**
   * Toggle the done flag for a task.
   * @param {string} id
   */
  function toggleDone(id) {
    const task = state.todos.find((t) => t.id === id);
    if (!task) return;

    task.done = !task.done;
    persist();
    renderTasks();
  }

  /**
   * Remove a task by id.
   * @param {string} id
   */
  function deleteTask(id) {
    state.todos = state.todos.filter((t) => t.id !== id);
    persist();
    renderTasks();
  }

  /**
   * Sort the in-memory list and re-render.
   * Sort order is NOT persisted (Requirement 4.9).
   * @param {'date'|'name'|'status'} by
   */
  function sortTasks(by) {
    if (by === 'name') {
      state.todos.sort((a, b) =>
        normalize(a.text).localeCompare(normalize(b.text))
      );
    } else if (by === 'status') {
      state.todos.sort((a, b) => Number(a.done) - Number(b.done));
    } else {
      state.todos.sort((a, b) => a.createdAt - b.createdAt);
    }
    renderTasks();
  }

  /**
   * Initialise the module.
   * @param {Array} todos – Saved tasks from StorageModule.
   */
  function init(todos) {
    state.todos = Array.isArray(todos) ? todos : [];
    renderTasks();

    const form = document.getElementById('todo-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('todo-input');
        addTask(input ? input.value : '');
      });
    }

    const sortSel = document.getElementById('todo-sort');
    if (sortSel) {
      sortSel.addEventListener('change', (e) => sortTasks(e.target.value));
    }
  }

  return {
    init,
    addTask,
    editTask,
    toggleDone,
    deleteTask,
    sortTasks,
    normalize,
    isDuplicate,
    renderTasks,
  };
})();

/* ============================================================
   MODULE 6 — LinksModule
   Quick-access link buttons that open in a new tab.
   URLs are validated before storage; link href is set only
   from the already-validated stored URL.
   ============================================================ */

const LinksModule = (() => {

  const state = { links: [] };

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Check whether a URL string is parseable by the URL constructor.
   * @param {string} url
   * @returns {boolean}
   */
  function validateUrl(url) {
    try {
      new URL(url); // throws if invalid
      return true;
    } catch (_err) {
      return false;
    }
  }

  /** Persist the current link list. */
  function persist() {
    StorageModule.set(StorageModule.KEYS.LINKS, state.links);
  }

  /** Show or clear the link-form error message. */
  function showError(msg) {
    const el = document.getElementById('link-error');
    if (el) el.textContent = msg;
  }

  // ── Render ───────────────────────────────────────────────

  /**
   * Rebuild #link-list from state.links.
   * href is set from the validated stored URL only (Requirement 8.4).
   * Labels are written via textContent (never innerHTML).
   */
  function renderLinks() {
    const list = document.getElementById('link-list');
    if (!list) return;

    while (list.firstChild) list.removeChild(list.firstChild);

    state.links.forEach((link) => {
      const li = document.createElement('li');
      li.className = 'link-item';

      // Anchor — href from validated stored URL only.
      const a = document.createElement('a');
      a.href             = link.url;          // already validated at add-time
      a.target           = '_blank';
      a.rel              = 'noopener noreferrer';
      a.textContent      = link.label;        // textContent — never innerHTML

      // Delete button
      const delBtn       = document.createElement('button');
      delBtn.className   = 'btn btn-danger';
      delBtn.textContent = 'Remove';
      delBtn.setAttribute('aria-label', `Remove link: ${link.label}`);
      delBtn.addEventListener('click', () => deleteLink(link.id));

      li.appendChild(a);
      li.appendChild(delBtn);
      list.appendChild(li);
    });
  }

  // ── CRUD operations ───────────────────────────────────────

  /**
   * Add a new quick link.
   * Validates label is non-empty, URL is parseable, URL is not a duplicate.
   * @param {string} label
   * @param {string} url
   */
  function addLink(label, url) {
    const trimLabel = label.trim();
    const trimUrl   = url.trim();

    if (trimLabel.length === 0) {
      showError('Label cannot be empty');
      return;
    }

    if (!validateUrl(trimUrl)) {
      showError('Please enter a valid URL (include https://)');
      return;
    }

    // Duplicate URL check (Requirement 5.3).
    const alreadyExists = state.links.some((l) => l.url === trimUrl);
    if (alreadyExists) {
      showError('This URL is already in your links');
      return;
    }

    showError('');

    const link = {
      id:    generateId(),
      label: trimLabel,
      url:   trimUrl,
    };

    state.links.push(link);
    persist();
    renderLinks();

    // Clear the form inputs.
    const labelInput = document.getElementById('link-label');
    const urlInput   = document.getElementById('link-url');
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';
  }

  /**
   * Remove a link by id.
   * @param {string} id
   */
  function deleteLink(id) {
    state.links = state.links.filter((l) => l.id !== id);
    persist();
    renderLinks();
  }

  /**
   * Initialise the module.
   * @param {Array} links – Saved links from StorageModule.
   */
  function init(links) {
    state.links = Array.isArray(links) ? links : [];
    renderLinks();

    const form = document.getElementById('link-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const labelEl = document.getElementById('link-label');
        const urlEl   = document.getElementById('link-url');
        addLink(
          labelEl ? labelEl.value : '',
          urlEl   ? urlEl.value   : ''
        );
      });
    }
  }

  return { init, addLink, deleteLink, renderLinks, validateUrl };
})();

/* ============================================================
   ENTRY POINT — init()
   Called once on DOMContentLoaded.
   Module initialisation order matters:
     1. ThemeModule  — must run first to avoid a theme flash
     2. GreetingModule
     3. TimerModule
     4. TodoModule
     5. LinksModule
   ============================================================ */

function init() {
  const state = StorageModule.loadAll();

  ThemeModule.init(state.theme);
  GreetingModule.init(state.userName);
  TimerModule.init(state.timerDuration);
  TodoModule.init(state.todos);
  LinksModule.init(state.links);
}

document.addEventListener('DOMContentLoaded', init);
