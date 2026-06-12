export function frontmatter(values: Record<string, string | string[] | number | boolean | null | undefined>) {
  const lines = ["---"];

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${escapeYamlScalar(item)}`);
      }
      continue;
    }

    lines.push(`${key}: ${escapeYamlScalar(String(value))}`);
  }

  lines.push("---");
  return `${lines.join("\n")}\n`;
}

export function bullet(value: string | number | null | undefined, fallback = "없음") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

export function markdownList(items: string[]) {
  if (!items.length) {
    return "- 없음";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function escapeYamlScalar(value: string) {
  if (/^[a-zA-Z0-9_-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}
