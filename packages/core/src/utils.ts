import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const resolvePackageVersion = async (
  moduleUrl: string,
  packagePathRelativeToModule: string,
): Promise<string> => {
  try {
    const currentDir = path.dirname(fileURLToPath(moduleUrl));
    const packagePath = path.resolve(currentDir, packagePathRelativeToModule);
    const contents = await fs.readFile(packagePath, "utf8");
    const parsed = JSON.parse(contents) as { version?: string };

    return parsed.version || "";
  } catch {
    return "";
  }
};
