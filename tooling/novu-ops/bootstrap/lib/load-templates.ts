import { resolve } from "node:path";

export interface BootstrapEmailTemplates {
  edayaShell: string;
}

const TEMPLATES_ROOT = resolve(import.meta.dirname, "../templates");

async function readTemplate(relativePath: string): Promise<string> {
  const path = resolve(TEMPLATES_ROOT, relativePath);
  const contents = await Bun.file(path).text();
  return contents.trim();
}

export async function loadBootstrapEmailTemplates(): Promise<BootstrapEmailTemplates> {
  const edayaShell = await readTemplate("emails/edaya-shell.html");

  return {
    edayaShell,
  };
}
