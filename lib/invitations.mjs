/** @typedef {'admin' | 'estimator' | 'viewer'} InvitableRole */

/** @type {readonly InvitableRole[]} */
export const INVITABLE_ROLES = Object.freeze(['admin', 'estimator', 'viewer']);

/**
 * Workspace ownership is never granted through an invitation.
 *
 * @param {unknown} role
 * @returns {role is InvitableRole}
 */
export function isInvitableRole(role) {
  return typeof role === 'string' && INVITABLE_ROLES.includes(role);
}

/**
 * Build the database insert from trusted caller context. A request body's
 * workspace_id is deliberately not accepted by this function.
 *
 * @param {{
 *   workspaceId: string,
 *   email: string,
 *   role: InvitableRole,
 *   token: string,
 *   invitedBy: string | null,
 * }} input
 */
export function buildWorkspaceInvitation({ workspaceId, email, role, token, invitedBy }) {
  return {
    workspace_id: workspaceId,
    email,
    role,
    token,
    invited_by: invitedBy,
  };
}

/**
 * Build membership only from the stored invitation. Request-supplied roles
 * are never part of this decision, and legacy/forged owner invites fail closed.
 *
 * @param {{ workspace_id: string, role: unknown } | null | undefined} invite
 * @param {string} userId
 * @returns {{ workspace_id: string, user_id: string, role: InvitableRole } | null}
 */
export function buildAcceptedMembership(invite, userId) {
  if (!invite || !isInvitableRole(invite.role)) return null;

  return {
    workspace_id: invite.workspace_id,
    user_id: userId,
    role: invite.role,
  };
}
