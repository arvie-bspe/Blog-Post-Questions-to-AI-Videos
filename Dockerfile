FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-liberation chromium python3-venv libgl1 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/visual && /opt/visual/bin/pip install --no-cache-dir opencv-python==4.13.0.92 rapidocr-onnxruntime==1.4.4
RUN /opt/visual/bin/python -c "import cv2; from rapidocr_onnxruntime import RapidOCR; RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1); assert not cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml').empty()"
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src ./src
COPY public ./public
COPY rules ./rules
COPY assets ./assets
RUN /opt/visual/bin/python -c "import sys; sys.path.insert(0, '/app/src'); from face_detector import FaceDetector; FaceDetector()"
COPY bootstrap ./bootstrap
ENV LOGO_CHROMIUM_PATH=/usr/bin/chromium HOST=0.0.0.0 DATA_DIR=/data NODE_ENV=production
CMD ["node", "src/server.mjs"]
