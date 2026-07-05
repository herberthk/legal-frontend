import type { MetadataRoute } from "next";
import { APP_NAME, APP_DESCRIPTION } from "@/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    orientation: "portrait",
    display_override: ["window-controls-overlay"],
    scope: "/",
    lang: "en",
    dir: "ltr",
    categories: [
      "productivity", "legal", "business","chat","consultation", "ai-legal-assistant","law-tech", 
      "legal-assistant", 
      "voice-legal-assistant", 
      "legal-tech-solution", 
      "ai-legal-chat"
    ],
    launch_handler: { client_mode: "focus-existing" },
    // shortcuts: [
    //   {
    //     name: "New Consultation",
    //     url: "/chat",
    //     icons: [{ src: "/icons/shortcut-chat.png", sizes: "96x96" }],
    //   },
    //   {
    //     name: "Dashboard",
    //     url: "/dashboard",
    //     icons: [{ src: "/icons/shortcut-dashboard.png", sizes: "96x96" }],
    //   },
    // ],
    protocol_handlers: [
      {
        protocol: "web+tel",
        url: "/api/tel/%s",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/dashboard.jpg",
        sizes: "1919x900",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/screenshots/chat.jpg",
        sizes: "1919x900",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/screenshots/chat_home.jpg",
        sizes: "1919x900",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/screenshots/transcription.jpg",
        sizes: "1919x900",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/screenshots/voice_home.jpg",
        sizes: "1919x900",
        type: "image/jpeg",
        form_factor: "wide",
      },
      {
        src: "/screenshots/dashboard_mobile.jpg",
        sizes: "402x736",
        type: "image/jpeg",
        form_factor: "narrow",
      },
    ],
    icons: [
    {
    "src": "/icons/manifest-icon-192.maskable.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "/icons/manifest-icon-192.maskable.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "maskable"
  },
  {
    "src": "/icons/manifest-icon-512.maskable.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any"
  },
  {
    "src": "/icons/manifest-icon-512.maskable.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "maskable"
  }
    ],
  };
}
