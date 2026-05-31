// import { z } from "@hono/zod-openapi";

// export const ResponseBadRequest = z.object({
//   message: z.string().openapi({ examples: ["Invalid resource address"], description: "Error message describing what went wrong" }),
// });

// export const resourceAddressSChema = z.string()
//   .openapi({
//     example: "resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf",
//   });

// export const resourceAddressListSchema = z.string()
//   .transform((val) => {
//     return val.split(",").filter(address => address.trim() !== "");
//   })
//   .openapi({
//     example: "resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf,resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw",
//     description: "Comma-separated list of resource addresses",
//   });

// export const cdpIdSchema = z.string()
//   .openapi({
//     example: "#1#",
//   });

// export const cdpIdListSchema = z
//   .preprocess((val) => {
//     if (Array.isArray(val))
//       return val;
//     if (typeof val === "string")
//       return [val];
//     return val;
//   }, z.array(z.string()))
//   .openapi({
//     example: ["#1#"],
//   });

// export const cdpIdRangeListSchema = z
//   .string()
//   .refine((val) => {
//     return val.split(",").every((part) => {
//       part = part.trim();
//       return /^\d+$/.test(part) || /^\d+-\d+$/.test(part);
//     });
//   }, {
//     message: "Invalid range format. Use numbers or ranges like '3-7'.",
//   })
//   .transform((val) => {
//     const ids = new Set<number>();

//     for (const part of val.split(",")) {
//       const trimmed = part.trim();

//       const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
//       if (rangeMatch) {
//         const start = Number.parseInt(rangeMatch[1], 10);
//         const end = Number.parseInt(rangeMatch[2], 10);
//         if (start > end)
//           throw new Error(`Invalid range: '${trimmed}'`);
//         for (let i = start; i <= end; i++) {
//           ids.add(i);
//         }
//       }
//       else {
//         const num = Number(trimmed);
//         if (!Number.isInteger(num) || num < 0) {
//           throw new Error(`Invalid ID: '${trimmed}'`);
//         }
//         ids.add(num);
//       }
//     }

//     return Array.from(ids)
//       .sort((a, b) => a - b)
//       .map(n => n.toString());
//   });
