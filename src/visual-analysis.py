"""Local face/crop and visible-text screening. Never identifies a person.

Automated geometry/OCR checks supplement Macy's required anatomical/visual review.
No images are sent to another provider and no models are downloaded at runtime.
"""
import json,sys,pathlib
import cv2
import numpy as np
from face_detector import FaceDetector,single_face,VERSION
cv2.setNumThreads(1)

def ocr_image(image,engine):
 if image.shape[2]==4:
  alpha=image[:,:,3:4]/255.0
  image=(image[:,:,:3]*alpha+255*(1-alpha)).astype(np.uint8)
 result,_=engine(image)
 return [str(r[1]) for r in (result or []) if float(r[2])>=0.55]

def main():
 action,path=sys.argv[1:3]
 from rapidocr_onnxruntime import RapidOCR
 engine=RapidOCR(intra_op_num_threads=1,inter_op_num_threads=1)
 if action=='logo':
  image=cv2.imread(path,cv2.IMREAD_UNCHANGED)
  if image is None:raise ValueError('MISSING_CLEAN_LOGO_ASSET: unreadable logo.')
  texts=ocr_image(image,engine)
  if image.shape[2]==4:
   ys,xs=np.where(image[:,:,3]>8)
   if not len(xs):raise ValueError('MISSING_CLEAN_LOGO_ASSET: empty logo.')
   image=image[ys.min():ys.max()+1,xs.min():xs.max()+1]
  cv2.imwrite(path,image)
  return {'texts':texts,'width':image.shape[1],'height':image.shape[0],'method':'local OCR; clean-logo identity and embedded-field review still required'}
 cap=cv2.VideoCapture(path)
 if not cap.isOpened():raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: unreadable video.')
 width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT));fps=cap.get(cv2.CAP_PROP_FPS)
 detector=FaceDetector()
 faces=[];bounds=[];texts=[];frames=0;misses=0
 while True:
  ok,frame=cap.read()
  if not ok:break
  frames+=1
  # Detect real textured scene extent, including non-black provider padding.
  # A naturally white wall is not itself a failure; the final crop must stay within source footage.
  if frames%max(1,round(fps))==1:
   variation=np.std(frame.astype(np.float32),axis=1).mean(axis=1)
   rows=np.where(variation>5)[0]
   if not len(rows):raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: no coherent scene found.')
   top,bottom=int(rows[0]),int(rows[-1]+1)
   variation=np.std(frame[top:bottom].astype(np.float32),axis=0).mean(axis=1)
   cols=np.where(variation>5)[0]
   if not len(cols):raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: no scene width found.')
   bounds.append([int(cols[0]),top,int(cols[-1]+1),bottom])
  # The learned detector avoids jacket-fold Haar false positives, while still
  # checking every frame and rejecting a second face even in a single frame.
  detected=single_face(detector,frame,frames,fps)
  if detected is not None:faces.append(detected)
  else:misses+=1
  if frames%max(1,round(fps*2))==1:texts+=ocr_image(frame,engine)
 cap.release()
 if not faces or misses/max(1,frames)>0.2:raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: face position could not be tracked reliably.')
 face=np.median(np.array(faces),axis=0);fx,fy,fw,fh=face
 left=max(b[0] for b in bounds);top=max(b[1] for b in bounds);right=min(b[2] for b in bounds);bottom=min(b[3] for b in bounds)
 # Face height is an approximate anatomical anchor; the final head/shoulders/torso must be reviewed.
 # Solve one fixed crop against every tracked position. A median-only crop can
 # wrongly fail ordinary speaker movement, even when a slightly wider crop fits.
 all_faces=np.array(faces);centersx=all_faces[:,0]+all_faces[:,2]/2;centersy=all_faces[:,1]+all_faces[:,3]/2
 chosen=None;framing_mode='tracked_scene_crop';center_limits=(.45,.55,.19,.30,.18,.34)
 # LiteAvatar already returns a portrait studio frame. Preserve its complete
 # height so the head and torso cannot be lost merely because a plain wall was
 # excluded by the texture-based scene-bound estimator. Only the side margins
 # are cropped, and every tracked face must remain inside that fixed crop.
 source_ratio=width/max(1,height)
 if 9/16-.005<=source_ratio<=.85:
  ch=height-height%2;cw=int(ch*9/16);cw-=cw%2
  if cw<=width:
   pad=np.maximum(8,all_faces[:,2]*.08)
   xmin=max(0,np.max(centersx)-.70*cw,np.max(all_faces[:,0]+all_faces[:,2]+pad)-cw)
   xmax=min(width-cw,np.min(centersx)-.30*cw,np.min(all_faces[:,0]-pad))
   safe_vertical=np.min(all_faces[:,1]-.25*all_faces[:,3])>=0
   safe_size=np.min(all_faces[:,3]/ch)>=.08 and np.max(all_faces[:,3]/ch)<=.45
   safe_y=np.min(centersy/ch)>=.08 and np.max(centersy/ch)<=.46
   if safe_vertical and safe_size and safe_y and np.ceil(xmin)<=np.floor(xmax):
    x=int(np.clip(round(fx+fw/2-cw/2),np.ceil(xmin),np.floor(xmax)));y=0
    chosen=(x,y,cw,ch);left,top,right,bottom=0,0,width,height
    framing_mode='portrait_source_side_crop';center_limits=(.30,.70,.08,.46,.08,.45)
 if chosen is None:
  maximum=int(min(bottom-top,(right-left)*16/9)//32*32)
  candidates=sorted(range(160,maximum+1,32),key=lambda h:abs(h-fh/.25))
  for ch in candidates:
   cw=ch*9//16
   if np.min(all_faces[:,3]/ch)<.18 or np.max(all_faces[:,3]/ch)>.34:continue
   xmin=max(left,np.max(centersx)-.55*cw,np.max(all_faces[:,0]+all_faces[:,2])-cw)
   xmax=min(right-cw,np.min(centersx)-.45*cw,np.min(all_faces[:,0]))
   ymin=max(top,np.max(centersy)-.30*ch)
   ymax=min(bottom-ch,np.min(centersy)-.19*ch,np.min(all_faces[:,1]-.25*all_faces[:,3]))
   if np.ceil(xmin)>np.floor(xmax) or np.ceil(ymin)>np.floor(ymax):continue
   x=int(np.clip(round(fx+fw/2-cw/2),np.ceil(xmin),np.floor(xmax)))
   y=int(np.clip(round(fy+fh/2-ch*.275),np.ceil(ymin),np.floor(ymax)))
   chosen=(x,y,cw,ch);break
 if chosen is None:raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: no single crop preserves the centered head and upper torso throughout the clip.')
 x,y,cw,ch=chosen
 minx,maxx,miny,maxy,minh,maxh=center_limits
 protected=[]
 for ax,ay,aw,ah in faces:
  centerx=(ax+aw/2-x)/cw;centery=(ay+ah/2-y)/ch;faceheight=ah/ch
  if not(minx<=centerx<=maxx and miny<=centery<=maxy and minh<=faceheight<=maxh):raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: cannot preserve a centered head and upper-torso crop throughout the clip.')
  if ay-.25*ah<y or ax<x or ax+aw>x+cw:raise ValueError('SOURCE_FRAMING_INCOMPATIBLE: cropping would cut the head.')
  protected.append([(ax-x)/cw-.03,(ay-y)/ch-.03,(ax+aw-x)/cw+.03,(ay+ah-y)/ch+.03])
 return {'crop':{'x':x,'y':y,'width':cw,'height':ch},'safeCropX':{'min':int(np.ceil(xmin)),'max':int(np.floor(xmax))},'sceneBounds':{'left':left,'top':top,'right':right,'bottom':bottom},'framingMode':framing_mode,'faceProtected':{'left':min(p[0] for p in protected),'top':min(p[1] for p in protected),'right':max(p[2] for p in protected),'bottom':max(p[3] for p in protected)},'framesInspected':frames,'faceDetectionMisses':misses,'texts':list(dict.fromkeys(texts)),'anatomicalReviewRequired':True,'ocrScope':'one source frame every two seconds; Macy must inspect the complete output'}

if __name__=='__main__':
 try:
  result=main();result['detectorVersion']=VERSION
  print(json.dumps(result))
 except Exception as e:
  print(json.dumps({'error':str(e),'detectorVersion':VERSION}));sys.exit(1)
