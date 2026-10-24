import { Upload } from "tus-js-client";
export function storageUploadEndpoint(raw: string) {
  const url = new URL(raw);
  if (url.hostname.endsWith(".supabase.co") && !url.hostname.endsWith(".storage.supabase.co"))
    url.hostname = url.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  url.hash = "";
  return url.href;
}
export function createResumableUpload(
  file: File,
  input: {
    bucket: string;
    path: string;
    token: string;
    mimeType: string;
    onProgress: (sent: number, total: number) => void;
    onSuccess: () => void;
    onError: (error: Error) => void;
  },
) {
  return new Upload(file, {
    endpoint: storageUploadEndpoint(process.env.NEXT_PUBLIC_SUPABASE_URL!),
    chunkSize: 6 * 1024 * 1024,
    retryDelays: [0, 1000, 3000, 5000, 10000],
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    storeFingerprintForResuming: false,
    headers: { "x-signature": input.token, "x-upsert": "false" },
    metadata: {
      bucketName: input.bucket,
      objectName: input.path,
      contentType: input.mimeType,
      cacheControl: "3600",
    },
    onProgress: input.onProgress,
    onSuccess: input.onSuccess,
    onError: input.onError,
  });
}
