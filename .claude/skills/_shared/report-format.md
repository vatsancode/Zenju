# Shared: Report Format

> Every checker skill ends with this report. Edit this one file to change
> the report style of ALL checker skills.

## Severity meanings

- **MUST** rule violated → ❌ **FAIL** item. The verdict cannot be PASS.
- **SHOULD** rule violated → ⚠️ **WARN** item. Verdict becomes "PASS WITH WARNINGS" at worst.

## Report template

```markdown
## <Skill Name> Report

**Scope:** <N> changed file(s) checked: <short list, or "none">
**Verdict:** ✅ PASS | ⚠️ PASS WITH WARNINGS | ❌ FAIL
**Counts:** <X> failures, <Y> warnings

### Findings
| # | Severity | File:Line | Rule broken | Issue | Suggested fix |
|---|----------|-----------|-------------|-------|----------------|
| 1 | ❌ MUST  | app/dashboard/pos/page.tsx:42 | No hardcoded hex | `style={{color:'#1E3A5F'}}` | use `var(--color-brand-navy)` |

### Notes (optional)
- Pre-existing issues in untouched code (FYI only, not counted).
```

## Behaviour rules

1. **Report only.** Do NOT edit any file to fix a finding. The user decides
   what to fix; they can say "fix them" after reading the report.
2. If there are zero findings, still print the report with verdict ✅ PASS
   and the list of files that were checked — proof of what was covered.
3. Keep each Issue and Suggested fix to one line. Details can go in Notes.
4. Order findings most severe first, then by file path.
