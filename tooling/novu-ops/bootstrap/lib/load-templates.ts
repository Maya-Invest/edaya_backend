import { resolve } from "node:path";

export interface BootstrapEmailTemplates {
  standardNotification: string;
  accountInvitation: string;
  accountInvitationSubject: string;
}

const TEMPLATES_ROOT = resolve(import.meta.dirname, "../templates");

async function readTemplate(relativePath: string): Promise<string> {
  const path = resolve(TEMPLATES_ROOT, relativePath);
  const contents = await Bun.file(path).text();
  return contents.trim();
}

export async function loadBootstrapEmailTemplates(): Promise<BootstrapEmailTemplates> {
  const [standardNotification, accountInvitation, accountInvitationSubject] = await Promise.all([
    readTemplate("emails/standard-notification.html"),
    readTemplate("emails/account-invitation.html"),
    readTemplate("subjects/account-invitation.txt"),
  ]);

  return {
    standardNotification,
    accountInvitation,
    accountInvitationSubject,
  };
}
