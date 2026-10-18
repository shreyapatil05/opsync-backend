import 'dotenv/config';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Activity from '../models/Activity.js';
import Rule from '../models/Rule.js';

const id = key => new mongoose.Types.ObjectId(createHash('sha256').update(`opsync-demo-v1:${key}`).digest('hex').slice(0, 24));
const days = offset => new Date(Date.now() + offset * 86400000);
const apply = process.argv.includes('--apply');
const password = process.env.DEMO_SEED_PASSWORD;
if (!process.env.MONGO_URI || !password || password.length < 12) {
  console.error('Set MONGO_URI and DEMO_SEED_PASSWORD (12+ characters).');
  process.exit(1);
}

const people = [
  ['admin', 'Avery Shah', 'Admin', 'avery.admin@opsync-demo.test'],
  ['manager', 'Jordan Mehta', 'Manager', 'jordan.manager@opsync-demo.test'],
  ['manager2', 'Priya Rao', 'Manager', 'priya.manager@opsync-demo.test'],
  ['employee', 'Sam Patel', 'Employee', 'sam.employee@opsync-demo.test'],
  ['employee2', 'Maya Chen', 'Employee', 'maya.employee@opsync-demo.test'],
  ['employee3', 'Leo Martins', 'Employee', 'leo.employee@opsync-demo.test'],
];
const uid = key => id(`user:${key}`);
const tid = key => id(`team:${key}`);
const pid = key => id(`project:${key}`);
const cid = key => id(`conversation:${key}`);
const taskId = (project, n) => id(`task:${project}:${n}`);
const users = people.map(([key, name, role, email]) => ({
  _id: uid(key), name, role, email, username: `demo_${key}`, password,
  emailVerified: true, emailVerifiedAt: days(-30), status: 'active',
  bio: `${role} working in the OpSync demo workspace.`, location: 'Bengaluru', createdAt: days(-30),
  ...(['manager', 'employee', 'employee2'].includes(key) ? { teamId: tid('product') } : {}),
  ...(['manager2', 'employee3'].includes(key) ? { teamId: tid('operations') } : {}),
}));
const teams = [
  { _id: tid('product'), name: 'Product Launch', description: 'Plans and ships the next customer release.', department: 'Product', admin: uid('admin'), members: ['manager', 'employee', 'employee2'].map(uid), createdAt: days(-25) },
  { _id: tid('operations'), name: 'Operations', description: 'Keeps onboarding and support running smoothly.', department: 'Operations', admin: uid('admin'), members: ['manager2', 'employee3'].map(uid), createdAt: days(-23) },
];
const specs = [
  { key: 'launch', name: 'Customer Portal Launch', team: 'product', manager: 'manager', members: ['admin', 'manager', 'employee', 'employee2'], status: 'in-progress', description: 'Release the self-service portal and prepare customers for launch.' },
  { key: 'onboarding', name: 'Onboarding Refresh', team: 'operations', manager: 'manager2', members: ['admin', 'manager2', 'employee3'], status: 'in-progress', description: 'Shorten the path from signup to first successful project.' },
  { key: 'reporting', name: 'Quarterly Reporting', team: 'product', manager: 'manager', members: ['admin', 'manager', 'employee', 'employee2'], status: 'completed', description: 'Deliver clear project and task performance reporting.' },
];
const taskSpecs = {
  launch: [
    ['Map customer journeys', 'done', 'high', 'manager', -8],
    ['Draft portal navigation', 'done', 'medium', 'employee', -5],
    ['Build account overview', 'in-progress', 'high', 'employee', 4],
    ['Review mobile layouts', 'in-progress', 'medium', 'employee2', 2],
    ['Run accessibility checks', 'todo', 'high', 'employee2', 7],
    ['Prepare release notes', 'todo', 'low', 'manager', 10],
  ],
  onboarding: [
    ['Audit signup drop-off', 'done', 'high', 'manager2', -7],
    ['Write welcome checklist', 'in-progress', 'medium', 'employee3', 3],
    ['Improve invite flow', 'in-progress', 'high', 'manager2', -1],
    ['Test email verification', 'todo', 'medium', 'employee3', 5],
    ['Review support handoff', 'todo', 'low', 'manager2', 9],
  ],
  reporting: [
    ['Define KPI glossary', 'done', 'medium', 'manager', -12],
    ['Validate task totals', 'done', 'high', 'employee', -9],
    ['Create chart views', 'done', 'medium', 'employee2', -6],
    ['Review export layout', 'done', 'low', 'manager', -3],
  ],
};
const tasks = specs.flatMap(spec => taskSpecs[spec.key].map(([title, status, priority, assignee, due], n) => ({
  _id: taskId(spec.key, n), title, description: `${title} for ${spec.name}.`, status, priority,
  assignee: uid(assignee), dueDate: days(due), projectId: pid(spec.key),
  createdAt: days(-18 + n), updatedAt: status === 'done' ? days(Math.min(due, -1)) : days(-Math.max(1, 5 - n)),
})));
const projects = specs.map(spec => {
  const projectTasks = tasks.filter(task => String(task.projectId) === String(pid(spec.key)));
  return { _id: pid(spec.key), name: spec.name, description: spec.description,
    teamId: tid(spec.team), createdBy: uid('admin'), projectManager: uid(spec.manager),
    assignedMembers: spec.members.map(uid), tasks: projectTasks.map(task => task._id),
    status: spec.status, progress: Math.round(projectTasks.filter(task => task.status === 'done').length / projectTasks.length * 100),
    isSolo: false, createdAt: days(-21), updatedAt: days(-1) };
});
const conversationSpecs = [
  ['product', 'team', 'Product Launch Team', ['admin', 'manager', 'employee', 'employee2'], { teamId: tid('product') }],
  ['operations', 'team', 'Operations Team', ['admin', 'manager2', 'employee3'], { teamId: tid('operations') }],
  ['launch', 'project', 'Customer Portal Launch', ['admin', 'manager', 'employee', 'employee2'], { projectId: pid('launch') }],
  ['direct', 'direct', undefined, ['manager', 'employee'], {}],
];
const messageSpecs = {
  product: [['admin', 'Launch planning starts here. Please share blockers in this channel.'], ['manager', 'The portal milestones are now on the board.'], ['employee2', 'I will review the mobile layouts this week.']],
  operations: [['admin', 'The onboarding refresh is ready for review.'], ['manager2', 'I have added the invite flow and email checks.']],
  launch: [['manager', 'Account overview is in progress.'], ['employee', 'I will post a preview after the next review.']],
  direct: [['manager', 'Can you take the account overview task?'], ['employee', 'Yes, I have started it.']],
};
const messages = conversationSpecs.flatMap(([key]) => messageSpecs[key].map(([sender, content], n) => ({
  _id: id(`message:${key}:${n}`), conversationId: cid(key), sender: uid(sender), content,
  messageType: 'text', readBy: [uid(sender)], createdAt: days(-3 + n / 10), updatedAt: days(-3 + n / 10),
})));
const conversations = conversationSpecs.map(([key, type, name, participants, extra]) => ({
  _id: cid(key), type, ...(name ? { name } : {}), participants: participants.map(uid),
  createdBy: uid(participants[0]), lastMessage: messages.filter(message => String(message.conversationId) === String(cid(key))).at(-1)._id,
  isActive: true, ...extra, createdAt: days(-4), updatedAt: days(-1),
}));
const activities = [
  ['launch-created', 'admin', 'project', 'created', 'project', pid('launch'), 'Customer Portal Launch', '/projects/' + pid('launch')],
  ['onboarding-created', 'admin', 'project', 'created', 'project', pid('onboarding'), 'Onboarding Refresh', '/projects/' + pid('onboarding')],
  ['task-progress', 'employee', 'task', 'updated', 'task', taskId('launch', 2), 'Build account overview', '/projects/' + pid('launch')],
  ['task-done', 'employee2', 'task', 'completed', 'task', taskId('reporting', 2), 'Create chart views', '/projects/' + pid('reporting')],
  ['team-update', 'manager2', 'system', 'updated', 'system', tid('operations'), 'Operations planning', '/teams'],
].map(([key, actor, category, action, targetType, targetId, targetName, targetUrl], n) => ({
  _id: id(`activity:${key}`), actor: uid(actor), category, action, targetType, targetId, targetName, targetUrl,
  recipients: [uid('admin'), uid('manager'), uid('employee')], isSystem: category === 'system',
  savedBy: n === 2 ? [uid('employee')] : [], createdAt: days(-5 + n), updatedAt: days(-5 + n),
}));
const rules = [
  { _id: id('rule:overdue'), name: 'Flag overdue launch tasks', condition: JSON.stringify({ all: [{ field: 'status', operator: 'not_equals', value: 'done' }, { field: 'dueDate', operator: 'before_now' }] }), action: 'notify_manager', projectId: pid('launch'), createdBy: uid('admin'), isActive: false },
  { _id: id('rule:priority'), name: 'Escalate priority onboarding work', condition: JSON.stringify({ field: 'priority', operator: 'equals', value: 'high' }), action: 'escalate_senior', projectId: pid('onboarding'), createdBy: uid('admin'), isActive: false },
];

