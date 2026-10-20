import { activityDownload } from "@/lib/activity-download";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  return activityDownload(id, "submission", slug, "slug");
}
