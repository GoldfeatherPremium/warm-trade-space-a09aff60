/**
 * Transactional email. Configure via env vars:
 *   RESEND_API_KEY — Resend API key (https://resend.com)
 *   EMAIL_FROM     — sender address, e.g. "X-VAULT <noreply@yourdomain.com>"
 *
 * Without RESEND_API_KEY the function logs to console so dev/test flows still
 * see the email content without accidentally sending to real addresses.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:dev] To: ${payload.to} | ${payload.subject}`);
    return;
  }
  const from = process.env.EMAIL_FROM ?? "X-VAULT <noreply@x-vault.io>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      ...(payload.html ? { html: payload.html } : {}),
    }),
  });
  if (!res.ok) {
    console.error(`[email] send failed ${res.status}:`, await res.text().catch(() => ""));
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function orderPaidEmail(opts: {
  to: string;
  username: string;
  orderNo: string;
  productTitle: string;
  totalUsdt: string;
  orderUrl: string;
}): EmailPayload {
  const { username, orderNo, productTitle, totalUsdt, orderUrl } = opts;
  return {
    to: opts.to,
    subject: `Order confirmed — ${orderNo}`,
    text: [
      `Hi ${username},`,
      ``,
      `Your payment of ${totalUsdt} USDT for "${productTitle}" has been confirmed.`,
      `Order number: ${orderNo}`,
      ``,
      `Track your order: ${orderUrl}`,
      ``,
      `— X-VAULT`,
    ].join("\n"),
  };
}

export function orderDeliveredEmail(opts: {
  to: string;
  username: string;
  orderNo: string;
  productTitle: string;
  orderUrl: string;
}): EmailPayload {
  const { username, orderNo, productTitle, orderUrl } = opts;
  return {
    to: opts.to,
    subject: `Delivery ready — ${orderNo}`,
    text: [
      `Hi ${username},`,
      ``,
      `Your order "${productTitle}" has been delivered.`,
      `Please confirm receipt in your order page to release payment to the seller.`,
      ``,
      `Order page: ${orderUrl}`,
      ``,
      `— X-VAULT`,
    ].join("\n"),
  };
}

export function disputeOpenedEmail(opts: {
  to: string;
  username: string;
  orderNo: string;
  disputeUrl: string;
}): EmailPayload {
  const { username, orderNo, disputeUrl } = opts;
  return {
    to: opts.to,
    subject: `Dispute opened — ${orderNo}`,
    text: [
      `Hi ${username},`,
      ``,
      `A dispute has been opened for order ${orderNo}. Our team will review it within 24 hours.`,
      ``,
      `View dispute: ${disputeUrl}`,
      ``,
      `— X-VAULT`,
    ].join("\n"),
  };
}

export function withdrawalProcessedEmail(opts: {
  to: string;
  username: string;
  amountUsdt: string;
  network: string;
}): EmailPayload {
  const { username, amountUsdt, network } = opts;
  return {
    to: opts.to,
    subject: `Withdrawal processed — ${amountUsdt} USDT`,
    text: [
      `Hi ${username},`,
      ``,
      `Your withdrawal of ${amountUsdt} USDT (${network}) has been processed.`,
      `Funds should arrive within the network's standard confirmation time.`,
      ``,
      `— X-VAULT`,
    ].join("\n"),
  };
}
