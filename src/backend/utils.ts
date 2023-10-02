import path from "path";
import * as fs from "fs";
export function getProjectsPath() {
  return path.join("./", "projects");
}

if (!fs.existsSync(getProjectsPath())) {
  fs.mkdirSync(getProjectsPath(), {
    recursive: true,
  });
}
