import type { Module } from '$lib/core/entities/module'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ModuleRepository extends BaseRepositoryInterface<Module> {
  listByClassroom: (classroomId: string) => Promise<Module[]>
}
