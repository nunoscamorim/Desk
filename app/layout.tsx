import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desk Dashboard",
  description: "A focused overview of the day ahead",
  // iOS reads these rather than the manifest when the page is added to the home
  // screen: without them Desk opens inside Safari's chrome instead of full screen.
  appleWebApp: { capable: true, title: "Desk", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#151412",
  // The canvas scales itself to fit, so pinch-zoom would only ever knock the
  // display out of alignment on a screen nobody is browsing.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
