import mongoose from "mongoose";    

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true      
    },
    description: {
        type: String,
        trim: true
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
         default: []
    }],
    
    department: {
        type: String,
        trim: true
    },
    
    settings: {
        canMembersCreateProjects: {
            type: Boolean,
            default: true
        },
        canMembersInvite: {
            type: Boolean,
            default: false
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});


teamSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('Team', teamSchema);