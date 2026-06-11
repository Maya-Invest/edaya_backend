# Rapport de comparaison — Interface SvelteKit vs API Edaya

**Projet :** EDAYA / Scholaria  
**Spec API :** `openapi/edaya_open_api.json` (Edaya Core API v1.0.0)  
**Données UI :** `src/lib/data/school.ts` + composants Svelte  
**Date :** juin 2026

---

## Résumé exécutif

| | Interface SvelteKit | API Edaya (OpenAPI) |
|---|---|---|
| **Modules** | 4 (School, Classes, Finance, Configuration) | 44 entités + 73 commands + 2 queries |
| **Types de données** | ~20 types mock | ~47 schémas métier |
| **Branché sur l'API** | 2 écrans partiels (liste élèves, liste staff) | — |
| **Reste de l'app** | ~100 % mocks | Disponible mais non consommé |

> **En une phrase :** l'UI est une maquette riche et visuelle ; l'API est un système scolaire complet plus « administratif ». Environ **70 %** des écrans ont un équivalent API (parfois avec mapper), **~15 %** sont UI-only (activités extrascolaires, devoirs), **~15 %** de l'API n'a pas encore d'écran (bulletins, annonces, commands métier).

---

## 1. Correspondance par écran (UI → API)

### Module School

| Écran UI | Données mock | Entité(s) API | Statut |
|---|---|---|---|
| Liste élèves | `students` | `students` + `enrollments` | Partiellement branché |
| Responsables | `guardians` | `guardians` + `guardian-links` | Mock |
| Calendrier scolaire | `schoolYearEvents` | `calendar-events` | Proche (vacances, fermetures…) |
| Activités extrascolaires | `activities` | **Aucune entité dédiée** | Écart majeur |
| Incidents école | `incidents` | `incidents` + `student-incident-involvements` + `disciplinary-actions` | Modèle différent |

### Module Classes

| Écran UI | Données mock | Entité(s) API | Statut |
|---|---|---|---|
| Élèves de classe | `students` + `classId` | `enrollments` + `class-groups` | À brancher |
| Matières | `subjects` | `subjects` + `class-subjects` | Modèle splitté |
| Emploi du temps | `planning` | `schedules` + `sessions` | Proche, structure différente |
| Journal de séance | `TeachingLogView` | `sessions` + `class-subject-progress` | Proche |
| Évaluations | `evaluations` | `assessments` + `assessment-results` | Proche |
| Devoirs | `deadlines` | **Pas d'entité « devoir »** | Écart majeur |

### Module Finance

| Écran UI | Données mock | Entité(s) API | Statut |
|---|---|---|---|
| Frais | `fees` | `fees` | Bon alignement |
| Facturation élève | `billing` | `student-fees` | Proche (installments côté API) |
| Paiements | `PaymentsView` | `payments` + commands `record-payment`… | Bon alignement |

### Module Configuration

| Écran UI | Données mock | Entité(s) API | Statut |
|---|---|---|---|
| Matières (catalogue) | `subjects` + niveaux | `subjects` + `grade-levels` + `subject-matters` | Partiel |
| Personnel | `staff` | `staff-members` + `staff-assignments` + `staff-role-assignments` + `access-roles` | Partiellement branché |
| Rôles | 4 rôles fixes UI | `access-roles` (8+ `systemRoleKey`, permissions granulaires) | UI simplifiée |

### Transversal (header, fiches élève…)

| Concept UI | Mock | API |
|---|---|---|
| Année / période (header) | `academicYears`, `academicPeriods` | `academic-years`, `academic-periods`, `period-definitions` |
| Classes | `classes` (id `"6a"`) | `class-groups` (UUID + `gradeLevelId`) |
| Santé élève | `healthRecords` | `student-health-profiles` |
| Notes pédagogiques | `pedagogicalNotes` | `student-notes` |
| Absences | `absences` | `attendance` |
| Ressources (salles…) | `resources` | `resources` + `resource-assignments` |
| Dashboard éducateur | composite mock | plusieurs entités + queries |

---

## 2. Écarts de modèle (même idée, champs différents)

### Élève

