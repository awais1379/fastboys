import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type LayoutProps = {
  preview?: string;
  title?: string;
  children: React.ReactNode;
};

export default function EmailLayout({ preview, title, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      {preview ? <Preview>{preview}</Preview> : null}
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: 28,
          }}
        >
          <Section
            style={{
              background: "#0f0f0f",
              border: "1px solid #262626",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <Text
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Fast Boys Garage
            </Text>

            {title ? (
              <Text
                style={{ margin: "10px 0 0", color: "#e5e5e5", fontSize: 16 }}
              >
                {title}
              </Text>
            ) : null}

            <div style={{ marginTop: 10 }}>{children}</div>

            <Text style={{ marginTop: 20, color: "#a3a3a3", fontSize: 12 }}>
              London, Ontario • Text or call if you need help rescheduling.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
