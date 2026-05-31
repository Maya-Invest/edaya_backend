import type { CommandRoutePair } from "./types";
import { academicsCommandRoutePairs } from "./academics/academics.route";
import { assessmentsCommandRoutePairs } from "./assessments/assessments.route";
import { behaviorCommandRoutePairs } from "./behavior/behavior.route";
import { communicationsCommandRoutePairs } from "./communications/communications.route";
import { financeCommandRoutePairs } from "./finance/finance.route";
import { schedulingCommandRoutePairs } from "./scheduling/scheduling.route";
import { setupCommandRoutePairs } from "./setup/setup.route";
import { studentsCommandRoutePairs } from "./students/students.route";

export const actionCommandRoutePairs: CommandRoutePair[] = [
  ...setupCommandRoutePairs,
  ...studentsCommandRoutePairs,
  ...academicsCommandRoutePairs,
  ...schedulingCommandRoutePairs,
  ...assessmentsCommandRoutePairs,
  ...behaviorCommandRoutePairs,
  ...financeCommandRoutePairs,
  ...communicationsCommandRoutePairs,
];
