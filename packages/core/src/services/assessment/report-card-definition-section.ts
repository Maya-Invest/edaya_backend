import type { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import type { ReportCardDefinitionSectionKind } from '../../entities/assessments/report-card-definition-section'
import type { ReportCardDefinitionRepository } from '../../ports/report-card-definition-repository'
import type { ReportCardDefinitionSectionRepository } from '../../ports/report-card-definition-section-repository'
import { ReportCardDefinitionSection } from '../../entities/assessments/report-card-definition-section'

export interface ReportCardDefinitionSectionServiceArgs {
  reportCardDefinitionRepository: ReportCardDefinitionRepository
  reportCardDefinitionSectionRepository: ReportCardDefinitionSectionRepository
}

export class ReportCardDefinitionSectionService {
  constructor(args: ReportCardDefinitionSectionServiceArgs) {
    this.definitions = args.reportCardDefinitionRepository
    this.sections = args.reportCardDefinitionSectionRepository
  }

  private readonly definitions: ReportCardDefinitionRepository
  private readonly sections: ReportCardDefinitionSectionRepository

  async createReportCardDefinitionSection({
    id,
    reportCardDefinitionId,
    kind,
    name,
    weight,
    parentSectionId,
    subjectId,
    createdAt,
  }: {
    id: string
    reportCardDefinitionId: string
    kind: ReportCardDefinitionSectionKind
    name: string
    weight: number
    parentSectionId?: string
    subjectId?: string
    createdAt?: Date
  }): Promise<ReportCardDefinitionSection> {
    await this.requireDefinition(reportCardDefinitionId)
    if (parentSectionId) {
      const parent = await this.sections.findById(parentSectionId)
      if (!parent) {
        throw new Error(`Unknown parent report card section: ${parentSectionId}`)
      }
      if (parent.reportCardDefinitionId !== reportCardDefinitionId) {
        throw new Error('Parent report card section must belong to the same report card definition')
      }
    }

    const section = new ReportCardDefinitionSection({
      id,
      reportCardDefinitionId,
      kind,
      name,
      weight,
      parentSectionId,
      subjectId,
      createdAt,
    })
    await this.sections.save(section)
    return section
  }

  private async requireDefinition(reportCardDefinitionId: string): Promise<ReportCardDefinition> {
    const definition = await this.definitions.findById(reportCardDefinitionId)
    if (!definition) {
      throw new Error(`Unknown report card definition: ${reportCardDefinitionId}`)
    }
    return definition
  }
}