const plan = [[User, users], [Team, teams], [Project, projects], [Task, tasks], [Conversation, conversations], [Message, messages], [Activity, activities], [Rule, rules]];
console.log(`Demo plan: ${plan.map(([model, docs]) => `${docs.length} ${model.collection.name}`).join(', ')}.`);
if (!apply) { console.log('Preview only. Add --apply to insert into MONGO_URI.'); process.exit(0); }

await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
try {
  const dbName = mongoose.connection.db.databaseName;
  if (['admin', 'local', 'config'].includes(dbName)) throw new Error(`Refusing to seed MongoDB system database ${dbName}`);
  const emails = users.map(user => user.email);
  const conflicting = await User.find({ email: { $in: emails }, _id: { $nin: users.map(user => user._id) } }).select('email').lean();
  if (conflicting.length) throw new Error(`Demo emails already belong to other users: ${conflicting.map(user => user.email).join(', ')}`);
  const existing = await Promise.all(plan.map(async ([model, docs]) => [model, await model.find({ _id: { $in: docs.map(doc => doc._id) } }).select('_id').lean()]));
  const existingCounts = new Map(existing.map(([model, docs]) => [model.modelName, docs.length]));
  if ([...existingCounts.values()].some(count => count > 0) && [...existingCounts.values()].some((count, index) => count !== plan[index][1].length)) {
    throw new Error('Partial demo dataset detected. No writes made; inspect the deterministic demo IDs before retrying.');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  for (const [model, docs] of plan) {
    if (existingCounts.get(model.modelName) === docs.length) {
      if (model === User) {
        await model.updateMany(
          { _id: { $in: docs.map(user => user._id) } },
          { $set: { password: passwordHash, status: 'active', emailVerified: true } },
        );
        console.log(`Updated passwords for ${docs.length} ${model.collection.name}`);
      }
      continue;
    }
    if (model === User) {
      await model.insertMany(docs.map(user => ({ ...user, password: passwordHash })), { ordered: true });
    } else await model.insertMany(docs, { ordered: true });
    console.log(`Inserted ${docs.length} ${model.collection.name}`);
  }
  console.log(`Demo data ready in ${dbName}. Password: the value of DEMO_SEED_PASSWORD. Accounts are listed in backend/DEMO_DATA.md.`);
} finally {
  await mongoose.disconnect();
}
