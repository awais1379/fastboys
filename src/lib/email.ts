// src/lib/email.ts
const EMAIL_ENDPOINT = import.meta.env.DEV
  ? import.meta.env.VITE_EMAIL_ENDPOINT
  : "/api/send-booking-email";

const EMAIL_SECRET = import.meta.env.VITE_EMAIL_SECRET;

export type BookingEmailEvent =
  | "booking.created"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.updated";

type EmailPayload = {
  name: string;
  email?: string;
  phone?: string;
  service?: string;
  price?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};

export async function sendBookingEmail(
  event: BookingEmailEvent,
  data: EmailPayload
) {
  if (!EMAIL_ENDPOINT || !EMAIL_SECRET || !data.email) return;

  try {
    await fetch(EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-email-secret": EMAIL_SECRET,
      },
      body: JSON.stringify({ event, data }),
      credentials: "omit",
      mode: "cors",
    });
  } catch (err) {
    console.warn("sendBookingEmail failed (non-blocking):", err);
  }
}
