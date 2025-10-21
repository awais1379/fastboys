import * as React from "react";
import { Text, Heading } from "@react-email/components";
import EmailLayout from "./EmailLayout";

export type BookingEmailProps = {
  name: string;
  email: string;
  phone?: string;
  service?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};

export default function BookingConfirmed(props: BookingEmailProps) {
  const { name, date, time, service, phone, email } = props;
  return (
    <EmailLayout preview={`Booking confirmed — ${date} ${time}`}>
      <Heading as="h2">Your booking is confirmed</Heading>
      <Text>Hey {name || "there"},</Text>
      <Text>
        We’ve locked in your booking for <b>{date}</b> at <b>{time}</b>
        {service ? (
          <>
            {" "}
            for <b>{service}</b>
          </>
        ) : null}
        .
      </Text>
      <Text>
        Contact on file: {phone || "—"} · {email}
      </Text>
    </EmailLayout>
  );
}
