import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Tailwind,
  Body,
  Container,
  Section,
} from "@react-email/components";

export default function EmailLayout({
  preview,
  children,
  title = "Fast Boys Garage",
}: {
  preview: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-neutral-50 text-neutral-900">
          <Container className="mx-auto my-6 w-full max-w-[600px]">
            <Section className="rounded-xl border border-neutral-200 bg-white p-20">
              <h1 className="m-0 text-xl font-extrabold">Fast Boys Garage</h1>
              <div className="mt-1 text-xs text-neutral-500">
                London, Ontario
              </div>
              <hr className="my-4 border-neutral-200" />
              {children}
              <hr className="my-6 border-neutral-200" />
              <div className="text-xs text-neutral-500">
                Reply to this email if you need to make a change.
              </div>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
