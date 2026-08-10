export interface ConditionalBranchConfig {
  /** Position (1-indexed) of the step whose output to check. Defaults to the immediately preceding step. */
  source_step_position?: number;
  operator?: "contains" | "equals" | "not_contains";
  value: string;
  /** How many of the immediately following steps to skip when the condition is false. */
  skip_steps_if_false?: number;
}

export interface ConditionalBranchResult {
  condition_met: boolean;
  evaluated_value: string;
  skip_steps: number;
}

function extractText(output: unknown): string {
  if (output === null || output === undefined) return "";
  if (typeof output === "string") return output;
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
  }
  return JSON.stringify(output);
}

/**
 * Evaluates a previous step's output against a simple condition. This has no
 * separate "branch" nodes in the schema - a linear step list plus a skip
 * count is enough to express the IF/ELSE example in the spec (skip the
 * approval gate when the condition is false).
 */
export function evaluateConditionalBranch(
  config: ConditionalBranchConfig,
  previousOutputByPosition: Record<number, unknown>,
  currentPosition: number
): ConditionalBranchResult {
  const sourcePosition = config.source_step_position ?? currentPosition - 1;
  const text = extractText(previousOutputByPosition[sourcePosition]).toLowerCase();
  const value = (config.value ?? "").toLowerCase();
  const operator = config.operator ?? "contains";

  let conditionMet: boolean;
  switch (operator) {
    case "equals":
      conditionMet = text === value;
      break;
    case "not_contains":
      conditionMet = !text.includes(value);
      break;
    case "contains":
    default:
      conditionMet = text.includes(value);
      break;
  }

  return {
    condition_met: conditionMet,
    evaluated_value: text,
    skip_steps: conditionMet ? 0 : (config.skip_steps_if_false ?? 0),
  };
}
