/**
 * Minimal template resolver so a step's config can reference an earlier
 * step's output, e.g. { "prompt": "Classify: {{step_1.output}}" }.
 * Steps are addressed by position (1-indexed, matching workflow_steps.position).
 */
export function resolveTemplate(
  value: unknown,
  outputsByPosition: Record<number, unknown>
): unknown {
  if (typeof value === "string") {
    return value.replace(/{{\s*step_(\d+)\.output\s*}}/g, (_match, pos) => {
      const output = outputsByPosition[Number(pos)];
      if (output === undefined) return "";
      return typeof output === "string" ? output : JSON.stringify(output);
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplate(v, outputsByPosition));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveTemplate(val, outputsByPosition);
    }
    return result;
  }
  return value;
}
