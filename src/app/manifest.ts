import type { MetadataRoute } from "next"

/**
 * Web app manifest (Spec §2.2 "PWA/offline"; Plan P9.1): makes DevWorkspace installable on
 * desktop and Android. Served at /manifest.webmanifest outside the auth proxy, because browsers
 * fetch it without cookies.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DevWorkspace",
    short_name: "DevWorkspace",
    description: "Personal engineering workspace for projects, tasks, handoffs and environments.",
    start_url: "/my-work",
    scope: "/",
    display: "standalone",
    lang: "en",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "My work",
        url: "/my-work",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "New task",
        url: "/tasks/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  }
}
