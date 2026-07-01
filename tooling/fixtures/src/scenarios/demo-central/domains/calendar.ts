import { seedUpcomingDate } from '../../../meta/dates'

export type SeedCalendarEventScope = 'all' | readonly string[]

export interface SeedCalendarEvent {
  id: string
  title: string
  startDate: string
  endDate: string
  mockType: 'holiday' | 'vacation' | 'closure' | 'ceremony'
  description: string
  scope: SeedCalendarEventScope
}

/** Trimestre 1 and 2 school-year events. */
export const SEED_CALENDAR_EVENTS_EARLIER_TERMS: readonly SeedCalendarEvent[] = [
  { id: 'yc-t1-start', title: 'Rentrée scolaire', startDate: '2025-09-01', endDate: '2025-09-01', mockType: 'ceremony', description: 'Accueil des élèves et présentation de l\'équipe pédagogique.', scope: 'all' },
  { id: 'yc-t1-toussaint', title: 'Vacances de la Toussaint', startDate: '2025-10-18', endDate: '2025-11-03', mockType: 'vacation', description: 'Vacances scolaires d\'automne.', scope: 'all' },
  { id: 'yc-t1-noel', title: 'Vacances de Noël', startDate: '2025-12-20', endDate: '2026-01-04', mockType: 'vacation', description: 'Vacances scolaires de fin d\'année.', scope: 'all' },
  { id: 'yc-t1-conseil', title: 'Conseils de classe T1', startDate: '2025-12-15', endDate: '2025-12-17', mockType: 'closure', description: 'Conseils de classe du premier trimestre.', scope: 'all' },
  { id: 'yc-t2-start', title: 'Rentrée — Trimestre 2', startDate: '2026-01-05', endDate: '2026-01-05', mockType: 'ceremony', description: 'Reprise des cours après les vacances de Noël.', scope: 'all' },
  { id: 'yc-t2-sport', title: 'Journée olympique', startDate: '2026-02-14', endDate: '2026-02-14', mockType: 'ceremony', description: 'Compétitions sportives inter-classes.', scope: 'all' },
  { id: 'yc-t2-winter', title: 'Vacances d\'hiver', startDate: '2026-02-21', endDate: '2026-03-08', mockType: 'vacation', description: 'Vacances scolaires d\'hiver.', scope: 'all' },
]

/** School calendar from mock `schoolYearEvents[]`. UI `type` / multi-class `scope` mapped at seed time. */
export const SEED_CALENDAR_EVENTS: readonly SeedCalendarEvent[] = [
  ...SEED_CALENDAR_EVENTS_EARLIER_TERMS,
  { id: 'yc1', title: 'Fête du Travail', startDate: '2026-05-01', endDate: '2026-05-01', mockType: 'holiday', description: 'Jour férié national. L\'école est fermée.', scope: 'all' },
  { id: 'yc2', title: 'Ascension', startDate: '2026-05-14', endDate: '2026-05-14', mockType: 'holiday', description: 'Jour férié. Pas de cours.', scope: 'all' },
  { id: 'yc3', title: 'Vacances de printemps', startDate: '2026-04-20', endDate: '2026-05-02', mockType: 'vacation', description: 'Vacances scolaires de printemps. Réouverture le 4 mai.', scope: 'all' },
  { id: 'yc4', title: 'Formation enseignants', startDate: '2026-05-20', endDate: '2026-05-20', mockType: 'closure', description: 'Journée de formation pédagogique. Arrêt de cours pour tous les élèves.', scope: 'all' },
  { id: 'yc5', title: 'Réunion parents-professeurs', startDate: '2026-05-15', endDate: '2026-05-15', mockType: 'ceremony', description: 'Réunion de fin de trimestre pour les classes de Middle School.', scope: ['6a', '6b', '5a'] },
  { id: 'yc6', title: 'Journée sportive', startDate: '2026-06-05', endDate: '2026-06-05', mockType: 'ceremony', description: 'Compétitions inter-classes et activités sportives en plein air.', scope: 'all' },
  { id: 'yc7', title: 'Lundi de Pentecôte', startDate: '2026-05-25', endDate: '2026-05-25', mockType: 'holiday', description: 'Jour férié national. L\'école est fermée.', scope: 'all' },
  { id: 'yc8', title: 'Conseil de classe', startDate: '2026-06-12', endDate: '2026-06-12', mockType: 'closure', description: 'Conseil de classe — arrêt des cours à 12h.', scope: 'all' },
  { id: 'yc9', title: 'Vacances d\'été', startDate: '2026-07-03', endDate: '2026-07-03', mockType: 'vacation', description: 'Vacances scolaires d\'été. Réouverture le 1er septembre 2026.', scope: 'all' },
  { id: 'yc10', title: 'Cérémonie de remise des prix', startDate: '2026-06-26', endDate: '2026-06-26', mockType: 'ceremony', description: 'Cérémonie de fin d\'année et remise des prix au tableau d\'honneur.', scope: 'all' },
]

/** Calendar events anchored to the narrative reference date for the dashboard upcoming panel. */
export const SEED_DASHBOARD_UPCOMING_CALENDAR_EVENTS: readonly SeedCalendarEvent[] = [
  {
    id: 'yc-up-0',
    title: 'Réunion équipe pédagogique',
    startDate: seedUpcomingDate(0),
    endDate: seedUpcomingDate(0),
    mockType: 'ceremony',
    description: 'Point d\'équipe en fin de matinée — pas de modification d\'emploi du temps.',
    scope: 'all',
  },
  {
    id: 'yc-up-2',
    title: 'Sortie scolaire — 6ème',
    startDate: seedUpcomingDate(2),
    endDate: seedUpcomingDate(2),
    mockType: 'ceremony',
    description: 'Visite du musée des sciences pour les classes de 6ème.',
    scope: ['6a', '6b'],
  },
  {
    id: 'yc-up-5',
    title: 'Examens blancs Terminale',
    startDate: seedUpcomingDate(5),
    endDate: seedUpcomingDate(5),
    mockType: 'closure',
    description: 'Épreuves blanches pour les élèves de Terminale.',
    scope: ['term-s'],
  },
]

export const SEED_ALL_CALENDAR_EVENTS: readonly SeedCalendarEvent[] = [
  ...SEED_CALENDAR_EVENTS,
  ...SEED_DASHBOARD_UPCOMING_CALENDAR_EVENTS,
]

export function countSeedCalendarEvents(events: readonly Pick<SeedCalendarEvent, 'scope'>[] = SEED_ALL_CALENDAR_EVENTS): number {
  return events.reduce((total, event) => {
    return total + (event.scope === 'all' ? 1 : event.scope.length)
  }, 0)
}
