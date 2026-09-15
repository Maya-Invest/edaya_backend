import Handlebars from "handlebars/runtime";
import type { TemplateAssets } from "./load-assets";

interface ReportCardLocaleLabels {
  readonly documentTitle: string;
  readonly schoolYear: string;
  readonly establishment: string;
  readonly code: string;
  readonly status: string;
  readonly postalAddress: string;
  readonly phone: string;
  readonly city: string;
  readonly email: string;
  readonly fullName: string;
  readonly matricule: string;
  readonly gender: string;
  readonly class: string;
  readonly birthDate: string;
  readonly classSize: string;
  readonly birthPlace: string;
  readonly orderNumber: string;
  readonly nationality: string;
  readonly repeating: string;
  readonly regime: string;
  readonly boarding: string;
  readonly studentStatus: string;
  readonly photo: string;
  readonly disciplines: string;
  readonly semesterAverage: string;
  readonly moyOver20: string;
  readonly coef: string;
  readonly total: string;
  readonly rank: string;
  readonly appreciations: string;
  readonly teachers: string;
  readonly signature: string;
  readonly attendance: string;
  readonly absenceTotal: string;
  readonly absenceJustified: string;
  readonly absenceUnjustified: string;
  readonly conduct: string;
  readonly educator: string;
  readonly semesterMean: string;
  readonly classResults: string;
  readonly classAverage: string;
  readonly lowestAverage: string;
  readonly highestAverage: string;
  readonly councilMentions: string;
  readonly councilAppreciation: string;
  readonly homeroomTeacher: string;
  readonly principal: string;
  readonly generatedBy: string;
}

interface LogbookLocaleLabels {
  readonly documentTitle: string;
  readonly schoolYear: string;
  readonly class: string;
  readonly period: string;
  readonly subjects: string;
  readonly sessions: string;
  readonly teacher: string;
  readonly content: string;
  readonly chapters: string;
  readonly homework: string;
  readonly generatedBy: string;
}

interface GenericPayload {
  readonly schoolName?: unknown;
  readonly primaryColor?: unknown;
  readonly documentTitle?: unknown;
  readonly subjects?: unknown;
  readonly [key: string]: unknown;
}

const REPORT_CARD_LABELS = {
  fr: {
    documentTitle: "Bulletin trimestriel de notes",
    schoolYear: "Année scolaire",
    establishment: "Établissement",
    code: "Code",
    status: "Statut",
    postalAddress: "Adresse postale",
    phone: "Tél",
    city: "Ville",
    email: "E-mail",
    fullName: "Nom & Prénoms",
    matricule: "Matricule",
    gender: "Sexe",
    class: "Classe",
    birthDate: "Né(e) le",
    classSize: "Effectif",
    birthPlace: "Lieu de naissance",
    orderNumber: "N° d'ordre",
    nationality: "Nationalité",
    repeating: "Redoublant(e)",
    regime: "Régime",
    boarding: "Interne",
    studentStatus: "Statut",
    photo: "Photo",
    disciplines: "Disciplines",
    semesterAverage: "Moy. trimestrielle",
    moyOver20: "Moy./20",
    coef: "Coef",
    total: "Total",
    rank: "Rang",
    appreciations: "Appréciations",
    teachers: "Professeurs",
    signature: "Signature",
    attendance: "Assiduité",
    absenceTotal: "Absences (h)",
    absenceJustified: "Justifiées",
    absenceUnjustified: "Non justifiées",
    conduct: "Conduite",
    educator: "Éducateur(trice)",
    semesterMean: "Moyenne trimestrielle",
    classResults: "Résultats de la classe",
    classAverage: "Moyenne de la classe",
    lowestAverage: "Plus faible moyenne",
    highestAverage: "Plus forte moyenne",
    councilMentions: "Mentions du conseil de classe",
    councilAppreciation: "Appréciations du conseil de classe",
    homeroomTeacher: "Professeur principal",
    principal: "Le Proviseur",
    generatedBy: "Document généré par Edaya",
  },
  en: {
    documentTitle: "Trimester report card",
    schoolYear: "School year",
    establishment: "School",
    code: "Code",
    status: "Status",
    postalAddress: "Postal address",
    phone: "Phone",
    city: "City",
    email: "Email",
    fullName: "Full name",
    matricule: "Student ID",
    gender: "Sex",
    class: "Class",
    birthDate: "Date of birth",
    classSize: "Class size",
    birthPlace: "Place of birth",
    orderNumber: "Order no.",
    nationality: "Nationality",
    repeating: "Repeating",
    regime: "Regime",
    boarding: "Boarding",
    studentStatus: "Status",
    photo: "Photo",
    disciplines: "Subjects",
    semesterAverage: "Semester average",
    moyOver20: "Avg/20",
    coef: "Coef",
    total: "Total",
    rank: "Rank",
    appreciations: "Comments",
    teachers: "Teachers",
    signature: "Signature",
    attendance: "Attendance",
    absenceTotal: "Absences (h)",
    absenceJustified: "Justified",
    absenceUnjustified: "Unjustified",
    conduct: "Conduct",
    educator: "Educator",
    semesterMean: "Trimester mean",
    classResults: "Class results",
    classAverage: "Class average",
    lowestAverage: "Lowest average",
    highestAverage: "Highest average",
    councilMentions: "Class council mentions",
    councilAppreciation: "Class council comments",
    homeroomTeacher: "Homeroom teacher",
    principal: "Principal",
    generatedBy: "Document generated by Edaya",
  },
} as const satisfies Record<string, ReportCardLocaleLabels>;

