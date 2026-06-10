export type ClassNode = {
  id: string;
  schoolId: string;
  academicYearId: string;
  gradeLevelId: string;
  name: string;
  /** Cycle scolaire (Middle School / High School) — aligné sur `GradeLevel.cycle`. */
  level: string;
  studentCount: number;
};

export type HierarchyGroup = { level: string; classes: ClassNode[] };

export type Student = {
  id: string;
  classId: string;
  name: string;
  initials: string;
  email: string;
  birthdate: string;
  guardian: string;
  attendance: number;
  average: number;
  status: "active" | "warning" | "honor";
};

export type SubjectCategory = "Scientifique" | "Littéraire" | "Langues" | "Sciences humaines" | "Sport" | "Arts";

export type Subject = {
  id: string;
  classId: string;
  name: string;
  teacher: string;
  hoursPerWeek: number;
  color: "mint" | "sky" | "warm";
  description: string;
  category: SubjectCategory;
};

export type PlanningEvent = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  start: string;
  end: string;
  room: string;
  teacher: string;
};

export type Evaluation = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  date: string;
  coefficient: number;
  averageMark: number;
  outOf: number;
  graded: number;
  total: number;
};

export type Guardian = {
  id: string;
  name: string;
  initials: string;
  relation: "Mother" | "Father" | "Legal guardian";
  email: string;
  phone: string;
  studentIds: string[];
  preferredContact: "email" | "phone" | "sms";
};

export type StaffRole = "directeur" | "prof_principal" | "professeur" | "educateur";

export type StaffMember = {
  id: string;
  name: string;
  initials: string;
  role: StaffRole;
  department: string;
  email: string;
  classes: string[];
  /** Classe attitrée pour un professeur principal */
  mainClassId?: string;
  /** Matières enseignées (pour 'professeur' / 'prof_principal') */
  subjectsTaught?: string[];
};

export type ChronicCondition = "Asthme" | "Epilepsie" | "Diabete";

export type HealthRecord = {
  studentId: string;
  bloodType: string;
  allergies: string[];
  medications: string[];
  chronicConditions: ChronicCondition[];
  lastVisit: string;
  notes: string;
};

export type Incident = {
  id: string;
  studentId: string;
  date: string;
  category: "Behavior" | "Tardiness" | "Conflict" | "Other";
  severity: "low" | "medium" | "high";
  summary: string;
};

export type AbsenceRecord = {
  id: string;
  studentId: string;
  date: string;
  time: string;
  subject: string;
  eventType: "Cours" | "Évaluation" | "Activité";
  reason?: string;
};

export type Deadline = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  description: string;
  dueDate: string;
  assignedDate: string;
  type: "Homework" | "Project" | "Reading" | "Lab";
  attachments: { name: string; size: string }[];
  submissions: { studentId: string; status: "submitted" | "late" | "missing"; date?: string }[];
};

export type Fee = {
  id: string;
  name: string;
  category: "Tuition" | "Transport" | "Meals" | "Activities" | "Materials";
  amount: number;
  period: "Year" | "Term" | "Month";
};

export type StudentBilling = {
  id: string;
  studentId: string;
  feeId: string;
  total: number;
  paid: number;
  status: "paid" | "partial" | "due" | "overdue";
  dueDate: string;
  installments: { date: string; amount: number; status: "paid" | "pending" }[];
};

export type AcademicPublishStatus = "draft" | "published";

/** Modèle de période (trimestre) — aligné futur API `PeriodDefinition`. */
export type PeriodDefinition = {
  id: string;
  schoolId: string;
  name: string;
  order: number;
};

/** Niveau scolaire — aligné futur API `GradeLevel`. */
export type GradeLevel = {
  id: string;
  schoolId: string;
  name: string;
  cycle: string;
  order: number;
};

export type AcademicYear = {
  id: string;
  schoolId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: AcademicPublishStatus;
};

export type AcademicPeriod = {
  id: string;
  schoolId: string;
  academicYearId: string;
  periodDefinitionId: string;
  label: string;
  range: string;
  startDate: string;
  endDate: string;
  status: AcademicPublishStatus;
};

/** Établissement scolaire (aligné futur API `School`). */
export type School = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  timeZone: string;
};

export const schools: School[] = [
  {
    id: "sch-edaya-central",
    name: "EDAYA — Campus Central",
    shortName: "Campus Central",
    city: "Paris",
    timeZone: "Europe/Paris",
  },
  {
    id: "sch-edaya-nord",
    name: "EDAYA — Campus Nord",
    shortName: "Campus Nord",
    city: "Lille",
    timeZone: "Europe/Paris",
  },
];

export type SchoolYearEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: "holiday" | "vacation" | "closure" | "ceremony";
  description: string;
  scope: "all" | string[];
};

const DEMO_SCHOOL_ID = schools[0].id;
const CURRENT_ACADEMIC_YEAR_ID = "2025";

export const periodDefinitions: PeriodDefinition[] = [
  { id: "pd-t1", schoolId: DEMO_SCHOOL_ID, name: "Trimestre 1", order: 1 },
  { id: "pd-t2", schoolId: DEMO_SCHOOL_ID, name: "Trimestre 2", order: 2 },
  { id: "pd-t3", schoolId: DEMO_SCHOOL_ID, name: "Trimestre 3", order: 3 },
];

