import * as React from "react";
import EmailLayout from "./EmailLayout";
import { BaseEmailPayload } from "./types";

export default function BookingCancelled(p: BaseEmailPayload) {
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
    <EmailLayout preview="Booking cancelled" title="Booking cancelled">
      <p style={{ margin: "0 0 12px" }}>
        Hi {p.name}, your booking has been cancelled!!!!.
      </p>
      <Row label="Service" value={p.service} />
      <Row label="Date" value={p.date} />
      <Row label="Time" value={p.time} />
      <p style={{ margin: "16px 0 0" }}>
        Need to rebook? Reply to this email and we’ll get you in.
      </p>
    </EmailLayout>
  );
}
