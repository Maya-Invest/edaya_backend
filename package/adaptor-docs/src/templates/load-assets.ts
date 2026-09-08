import type { RenderFormat } from "../types";

export interface TemplateManifest {
  readonly key: string;
  readonly formats: readonly RenderFormat[];
  readonly locales: readonly string[];
  readonly version: string;
  readonly title: {
    readonly fr: string;
    readonly en: string;
  };
}

export interface TemplateAssets {
  readonly manifest: TemplateManifest;
  readonly schema: object;
  /** Handlebars precompiled template spec (Worker-safe; no runtime compile/eval). */
  readonly templateSpec: object;
  readonly styles: string;
}