export const gradeLevels: GradeLevel[] = [
  { id: "gl-6", schoolId: DEMO_SCHOOL_ID, name: "6ème", cycle: "Middle School", order: 1 },
  { id: "gl-5", schoolId: DEMO_SCHOOL_ID, name: "5ème", cycle: "Middle School", order: 2 },
  { id: "gl-4", schoolId: DEMO_SCHOOL_ID, name: "4ème", cycle: "Middle School", order: 3 },
  { id: "gl-3", schoolId: DEMO_SCHOOL_ID, name: "3ème", cycle: "Middle School", order: 4 },
  { id: "gl-2", schoolId: DEMO_SCHOOL_ID, name: "2nde", cycle: "High School", order: 5 },
  { id: "gl-1", schoolId: DEMO_SCHOOL_ID, name: "1ère", cycle: "High School", order: 6 },
  { id: "gl-t", schoolId: DEMO_SCHOOL_ID, name: "Terminale", cycle: "High School", order: 7 },
];

export const academicYears: AcademicYear[] = [
  {
    id: "2024",
    schoolId: DEMO_SCHOOL_ID,
    label: "2024 — 2025",
    startDate: "2024-09-02",
    endDate: "2025-07-04",
    status: "published",
  },
  {
    id: "2025",
    schoolId: DEMO_SCHOOL_ID,
    label: "2025 — 2026",
    startDate: "2025-09-01",
    endDate: "2026-07-03",
    status: "published",
  },
  {
    id: "2026",
    schoolId: DEMO_SCHOOL_ID,
    label: "2026 — 2027",
    startDate: "2026-09-01",
    endDate: "2027-07-02",
    status: "draft",
  },
];

export const academicPeriods: AcademicPeriod[] = [
  {
    id: "2024-t1",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2024",
    periodDefinitionId: "pd-t1",
    label: "Trimestre 1",
    range: "Sep — Dec",
    startDate: "2024-09-02",
    endDate: "2024-12-20",
    status: "published",
  },
  {
    id: "2024-t2",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2024",
    periodDefinitionId: "pd-t2",
    label: "Trimestre 2",
    range: "Jan — Apr",
    startDate: "2025-01-06",
    endDate: "2025-04-04",
    status: "published",
  },
  {
    id: "2024-t3",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2024",
    periodDefinitionId: "pd-t3",
    label: "Trimestre 3",
    range: "May — Jul",
    startDate: "2025-04-22",
    endDate: "2025-07-04",
    status: "published",
  },
  {
    id: "2025-t1",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2025",
    periodDefinitionId: "pd-t1",
    label: "Trimestre 1",
    range: "Sep — Dec",
    startDate: "2025-09-01",
    endDate: "2025-12-19",
    status: "published",
  },
  {
    id: "2025-t2",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2025",
    periodDefinitionId: "pd-t2",
    label: "Trimestre 2",
    range: "Jan — Apr",
    startDate: "2026-01-05",
    endDate: "2026-04-03",
    status: "published",
  },
  {
    id: "2025-t3",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2025",
    periodDefinitionId: "pd-t3",
    label: "Trimestre 3",
    range: "May — Jul",
    startDate: "2026-04-20",
    endDate: "2026-07-03",
    status: "published",
  },
  {
    id: "2026-t1",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2026",
    periodDefinitionId: "pd-t1",
    label: "Trimestre 1",
    range: "Sep — Dec",
    startDate: "2026-09-01",
    endDate: "2026-12-18",
    status: "draft",
  },
  {
    id: "2026-t2",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2026",
    periodDefinitionId: "pd-t2",
    label: "Trimestre 2",
    range: "Jan — Apr",
    startDate: "2027-01-04",
    endDate: "2027-04-02",
    status: "draft",
  },
  {
    id: "2026-t3",
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: "2026",
    periodDefinitionId: "pd-t3",
    label: "Trimestre 3",
    range: "May — Jul",
    startDate: "2027-04-19",
    endDate: "2027-07-02",
    status: "draft",
  },
];

function classNode(
  id: string,
  gradeLevelId: string,
  name: string,
  studentCount: number
): ClassNode {
  const gradeLevel = gradeLevels.find((g) => g.id === gradeLevelId)!;
  return {
    id,
    schoolId: DEMO_SCHOOL_ID,
    academicYearId: CURRENT_ACADEMIC_YEAR_ID,
    gradeLevelId,
    name,
    level: gradeLevel.cycle,
    studentCount,
  };
}

/** Regroupe les classes par cycle, ordonnées selon les niveaux. */
export function buildClassHierarchy(
  classList: ClassNode[],
  gradeLevelList: GradeLevel[]
): HierarchyGroup[] {
  const sortedLevels = [...gradeLevelList].sort((a, b) => a.order - b.order);
  const cycles: string[] = [];
  for (const gl of sortedLevels) {
    if (!cycles.includes(gl.cycle)) cycles.push(gl.cycle);
  }
  return cycles.map((cycle) => ({
    level: cycle,
    classes: sortedLevels
      .filter((gl) => gl.cycle === cycle)
      .flatMap((gl) => classList.filter((c) => c.gradeLevelId === gl.id)),
  }));
}

