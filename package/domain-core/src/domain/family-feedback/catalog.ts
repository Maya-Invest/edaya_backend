export const FAMILY_FEEDBACK_QUESTION_VERSION = 'family-feedback.v1' as const
export type FamilyFeedbackQuestionVersion = typeof FAMILY_FEEDBACK_QUESTION_VERSION

export const FAMILY_FEEDBACK_QUESTION_IDS = [
  'communication',
  'clarity',
  'support',
  'student_experience',
] as const

export type FamilyFeedbackQuestionId = typeof FAMILY_FEEDBACK_QUESTION_IDS[number]

export const FAMILY_FEEDBACK_SCORED_VALUES = [1, 2, 3, 4, 5] as const
export type FamilyFeedbackScoredValue = typeof FAMILY_FEEDBACK_SCORED_VALUES[number]
export const FAMILY_FEEDBACK_CANNOT_ASSESS = 'cannot_assess' as const
export type FamilyFeedbackAnswer = FamilyFeedbackScoredValue | typeof FAMILY_FEEDBACK_CANNOT_ASSESS

export const FAMILY_FEEDBACK_COMMENT_MAX_CHARS = 2000
export const FAMILY_FEEDBACK_SCORED_SUBJECT_THRESHOLD = 10
export const FAMILY_FEEDBACK_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const FAMILY_FEEDBACK_PURGE_WARN_MS = 14 * 24 * 60 * 60 * 1000
export const FAMILY_FEEDBACK_FINAL_REMINDER_MS = 48 * 60 * 60 * 1000

export type FamilyFeedbackLocale = 'fr' | 'en'

export interface FamilyFeedbackInstrumentVars {
  studentName: string
  teacherName: string
  subjectName: string
  className: string
  periodName: string
}

const SCALE_LABELS: Record<FamilyFeedbackLocale, Record<FamilyFeedbackAnswer, string>> = {
  fr: {
    1: 'Très insatisfait',
    2: 'Insatisfait',
    3: 'Neutre',
    4: 'Satisfait',
    5: 'Très satisfait',
    cannot_assess: 'Je ne peux pas évaluer',
  },
  en: {
    1: 'Very dissatisfied',
    2: 'Dissatisfied',
    3: 'Neutral',
    4: 'Satisfied',
    5: 'Very satisfied',
    cannot_assess: 'Cannot assess',
  },
}

const INTRO: Record<FamilyFeedbackLocale, string> = {
  fr: 'Ce questionnaire porte sur l’accompagnement de {studentName} par {teacherName} en {subjectName} ({className}, {periodName}). Répondez à partir de ce que la famille peut observer (échanges, consignes, suivi). Ce n’est pas une observation de classe ni une note.',
  en: 'This questionnaire is about {teacherName}’s work with {studentName} in {subjectName} ({className}, {periodName}). Answer from what the family can observe (messages, instructions, follow-up). This is not classroom observation or a grade.',
}

const SCALE_HELPER: Record<FamilyFeedbackLocale, string> = {
  fr: 'Choisissez “Je ne peux pas évaluer” si la famille n’a pas assez d’éléments (par exemple aucun échange sur ce point).',
  en: 'Choose “Cannot assess” if the family has not seen enough to judge (for example no contact on this point).',
}

