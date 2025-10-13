import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    name:{
        type:String,
        required: true
    },
    path:{
        type:String,
        required: true
    },
    url: { 
        type: String,
        required: true
    },
    size:{
        type:Number
    },
    mimeType:{
        type: String
    },
    uploader:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    projectId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    createdAt:{
        type: Date,
        default:Date.now
    }

})
export default mongoose.model('File', fileSchema)