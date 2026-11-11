// Item format and status vocabulary. Pure: no host calls.

// One line per item: id, status, by, created, updated, text, note, agent (tab-separated); "#..." lines are flags.
// `agent` is the address of the terminal working on the item ("" if none).
export const parse = (text) => text.split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
  const [id, status, by, , , t, note, agent] = l.split("\t");
  return { id, status, by, text: t ?? "", note: note ?? "", agent: agent ?? "" };
});

// Is request logging on for this project?
export const parseLog = (text) => text.split("\n").includes("#log=on");

// Click on the box (review = the agent finished, you confirm): status -> [todo verb, resulting status].
export const NEXT = { open: ["start", "in_progress"], in_progress: ["done", "done"], review: ["done", "done"], blocked: ["start", "in_progress"], done: ["open", "open"] };
export const ICON = { open: "☐", in_progress: "◐", blocked: "⚠", review: "◎", done: "☑" };
