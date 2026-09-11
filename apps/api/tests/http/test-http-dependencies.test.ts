import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { identityClientDependency } from "@/http/dependencies/auth";
import { schoolAppDependency } from "@/http/dependencies/school-app";
import * as resolveApiRuntimeModule from "@/runtime/resolve-api-runtime";

function createDependencyContext(path: string) {
  const values = new Map<string, unknown>();
  const context = {
    req: { path },
    env: {},
    set(key: string, value: unknown) {
      values.set(key, value);
    },
    get(key: string) {
      return values.get(key);
    },
  };
  return { context: context as never, values };
}

describe("identity client dependency", () => {
  afterEach(() => {
    mock.restore();
  });

  it("loads the identity client from the resolved API runtime", async () => {
    const identityClient = { verifyAccessToken: async () => null };
    spyOn(resolveApiRuntimeModule, "resolveApiRuntime").mockResolvedValue({
      getIdentityClient: () => identityClient,
    } as never);

    const { context, values } = createDependencyContext("/core/entities/students/list");
    await identityClientDependency.resolve(context);

    expect(values.get("identityClient")).toBe(identityClient);
  });
});

describe("schoolApp dependency", () => {
  afterEach(() => {
    mock.restore();
  });

  it("loads the school application for core API routes", async () => {
    const schoolApp = { repositories: { schools: {} } };
    spyOn(resolveApiRuntimeModule, "resolveApiRuntime").mockResolvedValue({
      getSchoolApplication: async () => schoolApp,
    } as never);

    const { context, values } = createDependencyContext("/core/queries/school-overview");
    await schoolAppDependency.resolve(context);

    expect(values.get("schoolApp")).toBe(schoolApp);
  });
});