| UI (`Student`) | API (`Student`) | Commentaire |
|---|---|---|
| `name` | `firstName` + `lastName` | Mapper nécessaire |
| `classId` | via `enrollments.classGroupId` | Pas sur l'entité élève directement |
| `email` | absent | UI invente un email |
| `average` | via `assessment-results` / `report-card-results` | Calcul agrégé |
| `attendance` (%) | via `attendance` | Calcul agrégé |
| `status` : honor / active / warning | `status` : active / inactive / graduated / archived | Sémantique différente |
| `guardian` (string) | via `guardian-links` | Relation séparée |

### Personnel

| UI (`StaffMember`) | API | Commentaire |
|---|---|---|
| `role` : 4 valeurs fixes | `access-roles.systemRoleKey` + permissions | API beaucoup plus riche |
| `department` | nom du rôle ou matière | Pas de champ direct |
| `classes` | `staff-assignments` + noms `class-groups` | OK avec jointures |
| `subjectsTaught` | via `assign-staff-to-class-subject` | Pas sur `StaffMember` |

### Matière

| UI (`Subject`) | API | Commentaire |
|---|---|---|
| Une matière **par classe** avec prof, couleur, heures | `subjects` (catalogue) + `class-subjects` (offre par classe) | L'API sépare catalogue et affectation |
| `teacher` | via `staff-assignments` | Jointure |
| `category`, `color` | absent | Purement UI |

### Incident

| UI | API (`Incident`) |
|---|---|
| Lié à **un élève** (`studentId`) | Incident **école/classe** ; élèves via `student-incident-involvements` |
| `category`, `severity`, `summary` | `kind`, `title`, `description`, `status`, workflow résolution |

### Calendrier

| UI (`SchoolYearEvent`) | API (`CalendarEvent`) |
|---|---|
| `type` : holiday, vacation, ceremony… | `kind`, `isNonSchoolDay`, `scopeKind`, `scopeId` |
| `scope` : `"all"` ou liste de classes | Modèle de portée structuré |

---

## 3. Dans l'UI mais absent (ou très différent) dans l'API

| Fonctionnalité UI | Détail |
|---|---|
| **Activités extrascolaires** (`Activity`, inscriptions pending/approved) | Pas d'entité « club / chorale / sport ». Le plus proche : `calendar-events` ou `announcements`, mais ce n'est pas équivalent. |
| **Devoirs / rendus** (`Deadline`, submissions submitted/late/missing) | Pas d'entité homework. Les `assessments` couvrent les **évaluations**, pas les feuilles d'exercices avec suivi de rendu. |
| **Statuts élève pédagogiques** (honor, warning, support) | Inventés pour l'UI ; l'API utilise un statut administratif (active, graduated…). |
| **Email élève** | Non présent dans le schéma `Student`. |
| **Couleurs / catégories visuelles** (mint, sky, warm…) | 100 % UI. |
| **4 rôles figés** (directeur, prof_principal, professeur, educateur) | L'API a des rôles configurables + ~40 permissions (`STUDENT_READ`, `ATTENDANCE_RECORD`…). |
| **Hiérarchie Middle School / High School** | UI en dur ; API via `grade-levels` + `class-groups`. |

---

## 4. Dans l'API mais absent (ou peu visible) dans l'UI

| Domaine API | Ce que ça apporte | UI actuelle |
|---|---|---|
| **Bulletins** (`report-card-definitions`, `results`, `sections`) | Bulletins complets, moyennes, rang, commentaires | Pas d'écran bulletin |
| **Annonces / messages** (`announcements`, `message-deliveries`, `announcement-targets`) | Communication ciblée parents/élèves | Absent |
| **Pièces jointes** (`attachments`, `register-attachment`) | Fichiers sur dossiers, paiements, incidents… | UI mock `{ name, size }` seulement |
| **Barèmes de notes** (`grade-scales`) | Échelles de notation configurables | Absent |
| **Chapitres / progression** (`subject-matters`, `class-subject-matters`, `class-subject-progress`) | Programme par matière | Partiel (`SubjectChaptersRow`) sans API |
| **Workflow discipline** (`disciplinary-actions`, commands resolve/apply…) | Sanctions, statuts, validation | UI liste incidents simple |
| **Commands métier** (73 actions) | promote, transfer, graduate, publish-report-card, generate-sessions… | Aucun formulaire ne les appelle |
| **Queries agrégées** | `get-overdue-fee-count`, `get-published-report-card-count` | Pas de KPI dashboard API |
| **Auth Better Auth** (`/api/auth/*`) | Login, session | Pas de page login |
| **Multi-écoles** (`schools`) | Plusieurs établissements | Un seul `PUBLIC_SCHOOL_ID` prévu |
| **Périodes académiques publiées** | `publish-academic-period`, `isPublished` | Header mock statique |

