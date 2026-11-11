// Transport: installs todo.sh on the repo's machine and runs `todo <args>` there.
import { exec, appHome, readTextFile } from "herdr";

const utf8 = (s) => {
  let o = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c < 0x80) o += ch;
    else if (c < 0x800) o += String.fromCharCode(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) o += String.fromCharCode(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else o += String.fromCharCode(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return o;
};
const b64 = (s) => btoa(utf8(s));

export class TodoCli {
  constructor() { this.installed = new Set(); this.script = null; this.err = null; }

  // Puts todo.sh at ~/.local/bin/todo on `machine` when missing or different.
  async install(machine) {
    const m = machine ?? "";
    if (this.installed.has(m)) return true;
    this.script ??= await readTextFile(`${appHome()}/mods/git-todo/todo.sh`);
    if (!this.script) { this.err = "todo.sh is missing from the mod folder"; return false; }
    const r = await exec("sh", ["-c",
      'command -v bash >/dev/null || { echo NOBASH; exit 3; }; f="$HOME/.local/bin/todo"; ' +
      'printf %s "$1" | base64 -d | cmp -s - "$f" 2>/dev/null || { mkdir -p "$HOME/.local/bin" && printf %s "$1" | base64 -d > "$f" && chmod +x "$f"; }',
      "sh", b64(this.script)], { on: machine });
    if (r.code !== 0) { this.err = r.stdout.includes("NOBASH") ? "bash is needed on this machine for the to-do list" : `could not install todo: ${r.stderr.trim()}`; return false; }
    this.installed.add(m);
    return true;
  }

  // Runs `todo <args>` in `root`, as the user. Returns stdout, or null with this.err set.
  async run(machine, root, args) {
    if (!(await this.install(machine))) return null;
    const r = await exec("sh", ["-c", 'TODO_BY=user "$HOME/.local/bin/todo" "$@"', "sh", ...args], { cwd: root, on: machine });
    if (r.code !== 0) { this.err = r.stderr.trim() || `todo ${args[0]} failed`; return null; }
    this.err = null;
    return r.stdout;
  }
}
