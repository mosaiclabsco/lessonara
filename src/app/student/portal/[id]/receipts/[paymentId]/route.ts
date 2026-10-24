import { paymentReceipt } from "@/lib/receipt-route";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id, paymentId } = await params;
  return paymentReceipt(paymentId, id);
}
