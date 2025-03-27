# backend/model.py

import numpy as np
from io import BytesIO
from PIL import Image
import cv2
import onnxruntime as ort
import asyncio
from scrfd_detector import SCRFDDetector  # This file contains the updated detect() method

# Initialize GenderAge ONNX session.
try:
    ga_session = ort.InferenceSession("models/genderage.onnx")
    print("GenderAge model loaded successfully.")
except Exception as e:
    ga_session = None
    print("Error loading GenderAge model:", e)

def predict_age_gender(face_bgr: np.ndarray):
    """
    Runs inference using the GenderAge ONNX model.
    This version resizes the face to 96x96 and converts it to channels-first order,
    so that the final tensor shape is (1, 3, 96, 96), which the model expects.
    Assumes the model outputs an array of shape (1, 2): [predicted_age, male_prob].
    """
    if not ga_session:
        return None, None
    try:
        # Resize the face to 96x96
        face_resized = cv2.resize(face_bgr, (96, 96))
        # Normalize pixel values to [0, 1]
        face_resized = face_resized.astype(np.float32) / 255.0
        # Convert from channels-last (96, 96, 3) to channels-first (3, 96, 96)
        face_transposed = np.transpose(face_resized, (2, 0, 1))
        # Expand dims to add batch dimension: (1, 3, 96, 96)
        input_tensor = np.expand_dims(face_transposed, axis=0)
        
        # Run inference with the model
        input_name = ga_session.get_inputs()[0].name
        outputs = ga_session.run(None, {input_name: input_tensor})
        
        # Assuming outputs[0] is of shape (1,2): [predicted_age, male_prob]
        pred = outputs[0][0]
        predicted_age = float(pred[0])
        predicted_gender = float(pred[1])
        return predicted_age, predicted_gender
    except Exception as e:
        print("Error in predict_age_gender:", e)
        return None, None


# Initialize SCRFD Detector once.
scrfd = SCRFDDetector(
    model_path="models/det_10g.onnx",
    input_size=(640,640),
    conf_thres=0.5,
    iou_thres=0.4
)

async def process_image_async(image_bytes: bytes) -> float:
    """
    Asynchronous pipeline:
      1. Convert image bytes to a BGR image.
      2. Use SCRFDDetector to detect faces.
      3. Pick the best detection and crop the face.
      4. Run GenderAge inference on the cropped face.
      5. Compute a beauty score based on predicted age.
    Returns a beauty score (0 to 1).
    """
    try:
        # Convert image bytes to PIL image (RGB) and then to BGR.
        pil_img = Image.open(BytesIO(image_bytes)).convert("RGB")
        bgr_img = np.array(pil_img)[:, :, ::-1]
        
        # Detect faces using SCRFDDetector.
        detections = scrfd.detect(bgr_img)  # Expected shape (N,5)
        if detections.shape[0] == 0:
            print("No face detected.")
            return None
        
        # Choose the best detection (highest score).
        best = detections[0]
        x1, y1, x2, y2, score = best
        if score < 0.5:
            return None
        
        # Crop the face from the original image.
        face_pil = pil_img.crop((x1, y1, x2, y2))
        face_bgr = np.array(face_pil)[:, :, ::-1]
        
        # Run GenderAge inference.
        predicted_age, predicted_gender = predict_age_gender(face_bgr)
        if predicted_age is None:
            return None
        
        # Compute beauty score (ideal age = 27).
        ideal_age = 27.0
        diff = abs(predicted_age - ideal_age)
        beauty_score = max(0, 1 - (diff / ideal_age))
        return beauty_score
    except Exception as e:
        print("Error in process_image_async:", e)
        return None
