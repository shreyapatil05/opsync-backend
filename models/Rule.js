import mongoose from "mongoose";

const ruleSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
   condition:{ 
        type: String,
        required: true
    },
    action:{
        type: String,
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true 
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive:{
        type: Boolean,
        default: true
    },
}, { timestamps: true }); 

export default mongoose.model('Rule', ruleSchema);
