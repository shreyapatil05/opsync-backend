import Rule from '../models/Rule.js';
import User from '../models/User.js';
import Project from '../models/Project.js';
import cron from 'node-cron';
import vm from 'vm';
import Task from '../models/Task.js';
import nodemailer from 'nodemailer'; 


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,   
        pass: process.env.EMAIL_PASS    
    }
});


const sendNotification = async (recipientEmail, subject, bodyMessage) => {
    try {
        await transporter.sendMail({
            from: `"OpSync Automation" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `[AUTOMATION ALERT] ${subject}`,
            html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h3 style="color: #6366f1;">Action Triggered: ${subject}</h3>
                    <p>${bodyMessage}</p>
                    <p style="margin-top: 20px; font-size: 0.9em; color: #6b7280;">Please log into OpSync to view the task details.</p>
                   </div>`,
        });
       
    } catch (error) {
        console.error("Nodemailer Error: Failed to send email:", error.message);
    }
};


const executeRuleAction = async (rule, task) => {
    try {
        let recipient = null;
        let message = '';
        let subject = '';
        const projectId = task.projectId || rule.projectId;
        const project = await Project.findById(projectId);
        
        if (!project) {
            console.warn(`[Automation] Project ${projectId} not found for rule ${rule._id}. Skipping action.`);
            return;
        }

        switch (rule.action) {
            
            case 'notify_manager':
              
                if (task.assignee) {
                    recipient = await User.findById(task.assignee);
                    subject = `Task Overdue: ${task.title}`;
                    message = `Task **"${task.title}"** in project **"${project.name}"** is **overdue** and requires your immediate attention.`;
                } else {
                    
                    recipient = await User.findById(rule.createdBy);
                    subject = `Unassigned Task Overdue: ${task.title}`;
                    message = `Rule triggered (no assignee): Task **"${task.title}"** in project **"${project.name}"** is overdue and currently **unassigned**. Please assign it!`;
                }
                break;
                
            case 'send_report':
                recipient = await User.findById(rule.createdBy);
                subject = `Project Completion Report Triggered`;
                message = `Action triggered: Sending detailed completion report for project **${project.name}**.`;
                break;

            case 'escalate_senior':
                recipient = await User.findById(rule.createdBy);
                subject = `URGENT ESCALATION: ${task.title}`;
                message = `Action triggered: **URGENT ESCALATION** required for project **${project.name}**. Task: ${task.title}.`;
                break;

            default:
                console.warn(`[Automation] Unknown action: ${rule.action}`);
                return;
        }

        if (recipient) {
            
            await sendNotification(recipient.email, subject, message);
        } else {
            console.warn(`[Automation] Action failed for rule ${rule._id}: Recipient not found.`);
        }

    } catch (error) {
        console.error(`Error executing action for rule ${rule._id}:`, error.message);
    }
};

export const triggerRules = async (task) => {
    const rules = await Rule.find({ projectId: task.projectId, isActive: true });
    
    for (const rule of rules) {
        try {
            const context = { task: task.toObject() };
            const script = new vm.Script(rule.condition);
            const result = script.runInContext(vm.createContext(context));
            
            if (result) {
                console.log(`[Automation] Executing rule: ${rule.action} for task ${task._id}`);
                await executeRuleAction(rule, task); 
            }
        } catch (error) {
            console.error(`Error evaluating rule ${rule._id}:`, error.message);
        }
    }
};


const runOverdueCheck = async () => {
    console.log('[CRON] Running scheduled/initial check for overdue tasks...');
    
    const overdueTasks = await Task.find({ status: { $ne: 'done' }, dueDate: { $lt: new Date() } });
    
    for (const task of overdueTasks) {
        await triggerRules(task); 
    }
    console.log(`[CRON] Rule check complete. ${overdueTasks.length} tasks processed.`);
};


cron.schedule('0 9 * * *', async () => {
    await runOverdueCheck();
});


(async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await runOverdueCheck();
})();
