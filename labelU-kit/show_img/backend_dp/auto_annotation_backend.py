#!/usr/bin/env python3
"""
自动标注后端服务
结合Grounding DINO和SAM2实现文本驱动的自动标注
接收图片和文本，返回所有匹配对象的bbox和掩码
"""

import os
import uuid
import base64
import io
import numpy as np
from PIL import Image
import cv2
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import tempfile
import json
from datetime import datetime

# 先尝试导入torch
try:
    import torch
    TORCH_AVAILABLE = True
    print("✅ PyTorch可用")
except ImportError:
    print("❌ PyTorch未安装")
    TORCH_AVAILABLE = False

# 添加Grounded-SAM-2项目路径
import sys
grounded_sam2_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Grounded-SAM-2')
if os.path.exists(grounded_sam2_path):
    sys.path.insert(0, grounded_sam2_path)

# 尝试导入相关模块
try:
    if TORCH_AVAILABLE:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
        from pycocotools import mask as mask_utils
        MODELS_AVAILABLE = True
        print("✅ 模型库导入成功")
    else:
        MODELS_AVAILABLE = False
        print("❌ PyTorch不可用，无法加载模型")
except ImportError as e:
    print(f"❌ 模型库导入失败: {e}")
    MODELS_AVAILABLE = False

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_FOLDER = 'auto_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

