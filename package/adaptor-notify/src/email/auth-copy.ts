function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function formatOtpEmail(input: {
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}): { subject: string; body: string } {
  const code = escapeHtml(input.otp);
  switch (input.type) {
    case "sign-in":
      return {
        subject: "Your EDAYA sign-in code",
        body: `<p>Use this code to sign in to EDAYA:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p><p>This code expires shortly. If you did not request it, you can ignore this email.</p>`,
      };
    case "email-verification":
      return {
        subject: "Verify your EDAYA email",
        body: `<p>Use this code to verify your email address:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
    case "forget-password":
      return {
        subject: "Reset your EDAYA password",
        body: `<p>Use this code to reset your password:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
    case "change-email":
      return {
        subject: "Confirm your new EDAYA email",
        body: `<p>Use this code to confirm your new email address:</p><p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
    default:
      return {
        subject: "Your EDAYA verification code",
        body: `<p><strong style="font-size:24px;letter-spacing:4px;">${code}</strong></p>`,
      };
  }
}

export function formatVerificationLinkEmail(input: { url: string; displayName?: string }): { subject: string; body: string } {
  const safeUrl = escapeHtml(input.url);
  const greeting = input.displayName?.trim()
    ? `<p>Hello ${escapeHtml(input.displayName.trim())},</p>`
    : "";
  return {
    subject: "Verify your EDAYA email address",
    body: `${greeting}<p>Confirm your email address to finish creating your EDAYA account.</p><p><a href="${safeUrl}">Verify my email</a></p><p>Or copy this link into your browser:</p><p>${safeUrl}</p>`,
  };
}
