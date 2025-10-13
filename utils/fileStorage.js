import { v2 as cloudinary } from 'cloudinary';
import File from '../models/File.js';
import dotenv from 'dotenv';
import path from 'path'; 

dotenv.config({ path: path.resolve(process.cwd(), '.env') }); 



cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, 
});

export const uploadFile = async (file, projectId, uploaderId) => {
  try {
    console.log('Attempting to upload file:', file.originalname, 'for project:', projectId);
    console.log('File details:', {
      size: file.size,
      mimetype: file.mimetype,
      path: file.path, 
      buffer: file.buffer ? '[buffer exists]' : 'undefined', 
    });

    let result;

    // Determine if using disk storage (file.path) or memory storage (file.buffer)
    if (file.path) {
      
      result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder: `opsync/${projectId}`, 
        public_id: `${projectId}/${path.parse(file.originalname).name}-${Date.now()}`, 
      });
    } else if (file.buffer) {
     
      result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            folder: `opsync/${projectId}`,
            public_id: `${projectId}/${path.parse(file.originalname).name}-${Date.now()}`, 
          },
          async (error, res) => { 
            if (error) {
              console.error('Cloudinary upload stream error:', error);
              reject(new Error(`Cloudinary upload failed: ${error.message}`));
              return;
            }
            resolve(res);
          }
        );
        uploadStream.end(file.buffer);
      });
    } else {
      throw new Error('File has neither path nor buffer, cannot upload.');
    }

    // After successful Cloudinary upload, save record to MongoDB
    console.log('Cloudinary upload successful. Result:', result);
    
    const fileRecord = new File({
      name: file.originalname,
      path: result.public_id, // Store Cloudinary's public_id
      url: result.secure_url,  // Store Cloudinary's secure URL for direct access
      size: file.size,
      mimeType: file.mimetype,
      projectId,
      uploader: uploaderId,
    });
    
    await fileRecord.save(); // <--- CRITICAL: Save the document
    console.log('File record saved to DB:', fileRecord._id);
    
    return fileRecord; // Return the full database record
  } catch (error) {
    console.error('Final upload process failed (Cloudinary or DB save):', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};


export const downloadFile = async (publicId) => {
  try {
    
    const url = cloudinary.url(publicId, { secure: true }); 
    return { url };
  } catch (error) {
    console.error('Download file URL generation failed:', error);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
};

export const deleteFile = async (publicId) => { 
  try {
    
    let cloudPublicId = publicId;
    
    if (publicId.startsWith('http')) {
     
      const matches = publicId.match(/\/v\d+\/([^\/]+)\/([^\/]+)\.([^\.]+)$/);
      if (matches && matches.length >= 3) {
        cloudPublicId = `${matches[1]}/${matches[2]}`; 
      } else {
        
        const urlParts = publicId.split('/');
        const versionIndex = urlParts.findIndex(part => part.startsWith('v'));
        if (versionIndex !== -1 && urlParts.length > versionIndex + 2) {
          cloudPublicId = urlParts.slice(versionIndex + 2).join('/').split('.')[0];
        } else {
           console.warn(`Could not reliably extract public_id from URL: ${publicId}. Attempting to use full path.`);
         
           cloudPublicId = publicId;
        }
      }
    }
    
    await cloudinary.uploader.destroy(cloudPublicId);
    console.log('File deleted from Cloudinary:', cloudPublicId);
  } catch (error) {
    console.error('Cloudinary delete failed:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }
};