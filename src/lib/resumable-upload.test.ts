import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(...args: unknown[]) {
      mock.upload(...args);
    }
  },
}));
import { storageUploadEndpoint, createResumableUpload } from "./resumable-upload";
it("usa endpoint direto do projeto sem liberar outros hosts", () => {
  expect(storageUploadEndpoint("https://project.supabase.co")).toBe(
    "https://project.storage.supabase.co/storage/v1/upload/resumable/sign",
  );
  expect(storageUploadEndpoint("http://localhost:54321")).toBe(
    "http://localhost:54321/storage/v1/upload/resumable/sign",
  );
});
it("TUS usa assinatura restrita, chunks 6 MB e tentativas finitas", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  const file = new File(["test"], "file.pdf");
  createResumableUpload(file, {
    bucket: "lessonara-documents",
    path: "owner/id/file.pdf",
    token: "signed-test-token",
    mimeType: "application/pdf",
    onProgress: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  });
  expect(mock.upload).toHaveBeenCalledWith(
    file,
    expect.objectContaining({
      chunkSize: 6 * 1024 * 1024,
      headers: {
        apikey: "sb_publishable_test",
        "x-signature": "signed-test-token",
        "x-upsert": "false",
      },
      retryDelays: [0, 1000, 3000, 5000, 10000],
      storeFingerprintForResuming: false,
    }),
  );
  vi.unstubAllEnvs();
});
