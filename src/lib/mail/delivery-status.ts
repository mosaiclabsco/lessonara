export type DeliveryStatus =
  "delivered" | "delivery_delayed" | "bounced" | "complained" | "failed" | "suppressed";
export function emailDisplayStatus(job: {
  status: string;
  delivery_status?: DeliveryStatus | null;
}) {
  if (job.delivery_status === "delivered") return "delivered";
  if (job.delivery_status === "delivery_delayed") return "delayed";
  if (job.delivery_status) return "failed";
  return job.status;
}
