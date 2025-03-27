// src/components/MagicMirror/modelProcessing.js
import * as tf from '@tensorflow/tfjs';

/**
 * Loads a TensorFlow.js model from the specified path.
 * @returns {Promise<Object|null>} The loaded model, or null if an error occurs.
 */
export const loadModel = async () => {
  try {
    // Adjust the path to your model.json location (placed in /public/model/)
    const model = await tf.loadGraphModel('/model/model.json');
    console.log('Model loaded successfully');
    return model;
  } catch (err) {
    console.error('Error loading model:', err);
    return null;
  }
};

/**
 * Captures a frame from the video element and processes it for inference.
 * @param {Object} videoRef - A ref to the video element.
 * @param {Object} model - The loaded TensorFlow.js model.
 * @returns {Promise<number|null>} The predicted score or null if processing fails.
 */
export const captureAndProcess = async (videoRef, model) => {
  const video = videoRef.current;
  if (!video || video.videoWidth === 0) {
    console.error('Video element not ready');
    return null;
  }
  // Create a canvas to capture the current frame.
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert the image to a tensor.
  let imgTensor = tf.browser.fromPixels(canvas);
  // Resize to the model's expected input size (e.g., 224x224).
  const resized = tf.image.resizeBilinear(imgTensor, [224, 224]);
  // Normalize the image if needed and add a batch dimension.
  const normalized = resized.div(255.0).expandDims(0);

  // Run inference.
  const prediction = await model.predict(normalized);
  // Assume the model outputs a single scalar value (beauty score between 0 and 1).
  const score = (await prediction.data())[0];
  return score;
};
