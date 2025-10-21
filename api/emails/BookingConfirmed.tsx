import * as React from "react";
import EmailLayout from "./EmailLayout.tsx";
import { BaseEmailPayload } from "./types.ts";

export default function BookingConfirmed(p: BaseEmailPayload) {
  const row = (label: string, value?: string) =>
    !value ? null : (
      <table role="presentation" width="100%">
        <tbody>
          <tr>
            <td
              style={{
                padding: "6px 0",
                color: "#a3a3a3",
                width: 120,
                verticalAlign: "top",
              }}
            >
              {label}
            </td>
            <td style={{ padding: "6px 0", color: "#e5e5e5" }}>{value}</td>
          </tr>
        </tbody>
      </table>
    );

  return (
    <EmailLayout preview="Booking confirmed" title="Booking confirmed">
      <p style={{ margin: "0 0 12px" }}>
        Hey {p.name}, thanks for booking with us! Here are your details:
      </p>
      {row("Service", p.service)}
      {row("Price", p.price)}
      {row("Date", p.date)}
      {row("Time", p.time)}
      {row("Phone", p.phone)}
      <p style={{ margin: "16px 0 0" }}>
        If anything changes, just reply to this email.
      </p>
    </EmailLayout>
  );
}
