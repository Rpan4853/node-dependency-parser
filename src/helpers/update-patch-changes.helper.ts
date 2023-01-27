import { DiffLine } from "nodegit";
import { DependencyMapping } from "..";

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