---

## 5. Inventaire API (référence)

### Entités (`/api/core/entities/{resource}/…`)

```
academic-periods, academic-years, access-roles, announcement-targets,
announcements, assessment-results, assessments, attachments, attendance,
calendar-events, class-groups, class-subject-matters, class-subject-progress,
class-subjects, definitions, disciplinary-actions, enrollments, fees,
grade-levels, grade-scales, guardian-links, guardians, incidents,
message-deliveries, payments, period-definitions, resource-assignments,
resources, results, schedules, schools, sections, sessions,
staff-assignments, staff-members, staff-role-assignments,
student-disciplinary-actions, student-fees, student-health-profiles,
student-incident-involvements, student-notes, students, subject-matters,
subjects
```

### Commands métier (extrait — 73 au total)

```
register-school, register-student, enroll-student, register-guardian,
register-staff-member, create-class-group, create-assessment,
record-assessment-result, record-attendance, record-incident,
create-fee, assign-fee-to-student, record-payment,
create-calendar-event, create-schedule, create-session,
publish-announcement, generate-report-card-result, publish-report-card-result,
promote-student, transfer-student, graduate-student, …
```

### Queries (2)

```
get-overdue-fee-count
get-published-report-card-count
```

---

## 6. Schéma de couverture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTERFACE SVELTEKIT                          │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│   School    │   Classes   │   Finance   │   Configuration       │
│  élèves ✓   │  matières   │  fees ✓     │  staff ✓ (partiel)    │
│  guardians  │  EDT        │  billing ✓  │  rôles (simplifié)    │
│  calendar   │  évals      │  payments ✓ │  matières catalogue   │
│  activités ✗│  devoirs ✗  │             │                       │
│  incidents  │             │             │                       │
└──────┬──────┴──────┬──────┴──────┬──────┴───────────┬───────────┘
       │             │             │                  │
       ▼             ▼             ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API EDAYA (OpenAPI)                         │
├─────────────────────────────────────────────────────────────────┤
│  COUVERT par l'UI (avec mappers)     │  API SANS écran UI       │
│  • students, enrollments, guardians  │  • report-cards          │
│  • class-groups, subjects            │  • announcements         │
│  • schedules, sessions, assessments  │  • attachments           │
│  • fees, student-fees, payments      │  • grade-scales            │
│  • staff, access-roles               │  • 73 commands métier      │
│  • calendar-events, attendance       │  • auth / multi-school     │
│  • incidents, student-notes, health  │                          │
├─────────────────────────────────────────────────────────────────┤
│  UI SANS équivalent API direct       │                          │
│  • activités extrascolaires          │                          │
│  • devoirs + suivi de rendus         │                          │
│  • statuts honor/warning/support     │                          │
└─────────────────────────────────────────────────────────────────┘

✓ = bon alignement   ✗ = écart majeur
```

---

## 7. Branchement actuel dans le code

| Page | Fichier `load` | Source données |
|---|---|---|
| `/school/students` | `src/routes/(app)/school/students/[[id]]/+page.server.ts` | API si `.env`, sinon mocks |
| `/configuration/staff` | `src/routes/(app)/configuration/staff/[[id]]/+page.server.ts` | API si `.env`, sinon mocks |
| **Tout le reste** | aucun `+page.server.ts` | 100 % `src/lib/data/school.ts` |

### Fichiers de la couche API (déjà en place)

```
src/lib/api/
  schema.d.ts              # types générés depuis OpenAPI
  client.ts                # client HTTP (openapi-fetch)
  config.ts                # PUBLIC_API_URL, PUBLIC_SCHOOL_ID
  http.ts                  # assertOk, listRequestBody
  types.ts                 # alias ApiStudent, ApiStaffMember, …
  resources/
    students.ts
    staff.ts
  mappers/
    student.ts
    staff.ts
