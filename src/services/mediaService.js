export const checkPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (error) {
      console.error('Access denied for camera:', error);
      throw error;
    }
  };
  
  export const getVideoDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  };
  