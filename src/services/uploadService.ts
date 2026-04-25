import { api } from './api';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

export const uploadFile = async (fileUri: string, mimeType: string) => {
    const formData = new FormData();
    let filename = fileUri.split('/').pop() || 'upload.bin';
    filename = decodeURIComponent(filename); // Decode URI encoding like %20 to spaces

    if (!filename.includes('.')) {
        if (mimeType.includes('image')) filename += '.jpg';
        else if (mimeType.includes('audio')) filename += '.m4a';
        else if (mimeType.includes('video')) filename += '.mp4';
        else if (mimeType.includes('pdf')) filename += '.pdf';
        else filename += '.bin';
    }

    // React Native requires this specific object structure for sending files
    formData.append('file', {
        uri: fileUri,
        name: filename,
        type: mimeType // e.g., 'image/jpeg'
    } as any);

    try {
        const token = await SecureStore.getItemAsync('userToken');
        const headers: Record<string, string> = {
            // DO NOT set Content-Type explicitly; fetch handles the multipart boundary automatically
            'Accept': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data.url; // Returns the uploaded file URL
    } catch (error) {
        console.error('Upload failed', error);
        throw error;
    }
};
