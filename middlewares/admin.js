const admin = (req, res, next)=>{
    if(req.user.role !== 'Admin'){
        return res.status(403).json({
            error: 'Admin access required'
        })
    }
    next()
}
export default admin