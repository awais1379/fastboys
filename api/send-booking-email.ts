// /api/send-booking-email.ts
// Resend email sender with inline HTML templates (no JSX, no imports).
// Accepts BOTH shapes: { event, data:{...} } and { type, to, ... }

import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" }); // local dev
dotenv();

import { Resend } from "resend";

// ---- env ----
const RESEND_API_KEY =
  process.env.RESEND_API_KEY || process.env.VITE_EMAIL_SECRET;
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

if (!RESEND_API_KEY) {
  console.warn(
    "[send-booking-email] Missing RESEND_API_KEY / VITE_EMAIL_SECRET"
  );
}
const resend = new Resend(RESEND_API_KEY);

// ---- tiny utils (no JSX) ----
function escapeHtml(input: string) {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function row(label: string, value?: string) {
  if (!value) return "";
  return `<tr>
    <td style="padding:6px 0;color:#a3a3a3;width:120px;vertical-align:top;">${escapeHtml(
      label
    )}</td>
    <td style="padding:6px 0;color:#e5e5e5;">${escapeHtml(value)}</td>
  </tr>`;
}
function wrap(body: string, title = "Fast Boys Garage") {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;border:1px solid #262626;border-radius:12px;">
      <tr><td style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:18px;color:#fff;">Fast Boys Garage</h1>
        ${body}
        <p style="margin-top:20px;color:#a3a3a3;font-size:12px;">London, Ontario • Reply to this email to change anything.</p>
      </td></tr>
    </table>
  </div>
</body>
</html>`;
}

// ---- inline “templates” ----
type Core = {
  name: string;
  phone?: string;
  service?: string;
  price?: string;
  date: string;
  time: string;
};

function htmlBooked(p: Core) {
  return wrap(
    `
<p style="margin:0 0 12px;">Hey ${escapeHtml(
      p.name
    )}, thanks for booking with us! Here are your details:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
  ${row("Service", p.service)}
  ${row("Price", p.price)}
  ${row("Date", p.date)}
  ${row("Time", p.time)}
  ${row("Phone", p.phone)}
</table>
<p style="margin:16px 0 0;">If anything changes, just reply to this email.</p>
`,
    "Booking confirmed"
  );
}
function htmlRescheduled(p: Core) {
  return wrap(
    `
<p style="margin:0 0 12px;">Heads up, ${escapeHtml(
      p.name
    )} — your booking was rescheduled. New details:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
  ${row("Service", p.service)}
  ${row("Price", p.price)}
  ${row("Date", p.date)}
  ${row("Time", p.time)}
  ${row("Phone", p.phone)}
</table>
<p style="margin:16px 0 0;">Reply if this doesn’t work and we’ll find another time.</p>
`,
    "Booking rescheduled"
  );
}
function htmlCancelled(p: Core) {
  return wrap(
    `
<p style="margin:0 0 12px;">Hi ${escapeHtml(
      p.name
    )}, your booking has been cancelled.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;">
  ${row("Service", p.service)}
  ${row("Date", p.date)}
  ${row("Time", p.time)}
</table>
<p style="margin:16px 0 0;">Need to rebook? Reply to this email and we’ll get you in.</p>
`,
    "Booking cancelled"
  );
}

// ---- input normalization ----
type EmailType = "booked" | "rescheduled" | "cancelled";
type BodyAny = {
  // “new” shape
  type?: EmailType;
  to?: string;
  name?: string;
  email?: string;
  phone?: string;
  service?: string;
  price?: string;
  date?: string;
  time?: string;
  // “current” shape from your app
  event?: string; // booking.created | booking.updated | booking.cancelled
  data?: any;
  booking?: any;
};
function mapEventToType(event?: string): EmailType | undefined {
  const m: Record<string, EmailType> = {
    booked: "booked",
    rescheduled: "rescheduled",
    cancelled: "cancelled",
    "booking.created": "booked",
    "booking.updated": "rescheduled",
    "booking.cancelled": "cancelled",
  };
  return event ? m[event] : undefined;
}
function normalize(body: BodyAny): {
  type?: EmailType;
  to?: string;
  core: Core & { to?: string };
} {
  const src = (body.booking ?? body.data ?? body) as Partial<Core> & {
    email?: string;
  };
  const type =
    (body.type as EmailType | undefined) || mapEventToType(body.event);
  const to = body.to || src?.email;
  const core: Core & { to?: string } = {
    name: src?.name ?? "",
    phone: src?.phone,
    service: src?.service,
    price: src?.price,
    date: src?.date ?? "",
    time: src?.time ?? "",
    to: to ?? "",
  };
  return { type, to, core };
}

// ---- handler ----
export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hint: "POST to send email." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!RESEND_API_KEY) {
    return res.status(500).json({ ok: false, error: "Missing Resend API key" });
  }

  try {
    const parsed: BodyAny =
      typeof req.body === "object" && req.body
        ? req.body
        : JSON.parse(String(req.body || "{}"));

    const { type, to, core } = normalize(parsed);

    if (!type || !to || !core.name || !core.date || !core.time) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields" });
    }

    // subject + HTML
    let subject = "Fast Boys Garage";
    let html = "";
    if (type === "booked") {
      subject = `Booking confirmed — ${core.date} ${core.time}`;
      html = htmlBooked(core);
    } else if (type === "rescheduled") {
      subject = `Booking rescheduled — ${core.date} ${core.time}`;
      html = htmlRescheduled(core);
    } else if (type === "cancelled") {
      subject = `Booking cancelled — ${core.date} ${core.time}`;
      html = htmlCancelled(core);
    } else {
      return res.status(400).json({ ok: false, error: "Unknown email type" });
    }

    const { error, data } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ ok: false, error: String(error) });
    }
    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err: any) {
    console.error(err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Server error" });
  }
}
