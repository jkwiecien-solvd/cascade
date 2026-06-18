# CASCADE Agent Cost & Iteration Optimizations

This document outlines proposed optimization plans to reduce the number of iterations (LLM turns) and input token usage during autonomous CASCADE agent runs, focusing on the `implementation` agent which currently averages **~115 iterations** per session.

---

## 1. Tool Batching & Parallel Tool Calling
* **Current Behavior:** The agent frequently executes tool calls sequentially (e.g., searching the codebase, reading files, and executing shell commands in separate turns).
* **Proposed Optimization:** 
  * Leverage native LLM parallel tool calling (supported by Claude 3.5 Sonnet and other modern models).
  * Update the backend's tool execution framework to process multiple tool calls (e.g., reading multiple files, running multiple searches) concurrently in a single turn.
* **Expected Benefit:** Reduces overall iteration count by **20–35%** in the discovery and file-reading phases.

---

## 2. Automated Self-Healing & Local Verification Loops
* **Current Behavior:** If a minor issue like a linter error, format check failure, or syntax type error occurs, the agent enters a slow loop: *run verification $\rightarrow$ read error $\rightarrow$ edit file $\rightarrow$ run verification again*. Each cycle consumes a full LLM iteration.
* **Proposed Optimization:**
  * Implement a "Self-Healing Editor" tool wrapper.
  * When executing code updates, the workspace runner can automatically execute localized commands like `eslint --fix` or `prettier --write` and run typescript checks internally.
  * If simple errors can be fixed automatically by standard CLI tools, the system applies them and returns the clean status to the agent without escalating the turn to the LLM.
* **Expected Benefit:** Eliminates **5–15 redundant debug iterations** per modified file.

---

## 3. Intelligent Context Pre-fetching (Preloading)
* **Current Behavior:** The agent spends the first 5–15 iterations finding files using `grep_search`, `list_dir`, and then reading those files.
* **Proposed Optimization:**
  * Enhance the initial agent startup context pipeline (`contextPipeline`).
  * Before the agent boot container starts, perform static analysis on the target PM ticket (acceptance criteria, branch name, or git changes if resuming) to dynamically predict which files are most likely to be edited.
  * Pre-load the contents of these files directly into the initial context or make them available in cache.
* **Expected Benefit:** Saves **5–10 iterations** of early file discovery/reading at session startup.

---

## 4. Consolidation of Git, SCM, and PM Commands
* **Current Behavior:** The final stages of agent completion are highly conversational, involving separate turns for checking git status, committing, pushing, calling GitHub API to create a PR, updating checklists, and updating ticket status.
* **Proposed Optimization:**
  * Introduce a high-level composite tool/action (e.g., `cascade-tools ship-changes --comment "..."`).
  * This composite tool will atomically handle staging, committing, pushing, PR creation/linking, checklist synchronization, and card status transitions under a single CLI invocation.
* **Expected Benefit:** Reduces the finalization phase from **8–10 iterations** down to **1–2 iterations**.

---

## 5. Success Stories & Baseline Metrics
* **`offloadToolsReference` (Flag in Engine Settings):** 
  * *Status:* Implemented in commit `3137303690fb0`.
  * *Impact:* Offloads large `cascade-tools` CLI documentation to `.cascade/context/tools-reference.md`. Saves ~8,000 redundant tokens in the system prompt for every turn. Reduces total session input token usage by **~30%**.
* **Current Baseline Iterations (Average):**
  * `implementation`: 115 iterations
  * `splitting`: 63 iterations
  * `respond-to-review`: 54 iterations
  * `planning`: 51 iterations
  * `review`: 23 iterations
