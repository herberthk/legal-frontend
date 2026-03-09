import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import ThemeInitializer from "@/components/global/ThemeInitializer";
import AuthProvider from "@/components/global/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Legal Adviser",
  description: "Legal Adviser",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme-storage');
                  if (stored) {
                    const { state } = JSON.parse(stored);
                    if (state && state.theme) {
                      document.documentElement.classList.add(state.theme);
                      return;
                    }
                  }
                  // Default to dark mode if no stored preference
                  document.documentElement.classList.add('dark');
                } catch (e) {
                  // Default to dark mode on error
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.className}bg-slate-50 dark:bg-slate-900 transition-colors duration-200`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ThemeInitializer />
          <NextTopLoader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
};

export default RootLayout;
