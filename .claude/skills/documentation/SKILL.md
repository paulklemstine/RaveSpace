---
name: documentation
description: Documentation requirements and engineering diary format. Use when completing features, writing docs, or updating the development log.
---

# Documentation Requirements

## Documentation Workflow

1. **During Development:** Create/update technical docs for new features in `docs/`
2. **After Implementation:** Update `docs/AI_DEVELOPMENT_LOG.md`
3. **Before Committing:** Ensure related docs are included in the commit

## Feature Documentation (`docs/`)

When implementing significant features, create dedicated markdown files:
- **Architecture decisions** — explain why you chose a particular approach
- **System design** — document how components interact
- **Configuration** — document tuneable parameters and their rationale
- **Trade-offs** — explain costs, performance implications, edge cases
- **Testing guide** — how to manually test the feature

## Engineering Diary Format

**ALWAYS update `docs/AI_DEVELOPMENT_LOG.md` after completing work.**

```markdown
### [YYYY-MM-DD HH:MM] Feature/Fix Name

**Task:** Brief description of what needed to be done

**Approach:**
- Key decision 1
- Key decision 2

**Changes:**
- `file/path.ts` — What changed and why
- `file/path2.ts` — What changed and why

**Challenges:**
- Problem encountered and solution

**Testing:**
- How it was tested (unit tests, manual testing, etc.)

**Commit:** [abc1234] Commit message
```

## Best Practices

- **Write docs as you code** — don't wait until the end
- **Be specific** — include code snippets, configuration values, file paths
- **Explain "why"** — not just "what" but "why did we choose this approach"
- **Update existing docs** — when changing behavior, update related documentation
- **Link between docs** — cross-reference related documentation files
