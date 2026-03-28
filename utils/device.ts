import { UAParser } from "ua-parser-js";

/**
 * Utility to gather device information for user statistics.
 */
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
