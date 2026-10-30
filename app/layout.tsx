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
      { url: "/icons/desktop/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/icons/desktop/icon.svg", type: "image/svg+xml" },
      {
        url: "/icons/desktop/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icons/mobile/android/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/desktop/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: "/icons/desktop/favicon.ico",
    apple: [120, 152, 167, 180].map((size) => ({
      url: `/icons/mobile/ios/apple-touch-icon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
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
