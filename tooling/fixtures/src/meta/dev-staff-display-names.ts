/** Ivorian display names for seeded dev staff — emails stay on @school.edu accounts. */
export const DEV_STAFF_CI_DISPLAY_NAMES = {
  st8: 'Kouassi Yann',
  st5: 'Jean-Baptiste Aka',
  st1: 'Mme Touré',
  st2: 'M. Diomandé',
  st3: 'Mme Assi',
  st4: 'M. Gbé',
  st6: 'Mme Zongo',
  st7: 'M. Bamba',
} as const satisfies Record<string, string>

export const DEV_STAFF_CI_NAME_PARTS = {
  st8: { firstName: 'Kouassi', lastName: 'Yann' },
  st5: { firstName: 'Jean-Baptiste', lastName: 'Aka' },
  st1: { firstName: 'Mme', lastName: 'Touré' },
  st2: { firstName: 'M.', lastName: 'Diomandé' },
  st3: { firstName: 'Mme', lastName: 'Assi' },
  st4: { firstName: 'M.', lastName: 'Gbé' },
  st6: { firstName: 'Mme', lastName: 'Zongo' },
  st7: { firstName: 'M.', lastName: 'Bamba' },
} as const satisfies Record<string, { firstName: string, lastName: string }>

/** Narrative guardian display names (g1–g6) aligned with demo CI population. */
export const DEV_GUARDIAN_CI_DISPLAY_NAMES = {
  g1: 'Mariam Koné',
  g2: 'Issouf Traoré',
  g3: 'Salimata Diabaté',
  g4: 'Koffi Yao',
  g5: 'Awa Coulibaly',
  g6: 'Oumar Ouattara',
} as const satisfies Record<string, string>
