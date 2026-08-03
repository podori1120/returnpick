import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const projectRoot = pathResolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(pathResolve(projectRoot, `${specifier.slice(2)}.ts`)).href;
    return { url: target, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
