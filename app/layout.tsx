import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 가계부 챗봇",
  description: "대화로 기록하는 AI 가계부",
  applicationName: "AI 가계부 챗봇",
  appleWebApp: {
    capable: true,
    title: "AI 가계부",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      {
        url: "/app-icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/app-icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/app-icons/ios/apple-touch-icon-180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
