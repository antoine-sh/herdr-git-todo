# git-todo mod

A Herdr panel: a to-do list stored with the active space's git repo. Read `../../AGENTS.md` for the mod API. Don't edit `gpui-kit.d.ts` (the app rewrites it).

## File boundaries

Each file has one job. Put new code where it belongs; don't grow `main.js`.

| File | Owns | Must not |
|---|---|---|
| `model.js` | Item format (`parse`), status tables (`NEXT`, `ICON`). Pure. | Import `herdr`/`gpui-kit` or hold state. |
| `cli.js` | `TodoCli`: installing `todo.sh` on a machine, running `todo <args>`, `err`. | Know about items, UI or the View. |
| `repo.js` | Finding the repo: `currentFolder()`, `repoRoot()`. | Touch the todo list. |
| `agents.js` | Starting a Claude tab for an item (`launch`), the task text, live agent status, "agent finished" detection. | Hold state or render. |
| `view.js` | `renderPanel(state, handlers)` and row rendering. | Keep state, call `exec`, or mutate items. It reports intent through the `on` callbacks. |
| `main.js` | The `GitTodo` View: state, timers, wiring the pieces together. | Hold format, transport or layout details. |
| `todo.sh` | The only code that reads or writes the list file (locking, ids). | Be bypassed: the panel and Claude both go through it. |

Dependencies point one way: `main.js` -> `view.js` / `cli.js` / `repo.js` -> `model.js`. No cycles, and the leaf files never import `main.js`.

## Rules

- A new item field is added in three places: `todo.sh` (storage), `model.js` (`parse`), `view.js` (display). `main.js` changes only if it needs new state.
- A new action: a `todo.sh` subcommand, a handler in `main.js`'s `this.on`, a button in `view.js` that calls `on.<name>`.
- Keep host calls (`exec`, `spaces`, ...) out of module top level. Module code is shared across copies and reloads. State and calls belong in `init` or methods.
- Add a new file only for a new responsibility. A file that needs "and" in its description should be split. A 20-line file with one job is fine.
- Update the file list in `main.js`'s header comment when files change.

## Before calling it done

```sh
herdr-app check ~/.config/herdr-app/mods/git-todo
```

Then check `herdr-app status` for errors, and look at the panel (`herdr-app shot`) after UI changes.
