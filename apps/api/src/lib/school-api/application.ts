import type { ActorMetadata, SchoolRepositories, SchoolService } from "@edaya/core";
import { SchoolApplication as CoreSchoolApplication } from "@edaya/core";

type CoreSchoolApplicationArgs = ConstructorParameters<typeof CoreSchoolApplication>[0];

export class ApiSchoolApplication {
  private readonly application: CoreSchoolApplication;

  constructor(args: CoreSchoolApplicationArgs) {
    this.application = new CoreSchoolApplication(args);
  }

  get repositories(): SchoolRepositories {
    return this.application.repositories;
  }

  forActor(actor: ActorMetadata): SchoolService {
    return this.application.forActor(actor);
  }

  hasAuthAccountForEmail(email: string): Promise<boolean> {
    return this.application.hasAuthAccountForEmail(email);
  }
}
