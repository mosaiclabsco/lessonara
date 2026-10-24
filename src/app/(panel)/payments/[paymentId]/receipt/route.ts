import { paymentReceipt } from "@/lib/receipt-route";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  return paymentReceipt((await params).paymentId);
}
