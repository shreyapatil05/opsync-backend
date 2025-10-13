import express from 'express'
import * as projectController from '../controllers/projectController.js'
import auth from '../middlewares/auth.js'

const router = express.Router();

router.get('/', auth, projectController.getProjects);
router.post('/', auth, projectController.createProject);
router.get('/:id', auth, projectController.getProject);
router.put('/:id', auth, projectController.updateProject);
router.delete('/:id', auth, projectController.deleteProject);
router.get('/:projectId/members', auth, projectController.getProjectMembers);

router.get('/:projectId/tasks', auth, projectController.getTasks);
router.post('/:projectId/tasks', auth, projectController.createTask);
router.put('/:projectId/tasks/:taskId', auth, projectController.updateTask);
router.delete('/:projectId/tasks/:taskId', auth, projectController.deleteTask);


router.get('/:projectId/employee-progress', auth, projectController.getEmployeeProgress);
router.get('/:projectId/all-employees-progress', auth, projectController.getAllEmployeesProgress);


router.post('/:projectId/employees', auth, projectController.addEmployeeToProject);
router.delete('/:projectId/employees/:userId', auth, projectController.removeEmployeeFromProject);

export default router;