export function gradeLevelById(id: string): GradeLevel | undefined {
  return gradeLevels.find((g) => g.id === id);
}

export function periodDefinitionById(id: string): PeriodDefinition | undefined {
  return periodDefinitions.find((p) => p.id === id);
}

export function publishedAcademicYears(): AcademicYear[] {
  return academicYears.filter((y) => y.status === "published");
}

export function publishedAcademicPeriods(yearId?: string): AcademicPeriod[] {
  return academicPeriods.filter(
    (p) => p.status === "published" && (!yearId || p.academicYearId === yearId)
  );
}

export const schoolYearEvents: SchoolYearEvent[] = [
  { id: "yc1", title: "Fête du Travail", date: "2026-05-01", type: "holiday", description: "Jour férié national. L'école est fermée.", scope: "all" },
  { id: "yc2", title: "Ascension", date: "2026-05-14", type: "holiday", description: "Jour férié. Pas de cours.", scope: "all" },
  { id: "yc3", title: "Vacances de printemps", date: "2026-04-20", endDate: "2026-05-02", type: "vacation", description: "Vacances scolaires de printemps. Réouverture le 4 mai.", scope: "all" },
  { id: "yc4", title: "Formation enseignants", date: "2026-05-20", type: "closure", description: "Journée de formation pédagogique. Arrêt de cours pour tous les élèves.", scope: "all" },
  { id: "yc5", title: "Réunion parents-professeurs", date: "2026-05-15", type: "ceremony", description: "Réunion de fin de trimestre pour les classes de Middle School.", scope: ["6a", "6b", "5a", "4a", "3a"] },
  { id: "yc6", title: "Journée sportive", date: "2026-06-05", type: "ceremony", description: "Compétitions inter-classes et activités sportives en plein air.", scope: "all" },
  { id: "yc7", title: "Lundi de Pentecôte", date: "2026-05-25", type: "holiday", description: "Jour férié national. L'école est fermée.", scope: "all" },
  { id: "yc8", title: "Conseil de classe", date: "2026-06-12", type: "closure", description: "Conseil de classe — arrêt des cours à 12h.", scope: "all" },
  { id: "yc9", title: "Vacances d'été", date: "2026-07-06", endDate: "2026-08-31", type: "vacation", description: "Vacances scolaires d'été. Réouverture le 1er septembre 2026.", scope: "all" },
  { id: "yc10", title: "Cérémonie de remise des prix", date: "2026-06-26", type: "ceremony", description: "Cérémonie de fin d'année et remise des prix au tableau d'honneur.", scope: "all" },
];

export const classes: ClassNode[] = [
  classNode("6a", "gl-6", "6th — A", 24),
  classNode("6b", "gl-6", "6th — B", 22),
  classNode("5a", "gl-5", "5th — A", 26),
  classNode("4a", "gl-4", "4th — A", 23),
  classNode("3a", "gl-3", "3rd — A", 25),
  classNode("2nd", "gl-2", "2nd", 30),
  classNode("1st-s", "gl-1", "1st — Science", 28),
  classNode("term-s", "gl-t", "Terminale — S", 27),
];

export const hierarchy: HierarchyGroup[] = buildClassHierarchy(classes, gradeLevels);

export const students: Student[] = [
  { id: "s1", classId: "6a", name: "Amélie Laurent", initials: "AL", email: "amelie.l@school.edu", birthdate: "2014-03-12", guardian: "Claire Laurent", attendance: 98, average: 17.2, status: "honor" },
  { id: "s2", classId: "6a", name: "Noah Bennett", initials: "NB", email: "noah.b@school.edu", birthdate: "2014-07-22", guardian: "James Bennett", attendance: 92, average: 14.5, status: "active" },
  { id: "s3", classId: "6a", name: "Mira Okafor", initials: "MO", email: "mira.o@school.edu", birthdate: "2014-01-09", guardian: "Adaeze Okafor", attendance: 88, average: 12.1, status: "warning" },
  { id: "s4", classId: "6a", name: "Theo Marchetti", initials: "TM", email: "theo.m@school.edu", birthdate: "2014-05-30", guardian: "Luca Marchetti", attendance: 96, average: 15.8, status: "active" },
  { id: "s5", classId: "6a", name: "Yuki Tanaka", initials: "YT", email: "yuki.t@school.edu", birthdate: "2014-11-04", guardian: "Hana Tanaka", attendance: 99, average: 18.4, status: "honor" },
  { id: "s6", classId: "6a", name: "Sofia Reyes", initials: "SR", email: "sofia.r@school.edu", birthdate: "2014-08-17", guardian: "Marco Reyes", attendance: 90, average: 13.6, status: "active" },
  { id: "s7", classId: "6b", name: "Liam Foster", initials: "LF", email: "liam.f@school.edu", birthdate: "2014-02-21", guardian: "Anna Foster", attendance: 94, average: 15.0, status: "active" },
  { id: "s8", classId: "6b", name: "Zara Khan", initials: "ZK", email: "zara.k@school.edu", birthdate: "2014-06-11", guardian: "Imran Khan", attendance: 97, average: 16.9, status: "honor" },
  { id: "s9", classId: "term-s", name: "Eliot Vasseur", initials: "EV", email: "eliot.v@school.edu", birthdate: "2008-09-02", guardian: "Marc Vasseur", attendance: 95, average: 16.2, status: "active" },
  { id: "s10", classId: "term-s", name: "Nina Bouchard", initials: "NB", email: "nina.b@school.edu", birthdate: "2008-04-19", guardian: "Sylvie Bouchard", attendance: 99, average: 18.9, status: "honor" },
  { id: "s11", classId: "5a", name: "Aminata Diallo", initials: "AD", email: "aminata.d@school.edu", birthdate: "2013-06-15", guardian: "Fatou Diallo", attendance: 95, average: 14.8, status: "active" },
  { id: "s12", classId: "4a", name: "Moussa Diallo", initials: "MD", email: "moussa.d@school.edu", birthdate: "2012-03-08", guardian: "Fatou Diallo", attendance: 91, average: 12.5, status: "warning" },
  { id: "s13", classId: "3a", name: "Khadija Diallo", initials: "KD", email: "khadija.d@school.edu", birthdate: "2011-09-22", guardian: "Fatou Diallo", attendance: 98, average: 16.7, status: "honor" },
];

