import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import axios from 'axios';
import { ReactMediaRecorder } from 'react-media-recorder';

const classNames = [
  "black_dress",
  "black_pants",
  "black_shirt",
  "black_shoes",
  "black_shorts",
  "blue_dress",
  "blue_pants",
  "blue_shirts",
  "blue_shorts",
  "red_dress",
  "red_pants",
  "red_shoes",
  "white_dress",
  "white_pants"
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
    const loadModel = async () => {
      try {
        const loadedModel = await tf.loadLayersModel('model.json');
        setModel(loadedModel);
      } catch (error) {
        console.error("Failed to load model:", error);
      }
    };
    loadModel();
  }, []);
  useEffect(() => {
    async function checkPermissions() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        getVideoDevices(); // Call to load cameras after permissions are granted
      } catch (error) {
        console.error('Access denied for camera:', error);
      }
    }
    checkPermissions();
  }, []);
  
  const getVideoDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !deviceId) {
        setDeviceId(videoDevices[0].deviceId); // Set default camera if not already set
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };
  

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
        await axios.post('http://localhost:8000/upload_feedback/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } catch (error) {
        console.error('Error uploading cached feedback:', error);
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
          predict(imageSrc);
        }
      } else {
        console.error("Failed to capture image. ImageSrc is null.");
      }
    }
  };

  const predict = async (imageSrc) => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = async () => {
      const tensor = tf.browser.fromPixels(img).resizeBilinear([224, 224]).expandDims(0).toFloat().div(255);
      const prediction = await model.predict(tensor).data();
      const predictionArray = Array.from(prediction);
      const maxIndex = predictionArray.indexOf(Math.max(...predictionArray));
      const predictedClass = classNames[maxIndex];
      setClassName(predictedClass);
      playAudioFile(predictedClass);
      startRecordingFeedback(predictedClass);
    };
  };

  const playAudioFile = (className) => {
    const audioFile = `/voice_predictions/${className}.mp3`;
    fetch(audioFile)
      .then(response => {
        if (!response.ok) {
          throw new Error('Audio file is corrupted or does not exist.');
        }
        return response.blob();
      })
      .then(blob => {
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play().catch(error => {
          console.error("Error playing audio:", error);
        });
      })
      .catch(error => {
        console.error("Failed to load audio file:", error);
      });
  };

  const handleFeedbackSubmit = async (blobUrl, className) => {
    const uniqueId = Math.random().toString(36).substr(2, 9);
    const imageFileName = `${className}.${uniqueId}.jpg`;

    // Check if imageSrc is not null before proceeding
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
      await axios.post('http://localhost:8000/upload_feedback/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (error) {
      console.error('Error uploading feedback:', error);
      cacheFailedUpload({ imageSrc, imageFileName, audioFile, className, uniqueId });
    }
  };

  const dataURLtoFile = (dataurl, filename) => {
    if (!dataurl) {
      throw new Error("Data URL is null");
    }
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
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
