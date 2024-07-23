import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import axios from 'axios';
import JSZip from 'jszip';
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
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');

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
    const getDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setDeviceId(videoDevices[0].deviceId);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    // Retry uploading cached data on page load
    retryCachedUploads();
  }, []);

  const handleDeviceChange = (event) => {
    setDeviceId(event.target.value);
  };

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setImageSrc(imageSrc);
      if (model) {
        predict(imageSrc);
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
      const uniqueId = generateUniqueId();
      playAudioFile(predictedClass);
      startRecordingFeedback(predictedClass, uniqueId);
    };
  };

  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
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
        setTimeout(() => {
          audio.pause();
        }, 20000); 
      })
      .catch(error => {
        console.error("Failed to load audio file:", error);
      });
  };

  const handleFeedbackSubmit = async (blobUrl, className, uniqueId) => {
    const imageFileName = `${className}.${uniqueId}.jpg`;
    const formData = new FormData();
    formData.append('image', dataURLtoFile(imageSrc, imageFileName));
  
    const audioFile = await fetch(blobUrl).then(r => r.blob());
    const mimeType = audioFile.type;
  
    let audioExtension;

    switch (mimeType) {
      
      case 'audio/mpeg':
        audioExtension = 'mp3';
        break;
      case 'audio/wav':
        audioExtension = 'wav';
        break;
      case 'audio/ogg':
        audioExtension = 'ogg';
        break;
      default:
        console.error('Unsupported audio format:', mimeType);
        return;
    }
  
    const audioFileName = `${className}.${uniqueId}.${audioExtension}`;
    formData.append('audio', audioFile, audioFileName);

    try {
      const response = await axios.post('http://localhost:8000/upload_feedback/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log(response.data);
    } catch (error) {
      console.error('Error uploading feedback:', error);
      // Cache the failed upload
      cacheFailedUpload({ imageSrc, imageFileName, audioFile: audioFile, className, uniqueId });
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

  const startRecordingFeedback = (className, uniqueId) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.startRecording) {
      mediaRecorderRef.current.startRecording();
      setTimeout(() => {
        if (mediaRecorderRef.current.stopRecording) {
          mediaRecorderRef.current.stopRecording();
        }
      }, 20000); // Automatically stop recording after 20 seconds
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

  const retryCachedUploads = async () => {
    const cachedUploads = JSON.parse(localStorage.getItem('cachedUploads')) || [];
    if (cachedUploads.length === 0) return;

    const newCachedUploads = [];

    for (const { imageSrc, imageFileName, audioFile, className, uniqueId } of cachedUploads) {
      const formData = new FormData();
      formData.append('image', dataURLtoFile(imageSrc, imageFileName));

      const audioBlob = await fetch(audioFile).then(r => r.blob());
      formData.append('audio', audioBlob, `${className}.${uniqueId}.mp3`);

      try {
        const response = await axios.post('http://localhost:8000/upload_feedback/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        console.log('Cached upload success:', response.data);
      } catch (error) {
        console.error('Error uploading cached feedback:', error);
        newCachedUploads.push({ imageSrc, imageFileName, audioFile, className, uniqueId });
      }
    }

    localStorage.setItem('cachedUploads', JSON.stringify(newCachedUploads));
  };

  useEffect(() => {
    // Check internet connection and retry cached uploads every minute
    const interval = setInterval(() => {
      if (navigator.onLine) {
        retryCachedUploads();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const updateModel = async () => {
    try {
      const response = await axios.get('http://localhost:8000/download-model', { responseType: 'blob' });
      const zip = await JSZip.loadAsync(response.data);
      const publicDir = '/public/';

      const updateFile = async (fileName) => {
        const fileData = await zip.file(fileName).async('blob');
        const fileUrl = window.URL.createObjectURL(fileData);
        const link = document.createElement('a');
        link.href = fileUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      };

      await updateFile('model.json');
      await updateFile('group1-shard1of1.bin');

      alert('Model updated successfully.');
    } catch (error) {
      console.error('Error downloading model:', error);
      alert('Failed to update model.');
    }
  };

  return (
    <div className="w-full max-w-xs flex flex-col items-center">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ deviceId }}
        className="rounded-lg shadow-md mb-4"
      />
      <div className="flex flex-col space-y-2 w-full">
        <button
          onClick={capture}
          className="bg-green-500 text-white py-2 px-4 rounded shadow hover:bg-green-600"
        >
          Capture Photo
        </button>
        <select
          className="bg-gray-200 text-black py-2 px-4 rounded shadow"
          value={deviceId}
          onChange={handleDeviceChange}
        >
          {devices.map((device, index) => (
            <option key={index} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
        <button
          onClick={updateModel}
          className="bg-blue-500 text-white py-2 px-4 rounded shadow hover:bg-blue-600 mt-4"
        >
          Update Model
        </button>
      </div>
      <ReactMediaRecorder
        audio
        render={({ startRecording, stopRecording }) => {
          // Store the start and stop recording functions in the ref
          mediaRecorderRef.current = { startRecording, stopRecording };
          return <div><audio controls /></div>;
        }}
        onStop={(blobUrl) => {
          if (imageSrc && className) {
            const uniqueId = generateUniqueId();
            handleFeedbackSubmit(blobUrl, className, uniqueId);
          }
        }}
      />
    </div>
  );
};

export default CameraComponent;