export const subjects: Subject[] = [
  { id: "sub1", classId: "6a", name: "Mathematics", teacher: "Mme Dupont", hoursPerWeek: 5, color: "mint", description: "Algebra fundamentals, geometry and problem solving.", category: "Scientifique" },
  { id: "sub2", classId: "6a", name: "French Literature", teacher: "M. Garnier", hoursPerWeek: 4, color: "warm", description: "Reading, writing and analysis of classical texts.", category: "Littéraire" },
  { id: "sub3", classId: "6a", name: "History & Geography", teacher: "Mme Léon", hoursPerWeek: 3, color: "sky", description: "Antiquity to medieval Europe; world geography.", category: "Sciences humaines" },
  { id: "sub4", classId: "6a", name: "Natural Sciences", teacher: "M. Adler", hoursPerWeek: 3, color: "mint", description: "Biology, ecology and earth sciences.", category: "Scientifique" },
  { id: "sub5", classId: "6a", name: "English", teacher: "Ms. Hart", hoursPerWeek: 3, color: "sky", description: "Communication, comprehension and culture.", category: "Langues" },
  { id: "sub6", classId: "6a", name: "Physical Education", teacher: "M. Roux", hoursPerWeek: 2, color: "warm", description: "Athletics, team sports and wellbeing.", category: "Sport" },
  { id: "sub7", classId: "term-s", name: "Advanced Mathematics", teacher: "M. Cheng", hoursPerWeek: 8, color: "mint", description: "Calculus, linear algebra and probability.", category: "Scientifique" },
  { id: "sub8", classId: "term-s", name: "Physics & Chemistry", teacher: "Mme Ortiz", hoursPerWeek: 6, color: "sky", description: "Mechanics, electromagnetism, organic chemistry.", category: "Scientifique" },
];

export const planning: PlanningEvent[] = [
  { id: "p1", classId: "6a", title: "Algebra basics", subject: "Mathematics", day: "Mon", start: "08:30", end: "09:30", room: "B-204", teacher: "Mme Dupont" },
  { id: "p2", classId: "6a", title: "Reading session", subject: "French Literature", day: "Mon", start: "10:00", end: "11:00", room: "A-101", teacher: "M. Garnier" },
  { id: "p3", classId: "6a", title: "Ancient Greece", subject: "History & Geography", day: "Tue", start: "09:00", end: "10:00", room: "C-305", teacher: "Mme Léon" },
  { id: "p4", classId: "6a", title: "Lab — Cells", subject: "Natural Sciences", day: "Wed", start: "08:30", end: "10:30", room: "Lab-2", teacher: "M. Adler" },
  { id: "p5", classId: "6a", title: "Conversation", subject: "English", day: "Thu", start: "11:00", end: "12:00", room: "A-203", teacher: "Ms. Hart" },
  { id: "p6", classId: "6a", title: "Athletics", subject: "Physical Education", day: "Fri", start: "14:00", end: "16:00", room: "Gym", teacher: "M. Roux" },
  { id: "p7", classId: "6a", title: "Geometry workshop", subject: "Mathematics", day: "Thu", start: "08:30", end: "09:30", room: "B-204", teacher: "Mme Dupont" },
  { id: "p8", classId: "6a", title: "Essay writing", subject: "French Literature", day: "Wed", start: "11:00", end: "12:00", room: "A-101", teacher: "M. Garnier" },
];

