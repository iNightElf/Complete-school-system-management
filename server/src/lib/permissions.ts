export type Permission =
  | "students:read" | "students:write"
  | "teachers:read" | "teachers:write"
  | "staff:read" | "staff:write"
  | "books:read" | "books:write"
  | "classes:read" | "classes:write"
  | "subjects:read" | "subjects:write"
  | "results:read" | "results:write"
  | "finance:read" | "finance:write" | "finance:admin"
  | "users:read" | "users:write"
  | "audit:read";

export type Role = "admin" | "teacher" | "accountant" | "viewer";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  viewer: "Viewer",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "students:read", "students:write",
    "teachers:read", "teachers:write",
    "staff:read", "staff:write",
    "books:read", "books:write",
    "classes:read", "classes:write",
    "subjects:read", "subjects:write",
    "results:read", "results:write",
    "finance:read", "finance:write", "finance:admin",
    "users:read", "users:write",
    "audit:read",
  ],
  teacher: [
    "students:read", "students:write",
    "teachers:read",
    "staff:read",
    "books:read",
    "classes:read",
    "subjects:read",
    "results:read", "results:write",
  ],
  accountant: [
    "students:read",
    "teachers:read",
    "staff:read",
    "books:read",
    "classes:read",
    "finance:read", "finance:write",
  ],
  viewer: [
    "students:read",
    "teachers:read",
    "staff:read",
    "books:read",
    "classes:read",
    "subjects:read",
    "results:read",
    "finance:read",
  ],
};

export const ALL_ROLES: Role[] = ["admin", "teacher", "accountant", "viewer"];

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] || [];
}
