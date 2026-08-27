# Requirements Document

## Introduction

Focus Dashboard is a standalone, client-side productivity web application built with plain HTML, CSS, and Vanilla JavaScript. It provides a unified browser-based interface for managing a Pomodoro timer, a to-do list, quick-access links, and a personalized greeting — all persisted exclusively via the browser's LocalStorage API. No build step, no backend, and no external dependencies are required.

## Glossary

- **App**: The Focus Dashboard application running in the browser.
- **StorageModule**: The JavaScript module responsible for all LocalStorage reads and writes.
- **GreetingModule**: The JavaScript module responsible for the greeting section UI and user-name management.
- **TimerModule**: The JavaScript module responsible for the Pomodoro countdown timer.
- **TodoModule**: The JavaScript module responsible for the to-do list CRUD operations.
- **LinksModule**: The JavaScript module responsible for the quick-access link management.
- **ThemeModule**: The JavaScript module responsible for light/dark theme switching.
- **Task**: A to-do item with an `id`, `text`, `done` flag, and `createdAt` timestamp.
- **Link**: A quick-access item with an `id`, `label`, and `url`.
- **AppState**: The in-memory representation of all persisted data loaded from LocalStorage on startup.
- **Normalized_Text**: A string that has been trimmed, had internal whitespace collapsed to a single space, and converted to lowercase.
- **Session**: A single browser page load until the page is closed or reloaded.

---

## Requirements

### Requirement 1: App Initialization

**User Story:** As a user, I want the dashboard to load all my saved data automatically when I open it, so that I can pick up exactly where I left off without any manual setup.

#### Acceptance Criteria

1. WHEN the DOM is fully loaded, THE App SHALL invoke `StorageModule.loadAll()` to retrieve persisted state before rendering any widget.
2. WHEN `StorageModule.loadAll()` returns, THE App SHALL initialize `ThemeModule`, `GreetingModule`, `TimerModule`, `TodoModule`, and `LinksModule` with the values from the loaded state.
3. IF a LocalStorage key is absent, THEN THE StorageModule SHALL supply a typed default value: empty string for `userName`, OS-preferred theme for `theme`, `25` for `timerDuration`, empty array for `todos`, and empty array for `links`.
4. WHEN initialization completes, THE App SHALL render all five dashboard sections — greeting, timer, to-do list, quick links, and theme toggle — without any console errors.
5. WHEN the page is served from the file system or any static host, THE App SHALL function correctly in modern evergreen browsers (Chrome, Firefox, Edge, Safari) without a build step.

---

### Requirement 2: Greeting Section

**User Story:** As a user, I want to see a personalized, time-aware greeting with the current date and time, so that the dashboard feels welcoming and contextually relevant.

#### Acceptance Criteria

1. WHEN `GreetingModule` initializes, THE GreetingModule SHALL display a greeting phrase determined by the current hour: `"Good night"` for hours 0–5, `"Good morning"` for hours 6–11, `"Good afternoon"` for hours 12–17, and `"Good evening"` for hours 18–23.
2. WHEN `GreetingModule` initializes, THE GreetingModule SHALL display the current time in `HH:MM` format and the current date in `Weekday, Month D, YYYY` format.
3. WHILE the dashboard is open, THE GreetingModule SHALL refresh the time and date display every 30 seconds.
4. WHEN a user submits a non-empty name via the name-edit control, THE GreetingModule SHALL trim the input, persist it via `StorageModule`, and re-render the greeting to include the user's name.
5. IF a user submits a whitespace-only string as a name, THEN THE GreetingModule SHALL reject the input and retain the previously saved name.
6. WHEN the page reloads, THE GreetingModule SHALL restore and display the previously saved user name.

---

### Requirement 3: Pomodoro Timer

**User Story:** As a user, I want a configurable countdown timer with start, stop, and reset controls plus an audible alert on completion, so that I can manage focused work sessions using the Pomodoro technique.

#### Acceptance Criteria

