// Test routing specs for channel plugins split into dedicated Vitest configs.
// This runtime-focused variant does not keep channel plugin shards in-tree.
export const splitChannelExtensionShardSpecs = [];

export const splitChannelExtensionTestRoots = [];

export function resolveSplitChannelExtensionShard(root) {
  const normalizedRoot = root.replaceAll("\\", "/");
  return splitChannelExtensionShardSpecs.find(
    (spec) => spec.root === normalizedRoot,
  );
}
