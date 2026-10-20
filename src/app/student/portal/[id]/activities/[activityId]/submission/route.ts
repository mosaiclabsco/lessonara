import { activityDownload } from "@/lib/activity-download";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; activityId: string }> },
) {
  const { id, activityId } = await params;
  return activityDownload(activityId, "submission", id);
}
