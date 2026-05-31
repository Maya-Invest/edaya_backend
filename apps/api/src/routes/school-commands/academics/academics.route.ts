import type { CommandRoutePair } from "../types";
import { offerSubjectToClassHandler, offerSubjectToClassRoute } from "./offer-subject-to-class.route";
import { assignMatterToClassSubjectHandler, assignMatterToClassSubjectRoute } from "./assign-matter-to-class-subject.route";
import { recordSessionProgressHandler, recordSessionProgressRoute } from "./record-session-progress.route";

export const academicsCommandRoutePairs: CommandRoutePair[] = [
  { route: offerSubjectToClassRoute, handler: offerSubjectToClassHandler },
  { route: assignMatterToClassSubjectRoute, handler: assignMatterToClassSubjectHandler },
  { route: recordSessionProgressRoute, handler: recordSessionProgressHandler },
];
