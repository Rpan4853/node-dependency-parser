import { DependencyMapping, DependencyDiff } from "..";

export function parseDependencyDiff(
  patchChanges: DependencyMapping
): DependencyDiff | null {
  const dependencyDiff: DependencyDiff = {
    removed: [],
    added: [],
    updated: [],
  };
  if (
    Object.keys(patchChanges).length === 0 &&
    patchChanges.constructor === Object
  ) {
    return null;
  }
  for (const [name, dependency] of Object.entries(patchChanges)) {
    dependencyDiff[dependency.type].push(dependency);
  }
  return dependencyDiff;
}