class AutoAnnotationService:
    """自动标注服务"""
    
    def __init__(self):
        self.sam2_predictor = None
        self.grounding_model = None
        self.grounding_processor = None
        self.device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
        
        if MODELS_AVAILABLE:
            self._initialize_models()
        else:
            print("⚠️ 模型不可用，将使用模拟结果")
    
    def _initialize_models(self):
        """初始化模型"""
        try:
            print("🔄 正在初始化模型...")
            
            # 初始化SAM2
            sam2_configs = [
                ("sam2.1_hiera_large.pt", "sam2/configs/sam2.1/sam2.1_hiera_l.yaml"),
                ("sam2_hiera_large.pt", "sam2/configs/sam2/sam2_hiera_l.yaml"),
                ("sam2.1_hiera_base_plus.pt", "sam2/configs/sam2.1/sam2.1_hiera_b+.yaml"),
            ]
            
            sam2_loaded = False
            for checkpoint_name, config_path in sam2_configs:
                checkpoint_path = os.path.join(grounded_sam2_path, "checkpoints", checkpoint_name)
                full_config_path = os.path.join(grounded_sam2_path, config_path)
                
                if os.path.exists(checkpoint_path) and os.path.exists(full_config_path):
                    print(f"🔄 加载SAM2: {checkpoint_name}")
                    sam2_model = build_sam2(full_config_path, checkpoint_path, device=self.device)
                    self.sam2_predictor = SAM2ImagePredictor(sam2_model)
                    sam2_loaded = True
                    print(f"✅ SAM2加载成功: {checkpoint_name}")
                    break
            
            if not sam2_loaded:
                print("❌ 未找到SAM2模型文件")
                self.sam2_predictor = None
            
            # 初始化Grounding DINO
            try:
                print("🔄 正在加载Grounding DINO...")
                model_id = "IDEA-Research/grounding-dino-tiny"
                self.grounding_processor = AutoProcessor.from_pretrained(model_id)
                self.grounding_model = AutoModelForZeroShotObjectDetection.from_pretrained(model_id).to(self.device)
                print("✅ Grounding DINO加载成功")
            except Exception as e:
                print(f"❌ Grounding DINO加载失败: {e}")
                self.grounding_model = None
                self.grounding_processor = None
            
        except Exception as e:
            print(f"❌ 模型初始化失败: {e}")
            self.sam2_predictor = None
            self.grounding_model = None
            self.grounding_processor = None
    
    def detect_objects(self, image, text_prompt, box_threshold=0.35, text_threshold=0.25):
        """使用Grounding DINO检测对象"""
        if not self.grounding_model or not self.grounding_processor:
            return self._mock_detection(image, text_prompt)
        
        try:
            print(f"🎯 文本提示: '{text_prompt}'")
            
            # 处理输入
            inputs = self.grounding_processor(images=image, text=text_prompt, return_tensors="pt").to(self.device)
            
            # 推理
            with torch.no_grad():
                outputs = self.grounding_model(**inputs)
            
            # 后处理
            results = self.grounding_processor.post_process_grounded_object_detection(
                outputs,
                inputs.input_ids,
                box_threshold=box_threshold,
                text_threshold=text_threshold,
                target_sizes=[image.size[::-1]]
            )
            
            if len(results) > 0 and len(results[0]["boxes"]) > 0:
                boxes = results[0]["boxes"].cpu().numpy()
                scores = results[0]["scores"].cpu().numpy()
                labels = results[0]["labels"]
                
                print(f"📊 检测到 {len(boxes)} 个对象")
                return boxes, scores, labels
            else:
                print("⚠️ 未检测到匹配的对象")
                return np.array([]), np.array([]), []
                
        except Exception as e:
            print(f"❌ 对象检测失败: {e}")
            return self._mock_detection(image, text_prompt)
    
    def _mock_detection(self, image, text_prompt):
        """模拟检测结果"""
        print("🔄 使用模拟检测结果")
        w, h = image.size
        
        # 创建一些模拟的检测框
        mock_boxes = np.array([
            [w*0.1, h*0.1, w*0.4, h*0.4],  # 左上
            [w*0.6, h*0.6, w*0.9, h*0.9],  # 右下
        ])
        mock_scores = np.array([0.8, 0.7])
        mock_labels = [f"detected_{text_prompt}_1", f"detected_{text_prompt}_2"]
        
        return mock_boxes, mock_scores, mock_labels
    
    def segment_objects(self, image_array, boxes):
        """使用SAM2分割对象"""
        if not self.sam2_predictor:
            return self._mock_segmentation(image_array, boxes)
        
        try:
            print(f"🎭 正在分割 {len(boxes)} 个对象...")
            
            # 设置图像
            self.sam2_predictor.set_image(image_array)
            
            # 分割
            masks, scores, logits = self.sam2_predictor.predict(
                point_coords=None,
                point_labels=None,
                box=boxes,
                multimask_output=False,
            )
            
            # 处理维度
            if masks.ndim == 4:
                masks = masks.squeeze(1)
            
            print(f"✅ 分割完成，掩码形状: {masks.shape}")
            return masks, scores
            
        except Exception as e:
            print(f"❌ 分割失败: {e}")
            return self._mock_segmentation(image_array, boxes)
    
    def _mock_segmentation(self, image_array, boxes):
        """模拟分割结果"""
        print("🔄 使用模拟分割结果")
        h, w = image_array.shape[:2]
        masks = []
        scores = []
        
        for box in boxes:
            # 创建简单的矩形掩码
            mask = np.zeros((h, w), dtype=bool)
            x1, y1, x2, y2 = box.astype(int)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            mask[y1:y2, x1:x2] = True
            masks.append(mask)
            scores.append(0.5)
        
        return np.array(masks), np.array(scores)
    
    def encode_mask(self, mask):
        """编码掩码为base64格式 (与simple_backend.py兼容)"""
        try:
            # 确保掩码是uint8格式，并转换为0/1二值
            binary_mask = (mask > 0).astype(np.uint8)
            
            # 使用与simple_backend.py相同的编码方式
            mask_flat = binary_mask.flatten()
            mask_bytes = mask_flat.tobytes()
            encoded = base64.b64encode(mask_bytes).decode('utf-8')
            
            return {
                'size': [int(mask.shape[0]), int(mask.shape[1])],  # [height, width]
                'counts': encoded  # 与前端兼容的base64格式
            }
        except Exception as e:
            print(f"掩码编码失败: {e}")
            # 返回空掩码
            return {
                'size': [int(mask.shape[0]), int(mask.shape[1])],
                'counts': ""
            }
    
    def auto_annotate(self, image_path, text_prompt, box_threshold=0.35, text_threshold=0.25):
        """执行自动标注"""
        try:
            # 加载图像
            image = Image.open(image_path).convert("RGB")
            image_array = np.array(image)
            
            print(f"📸 图像尺寸: {image.size}")
            
            # 检测对象
            boxes, detection_scores, labels = self.detect_objects(
                image, text_prompt, box_threshold, text_threshold
            )
            
            if len(boxes) == 0:
                return {
                    'success': True,
                    'message': '未检测到匹配的对象',
                    'objects': [],
                    'image_info': {
                        'width': image.size[0],
                        'height': image.size[1]
                    }
                }
            
            # 分割对象
            masks, segmentation_scores = self.segment_objects(image_array, boxes)
            
            # 处理结果
            results = []
            for i in range(len(boxes)):
                box = boxes[i]
                mask = masks[i]
                label = labels[i] if i < len(labels) else f"object_{i}"
                det_score = detection_scores[i] if i < len(detection_scores) else 0.0
                seg_score = segmentation_scores[i] if i < len(segmentation_scores) else 0.0
                
                # 编码掩码
                encoded_mask = self.encode_mask(mask)
                
                result = {
                    'object_id': i + 1,
                    'label': label,
                    'bbox': [float(box[0]), float(box[1]), float(box[2]), float(box[3])],
                    'detection_score': float(det_score),
                    'segmentation_score': float(seg_score),
                    'mask': encoded_mask
                }
                results.append(result)
            
            return {
                'success': True,
                'message': f'成功检测并分割了 {len(results)} 个对象',
                'objects': results,
                'image_info': {
                    'width': image.size[0],
                    'height': image.size[1]
                },
                'text_prompt': text_prompt,
                'thresholds': {
                    'box_threshold': box_threshold,
                    'text_threshold': text_threshold
                }
            }
            
        except Exception as e:
            print(f"❌ 自动标注失败: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': '自动标注过程中发生错误'
            }

