import express from 'express';
import * as teamController from '../controllers/teamController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

router.get('/', auth, teamController.getUserTeams);
router.post('/', auth, teamController.createTeam);
router.get('/:id', auth, teamController.getTeam);
router.put('/:id', auth, teamController.updateTeam); 
router.delete('/:id', auth, teamController.deleteTeam);
router.get('/:id/members', auth, teamController.getTeamMembers);
router.post('/:id/members', auth, teamController.addTeamMember);
router.delete('/:id/members/:userId', auth, teamController.removeTeamMember);


export default router;
