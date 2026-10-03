import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
export const repositoryNames = Object.freeze(["backend", "frontend", "mobile"]);
export function candidateRepositories(root, run = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim()) {
  return Object.fromEntries(repositoryNames.map(name => {
    const directory = resolve(root, `edaya_${name}`);
    const sha = run(["rev-parse", "HEAD"], directory);
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`Invalid ${name} candidate commit`);
    return [name, { sha, repository: run(["config", "--get", "remote.origin.url"], directory).replace(/https:\/\/[^/]*@/, "https://") }];
  }));
}
export function candidateCommits(repositories) {
  if (Object.keys(repositories).sort().join() !== [...repositoryNames].sort().join()) throw new Error("Candidate must contain exactly backend, frontend and mobile");
  return Object.fromEntries(repositoryNames.map(name => [name, repositories[name].sha]));
}
export function assertReleaseMutationAllowed(env = process.env) {
  if (env.VALIDATE_ONLY === "true") throw new Error("VALIDATE_ONLY forbids publication, deployment and live data changes");
  if (env.VALIDATE_ONLY !== undefined && env.VALIDATE_ONLY !== "false") throw new Error("VALIDATE_ONLY must be explicit true or false");
}
