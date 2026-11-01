import type { SmsProviderPort, SmsRoute, SmsRouterPort } from "@edaya/core";

export function createSmsRouter(routes: readonly SmsRoute[], providers: Readonly<Record<string, SmsProviderPort>>): SmsRouterPort {
  const seen = new Set<string>();
  const registry = new Map(Object.entries(providers));
  const ordered = routes.map((route) => {
    if (!/^\+[1-9]\d{0,14}$/.test(route.prefix) || seen.has(route.prefix))
      throw new Error("Invalid or duplicate SMS route prefix");
    if (!registry.has(route.provider))
      throw new Error("SMS route references an unregistered provider");
    seen.add(route.prefix);
    return Object.freeze({ ...route });
  }).sort((a, b) => b.prefix.length - a.prefix.length);
  const select = (to: string): Readonly<SmsRoute> | undefined => /^\+[1-9]\d{1,14}$/.test(to) ? ordered.find(route => to.startsWith(route.prefix)) : undefined;
  return {
    routes: Object.freeze(ordered),
    supports: destination => !!select(destination),
    async send(message) {
      const route = select(message.to);
      if (!route)
        return { status: "rejected", reason: "SMS_DESTINATION_UNSUPPORTED", retryable: false };
      try {
        const result = await registry.get(route.provider)!.send(message);
        if (result.status === "accepted" && !result.messageId?.trim())
          return { status: "uncertain", providerId: route.provider };
        return { ...result, providerId: route.provider };
      }
      catch {
        return { status: "uncertain", providerId: route.provider };
      }
    },
  };
}
