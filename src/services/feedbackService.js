import axios from 'axios';

const apiUrl = process.env.REACT_APP_DJANGO_API_URL || 'http://localhost:8000';

export const uploadFeedback = async (formData) => {
  try {
    await axios.post(`${apiUrl}/upload_feedback/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } catch (error) {
    console.error('Error uploading feedback:', error);
    throw error;
  }
};
