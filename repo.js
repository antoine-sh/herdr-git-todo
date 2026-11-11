// Which git repo the active space is in.
import { exec, spaces, focused } from "herdr";

// The folder and machine to look at: the focused pane's cwd, else the active space's.
export function currentFolder() {
  const s = spaces().find((s) => s.active);
  return { folder: focused()?.cwd ?? s?.folder ?? null, machine: s?.machine ?? null };
}

// Repo top level for a folder, or null.
export async function repoRoot(folder, machine) {
  try {
    const r = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on: machine });
    if (r.code === 0) return r.stdout.trim() || null;
  } catch {}
  return null;
}
