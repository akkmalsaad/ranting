import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Ranting · Club management", template: "%s · Ranting" }, description: "A home for your martial arts club. Manage your branches and students with Ranting." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
