const sameId = (left, right) => Boolean(left && right && left.toString() === right.toString());

export const canReadTeam = (team, user) => user.role === 'Admin'
  || sameId(team?.admin, user.id)
  || team?.members?.some(member => sameId(member?._id || member, user.id));

export const canManageTeam = (team, user) => user.role === 'Admin' && sameId(team?.admin, user.id);
