import type { Novu } from "@novu/api";
import type { SubscriberResponseDto } from "@novu/api/models/components";
import { isNovuSubscriberNotFoundError } from "@edaya/adaptor-novu";

export const TRANSIENT_INVITATION_SUBSCRIBER_PREFIX = "invite:";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_DELETE_CONCURRENCY = 5;

export interface NovuSubscriberSnapshot {
  subscriberId: string;
  email?: string | null;
  deleted: boolean;
}

export interface ListAllNovuSubscribersOptions {
  pageSize?: number;
  maxPages?: number;
}

export interface SubscriberCleanupSelector {
  all?: boolean;
  prefix?: string;
  ids?: readonly string[];
  transientInvites?: boolean;
}

export interface DeleteNovuSubscribersResult {
  deleted: number;
  skipped: number;
  failed: number;
  errors: Array<{ subscriberId: string; message: string }>;
}

export function toNovuSubscriberSnapshot(
  subscriber: SubscriberResponseDto,
): NovuSubscriberSnapshot {
  return {
    subscriberId: subscriber.subscriberId,
    email: subscriber.email,
    deleted: subscriber.deleted,
  };
}

export function matchesSubscriberCleanupSelector(
  subscriber: NovuSubscriberSnapshot,
  selector: SubscriberCleanupSelector,
): boolean {
  if (subscriber.deleted) {
    return false;
  }

  if (selector.ids?.length) {
    return selector.ids.includes(subscriber.subscriberId);
  }

  if (selector.transientInvites) {
    return subscriber.subscriberId.startsWith(TRANSIENT_INVITATION_SUBSCRIBER_PREFIX);
  }

  if (selector.prefix) {
    return subscriber.subscriberId.startsWith(selector.prefix);
  }

  return Boolean(selector.all);
}

export function selectNovuSubscribersForCleanup(
  subscribers: readonly NovuSubscriberSnapshot[],
  selector: SubscriberCleanupSelector,
): NovuSubscriberSnapshot[] {
  return subscribers.filter(subscriber => matchesSubscriberCleanupSelector(subscriber, selector));
}

export async function listAllNovuSubscribers(
  novu: Novu,
  options: ListAllNovuSubscribersOptions = {},
): Promise<NovuSubscriberSnapshot[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const subscribers: NovuSubscriberSnapshot[] = [];
  let after: string | undefined;
  let page = 0;

  while (page < maxPages) {
    const response = await novu.subscribers.search({
      limit: pageSize,
      ...(after ? { after } : {}),
    });

    const batch = response.result.data.map(toNovuSubscriberSnapshot);
    subscribers.push(...batch);

    const next = response.result.next;
    if (!next || batch.length === 0) {
      break;
    }

    after = next;
    page += 1;
  }

  return subscribers;
}

export async function deleteNovuSubscribers(
  novu: Novu,
  subscriberIds: readonly string[],
  options: { concurrency?: number } = {},
): Promise<DeleteNovuSubscribersResult> {
  const concurrency = options.concurrency ?? DEFAULT_DELETE_CONCURRENCY;
  const result: DeleteNovuSubscribersResult = {
    deleted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (let index = 0; index < subscriberIds.length; index += concurrency) {
    const chunk = subscriberIds.slice(index, index + concurrency);
    await Promise.all(chunk.map(async (subscriberId) => {
      try {
        await novu.subscribers.delete(subscriberId);
        result.deleted += 1;
      }
      catch (error) {
        if (isNovuSubscriberNotFoundError(error)) {
          result.skipped += 1;
          return;
        }
        result.failed += 1;
        result.errors.push({
          subscriberId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }));
  }

  return result;
}

export function hasSubscriberCleanupSelector(selector: SubscriberCleanupSelector): boolean {
  return Boolean(
    selector.all
    || selector.prefix
    || selector.transientInvites
    || (selector.ids?.length ?? 0) > 0,
  );
}
