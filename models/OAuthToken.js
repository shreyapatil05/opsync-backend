import mongoose from 'mongoose';

const oauthTokenSchema = new mongoose.Schema({
  service: { 
    type: String, 
    default: 'gmail',
    unique: true 
  },
  accessToken: String,
  refreshToken: String,
  expiryDate: Number,
  scope: String,
  tokenType: String
}, { 
  timestamps: true 
});

export default mongoose.model('OAuthToken', oauthTokenSchema);