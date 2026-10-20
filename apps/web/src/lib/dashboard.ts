import { membershipRequest } from "./members";

export interface Dashboard {
  members: number;
  pendingInvitations: number;
  membersByRole: {
    OWNER: number;
    ADMIN: number;
    MEMBER: number;
    VIEWER: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    resource: string;
    createdAt: string;
  }>;
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
export async function getDashboard(id: string): Promise<Dashboard> {
  const data = await membershipRequest(
    `/organizations/${encodeURIComponent(id)}/dashboard`,
  );
  if (
    !data ||
    typeof data !== "object" ||
    !("members" in data) ||
    !count(data.members) ||
    !("pendingInvitations" in data) ||
    !count(data.pendingInvitations) ||
    !("membersByRole" in data) ||
    !data.membersByRole ||
    typeof data.membersByRole !== "object" ||
    !("recentActivity" in data) ||
    !Array.isArray(data.recentActivity) ||
    data.recentActivity.length > 5
  )
    throw new Error("Invalid dashboard response.");
  const roles = data.membersByRole;
  if (
    !("OWNER" in roles) ||
    !count(roles.OWNER) ||
    !("ADMIN" in roles) ||
    !count(roles.ADMIN) ||
    !("MEMBER" in roles) ||
    !count(roles.MEMBER) ||
    !("VIEWER" in roles) ||
    !count(roles.VIEWER)
  )
    throw new Error("Invalid dashboard counts.");
  if (roles.OWNER + roles.ADMIN + roles.MEMBER + roles.VIEWER !== data.members)
    throw new Error("Inconsistent dashboard counts.");
  return {
    members: data.members,
    pendingInvitations: data.pendingInvitations,
    membersByRole: {
      OWNER: roles.OWNER,
      ADMIN: roles.ADMIN,
      MEMBER: roles.MEMBER,
      VIEWER: roles.VIEWER,
    },
    recentActivity: data.recentActivity.map((value: unknown) => {
      if (
        !value ||
        typeof value !== "object" ||
        !("id" in value) ||
        typeof value.id !== "string" ||
        !("action" in value) ||
        typeof value.action !== "string" ||
        !("resource" in value) ||
        typeof value.resource !== "string" ||
        !("createdAt" in value) ||
        typeof value.createdAt !== "string"
      )
        throw new Error("Invalid dashboard activity.");
      return {
        id: value.id,
        action: value.action,
        resource: value.resource,
        createdAt: value.createdAt,
      };
    }),
  };
}