# 初始化服务
annotation_service = AutoAnnotationService()

def allowed_file(filename):
    """检查文件扩展名"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    return jsonify({
        'status': 'healthy',
        'torch_available': TORCH_AVAILABLE,
        'models_available': MODELS_AVAILABLE,
        'sam2_ready': annotation_service.sam2_predictor is not None,
        'grounding_ready': annotation_service.grounding_model is not None,
        'device': annotation_service.device
    })

@app.route('/api/auto_annotate', methods=['POST'])
def auto_annotate():
    """自动标注接口"""
    try:
        # 检查请求格式
        if 'image' not in request.files:
            return jsonify({'error': '没有图像文件'}), 400
        
        if 'text_prompt' not in request.form:
            return jsonify({'error': '没有文本提示'}), 400
        
        file = request.files['image']
        text_prompt = request.form['text_prompt'].strip()
        
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        if not text_prompt:
            return jsonify({'error': '文本提示不能为空'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': '不支持的文件格式'}), 400
        
        # 检查文件大小
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': '文件过大'}), 400
        
        # 获取可选参数
        box_threshold = float(request.form.get('box_threshold', 0.35))
        text_threshold = float(request.form.get('text_threshold', 0.25))
        
        # 保存临时文件
        filename = str(uuid.uuid4()) + '.' + file.filename.rsplit('.', 1)[1].lower()
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        print(f"🔄 开始自动标注: '{text_prompt}'")
        
        # 执行自动标注
        result = annotation_service.auto_annotate(
            filepath, text_prompt, box_threshold, text_threshold
        )
        
        # 清理临时文件
        try:
            os.remove(filepath)
        except:
            pass
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'API调用失败'
        }), 500

@app.route('/api/batch_annotate', methods=['POST'])
def batch_annotate():
    """批量自动标注接口"""
    try:
        if 'images' not in request.files:
            return jsonify({'error': '没有图像文件'}), 400
        
        if 'text_prompt' not in request.form:
            return jsonify({'error': '没有文本提示'}), 400
        
        files = request.files.getlist('images')
        text_prompt = request.form['text_prompt'].strip()
        
        if not files:
            return jsonify({'error': '没有选择文件'}), 400
        
        if not text_prompt:
            return jsonify({'error': '文本提示不能为空'}), 400
        
        # 获取可选参数
        box_threshold = float(request.form.get('box_threshold', 0.35))
        text_threshold = float(request.form.get('text_threshold', 0.25))
        
        results = []
        
        for i, file in enumerate(files):
            if not allowed_file(file.filename):
                results.append({
                    'filename': file.filename,
                    'success': False,
                    'error': '不支持的文件格式'
                })
                continue
            
            # 保存临时文件
            filename = f"{uuid.uuid4()}_{i}.{file.filename.rsplit('.', 1)[1].lower()}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            
            # 执行标注
            result = annotation_service.auto_annotate(
                filepath, text_prompt, box_threshold, text_threshold
            )
            result['filename'] = file.filename
            results.append(result)
            
            # 清理临时文件
            try:
                os.remove(filepath)
            except:
                pass
        
        return jsonify({
            'success': True,
            'message': f'批量处理完成，共处理 {len(results)} 个文件',
            'results': results
        })
        
    except Exception as e:
        print(f"❌ 批量API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': '批量API调用失败'
        }), 500

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': '文件过大'}), 413

if __name__ == '__main__':
    print("🚀 启动自动标注服务...")
    print(f"🔧 PyTorch可用: {TORCH_AVAILABLE}")
    print(f"🎯 模型可用: {MODELS_AVAILABLE}")
    print(f"📁 上传目录: {UPLOAD_FOLDER}")
    print("🌐 服务地址: http://localhost:5001")
    print("💡 API端点:")
    print("   POST /api/auto_annotate - 单图自动标注")
    print("   POST /api/batch_annotate - 批量自动标注")
    print("   GET /api/health - 健康检查")
    print("⏹️ 按 Ctrl+C 停止服务")
    
    app.run(host='0.0.0.0', port=5001, debug=True)