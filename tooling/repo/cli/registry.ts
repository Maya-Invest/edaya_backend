import type { RepoSpawnCommand } from './parse-repo-cli'
import { paths } from './lib/paths'

export function resolveRepoCommandScript(command: RepoSpawnCommand): string {
  switch (command) {
    case 'dev':
      return paths.dev
    case 'seed':
      return paths.seed
    case 'doctor':
      return paths.doctor
  }
}
