
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
