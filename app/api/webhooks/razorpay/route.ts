// Phase 7 — Razorpay webhook handler
// Handles payment.captured, subscription.activated, subscription.cancelled events
export async function POST() {
  return Response.json({ message: 'Razorpay webhook — Phase 7' })
}
