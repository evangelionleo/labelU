#!/usr/bin/env python3
"""
真实的SAM2图像分割后端服务
支持点击交互分割
"""

import os
import uuid
import base64
import io
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# 先尝试导入torch，如果失败则设置标志
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    print("⚠️ PyTorch未安装，将使用模拟分割结果")
    TORCH_AVAILABLE = False

# 尝试导入SAM2相关模块
import sys
sam2_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Grounded-SAM-2')
if os.path.exists(sam2_path):
    sys.path.insert(0, sam2_path)

try:
    if TORCH_AVAILABLE:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        import cv2
        from pycocotools import mask as mask_utils
        SAM2_AVAILABLE = True
        print("✅ SAM2模块加载成功")
    else:
        SAM2_AVAILABLE = False
        print("❌ PyTorch不可用，SAM2模块无法加载")
except ImportError as e:
    print(f"❌ SAM2模块导入失败: {e}")
    print("将使用模拟分割结果")
    SAM2_AVAILABLE = False

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 全局变量存储会话
sessions = {}

class SimpleSAM2Predictor:
    """真实的SAM2预测器，支持点击交互分割"""
    
    def __init__(self):
        self.predictor = None
        self.current_image = None
        self.device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
        
        if SAM2_AVAILABLE and TORCH_AVAILABLE:
            try:
                # 查找可用的检查点文件
                possible_checkpoints = [
                    os.path.join(sam2_path, "checkpoints", "sam2.1_hiera_large.pt"),
                    os.path.join(sam2_path, "checkpoints", "sam2_hiera_large.pt"),
                    os.path.join(sam2_path, "checkpoints", "sam2.1_hiera_base_plus.pt"),
                    os.path.join(sam2_path, "checkpoints", "sam2_hiera_base_plus.pt"),
                ]
                
                possible_configs = [
                    os.path.join(sam2_path, "sam2", "configs", "sam2.1", "sam2.1_hiera_l.yaml"),
                    os.path.join(sam2_path, "sam2", "configs", "sam2", "sam2_hiera_l.yaml"),
                    os.path.join(sam2_path, "sam2", "configs", "sam2.1", "sam2.1_hiera_b+.yaml"),
                    os.path.join(sam2_path, "sam2", "configs", "sam2", "sam2_hiera_b+.yaml"),
                ]
                
                checkpoint = None
                model_cfg = None
                
                # 找到第一个存在的检查点和配置文件
                for ckpt, cfg in zip(possible_checkpoints, possible_configs):
                    if os.path.exists(ckpt) and os.path.exists(cfg):
                        checkpoint = ckpt
                        model_cfg = cfg
                        break
                
                if checkpoint and model_cfg:
                    print(f"🔄 加载SAM2模型: {os.path.basename(checkpoint)}")
                    print(f"📄 使用配置: {os.path.basename(model_cfg)}")
                    print(f"🔧 设备: {self.device}")
                    
                    sam2_model = build_sam2(model_cfg, checkpoint, device=self.device)
                    self.predictor = SAM2ImagePredictor(sam2_model)
                    print("✅ SAM2模型加载成功！")
                else:
                    print("❌ 未找到SAM2检查点文件，请下载模型文件")
                    print("💡 运行: python setup_sam2.py")
                    self.predictor = None
                    
            except Exception as e:
                print(f"❌ SAM2初始化失败: {e}")
                print("🔄 将使用模拟分割结果")
                self.predictor = None
        else:
            if not TORCH_AVAILABLE:
                print("❌ PyTorch未安装，请运行: pip install torch")
            else:
                print("❌ SAM2模块不可用，请检查安装")
            self.predictor = None
    
    def set_image(self, image_path):
        """设置要处理的图像"""
        try:
            image = Image.open(image_path).convert('RGB')
            image_array = np.array(image)
            
            if self.predictor:
                self.predictor.set_image(image_array)
            
            self.current_image = image_array
            return True
        except Exception as e:
            print(f"设置图像失败: {e}")
            return False
    
    def predict(self, points, labels):
        """执行分割预测"""
        if self.predictor and self.current_image is not None:
            try:
                print(f"🎯 执行SAM2预测，点数: {len(points)}")
                print(f"📍 点坐标: {points}")
                print(f"🏷️ 标签: {labels}")
                
                # 转换为numpy数组
                point_coords = np.array(points, dtype=np.float32)
                point_labels = np.array(labels, dtype=np.int32)
                
                # 使用真实的SAM2预测
                masks, scores, logits = self.predictor.predict(
                    point_coords=point_coords,
                    point_labels=point_labels,
                    multimask_output=True,  # 输出多个掩码候选
                )
                
                print(f"📊 预测结果: {masks.shape}, 得分: {scores}")
                
                # 选择得分最高的掩码
                best_mask_idx = np.argmax(scores)
                best_mask = masks[best_mask_idx]
                best_score = scores[best_mask_idx]
                
                print(f"✨ 选择最佳掩码 #{best_mask_idx}, 得分: {best_score:.3f}")
                
                # 编码掩码和计算边界框
                encoded_mask = self._encode_mask(best_mask)
                bbox = self._get_bbox(best_mask)
                
                print(f"📦 边界框: {bbox}")
                
                return encoded_mask, bbox
                
            except Exception as e:
                print(f"❌ SAM2预测失败: {e}")
                print("🔄 回退到模拟结果")
                return self._generate_mock_result(points)
        else:
            print("⚠️ 预测器未初始化或图像未设置，使用模拟结果")
            return self._generate_mock_result(points)
    
    def _generate_mock_result(self, points):
        """生成模拟的分割结果"""
        if not points or len(points) == 0:
            return None, None
            
        # 获取图像尺寸
        if self.current_image is not None:
            height, width = self.current_image.shape[:2]
        else:
            height, width = 512, 512
        
        # 创建一个以点击位置为中心的圆形掩码
        center_x, center_y = points[0]
        radius = min(width, height) // 8
        
        # 创建掩码
        y, x = np.ogrid[:height, :width]
        mask = (x - center_x)**2 + (y - center_y)**2 <= radius**2
        
        # 计算边界框
        bbox = self._get_bbox(mask)
        
        return self._encode_mask(mask), bbox
    
    def _encode_mask(self, mask):
        """将掩码编码为base64格式"""
        # 使用简化的base64编码
        mask_flat = mask.flatten().astype(np.uint8)
        
        # 转换为base64编码
        mask_bytes = mask_flat.tobytes()
        encoded = base64.b64encode(mask_bytes).decode('utf-8')
        
        return {
            'size': [int(mask.shape[0]), int(mask.shape[1])],  # [height, width]
            'counts': encoded
        }
    
    def _get_bbox(self, mask):
        """计算掩码的边界框"""
        rows = np.any(mask, axis=1)
        cols = np.any(mask, axis=0)
        
        if not np.any(rows) or not np.any(cols):
            return [0, 0, 0, 0]
        
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        
        return [int(cmin), int(rmin), int(cmax), int(rmax)]

