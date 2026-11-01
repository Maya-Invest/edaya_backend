import { resolveOnboardingDataset } from "@edaya/fixtures/onboarding";
import { describe, expect, it } from "bun:test";
import { createAppRequest, createCoreRouteTestApp } from "../support/core-route-harness";

describe("onboarding dataset reads", () => {
  it("lists country defaults without substituting unsupported countries", async () => {
    const { app } = await createCoreRouteTestApp();
    for (const country of ["CI", "Côte d'Ivoire", "Côte d’Ivoire"]) {
      const response = await app.request(createAppRequest(`/core/onboarding/datasets?country=${encodeURIComponent(country)}`));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ datasets: [{ id: "ci-general-secondary", version: "1.0.0", countryCode: "CI", isDefault: true }] });
    }
    for (const country of ["FR", "Canada", "unknown", ""]) {
      const response = await app.request(createAppRequest(`/core/onboarding/datasets?country=${encodeURIComponent(country)}`));
      expect(response.status).toBe(200);
      expect(await response.json() as Record<string, unknown>).toEqual({ datasets: [] });
    }
  });
  it("returns the exact canonical version and rejects unknown versions", async () => {
    const { app } = await createCoreRouteTestApp();
    const response = await app.request(createAppRequest("/core/onboarding/datasets/ci-general-secondary/1.0.0"));
    expect(response.status).toBe(200);
    expect(await response.json() as Record<string, unknown>).toEqual(resolveOnboardingDataset("ci-general-secondary", "1.0.0"));
    const missing = await app.request(createAppRequest("/core/onboarding/datasets/ci-general-secondary/2.0.0"));
    expect(missing.status).toBe(409);
    expect(await missing.text()).toContain("UNKNOWN_ONBOARDING_DATASET");
  });
  it("keeps the legacy template response available", async () => {
    const { app } = await createCoreRouteTestApp();
    const response = await app.request(createAppRequest("/core/onboarding/structure-templates?country=CI"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ countryCode: "CI", templates: [{ id: "ci-college" }, { id: "ci-lycee" }] });
  });
});
