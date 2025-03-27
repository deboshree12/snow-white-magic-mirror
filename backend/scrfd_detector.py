# backend/scrfd_detector.py

import cv2
import numpy as np
import onnxruntime

from typing import Tuple

def distance2kps(points, distance):
    """
    Decodes keypoint distances to keypoint coordinates.
    Assumes `distance` has shape (N, 10), corresponding to 5 keypoints (x,y) per anchor.
    """
    try:
        # Reshape distance to (N, 5, 2)
        distance_reshaped = distance.reshape((-1, 5, 2))
        # For each anchor point in `points` (shape: (N,2)), subtract the distances.
        # This gives keypoint coordinates with shape (N, 5, 2).
        kps = points[:, None, :] - distance_reshaped
        return kps.reshape((-1, 10))  # Or return as (N,5,2) if preferred
    except Exception as e:
        print("Error in distance2kps:", e)
        return None

# Helper functions from the “facial-analysis” repo.
def distance2bbox(points, distance):
    left = points[:,0] - distance[:,0]
    top = points[:,1] - distance[:,1]
    right = points[:,0] + distance[:,2]
    bottom = points[:,1] + distance[:,3]
    return np.stack([left, top, right, bottom], axis=-1)

def distance2bbox(points, distance):
    # If distance has an extra column, use only the first 4 values.
    if distance.shape[1] > 4:
        distance = distance[:, :4]
    left = points[:, 0] - distance[:, 0]
    top = points[:, 1] - distance[:, 1]
    right = points[:, 0] + distance[:, 2]
    bottom = points[:, 1] + distance[:, 3]
    return np.stack([left, top, right, bottom], axis=-1)

def nms(dets, iou_thres=0.4):
    x1 = dets[:, 0]
    y1 = dets[:, 1]
    x2 = dets[:, 2]
    y2 = dets[:, 3]
    scores = dets[:, 4]

    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1 + 1)
        h = np.maximum(0.0, yy2 - yy1 + 1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)

        inds = np.where(ovr <= iou_thres)[0]
        order = order[inds + 1]
    return keep

class SCRFDDetector:
    """
    A minimal re-implementation of the 'SCRFD' class from 'facial-analysis',
    handling multiple strides [8,16,32].
    """
    def __init__(self, model_path: str, input_size: Tuple[int,int]=(640,640), 
                 conf_thres: float=0.5, iou_thres: float=0.4):
        self.input_size = input_size
        self.conf_thres = conf_thres
        self.iou_thres  = iou_thres

        self.fmc = 3
        self._feat_stride_fpn = [8,16,32]
        self._num_anchors = 2
        self.use_kps = True

        self.mean = 127.5
        self.std  = 128.0
        self.center_cache = {}

        # Load ONNX
        self.session = onnxruntime.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.input_names  = [inp.name for inp in self.session.get_inputs()]
        self.output_names = [out.name for out in self.session.get_outputs()]

    def forward(self, blob):
        """Run inference and parse outputs for each stride."""
        outputs = self.session.run(self.output_names, {self.input_names[0]: blob})

        scores_list, bboxes_list, kpss_list = [], [], []
        input_height = blob.shape[2]
        input_width  = blob.shape[3]
        # self.fmc=3 => we have 3 strides, so the outputs are arranged:
        #   outputs[0..2] => conf scores
        #   outputs[3..5] => bbox preds
        #   outputs[6..8] => kps preds (if use_kps)

        for idx, stride in enumerate(self._feat_stride_fpn):
            score_blob = outputs[idx]          # shape => (N,1, H/stride, W/stride) or similar
            bbox_blob  = outputs[idx+self.fmc] # shape => (N,4, H/stride, W/stride)
            bbox_blob  = bbox_blob*stride
            if self.use_kps:
                kps_blob = outputs[idx+self.fmc*2]*stride

            height = input_height // stride
            width  = input_width  // stride

            key = (height, width, stride)
            if key in self.center_cache:
                anchor_centers = self.center_cache[key]
            else:
                # create anchor grid
                anchor_grid = np.stack(np.mgrid[:height, :width][::-1], axis=-1)
                anchor_grid = (anchor_grid * stride).reshape((-1,2))
                if self._num_anchors>1:
                    anchor_grid = np.stack([anchor_grid]*self._num_anchors, axis=1).reshape((-1,2))
                self.center_cache[key] = anchor_grid
                anchor_centers = anchor_grid

            # Flatten
            score_blob = score_blob.reshape((-1,))
            bbox_blob  = bbox_blob.reshape((-1,4))
            if self.use_kps:
                kps_blob = kps_blob.reshape((-1,10))

            pos_inds = np.where(score_blob>=self.conf_thres)[0]
            if len(pos_inds)==0:
                continue
            pos_scores = score_blob[pos_inds]
            pos_bboxes = distance2bbox(anchor_centers, bbox_blob)[pos_inds]
            scores_list.append(pos_scores)
            bboxes_list.append(pos_bboxes)
            if self.use_kps:
                kpss = distance2kps(anchor_centers, kps_blob)
                kpss = kpss.reshape((kpss.shape[0],5,2))
                pos_kpss = kpss[pos_inds]
                kpss_list.append(pos_kpss)

        return scores_list, bboxes_list, kpss_list

    def detect(self, bgr_image):
        """
            Full detection pipeline:
            1. Create a blob from the BGR image.
            2. Run forward() to get outputs for scores, bbox predictions, etc.
            3. Combine results and apply Non-Max Suppression (NMS).
            4. Return final detections of shape (M,5): [x1, y1, x2, y2, score]
        """
        # Create blob from image.
        blob = cv2.dnn.blobFromImage(
            bgr_image,
            scalefactor=1.0/self.std,
            size=self.input_size,
            mean=(self.mean, self.mean, self.mean),
            swapRB=True
        )
        scores_list, bboxes_list, kpss_list = self.forward(blob)
    
        if len(scores_list) == 0 or len(bboxes_list) == 0:
            return np.zeros((0,5), dtype=np.float32)
    
        # Concatenate all scores and boxes from different strides.
        scores = np.concatenate(scores_list, axis=0)  # Expected shape: (N,)
        bboxes = np.concatenate(bboxes_list, axis=0)    # May be (N,4) or (N,5)

        # If bboxes already has 5 columns, assume the 5th is the score.
        if bboxes.ndim == 2 and bboxes.shape[1] == 5:
            pre_det = bboxes
        else:
            # Otherwise, stack the scores as a new column.
            pre_det = np.hstack((bboxes, scores[:, None]))  # Result shape: (N,5)
    
        # Sort detections by score descending.
        order = pre_det[:, 4].argsort()[::-1]
        pre_det = pre_det[order, :]
        # Run Non-Max Suppression (nms) to filter overlapping boxes.
        keep = nms(pre_det, iou_thres=self.iou_thres)
        det = pre_det[keep, :]
        return det
