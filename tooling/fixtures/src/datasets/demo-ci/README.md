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
| Classes | 6ème 1, 6ème 2, 5ème 1, 4ème 1, 3ème 1 |
| Élèves | 30 |
| Parents | 21 |
| Personnel | 5 |
| Enseignants portail | 5 (`ci-t1` → `ci-t5`) |
| Bulletins (T1) | 30 résultats (tous les élèves) |

## Nommage des classes

Les classes du seed sont construites **comme l'onboarding les construit** : racine = libellé court du niveau (`label`), suffixe numérique par défaut. Le seed déclare donc `name: 'Sixième'` et `label: '6ème'`, ce qui donne `6ème 1`, `6ème 2`. Un test de dérive vérifie que chaque nom de classe est bien `classNameFromLabel(label, index, 'numerical')`.

Le libellé traverse trois couches sous trois orthographes :

| Couche | Clé | Exemple |
|--------|-----|---------|
| JSON de template onboarding | `short_label` | `6ème` |
| Template et catalogue (TypeScript) | `shortLabel` | `6ème` |
| Domaine, base et UI | `label` | `6ème` |

## Domaines couverts

| Domaine | Contenu |
|---------|---------|
| Scolarité | Structure, curriculum, 5 classes, 33 matières de classe |
| Population | 30 élèves, 21 parents, liens famille |
| Enseignants | 5 portail + affectations (toutes les matières de classe couvertes) |
| Emploi du temps | 6 créneaux récurrents matérialisés en séances sur l'année scolaire |
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
| `a.toure@ecole-ci.edaya.dev` | Enseignante portail (ci-t1) — maths et physique-chimie |
| `k.diomande@ecole-ci.edaya.dev` | Enseignant portail (ci-t2) — EPS, PP 6ème 2 |
| `m.kone@mail.ci` | Parent (ci-g1) — enfants ci-s1, ci-s10 |

Mot de passe : `DevPassword1!`

```bash
# identity + school API must both be running
cd ../edaya_identity && bun repo dev     # terminal 1 — :9900
cd edaya_backend && bun repo seed clean --yes
bun repo dev                             # terminal 2 — :9999
bun repo seed                            # terminal 3, once both are ready
```

Pour le bulk ivoirien (1000 élèves) : `SEED_DATASET=ci`. Pour Ottawa : `SEED_DATASET=central` dans `apps/api/.env`.
