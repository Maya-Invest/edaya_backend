import type { Module } from '$lib/core/entities/academics/module'
import type { Classroom } from '$lib/core/entities/core/classroom'
import type { SessionKind } from '$lib/core/entities/scheduling/session'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import { Session } from '$lib/core/entities/scheduling/session'

export interface SessionServiceArgs {
  classroomRepository: ClassroomRepository
  moduleRepository: ModuleRepository
  sessionRepository: SessionRepository
}

export class SessionService {
  constructor(args: SessionServiceArgs) {
    this.classrooms = args.classroomRepository
    this.modules = args.moduleRepository
    this.sessions = args.sessionRepository
  }

  private readonly classrooms: ClassroomRepository
  private readonly modules: ModuleRepository
  private readonly sessions: SessionRepository

  async createSession({
    id,
    classroomId,
    title,
    kind,
    startsAt,
    endsAt,
    moduleId,
    createdAt,
  }: {
    id: string
    schoolId: string
    classroomId: string
    title: string
    kind: SessionKind
    startsAt: Date
    endsAt: Date
    moduleId?: string
    createdAt?: Date
  }): Promise<Session> {
    await this.requireClassroom(classroomId)
    if (moduleId) {
      const module = await this.requireModule(moduleId)
      if (module.classroomId !== classroomId) {
        throw new Error(`Module ${moduleId} does not belong to classroom ${classroomId}`)
      }
    }
    const session = new Session({
      id,
      classroomId,
      title,
      kind,
      startsAt,
      endsAt,
      moduleId,
      createdAt,
    })
    await this.sessions.save(session)
    return session
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }

  private async requireModule(moduleId: string): Promise<Module> {
    const module = await this.modules.findById(moduleId)
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`)
    }
    return module
  }
}
