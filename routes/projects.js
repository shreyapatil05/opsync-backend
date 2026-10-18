import express from 'express'
import * as projectController from '../controllers/projectController.js'
import auth from '../middlewares/auth.js'
import { validateObjectIdParam } from '../middlewares/validation.js'
import { projectCreateValidation, projectUpdateValidation, taskCreateValidation, taskUpdateValidation } from '../validators/index.js'

const router = express.Router();
for (const name of ['id', 'projectId', 'taskId', 'userId']) router.param(name, validateObjectIdParam);

router.get('/', auth, projectController.getProjects);
router.post('/', auth, projectCreateValidation, projectController.createProject);
router.get('/:id', auth, projectController.getProject);
router.put('/:id', auth, projectUpdateValidation, projectController.updateProject);
router.delete('/:id', auth, projectController.deleteProject);
router.get('/:projectId/members', auth, projectController.getProjectMembers);

router.get('/:projectId/tasks', auth, projectController.getTasks);
router.post('/:projectId/tasks', auth, taskCreateValidation, projectController.createTask);
router.put('/:projectId/tasks/:taskId', auth, taskUpdateValidation, projectController.updateTask);
router.delete('/:projectId/tasks/:taskId', auth, projectController.deleteTask);


router.get('/:projectId/employee-progress', auth, projectController.getEmployeeProgress);
router.get('/:projectId/all-employees-progress', auth, projectController.getAllEmployeesProgress);


router.post('/:projectId/employees', auth, projectController.addEmployeeToProject);
router.delete('/:projectId/employees/:userId', auth, projectController.removeEmployeeFromProject);

export default router;
