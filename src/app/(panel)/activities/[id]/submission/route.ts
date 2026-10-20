import { activityDownload } from "@/lib/activity-download";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return activityDownload((await params).id, "submission");
}
