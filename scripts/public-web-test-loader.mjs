import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const projectRoot = pathResolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(pathResolve(projectRoot, `${specifier.slice(2)}.ts`)).href;
    return { url: target, shortCircuit: true };
  }
  if (specifier === "next/server") {
    return { url: pathToFileURL(pathResolve(projectRoot, "node_modules/next/server.js")).href, shortCircuit: true };
  }
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export%20default%20undefined", shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
