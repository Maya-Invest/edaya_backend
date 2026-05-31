import { createRouter } from "@/lib/create-app";
import { DisciplinaryAction, GradeLevel, PeriodDefinition, Resource, Subject, SubjectMatter } from "@edaya/core";
import * as HttpStatusCodes from "stoker/http-status-codes";

const commandsRouter = createRouter()
  .post("/:entity", async (c) => {
    const entityName = c.req.param("entity");
    const actor = c.get("actor");
    if (!actor) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }
    const headlessApp = c.get("schoolApp").forActor(actor);
    const config = headlessApp.config;

    if (!(entityName in config)) {
      return c.json({ message: `Entity ${entityName} is not write-supported` }, HttpStatusCodes.BAD_REQUEST);
    }

    const body = await c.req.json();
    const service = (config as any)[entityName];

    let entityInstance: any;
    const args = { ...body, schoolId: actor.schoolId };

    // Instantiate correct domain entity constructor to guarantee validation
    switch (entityName) {
      case "gradeLevels":
        entityInstance = new GradeLevel(args);
        break;
      case "periodDefinitions":
        entityInstance = new PeriodDefinition(args);
        break;
      case "resources":
        entityInstance = new Resource(args);
        break;
      case "subjects":
        entityInstance = new Subject(args);
        break;
      case "subjectMatters":
        entityInstance = new SubjectMatter(args);
        break;
      case "disciplinaryActions":
        entityInstance = new DisciplinaryAction(args);
        break;
      default:
        return c.json({ message: `Entity ${entityName} is not instantiable` }, HttpStatusCodes.BAD_REQUEST);
    }

    try {
      await service.save(entityInstance);
      return c.json(entityInstance, HttpStatusCodes.CREATED);
    }
    catch (err: any) {
      if (err.name === "AuthorizationError") {
        return c.json({ message: err.message, code: err.code }, HttpStatusCodes.FORBIDDEN);
      }
      return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  })
  .delete("/:entity/:id", async (c) => {
    const entityName = c.req.param("entity");
    const id = c.req.param("id");
    const actor = c.get("actor");
    if (!actor) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }
    const headlessApp = c.get("schoolApp").forActor(actor);
    const config = headlessApp.config;

    if (!(entityName in config)) {
      return c.json({ message: `Entity ${entityName} is not delete-supported` }, HttpStatusCodes.BAD_REQUEST);
    }

    const service = (config as any)[entityName];

    try {
      await service.delete(id);
      return c.json({ message: `${entityName} with ID ${id} deleted` }, HttpStatusCodes.OK);
    }
    catch (err: any) {
      if (err.name === "AuthorizationError") {
        return c.json({ message: err.message, code: err.code }, HttpStatusCodes.FORBIDDEN);
      }
      return c.json({ message: err.message }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

export default commandsRouter;
