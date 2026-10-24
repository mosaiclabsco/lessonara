import { createServer } from "node:http";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createResumableUpload } from "./resumable-upload";
let server: ReturnType<typeof createServer>,
  origin = "",
  offset = 0,
  attempts = 0,
  posts = 0,
  bytes = 0;
beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Tus-Resumable", "1.0.0");
    if (request.method === "POST") {
      posts++;
      response.setHeader("Location", origin + "/upload/one");
      response.statusCode = 201;
      request.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        offset += chunk.length;
      });
      request.on("end", () => response.end());
      return;
    }
    if (request.method === "HEAD") {
      response.setHeader("Upload-Offset", offset);
      response.setHeader("Upload-Length", 7 * 1024 * 1024);
      response.statusCode = 200;
      response.end();
      return;
    }
    if (request.method === "PATCH") {
      attempts++;
      if (attempts === 1) {
        response.statusCode = 503;
        response.end();
        return;
      }
      expect(request.headers["x-signature"]).toBe("synthetic-token");
      request.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        offset += chunk.length;
      });
      request.on("end", () => {
        response.statusCode = 204;
        response.setHeader("Upload-Offset", offset);
        response.end();
      });
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
it("retoma após 503 sem reiniciar o objeto nem duplicar bytes confirmados", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", origin);
  const progress: number[] = [];
  await new Promise<void>((resolve, reject) => {
    const upload = createResumableUpload(Buffer.alloc(7 * 1024 * 1024) as unknown as File, {
      bucket: "lessonara-documents",
      path: "synthetic/file.pdf",
      token: "synthetic-token",
      mimeType: "application/pdf",
      onProgress: (sent) => progress.push(sent),
      onSuccess: resolve,
      onError: reject,
    });
    upload.start();
  });
  expect(posts).toBe(1);
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(offset).toBe(7 * 1024 * 1024);
  expect(bytes).toBe(7 * 1024 * 1024);
  expect(progress.at(-1)).toBe(7 * 1024 * 1024);
}, 15000);