1. WHEN `TimerModule` initializes, THE TimerModule SHALL display the countdown in `MM:SS` format using the persisted duration (default 25 minutes).
2. WHEN a user clicks the Start button, THE TimerModule SHALL begin decrementing `secondsLeft` by exactly one every 1 000 milliseconds.
3. WHILE the timer is running, THE TimerModule SHALL update the browser tab `<title>` each second with the remaining time in `(MM:SS) Focus Dashboard` format.
4. WHEN a user clicks the Stop button, THE TimerModule SHALL pause the countdown and preserve the current `secondsLeft` value without resetting it.
5. WHEN a user clicks the Reset button, THE TimerModule SHALL stop any running countdown and restore `secondsLeft` to `durationMinutes × 60`.
6. WHEN `secondsLeft` reaches zero, THE TimerModule SHALL clear the interval, set `isRunning` to `false`, play an audible beep via the Web Audio API, and display a completion notification.
7. WHEN a user sets a new duration, THE TimerModule SHALL accept only integer values in the range [1, 60]; IF the submitted value is outside that range, THEN THE TimerModule SHALL clamp it to the nearest bound and display a validation message.
8. WHEN a valid new duration is saved, THE TimerModule SHALL persist it via `StorageModule` and reset the display to `mm:00`.
9. THE TimerModule SHALL ensure `secondsLeft` is greater than or equal to zero at all times.

---

### Requirement 4: To-Do List

**User Story:** As a user, I want to add, edit, complete, delete, and sort tasks with duplicate prevention, so that I can manage my work items reliably without accidentally creating repeated entries.

#### Acceptance Criteria

1. WHEN a user submits a non-empty task description, THE TodoModule SHALL create a `Task` object with a unique `id`, the trimmed text, `done: false`, and `createdAt` set to the current timestamp, append it to `state.todos`, persist the list, and re-render the task list.
2. WHEN a user submits a task description whose `Normalized_Text` matches the `Normalized_Text` of any existing task, THE TodoModule SHALL reject the addition and display an inline error message "Task already exists".
3. IF a user submits an empty or whitespace-only task description, THEN THE TodoModule SHALL reject the addition and display an inline error message "Task cannot be empty".
4. WHEN a new task is successfully added, THE TodoModule SHALL clear the input field and return focus to it.
5. WHEN a user activates inline edit for a task, THE TodoModule SHALL replace the task text with an editable input field pre-filled with the current text.
6. WHEN a user confirms an inline edit, THE TodoModule SHALL apply the same non-empty and duplicate-prevention validation rules as task addition, excluding the task being edited from the duplicate check.
7. WHEN a user toggles the done control for a task, THE TodoModule SHALL flip the `done` flag, persist the updated list, and re-render.
8. WHEN a user deletes a task, THE TodoModule SHALL remove it from `state.todos`, persist the updated list, and re-render.
9. WHEN a user selects a sort option, THE TodoModule SHALL sort the in-memory list by `createdAt` (ascending) for `'date'`, alphabetically by `text` for `'name'`, or with incomplete tasks before complete tasks for `'status'`, then re-render without persisting sort order.
10. THE TodoModule SHALL render all task text using `element.textContent` and SHALL NOT use `innerHTML` for any user-supplied content.

---

### Requirement 5: Quick Links

**User Story:** As a user, I want to save, display, and remove labelled URL shortcuts that open in a new tab, so that I can access frequently visited pages from the dashboard with a single click.

#### Acceptance Criteria