const STEMS: Record<FamilyFeedbackQuestionId, Record<FamilyFeedbackLocale, string>> = {
  communication: {
    fr: 'Dans l’ensemble, comment évaluez-vous la communication de {teacherName} avec la famille au sujet de {studentName} (informations, retours, disponibilité) ?',
    en: 'Overall, how do you rate {teacherName}’s communication with the family about {studentName} (information, follow-up, availability)?',
  },
  clarity: {
    fr: 'Dans l’ensemble, comment évaluez-vous la clarté des attentes et du travail demandé à {studentName} en {subjectName} ?',
    en: 'Overall, how do you rate the clarity of expectations and work asked of {studentName} in {subjectName}?',
  },
  support: {
    fr: 'Dans l’ensemble, comment évaluez-vous le soutien apporté à {studentName} dans cette matière, tel que la famille peut le percevoir ?',
    en: 'Overall, how do you rate the support {studentName} receives in this subject, as the family can perceive it?',
  },
  student_experience: {
    fr: 'D’après ce que vous observez ou ce que {studentName} vous dit, comment évaluez-vous son expérience avec {teacherName} en {subjectName} ?',
    en: 'From what you observe or what {studentName} tells you, how do you rate their experience with {teacherName} in {subjectName}?',
  },
}

const COMMENT_PROMPT: Record<FamilyFeedbackLocale, string> = {
  fr: 'Souhaitez-vous ajouter un commentaire ? Il sera lu uniquement par un modérateur désigné, pas par l’enseignant(e) concerné(e). N’indiquez pas de noms d’autres élèves.',
  en: 'Would you like to add a comment? Only a designated moderator will read it, not the teacher. Do not name other students.',
}

const CONFIDENTIALITY_NOTICE: Record<FamilyFeedbackLocale, string> = {
  fr: 'Les réponses sont confidentielles et agrégées, pas anonymes. L’enseignant(e) concerné(e) ne verra ni qui a répondu ni le commentaire brut. Un modérateur désigné peut lire les commentaires. Un texte libre peut identifier une famille.',
  en: 'Responses are confidential and aggregated, not anonymous. The evaluated teacher will not see who answered or the raw comment. A designated moderator may read comments. Free text can identify a family.',
}

export function interpolateFamilyFeedbackCopy(template: string, vars: FamilyFeedbackInstrumentVars): string {
  return template.replace(/\{(studentName|teacherName|subjectName|className|periodName)\}/g, (_, key: keyof FamilyFeedbackInstrumentVars) => vars[key])
}

export function familyFeedbackScaleLabels(locale: FamilyFeedbackLocale): Record<FamilyFeedbackAnswer, string> {
  return SCALE_LABELS[locale]
}

export function familyFeedbackInstrumentCopy(locale: FamilyFeedbackLocale) {
  return {
    version: FAMILY_FEEDBACK_QUESTION_VERSION,
    intro: INTRO[locale],
    confidentialityNotice: CONFIDENTIALITY_NOTICE[locale],
    scaleHelper: SCALE_HELPER[locale],
    scaleLabels: SCALE_LABELS[locale],
    commentPrompt: COMMENT_PROMPT[locale],
    items: FAMILY_FEEDBACK_QUESTION_IDS.map(id => ({
      id,
      stem: STEMS[id][locale],
    })),
  }
}

export function renderFamilyFeedbackInstrument(locale: FamilyFeedbackLocale, vars: FamilyFeedbackInstrumentVars) {
  const copy = familyFeedbackInstrumentCopy(locale)
  return {
    version: copy.version,
    intro: interpolateFamilyFeedbackCopy(copy.intro, vars),
    confidentialityNotice: copy.confidentialityNotice,
    scaleHelper: copy.scaleHelper,
    scaleLabels: copy.scaleLabels,
    commentPrompt: copy.commentPrompt,
    items: copy.items.map(item => ({
      id: item.id,
      stem: interpolateFamilyFeedbackCopy(item.stem, vars),
    })),
  }
}

export function isFamilyFeedbackAnswer(value: unknown): value is FamilyFeedbackAnswer {
  return value === FAMILY_FEEDBACK_CANNOT_ASSESS || (typeof value === 'number' && (FAMILY_FEEDBACK_SCORED_VALUES as readonly number[]).includes(value))
}

export function isFamilyFeedbackQuestionId(value: unknown): value is FamilyFeedbackQuestionId {
  return typeof value === 'string' && (FAMILY_FEEDBACK_QUESTION_IDS as readonly string[]).includes(value)
}
