// Test routing roots for miscellaneous provider/tool extension suites.
export const miscExtensionTestRoots = [
  "extensions/admin-http-rpc",
  "extensions/brave",
  "extensions/device-pair",
  "extensions/diagnostics-otel",
  "extensions/diagnostics-prometheus",
  "extensions/duckduckgo",
  "extensions/exa",
  "extensions/firecrawl",
  "extensions/llm-task",
  "extensions/oc-path",
  "extensions/openshell",
  "extensions/parallel",
  "extensions/policy",
  "extensions/searxng",
  "extensions/synthetic",
  "extensions/tavily",
  "extensions/thread-ownership",
  "extensions/tokenjuice",
  "extensions/web-readability",
];

export function isMiscExtensionRoot(root) {
  return miscExtensionTestRoots.includes(root);
}
