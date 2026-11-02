import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HookLens - inspect, forward and replay webhooks",
  description: "Receive webhooks on localhost with a public URL, inspect every request, and replay events without triggering them again.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
