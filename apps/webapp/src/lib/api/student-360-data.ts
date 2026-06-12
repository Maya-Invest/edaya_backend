import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { ChronicCondition, HealthRecord, PedagogicalNote } from '$lib/types/school';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

type StudentHealthProfileRaw = components['schemas']['StudentHealthProfile'];
type StudentNoteRaw = components['schemas']['StudentNote'];

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

function splitHealthList(value?: string | null | string[]): string[] {
	if (!value || value === 'Aucune') {
		return [];
	}
	if (Array.isArray(value)) {
		return value.map(entry => entry.trim()).filter(Boolean);
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
		records[profile.studentId] = {
			studentId: profile.studentId,
			bloodType: profile.bloodType ?? '—',
			allergies: splitHealthList(profile.allergies),
			medications: splitHealthList(profile.medications),
			chronicConditions: mapChronicConditions(splitHealthList(profile.medicalConditions)),
			lastVisit: formatDate(profile.lastVisit),
			notes: profile.clinicalNotes ?? '',
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

export async function loadStudent360Data(client: SchoolClient): Promise<{
	healthRecords: Record<string, HealthRecord>;
	pedagogicalNotes: PedagogicalNote[];
}> {
	const [profilesRaw, notesRaw] = await Promise.all([
		client.entities.studentHealthProfiles.list({}),
		client.entities.studentNotes.list({}),
	]);

	return {
		healthRecords: mapHealthProfiles(profilesRaw ?? []),
		pedagogicalNotes: mapPedagogicalNotes(notesRaw ?? []),
	};
}
