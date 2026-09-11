"use strict";

const assert = require("node:assert/strict");
const { copyFile, mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

async function sandbox(t) {
  const root = await mkdtemp(path.join(tmpdir(), "agent-skills-omp-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const extension = path.join(root, "omp", "agent-skills.ts");
  const skill = path.join(root, "skills", "using-agent-skills", "SKILL.md");
  await mkdir(path.dirname(extension), { recursive: true });
  await mkdir(path.dirname(skill), { recursive: true });
  await copyFile(path.join(__dirname, "..", "omp", "agent-skills.ts"), extension);
  const { default: register } = await import(pathToFileURL(extension).href);
  const handlers = new Map();
  register({ on: (event, handler) => handlers.set(event, handler) });
  const emit = (type, event = {}) => handlers.get(type)?.({ type, ...event }, { cwd: process.cwd() });
  return { root, skill, emit };
}

const START = "<omp-agent-skills-bootstrap>";
const END = "</omp-agent-skills-bootstrap>";
const ownedBlocks = (blocks) => blocks.filter((block) => block.startsWith(START) && block.endsWith(END));

test("bootstrap uses its package root and refreshes once per run across session navigation", async (t) => {
  const { skill, emit } = await sandbox(t);
  const other = `Another extension quotes ${START} without owning this block.`;
  const original = Object.freeze(["Base policy", other]);
  let blocks = original;
  let previousBody;

  for (const lifecycle of ["session_start", "session_switch", "session_tree", "session_branch"]) {
    const body = `# Canonical workflow for ${lifecycle}\nRead the matching skill.`;
    await writeFile(skill, `\uFEFF---\r\nname: using-agent-skills\r\ndescription: Discovery\r\n---\r\n${body}\n`);
    await emit(lifecycle);
    const result = await emit("before_agent_start", { prompt: "A new user run", systemPrompt: blocks });
    blocks = result.systemPrompt;
    assert.deepEqual(blocks.slice(0, 2), original);
    assert.equal(ownedBlocks(blocks).length, 1);
    assert.ok(blocks[2].includes(body));
    assert.ok(blocks[2].includes(skill));
    assert.ok(!blocks[2].includes("description: Discovery"));
    if (previousBody) assert.ok(!blocks[2].includes(previousBody));
    assert.equal(result.message, undefined);

    // A chained invocation must replace its own block, not grow the prompt.
    const repeated = await emit("before_agent_start", { prompt: "Another run", systemPrompt: blocks });
    assert.deepEqual(repeated.systemPrompt, blocks);
    previousBody = body;
  }
});

test("a failed read removes stale policy, reports the error, and recovers next run", async (t) => {
  const { skill, emit } = await sandbox(t);
  await writeFile(skill, "# Previous policy\n");
  const first = await emit("before_agent_start", { prompt: "First run", systemPrompt: ["Base policy"] });
  await rm(skill);

  const failed = await emit("before_agent_start", { prompt: "Next run", systemPrompt: first.systemPrompt });
  assert.deepEqual(failed.systemPrompt, ["Base policy"]);
  assert.equal(failed.message.display, true);
  assert.ok(failed.message.content.includes(skill));
  assert.ok(failed.message.content.includes("ENOENT"));

  await writeFile(skill, "# Recovered policy\n");
  const recovered = await emit("before_agent_start", { prompt: "Retry", systemPrompt: failed.systemPrompt });
  assert.equal(ownedBlocks(recovered.systemPrompt).length, 1);
  assert.ok(recovered.systemPrompt[1].includes("# Recovered policy"));
  assert.equal(recovered.message, undefined);
});
