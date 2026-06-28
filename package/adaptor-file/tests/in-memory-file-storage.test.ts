import { describe, expect, it } from "bun:test";
import { createInMemoryFileStorage } from "../src/in-memory-file-storage";

describe("createInMemoryFileStorage", () => {
  it("stores and heads objects", async () => {
    const storage = createInMemoryFileStorage();
    await storage.putObject({
      key: "school/uploads/student/student-1/att-1/file.pdf",
      body: new Uint8Array([1, 2, 3]),
      contentType: "application/pdf",
    });

    const head = await storage.headObject("school/uploads/student/student-1/att-1/file.pdf");
    expect(head?.sizeBytes).toBe(3);
    expect(head?.contentType).toBe("application/pdf");
  });
});
