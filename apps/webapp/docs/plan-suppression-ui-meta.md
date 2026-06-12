# Plan de suivi — Branchement API complet (sans enrichissements locaux)

**Objectif :** tout ce qui s'affiche dans la webapp doit venir des **réponses HTTP de l'API**, sans rustines `*_UI_META` ni fallbacks par ID de seed dans `src/lib/api/`.

**Source des données de démo :** `edaya/testing/dev-fixtures/` (`@edaya/dev-fixtures`) → seed API → HTTP → webapp.

**Convention :**

- `- [ ]` = à faire
- `- [x]` = fait
- Une tâche **implémentation** est finie quand : champ exposé par l'API + seed à jour + mapper webapp sans fallback par ID.
- Une tâche **test UI** est finie quand : parcours manuel validé avec `bun run dev` (API + webapp démarrées, seed appliqué).

**Dernière mise à jour :** juin 2026

---

## Comment lire ce document

Trois niveaux de branchement :


| Niveau                | Signification                                                   | Exemple                                          |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| ✅ **API complète**    | HTTP + tous les champs UI viennent de la réponse                | Élèves, classes, finance                         |
| 🟡 **API partielle**  | HTTP oui, mais le mapper complète en local                      | Incidents (catégorie), bulletins (appréciations) |
| ⚠️ **Stub prototype** | HTTP oui, mais pas d'entité domaine (route `/core/prototype/`*) | Activités, devoirs, carnet de cours              |


```
dev-fixtures  →  seed API  →  endpoint HTTP  →  mapper webapp  →  écran UI
                    ↑              ↑                  ↑
              parfois champs    parfois stub      parfois *_UI_META
               non persistés
```

---

## Déjà branché sur l'API (rien à faire)

Ces domaines chargent via `client.entities.*` ou auth, **sans** `*_UI_META`.


| Domaine                                   | Endpoint / client                      | Écrans UI                                                      |
| ----------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Établissements, années, périodes, classes | `shell-data.ts`                        | Header, sidebar, sélecteurs                                    |
| Élèves, tuteurs, inscriptions             | `people-data.ts`                       | `/school/students`, `/school/guardians`, `/classes/…/students` |
| Planning, ressources                      | `planning-data.ts`                     | `/classes/…/timetable`                                         |
| Évaluations                               | `assessments-data.ts`                  | `/classes/…/evaluations`                                       |
| Finance (frais, facturation, paiements)   | `finance-data.ts`                      | `/finance/fees`, `/finance/billing`, `/finance/payment`        |
| Absences (données brutes)                 | `school-life-data.ts`                  | `/school/events` (onglet absences)                             |
| Auth & session                            | `bootstrap.ts`                         | Toute l'app                                                    |
| Permissions effectives                    | `/core/authorization/effective-grants` | Boutons conditionnels                                          |


---

## Ce qui n'est PAS encore 100 % branché — vue d'ensemble

Cocher la colonne **Impl.** quand l'API + mapper sont prêts, puis la colonne **Test UI**.


