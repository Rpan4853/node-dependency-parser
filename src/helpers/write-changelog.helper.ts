import { createWriteStream } from "fs";
import { Commit } from "nodegit";
import { Dependency, DependencyDiff, FileDiff } from "..";

function getSectionMarkdown(
  section: Dependency[],
  header: string,
  isUpdate?: boolean
) {
  if (section.length < 1) {
    return ``;
  }
  return `>##### ${header}\n${section
    .map(
      (dep) =>
        `>* \`${dep.name}: ${dep.prevVersion}\`${
          isUpdate ? `\`=> ${dep.version}\`` : ``
        }`
    )
    .join(`\n`)}
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
  return `${header}${added}${removed}${updated}`.trim();
}

function getFileMarkdown(file: FileDiff) {
  const header = `### \`${file.fileName}\` \n`;
  const dependencies = getDependenciesMarkdown(
    file.dependencies,
    "Dependencies"
  );
  const devDependencies = getDependenciesMarkdown(
    file.devDependencies,
    "Dev Dependencies"
  );
  return `${header}${dependencies}\n${devDependencies}\n`;
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