export const evaluations: Evaluation[] = [
  { id: "e1", classId: "6a", title: "Algebra mid-term", subject: "Mathematics", date: "2026-04-12", coefficient: 2, averageMark: 14.2, outOf: 20, graded: 24, total: 24 },
  { id: "e1b", classId: "6a", title: "Geometry quiz", subject: "Mathematics", date: "2026-03-15", coefficient: 1, averageMark: 13.1, outOf: 20, graded: 24, total: 24 },
  { id: "e1c", classId: "6a", title: "Mental arithmetic", subject: "Mathematics", date: "2026-02-20", coefficient: 0.5, averageMark: 15.4, outOf: 20, graded: 24, total: 24 },
  { id: "e1d", classId: "6a", title: "Problem solving", subject: "Mathematics", date: "2026-05-05", coefficient: 2, averageMark: 12.7, outOf: 20, graded: 24, total: 24 },
  { id: "e2", classId: "6a", title: "Essay — La Fontaine", subject: "French Literature", date: "2026-04-18", coefficient: 1, averageMark: 12.8, outOf: 20, graded: 22, total: 24 },
  { id: "e2b", classId: "6a", title: "Dictée", subject: "French Literature", date: "2026-03-22", coefficient: 1, averageMark: 11.5, outOf: 20, graded: 23, total: 24 },
  { id: "e2c", classId: "6a", title: "Oral presentation", subject: "French Literature", date: "2026-02-28", coefficient: 1.5, averageMark: 14.0, outOf: 20, graded: 24, total: 24 },
  { id: "e3", classId: "6a", title: "Map quiz", subject: "History & Geography", date: "2026-04-25", coefficient: 1, averageMark: 0, outOf: 20, graded: 0, total: 24 },
  { id: "e3b", classId: "6a", title: "Antiquity test", subject: "History & Geography", date: "2026-03-10", coefficient: 2, averageMark: 13.4, outOf: 20, graded: 24, total: 24 },
  { id: "e4", classId: "6a", title: "Lab report", subject: "Natural Sciences", date: "2026-05-02", coefficient: 1.5, averageMark: 0, outOf: 20, graded: 0, total: 24 },
  { id: "e4b", classId: "6a", title: "Ecosystems quiz", subject: "Natural Sciences", date: "2026-03-28", coefficient: 1, averageMark: 13.9, outOf: 20, graded: 24, total: 24 },
  { id: "e5", classId: "term-s", title: "Calculus test", subject: "Advanced Mathematics", date: "2026-04-20", coefficient: 3, averageMark: 13.6, outOf: 20, graded: 27, total: 27 },
  { id: "e5b", classId: "term-s", title: "Linear algebra", subject: "Advanced Mathematics", date: "2026-03-18", coefficient: 2, averageMark: 12.4, outOf: 20, graded: 27, total: 27 },
  { id: "e5c", classId: "term-s", title: "Mock exam", subject: "Advanced Mathematics", date: "2026-05-10", coefficient: 4, averageMark: 11.8, outOf: 20, graded: 27, total: 27 },
];


export const guardians: Guardian[] = [
  { id: "g1", name: "Claire Laurent", initials: "CL", relation: "Mother", email: "c.laurent@mail.com", phone: "+33 6 12 34 56 78", studentIds: ["s1"], preferredContact: "email" },
  { id: "g2", name: "James Bennett", initials: "JB", relation: "Father", email: "j.bennett@mail.com", phone: "+33 6 22 11 09 87", studentIds: ["s2"], preferredContact: "phone" },
  { id: "g3", name: "Adaeze Okafor", initials: "AO", relation: "Mother", email: "a.okafor@mail.com", phone: "+33 6 78 90 12 34", studentIds: ["s3"], preferredContact: "sms" },
  { id: "g4", name: "Luca Marchetti", initials: "LM", relation: "Father", email: "l.marchetti@mail.com", phone: "+33 6 55 66 77 88", studentIds: ["s4"], preferredContact: "email" },
  { id: "g5", name: "Hana Tanaka", initials: "HT", relation: "Mother", email: "h.tanaka@mail.com", phone: "+33 6 11 22 33 44", studentIds: ["s5"], preferredContact: "email" },
  { id: "g6", name: "Marco Reyes", initials: "MR", relation: "Father", email: "m.reyes@mail.com", phone: "+33 6 88 77 66 55", studentIds: ["s6"], preferredContact: "phone" },
  { id: "g7", name: "Sylvie Bouchard", initials: "SB", relation: "Mother", email: "s.bouchard@mail.com", phone: "+33 6 99 88 77 66", studentIds: ["s10"], preferredContact: "email" },
  { id: "g8", name: "Fatou Diallo", initials: "FD", relation: "Mother", email: "f.diallo@mail.com", phone: "+33 6 33 44 55 66", studentIds: ["s11", "s12", "s13"], preferredContact: "email" },
];

export const staff: StaffMember[] = [
  { id: "st1", name: "Mme Dupont", initials: "MD", role: "professeur", department: "Mathematics", email: "m.dupont@school.edu", classes: ["6a", "5a"], subjectsTaught: ["Mathematics"] },
  { id: "st2", name: "M. Garnier", initials: "MG", role: "professeur", department: "Literature", email: "m.garnier@school.edu", classes: ["6a", "6b"], subjectsTaught: ["French Literature"] },
  { id: "st3", name: "Mme Léon", initials: "ML", role: "prof_principal", department: "History", email: "m.leon@school.edu", classes: ["6a", "4a"], mainClassId: "6a", subjectsTaught: ["History & Geography"] },
  { id: "st4", name: "M. Cheng", initials: "MC", role: "professeur", department: "Mathematics", email: "m.cheng@school.edu", classes: ["term-s", "1st-s"], subjectsTaught: ["Advanced Mathematics"] },
  { id: "st5", name: "Camille Moreau", initials: "CM", role: "directeur", department: "Direction", email: "c.moreau@school.edu", classes: [] },
  { id: "st6", name: "Sarah Klein", initials: "SK", role: "educateur", department: "Vie Scolaire", email: "s.klein@school.edu", classes: [] },
  { id: "st7", name: "Tom Évrard", initials: "TE", role: "educateur", department: "Vie Scolaire", email: "t.evrard@school.edu", classes: [] },
];

