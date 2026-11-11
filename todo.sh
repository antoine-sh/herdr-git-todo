#!/usr/bin/env bash
# TODO_VERSION=4
# Per-repo to-do list shared by the Herdr to-do panel and Claude. bash + awk + git only.
# File: <git common dir>/herdr-todo (untracked, shared by worktrees). One item per line:
#   id <TAB> status <TAB> by <TAB> created <TAB> updated <TAB> text <TAB> note <TAB> agent
# (agent = address of the terminal working on the item; set by the panel's play button)
# plus an optional "#log=on" line. Every write: lock -> re-read -> change ONE item by id
# -> atomic rename, so the panel and Claude never overwrite each other.
#
#   todo                      list (numbers are 1-based positions)
#   todo add <text>           add an open item
#   todo start <n|id> [note]  in progress      todo block <n|id> [note]  blocked
#   todo review <n|id> [note] ready for review (the user confirms with done)
#   todo link  <n|id> <addr>  record the agent terminal ("-" clears)
#   todo done  <n|id> [note]  done             todo open  <n|id>         back to open
#   todo edit  <n|id> <text>  reword           todo note  <n|id> <text>  set the note
#   todo rm    <n|id>         delete
#   todo log [on|off]         request logging flag
#   todo raw                  the file as stored (what the panel reads)
# Statuses: open, in_progress, blocked, review, done. Author ("user"/"claude") comes from
# $TODO_BY, else "claude" inside Claude Code ($CLAUDECODE), else "user".
set -u
VERSION=4
die() { echo "todo: $*" >&2; exit 1; }

gd=$(git rev-parse --git-common-dir 2>/dev/null) || die "not in a git repository"
case $gd in /*) ;; *) gd=$PWD/$gd ;; esac
F="$gd/herdr-todo"
OLD="$gd/herdr-todo.json"
LOCK="$F.lock"

now() { date +%s; }
clean() { printf %s "$*" | tr '\t\r\n' '   ' | sed 's/^ *//; s/ *$//'; }
newid() { od -An -N3 -tx1 /dev/urandom | tr -d ' \n'; }
by() { if [ -n "${TODO_BY:-}" ]; then echo "$TODO_BY"; elif [ -n "${CLAUDECODE:-}" ]; then echo claude; else echo user; fi; }

lock() {
  local i=0
  until mkdir "$LOCK" 2>/dev/null; do
    # break a lock older than ~10s (crashed writer)
    if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; fi
    i=$((i + 1)); [ "$i" -gt 100 ] && die "could not get the lock ($LOCK)"
    sleep 0.05
  done
  trap 'rmdir "$LOCK" 2>/dev/null' EXIT
}
unlock() { rmdir "$LOCK" 2>/dev/null; trap - EXIT; }

# One-time import of the older JSON file (needs jq or python3; else it is left alone).
migrate() {
  [ -f "$F" ] && return 0
  if [ -f "$OLD" ]; then
    local t="$F.tmp.$$"
    if command -v jq >/dev/null 2>&1; then
      jq -r '.items[]? | [(.id // ""), (.status // (if .done then "done" else "open" end)), (.by // "user"), (.created // 0), (.updated // 0), (.text | gsub("[\\t\\r\\n]"; " ")), ((.note // "") | gsub("[\\t\\r\\n]"; " "))] | @tsv' "$OLD" >"$t" 2>/dev/null
    elif command -v python3 >/dev/null 2>&1; then
      python3 - "$OLD" >"$t" 2>/dev/null <<'PY'
import json, sys
c = lambda s: " ".join(str(s or "").split())
for i in json.load(open(sys.argv[1])).get("items", []):
    print("\t".join([i.get("id") or "", i.get("status") or ("done" if i.get("done") else "open"), i.get("by") or "user",
                     str(i.get("created") or 0), str(i.get("updated") or 0), c(i.get("text")), c(i.get("note"))]))
PY
    else
      return 0
    fi
    # give ids to rows that have none; keep the file only if it parsed
    awk -F'\t' -v OFS='\t' 'BEGIN{srand()} NF{ if($1=="") $1=sprintf("%06x",int(rand()*16777216)); print }' "$t" >"$t.2" && mv "$t.2" "$F"
    rm -f "$t"
    return 0
  fi
  : >"$F"
}

