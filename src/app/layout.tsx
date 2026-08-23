import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pronounce Sheet",
  description: "Build pronunciation cue sheets for spoken delivery and rehearsal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
