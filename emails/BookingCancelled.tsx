import * as React from "react";
import { Text, Heading } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import type { BookingEmailProps } from "./BookingConfirmed";

export default function BookingCancelled(props: BookingEmailProps) {
  const { name, date, time } = props;
  return (
    <EmailLayout preview={`Booking cancelled — ${date} ${time}`}>
      <Heading as="h2">Booking cancelled</Heading>
      <Text>Hi {name || "there"},</Text>
      <Text>
        Your booking for <b>{date}</b> at <b>{time}</b> has been cancelled.
      </Text>
    </EmailLayout>
  );
}
