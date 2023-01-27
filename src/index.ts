import { Repository } from "nodegit";
import path from "path";
import {
  getJsonFieldBounds,
  updatePatchChanges,
  parseDependencyDiff,
} from "./helpers";
//Removed dependencies, added dependencies, updated dependencies (versions)

export interface Dependency {
  name: string;
  version: string;
  type: "removed" | "added" | "updated";
  prevVersion?: string;
}

export interface DependencyMapping {
  [name: string]: Dependency;
}

export interface DependencyDiff {
  removed: Dependency[];
  added: Dependency[];
  updated: Dependency[];
}

export interface FileDiff {
  dependencies: DependencyDiff;
  devDependencies: DependencyDiff;
}
export interface CommitDiffMapping {
  [fileName: string]: FileDiff;
}

async function parseCommitDependenciesDiff() {
  //map file path to added, deleted, and/or updateed dependencies
  const commitDiffMapping: CommitDiffMapping = {};

  const repo = await Repository.open(path.resolve(__dirname, "../.git"));
  const currentBranchReference = await repo.getCurrentBranch();
  const latestCommit = await repo.getBranchCommit(currentBranchReference);
  const diffList = await latestCommit.getDiff();
  for (const diff of diffList) {
    const patches = await diff.patches();

    for (const patch of patches) {
      const fileName = patch.newFile().path().split("/").at(-1);
      if (fileName == "package.json") {
        const patchChanges: DependencyMapping = {};
        const patchDevChanges: DependencyMapping = {};

        //get line ranges for depencies and devDependencies
        const dependenciesBounds = await getJsonFieldBounds(
          patch.newFile().path(),
          `"dependencies`
        );
        const devDependenciesBounds = await getJsonFieldBounds(
          patch.newFile().path(),
          `"devDependencies"`
        );

        const hunks = await patch.hunks();
        for (const hunk of hunks) {
          const lines = await hunk.lines();
          let lineCount = hunk.newStart() - 1;

          for (const line of lines) {
            //line.origin() returns an ASCII charCode, 43 is a +, 45 is a -
            if (line.origin() != 45) {
              lineCount++;
            }

            //lines are within dependencies or devDepencies range
            if (
              dependenciesBounds.start <= lineCount &&
              dependenciesBounds.end >= lineCount &&
              !line.content().trim().includes(`"dependencies`) &&
              !line.content().trim().includes("}")
            ) {
              updatePatchChanges(patchChanges, line);
            } else if (
              devDependenciesBounds.start <= lineCount &&
              devDependenciesBounds.end >= lineCount &&
              !line.content().trim().includes(`"devDependencies`) &&
              !line.content().trim().includes("}")
            ) {
              updatePatchChanges(patchDevChanges, line);
            }
          }
        }

        commitDiffMapping[patch.newFile().path()] = {
          dependencies: parseDependencyDiff(patchChanges),
          devDependencies: parseDependencyDiff(patchDevChanges),
        };
      }
    }
  }
  console.log(commitDiffMapping);
}

parseCommitDependenciesDiff();