src/lib/auth/client.ts     # Better Auth (non utilisé en UI)
```

---

## 8. Recommandations de branchement (par priorité)

### Priorité haute — bon alignement API

1. **Responsables** — `guardians/list` + `guardian-links/list`
2. **Classes** — `class-groups/list` + `grade-levels/list` (remplace les ids `"6a"`)
3. **Année / période (header)** — `academic-years/list` + `academic-periods/list`
4. **Matières par classe** — `subjects/list` + `class-subjects/list` + jointures staff
5. **Emploi du temps** — `schedules/list` + `sessions/list`
6. **Évaluations** — `assessments/list` + `assessment-results/list`
7. **Finance** — `fees/list` + `student-fees/list` + `payments/list`
8. **Absences** — `attendance/list`
9. **Incidents** — `incidents/list` + `student-incident-involvements/list`
10. **Calendrier** — `calendar-events/list`
11. **Fiche élève** — `student-health-profiles`, `student-notes`, guardians liés

### Priorité moyenne — adaptation UI ou mapper complexe

- **Rôles / permissions** — remplacer les 4 rôles UI par `access-roles` + matrice de permissions
- **Ressources** — `resources/list` (adapter champs `location`, `status` UI)
- **Dashboard éducateur** — agrégation + queries API

### Décision produit requise

| Sujet | Options |
|---|---|
| Activités extrascolaires | Nouvelle entité API **ou** retirer/simplifier l'écran UI |
| Devoirs avec rendus | Réutiliser `assessments` **ou** nouvelle entité **ou** retirer l'écran |
| Statuts honor / warning | Calcul front (notes + absences) **ou** abandonner ces badges |

### Opportunités (API riche, UI à créer)

- Écrans bulletins (`report-card-*`)
- Messagerie / annonces (`announcements`)
- Page de connexion (Better Auth)
- Actions métier dans les formulaires (commands)

---

## 9. Mapping entités API ↔ types mock UI

| Type mock (`school.ts`) | Schéma(x) API principal(aux) |
|---|---|
| `Student` | `Student`, `StudentClassEnrollment` |
| `Guardian` | `Guardian`, `GuardianStudentLink` |
| `StaffMember` | `StaffMember`, `StaffAssignment`, `StaffRoleAssignment`, `AccessRole` |
| `ClassNode` | `ClassGroup`, `GradeLevel` |
| `Subject` | `Subject`, `ClassSubject` |
| `PlanningEvent` | `Schedule`, `Session` |
| `Evaluation` | `Assessment`, `AssessmentResult` |
| `Incident` | `Incident`, `StudentIncidentInvolvement` |
| `AbsenceRecord` | `Attendance` |
| `Fee` | `Fee` |
| `StudentBilling` | `StudentFee` |
| `SchoolYearEvent` | `CalendarEvent` |
| `HealthRecord` | `StudentHealthProfile` |
| `PedagogicalNote` | `StudentNote` |
| `Activity` | — (pas d'équivalent) |
| `Deadline` | — (pas d'équivalent) |
| `Resource` | `Resource`, `ResourceAssignment` |
| `AcademicYear` / `AcademicPeriod` | `AcademicYear`, `AcademicPeriod` |

---

## Annexe — Champs clés API (extraits OpenAPI)

### Student

`id`, `schoolId`, `firstName`, `lastName`, `gender`, `birthDate`, `placeOfBirth`, `nationality`, `matricule`, `photoUrl`, `status`, `enrollmentDate`, `createdAt`

### StaffMember

`id`, `schoolId`, `firstName`, `lastName`, `email`, `isActive`, `createdAt`

### ClassGroup

`id`, `schoolId`, `academicYearId`, `gradeLevelId`, `name`, `capacity`, `attendanceMode`, `homeroomStaffId`, `createdAt`

### Assessment

`id`, `classGroupId`, `classSubjectId`, `periodId`, `title`, `kind`, `maxScore`, `coefficient`, `sessionId`, `dueAt`, `metAt`, `date`, `createdAt`

### StudentFee

`id`, `studentId`, `feeId`, `expectedAmount`, `paidAmount`, `dueDate`, `status`, `installments`, …

---

*Document généré pour le projet EDAYA. Regénérer les types API après mise à jour de la spec : `npm run generate:api`.*
