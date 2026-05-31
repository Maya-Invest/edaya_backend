import { field, namedObjectSchema } from "./utils/schema-fields";

export const countResponseSchema = namedObjectSchema("CountResponse", {
  count: field.number().int().nonnegative(),
});

export const schoolIdBodySchema = namedObjectSchema("SchoolIdBody", {
  schoolId: field.uuid(),
});

export const commandIdParamSchema = namedObjectSchema("CommandIdParam", {
  id: field.id().openapi({ description: "Entity identifier" }),
});

export function entityIdParamSchema(displayName: string) {
  return namedObjectSchema(`${displayName.replaceAll(" ", "")}IdParam`, {
    id: field.id().openapi({ description: `The unique identifier of the ${displayName}` }),
  });
}
