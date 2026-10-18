import nodemailer from 'nodemailer';
import Rule from '../models/Rule.js';
import Task from '../models/Task.js';
import { logger } from '../utils/logger.js';
import { evaluateRuleCondition } from './ruleEvaluator.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const sendNotification = async (recipientEmail, subject, message) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('automation_email_not_configured');
    return;
  }
  await transporter.sendMail({
    from: `"OpSync Automation" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `[AUTOMATION ALERT] ${subject}`,
    html: `<div><h3>${escapeHtml(subject)}</h3><p>${escapeHtml(message)}</p></div>`,
  });
};

const notificationFor = (rule, task) => {
  const projectName = task.projectId?.name || 'Unknown project';
  if (rule.action === 'notify_manager') {
    return { recipient: task.assignee || rule.createdBy, subject: `Task Overdue: ${task.title}`, message: `${task.title} in ${projectName} is overdue.` };
  }
  if (rule.action === 'send_report') {
    return { recipient: rule.createdBy, subject: 'Project Completion Report Triggered', message: `A report was requested for ${projectName}.` };
  }
  if (rule.action === 'escalate_senior') {
    return { recipient: rule.createdBy, subject: `Urgent escalation: ${task.title}`, message: `${task.title} in ${projectName} requires attention.` };
  }
  return null;
};

export const triggerRules = async (task) => {
  const rules = await Rule.find({ projectId: task.projectId?._id || task.projectId, isActive: true })
    .populate('createdBy', 'email')
    .lean();

  for (const rule of rules) {
    try {
      const matches = evaluateRuleCondition(rule.condition, task);
      const notification = matches ? notificationFor(rule, task) : null;
      if (notification?.recipient?.email) {
        await sendNotification(notification.recipient.email, notification.subject, notification.message);
      }
    } catch (error) {
      logger.error('automation_rule_failed', { ruleId: rule._id, errorMessage: error.message });
    }
  }
};

export const runOverdueCheck = async () => {
  const overdueTasks = await Task.find({
    status: { $in: ['todo', 'in-progress'] },
    dueDate: { $lt: new Date() },
  })
    .populate('projectId', 'name')
    .populate('assignee', 'email')
    .lean();

  for (const task of overdueTasks) await triggerRules(task);
  logger.info('automation_overdue_check_complete', { processed: overdueTasks.length });
  return overdueTasks.length;
};
