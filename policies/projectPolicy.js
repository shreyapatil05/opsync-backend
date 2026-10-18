const sameId = (left, right) => Boolean(left && right && left.toString() === right.toString());

export const projectPermissions = ({ project, team, user }) => {
  if (!project) return { canRead: false, canManage: false, canCreateTask: false };
  if (user.role === 'Admin') return { canRead: true, canManage: true, canCreateTask: true };

  const isCreator = sameId(project.createdBy, user.id);
  const isManager = sameId(project.projectManager, user.id);
  const isAssigned = project.assignedMembers?.some(id => sameId(id, user.id)) || false;
  const isTeamAdmin = sameId(team?.admin, user.id);
  const isTeamMember = isTeamAdmin || (team?.members?.some(id => sameId(id, user.id)) || false);

  return {
    canRead: isCreator || isManager || isAssigned || isTeamMember,
    canManage: isCreator || isManager || isTeamAdmin,
    canCreateTask: isCreator || isManager || isTeamMember,
  };
};

export const canUpdateTask = ({ permissions, task, user }) => (
  permissions.canManage || sameId(task?.assignee, user.id)
);
