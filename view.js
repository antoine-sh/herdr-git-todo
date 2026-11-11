// Rendering. Takes state and callbacks; owns no state of its own.
import { div } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { theme } from "herdr";
import { NEXT, ICON } from "./model.js";

const smallButton = (id, t, color) => div().id(id).flex_none().px(4).rounded(4).text_size(12).text_color(color)
  .hover((s) => s.bg(t.raised))
  .on_mouse_down("left", (_e, cx) => cx.stop_propagation());

// A button that shows an on/off state.
const toggle = (id, label, on, t, fn) => smallButton(id, t, on ? t.working : t.dim)
  .on_click((_e, cx) => fn(cx)).child(on ? `${label} on` : label);

function row(it, t, on, live) {
  const color = { open: t.muted, in_progress: t.working, blocked: t.blocked, review: t.done, done: t.done };
  const agent = live.get(it.agent); // "working" | "blocked" | "done" | "idle" | undefined (no live agent)
  const badge = { working: t.working, blocked: t.blocked, done: t.done, idle: t.dim };
  const done = it.status === "done";
  const blocked = it.status === "blocked";
  return h_flex().id(`todo-${it.id}`).px(12).py(4).gap(8).items_start().cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => on.setStatus(cx, it, ...(NEXT[it.status] ?? NEXT.open)))
    .child(div().flex_none().text_size(13).text_color(color[it.status] ?? t.muted).child(ICON[it.status] ?? "☐"))
    .child(v_flex().flex_1().min_w(0)
      .child(h_flex().gap(6).items_center()
        .child(div().truncate().text_size(12.5).text_color(done ? t.dim : t.foreground).when(done, (el) => el.line_through()).child(it.text))
        .when(it.by && it.by !== "user", (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child(it.by))))
      .when(it.note, (el) => el.child(div().text_size(11).text_color(blocked ? t.blocked : t.dim).child(it.note))))
    .when(agent, (el) => el.child(smallButton(`todo-ag-${it.id}`, t, badge[agent])
      .on_click((_e, cx) => { cx.stop_propagation(); on.focusAgent(it); })
      .child(`● ${agent}`)))
    .when(!agent && it.status !== "done" && it.status !== "review", (el) => el.child(smallButton(`todo-run-${it.id}`, t, t.dim)
      .on_click((_e, cx) => { cx.stop_propagation(); on.run(cx, it); })
      .child("▶")))
    .child(smallButton(`todo-blk-${it.id}`, t, blocked ? t.blocked : t.dim)
      .on_click((_e, cx) => { cx.stop_propagation(); blocked ? on.setStatus(cx, it, "open", "open") : on.setStatus(cx, it, "block", "blocked"); })
      .child("!"))
    .child(smallButton(`todo-rm-${it.id}`, t, t.dim)
      .hover((s) => s.bg(t.raised).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); on.remove(cx, it); })
      .child("×"));
}

// s: { root, name, items, err, input, live, log, worktrees }
// on: { setStatus(cx, item, verb, status), remove(cx, item), run(cx, item), runNext(cx), runAll(cx),
//       focusAgent(item), toggleLog(cx), toggleWorktrees(cx) }
export function renderPanel(s, on) {
  const t = theme();
  const left = s.items.filter((i) => i.status !== "done").length;
  const head = h_flex().px(12).py(8).gap(6).items_center().flex_none()
    .child(div().flex_1().truncate().font_semibold().text_size(13).text_color(t.foreground).child(s.root ? s.name : "To-do"))
    .when(s.root, (el) => el
      .child(toggle("todo-log", "log", s.log, t, on.toggleLog))
      .child(toggle("todo-wt", "⎇", s.worktrees, t, on.toggleWorktrees))
      .child(smallButton("todo-next", t, t.dim).on_click((_e, cx) => on.runNext(cx)).child("▶ next"))
      .child(smallButton("todo-all", t, t.dim).on_click((_e, cx) => on.runAll(cx)).child("▶▶ all"))
      .child(div().text_size(11.5).text_color(t.dim).child(`${left} open`)));
  if (!s.root) {
    return v_flex().size_full().bg(t.chrome).child(head)
      .child(div().px(12).text_size(12).text_color(t.dim).child("This space isn't in a git repository."));
  }
  return v_flex().size_full().bg(t.chrome).child(head)
    .when(s.err, (el) => el.child(div().px(12).pb(4).text_size(11).text_color(t.blocked).child(s.err)))
    .child(v_flex().id("todo-list").flex_1().overflow_y_scrollbar().children(s.items.map((it) => row(it, t, on, s.live))))
    .child(div().flex_none().p(8)
      .child(Input.new(s.input).h(30).px(8).rounded(6).border_1().border_color(t.input).bg(t.background)
        .text_size(12.5).text_color(t.foreground)));
}
