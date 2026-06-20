import { assertCommandActorKind } from "@edaya/core";
import { dispatchCoreCommand, serializeCommandResult } from "@/lib/school-api/dispatch/commands";
import type { CoreCommandConfig } from "@/lib/school-api/registry";
import { requireActor, wrapResolver } from "@/lib/graphql/resolver-utils";

export function createCommandMutationResolver(commandConfig: CoreCommandConfig) {
  return wrapResolver(async (context, args: { input: unknown }) => {
    const actor = requireActor(context);
    assertCommandActorKind(actor, { serviceOnly: commandConfig.serviceOnly });

    const service = context.get("schoolApp").forActor(actor);
    const result = await dispatchCoreCommand(service, commandConfig.methodName, args.input);

    if (result === undefined || result === null) {
      return { message: `${commandConfig.publicName} completed` };
    }

    return serializeCommandResult(result);
  });
}
