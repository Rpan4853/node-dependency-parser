import { createReadStream } from "fs";
import { createInterface } from "readline";

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
