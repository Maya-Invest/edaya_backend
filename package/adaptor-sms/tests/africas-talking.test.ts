import { expect, spyOn, test } from "bun:test";
import { createAfricasTalkingSms, createLogSmsProvider } from "../src";

const options = { username: "sandbox", apiKey: "private-test-key", senderId: "EDAYA", sandbox: true };
const message = { to: "+2250712345678", body: "Your code is 123456", attemptId: "attempt" };
const payload = (statusCode: number, extra = {}) => ({ SMSMessageData: { Recipients: [{ number: message.to, statusCode, messageId: "id", ...extra }] } });

test("sandbox/live endpoint, authentication and form encoding", async () => {
  for (const sandbox of [true, false]) {
    let captured: Request | undefined;
    const provider = createAfricasTalkingSms({ ...options, sandbox }, async (url, init) => {
      captured = new Request(url, init);
      expect(init.signal).toBeDefined();
      return Response.json(payload(101));
    });
    expect(await provider.send(message)).toEqual({ status: "accepted", messageId: "id" });
    expect(captured!.url).toBe(`https://${sandbox ? "api.sandbox" : "api"}.africastalking.com/version1/messaging`);
    expect(captured!.headers.get("apiKey")).toBe(options.apiKey);
    expect(Object.fromEntries(new URLSearchParams(await captured!.text()))).toEqual({ username: "sandbox", to: message.to, from: "EDAYA", message: message.body });
  }
});

test("100, 101 and 102 are accepted only with exact recipient and a message ID", async () => {
  for (const code of [100, 101, 102]) {
    expect(await createAfricasTalkingSms(options, async () => Response.json(payload(code))).send(message)).toMatchObject({ status: "accepted" });
    for (const extra of [{ messageId: "" }, { messageId: null }, { number: "+2250111111111" }]) {
      expect(await createAfricasTalkingSms(options, async () => Response.json(payload(code, extra))).send(message)).toEqual({ status: "uncertain" });
    }
  }
});

test("known rejections are terminal; risk holds, server errors and unknown codes are uncertain", async () => {
  for (const code of [402, 403, 404, 405, 406, 407, 502]) {
    expect(await createAfricasTalkingSms(options, async () => Response.json(payload(code))).send(message)).toEqual({ status: "rejected", reason: `SMS_AT_REJECTED_${code}`, retryable: false });
  }
  for (const code of [401, 500, 501, 999]) {
    expect(await createAfricasTalkingSms(options, async () => Response.json(payload(code))).send(message)).toEqual({ status: "uncertain" });
  }
});

test("malformed responses and transport failures never leak details or retry", async () => {
  for (const response of [() => new Response("not json"), () => Response.json({}), () => Response.json(payload(101), { status: 503 }), () => {
    throw new Error("private provider payload");
  }]) {
    let calls = 0;
    const provider = createAfricasTalkingSms(options, async () => {
      calls++;
      return response();
    });
    expect(await provider.send(message)).toEqual({ status: "uncertain" });
    expect(calls).toBe(1);
  }
});

test("log adapter omits message body and destination", async () => {
  const logs: unknown[] = [];
  await createLogSmsProvider((...args) => logs.push(args)).send(message);
  expect(JSON.stringify(logs)).not.toContain(message.body);
  expect(JSON.stringify(logs)).not.toContain(message.to);
});

test("the ten-second timeout becomes uncertain without another send", async () => {
  const timeout = spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    expect(milliseconds).toBe(10000);
    return AbortSignal.abort(new DOMException("Timed out", "TimeoutError"));
  });
  let calls = 0;
  try {
    const provider = createAfricasTalkingSms(options, async (_url, init) => {
      calls++;
      init.signal!.throwIfAborted();
      throw new Error("Expected timeout");
    });
    expect(await provider.send(message)).toEqual({ status: "uncertain" });
    expect(calls).toBe(1);
  }
  finally {
    timeout.mockRestore();
  }
});
