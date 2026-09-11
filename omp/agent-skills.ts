import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const START = "<omp-agent-skills-bootstrap>";
const END = "</omp-agent-skills-bootstrap>";
const skillPath = fileURLToPath(new URL("../skills/using-agent-skills/SKILL.md", import.meta.url));

export default function agentSkills(omp: ExtensionAPI): void {
  // OMP runs this once per new user run, including promoted queued prompts.
  // Keep policy transient and reread it: session navigation needs no cached state.
  omp.on("before_agent_start", async (event) => {
    const systemPrompt = event.systemPrompt.filter((block) => !(block.startsWith(START) && block.endsWith(END)));
    try {
      const source = await readFile(skillPath, "utf8");
      const body = source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
      if (!body) throw new Error("canonical skill is empty");
      systemPrompt.push(`${START}
agent-skills loaded. Use the skill discovery flowchart to find the right skill for your task.

The using-agent-skills skill below is already loaded for this OMP run. Do not load it again.
Canonical skill: ${skillPath}
Resolve relative references in this skill from its containing directory.

${body}

## Oh My Pi tool mapping

- Invoke another skill with the native read tool on skill://<name>. Users can invoke /skill:<name> when skill commands are enabled.
- Use OMP's native task tool for delegated work when available, not Claude Code's Agent tool or subagent_type. Do not assume a named agent exists unless OMP lists it.
- Use the native todo tool for task tracking when available; do not invent tools or commands that this session does not expose.
- Use native read, edit, write, bash, grep, and glob tools when exposed in this session. Follow OMP's tool schemas rather than Pi or Claude-specific APIs.
${END}`);
      return { systemPrompt };
    } catch (error) {
      return {
        systemPrompt,
        message: {
          customType: "agent-skills-bootstrap-error",
          content: `agent-skills activation unavailable: cannot load ${skillPath}: ${error instanceof Error ? error.message : String(error)}. Skills may still be available individually.`,
          display: true,
        },
      };
    }
  });
}