1. WHEN a user submits a non-empty label and a valid absolute URL, THE LinksModule SHALL create a `Link` object with a unique `id`, the trimmed label, and the URL, append it to `state.links`, persist the list, and re-render the link buttons.
2. WHEN a user submits a URL, THE LinksModule SHALL validate it by passing it to `new URL(url)`; IF the constructor throws, THEN THE LinksModule SHALL display an inline error "Please enter a valid URL (include https://)".
3. IF a user submits a URL that is already present in `state.links`, THEN THE LinksModule SHALL reject the addition and display an appropriate duplicate error.
4. IF a user submits an empty or whitespace-only label, THEN THE LinksModule SHALL reject the addition and display a validation error.
5. WHEN a link button is clicked, THE LinksModule SHALL open the stored URL in a new browser tab with `rel="noopener noreferrer"`.
6. WHEN a user deletes a link, THE LinksModule SHALL remove it from `state.links`, persist the updated list, and re-render.
7. THE LinksModule SHALL render all link labels using `element.textContent` and SHALL NOT use `innerHTML` for any user-supplied content.

---

### Requirement 6: Light/Dark Theme Toggle

**User Story:** As a user, I want to switch between light and dark themes and have my choice remembered across sessions, so that the dashboard matches my visual preference at any time of day.

#### Acceptance Criteria

1. WHEN `ThemeModule` initializes without a saved theme preference, THE ThemeModule SHALL apply the OS-preferred theme by reading `window.matchMedia('(prefers-color-scheme: dark)')`.
2. WHEN `ThemeModule` initializes with a saved theme preference, THE ThemeModule SHALL apply the saved theme, overriding the OS preference.
3. WHEN a user clicks the theme toggle button, THE ThemeModule SHALL switch `currentTheme` from `'light'` to `'dark'` or from `'dark'` to `'light'`, set `document.documentElement`'s `data-theme` attribute to the new value, update the toggle button's `aria-label` and icon, and persist the choice via `StorageModule`.
4. WHEN the page reloads, THE ThemeModule SHALL restore and apply the previously saved theme without any flash of the opposite theme.
5. THE ThemeModule SHALL only accept `'light'` or `'dark'` as valid theme values.

---

### Requirement 7: Data Persistence

**User Story:** As a user, I want all my settings, tasks, links, and timer configuration to survive page reloads automatically, so that I never lose my data between sessions.

#### Acceptance Criteria

1. WHEN any mutation to `state.todos`, `state.links`, `state.theme`, `state.userName`, or `state.timerDuration` occurs, THE StorageModule SHALL immediately serialize the updated value to JSON and write it to the corresponding LocalStorage key.
2. WHEN `StorageModule.get(key, defaultValue)` is called and the key is present, THE StorageModule SHALL return the JSON-parsed value stored at that key.
3. WHEN `StorageModule.get(key, defaultValue)` is called and the key is absent, THE StorageModule SHALL return `defaultValue` without throwing.
4. THE StorageModule SHALL use the fixed key names `fd_userName`, `fd_theme`, `fd_todos`, `fd_links`, and `fd_timerDuration` for all read and write operations.
5. FOR ALL valid `AppState` values, serializing then deserializing via `StorageModule.set` followed by `StorageModule.get` SHALL produce a value that deep-equals the original.

---

### Requirement 8: Error Handling

**User Story:** As a user, I want the dashboard to remain functional even when LocalStorage is unavailable or I provide invalid input, so that unexpected conditions never crash the application or leave it in a broken state.

#### Acceptance Criteria

1. IF `localStorage.getItem` or `localStorage.setItem` throws during any `StorageModule` operation, THEN THE StorageModule SHALL catch the exception, continue operating with the current in-memory state for the duration of the Session, and SHALL NOT propagate the error to the caller.
2. IF LocalStorage is unavailable, THEN THE App SHALL render and operate normally for the Session without displaying an error page or crashing.
3. WHEN any module renders user-supplied content to the DOM, THE App SHALL use `element.textContent` exclusively and SHALL NOT use `innerHTML`, `eval`, or dynamic script injection with user-supplied data.
4. WHEN `LinksModule` stores a link, THE LinksModule SHALL render the link's `href` attribute from the validated stored URL only, ensuring no unvalidated user input reaches the DOM as a URL.
5. IF the Web Audio API or the Notifications API is unavailable in the current browser, THEN THE TimerModule SHALL complete the session countdown normally without throwing an error.
