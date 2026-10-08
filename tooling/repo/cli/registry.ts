import type { RepoBunSpawnCommand } from './parse-repo-cli'
import { paths } from './lib/paths'

export function resolveRepoCommandScript(command: RepoBunSpawnCommand): string {
  switch (command) {
    case 'dev':
      return paths.dev
    case 'doctor':
      return paths.doctor
    case 'codegen':
      return paths.codegen
  }
}
