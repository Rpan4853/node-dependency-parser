import { createReadStream, createWriteStream } from "fs";
import { Commit, DiffLine } from "nodegit";
import { createInterface } from "readline";
import {
  CommitDiffMapping,
  DependencyDiff,
  DependencyMapping,
  FileDiff,
} from ".";

export async function getJsonFieldBounds(
  filePath: string,
  fieldName: string
): Promise<{ start: number; end: number }> {
  const fileStream = createReadStream(filePath);

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  let lineNum = 0;
  let start = 0;
  let insideField = false;
  for await (const line of rl) {
    // Each line in input.txt will be successively available here as `line`.
    lineNum += 1;
    if (line.includes(fieldName)) {
      start = lineNum;
      insideField = true;
    }
    if (insideField && line.includes("}")) {
      return { start, end: lineNum };
    }
  }
  throw `fieldName ${fieldName} not found in ${filePath}`;
}

export function updatePatchChanges(
  patchChanges: DependencyMapping,
  line: DiffLine
): void {
  const parsedLine = line.content().trim().split(" ");
  const [name, version] = parsedLine.map((val) =>
    val.at(-1) == "," ? val.slice(0, -1) : val
  );
  //line was removed
  if (line.origin() == 45) {
    if (name in patchChanges && patchChanges[name].type == "added") {
      if (patchChanges[name].version == version) {
        delete patchChanges[name];
      } else {
        patchChanges[name].type = "updated";
        patchChanges[name].prevVersion = version;
      }
    } else if (!(name in patchChanges)) {
      patchChanges[name] = {
        name,
        version,
        type: "removed",
      };
    }
  }
  //line was added
  else if (line.origin() == 43) {
    if (name in patchChanges && patchChanges[name].type == "removed") {
      if (patchChanges[name].version == version) {
        delete patchChanges[name];
      } else {
        patchChanges[name].type = "updated";
        patchChanges[name].prevVersion = patchChanges[name].version;
        patchChanges[name].version = version;
      }
    } else if (!(name in patchChanges)) {
      patchChanges[name] = {
        name,
        version,
        type: "added",
      };
    }
  }
}

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

export async function writeChangelog(
  latestCommit: Commit,
  commitDependenciesDiffMapping: CommitDiffMapping
) {
  var stream = createWriteStream("CHANGELOG.md", { flags: "w" });
  stream.write(
    `# Latest Commit: ${latestCommit.message().trim()} (${latestCommit
      .sha()
      .trim()}) \n## Dependency Changes`
  );
  stream.end();
}
