# herdr-git-todo

A [Herdr](https://herdr.dev) mod that keeps a to-do list **inside the git repo** of the space you are working in, and lets you hand any item to a Claude agent with one click:

- one shared list per repository, stored in the repo's git dir (untracked, shared by all its worktrees)
- the panel and Claude read and write the same list through a small `todo` CLI, so they never overwrite each other
- a ▶ button starts a Claude tab on an item and shows that agent's live status on the row

It follows the focused space, so it always shows the list of the project you are looking at.

---

## 📑 Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Install](#-install)
- [Opening it](#-opening-it)
- [The `todo` CLI](#-the-todo-cli)
- [How it works](#-how-it-works)
- [Files](#-files)
- [License](#-license)

---

## ✨ Features

### ✅ The list

| Element | What it shows |
|---|---|
| 📌 **Header** | The repo name and how many items are still open. |
| ☐ **Box** | The item's status. Click it to cycle: open → in progress → done → open. |
| 🏷️ **Author** | `claude` next to items Claude added. Items you add show nothing. |
| 📝 **Note** | A line under the item: why it is blocked, or what Claude did. |
| ❗ **Blocked** | `!` toggles blocked. `×` deletes the item. |

Statuses: `open`, `in_progress`, `blocked`, `review`, `done`. Type in the box at the bottom and press Enter to add an item.

### 🤖 Send to Claude

- **▶** on a row opens a new tab running `claude` on that item. The prompt includes the item and how to report back with `todo`.
- The row then shows the agent's live status (`● working`, `● blocked`, `● done`, `● idle`). Click it to focus that terminal.
- When the agent finishes, the item moves to **review** (◎). Clicking the box confirms it as done, so nothing is closed without you.
- **▶ next** starts the first open item, **▶▶ all** starts every open item.
- **⎇** runs each item in its own git worktree (`~/.herdr/worktrees/<repo>/todo-<id>`, branch `todo-<id>`).
- **log** records each request you give Claude as an item automatically.

### ⚡ Everyday

- 🔁 **Live**: re-reads the list every 2 seconds, and when focus moves to another project.
- 🌐 **Remote spaces**: the list lives with the repo, on the machine the space runs on.
- 🌳 **Worktrees**: all worktrees of a repo share one list.

---

## 📋 Requirements

- Herdr app
- `git`, `bash` and `awk` on the machine that holds the repository
- `claude` (Claude Code) on that machine, to use ▶

---

## 📦 Install

```sh
git clone https://github.com/antoine-sh/herdr-git-todo.git ~/.config/herdr-app/mods/git-todo
herdr-app check ~/.config/herdr-app/mods/git-todo
```

The mod installs `todo.sh` as `~/.local/bin/todo` on the machine of each space it is used in, and keeps it in sync. Make sure that folder is on your `PATH` so Claude can run `todo`.

## 🚀 Opening it

The mod has `"place": "none"`, so it does not appear on its own. Pick one of these:

**🪟 As a pane beside your terminal**

```sh
herdr-app do pane.split --direction right --mod git-todo
```

**💬 As a dialog, toggled**

```sh
herdr-app do mod.open --name git-todo
```

**🧩 Docked in a layout** — add a block to your layout file. Shipped layouts are read-only, so clone one first (`herdr-app do layout.clone '{"name":"main","as":"my-layout"}'`).

```json
{ "id": "todo", "type": "block", "size": { "px": 260 }, "content": { "mod": "git-todo" } }
```

**⌨️ With a key** — add to `keys.json`:

```json
{ "global": { "ctrl-shift-t": "mod.open:git-todo" } }
```

> [!NOTE]
> "Agent finished" detection only runs while a copy of the mod is alive. Dock it in a layout, or keep it open, to have items move to review on their own.

---

## 💻 The `todo` CLI

The panel and Claude go through the same script. Numbers are 1-based positions; ids also work.

```sh
todo                      # list
todo add <text>           # add an open item
todo start  <n|id> [note] # in progress
todo block  <n|id> [note] # blocked
todo review <n|id> [note] # ready for review (you confirm with done)
todo done   <n|id> [note] # done
todo open   <n|id>        # back to open
todo edit   <n|id> <text> # reword
todo note   <n|id> <text> # set the note
todo rm     <n|id>        # delete
todo log [on|off]         # request-logging switch
```

Agents started with ▶ are told to run `todo start` when they begin, `todo block` if they need you, and `todo review` when finished.

---

## ⚙️ How it works

1. The focused space's folder is found, then `git rev-parse --git-common-dir` gives the repo's shared git dir.
2. The list is one tab-separated file there, `herdr-todo`. It is untracked, so it never shows up in commits.
3. Every write takes a lock, re-reads the file, changes **one item by id**, and renames atomically. The panel and Claude can edit at the same time.
4. ▶ opens a tab with `claude` and the task text, then looks for the new agent and stores its terminal address on the item.
5. Every 2 seconds the panel reads the list and the live agent statuses. An agent that goes from working to done moves its item to review.

---

## 📁 Files

| File | Purpose |
|---|---|
| `main.js` | the panel: state, timers, wiring |
| `view.js` | rendering: header, rows, buttons |
| `model.js` | item format and status tables |
| `cli.js` | installs `todo.sh` on a machine and runs it |
| `repo.js` | finds the folder and repo root of the focused space |
| `agents.js` | starts a Claude tab for an item, reads agent status |
| `todo.sh` | the only code that reads or writes the list (locking, ids) |
| `mod.json` | placement (`none`) and title |
| `gpui-kit.d.ts`, `jsconfig.json` | editor types, rewritten by Herdr on start (safe to git-ignore) |

---

## 📄 License

Add a license before publishing, for example MIT.
