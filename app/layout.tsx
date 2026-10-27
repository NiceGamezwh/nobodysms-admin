import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NobodySMS 合约管理后台",
  description: "Sepolia VeetoBearerRegistry + MemberCardQueue 管理面板",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
