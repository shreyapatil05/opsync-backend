import Project from '../models/Project.js';
import Team from '../models/Team.js';
import { projectPermissions } from '../policies/projectPolicy.js';

export const getProjectAccess = async (projectId, user, { session } = {}) => {
  const project = await Project.findById(projectId).session(session || null);
  if (!project) return { project: null, team: null, ...projectPermissions({ project: null, user }) };

  const team = project.teamId
    ? await Team.findById(project.teamId).select('admin members').session(session || null)
    : null;

  return { project, team, ...projectPermissions({ project, team, user }) };
};