| #   | Domaine                                      | Problème                                  | Fichier(s)             | Impl. | Test UI |
| --- | -------------------------------------------- | ----------------------------------------- | ---------------------- | ----- | ------- |
| 1   | Incidents — catégorie / gravité              | `INCIDENT_UI_META` par ID                 | `school-life-data.ts`  | [x]   | [ ]     |
| 2   | Calendrier — descriptions                    | Textes génériques hardcodés               | `school-life-data.ts`  | [x]   | [ ]     |
| 3   | Santé élève                                  | `HEALTH_UI_META` (lastVisit, meds, notes) | `student-360-data.ts`  | [x]   | [ ]     |
| 4   | Notes pédagogiques — catégorie               | Stockée dans `title`, pas enum API        | `student-360-data.ts`  | [x]   | [ ]     |
| 5   | Barèmes — passingScore, description          | `GRADE_SCALE_UI_META`                     | `report-cards-data.ts` | [x]   | [ ]     |
| 6   | Définitions bulletins — gradeScaleId, status | `DEFINITION_UI_META`                      | `report-cards-data.ts` | [x]   | [ ]     |
| 7   | Sections bulletins — kind UI                 | `SECTION_UI_META`                         | `report-cards-data.ts` | [x]   | [ ]     |
| 8   | Résultats bulletins — appréciations          | `MARK_UI_META`                            | `report-cards-data.ts` | [x]   | [ ]     |
| 9   | Résolution subject → classSubject            | `SUBJECT_TO_CLASS_SUBJECT_6A`             | `report-cards-data.ts` | [x]   | [ ]     |
| 10  | Staff — rôle / département / matières        | Fallbacks `st1`, `st3`, `st5`, `st7`      | `staff-data.ts`        | [x]   | [ ]     |
| 11  | Login — rôle compte démo                     | `DEMO_STAFF_ROLES` dans l'API             | `prototype.routes.ts`  | [x]   | [ ]     |
| 12  | Matrice permissions                          | `ROLE_PERMISSIONS` statique               | `drawer-constants.ts`  | [x]   | [ ]     |
| 13  | Matières — couleur / catégorie               | Inférence locale (regex)                  | `subjects-data.ts`     | [x]   | [ ]     |
| 14  | Activités extrascolaires                     | Stub `/prototype/activities`              | `prototype-data.ts`    | [ ]   | [ ]     |
| 15  | Devoirs / deadlines                          | Stub `/prototype/deadlines`               | `prototype-data.ts`    | [x]   | [ ]     |
| 16  | Carnet de cours                              | Stub `/prototype/teaching-log`            | `prototype-data.ts`    | [x]   | [ ]     |
| 17  | Comptes démo login                           | Stub `/prototype/demo-accounts`           | `login/+page.svelte`   | [ ]   | [ ]     |


---

## Détail par item — implémentation + tests UI

### 1 — Incidents : catégorie & gravité

**Écart :** `mockCategory` / `mockSeverity` existent dans `SEED_INCIDENTS` (`dev-fixtures`) mais ne sont ni persistés ni renvoyés. Le mapper utilise `INCIDENT_UI_META` (`i1`, `i2`, `i3`).

**Implémentation**

- [x] Persister un `kind` distinct par incident dans `run-dev-seed.ts` (`i3` → `major_infraction`)
- [x] Dériver `category` + `severity` depuis `title`, `description` et `kind` (sans table par ID)
- [x] Supprimer `INCIDENT_UI_META` dans `school-life-data.ts`

**Test UI** (compte : éducateur `t.evrard@school.edu` ou directeur)

- [x] `/school/events` — liste : 3 incidents visibles (Mira Okafor, Noah Bennett)
- [x] Cliquer incident `i1` → badge catégorie **Retard**, gravité **faible**
- [x] Incident `i2` → **Comportement**, gravité **moyenne**
- [x] Incident `i3` → **Conflit**, gravité **moyenne**
- [x] Drawer latéral : résumé + date + élève corrects
- [ ] Vérifier dans l'onglet Network : `POST …/incidents/list` — pas de valeur inventée côté front

---

### 2 — Calendrier : descriptions

**Écart :** `SEED_CALENDAR_EVENTS` a des `description` riches ; l'API `CalendarEvent` n'a pas ce champ. Le mapper génère `'Jour férié.'`, `'Vacances scolaires.'`, etc.

**Implémentation**

- [x] Ajouter `description` au domaine `CalendarEvent` (+ migration Postgres `0001_calendar_event_description`)
- [x] Mettre à jour `run-dev-seed.ts` pour persister les descriptions du seed
- [x] Mapper lit `event.description` depuis l'API (fallback par `kind` seulement si absent)

**Test UI**

