import express from 'express';
import * as teamController from '../controllers/teamController.js';
import auth from '../middlewares/auth.js';
import { validateObjectIdParam } from '../middlewares/validation.js';
import { teamCreateValidation, teamMemberValidation, teamUpdateValidation } from '../validators/index.js';

const router = express.Router();
for (const name of ['id', 'userId']) router.param(name, validateObjectIdParam);

router.get('/', auth, teamController.getUserTeams);
router.post('/', auth, teamCreateValidation, teamController.createTeam);
router.get('/:id', auth, teamController.getTeam);
router.put('/:id', auth, teamUpdateValidation, teamController.updateTeam);
router.delete('/:id', auth, teamController.deleteTeam);
router.get('/:id/members', auth, teamController.getTeamMembers);
router.post('/:id/members', auth, teamMemberValidation, teamController.addTeamMember);
router.delete('/:id/members/:userId', auth, teamController.removeTeamMember);


export default router;
