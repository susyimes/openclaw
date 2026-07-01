// Test routing roots for model provider extension suites.
import { bundledPluginRoot } from "../../scripts/lib/bundled-plugin-paths.mjs";

export const providerExtensionIds = [
  "anthropic",
  "deepseek",
  "kimi-coding",
  "lmstudio",
  "ollama",
  "openrouter",
  "qwen",
  "volcengine",
];

export const providerOpenAiExtensionIds = ["openai"];

export const providerExtensionTestRoots = providerExtensionIds.map((id) => bundledPluginRoot(id));
export const providerOpenAiExtensionTestRoots = providerOpenAiExtensionIds.map((id) =>
  bundledPluginRoot(id),
);

export function isProviderExtensionRoot(root) {
  return providerExtensionTestRoots.includes(root);
}

export function isProviderOpenAiExtensionRoot(root) {
  return providerOpenAiExtensionTestRoots.includes(root);
}
