import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { SerwistProvider } from "./serwist";
import "./globals.css";
import ThemeInitializer from "@/components/global/ThemeInitializer";
import FirebaseAnalytics from "@/components/global/FirebaseAnalytics";
import FCMProvider from "@/components/global/FCMProvider";
import NetworkStatus from "@/components/pwa/NetworkStatus";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import PwaUpdateToast from "@/components/pwa/PwaUpdateToast";
import { ViewTransition } from 'react'
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  APP_DEFAULT_TITLE,
  APP_DESCRIPTION,
  APP_NAME,
  APP_TITLE_TEMPLATE,
  TRANSITION,
} from "@/constants";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://legal-adviser.vercel.app",
  ),
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
    // startupImage: [
    //   {
    //     url: "/icons/apple-splash-2048-2732.png",
    //     media:
    //       "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
    //   },
    //   {
    //     url: "/icons/apple-splash-1242-2688.png",
    //     media:
    //       "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
    //   },
    // ],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
};

// Viewport handles the theme color for mobile status bars
export const viewport: Viewport = {
  themeColor: "#0f172a", // Match your theme_color in manifest.json
  colorScheme: "dark", // This tells the browser the default is dark
  userScalable: true,
  width: "device-width",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
 <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* <meta
          name="msapplication-square70x70logo"
          content="/icons/mstile-icon-128.png"
        />
        <meta
          name="msapplication-square150x150logo"
          content="/icons/mstile-icon-270.png"
        />
        <meta
          name="msapplication-square310x310logo"
          content="/icons/mstile-icon-558.png"
        />
        <meta
          name="msapplication-wide310x150logo"
          content="/icons/mstile-icon-558-270.png"
        /> */}

         <link rel="apple-touch-startup-image" media="screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_17_Pro_Max__iPhone_16_Pro_Max_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_17_Pro__iPhone_17__iPhone_16_Pro_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_17_Pro_Max__iPhone_16_Pro_Max_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_17_Pro__iPhone_17__iPhone_16_Pro_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_Air_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_17e__iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_11_Pro_Max__iPhone_XS_Max_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/iPhone_11__iPhone_XR_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" href="/icons/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/4__iPhone_SE__iPod_touch_5th_generation_and_later_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/13__iPad_Pro_M4_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/12.9__iPad_Pro_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/11__iPad_Pro_M4_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/11__iPad_Pro__10.5__iPad_Pro_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/10.9__iPad_Air_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/10.5__iPad_Air_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/10.2__iPad_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/8.3__iPad_Mini_landscape.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_17_Pro_Max__iPhone_16_Pro_Max_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_17_Pro__iPhone_17__iPhone_16_Pro_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_16_Plus__iPhone_15_Pro_Max__iPhone_15_Plus__iPhone_14_Pro_Max_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_Air_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_16__iPhone_15_Pro__iPhone_15__iPhone_14_Pro_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_14_Plus__iPhone_13_Pro_Max__iPhone_12_Pro_Max_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_17e__iPhone_16e__iPhone_14__iPhone_13_Pro__iPhone_13__iPhone_12_Pro__iPhone_12_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_13_mini__iPhone_12_mini__iPhone_11_Pro__iPhone_XS__iPhone_X_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_11_Pro_Max__iPhone_XS_Max_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/iPhone_11__iPhone_XR_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/icons/iPhone_8_Plus__iPhone_7_Plus__iPhone_6s_Plus__iPhone_6_Plus_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/iPhone_8__iPhone_7__iPhone_6s__iPhone_6__4.7__iPhone_SE_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/4__iPhone_SE__iPod_touch_5th_generation_and_later_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/13__iPad_Pro_M4_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/12.9__iPad_Pro_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1210px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/11__iPad_Pro_M4_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/11__iPad_Pro__10.5__iPad_Pro_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/10.9__iPad_Air_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/10.5__iPad_Air_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/10.2__iPad_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/9.7__iPad_Pro__7.9__iPad_mini__9.7__iPad_Air__9.7__iPad_portrait.png"/>
<link rel="apple-touch-startup-image" media="screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/icons/8.3__iPad_Mini_portrait.png"/>

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
        className={`${inter.className} bg-slate-50 dark:bg-slate-900 transition-colors duration-200 custom-scroll-container`}
        suppressHydrationWarning
      >
        <TooltipProvider>
          <FirebaseAnalytics />
          <Toaster position="top-right" />
          <NetworkStatus />
          <InstallPrompt />
          <PwaUpdateToast />
          <ThemeInitializer />
          <NextTopLoader height={2.5} />
          <SerwistProvider swUrl="/sw.js">
            <FCMProvider />
              <ViewTransition
                    default="auto"
                    enter={{
                      [TRANSITION.NAV_FORWARD]: 'slide-in-right',
                      [TRANSITION.NAV_BACK]: 'slide-in-left',
                      default: 'auto',
                    }}
                    exit={{
                      [TRANSITION.NAV_FORWARD]: 'slide-out-left',
                      [TRANSITION.NAV_BACK]: 'slide-out-right',
                      default: 'auto',
                    }}
                >
                  {children}
              </ViewTransition>
          </SerwistProvider>
        </TooltipProvider>
      </body>
    </html>
  );
};

export default RootLayout;
