// Tying items to agents: start a Claude tab for an item, find its terminal, read its live status.
import { run, agents, exec } from "herdr";

// The first message the agent gets: the item, plus how to report back through the todo CLI.
export const taskFor = (it, root, logOn) => [
  it.text,
  "",
  `This is item ${it.id} of the shared to-do list for ${root} (CLI: \`todo\`, run \`todo\` to see it).`,
  `Run \`todo start ${it.id}\` when you begin. If you need the user, run \`todo block ${it.id} "<what you need>"\`.`,
  `When finished run \`todo review ${it.id} "<what you did: commit, PR, test result>"\` (the user confirms it). Do not run \`todo done\`.`,
  "If you leave anything undone, add it with `todo add`.",
  ...(logOn ? ["Request logging is on: `todo add` each new request the user gives you, then do it."] : []),
].join("\n");

// A checkout of its own for the item: ~/.herdr/worktrees/<repo>/todo-<id>, branch todo-<id>.
// Returns its path, or null (the caller then works in the main checkout).
async function worktree(root, machine, id) {
  const r = await exec("sh", ["-c",
    'p="$HOME/.herdr/worktrees/$(basename "$PWD")/todo-$1"; ' +
    'git worktree add -b "todo-$1" "$p" >/dev/null 2>&1 || git worktree add "$p" "todo-$1" >/dev/null 2>&1; ' +
    '[ -d "$p" ] && echo "$p"', "sh", id], { cwd: root, on: machine });
  return r.code === 0 ? r.stdout.trim() || null : null;
}

// Opens a tab running claude on the item. Resolves to the agent's terminal address, or null if it never showed up.
export async function launch(cx, it, { root, machine, worktrees, logOn }) {
  const name = `todo ${it.id}`;
  const folder = (worktrees && await worktree(root, machine, it.id)) || root;
  run("tab.new", { name, folder, argv: ["claude"], task: taskFor(it, root, logOn) });
  for (let i = 0; i < 20; i++) {
    await cx.sleep(500);
    const a = agents().find((a) => a.tab_name === name);
    if (a) return a.address;
  }
  return null;
}

export const focusAgent = (address) => run("agent.focus", { terminal: address });

// address -> live status ("working" | "blocked" | "done" | "idle") of every agent right now.
export const liveStatus = () => new Map(agents().map((a) => [a.address, a.status]));

// Items whose agent just finished: in progress, and its agent is "done" (finished unseen),
// or went working -> idle (finished while you watched). `last` is the previous liveStatus().
export const finished = (items, live, last) => items.filter((it) => {
  if (it.status !== "in_progress" || !it.agent) return false;
  const now = live.get(it.agent);
  return now === "done" || (now === "idle" && last.get(it.agent) === "working");
});
