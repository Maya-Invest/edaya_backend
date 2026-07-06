# Dataset démo Côte d'Ivoire

Fixtures typées pour une école collège ivoirienne (Abidjan), entièrement en français — couverture complète pour démos produit.

Import : `demoCiDataset` depuis `@edaya/fixtures` ou `@edaya/fixtures/datasets/demo-ci`.

```text
demo-ci/
├── index.ts       # demoCiDataset (30 élèves — démo complète)
├── school.ts      # école, trimestres, niveaux collège, matières MENA-CI
├── people.ts      # élèves, personnel, parents (noms ivoiriens)
├── teachers.ts    # enseignants portail (Teacher + TeacherAssignment)
├── rosters.ts     # effectifs par classe (partagés entre domaines)
└── domains/
    ├── scheduling.ts
    ├── assessments.ts
    ├── assessments-homework.ts
    ├── report-cards.ts
    ├── attendance.ts
    ├── finance.ts
    ├── activities.ts
    ├── communications.ts
    ├── discipline.ts
    ├── incidents.ts
    ├── student-support.ts
    ├── calendar.ts
    └── attachments.ts
```

| Élément | Valeur |
|---------|--------|
| École | École Edaya — Cocody |
| Ville / pays | Abidjan, Côte d'Ivoire |
| Fuseau | `Africa/Abidjan` |
| Niveaux | 6ème → 3ème (Collège) |
| Classes | 6ème A, 6ème B, 5ème A, 4ème A, 3ème A |
| Élèves | 30 |
| Parents | 21 |
| Personnel | 5 |
| Enseignants portail | 2 (`ci-t1`, `ci-t2`) |
| Bulletins (T1) | 30 résultats (tous les élèves) |

## Domaines couverts

| Domaine | Contenu |
|---------|---------|
| Scolarité | Structure, curriculum, 5 classes, 33 matières de classe |
| Population | 30 élèves, 21 parents, liens famille |
| Enseignants | 2 portail + affectations |
| Emploi du temps | 5 créneaux, 3 ancres de progression |
| Évaluations | Contrôles T1 (toutes classes) + devoirs maison |
| Bulletins | 4 modèles (6ème→3ème), 30 résultats T1 |
| Vie scolaire | Présences, absences, justificatifs en attente |
| Finance | Frais en XOF, échéances, paiements partiels |
| Activités | 5 clubs + inscriptions (approuvées/en attente/refusées) |
| Communications | Annonces, cibles, livraisons de messages |
| Discipline | Sanctions, incidents, actions disciplinaires |
| Suivi élève | Profils santé, notes pédagogiques |
| Calendrier | Vacances, fêtes, sorties, événements |
| Pièces jointes | Documents liés aux entités ci-dessus |

## Seed dev local (défaut)

Le seed dev utilise **`demoCiDataset`** par défaut (`sch-edaya-ci-cocody`, 30 élèves, comptes `@ecole-ci.edaya.dev`) :

| Compte | Rôle |
|--------|------|
| `a.kone@ecole-ci.edaya.dev` | Propriétaire (ci-st8) |
| `j.aka@ecole-ci.edaya.dev` | Directeur (ci-st5) |
| `f.assi@ecole-ci.edaya.dev` | Professeur principal / coord. (ci-st3) |
| `a.toure@ecole-ci.edaya.dev` | Enseignante portail (ci-t1) — maths en 6ème A et 5ème A |
| `k.diomande@ecole-ci.edaya.dev` | Enseignant portail (ci-t2) — PP 6ème B |
| `m.kone@mail.ci` | Parent (ci-g1) — enfants ci-s1, ci-s10 |

Mot de passe : `DevPassword1!`

```bash
cd edaya_backend && bun seed:clean --yes
bun dev          # terminal 1
bun seed:init    # terminal 2, once API is ready
```

Pour le bulk ivoirien (1000 élèves) : `SEED_DATASET=ci`. Pour Ottawa : `SEED_DATASET=central` dans `apps/api/.env`.