export type PedagogicalNote = {
  id: string;
  studentId: string;
  date: string;
  authorId: string;
  category: "Comportement" | "Travail" | "Progression" | "Encouragement";
  content: string;
};

export const pedagogicalNotes: PedagogicalNote[] = [
  { id: "pn1", studentId: "s1", date: "2026-05-12", authorId: "st1", category: "Progression", content: "Très bonne progression en algèbre, raisonnement clair." },
  { id: "pn2", studentId: "s1", date: "2026-04-22", authorId: "st2", category: "Travail", content: "Travail écrit soigné, à approfondir l'argumentation." },
  { id: "pn3", studentId: "s1", date: "2026-03-15", authorId: "st3", category: "Encouragement", content: "Participation orale en hausse, continuer ainsi." },
  { id: "pn4", studentId: "s2", date: "2026-05-05", authorId: "st1", category: "Comportement", content: "Bavardages réguliers en classe, vigilance demandée." },
  { id: "pn5", studentId: "s2", date: "2026-04-10", authorId: "st2", category: "Travail", content: "Devoirs rendus en retard à deux reprises." },
  { id: "pn6", studentId: "s3", date: "2026-05-18", authorId: "st3", category: "Progression", content: "Compréhension solide en histoire, bon esprit de synthèse." },
  { id: "pn7", studentId: "s3", date: "2026-04-02", authorId: "st1", category: "Encouragement", content: "Excellent investissement sur le projet de groupe." },
];



export const healthRecords: Record<string, HealthRecord> = {
  s1: { studentId: "s1", bloodType: "A+", allergies: ["Pollen"], medications: [], chronicConditions: ["Asthme"], lastVisit: "2026-02-14", notes: "Mild seasonal allergies." },
  s3: { studentId: "s3", bloodType: "O-", allergies: ["Peanuts", "Shellfish"], medications: ["EpiPen"], chronicConditions: ["Asthme", "Epilepsie"], lastVisit: "2026-04-08", notes: "Severe peanut allergy. EpiPen in nurse's office." },
  s5: { studentId: "s5", bloodType: "B+", allergies: [], medications: [], chronicConditions: [], lastVisit: "2025-11-22", notes: "No known issues." },
};

export const incidents: Incident[] = [
  { id: "i1", studentId: "s3", date: "2026-04-12", category: "Tardiness", severity: "low", summary: "Late to class 3 times this month." },
  { id: "i2", studentId: "s2", date: "2026-03-22", category: "Behavior", severity: "medium", summary: "Disruption during English class." },
  { id: "i3", studentId: "s3", date: "2026-04-26", category: "Conflict", severity: "medium", summary: "Argument with classmate during recess." },
];

export const absences: AbsenceRecord[] = [
  { id: "a1", studentId: "s1", date: "2026-05-12", time: "08:30", subject: "Mathématiques", eventType: "Cours", reason: "Maladie" },
  { id: "a2", studentId: "s1", date: "2026-04-28", time: "14:00", subject: "Histoire", eventType: "Évaluation", reason: "Rendez-vous médical" },
  { id: "a3", studentId: "s2", date: "2026-05-05", time: "10:15", subject: "Anglais", eventType: "Cours" },
  { id: "a4", studentId: "s3", date: "2026-05-14", time: "09:00", subject: "SVT", eventType: "Cours", reason: "Non justifiée" },
  { id: "a5", studentId: "s3", date: "2026-04-22", time: "13:30", subject: "Physique-Chimie", eventType: "Évaluation", reason: "Maladie" },
  { id: "a6", studentId: "s3", date: "2026-03-18", time: "16:00", subject: "EPS", eventType: "Activité" },
  { id: "a7", studentId: "s4", date: "2026-05-02", time: "11:00", subject: "Français", eventType: "Cours", reason: "Famille" },
  { id: "a8", studentId: "s6", date: "2026-04-15", time: "08:30", subject: "Mathématiques", eventType: "Cours" },
];