const LOGBOOK_LABELS = {
  fr: {
    documentTitle: "Cahier de texte de classe",
    schoolYear: "Année scolaire",
    class: "Classe",
    period: "Période",
    subjects: "Matières",
    sessions: "Séances",
    teacher: "Enseignant",
    content: "Contenu",
    chapters: "Chapitres",
    homework: "Devoirs",
    generatedBy: "Document généré par Edaya",
  },
  en: {
    documentTitle: "Class teaching logbook",
    schoolYear: "School year",
    class: "Class",
    period: "Period",
    subjects: "Subjects",
    sessions: "Sessions",
    teacher: "Teacher",
    content: "Content",
    chapters: "Chapters",
    homework: "Homework",
    generatedBy: "Document generated by Edaya",
  },
} as const satisfies Record<string, LogbookLocaleLabels>;

export interface CompileTemplateInput {
  readonly locale: string;
  readonly payload: unknown;
  readonly assets: TemplateAssets;
}

function asPayload(value: unknown): GenericPayload {
  if (typeof value === "object" && value !== null) {
    return value as GenericPayload;
  }
  return {};
}

interface LetterLocaleLabels {
  readonly documentTitle: string;
  readonly schoolYear: string;
  readonly student: string;
  readonly class: string;
  readonly date: string;
  readonly orderNumber: string;
  readonly matricule: string;
  readonly preview: string;
  readonly generatedBy: string;
}

const LETTER_LABELS = {
  fr: {
    documentTitle: "Document officiel",
    schoolYear: "Année scolaire",
    student: "Élève",
    class: "Classe",
    date: "Date",
    orderNumber: "N°",
    matricule: "Matricule",
    preview: "BROUILLON",
    generatedBy: "Document généré par Edaya",
  },
  en: {
    documentTitle: "Official document",
    schoolYear: "School year",
    student: "Student",
    class: "Class",
    date: "Date",
    orderNumber: "No.",
    matricule: "Student ID",
    preview: "DRAFT",
    generatedBy: "Document generated by Edaya",
  },
} as const satisfies Record<string, LetterLocaleLabels>;

function resolveLabels(templateKey: string, locale: string): ReportCardLocaleLabels | LogbookLocaleLabels | LetterLocaleLabels {
  if (templateKey === "logbook.v1") {
    return Object.hasOwn(LOGBOOK_LABELS, locale)
      ? LOGBOOK_LABELS[locale as keyof typeof LOGBOOK_LABELS]
      : LOGBOOK_LABELS.en;
  }
  if (templateKey === "report-card.v1") {
    return Object.hasOwn(REPORT_CARD_LABELS, locale)
      ? REPORT_CARD_LABELS[locale as keyof typeof REPORT_CARD_LABELS]
      : REPORT_CARD_LABELS.en;
  }
  return Object.hasOwn(LETTER_LABELS, locale)
    ? LETTER_LABELS[locale as keyof typeof LETTER_LABELS]
    : LETTER_LABELS.en;
}

export function compileTemplateHtml(input: CompileTemplateInput): string {
  const labels = resolveLabels(input.assets.manifest.key, input.locale);
  const payload = asPayload(input.payload);
  const primaryColor = typeof payload.primaryColor === "string" ? payload.primaryColor : "#1f4b7a";
  const schoolName = typeof payload.schoolName === "string" && payload.schoolName.length > 0
    ? payload.schoolName
    : "Edaya School";
  const titleMap = input.assets.manifest.title;
  const manifestTitle = input.locale === "fr" ? titleMap.fr : titleMap.en;
  const documentTitle = typeof payload.documentTitle === "string" && payload.documentTitle.length > 0
    ? payload.documentTitle
    : manifestTitle;
  const subjects = Array.isArray(payload.subjects) ? payload.subjects : [];

  const template = Handlebars.template(input.assets.templateSpec as Parameters<typeof Handlebars.template>[0]);
  return template({
    ...payload,
    locale: input.locale,
    styles: input.assets.styles,
    labels,
    primaryColor,
    schoolName,
    documentTitle,
    subjects,
  });
}
