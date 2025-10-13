import mongoose from "mongoose";
import bcrypt from 'bcryptjs'


const userSchema = new mongoose.Schema({
    name:{
        type: String, 
        required: true, 
        trim: true
    },
    email:{
        type: String,
        required: true,
        unique: true,
        lowerCase: true
    },
    password:{
        type: String,
        required: true,
        minlength: 6
    },
    role:{
        type: String,
        enum: ['Admin', 'Manager', 'Employee'],
        default: 'Employee'
    },
    teamId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
     isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    createdAt:{
        type: Date,
        default: Date.now
    },
     phone: {
        type: String,
        default: ""
    },
    avatar: {
        type: String,
        default: ""
    },
    bio: {
        type: String,
        default: "",
        maxlength: 500
    },
    location: {
        type: String,
        default: ""
    },
    lastLogin: {
        type: Date
    }

});

userSchema.pre('save', async function(next){
    if(!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password)
}

export default mongoose.model('User', userSchema)