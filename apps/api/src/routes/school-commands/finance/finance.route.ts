import type { CommandRoutePair } from "../types";
import { createFeeHandler, createFeeRoute } from "./create-fee.route";
import { assignFeeToStudentHandler, assignFeeToStudentRoute } from "./assign-fee-to-student.route";
import { recordPaymentHandler, recordPaymentRoute } from "./record-payment.route";
import { reversePaymentHandler, reversePaymentRoute } from "./reverse-payment.route";
import { cancelPaymentHandler, cancelPaymentRoute } from "./cancel-payment.route";
import { adjustStudentFeeHandler, adjustStudentFeeRoute } from "./adjust-student-fee.route";
import { cancelStudentFeeHandler, cancelStudentFeeRoute } from "./cancel-student-fee.route";

export const financeCommandRoutePairs: CommandRoutePair[] = [
  { route: createFeeRoute, handler: createFeeHandler },
  { route: assignFeeToStudentRoute, handler: assignFeeToStudentHandler },
  { route: recordPaymentRoute, handler: recordPaymentHandler },
  { route: reversePaymentRoute, handler: reversePaymentHandler },
  { route: cancelPaymentRoute, handler: cancelPaymentHandler },
  { route: adjustStudentFeeRoute, handler: adjustStudentFeeHandler },
  { route: cancelStudentFeeRoute, handler: cancelStudentFeeHandler },
];
