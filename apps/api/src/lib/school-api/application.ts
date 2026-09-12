import type { AtomicExecutionPort, FileStoragePort } from "@edaya/core";
import type { SchoolRepositories, SchoolService } from "@edaya/service";
import type { ActorMetadata } from "@edaya/authorization";
import { SchoolApplication as CoreSchoolApplication } from "@edaya/service";

type CoreSchoolApplicationArgs = ConstructorParameters<typeof CoreSchoolApplication>[0];

export class ApiSchoolApplication {
  private readonly application: CoreSchoolApplication;

  constructor(args: CoreSchoolApplicationArgs) {
    this.application = new CoreSchoolApplication(args);
  }

  get repositories(): SchoolRepositories {
    return this.application.repositories;
  }

  get atomicExecution(): AtomicExecutionPort {
    return this.application.atomicExecution;
  }

  get fileStorage(): FileStoragePort {
    return this.application.fileStorage;
  }

  forActor(actor: ActorMetadata): SchoolService {
    return this.application.forActor(actor);
  }

  hasAuthAccountForEmail(email: string): Promise<boolean> {
    return this.application.hasAuthAccountForEmail(email);
  }

  hasAuthAccountForPhone(phone: string): Promise<boolean> {
    return this.application.hasAuthAccountForPhone(phone);
  }
}
