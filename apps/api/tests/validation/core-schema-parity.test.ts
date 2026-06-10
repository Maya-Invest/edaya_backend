import { describe, expect, test } from "bun:test";
import {
  attendanceRecordCreateSchema,
  paymentCreateSchema,
  schoolCreateSchema,
  studentClassEnrollmentCreateSchema,
  studentCreateSchema,
} from "@edaya/core";
import {
  enrollStudentCommandSchema,
  recordAttendanceCommandSchema,
  recordPaymentCommandSchema,
  registerSchoolCommandSchema,
  registerStudentCommandSchema,
} from "@/lib/school-api/schemas/openapi/commands.schemas";

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
      // Assigned by enrollment workflow (index in year, default enrolledAt).
      allowedOmissions: ["enrollmentIndex", "enrolledAt"],
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
      // Currency/status/audit fields resolved from student fee or actor context.
      allowedOmissions: ["currency", "status", "recordedById", "reversedAt", "reversedById", "cancelledAt", "cancelledById"],
    });
  });
});
