import { api } from './api';

export const uploadFile = async (fileUri: string, mimeType: string) => {
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'upload.jpg';

    // React Native requires this specific object structure for sending files
    formData.append('file', {
        uri: fileUri,
        name: filename,
        type: mimeType // e.g., 'image/jpeg'
    } as any);

    try {
        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.url; // Returns the uploaded file URL
    } catch (error) {
        console.error('Upload failed', error);
        throw error;
    }
};
