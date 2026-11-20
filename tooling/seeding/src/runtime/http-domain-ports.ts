import type { HttpSeedClient } from '../transport/http/client'
import { createHttpAccessSeedPort } from '../domains/access/adapters/http'
import { createHttpActivitiesSeedPort } from '../domains/activities/adapters/http'
import { createHttpAssessmentsSeedPort } from '../domains/assessments/adapters/http'
import { createHttpAttachmentsSeedPort } from '../domains/attachments/adapters/http'
import { createHttpAttendanceSeedPort } from '../domains/attendance/adapters/http'
import { createHttpAuthLinkSeedPort } from '../domains/auth-link/adapters/http'
import { createHttpCommunicationsSeedPort } from '../domains/communications/adapters/http'
import { createHttpCurriculumSeedPort } from '../domains/curriculum/adapters/http'
import { createHttpDisciplineSeedPort } from '../domains/discipline/adapters/http'
import { createHttpDocumentsSeedPort } from '../domains/documents/adapters/http'
import { createHttpFamilyFeedbackSeedPort } from '../domains/family-feedback/adapters/http'
import { createHttpFinanceSeedPort } from '../domains/finance/adapters/http'
import { createHttpPopulationSeedPort } from '../domains/population/adapters/http'
import { createHttpProfilePicturesSeedPort } from '../domains/profile-pictures/adapters/http'
import { createHttpReportCardsSeedPort } from '../domains/report-cards/adapters/http'
import { createHttpSchedulingSeedPort } from '../domains/scheduling/adapters/http'
import { createHttpSchoolBrandingSeedPort } from '../domains/school-branding/adapters/http'
import { createHttpSchoolLifeSeedPort } from '../domains/school-life/adapters/http'
import { createHttpSchoolStructureSeedPort } from '../domains/school-structure/adapters/http'
import { createHttpStudentSupportSeedPort } from '../domains/student-support/adapters/http'
import { createHttpTeachersSeedPort } from '../domains/teachers/adapters/http'

export function createHttpDomainSeedPorts(
  client: HttpSeedClient,
  serviceAccountApiKey: string | undefined,
) {
  return {
    authLinkPort: createHttpAuthLinkSeedPort({ client, serviceAccountApiKey }),
    schoolStructurePort: createHttpSchoolStructureSeedPort({ client, serviceAccountApiKey }),
    populationPort: createHttpPopulationSeedPort({ client, serviceAccountApiKey }),
    curriculumPort: createHttpCurriculumSeedPort({ client, serviceAccountApiKey }),
    teachersPort: createHttpTeachersSeedPort({ client, serviceAccountApiKey }),
    schedulingPort: createHttpSchedulingSeedPort({ client, serviceAccountApiKey }),
    attendancePort: createHttpAttendanceSeedPort({ client, serviceAccountApiKey }),
    assessmentsPort: createHttpAssessmentsSeedPort({ client, serviceAccountApiKey }),
    reportCardsPort: createHttpReportCardsSeedPort({ client, serviceAccountApiKey }),
    financePort: createHttpFinanceSeedPort({ client, serviceAccountApiKey }),
    documentsPort: createHttpDocumentsSeedPort({ client, serviceAccountApiKey }),
    familyFeedbackPort: createHttpFamilyFeedbackSeedPort({ client, serviceAccountApiKey }),
    activitiesPort: createHttpActivitiesSeedPort({ client, serviceAccountApiKey }),
    schoolLifePort: createHttpSchoolLifeSeedPort({ client, serviceAccountApiKey }),
    studentSupportPort: createHttpStudentSupportSeedPort({ client, serviceAccountApiKey }),
    disciplinePort: createHttpDisciplineSeedPort({ client, serviceAccountApiKey }),
    communicationsPort: createHttpCommunicationsSeedPort({ client, serviceAccountApiKey }),
    attachmentsPort: createHttpAttachmentsSeedPort({ client, serviceAccountApiKey }),
    profilePicturesPort: createHttpProfilePicturesSeedPort({ client, serviceAccountApiKey }),
    schoolBrandingPort: createHttpSchoolBrandingSeedPort({ client, serviceAccountApiKey }),
  }
}

export { createHttpAccessSeedPort }
