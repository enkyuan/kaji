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
      { href: "/introduction", label: "Introduction" },
      { href: "/docs/getting-started", label: "Getting Started" },
      { href: "/docs/architecture", label: "Architecture" },
    ],
  },
  {
    label: "Concepts",
    items: [
      { href: "/docs/concepts/capability", label: "Capabilities" },
      { href: "/docs/concepts/executor", label: "Execution" },
      { href: "/docs/concepts/approval", label: "Approval" },
      { href: "/docs/concepts/idempotency", label: "Idempotency" },
      { href: "/docs/concepts/cancellation", label: "Timeout" },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/docs/troubleshooting", label: "Troubleshooting" }],
  },
];

export const navigationItems = navigation.flatMap((section) => section.items);
