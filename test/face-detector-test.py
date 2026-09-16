import unittest,sys,pathlib,cv2
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'src'))
from face_detector import FaceDetector,single_face
class FaceChecks(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cv2.setNumThreads(1);cls.detector=FaceDetector();cls.root=pathlib.Path(__file__).parent/'fixtures/framing'
 def test_jacket_folds_are_not_extra_faces(self):
  for name in ['jacket-1.jpg','jacket-2.jpg']:
   image=cv2.imread(str(self.root/name));faces=self.detector.detect(image)
   self.assertEqual(len(faces),1,name);self.assertGreater(faces[0]['confidence'],.85)
   self.assertIsNotNone(single_face(self.detector,image,347,25))
 def test_two_people_in_even_one_frame_are_rejected(self):
  image=cv2.imread(str(self.root/'two-people.jpg'))
  self.assertEqual(len(self.detector.detect(image)),2)
  with self.assertRaisesRegex(ValueError,r'2 faces detected.*frame 10'):
   single_face(self.detector,image,10,25)
 def test_blank_frame_does_not_invent_a_face(self):
  import numpy as np
  self.assertEqual(self.detector.detect(np.zeros((405,720,3),dtype=np.uint8)),[])
if __name__=='__main__':unittest.main()
