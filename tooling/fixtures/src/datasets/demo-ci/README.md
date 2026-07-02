# Dataset démo Côte d'Ivoire (compact)

Fixtures typées pour une école collège ivoirienne (Abidjan), entièrement en français.

Import : `demoCiDataset` depuis `@edaya/fixtures` ou `@edaya/fixtures/datasets/demo-ci`.

```text
demo-ci/
├── index.ts    # demoCiDataset (12 élèves — smoke / tests)
├── school.ts   # école, trimestres, niveaux collège, matières MENA-CI
└── people.ts   # élèves, personnel, parents (noms ivoiriens)
```

| Élément | Valeur |
|---------|--------|
| École | École Edaya — Cocody |
| Ville / pays | Abidjan, Côte d'Ivoire |
| Fuseau | `Africa/Abidjan` |
| Niveaux | 6ème → 3ème (Collège) |
| Classes | 6ème A, 6ème B, 5ème A |
| Élèves | 12 |
| Personnel | 7 |

## Seed dev local (`SEED_DATASET=ci`)

Le seed dev utilise **`bulkCiDataset`** : même volume que `central` (1000 élèves, scénarios démo complets), avec des **noms ivoiriens** et l’école située à **Abidjan**, tout en conservant les comptes Better Auth habituels :

| Compte | Rôle |
|--------|------|
| `k.yann@school.edu` | Propriétaire (st8) |
| `c.moreau@school.edu` | Directeur (st5) |
| `m.dupont@school.edu` | Enseignante (st1) |

Mot de passe : `DevPassword1!`

```bash
cd edaya_backend && bun seed:clean --yes && bun dev
```

Pour le jeu de données Ottawa (noms occidentaux) : `SEED_DATASET=central` dans `apps/api/.env`.

Le petit dataset `demoCiDataset` reste disponible pour les tests ciblés (`sch-edaya-ci-cocody`, comptes `@ecole-ci.edaya.dev`).
