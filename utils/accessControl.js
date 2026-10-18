import { projectPermissions } from '../policies/projectPolicy.js';

export const evaluateProjectAccess = (project, team, user) => {
  const { canRead, canManage } = projectPermissions({ project, team, user });
  return { canRead, canManage };
};
export { getProjectAccess } from '../services/projectAccessService.js';
