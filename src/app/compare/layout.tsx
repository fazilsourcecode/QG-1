import type React from "react";

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout component should NOT render <html> or <body> tags.
  // It simply returns its children, which will be placed inside the
  // <html> and <body> rendered by the root layout (src/app/layout.tsx).
  // The main application header from the root layout will NOT be part of this page
  // because this specific layout file takes precedence for the /compare route segment.
  return <>{children}</>;
}
