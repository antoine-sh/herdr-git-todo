// To-do list tied to the git repo of the active space. It lives WITH the repo, on the machine
// the space runs on: <common git dir>/herdr-todo (untracked, shared by worktrees).
// All reads/writes go through todo.sh (bash+awk+git), installed as ~/.local/bin/todo on that machine (local or
// remote, kept in sync with this folder's copy). It locks, re-reads and changes one item by id,
// so this panel and Claude (`todo add|start|block|done|...`) never overwrite each other.
// Click the box: open -> in progress -> done -> open. "!" toggles blocked. x deletes.
// ▶ starts a Claude tab on the item and links its terminal; the row then shows that agent's live status
// (click to focus it). When the agent finishes, the item moves to review (◎); clicking the box confirms it.
// "▶ next" / "▶▶ all" start the first / every open item (⎇: each in its own git worktree).
// "log" is the per-project request-logging switch (`todo log`).
//
// Files: model.js (item format) · cli.js (install + run todo.sh) · repo.js (find the repo)
//        agents.js (start, find and watch agents) · view.js (render) · todo.sh
import { View } from "gpui-kit";
import { InputState } from "gpui-base";
import { parse, parseLog } from "./model.js";
import { TodoCli } from "./cli.js";
import { launch, focusAgent, liveStatus, finished } from "./agents.js";
import { currentFolder, repoRoot } from "./repo.js";
import { renderPanel } from "./view.js";

export default class GitTodo extends View {
  init(_props, cx) {
    this.root = null; this.machine = null; this.name = ""; this.items = []; this.raw = null;
    this.folderKey = null; this.todo = new TodoCli();
    this.input = InputState.new({ value: "" });
    this.input.on("submit", (_e, cx) => this.add(cx));
    this.on = {
      setStatus: (cx, it, verb, status) => this.act(cx, () => { it.status = status; }, [verb, it.id]),
      remove: (cx, it) => this.act(cx, () => { this.items = this.items.filter((x) => x !== it); }, ["rm", it.id]),
      run: (cx, it) => cx.spawn((cx) => this.launchItems(cx, [it])),
      runNext: (cx) => cx.spawn((cx) => this.launchItems(cx, this.runnable().slice(0, 1))),
      runAll: (cx) => cx.spawn((cx) => this.launchItems(cx, this.runnable())),
      focusAgent: (it) => focusAgent(it.agent),
      toggleLog: (cx) => this.act(cx, () => { this.log = !this.log; }, ["log", this.log ? "off" : "on"]),
      toggleWorktrees: (cx) => { this.worktrees = !this.worktrees; cx.notify(); },
    };
    this.log = false; this.worktrees = false; this.last = new Map();
    this.detect(cx);
    cx.timer.every(2000, (cx) => this.watch(cx));
    cx.timer.every(2000, (cx) => this.detect(cx));
    cx.timer.every(3000, (cx) => cx.spawn(async (cx) => { if (this.root && await this.load()) cx.notify(); }));
  }

  detect(cx) {
    const { folder, machine } = currentFolder();
    const key = `${machine}|${folder}`;
    if (!folder || key === this.folderKey) return;
    this.folderKey = key;
    cx.spawn(async (cx) => {
      const root = await repoRoot(folder, machine);
      this.machine = machine;
      if (root !== this.root) {
        this.root = root; this.name = root ? root.split("/").pop() : "";
        this.raw = null; this.items = []; this.todo.err = null;
        await this.load();
      }
      cx.notify();
    });
  }

  // Reads the list; true if it changed.
  async load() {
    if (!this.root) return false;
    const root = this.root;
    let text;
    try { text = await this.todo.run(this.machine, root, ["raw"]); } catch (e) { this.todo.err = String(e); return false; }
    if (text == null || root !== this.root || text === this.raw) return false;
    try { this.items = parse(text); this.log = parseLog(text); } catch { return false; }
    this.raw = text;
    return true;
  }

  // Open items nobody is working on yet.
  runnable() { return this.items.filter((i) => i.status === "open" && !i.agent); }

  // Starts a Claude tab for each item in turn and links its terminal to the item.
  async launchItems(cx, items) {
    if (!this.root) return;
    for (const it of items) {
      await this.todo.run(this.machine, this.root, ["start", it.id]);
      const addr = await launch(cx, it, { root: this.root, machine: this.machine, worktrees: this.worktrees, logOn: this.log });
      if (addr) await this.todo.run(this.machine, this.root, ["link", it.id, addr]);
      else this.todo.err = `no agent appeared for "${it.text}"`;
      this.raw = null; await this.load(); cx.notify();
    }
  }

  // An agent that finished its item: move the item to review, and you confirm.
  watch(cx) {
    const live = liveStatus();
    for (const it of finished(this.items, live, this.last)) {
      this.act(cx, () => { it.status = "review"; }, ["review", it.id]);
    }
    this.last = live;
  }

  // Shows `fn`'s change at once, runs the command, then re-reads the truth.
  act(cx, fn, args) {
    if (!this.root) return;
    fn();
    cx.notify();
    cx.spawn(async (cx) => { await this.todo.run(this.machine, this.root, args); this.raw = null; await this.load(); cx.notify(); });
  }

  add(cx) {
    const text = this.input.value().trim();
    if (!text || !this.root) return;
    this.input.set_value("");
    this.act(cx, () => this.items.push({ id: `new-${Date.now()}`, text, status: "open", by: "user" }), ["add", text]);
  }

  render() {
    return renderPanel({
      root: this.root, name: this.name, items: this.items, err: this.todo.err, input: this.input,
      live: liveStatus(), log: this.log, worktrees: this.worktrees,
    }, this.on);
  }
}
