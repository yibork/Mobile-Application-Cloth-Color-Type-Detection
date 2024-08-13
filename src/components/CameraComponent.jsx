import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { ReactMediaRecorder } from 'react-media-recorder';
import { loadModel, predictImage } from './modelService';
import { checkPermissions, getVideoDevices } from './mediaService';
import { uploadFeedback } from './feedbackService';
import { playAudioFile, dataURLtoFile } from './audioService';

const classNames = [
  "black_dress", "black_pants", "black_shirt", "black_shoes",
  "black_shorts", "blue_dress", "blue_pants", "blue_shirts",
  "blue_shorts", "red_dress", "red_pants", "red_shoes",
  "white_dress", "white_pants"
];

const CameraComponent = () => {
  const webcamRef = useRef(null);
  const [model, setModel] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const mediaRecorderRef = useRef(null);
  const [className, setClassName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    loadModel().then(setModel).catch(console.error);
  }, []);

  useEffect(() => {
    checkPermissions()
      .then(getVideoDevices)
      .then(setDevices)
      .catch(console.error);
  }, []);

  const retryCachedUploads = useCallback(async () => {
    const cachedUploads = JSON.parse(localStorage.getItem('cachedUploads')) || [];
    if (cachedUploads.length === 0) return;

    const newCachedUploads = [];

    for (const { imageSrc, imageFileName, audioFile, className, uniqueId } of cachedUploads) {
      const formData = new FormData();
      formData.append('image', dataURLtoFile(imageSrc, imageFileName));

      const audioBlob = await fetch(audioFile).then(r => r.blob());
      formData.append('audio', audioBlob, `${className}.${uniqueId}.mp3`);

      try {
        await uploadFeedback(formData);
      } catch (error) {
        newCachedUploads.push({ imageSrc, imageFileName, audioFile, className, uniqueId });
      }
    }

    localStorage.setItem('cachedUploads', JSON.stringify(newCachedUploads));
  }, []);

  useEffect(() => {
    retryCachedUploads();
  }, [retryCachedUploads]);

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setImageSrc(imageSrc);
        if (model) {
          predictImage(model, imageSrc, classNames)
            .then(predictedClass => {
              setClassName(predictedClass);
              playAudioFile(predictedClass);
              startRecordingFeedback(predictedClass);
            })
            .catch(console.error);
        }
      } else {
        console.error("Failed to capture image. ImageSrc is null.");
      }
    }
  };

  const handleFeedbackSubmit = async (blobUrl, className) => {
    const uniqueId = Math.random().toString(36).substr(2, 9);
    const imageFileName = `${className}.${uniqueId}.jpg`;

    if (!imageSrc) {
      console.error("No image captured. ImageSrc is null.");
      return;
    }

    const formData = new FormData();
    formData.append('image', dataURLtoFile(imageSrc, imageFileName));

    const audioFile = await fetch(blobUrl).then(r => r.blob());
    const mimeType = audioFile.type;
    const audioExtension = mimeType.split('/')[1];
    const audioFileName = `${className}.${uniqueId}.${audioExtension}`;
    formData.append('audio', audioFile, audioFileName);

    try {
      await uploadFeedback(formData);
    } catch (error) {
      cacheFailedUpload({ imageSrc, imageFileName, audioFile, className, uniqueId });
    }
  };

  const startRecordingFeedback = (className) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.startRecording) {
      mediaRecorderRef.current.startRecording();
      setTimeout(() => {
        if (mediaRecorderRef.current.stopRecording) {
          mediaRecorderRef.current.stopRecording();
        }
      }, 20000);
    }
  };

  const cacheFailedUpload = ({ imageSrc, imageFileName, audioFile, className, uniqueId }) => {
    const reader = new FileReader();
    reader.onload = () => {
      const cachedUploads = JSON.parse(localStorage.getItem('cachedUploads')) || [];
      cachedUploads.push({
        imageSrc,
        imageFileName,
        audioFile: reader.result,
        className,
        uniqueId,
      });
      localStorage.setItem('cachedUploads', JSON.stringify(cachedUploads));
    };
    reader.readAsDataURL(audioFile);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        retryCachedUploads();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [retryCachedUploads]);

  return (
    <div className="w-full max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-center">Clothing Item Detector</h1>
      <p className="mb-6 text-gray-700 text-center">
        This application uses your device's camera to detect and classify clothing items.
        The identified item will be announced via audio description.
      </p>
      <div className="mb-4">
        <label htmlFor="cameraSelect" className="block text-sm font-medium text-gray-700">
          Choose Camera
        </label>
        <select
          id="cameraSelect"
          onChange={(e) => setDeviceId(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          {devices.map((device, index) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ deviceId }}
          className="rounded-lg shadow-md w-full"
          aria-label="Webcam view"
        />
      </div>
      <div className="flex flex-col space-y-4">
        <button
          onClick={capture}
          className="bg-blue-600 text-white py-2 px-4 rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Capture Photo"
        >
          Capture Photo
        </button>
        {className && (
          <p className="text-lg text-center text-gray-800">
            Detected Item: <strong>{className.replace('_', ' ')}</strong>
          </p>
        )}
      </div>
      <ReactMediaRecorder
        audio
        render={({ startRecording, stopRecording }) => {
          mediaRecorderRef.current = { startRecording, stopRecording };
          return null;
        }}
        onStop={(blobUrl) => {
          if (imageSrc && className) {
            handleFeedbackSubmit(blobUrl, className);
          }
        }}
      />
    </div>
  );
};

export default CameraComponent;
