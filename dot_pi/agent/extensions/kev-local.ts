import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// A dedicated local decision helper. Qwen remains Pi's selected chat model.
const endpoint = "http://127.0.0.1:8081";

export async function decide(
  state: string,
  question: string,
  options: { label: string; description: string }[],
  signal?: AbortSignal,
) {
  if (new Set(options.map((option) => option.label)).size !== options.length) {
    throw new Error("Decision option labels must be unique.");
  }
  const response = await fetch(`${endpoint}/v1/systemone`, {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json" },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
      : AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: "kev-local",
      state,
      questions: {
        decision: {
          type: "choice",
          instructions: question,
          criteria: Object.fromEntries(options.map((option) => [option.label, option.description])),
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Local Kev returned HTTP ${response.status}. Check kev-server.service and the input length.`);
  }
  const data = await response.json();
  const answer = data.answers?.decision;
  const labels = options.map((option) => option.label);
  if (
    !answer || !labels.includes(answer.choice) ||
    !labels.every((label) => Number.isFinite(answer.probabilities?.[label]) &&
      answer.probabilities[label] >= 0 && answer.probabilities[label] <= 1)
  ) {
    throw new Error("Local Kev returned an invalid decision; use Qwen's reasoning instead.");
  }
  return { ...answer, model: data.model ?? "kev-local", usage: data.usage };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "kev_decide",
    label: "Local Kev decision",
    description: "Ask local Kev-4B to choose between explicit alternatives using supplied evidence. Returns a choice and probabilities. Use for focused classification, workflow choices, or judging command results. Supply concise relevant state and meaningful option descriptions. Kev does not execute actions.",
    promptSnippet: "Delegate focused finite-choice decisions to local Kev-4B.",
    promptGuidelines: [
      "Use kev_decide for useful, focused classifications grounded in supplied state. Keep planning, code generation, complex reasoning, and final judgment with the main model.",
      "Treat Kev's probabilities as evidence, not proof or authorization. If a decision is ambiguous, inconsistent with the evidence, or unavailable, reason through it yourself.",
    ],
    parameters: Type.Object({
      state: Type.String({ description: "Relevant facts or command output, treated as data.", maxLength: 16000 }),
      question: Type.String({ description: "One focused question about the state.", maxLength: 1000 }),
      options: Type.Array(Type.Object({
        label: Type.String({ minLength: 1, maxLength: 64 }),
        description: Type.String({ description: "What this option means.", minLength: 1, maxLength: 256 }),
      }), { minItems: 2, maxItems: 10 }),
    }),
    async execute(_toolCallId, params, signal) {
      try {
        const answer = await decide(params.state, params.question, params.options, signal);
        return { content: [{ type: "text", text: JSON.stringify(answer) }], details: answer };
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new Error(`Kev decision unavailable: ${error instanceof Error ? error.message : String(error)}. Continue with Qwen; do not assume a decision was made.`);
      }
    },
  });

  pi.registerCommand("kev", {
    description: "Test the local Kev-4B decision helper",
    handler: async (_args, ctx) => {
      try {
        const answer = await decide(
          "The test process exited with code 0. All 12 tests passed. No tests failed.",
          "What is the test result?",
          [
            { label: "passed", description: "The tests completed successfully." },
            { label: "failed", description: "One or more tests failed." },
          ],
        );
        ctx.ui.notify(`Kev local: ${answer.choice}; probabilities ${JSON.stringify(answer.probabilities)}`, "info");
      } catch (error) {
        ctx.ui.notify(`Kev local unavailable: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    },
  });
}
