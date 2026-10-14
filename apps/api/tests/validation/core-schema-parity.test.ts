import { describe, expect, test } from "bun:test";
import { attendanceRecordCreateSchema, paymentCreateSchema, schoolCreateSchema, studentClassEnrollmentCreateSchema, studentCreateSchema } from "@edaya/core";
import {
  enrollStudentCommandSchema,
  recordAttendanceCommandSchema,
  recordPaymentCommandSchema,
  registerSchoolCommandSchema,
  updateSchoolConfigurationCommandSchema,
  registerStudentCommandSchema,
} from "@/lib/school-api/schemas/commands";

interface AnySchema {
  innerType?: () => AnySchema;
  shape?: Record<string, AnySchema>;
  _def?: { typeName?: string };
}

function unwrapObjectSchema(schema: AnySchema): AnySchema | null {
  if (schema._def?.typeName === "ZodEffects" && schema.innerType) {
    return unwrapObjectSchema(schema.innerType());
  }
  if (schema._def?.typeName === "ZodObject") {
    return schema;
  }
  return null;
}

function isOptionalField(schema: AnySchema): boolean {
  const typeName = schema._def?.typeName;
  if (typeName === "ZodOptional" || typeName === "ZodDefault") {
    return true;
  }
  if (typeName === "ZodEffects" && schema.innerType) {
    return isOptionalField(schema.innerType());
  }
  return false;
}

function requiredKeys(schema: AnySchema): Set<string> {
  const objectSchema = unwrapObjectSchema(schema);
  if (!objectSchema?.shape) {
    return new Set();
  }
  const keys = new Set<string>();
  for (const [key, fieldSchema] of Object.entries(objectSchema.shape)) {
    if (!isOptionalField(fieldSchema)) {
      keys.add(key);
    }
  }
  return keys;
}

function shapeKeys(schema: AnySchema): Set<string> {
  const objectSchema = unwrapObjectSchema(schema);
  if (!objectSchema?.shape) {
    return new Set();
  }
  return new Set(Object.keys(objectSchema.shape));
}

function assertCommandCoversCoreCreate(
  commandSchema: AnySchema,
  coreCreateSchema: AnySchema,
  options?: { allowedOmissions?: readonly string[] },
) {
  const commandShape = shapeKeys(commandSchema);
  const allowed = new Set(options?.allowedOmissions ?? []);
  for (const key of requiredKeys(coreCreateSchema)) {
    if (allowed.has(key)) {
      continue;
    }
    expect(commandShape.has(key)).toBe(true);
  }
}

describe("API command schemas cover core create required fields", () => {
  test("registerSchoolCommand", () => {
    assertCommandCoversCoreCreate(registerSchoolCommandSchema, schoolCreateSchema);
  });

  test("registerStudentCommand", () => {
    assertCommandCoversCoreCreate(registerStudentCommandSchema, studentCreateSchema);
  });

  test("enrollStudentCommand", () => {
    assertCommandCoversCoreCreate(enrollStudentCommandSchema, studentClassEnrollmentCreateSchema, {
      // Assigned by enrollment workflow from class group / existing enrollments.
      allowedOmissions: ["academicYearId", "enrollmentIndex", "enrolledAt"],
    });
  });

  test("recordAttendanceCommand", () => {
    assertCommandCoversCoreCreate(recordAttendanceCommandSchema, attendanceRecordCreateSchema, {
      // Set by route/service from session context.
      allowedOmissions: ["date"],
    });
  });

  test("recordPaymentCommand", () => {
    assertCommandCoversCoreCreate(recordPaymentCommandSchema, paymentCreateSchema, {
      // School/account identity, currency, and audit fields come from actor context or account resolution.
      allowedOmissions: ["schoolId", "accountId", "academicYearId", "kind", "currency", "status", "recordedById", "reversedAt", "reversedById", "reversesPaymentId", "reversedByPaymentId"],
    });
  });
});


test("school section patches do not inject defaults or erase other sections", () => {
  const input = { schoolId: "school", name: "New school name", shortName: "Saved" };
  expect(updateSchoolConfigurationCommandSchema.parse(input)).toEqual(input);
  expect(updateSchoolConfigurationCommandSchema.parse({ schoolId: "school", phone: null })).toEqual({ schoolId: "school", phone: null });
  expect(updateSchoolConfigurationCommandSchema.safeParse({ schoolId: "school", shortName: "   " }).success).toBe(false);
});
