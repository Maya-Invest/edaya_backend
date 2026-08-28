export interface NovuTriggerSubscriber {
  subscriberId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export function splitDisplayName(displayName: string | undefined): {
  firstName?: string;
  lastName?: string;
} {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/** Inline subscriber fields so Novu can deliver email even when context-scoped profiles lack credentials. */
export function buildNovuTriggerSubscriber(input: {
  subscriberId: string;
  email?: string;
  phone?: string;
  displayName?: string;
}): NovuTriggerSubscriber {
  return {
    subscriberId: input.subscriberId,
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    ...splitDisplayName(input.displayName),
  };
}