- [x] `/school/calendar` — au moins 10 événements listés
- [x] Événement « Vacances de printemps » → description du seed (pas « Vacances scolaires. » générique)
- [x] Événement « Cérémonie de remise des prix » → description spécifique du seed
- [x] Filtre par type (férié / vacances / cérémonie) fonctionne
- [x] Drawer détail événement : titre, dates, description, portée (toute l'école / classe)

---

### 3 — Santé élève

**Écart :** `HEALTH_UI_META` injecte `lastVisit`, `medications`, `notes` pour `s1`, `s3`, `s5`. Le seed a ces champs mais `run-dev-seed.ts` ne persiste que `bloodType`, `allergies`, `medicalConditions`.

**Implémentation**

- [x] Étendre `StudentHealthProfile` (`lastVisit`, `medications`, `clinicalNotes`) + migration `0002_student_health_profile_fields`
- [x] Mettre à jour `run-dev-seed.ts` — persister tous les champs de `SEED_STUDENT_HEALTH_PROFILES`
- [x] Supprimer `HEALTH_UI_META` dans `student-360-data.ts`

**Test UI**

- [x] `/school/students/s3` → onglet **Santé**
- [x] Mira Okafor (`s3`) : allergies Arachides + Crustacés, médicament EpiPen, dernière visite `08/04/2026`
- [x] Amélie Laurent (`s1`) : allergie Pollen, asthme, visite `14/02/2026`
- [x] Élève sans profil santé → état vide propre (pas de données fantômes)
- [ ] Network : `studentHealthProfiles/list` contient les champs affichés

---

### 4 — Notes pédagogiques : catégorie

**Écart :** la catégorie (`Comportement`, `Travail`, …) est stockée dans `StudentNote.title` au seed — hack fonctionnel mais pas un enum API.

**Implémentation**

- [x] Enum `StudentNoteCategory` (`behavior`, `work`, `progress`, `encouragement`) sur `StudentNote` + migration `0003_student_note_category`
- [x] Mettre à jour `run-dev-seed.ts` — persister `category` depuis `SEED_PEDAGOGICAL_NOTES` (plus de hack `title`)
- [x] Simplifier `mapNoteCategory()` — lit `note.category` depuis l'API (fallback `title` pour rétrocompat)
- [x] Tests : `student-note.test.ts`, `student-360-data.test.ts`, `test-dev-student-360-seed.test.ts`

**Test UI**

- [x] `/school/students/s1` → onglet **Notes** (ou section notes pédagogiques)
- [x] 3 notes visibles avec bonnes catégories : Progression, Travail, Encouragement
- [x] `/school/students/s2` → note « Comportement » visible
- [x] Dates et auteurs (st1, st2, st3) corrects

---

### 5 — Barèmes (grade scales)

**Écart :** `GRADE_SCALE_UI_META` fournit `passingScore`, `decimalPlaces`, `description` par ID (`gs-20`, `gs-100`, `gs-lettres`).

**Implémentation**

- [x] Calculer `passingScore` depuis `ranges[].isPassing` via `derivePassingScore()` — sans table par ID
- [x] Ajouter `decimalPlaces` et `description` sur `GradeScale` (+ migration `0004_grade_scale_ui_fields`)
- [x] Mettre à jour `seed-report-cards.ts` — persister `mockDecimalPlaces` et `mockDescription`
- [x] Supprimer `GRADE_SCALE_UI_META` dans `report-cards-data.ts`
- [x] Tests : `grade-scale.test.ts`, `report-cards-data.test.ts`, `test-dev-report-cards-seed.test.ts`

**Test UI**

- [x] `/configuration/grade-scales`
- [x] Barème « Sur 20 » : seuil de réussite = 10, 2 décimales
- [x] Barème « Lettres » : description « A = Très bien… » si conservée
- [x] Badge « par défaut » sur le bon barème

---

### 6 — Définitions de bulletins

**Écart :** `DEFINITION_UI_META` lie `gradeScaleId` et `status` (published/draft) par ID de définition.

**Implémentation**

- [x] Ajouter `gradeScaleId` et enum `status` (`draft` / `published`) sur `ReportCardDefinition` (+ migration `0005_report_card_definition_fields`)
- [x] Mettre à jour `seed-report-cards.ts` — persister `gradeScaleId` et `mockStatus`
- [x] Mapper `status` et `gradeScaleId` depuis l'API via `mapDefinitionStatus()` — plus de confusion avec `isDefault`
- [x] Supprimer `DEFINITION_UI_META` ; résultats bulletins lisent `gradeScaleId` depuis la définition liée
- [x] Corriger `publishReportCardDefinitionMutation` — met `status: 'published'` (plus `isDefault: true`)
- [x] Tests : `report-card-definition.test.ts`, `report-cards-data.test.ts`, `test-dev-report-cards-seed.test.ts`

**Test UI**

- [ ] `/configuration/report-cards`
- [x] Définition « Bulletin mi-scolarité 6ème » → statut **Publié**, barème Sur 20
- [x] Définition brouillon → badge **Brouillon**
- [x] Détail définition : sections listées, barème affiché

---

### 7 — Sections de bulletins

**Écart :** `SECTION_UI_META` mappe `mockKind` (matieres / synthese / appreciation). L'API a `group` / `subject`.

**Implémentation**

- [x] Enum `ReportCardDefinitionSectionRole` (`matieres`, `synthese`, `appreciation`) + champ `coefficient` (+ migration `0006_report_card_section_role`)
- [x] Mettre à jour `seed-report-cards.ts` — persister `mockKind` et `mockCoefficient`
- [x] `mapSectionRole()` lit `role` depuis l'API (fallback hiérarchie + noms de section)
- [x] Supprimer `SECTION_UI_META` ; résultats filtrés par sections avec notes matières (`subResults` + `classSubjectId`)
- [x] Tests : `report-card-definition-section-role.test.ts`, `report-cards-data.test.ts`, `test-dev-report-cards-seed.test.ts`

**Test UI**

- [x] `/configuration/report-cards/rcd-ms-6` (définition 6ème)
- [x] Sections « Fondamentales », « Sciences », « Sport », « Synthèse », « Appréciation » avec bons types
- [x] Coefficients affichés (2, 1.5, 1) correspondent au seed

---

### 8 — Appréciations par matière (résultats)

**Écart :** `MARK_UI_META` — les textes (« Excellent — maîtrise remarquable… ») sont dans `SEED_REPORT_CARD_RESULTS` mais perdus dans `buildSectionResults()`.

**Implémentation**

- [x] Ajouter `comment` sur `ReportCardResultSection` (niveau subject, core) — mappé en `appreciation` côté UI
- [x] Persister `appreciation` et `coefficient` exacts dans `buildSectionResults()` (jsonb `sectionResults`)
- [x] Supprimer `MARK_UI_META` ; `mapSubjectMark()` lit `comment` et `weight` depuis l'API
- [x] Tests : `report-card-result-section.test.ts`, `report-cards-data.test.ts`, `test-dev-report-cards-seed.test.ts`

**Test UI**

- [ ] `/classes/6a/report-cards` → résultat Amélie Laurent (`rcr-s1-t3`)
- [ ] Maths : note ~18.5 + appréciation « Excellent — maîtrise remarquable de l'algèbre. »
- [ ] `/school/students/s1` → panneau bulletin : mêmes appréciations
- [ ] Résultat Noah Bennett (`rcr-s2-t3`) : appréciations différentes de s1
- [ ] Nom du professeur par matière affiché (depuis `staffAssignments`)

---

### 9 — Résolution subject → classSubject

**Écart :** `SUBJECT_TO_CLASS_SUBJECT_6A` table statique (`subj-math` → `cs-6a-math`).

**Implémentation**

- [x] `resolveClassSubjectId()` — résolution dynamique via `classSubjects` + `classGroupId`
- [x] Définitions : `subjectIds` = catalogue API, `subjectLabels` depuis `subjectsRaw`
- [x] Résultats : noms matières via `classSubjectId` → `subjectsRaw` (déjà `classSubjectId` en seed)
- [x] Supprimer `SUBJECT_TO_CLASS_SUBJECT_6A` ; UI définition affiche les libellés
- [x] Tests : `report-cards-data.test.ts`

**Test UI**

- [x] Bulletins classe 6a ET Terminale (si applicable) : matières correctement liées
- [x] Pas de matière orpheline ou ID technique affiché à l'utilisateur

---

### 10 — Staff : rôle, département, matières

**Écart :** `staff-data.ts` a des `if (member.id === 'st5')` malgré un seed access (`run-dev-access-seed.ts`) partiellement en place. Département et `subjectsTaught` restent en fallback.

**Implémentation**

- [x] `mapStaffRole()` — `staffRoleAssignments.roleIds` (`role-director` → directeur, etc.)
- [x] `mapDepartment()` — rôle + `responsibility` + catalogue matières enseignées
- [x] `subjectsTaught` / `subjectLabels` — via `staffAssignments.classSubjectId` → `classSubjects` → `subjects`
- [x] Supprimer tous les fallbacks par ID staff ; fiche staff affiche département + matières
- [x] Tests : `staff-data.test.ts`

**Test UI**

- [x] Header : nom + rôle correct selon compte connecté
- [x] `/configuration/staff/st5` → Camille Moreau, rôle **Directeur**, département Direction
- [x] `/configuration/staff/st3` → Mme Léon, **Prof principal**, département Lettres
- [x] `/configuration/staff/st1` → matières enseignées visibles (Maths, Sciences)
- [x] Dashboard éducateur (`st7`) : classes et élèves filtrés correctement

---

### 11 — Login : rôle compte démo

**Écart :** `DEMO_STAFF_ROLES` hardcodé dans `apps/api/src/routes/prototype.routes.ts` au lieu de lire `staffRoleAssignments`.

**Implémentation**

- [x] `buildDemoLoginAccounts()` — rôles depuis `staffRoleAssignments` (`role-director` → directeur, etc.)
- [x] `listPrototypeDemoAccountsHandler` lit les assignments en base
- [x] Supprimer `DEMO_STAFF_ROLES` et `LOGIN_DEMO_STAFF_IDS` ; filtre dynamique (comptes auth + 1 prof)
- [x] Tests : `test-demo-accounts.test.ts`, `test-prototype-routes.test.ts`

**Test UI**

- [x] `/login` — 4 comptes démo affichés
- [x] Camille Moreau → rôle **Directeur** ; Tom Évrard → **Éducateur**
- [ ] Connexion chaque compte → header affiche bon nom + permissions cohérentes
- [x] Déconnexion + reconnexion autre compte → données rechargées

---

### 12 — Matrice permissions rôles

**Écart :** `ROLE_PERMISSIONS` et `STAFF_PERMISSIONS` dans `drawer-constants.ts` — config statique. `loadAccessRolesData()` ne couvre pas 100 %.

**Implémentation**

- [x] `PERMISSION_CATALOG` + `UI_PERMISSION_API_RULES` dans `access-roles-data.ts`
- [x] `loadAccessRolesData()` → matrice CRUD complète depuis `accessRoles.permissions`
- [x] `RoleDetail` + `StaffPermissionsBlock` : `roleCrudMatrix` / `roleEnabledPermissions` API uniquement
- [x] `drawer-constants.ts` : styles, libellés CRUD/portée uniquement (plus de `ROLE_PERMISSIONS` statique)
- [x] Tests : `access-roles-data.test.ts`

**Test UI**

- [x] `/configuration/roles` → matrice 4 rôles × permissions
- [x] Cliquer rôle **Professeur** → détail : notes en scoped, finance en none
- [x] `/configuration/staff/st1` → bloc permissions staff cohérent avec le rôle
- [ ] Connecté en professeur : boutons admin (finance, config) masqués

---

### 13 — Matières : couleur & catégorie

**Écart :** inférence locale dans `subjects-data.ts` (regex sur nom, hash pour couleur). Pas de champ API.

**Implémentation**

- [x] Champs persistés `category` + `color` sur `Subject` (domaine core + migration `0008`)
- [x] Seed `SEED_SUBJECT_CATALOG` enrichi (catégorie + couleur par matière)
- [x] `subjects-data.ts` : lecture API, suppression `pickColor` / `inferCategory`
- [x] Tests : `subjects-data.test.ts`
- [x] OpenAPI régénéré

**Test UI**

- [ ] `/configuration/subjects` — couleurs stables entre rechargements
- [x] `/classes/6a/subjects` — catégories (Scientifique, Littéraire, Langues…) cohérentes
- [ ] `/configuration/subjects/level/gl-6` — regroupement par catégorie correct

---

### 14 — Activités extrascolaires (stub → domaine)

**Écart :** `POST /core/prototype/activities/list` sert `SEED_ACTIVITIES` sans entité domaine ni DB.

**Implémentation**

- [ ] Créer entité domaine + workflows dans `@edaya/core`
- [ ] Exposer `client.entities.activities.list()` (ou nom final)
- [ ] Seed dans `run-dev-seed.ts`
- [ ] Remplacer `fetchActivities()` dans `prototype-data.ts`
- [ ] Supprimer route prototype

**Test UI**

- [ ] `/school/activities` — 4+ activités (Robotique, Chorale, …)
- [ ] `/school/activities/act-robot` → coach, horaire, capacité 24, 18 participants
- [ ] Inscriptions élèves : statuts approved / pending / denied
- [ ] Drawer activité depuis liste

---

### 15 — Devoirs / deadlines (stub → domaine)

**Écart :** `POST /core/prototype/deadlines/list` — pas d'entité domaine.

**Implémentation**

- [x] Entités `HomeworkAssignment` + `HomeworkSubmission` (domaine core + migration `0009`)
- [x] Seed `SEED_HOMEWORK_ASSIGNMENTS` / `SEED_HOMEWORK_SUBMISSIONS` dans `run-dev-seed.ts`
- [x] `homework-data.ts` : `fetchDeadlines()` via `client.entities.homework`*
- [x] Route prototype `/prototype/deadlines/list` supprimée
- [x] Tests : `homework-data.test.ts`, `test-dev-homework-seed.test.ts`
- [x] OpenAPI régénéré

**Test UI**

- [x] `/classes/6a/homework` — devoirs listés par date
- [x] Détail devoir → matière, description, pièces jointes, soumissions par élève
- [x] Statuts submitted / late / missing visibles
- [x] Filtre par classe : devoirs d'une autre classe non mélangés
- [ ] ajouter plusieurs classes avec devoirs

---

### 16 — Carnet de cours (stub → domaine)

**Écart :** `POST /core/prototype/teaching-log/list` — pas d'entité domaine.

**Implémentation**

- [x] Entité `ClassLogbookEntry` (domaine core + migration `0010`)
- [x] Seed `SEED_TEACHING_LOG_ENTRIES` dans `run-dev-seed.ts` (IDs `tle-{classSubjectId}-{index}`)
- [x] `teaching-log-data.ts` : `fetchTeachingLogEntries()` via `client.entities.classLogbookEntries`
- [x] `LogEntry.classId` + filtre par classe dans `teachingLogContext`
- [x] Route prototype `/prototype/teaching-log/list` supprimée
- [x] Tests : `teaching-log-data.test.ts`, `test-dev-teaching-log-seed.test.ts`
- [x] OpenAPI régénéré

**Test UI**

- [ ] `/classes/6a/teaching` — entrées du carnet listées
- [ ] Détail entrée → chapitre, contenu, objectifs, progression %
- [ ] Filtre par matière fonctionne
- [ ] Devoirs à faire (homework) affichés si présents dans l'entrée

---

### 17 — Comptes démo (stub → query staff)

**Écart :** `POST /core/prototype/demo-accounts/list` au lieu d'une query sur staff + auth.

**Implémentation**

- [ ] Nouvel endpoint ou query `staffMembers` filtrable pour login
- [ ] Adapter `login/+page.svelte`
- [ ] Supprimer route prototype demo-accounts

**Test UI**

- [ ] `/login` sans route prototype : comptes toujours listés
- [ ] Mêmes 4 comptes, emails et initiales corrects

---

## Phase finale — validation globale

### Nettoyage code

- [ ] Zéro `*_UI_META` dans `src/lib/api/` (vérifier : `rg '_UI_META' apps/webapp/src/lib/api`)
- [ ] Zéro fallback `member.id === 'st` dans `staff-data.ts`
- [ ] Routes `/core/prototype/`* supprimées (si items 14–17 faits)
- [ ] `schema.d.ts` / `openapi.json` régénérés

### Smoke test complet (après toutes les cases Impl. cochées)


| Parcours         | Route(s)                                                     | Test UI                                |
| ---------------- | ------------------------------------------------------------ | -------------------------------------- |
| Auth             | `/login`                                                     | [ ] 4 comptes, connexion / déconnexion |
| Shell            | Header + sidebar                                             | [ ] École, année, classe, utilisateur  |
| Élèves           | `/school/students`                                           | [ ] Liste + fiche s1, s3               |
| Tuteurs          | `/school/guardians`                                          | [ ] Liste + détail                     |
| Calendrier       | `/school/calendar`                                           | [ ] Événements + descriptions          |
| Incidents        | `/school/events`                                             | [ ] 3 incidents + catégories           |
| Activités        | `/school/activities`                                         | [ ] Liste + détail + inscriptions      |
| Classe           | `/classes/6a/students`                                       | [ ] 7 élèves classe 6a                 |
| Emploi du temps  | `/classes/6a/timetable`                                      | [ ] Créneaux semaine                   |
| Devoirs          | `/classes/6a/homework`                                       | [ ] Deadlines + soumissions            |
| Carnet           | `/classes/6a/teaching`                                       | [ ] Entrées pédagogiques               |
| Évaluations      | `/classes/6a/evaluations`                                    | [ ] Notes par matière                  |
| Bulletins        | `/classes/6a/report-cards`                                   | [ ] Résultats + appréciations          |
| Finance          | `/finance/fees`, `/finance/billing`                          | [ ] Frais + factures élèves            |
| Config           | `/configuration/staff`, `/configuration/roles`               | [ ] Staff + matrice                    |
| Bulletins config | `/configuration/report-cards`, `/configuration/grade-scales` | [ ] Définitions + barèmes              |


### Prérequis pour tester

```bash
# Terminal 1 — API
cd edaya/apps/api && bun run dev

# Terminal 2 — Seed (si base vide)
cd edaya/apps/api && bun run seed

# Terminal 3 — Webapp
cd edaya/apps/webapp && bun run dev
```

Mot de passe comptes démo : voir `DEV_AUTH_PASSWORD` dans `@edaya/dev-fixtures` (`DevPassword1!`).

---

## Ordre recommandé

```
1 Incidents          ← rapide, gros impact visuel
2 Calendrier
3 Staff + Login (10, 11)   ← seed access déjà partiel
4 Santé + Notes (3, 4)
5 Bulletins (5–9)    ← le plus lourd (core)
6 Permissions (12)
7 Prototype → domaine (14–17)
8 Matières (13)      ← optionnel
9 Validation globale
```

---

## Journal de progression


| Date       | Item(s) | Note                                                                            |
| ---------- | ------- | ------------------------------------------------------------------------------- |
| 2026-06-11 | —       | Plan initial : audit architecture API OK                                        |
| 2026-06-11 | Doc     | Restructuration : tableau cochable + tests UI par item                          |
| 2026-06-11 | 1       | Incidents : seed kinds + mapper `mapIncidentCategory/Severity`, tests bun       |
| 2026-06-11 | 2       | Calendrier : champ `description` core + seed + mapper, OpenAPI regen, tests     |
| 2026-06-11 | 3       | Santé : `lastVisit`, `medications`, `clinicalNotes` core + seed + mapper, tests |