export const deadlines: Deadline[] = [
  {
    id: "d1", classId: "6a", title: "Algebra exercise sheet #4", subject: "Mathematics",
    description: "Complete exercises 1 to 12, page 84. Show all working.",
    dueDate: "2026-05-18", assignedDate: "2026-05-11", type: "Homework",
    attachments: [{ name: "exercises_ch4.pdf", size: "320 KB" }],
    submissions: [
      { studentId: "s1", status: "submitted", date: "2026-05-15" },
      { studentId: "s2", status: "submitted", date: "2026-05-16" },
      { studentId: "s3", status: "missing" },
      { studentId: "s4", status: "submitted", date: "2026-05-17" },
      { studentId: "s5", status: "submitted", date: "2026-05-14" },
      { studentId: "s6", status: "late", date: "2026-05-19" },
    ],
  },
  {
    id: "d2", classId: "6a", title: "Essay — Le Loup et l'Agneau", subject: "French Literature",
    description: "300 word analysis on the moral of the fable.",
    dueDate: "2026-05-22", assignedDate: "2026-05-08", type: "Project",
    attachments: [{ name: "fable_text.pdf", size: "120 KB" }, { name: "rubric.pdf", size: "85 KB" }],
    submissions: [
      { studentId: "s1", status: "submitted", date: "2026-05-20" },
      { studentId: "s2", status: "missing" },
      { studentId: "s3", status: "missing" },
      { studentId: "s4", status: "submitted", date: "2026-05-21" },
      { studentId: "s5", status: "submitted", date: "2026-05-19" },
      { studentId: "s6", status: "missing" },
    ],
  },
  {
    id: "d3", classId: "6a", title: "Cell biology reading", subject: "Natural Sciences",
    description: "Read chapter 6 and answer the comprehension questions.",
    dueDate: "2026-05-25", assignedDate: "2026-05-13", type: "Reading",
    attachments: [],
    submissions: [
      { studentId: "s1", status: "submitted", date: "2026-05-23" },
      { studentId: "s2", status: "submitted", date: "2026-05-24" },
      { studentId: "s3", status: "submitted", date: "2026-05-22" },
      { studentId: "s4", status: "submitted", date: "2026-05-25" },
      { studentId: "s5", status: "submitted", date: "2026-05-22" },
      { studentId: "s6", status: "submitted", date: "2026-05-25" },
    ],
  },
  {
    id: "d4", classId: "6a", title: "Lab — Microscope observations", subject: "Natural Sciences",
    description: "Bring a sample and write a 1 page observation report.",
    dueDate: "2026-06-02", assignedDate: "2026-05-19", type: "Lab",
    attachments: [{ name: "lab_protocol.pdf", size: "210 KB" }],
    submissions: [
      { studentId: "s1", status: "missing" },
      { studentId: "s2", status: "missing" },
      { studentId: "s3", status: "missing" },
      { studentId: "s4", status: "missing" },
      { studentId: "s5", status: "missing" },
      { studentId: "s6", status: "missing" },
    ],
  },
];

export const fees: Fee[] = [
  { id: "f1", name: "Tuition — Middle School", category: "Tuition", amount: 4800, period: "Year" },
  { id: "f2", name: "Tuition — High School", category: "Tuition", amount: 5600, period: "Year" },
  { id: "f3", name: "School bus", category: "Transport", amount: 720, period: "Year" },
  { id: "f4", name: "Cafeteria plan", category: "Meals", amount: 180, period: "Month" },
  { id: "f5", name: "Sports club", category: "Activities", amount: 240, period: "Term" },
  { id: "f6", name: "Textbook pack", category: "Materials", amount: 160, period: "Year" },
];

export const billing: StudentBilling[] = [
  { id: "b1", studentId: "s1", feeId: "f1", total: 4800, paid: 4800, status: "paid", dueDate: "2026-05-30", installments: [
    { date: "2025-09-15", amount: 1600, status: "paid" }, { date: "2026-01-15", amount: 1600, status: "paid" }, { date: "2026-05-15", amount: 1600, status: "paid" },
  ]},
  { id: "b2", studentId: "s2", feeId: "f1", total: 4800, paid: 3200, status: "partial", dueDate: "2026-05-30", installments: [
    { date: "2025-09-15", amount: 1600, status: "paid" }, { date: "2026-01-15", amount: 1600, status: "paid" }, { date: "2026-05-15", amount: 1600, status: "pending" },
  ]},
  { id: "b3", studentId: "s3", feeId: "f1", total: 4800, paid: 1600, status: "overdue", dueDate: "2026-04-15", installments: [
    { date: "2025-09-15", amount: 1600, status: "paid" }, { date: "2026-01-15", amount: 1600, status: "pending" }, { date: "2026-05-15", amount: 1600, status: "pending" },
  ]},
  { id: "b4", studentId: "s4", feeId: "f3", total: 720, paid: 720, status: "paid", dueDate: "2025-09-30", installments: [{ date: "2025-09-15", amount: 720, status: "paid" }]},
  { id: "b5", studentId: "s5", feeId: "f1", total: 4800, paid: 4800, status: "paid", dueDate: "2026-05-30", installments: [
    { date: "2025-09-15", amount: 4800, status: "paid" },
  ]},
  { id: "b6", studentId: "s6", feeId: "f4", total: 1620, paid: 900, status: "due", dueDate: "2026-06-01", installments: [
    { date: "2025-10-01", amount: 180, status: "paid" }, { date: "2025-11-01", amount: 180, status: "paid" }, { date: "2025-12-01", amount: 180, status: "paid" }, { date: "2026-01-01", amount: 180, status: "paid" }, { date: "2026-02-01", amount: 180, status: "paid" }, { date: "2026-03-01", amount: 180, status: "pending" }, { date: "2026-04-01", amount: 180, status: "pending" }, { date: "2026-05-01", amount: 180, status: "pending" }, { date: "2026-06-01", amount: 180, status: "pending" },
  ]},
  { id: "b7", studentId: "s9", feeId: "f2", total: 5600, paid: 5600, status: "paid", dueDate: "2026-05-30", installments: [
    { date: "2025-09-15", amount: 5600, status: "paid" },
  ]},
  { id: "b8", studentId: "s10", feeId: "f2", total: 5600, paid: 2800, status: "partial", dueDate: "2026-05-30", installments: [
    { date: "2025-09-15", amount: 2800, status: "paid" }, { date: "2026-02-15", amount: 2800, status: "pending" },
  ]},
];

