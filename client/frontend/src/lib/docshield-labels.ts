export function humanizeDocShieldLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "ai") return "AI";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
