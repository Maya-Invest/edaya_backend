import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { authDependency } from "@/http/dependencies/auth";
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

describe("auth dependency", () => {
  afterEach(() => {
    mock.restore();
  });

  it("loads auth from the resolved API runtime", async () => {
    const auth = { api: { getSession: async () => null } };
    spyOn(resolveApiRuntimeModule, "resolveApiRuntime").mockResolvedValue({
      getAuth: () => auth,
    } as never);

    const { context, values } = createDependencyContext("/core/entities/students/list");
    await authDependency.resolve(context);

    expect(values.get("auth")).toBe(auth);
  });
});

describe("schoolApp dependency", () => {
  afterEach(() => {
    mock.restore();
  });

  it("skips school application resolution on Better Auth routes", async () => {
    const resolveApiRuntime = spyOn(resolveApiRuntimeModule, "resolveApiRuntime");

    const { context, values } = createDependencyContext("/auth/sign-in/email");
    await schoolAppDependency.resolve(context);

    expect(resolveApiRuntime).not.toHaveBeenCalled();
    expect(values.get("schoolApp")).toBeUndefined();
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
