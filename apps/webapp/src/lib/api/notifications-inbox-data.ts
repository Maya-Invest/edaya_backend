import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import { deliveriesForSubject } from '$lib/api/entity-list-filters';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;
type MessageDeliveryRaw = components['schemas']['MessageDelivery'];
type AnnouncementRaw = components['schemas']['Announcement'];

export interface InboxDelivery {
	id: string;
	announcementId: string;
	subjectId: string;
	status: MessageDeliveryRaw['status'];
	sentAt?: string;
	readAt?: string;
	createdAt?: string;
	announcementTitle: string;
	announcementContent: string;
	announcementPublishedAt?: string;
}

function toIso(value: unknown): string | undefined {
	if (!value) {
		return undefined;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === 'string') {
		return value;
	}
	return undefined;
}

export async function fetchInboxDeliveries(
	client: SchoolClient,
	subjectId: string,
	schoolId: string,
): Promise<InboxDelivery[]> {
	const [deliveries, announcements] = await Promise.all([
		client.entities.messageDeliveries.list(deliveriesForSubject(subjectId)),
		client.entities.announcements.list({ schoolId }),
	]);
	const announcementById = new Map(
		(announcements ?? []).map((announcement: AnnouncementRaw) => [announcement.id, announcement]),
	);
	return (deliveries ?? [])
		.map((delivery: MessageDeliveryRaw) => {
			const announcement = announcementById.get(delivery.announcementId);
			return {
				id: delivery.id,
				announcementId: delivery.announcementId,
				subjectId: delivery.subjectId,
				status: delivery.status,
				sentAt: toIso(delivery.sentAt),
				readAt: toIso(delivery.readAt),
				createdAt: toIso(delivery.createdAt),
				announcementTitle: announcement?.title ?? delivery.announcementId,
				announcementContent: announcement?.content ?? '',
				announcementPublishedAt: toIso(announcement?.publishedAt),
			};
		})
		.sort((left, right) => {
			const leftTime = Date.parse(left.sentAt ?? left.createdAt ?? '') || 0;
			const rightTime = Date.parse(right.sentAt ?? right.createdAt ?? '') || 0;
			return rightTime - leftTime;
		});
}
