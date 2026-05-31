import type { CommandRoutePair } from "../types";
import { createAnnouncementHandler, createAnnouncementRoute } from "./create-announcement.route";
import { addTargetHandler, addTargetRoute } from "./add-target.route";
import { publishAnnouncementHandler, publishAnnouncementRoute } from "./publish-announcement.route";
import { recordDeliveryHandler, recordDeliveryRoute } from "./record-delivery.route";
import { materializeDeliveriesHandler, materializeDeliveriesRoute } from "./materialize-deliveries.route";

export const communicationsCommandRoutePairs: CommandRoutePair[] = [
  { route: createAnnouncementRoute, handler: createAnnouncementHandler },
  { route: addTargetRoute, handler: addTargetHandler },
  { route: publishAnnouncementRoute, handler: publishAnnouncementHandler },
  { route: recordDeliveryRoute, handler: recordDeliveryHandler },
  { route: materializeDeliveriesRoute, handler: materializeDeliveriesHandler },
];
