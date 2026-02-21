---
name: git-workflow
description: Git worktree workflow for parallel feature development. Use when creating branches, starting features, or managing worktrees.
---

# Git Worktree Workflow

## Why Worktrees?

- Work on multiple features simultaneously without switching branches
- Keep dev server running in one worktree while working in another
- Each worktree has its own working directory and node_modules
- Test features in isolation without merge conflicts

## Repository Structure

```
RaveSpace/                # Main worktree (production/main branch)
├── .git/                 # Git metadata (shared by all worktrees)
├── src/
├── package.json
└── ...

RaveSpace-feature-1/      # Feature worktree (sibling directory)
RaveSpace-feature-2/      # Another feature worktree
```

## Creating a New Worktree

```bash
# From main repository
cd /mnt/c/Gauntlet/RaveSpace

# Create worktree with new branch
git worktree add ../RaveSpace-feature-name -b feature-name

# Set up dependencies
cd ../RaveSpace-feature-name
npm install
npm run dev
```

## Full Workflow

1. **Create worktree:**
   ```bash
   git worktree add ../RaveSpace-shader-effects -b feature/shader-effects
   ```

2. **Work in worktree:**
   ```bash
   cd ../RaveSpace-shader-effects
   npm install
   # Make changes, commit
   ```

3. **Merge when ready:**
   ```bash
   cd /mnt/c/Gauntlet/RaveSpace
   git checkout main
   git merge feature/shader-effects
   ```

4. **Clean up:**
   ```bash
   git worktree remove ../RaveSpace-shader-effects
   git branch -d feature/shader-effects
   ```

## Commands

| Command | Purpose |
|---------|---------|
| `git worktree list` | List all worktrees |
| `git worktree add ../NAME -b BRANCH` | Create new worktree |
| `git worktree remove ../NAME` | Remove a worktree |
| `git worktree prune` | Clean up stale entries |

## Rules

- **NEVER switch branches** in main worktree — create a new worktree instead
- **ALWAYS create worktree** for new features, experiments, or bug fixes
- **Keep main worktree clean** — only merge from feature worktrees
- **Delete worktrees** after merging to avoid clutter
- **Run `npm install`** in each new worktree (separate node_modules)