export type ActivityEnrollmentStatus = "approved" | "pending" | "denied";

export type ActivityEnrollment = {
  studentId: string;
  status: ActivityEnrollmentStatus;
};

export type Activity = {
  id: string;
  name: string;
  category: "Sport" | "Arts" | "Science" | "Language" | "Wellbeing";
  coach: string;
  schedule: string;
  participants: number;
  capacity: number;
  description: string;
  startDate: string;
  endDate: string;
  enrollments: ActivityEnrollment[];
};

export type Resource = {
  id: string;
  name: string;
  type: "Room" | "Equipment" | "Library" | "Vehicle";
  capacity?: number;
  location: string;
  status: "available" | "booked" | "maintenance";
};

export const activities: Activity[] = [
  { id: "a1", name: "Club Robotique", category: "Science", coach: "M. Adler", schedule: "Mer 14:00 – 16:00", participants: 18, capacity: 24,
    description: "Conception et programmation de robots avec Arduino et Lego Mindstorms.",
    startDate: "2025-09-15", endDate: "2026-06-12",
    enrollments: [
      { studentId: "s1", status: "approved" }, { studentId: "s2", status: "pending" }, { studentId: "s3", status: "denied" }, { studentId: "s4", status: "approved" },
    ] },
  { id: "a2", name: "Chorale", category: "Arts", coach: "Mme Garnier", schedule: "Ven 12:30 – 13:30", participants: 22, capacity: 30,
    description: "Ensemble vocal pluri-niveaux préparant les concerts trimestriels de l'école.",
    startDate: "2025-09-20", endDate: "2026-06-20",
    enrollments: [
      { studentId: "s5", status: "approved" }, { studentId: "s6", status: "approved" }, { studentId: "s7", status: "pending" },
    ] },
  { id: "a3", name: "Équipe de basketball", category: "Sport", coach: "M. Roux", schedule: "Mar & Jeu 17:00", participants: 14, capacity: 16,
    description: "Entraînements hebdomadaires et tournois inter-établissements.",
    startDate: "2025-09-08", endDate: "2026-05-30",
    enrollments: [
      { studentId: "s8", status: "approved" }, { studentId: "s9", status: "approved" }, { studentId: "s10", status: "pending" },
    ] },
  { id: "a4", name: "Conversation espagnole", category: "Language", coach: "Mme Reyes", schedule: "Lun 13:00 – 14:00", participants: 9, capacity: 18,
    description: "Ateliers d'expression orale en petits groupes, tous niveaux.",
    startDate: "2025-10-01", endDate: "2026-06-05",
    enrollments: [
      { studentId: "s1", status: "pending" }, { studentId: "s5", status: "approved" },
    ] },
  { id: "a5", name: "Cercle de pleine conscience", category: "Wellbeing", coach: "T. Évrard", schedule: "Jeu 12:30 – 13:00", participants: 12, capacity: 20,
    description: "Sessions de méditation guidée pour la gestion du stress scolaire.",
    startDate: "2025-09-25", endDate: "2026-06-18",
    enrollments: [
      { studentId: "s2", status: "approved" }, { studentId: "s7", status: "denied" },
    ] },
  { id: "a6", name: "Atelier théâtre", category: "Arts", coach: "M. Garnier", schedule: "Mer 16:00 – 18:00", participants: 16, capacity: 20,
    description: "Mise en scène d'une pièce jouée en fin d'année scolaire.",
    startDate: "2025-10-05", endDate: "2026-06-25",
    enrollments: [
      { studentId: "s3", status: "approved" }, { studentId: "s8", status: "pending" }, { studentId: "s9", status: "approved" },
    ] },
];


export const resources: Resource[] = [
  { id: "r1", name: "Auditorium", type: "Room", capacity: 220, location: "Building A · GF", status: "available" },
  { id: "r2", name: "Lab — Chemistry 2", type: "Room", capacity: 24, location: "Building B · 2F", status: "booked" },
  { id: "r3", name: "Gymnasium", type: "Room", capacity: 120, location: "Annex", status: "available" },
  { id: "r4", name: "Mobile tablet cart", type: "Equipment", capacity: 30, location: "IT office", status: "available" },
  { id: "r5", name: "School bus #2", type: "Vehicle", capacity: 48, location: "Garage", status: "maintenance" },
  { id: "r6", name: "Library — Reading hall", type: "Library", capacity: 60, location: "Building C · 1F", status: "available" },
  { id: "r7", name: "3D printer", type: "Equipment", location: "Lab — Physics", status: "booked" },
];
