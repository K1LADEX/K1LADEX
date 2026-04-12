
---

## SESSION EXAMPLE — April 6, 2026 (Recommendation → Verdict)

**Change:** Recommendation: → Verdict: in PDF output (line 656)
**Reason:** Legal compliance — "Recommendation" implies investment advice. K1LADEX does not give advice.
**Commit:** eef7bed — legal compliance: Recommendation→Verdict in PDF output
**Result:** One grep, one sed, one verify, one push. Clean.

---

## CLAUDE CODE RAW OUTPUT RULE

When Claude Code returns a summary instead of actual text — it is interpreting, not showing. That breaks the grep-before-sed workflow.

Force raw output with:
  awk 'NR>=START && NR<=END' ~/K1LADEX/index.html
or
  cat -n ~/K1LADEX/index.html | sed -n 'START,ENDp'

Never write a sed command based on a summarized description. Raw text only. Always.

---

## THE ONE & DONE RULE
**Locked April 12, 2026 — Based on the session that proved it.**

Every change lands first attempt because the file is read before it is touched.

### The 8 Rules
1. Grep before every edit — no exceptions. Never write a command blind.
2. Pull exact lines before writing any command. See the string, then replace it.
3. Python for block inserts — no quote escaping issues, no sed multiline problems.
4. `sed -i ''` for single string replacements — macOS requires the empty string after -i.
5. Verify grep after every change before pushing. Never push blind.
6. One push at the end — Batch Deploy Rule holds. No mid-session pushes.
7. Mac terminal only — Claude Code summarizes. Terminal shows truth.
8. Never touch Cloudflare dashboard — one git push deploys both GitHub Pages and Worker via GitHub Actions.

### Founding Template
April 12, 2026. Design system alignment, live stats panel, SIGNAL+ icon row,
dynamic canvas DPR scaling. Zero failed commands. Zero loops. Zero Claude Code.
Every change landed first attempt.

*"Slow and deliberate."*
