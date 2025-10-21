import * as React from "react";
import EmailLayout from "./EmailLayout";
import { BaseEmailPayload } from "./types";

export default function BookingRescheduled(p: BaseEmailPayload) {
  const Row = ({ label, value }: any) =>
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
    <EmailLayout preview="Booking rescheduled" title="Booking rescheduled">
      <p style={{ margin: "0 0 12px" }}>
        Heads up, {p.name} — your booking was rescheduled. New details:
      </p>
      <Row label="Service" value={p.service} />
      <Row label="Price" value={p.price} />
      <Row label="Date" value={p.date} />
      <Row label="Time" value={p.time} />
      <Row label="Phone" value={p.phone} />
      <p style={{ margin: "16px 0 0" }}>
        Reply if this doesn’t work and we’ll find another time.
      </p>
    </EmailLayout>
  );
}
