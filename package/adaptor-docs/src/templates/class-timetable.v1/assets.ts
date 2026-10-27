/// <reference path="../../text-modules.d.ts" />
import type { TemplateAssets, TemplateManifest } from "../load-assets";
import manifestJson from "./manifest.json";
import schemaJson from "./schema.json";
import styles from "./styles.css" with { type: "text" };
import templateSpec from "./template.precompiled.js";

export const CLASS_TIMETABLE_V1_ASSETS: TemplateAssets = {
  manifest: manifestJson as TemplateManifest,
  schema: schemaJson as object,
  templateSpec,
  styles,
};
