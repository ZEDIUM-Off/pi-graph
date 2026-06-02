export function textResult(title: string, lines: string[] = []) { return [title, ...lines].join("\n"); }
export function markdownCode(lang: string, body: string) { return `\`\`\`${lang}\n${body}\n\`\`\``; }
