Must-have: reliable shared state
1. Stable ids and timestamps. Each item gets id, created, updated and by ("user" or "claude"). This removes the index races.
2. Safe concurrent writes. Re-read and merge by id before each save, using a version or mtime check and an atomic rename. A todo.d.ts-style schema note in the file helps too.
3. A real todo CLI (list, add, done, rm, edit) backed by the same file. This also fixes the dead command CLAUDE.md refers to. Claude would use it instead of hand-editing JSON.
4. A tri-state status: open → in_progress → blocked → done, instead of a boolean. Claude sets in_progress when it starts, blocked when it needs you, and done plus a check note when it finishes.

Most useful: tying items to agents
5. Send to Claude. A ▶ button starts tab.new with argv:["claude"] and task: set to the item text plus repo context. The item records the terminal address.
6. Live agent badge per item. Reading agents() shows working, blocked or done on the row, with a click to focus that agent. A blocked agent puts a badge on its item.
7. Auto-tick on completion. When the linked agent goes done, the item moves to "needs review", not straight to done. You confirm.
8. Next item. A "Run next / run all open" action, optionally one worktree each via the worktree mod, so Claude can work through the list in parallel.
9. Request logging. A per-project switch that captures the user's requests as items automatically, as CLAUDE.md describes. The mod would show the on/off state.

Nice-to-have: richer items
10. Detail and acceptance notes. A multi-line description, a "how to verify" line, and a result note that Claude fills in (commit, PR link, test output).
11. Links. File and line references that open the viewer, branch and commit links, and an item that can reference another item.
12. Subtasks and grouping. Nested checklists, a Claude-proposed plan broken into steps, and "now / next / later" sections.
13. Priority and drag-reorder. Order is how you tell Claude what comes first.
14. Inline edit. Double-click to reword. Claude edits the same way, so history stays coherent.
15. Filters and search. Open / in progress / done, by author, and a collapse for completed items with a "clear done" action.
16. Cross-project view. An "all projects" switcher or aggregate, matching the todo all idea in CLAUDE.md.
17. Follow-up capture. A "Claude left this undone" tag for items it adds itself, so you can tell its leftovers from your requests.
18. Notifications. A toast with a click action to focus the item's agent when something becomes blocked or ready for review. Optionally paste a selected terminal range as a new item.
19. History and undo. A short change log with undo for deletes, since a stray × is currently final.

Suggested order

1. Ids with merge-safe writes, the CLI, and the tri-state status (items 1–4). Everything else builds on these.
2. Send-to-Claude with the agent badge and review-before-done (items 5–7). This is where the biggest gain with Claude is.
3. Detail and result notes, inline edit, reorder, and undo (items 10, 14, 13, 19).
