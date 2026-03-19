/**
 * Utility to gather device information for user statistics.
 */

// export const getDeviceStats = () => {
//   if (typeof window === "undefined") return null;

//   const ua = navigator.userAgent;
//   const platform = navigator.platform;
//   let browser = "Unknown";
//   let os = "Unknown";
//   let device = "Desktop";
//   let deviceName = "Unknown Device";

//   // Browser detection
//   if (ua.indexOf("Firefox") > -1) browser = "Firefox";
//   else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
//   else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
//   else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
//   else if (ua.indexOf("Edge") > -1) browser = "Edge";
//   else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
//   else if (ua.indexOf("Safari") > -1) browser = "Safari";

//   // OS detection
//   if (ua.indexOf("Win") > -1) os = "Windows";
//   else if (ua.indexOf("Mac") > -1) os = "macOS";
//   else if (ua.indexOf("X11") > -1) os = "UNIX";
//   else if (ua.indexOf("Linux") > -1) os = "Linux";
//   else if (ua.indexOf("Android") > -1) os = "Android";
//   else if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1) os = "iOS";

//   // Device Type detection
//   if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
//     device = "Mobile";
//     if (/iPad|tablet/i.test(ua)) device = "Tablet";
//   }

//   // Device Name / Manufacturer detection
//   if (ua.indexOf("iPhone") > -1) deviceName = "iPhone";
//   else if (ua.indexOf("iPad") > -1) deviceName = "iPad";
//   else if (ua.indexOf("Samsung") > -1 || ua.indexOf("SM-") > -1) deviceName = "Samsung";
//   else if (ua.indexOf("Nokia") > -1) deviceName = "Nokia";
//   else if (ua.indexOf("Huawei") > -1) deviceName = "Huawei";
//   else if (ua.indexOf("Pixel") > -1) deviceName = "Google Pixel";
//   else if (os === "Windows") deviceName = "Windows PC";
//   else if (os === "macOS") deviceName = "Mac";
//   else deviceName = platform || "Generic Device";

//   return {
//     browser,
//     os,
//     device,
//     deviceName,
//     resolution: `${window.screen.width}x${window.screen.height}`,
//     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
//     userAgent: ua,
//   };
// };

import { UAParser } from "ua-parser-js";

export const getDeviceStats = () => {
  if (typeof window === "undefined") return null;

  const parser = new UAParser(navigator.userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name ?? "Unknown",
    browserVersion: result.browser.version ?? "Unknown",
    os: result.os.name ?? "Unknown",
    osVersion: result.os.version ?? "Unknown",
    device: result.device.type ?? "Desktop", // "mobile" | "tablet" | "Desktop"
    deviceName: result.device.model ?? result.device.vendor ?? "Unknown Device",
    deviceVendor: result.device.vendor ?? "Unknown",
    resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    userAgent: navigator.userAgent,
  };
};
