import test from 'node:test';
import assert from 'node:assert/strict';
import { canUpdateTask, projectPermissions } from '../policies/projectPolicy.js';
import { canManageTeam, canReadTeam } from '../policies/teamPolicy.js';

const project = { createdBy: 'creator', projectManager: 'manager', assignedMembers: ['assigned'] };
const team = { admin: 'team-admin', members: ['team-member'] };

test('team members can create tasks but cannot manage a project', () => {
  const permissions = projectPermissions({ project, team, user: { id: 'team-member', role: 'Employee' } });
  assert.equal(permissions.canCreateTask, true);
  assert.equal(permissions.canManage, false);
});

test('only a task assignee or project manager can update a task', () => {
  const permissions = { canManage: false };
  assert.equal(canUpdateTask({ permissions, task: { assignee: 'assigned' }, user: { id: 'assigned' } }), true);
  assert.equal(canUpdateTask({ permissions, task: { assignee: 'assigned' }, user: { id: 'outsider' } }), false);
});

test('team policy separates read and management rights', () => {
  assert.equal(canReadTeam(team, { id: 'team-member', role: 'Employee' }), true);
  assert.equal(canManageTeam(team, { id: 'team-member', role: 'Employee' }), false);
  assert.equal(canManageTeam(team, { id: 'team-admin', role: 'Admin' }), true);
});