# Locked read-modify-write. $1 = awk program body for one item row; uses ref/op/st/text/note/now.
# Exit status 3 from awk = no such item.
change() {
  local out="$F.tmp.$$" rc
  lock; migrate; [ -f "$F" ] || : >"$F"
  T_OUT="$out" awk -F'\t' -v OFS='\t' -v ref="$1" -v op="$2" -v now="$(now)" '
    function msg(s) { print s }
    BEGIN { out = ENVIRON["T_OUT"]; st = ENVIRON["T_ST"]; text = ENVIRON["T_TEXT"]; note = ENVIRON["T_NOTE"] }
    /^#/ { print > out; next }
    NF == 0 { next }
    { n++ }
    !hit && ($1 == ref || (ref ~ /^[0-9]+$/ && n == ref + 0)) {
      hit = 1
      if (op == "rm") { msg("removed " $6); next }
      if (op == "status") { $2 = st; if (note != "") $7 = note; else if (st == "open") $7 = ""; msg(st " " $6) }
      if (op == "edit") { $6 = text; msg("updated " text) }
      if (op == "note") { $7 = text; msg("noted " $6) }
      if (op == "link") { $7 = $7; $8 = (text == "-" ? "" : text); msg("linked " $6) }
      $5 = now
    }
    { print > out }
    END { if (!hit) { print "todo: no item \"" ref "\" (see `todo`)" > "/dev/stderr"; exit 3 } }
  ' "$F"
  rc=$?
  if [ $rc -eq 0 ]; then mv "$out" "$F"; else rm -f "$out"; fi
  unlock
  return $rc
}

cmd=${1:-list}; [ $# -gt 0 ] && shift

case $cmd in
  list|ls)
    if [ ! -f "$F" ]; then lock; migrate; unlock; fi
    [ -f "$F" ] || { echo "0 open, 0 total"; exit 0; }
    awk -F'\t' '
      /^#log=on/ { lg = "  (request logging on)"; next }
      /^#/ || NF == 0 { next }
      { n++; if ($2 != "done") o++; row[n] = $0; st[n] = $2; by[n] = $3; tx[n] = $6; nt[n] = $7 }
      END {
        printf "%d open, %d total%s\n", o, n, lg
        m["open"] = "[ ]"; m["in_progress"] = "[~]"; m["blocked"] = "[!]"; m["review"] = "[?]"; m["done"] = "[x]"
        for (i = 1; i <= n; i++) {
          printf "%2d. %s %s%s\n", i, m[st[i]], tx[i], (by[i] != "user" ? "  <" by[i] ">" : "")
          if (nt[i] != "") printf "        - %s\n", nt[i]
        }
      }' "$F"
    ;;
  raw)
    lock; migrate; unlock
    [ -f "$F" ] && cat "$F"
    ;;
  add)
    text=$(clean "$*"); [ -n "$text" ] || die "usage: todo add <text>"
    lock; migrate; [ -f "$F" ] || : >"$F"
    id=$(newid); while cut -f1 "$F" | grep -qx "$id"; do id=$(newid); done
    t=$(now)
    printf '%s\topen\t%s\t%s\t%s\t%s\t\t\n' "$id" "$(by)" "$t" "$t" "$text" >>"$F"
    n=$(grep -vc '^#' "$F")
    unlock
    echo "added $n. $text"
    ;;
  start|block|review|done|open)
    [ $# -ge 1 ] || die "usage: todo $cmd <n|id> [note]"
    case $cmd in start) st=in_progress ;; block) st=blocked ;; review) st=review ;; *) st=$cmd ;; esac
    ref=$1; shift
    T_ST=$st T_NOTE=$(clean "$*") change "$ref" status
    ;;
  edit|note|link)
    [ $# -ge 2 ] || die "usage: todo $cmd <n|id> <text>"
    ref=$1; shift
    text=$(clean "$*"); [ -n "$text" ] || die "empty text"
    T_TEXT=$text change "$ref" "$cmd"
    ;;
  rm|del)
    [ $# -ge 1 ] || die "usage: todo rm <n|id>"
    change "$1" rm
    ;;
  log)
    case ${1:-} in
      on|off)
        lock; migrate; [ -f "$F" ] || : >"$F"
        { [ "$1" = on ] && echo "#log=on"; grep -v '^#log=' "$F"; } >"$F.tmp.$$"; mv "$F.tmp.$$" "$F"
        unlock
        echo "request logging $1"
        ;;
      *) if grep -qx '#log=on' "$F" 2>/dev/null; then echo "request logging on"; else echo "request logging off"; fi ;;
    esac
    ;;
  version|--version) echo "$VERSION" ;;
  *) die "unknown command '$cmd' (list, add, start, block, review, done, open, edit, note, link, rm, log, raw)" ;;
esac