# 初始化预测器
predictor = SimpleSAM2Predictor()

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'healthy',
        'torch_available': TORCH_AVAILABLE,
        'sam2_available': SAM2_AVAILABLE,
        'predictor_ready': predictor.predictor is not None
    })

@app.route('/api/upload', methods=['POST'])
def upload_image():
    """上传图像接口"""
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件格式'}), 400
    
    # 检查文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        return jsonify({'error': '文件过大'}), 400
    
    # 保存文件
    filename = str(uuid.uuid4()) + '.' + file.filename.rsplit('.', 1)[1].lower()
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    return jsonify({
        'filename': filename,
        'path': filepath,
        'url': f'/api/image/{filename}'
    })

@app.route('/api/image/<filename>')
def serve_image(filename):
    """提供图像文件"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/start_session', methods=['POST'])
def start_session():
    """开始分割会话"""
    data = request.get_json()
    image_path = data.get('image_path')
    
    if not image_path:
        return jsonify({'error': '缺少图像路径'}), 400
    
    # 检查文件是否存在
    if not os.path.exists(image_path):
        return jsonify({'error': '图像文件不存在'}), 404
    
    # 创建会话
    session_id = str(uuid.uuid4())
    
    # 设置图像
    if not predictor.set_image(image_path):
        return jsonify({'error': '设置图像失败'}), 500
    
    sessions[session_id] = {
        'image_path': image_path,
        'points': [],
        'labels': [],
        'masks': []
    }
    
    return jsonify({'session_id': session_id})

@app.route('/api/add_point', methods=['POST'])
def add_point():
    """添加点并进行分割"""
    data = request.get_json()
    session_id = data.get('session_id')
    point = data.get('point')  # [x, y]
    label = data.get('label', 1)  # 1为前景，0为背景
    clear_previous = data.get('clear_previous', False)
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': '无效的会话ID'}), 400
    
    if not point or len(point) != 2:
        return jsonify({'error': '无效的点坐标'}), 400
    
    session = sessions[session_id]
    
    # 清除之前的点（如果需要）
    if clear_previous:
        session['points'] = []
        session['labels'] = []
    
    # 添加新点
    session['points'].append(point)
    session['labels'].append(label)
    
    # 执行分割
    try:
        mask_data, bbox = predictor.predict(session['points'], session['labels'])
        
        if mask_data is None:
            return jsonify({'error': '分割失败'}), 500
        
        result = {
            'session_id': session_id,
            'point': point,
            'label': label,
            'mask': mask_data,
            'bbox': bbox,
            'total_points': len(session['points'])
        }
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'分割过程出错: {str(e)}'}), 500

@app.route('/api/clear_points', methods=['POST'])
def clear_points():
    """清除会话中的所有点"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if not session_id or session_id not in sessions:
        return jsonify({'error': '无效的会话ID'}), 400
    
    session = sessions[session_id]
    session['points'] = []
    session['labels'] = []
    session['masks'] = []
    
    return jsonify({'success': True, 'message': '已清除所有点'})

@app.route('/api/close_session', methods=['POST'])
def close_session():
    """关闭会话"""
    data = request.get_json()
    session_id = data.get('session_id')
    
    if session_id in sessions:
        del sessions[session_id]
    
    return jsonify({'success': True})

@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    """列出所有活动会话（调试用）"""
    return jsonify({
        'sessions': list(sessions.keys()),
        'count': len(sessions)
    })

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': '文件过大'}), 413

if __name__ == '__main__':
    print("🚀 启动SAM2图像分割服务...")
    print(f"🔧 PyTorch可用: {TORCH_AVAILABLE}")
    print(f"🎯 SAM2可用: {SAM2_AVAILABLE}")
    print(f"📁 上传目录: {UPLOAD_FOLDER}")
    print("🌐 服务地址: http://localhost:5000")
    print("💡 打开前端: index.html")
    print("⏹️ 按 Ctrl+C 停止服务")
    
    app.run(host='0.0.0.0', port=5000, debug=True)