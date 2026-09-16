"""Local face locations only. No identity or gender inference."""
import pathlib, hashlib, json
import cv2

VERSION = 'yunet-2023mar-1'

class FaceDetector:
 def __init__(self):
  root=pathlib.Path(__file__).resolve().parents[1]/'assets/face-detection'
  model=root/'face_detection_yunet_2023mar.onnx'
  provenance=json.loads((root/'provenance.json').read_text())
  if hashlib.sha256(model.read_bytes()).hexdigest()!=provenance['sha256']:
   raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: bundled face model failed its integrity check.')
  self.detector=cv2.FaceDetectorYN.create(str(model),'',(720,405),0.85,0.3,5000)

 def detect(self,frame):
  scale=min(1,720/frame.shape[1]);small=cv2.resize(frame,None,fx=scale,fy=scale)
  self.detector.setInputSize((small.shape[1],small.shape[0]))
  _,found=self.detector.detect(small)
  if found is None:return []
  return [{'box':[float(v/scale) for v in row[:4]],'confidence':float(row[-1])} for row in found]

def single_face(detector,frame,number,fps):
 found=detector.detect(frame)
 if len(found)>1:
  raise ValueError(f'SOURCE_FRAMING_INCOMPATIBLE: {len(found)} faces detected by {VERSION} at frame {number} ({(number-1)/fps:.2f}s). Review this frame before a replacement.')
 return found[0]['box'] if found else None
