import { expect, test } from "bun:test";
import { renderGraphiQLPage } from "@/lib/graphql/graphiql";

test("GraphiQL uses explicit Authorization and links to supported web login", () => {
  const html = renderGraphiQLPage({ webappOrigin: "https://app.edayaplus.com" });
  expect(html).toContain("Authorization: Bearer");
  expect(html).toContain("https://app.edayaplus.com");
  expect(html).not.toContain("graphiql-password");
  expect(html).not.toContain("/graphiql/login");
  expect(html).not.toContain("/auth/sign-in/email");
});
