import type { components } from '$lib/api/schema';
import type { ChronicCondition, HealthRecord, PedagogicalNote } from '$lib/data/school';
import { getSchoolClient } from '$lib/server/school-client';

type StudentHealthProfileRaw = components['schemas']['StudentHealthProfile'];
type StudentNoteRaw = components['schemas']['StudentNote'];

const HEALTH_UI_META: Record<string, Pick<HealthRecord, 'lastVisit' | 'notes' | 'medications'>> = {
	s1: { lastVisit: '2026-02-14', notes: 'Mild seasonal allergies.', medications: [] },
	s3: { lastVisit: '2026-04-08', notes: 'Severe peanut allergy. EpiPen in nurse\'s office.', medications: ['EpiPen'] },
	s5: { lastVisit: '2025-11-22', notes: 'No known issues.', medications: [] },
};

const NOTE_CATEGORIES = ['Comportement', 'Travail', 'Progression', 'Encouragement'] as const;

function formatDate(value: unknown): string {
	if (!value) {
		return '';
	}
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'string') {
		return value.slice(0, 10);
	}
	return String(value).slice(0, 10);
}

function splitHealthList(value?: string | null): string[] {
	if (!value || value === 'Aucune') {
		return [];
	}
	return value.split(',').map(entry => entry.trim()).filter(Boolean);
}

function mapChronicConditions(values: string[]): ChronicCondition[] {
	const allowed = new Set<ChronicCondition>(['Asthme', 'Epilepsie', 'Diabete']);
	return values.filter((value): value is ChronicCondition => allowed.has(value as ChronicCondition));
}

function mapNoteCategory(title?: string | null): PedagogicalNote['category'] {
	if (title && NOTE_CATEGORIES.includes(title as PedagogicalNote['category'])) {
		return title as PedagogicalNote['category'];
	}
	return 'Travail';
}

export function mapHealthProfiles(profilesRaw: StudentHealthProfileRaw[]): Record<string, HealthRecord> {
	const records: Record<string, HealthRecord> = {};

	for (const profile of profilesRaw) {
		const meta = HEALTH_UI_META[profile.studentId] ?? { lastVisit: '', notes: '', medications: [] };

		records[profile.studentId] = {
			studentId: profile.studentId,
			bloodType: profile.bloodType ?? '—',
			allergies: splitHealthList(profile.allergies),
			medications: meta.medications,
			chronicConditions: mapChronicConditions(splitHealthList(profile.medicalConditions)),
			lastVisit: meta.lastVisit,
			notes: meta.notes,
		};
	}

	return records;
}

export function mapPedagogicalNotes(notesRaw: StudentNoteRaw[]): PedagogicalNote[] {
	return notesRaw
		.map(note => ({
			id: note.id,
			studentId: note.studentId,
			date: formatDate(note.createdAt),
			authorId: note.authorStaffId,
			category: mapNoteCategory(note.title),
			content: note.body,
		}))
		.sort((left, right) => right.date.localeCompare(left.date));
}

export async function loadStudent360Data(): Promise<{
	healthRecords: Record<string, HealthRecord>;
	pedagogicalNotes: PedagogicalNote[];
}> {
	const client = getSchoolClient();
	const [profilesRaw, notesRaw] = await Promise.all([
		client.entities.studentHealthProfiles.list({}),
		client.entities.studentNotes.list({}),
	]);

	return {
		healthRecords: mapHealthProfiles(profilesRaw ?? []),
		pedagogicalNotes: mapPedagogicalNotes(notesRaw ?? []),
	};
}
