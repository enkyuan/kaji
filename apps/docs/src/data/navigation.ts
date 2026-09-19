export interface NavigationItem {
  href: string;
  label: string;
  status?: "wip";
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}

export const navigation: NavigationSection[] = [
  {
    items: [
      { href: "/", label: "Overview" },
      { href: "/docs", label: "Introduction" },
      { href: "/docs/install", label: "Install" },
      { href: "/docs/getting-started", label: "Getting Started" },
    ],
  },
  {
    label: "Concepts",
    items: [
      { href: "/docs/concepts/capabilities", label: "Capabilities" },
      { href: "/docs/concepts/outcomes", label: "Execution Outcomes" },
      { href: "/docs/concepts/idempotency", label: "Idempotency" },
    ],
  },
  {
    label: "Guides",
    items: [
      { href: "/docs/guides/authorization-and-approval", label: "Authorization" },
      { href: "/docs/guides/custom-store", label: "Custom Store" },
    ],
  },
  {
    label: "Reference",
    items: [
      { href: "/docs/reference/api", label: "API Reference" },
      { href: "/docs/examples/refund", label: "Refund Example" },
    ],
  },
];

export const navigationItems = navigation.flatMap((section) => section.items);
