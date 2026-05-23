import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { SessionKind } from '$lib/core/entities/scheduling/session'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import { Session } from '$lib/core/entities/scheduling/session'

export interface SessionServiceArgs {
  classGroupRepository: ClassGroupRepository
  sessionRepository: SessionRepository
}

export class SessionService {
  constructor(args: SessionServiceArgs) {
    this.classGroups = args.classGroupRepository
    this.sessions = args.sessionRepository
  }

  private readonly classGroups: ClassGroupRepository
  private readonly sessions: SessionRepository

  async createSession({
    id,
    classGroupId,
    title,
    kind,
    startsAt,
    endsAt,
    classSubjectId,
    createdAt,
  }: {
    id: string
    schoolId: string
    classGroupId: string
    title: string
    kind: SessionKind
    startsAt: Date
    endsAt: Date
    classSubjectId?: string
    createdAt?: Date
  }): Promise<Session> {
    await this.requireClassGroup(classGroupId)
    const session = new Session({
      id,
      classGroupId,
      title,
      kind,
      startsAt,
      endsAt,
      classSubjectId,
      createdAt,
    })
    await this.sessions.save(session)
    return session
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }
}
