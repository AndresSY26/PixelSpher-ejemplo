import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseUserAgent(userAgent: string): string {
  if (!userAgent) return "Dispositivo Desconocido";
  
  let browserName = "Navegador Desconocido";
  let osName = "SO Desconocido";

  // OS Detection
  if (userAgent.includes("Windows NT 10.0")) osName = "Windows 10/11";
  else if (userAgent.includes("Windows NT 6.3")) osName = "Windows 8.1";
  else if (userAgent.includes("Windows NT 6.2")) osName = "Windows 8";
  else if (userAgent.includes("Windows NT 6.1")) osName = "Windows 7";
  else if (userAgent.includes("Windows NT 6.0")) osName = "Windows Vista";
  else if (userAgent.includes("Windows NT 5.1")) osName = "Windows XP";
  else if (userAgent.includes("Macintosh") || userAgent.includes("Mac OS X")) osName = "macOS";
  else if (userAgent.includes("Linux")) osName = "Linux";
  else if (userAgent.includes("Android")) osName = "Android";
  else if (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod")) osName = "iOS";

  // Browser Detection (Simplified and ordered by commonality/specificity)
  if (userAgent.includes("Edg/")) browserName = "Edge";
  else if (userAgent.includes("Firefox/")) browserName = "Firefox";
  else if (userAgent.includes("Chrome/") && !userAgent.includes("Chromium/")) browserName = "Chrome";
  else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/") && !userAgent.includes("Chromium/")) browserName = "Safari";
  else if (userAgent.includes("OPR/") || userAgent.includes("Opera/")) browserName = "Opera";
  else if (userAgent.includes("MSIE ") || userAgent.includes("Trident/")) browserName = "Internet Explorer";
  
  if (browserName === "Navegador Desconocido" && osName === "SO Desconocido" && userAgent.length > 50) {
    return userAgent.substring(0, 50) + "..."; // Truncate long unknown user agents
  }
  if (browserName === "Navegador Desconocido" && osName === "SO Desconocido") return "Dispositivo Desconocido";

  return `${browserName} en ${osName}`;
}
