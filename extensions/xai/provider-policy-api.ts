// Xai API module exposes the plugin public contract.
import type {
  ProviderDefaultThinkingPolicyContext,
  ProviderThinkingProfile,
} from "openclaw/plugin-sdk/plugin-entry";
import { resolveXaiCatalogEntry } from "./model-definitions.js";
import { isXaiGrok46ModelId, normalizeXaiModelId } from "./model-id.js";

export function resolveThinkingProfile(
  ctx: ProviderDefaultThinkingPolicyContext,
): ProviderThinkingProfile {
  const modelId = normalizeXaiModelId(ctx.modelId.trim().toLowerCase());
  const reasoning = ctx.reasoning ?? resolveXaiCatalogEntry(modelId)?.reasoning;
  if (ctx.provider !== "xai" || !reasoning) {
    return { levels: [{ id: "off" }], defaultLevel: "off" };
  }
  if (isXaiGrok46ModelId(modelId)) {
    return {
      levels: [{ id: "low" }, { id: "medium" }, { id: "high" }, { id: "xhigh" }],
      defaultLevel: "high",
    };
  }
  return {
    levels: [{ id: "off" }, { id: "minimal" }, { id: "low" }, { id: "medium" }, { id: "high" }],
    defaultLevel: "low",
  };
}
