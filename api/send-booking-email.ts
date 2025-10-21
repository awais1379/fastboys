// /api/send-booking-email.ts
// Email sender (Resend) using React Email templates.
// Accepts BOTH payload shapes: {event, data:{...}} and {type, to, ...}

import { config as dotenv } from "dotenv";
dotenv({ path: ".env.local" });
dotenv();

import { Resend } from "resend";
import { render } from "@react-email/render";

// Your templates
import BookingConfirmed from "./emails/BookingConfirmed.js";
import BookingRescheduled from "./emails/BookingRescheduled.js";
import BookingCancelled from "./emails/BookingCancelled.js";
import type { BaseEmailPayload } from "./emails/types.js";
import * as React from "react";

// ---- env ----
const RESEND_API_KEY =
  process.env.RESEND_API_KEY || process.env.VITE_EMAIL_SECRET; // supports either name
const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

if (!RESEND_API_KEY) {
  console.warn(
    "[send-booking-email] Missing RESEND_API_KEY / VITE_EMAIL_SECRET"
  );
}

const resend = new Resend(RESEND_API_KEY);

// ---- input normalization ----
type EmailType = "booked" | "rescheduled" | "cancelled";

type BodyAny = {
  // “new” shape
  type?: EmailType;
  to?: string;
  name?: string;
  email?: string; // allow either `to` or `email`
  phone?: string;
  service?: string;
  price?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm

  // “current” shape (as you logged before)
  event?: string; // booking.created | booking.updated | booking.cancelled (or booked/rescheduled/cancelled)
  data?: any;
  booking?: any;
};

function mapEventToType(event?: string): EmailType | undefined {
  if (!event) return undefined;
  const m: Record<string, EmailType> = {
    booked: "booked",
    rescheduled: "rescheduled",
    cancelled: "cancelled",
    "booking.created": "booked",
    "booking.updated": "rescheduled",
    "booking.cancelled": "cancelled",
  };
  return m[event];
}

function normalize(body: BodyAny): {
  type?: EmailType;
  to?: string;
  core: BaseEmailPayload;
} {
  // prefer explicit "booking" or "data"
  const src = (body.booking ??
    body.data ??
    body) as Partial<BaseEmailPayload> & {
    email?: string;
  };

  const type =
    (body.type as EmailType | undefined) || mapEventToType(body.event);

  const to = body.to || src.email; // `to` wins, otherwise `email` from payload

  const core: BaseEmailPayload = {
    // the templates only need these (they don't need `to`)
    name: src.name ?? "",
    phone: src.phone,
    service: src.service,
    price: src.price,
    date: src.date ?? "",
    time: src.time ?? "",
    to: to ?? "", // not used by template but kept for completeness
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
    // Vercel sends parsed JSON already; keep fallback for safety
    const parsed: BodyAny =
      typeof req.body === "object" && req.body
        ? req.body
        : JSON.parse(String(req.body || "{}"));

    const { type, to, core } = normalize(parsed);

    // minimal validation (use what your client already sends)
    if (!type || !to || !core.name || !core.date || !core.time) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields" });
    }

    // subject + HTML from React Email templates
    let subject = "Fast Boys Garage";
    let html = "";

    if (type === "booked") {
      subject = `Booking confirmed — ${core.date} ${core.time}`;
      html = await render(React.createElement(BookingConfirmed, { ...core }));
    } else if (type === "rescheduled") {
      subject = `Booking rescheduled — ${core.date} ${core.time}`;
      html = await render(React.createElement(BookingRescheduled, { ...core }));
    } else if (type === "cancelled") {
      subject = `Booking cancelled — ${core.date} ${core.time}`;
      html = await render(React.createElement(BookingCancelled, { ...core }));
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
