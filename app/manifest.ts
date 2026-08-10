import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Desk Dashboard",
    short_name: "Desk",
    description: "A focused overview of the day ahead",
    // Added to the home screen this launches without browser chrome, which is
    // what makes the iPad usable as a kiosk display.
    display: "standalone",
    orientation: "landscape",
    start_url: "/",
    background_color: "#151412",
    theme_color: "#151412",
  };
}
