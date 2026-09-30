"""SOFTECH face pilot: server-side YuNet + SFace, ephemeral JPEGs over stdin.
The random head movement challenge is NOT certified presentation attack detection.
"""
import base64
import hashlib
import json
import os
import sys
import cv2
import numpy as np


def fail(message):
    print(json.dumps({'error': message}))
    return 0


def main():
    payload = json.load(sys.stdin)
    images = payload.get('frames', [])
    steps = payload.get('steps', [])
    if len(images) != 3 or sorted(steps) != ['front', 'left', 'right']:
        return fail('Invalid challenge')
    models = payload['modelsDir']
    detector = cv2.FaceDetectorYN.create(os.path.join(models, 'face_detection_yunet_2023mar.onnx'), '', (320, 320), 0.90, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(os.path.join(models, 'face_recognition_sface_2021dec.onnx'), '')
    vectors, yaw = [], []
    hashes = set()
    for image in images:
        if not isinstance(image, str) or len(image) > 700000:
            return fail('Invalid frame')
        raw = base64.b64decode(image, validate=True)
        if len(raw) > 550000 or len(raw) < 1000:
            return fail('Invalid JPEG size')
        digest = hashlib.sha256(raw).digest()
        if digest in hashes:
            return fail('Identical frame submitted')
        hashes.add(digest)
        frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None or frame.ndim != 3:
            return fail('Invalid JPEG')
        h, w = frame.shape[:2]
        if min(h, w) < 230 or max(h, w) > 1600:
            return fail('Capture dimensions out of range')
        detector.setInputSize((w, h))
        _, faces = detector.detect(frame)
        if faces is None or len(faces) != 1:
            return fail('Show exactly one face')
        face = faces[0]
        if face[2] < 85 or face[3] < 85 or face[2] * face[3] < .026*w*h:
            return fail('Face too small')
        eye_mid = (face[4] + face[6]) / 2.0
        eye_dist = max(1.0, abs(face[6] - face[4]))
        yaw.append(float((face[8] - eye_mid) / eye_dist))
        feature = recognizer.feature(recognizer.alignCrop(frame, face)).flatten().astype(np.float64)
        norm = np.linalg.norm(feature)
        if norm < 1e-8 or feature.size != 128:
            return fail('Invalid face representation')
        vectors.append(feature / norm)
    neutral = yaw[steps.index('front')]
    left, right = yaw[steps.index('left')], yaw[steps.index('right')]
    # Checks movement, not true PAD. Thresholds require user testing.
    moved = abs(left-neutral) >= .06 and abs(right-neutral) >= .06 and abs(left-right) >= .14
    if not moved:
        return fail('Move head further left and right')
    if min(float(np.dot(vectors[0], v)) for v in vectors[1:]) < .36:
        return fail('Different faces detected')
    mean = sum(vectors)
    mean /= max(1e-8, np.linalg.norm(mean))
    print(json.dumps({'embedding': mean.tolist(), 'movementPassed': True}))
    return 0

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(fail('Face model unavailable or capture invalid'))
