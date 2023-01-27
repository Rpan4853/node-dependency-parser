import { createReadStream, createWriteStream } from "fs";
import { Commit, DiffLine } from "nodegit";
import { createInterface } from "readline";
import {
  CommitDiffMapping,
  Dependency,
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
    val.at(-1) == "," || val.at(-1) == ":" ? val.slice(0, -1) : val
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

function getSectionMarkdown(
  section: Dependency[],
  header: string,
  isUpdate?: boolean
) {
  if (section.length < 1) {
    return ``;
  }
  return `##### ${header}\n${section
    .map(
      (dep) =>
        `* \`${dep.name}: ${dep.version}\`${
          isUpdate ? `\`=> ${dep.prevVersion}\`` : ``
        }`
    )
    .join(`\n`)}\n
  `;
}

function getDependenciesMarkdown(
  dependencies: DependencyDiff | null,
  title: string
) {
  if (!dependencies) {
    return ``;
  }
  const header = `#### ${title} \n`;
  const added = getSectionMarkdown(dependencies.added, "Added");
  const removed = getSectionMarkdown(dependencies.removed, "Removed");
  const updated = getSectionMarkdown(dependencies.updated, "Updated", true);
  return `${header}${added}${removed}${updated}`;
}

function getFileMarkdown(file: FileDiff) {
  console.log("file", file);
  const header = `### ${file.fileName} \n`;
  const dependencies = getDependenciesMarkdown(
    file.dependencies,
    "Dependencies"
  );
  const devDependencies = getDependenciesMarkdown(
    file.devDependencies,
    "Dev Dependencies"
  );
  return header + dependencies + devDependencies;
}

export async function writeChangelog(
  latestCommit: Commit,
  commitDependenciesDiffs: FileDiff[]
) {
  var stream = createWriteStream("CHANGELOG.md", { flags: "w" });
  stream.write(
    `# Latest Commit: ${latestCommit
      .message()
      .trim()} \n## Dependency Changes \n${
      commitDependenciesDiffs.length > 0
        ? commitDependenciesDiffs.map((file) => getFileMarkdown(file)).join(``)
        : "#### No dependencies changed"
    }
    `
  );

  stream.end();
}
