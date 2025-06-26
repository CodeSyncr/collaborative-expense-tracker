import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Tracker",
    short_name: "Expenses",
    description: "Collaborative expense tracking for projects.",
    start_url: "/",
    display: "standalone",
    background_color: "#10b981",
    theme_color: "#10b981",
    icons: [
      {
        src: "/logo.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/logo.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
