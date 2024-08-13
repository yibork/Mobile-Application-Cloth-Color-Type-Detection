import * as tf from '@tensorflow/tfjs';

export const loadModel = async () => {
  try {
    const model = await tf.loadLayersModel('model.json');
    return model;
  } catch (error) {
    console.error("Failed to load model:", error);
    throw error;
  }
};

export const predictImage = async (model, imageSrc, classNames) => {
  const img = new Image();
  img.src = imageSrc;
  return new Promise((resolve) => {
    img.onload = async () => {
      const tensor = tf.browser.fromPixels(img).resizeBilinear([224, 224]).expandDims(0).toFloat().div(255);
      const prediction = await model.predict(tensor).data();
      const predictionArray = Array.from(prediction);
      const maxIndex = predictionArray.indexOf(Math.max(...predictionArray));
      const predictedClass = classNames[maxIndex];
      resolve(predictedClass);
    };
  });
};
