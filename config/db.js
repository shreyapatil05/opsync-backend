import mongoose from "mongoose";

const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
        })
        console.log('MongoDB Connected')
    }
    catch (error){
        console.log('DB connection error:', error.message);
        process.exit(1);
    }
}

export default connectDB
