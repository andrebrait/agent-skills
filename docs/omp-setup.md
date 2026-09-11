# Using agent-skills with Oh My Pi

Agent Skills includes a native [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi) extension. It uses the same root `skills/` directory as the other integrations, with no copied skill bodies or marketplace dependency.

## Install

Use OMP with native TypeScript extensions and `before_agent_start` system-prompt blocks. The target host baseline is integration commit `6aef0e8ad51b3bc5ea7a5f2a255c3d48e4c5af72`, which includes the external-input and promoted-queue startup fixes. Its reported version is `18.1.17`, but that version string alone does not establish that an installation includes those fixes.

Install the package:

```bash
omp plugin install github:addyosmani/agent-skills
```

For a local clone:

```bash
git clone https://github.com/addyosmani/agent-skills.git
omp plugin link /absolute/path/to/agent-skills
```

Restart OMP after installing. To try a checkout for one session without installing it:

```bash
omp --extension /absolute/path/to/agent-skills
```

Pass the **repository directory**, not just `omp/agent-skills.ts`, so OMP also discovers the sibling `skills/` directory. Do not additionally enable the bootstrap through another configuration entry or copy repository `AGENTS.md` / `CLAUDE.md` into your project.

## Usage

Describe your task and let the agent follow the skill discovery flowchart. To select a skill explicitly, use `/skill:spec-driven-development` (with skill commands enabled). The agent can load it with `read` on `skill://spec-driven-development`.

The bootstrap supplies native OMP tool mappings. This integration does not register aliases such as `/spec` or `/build`, or port Claude's shell hooks. Invoke the underlying skills directly. Existing Claude Code, Codex, and other platform integrations remain unchanged.

## How it works

- `package.json` explicitly declares `omp.extensions` and `omp.skills`. OMP prefers the `omp` manifest over Pi metadata and discovers the conventional root `skills/` directory. The package allowlist includes the extension, canonical skills, their scripts, shared `references/`, and agent personas.
- `omp/agent-skills.ts` resolves the canonical `skills/using-agent-skills/SKILL.md` relative to itself, never relative to the project being worked on or a personal plugin cache.
- On each new user run, `before_agent_start` reads the canonical skill and adds one transient system-prompt block. It replaces only its own marked blocks, preserving other extensions' policy. Successful bootstrap policy is not persisted in the session history.
- There is no per-session cache: subsequent runs, session switches, branches, and tree navigation use the current installed skill. Promoted queued prompts use OMP's normal startup hook; the extension does not replay input or refresh policy per provider request.
- A missing, unreadable, or empty canonical skill removes stale bootstrap policy and produces a visible `agent-skills-bootstrap-error` message. Restoring the file recovers on the next run; individually discoverable skills may remain usable.

Install only packages you trust. OMP loads extension code with your user permissions; its current `isProjectTrusted()` compatibility API is not an enforced project sandbox. This extension reads only its own installed canonical skill, not project configuration.

## Troubleshooting and verification

If the bootstrap is missing, check `omp plugin list` and OMP's extension-loading errors, then restart. If skill names are missing, ensure skill discovery is enabled and that you passed the package directory rather than the extension file. Remove duplicate older adapters before enabling this one.

From a development checkout, Node.js 24 can run the focused regression proof without installing dependencies:

```bash
node --test scripts/omp-bootstrap-test.js
node scripts/validate-versions.js
npm pack --dry-run --json --ignore-scripts
```

The regression proof covers package-relative loading, repeat runs and session navigation, non-duplication, stale-policy removal on read failure, and recovery. The package preview should include `omp/agent-skills.ts`, `skills/using-agent-skills/SKILL.md`, and `references/definition-of-done.md`.

For host verification, start OMP with the package-directory command above, confirm `skill://spec-driven-development` resolves, and submit a second user prompt after switching or branching the session. The discovery policy should remain active without another bootstrap message in history.
