export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  pulse?: boolean;
  roles: Array<"admin" | "manager" | "staff">;
};

export const mainNav: NavItem[] = [
  {
    href: "/schedule",
    label: "Weekly Matrix",
    icon: "calendar_view_week",
    roles: ["admin", "manager"],
  },
  {
    href: "/on-duty",
    label: "Live Floor & Duty",
    icon: "storefront",
    pulse: true,
    roles: ["admin", "manager"],
  },
  {
    href: "/open-shifts",
    label: "Open Shifts Pool",
    icon: "event_available",
    badge: "2 urgent",
    roles: ["admin", "manager", "staff"],
  },
  {
    href: "/users",
    label: "Staff Roster",
    icon: "badge",
    roles: ["admin"],
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: ["admin", "manager"],
  },
  {
    href: "/my-schedule",
    label: "My Schedule",
    icon: "today",
    roles: ["staff"],
  },
  {
    href: "/availability",
    label: "Availability",
    icon: "event_note",
    roles: ["staff"],
  },
  {
    href: "/locations",
    label: "Locations",
    icon: "location_on",
    roles: ["admin"],
  },
];
