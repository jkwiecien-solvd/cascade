# Pending Upstream Merges

This file tracks branches that need to be merged into the upstream repository in the future.
A Pull Request for these branches should only be created once their prerequisite PRs/branches are merged.

## Branches to Merge

- [ ] **`feature/improve-push-auth-error-message`**
  - **Description:** Improves push failure error reporting (auth/403/401 detection) and allows the stop hook to let the agent exit under terminal push failures (preventing watchdog timeouts).
  - **Prerequisites:** None

- [ ] **`feature/claude-code-xhigh`**
  - **Description:** High/extra-high thinking budget and model settings for the Claude Code backend.
  - **Prerequisites:** None

- [ ] **`feature/push-fail-fast-terminal`**
  - **Description:** Fail-fast on terminal push failure (403/401) — stops the continuation loop and allows clean session exit when `.git/push_failed_terminal` indicator file is present. Prevents agents from draining rate limits after authentication/permission errors.
  - **Prerequisites:** None

- [ ] **`feature/offload-tools-docs`**
  - **Description:** Offload large `cascade-tools` CLI documentation to `.cascade/context/tools-reference.md` via an opt-in flag (`offloadToolsReference`) in engine settings, reducing prompt input token usage by ~30%.
  - **Prerequisites:** None
