import Task from '../models/Task.js';
import Project from '../models/Project.js';

export const getEmployeeAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dateFrom, dateTo, projectId } = req.query;

    console.log('Analytics request for user:', userId);

    
    let taskQuery = { assignee: userId };

    if (dateFrom || dateTo) {
      taskQuery.createdAt = {};
      if (dateFrom) taskQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        taskQuery.createdAt.$lte = endDate;
      }
    }

    if (projectId && projectId !== 'all') {
      taskQuery.projectId = projectId;
    }

    console.log('Task query:', taskQuery);

    
    const tasks = await Task.find(taskQuery).populate('projectId', 'name').lean();

    console.log('Tasks found:', tasks.length);

    
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const todoTasks = tasks.filter(t => t.status === 'todo').length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    
    const overdueTasks = tasks.filter(t => 
      t.status !== 'done' && 
      t.dueDate && 
      new Date(t.dueDate) < new Date()
    ).length;

  
    const overdueByProject = {};
    tasks.forEach(task => {
      if (task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date()) {
        const projectName = task.projectId?.name || 'Unknown Project';
        overdueByProject[projectName] = (overdueByProject[projectName] || 0) + 1;
      }
    });

    
    const completedTasksWithTime = tasks.filter(t => t.status === 'done' && t.updatedAt);
    const avgCompletionTime = completedTasksWithTime.length > 0
      ? (completedTasksWithTime.reduce((sum, t) => {
          const diff = new Date(t.updatedAt) - new Date(t.createdAt);
          return sum + (diff / (1000 * 60 * 60 * 24));
        }, 0) / completedTasksWithTime.length).toFixed(1)
      : 0;

    
    const projectMap = {};
    tasks.forEach(task => {
      const projectName = task.projectId?.name || 'Unknown Project';
      if (!projectMap[projectName]) {
        projectMap[projectName] = {
          name: projectName,
          completed: 0,
          inProgress: 0,
          todo: 0,
          total: 0,
        };
      }
      projectMap[projectName].total += 1;
      if (task.status === 'done') projectMap[projectName].completed += 1;
      if (task.status === 'in-progress') projectMap[projectName].inProgress += 1;
      if (task.status === 'todo') projectMap[projectName].todo += 1;
    });

    const projectProgress = Object.values(projectMap);

    
    const taskCompletionByStatus = {
      completed: completedTasks,
      inProgress: inProgressTasks,
      todo: todoTasks,
    };

    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    
    const dailyCompletion = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyCompletion[dateStr] = 0;
    }

    completedTasksWithTime.forEach(task => {
      if (new Date(task.updatedAt) >= sevenDaysAgo) {
        const dateStr = new Date(task.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (dateStr in dailyCompletion) {
          dailyCompletion[dateStr] += 1;
        }
      }
    });

    const completionTrend = Object.entries(dailyCompletion).map(([date, count]) => ({
      date,
      completed: count,
    }));

    res.json({
      kpis: {
        completedTasks,
        inProgressTasks,
        todoTasks,
        completionRate,
        overdueTasks,
        avgCompletionTime,
      },
      projectProgress,
      taskCompletionByStatus,
      completionTrend,
      overdueByProject,
      summary: {
        totalTasks,
        dateRange: { from: dateFrom, to: dateTo },
      },
    });
  } catch (error) {
    console.error('Employee analytics error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getProjectsForEmployee = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('Fetching projects for user:', userId);

   
    const tasks = await Task.find({ assignee: userId }).distinct('projectId');

    console.log('Projects with tasks for user:', tasks.length);

   
    const projects = await Project.find({ _id: { $in: tasks } })
      .select('_id name')
      .lean();

    console.log('Projects found:', projects);

    res.json(projects);
  } catch (error) {
    console.error('Get projects for employee error:', error);
    res.status(500).json({ error: error.message });
  }
};