import * as React from "react";
import { Text, Heading } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import type { BookingEmailProps } from "./BookingConfirmed";

export default function BookingRescheduled(
  props: BookingEmailProps & { oldDate: string; oldTime: string }
) {
  const { name, date, time, oldDate, oldTime, service } = props;
  return (
    <EmailLayout preview={`Booking updated — ${date} ${time}`}>
      <Heading as="h2">Your booking was rescheduled</Heading>
      <Text>Hi {name || "there"},</Text>
      <Text>
        We’ve moved your booking from{" "}
        <b>
          {oldDate} {oldTime}
        </b>{" "}
        to{" "}
        <b>
          {date} {time}
        </b>
        {service ? (
          <>
            {" "}
            for <b>{service}</b>
          </>
        ) : null}
        .
      </Text>
    </EmailLayout>
  );
}
