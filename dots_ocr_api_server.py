#!/usr/bin/env python3
"""
DotsOCR API Server

提供批量OCR和实时OCR的API服务，支持1300像素缩放功能
端口5003: 批量OCR服务
端口5004: 实时OCR服务
"""

import json
import os
import io
import tempfile
import base64
import zipfile
import uuid
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from PIL import Image
import requests
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging

# Local tool imports
from dots_ocr.utils import dict_promptmode_to_prompt
from dots_ocr.utils.consts import MIN_PIXELS, MAX_PIXELS
from dots_ocr.utils.demo_utils.display import read_image
from dots_ocr.utils.doc_utils import load_images_from_pdf
from dots_ocr.utils.image_utils import fetch_image

# Add DotsOCRParser import
from dots_ocr.parser import DotsOCRParser

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== Configuration ====================
DEFAULT_CONFIG = {
    'ip': "127.0.0.1",
    'port_vllm': 8000,
    'min_pixels': 100000,  # 修改为与Python测试客户端一致
    'max_pixels': 1000000,  # 修改为与Python测试客户端一致
    'max_image_width': 1300,  # 最大图片宽度限制
    'max_image_height': 1300,  # 最大图片高度限制
    'max_total_pixels': 1690000,  # 最大总像素数限制 (1300*1300)
    'batch_processing_limit': 50,  # 批量处理最大文件数
    'temp_dir': "./temp_ocr_files",
}

# ==================== Global Variables ====================
current_config = DEFAULT_CONFIG.copy()

# 创建临时目录
os.makedirs(current_config['temp_dir'], exist_ok=True)

# Create DotsOCRParser instance
dots_parser = DotsOCRParser(
    ip=DEFAULT_CONFIG['ip'],
    port=DEFAULT_CONFIG['port_vllm'],
    dpi=200,
    min_pixels=DEFAULT_CONFIG['min_pixels'],
    max_pixels=DEFAULT_CONFIG['max_pixels'],
    use_hf=True
)

# ==================== Utility Functions ====================

def limit_image_size(image, max_width=None, max_height=None, max_total_pixels=None):
    """限制图片大小，确保最长边不超过1300像素，避免显存占用过高"""
    if max_width is None:
        max_width = current_config.get('max_image_width', 1300)
    if max_height is None:
        max_height = current_config.get('max_image_height', 1300)
    if max_total_pixels is None:
        max_total_pixels = current_config.get('max_total_pixels', 1690000)
    
    width, height = image.size
    original_pixels = width * height
    
    # 检查是否需要缩放
    scale_factor = 1.0
    
    # 检查最长边限制（确保最长边不超过1300像素）
    max_dimension = max(width, height)
    if max_dimension > max_width:  # max_width 和 max_height 都是1300
        scale_factor = min(scale_factor, max_width / max_dimension)
    
    # 检查总像素数限制
    if original_pixels > max_total_pixels:
        pixel_scale = (max_total_pixels / original_pixels) ** 0.5
        scale_factor = min(scale_factor, pixel_scale)
    
    # 如果需要缩放
    if scale_factor < 1.0:
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        logger.info(f"图片已缩放: {width}×{height} → {new_width}×{new_height} (缩放比例: {scale_factor:.2f}, 最长边: {max(new_width, new_height)}像素)")
    
    return image

def read_image_v2(img):
    """Reads an image, supports URLs and local paths"""
    if isinstance(img, str) and img.startswith(("http://", "https://")):
        with requests.get(img, stream=True) as response:
            response.raise_for_status()
            img = Image.open(io.BytesIO(response.content))
    elif isinstance(img, str):
        img, _, _ = read_image(img, use_native=True)
    elif isinstance(img, Image.Image):
        pass
    else:
        raise ValueError(f"Invalid image type: {type(img)}")
    
    # 应用大小限制
    img = limit_image_size(img)
    return img

def create_temp_session_dir():
    """Creates a unique temporary directory for each processing request"""
    session_id = uuid.uuid4().hex[:8]
    temp_dir = os.path.join(current_config['temp_dir'], f"ocr_session_{session_id}")
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir, session_id

def parse_image_with_high_level_api(parser, image, prompt_mode, fitz_preprocess=False):
    """Processes using the high-level API parse_image from DotsOCRParser"""
    temp_dir, session_id = create_temp_session_dir()
    
    try:
        # Save the PIL Image as a temporary file
        temp_image_path = os.path.join(temp_dir, f"input_{session_id}.png")
        image.save(temp_image_path, "PNG")
        
        # Use the high-level API parse_image
        filename = f"api_{session_id}"
        results = parser.parse_image(
            input_path=image,
            filename=filename, 
            prompt_mode=prompt_mode,
            save_dir=temp_dir,
            fitz_preprocess=fitz_preprocess
        )
        
        # Parse the results
        if not results:
            raise ValueError("No results returned from parser")
        
        result = results[0]  # parse_image returns a list with a single result
        
        layout_image = None
        if 'layout_image_path' in result and os.path.exists(result['layout_image_path']):
            layout_image = Image.open(result['layout_image_path'])
        
        cells_data = None
        if 'layout_info_path' in result and os.path.exists(result['layout_info_path']):
            with open(result['layout_info_path'], 'r', encoding='utf-8') as f:
                cells_data = json.load(f)
        
        md_content = None
        if 'md_content_path' in result and os.path.exists(result['md_content_path']):
            with open(result['md_content_path'], 'r', encoding='utf-8') as f:
                md_content = f.read()
        
        return {
            'layout_image': layout_image,
            'cells_data': cells_data,
            'md_content': md_content,
            'filtered': result.get('filtered', False),
            'temp_dir': temp_dir,
            'session_id': session_id,
            'result_paths': result,
            'input_width': result.get('input_width', 0),
            'input_height': result.get('input_height', 0),
        }
    except Exception as e:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise e

def parse_pdf_with_high_level_api(parser, pdf_path, prompt_mode):
    """Processes using the high-level API parse_pdf from DotsOCRParser"""
    temp_dir, session_id = create_temp_session_dir()
    
    try:
        # Use the high-level API parse_pdf
        filename = f"api_{session_id}"
        results = parser.parse_pdf(
            input_path=pdf_path,
            filename=filename,
            prompt_mode=prompt_mode,
            save_dir=temp_dir
        )
        
        # Parse the results
        if not results:
            raise ValueError("No results returned from parser")
        
        # Handle multi-page results
        parsed_results = []
        all_md_content = []
        all_cells_data = []
        
        for i, result in enumerate(results):
            page_result = {
                'page_no': result.get('page_no', i),
                'layout_image': None,
                'cells_data': None,
                'md_content': None,
                'filtered': False
            }
            
            # Read the layout image
            if 'layout_image_path' in result and os.path.exists(result['layout_image_path']):
                page_result['layout_image'] = Image.open(result['layout_image_path'])
            
            # Read the JSON data
            if 'layout_info_path' in result and os.path.exists(result['layout_info_path']):
                with open(result['layout_info_path'], 'r', encoding='utf-8') as f:
                    page_result['cells_data'] = json.load(f)
                    all_cells_data.extend(page_result['cells_data'])
            
            # Read the Markdown content
            if 'md_content_path' in result and os.path.exists(result['md_content_path']):
                with open(result['md_content_path'], 'r', encoding='utf-8') as f:
                    page_content = f.read()
                    page_result['md_content'] = page_content
                    all_md_content.append(page_content)
            page_result['filtered'] = result.get('filtered', False)
            parsed_results.append(page_result)
        
        combined_md = "\n\n---\n\n".join(all_md_content) if all_md_content else ""
        return {
            'parsed_results': parsed_results,
            'combined_md_content': combined_md,
            'combined_cells_data': all_cells_data,
            'temp_dir': temp_dir,
            'session_id': session_id,
            'total_pages': len(results)
        }
        
    except Exception as e:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise e

# ==================== Pydantic Models ====================

class OCRRequest(BaseModel):
    prompt_mode: str = "prompt_layout_all_en"
    server_ip: str = "127.0.0.1"
    server_port: int = 8000
    min_pixels: int = 100000  # 修改为与Python测试客户端一致
    max_pixels: int = 1000000  # 修改为与Python测试客户端一致
    fitz_preprocess: bool = False
    max_image_width: int = 1300
    max_image_height: int = 1300
    max_total_pixels: int = 1690000

class BatchOCRRequest(BaseModel):
    files: List[str]  # 文件路径列表
    prompt_mode: str = "prompt_layout_all_en"
    server_ip: str = "127.0.0.1"
    server_port: int = 8000
    min_pixels: int = 100000  # 修改为与Python测试客户端一致
    max_pixels: int = 1000000  # 修改为与Python测试客户端一致
    fitz_preprocess: bool = False
    max_image_width: int = 1300
    max_image_height: int = 1300
    max_total_pixels: int = 1690000

class OCRResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# ==================== FastAPI App ====================

app = FastAPI(
    title="DotsOCR API Server",
    description="提供批量OCR和实时OCR的API服务，支持1300像素缩放功能",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """API根路径"""
    return {
        "message": "DotsOCR API Server",
        "version": "1.0.0",
        "features": [
            "实时OCR处理",
            "批量OCR处理", 
            "1300像素缩放",
            "PDF多页支持"
        ],
        "endpoints": {
            "实时OCR": "/realtime/ocr",
            "批量OCR": "/batch/ocr",
            "健康检查": "/health",
            "配置信息": "/config"
        }
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": str(uuid.uuid4())}

@app.get("/config")
async def get_config():
    """获取当前配置"""
    return {
        "current_config": current_config,
        "available_prompt_modes": list(dict_promptmode_to_prompt.keys())
    }

@app.post("/realtime/ocr", response_model=OCRResponse)
async def realtime_ocr(
    file: UploadFile = File(...),
    prompt_mode: str = Form("prompt_layout_all_en"),
    server_ip: str = Form("127.0.0.1"),
    server_port: int = Form(8000),
    min_pixels: int = Form(100000),  # 修改为与Python测试客户端一致
    max_pixels: int = Form(1000000),  # 修改为与Python测试客户端一致
    fitz_preprocess: bool = Form(False),
    max_image_width: int = Form(1300),
    max_image_height: int = Form(1300),
    max_total_pixels: int = Form(1690000)
):
    """实时OCR处理单个文件"""
    try:
        # 更新配置
        current_config.update({
            'ip': server_ip,
            'port_vllm': server_port,
            'min_pixels': min_pixels,
            'max_pixels': max_pixels,
            'max_image_width': max_image_width,
            'max_image_height': max_image_height,
            'max_total_pixels': max_total_pixels
        })
        
        dots_parser.ip = server_ip
        dots_parser.port = server_port
        dots_parser.min_pixels = min_pixels
        dots_parser.max_pixels = max_pixels
        
        # 保存上传的文件
        temp_dir, session_id = create_temp_session_dir()
        file_path = os.path.join(temp_dir, f"upload_{session_id}_{file.filename}")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # 处理文件
        if file_ext == '.pdf':
            # PDF处理
            parse_result = parse_pdf_with_high_level_api(dots_parser, file_path, prompt_mode)
            
            # 计算像素信息
            total_pixels = 0
            page_info_list = []
            for i, page_result in enumerate(parse_result['parsed_results']):
                if page_result.get('layout_image'):
                    width, height = page_result['layout_image'].size
                    pixels = width * height
                    total_pixels += pixels
                    page_info_list.append(f"第{i+1}页: {width}×{height} ({pixels:,} 像素)")
            
            estimated_memory_mb = (total_pixels * 4) / (1024 * 1024)
            
            result_data = {
                'file_type': 'pdf',
                'total_pages': parse_result['total_pages'],
                'combined_md_content': parse_result['combined_md_content'],
                'combined_cells_data': parse_result['combined_cells_data'],
                'parsed_results': [
                    {
                        'page_no': pr['page_no'],
                        'md_content': pr['md_content'],
                        'cells_data': pr['cells_data'],
                        'filtered': pr['filtered']
                    } for pr in parse_result['parsed_results']
                ],
                'pixel_info': {
                    'total_pixels': total_pixels,
                    'estimated_memory_mb': estimated_memory_mb,
                    'page_details': page_info_list
                },
                'session_id': session_id
            }
            
        elif file_ext in ['.jpg', '.jpeg', '.png']:
            # 图片处理
            image = read_image_v2(file_path)
            
            # 计算像素信息
            width, height = image.size
            pixels = width * height
            estimated_memory_mb = (pixels * 4) / (1024 * 1024)
            
            parse_result = parse_image_with_high_level_api(dots_parser, image, prompt_mode, fitz_preprocess)
            
            result_data = {
                'file_type': 'image',
                'md_content': parse_result['md_content'],
                'cells_data': parse_result['cells_data'],
                'filtered': parse_result['filtered'],
                'pixel_info': {
                    'width': width,
                    'height': height,
                    'total_pixels': pixels,
                    'estimated_memory_mb': estimated_memory_mb
                },
                'session_id': session_id
            }
            
        else:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {file_ext}")
        
        # 清理临时文件
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        return OCRResponse(
            success=True,
            message="OCR处理成功",
            data=result_data
        )
        
    except Exception as e:
        logger.error(f"实时OCR处理失败: {str(e)}")
        return OCRResponse(
            success=False,
            message="OCR处理失败",
            error=str(e)
        )

@app.post("/batch/ocr", response_model=OCRResponse)
async def batch_ocr(request: BatchOCRRequest):
    """批量OCR处理多个文件"""
    try:
        # 检查文件数量限制
        if len(request.files) > current_config['batch_processing_limit']:
            raise HTTPException(
                status_code=400, 
                detail=f"批量处理文件数量超过限制: {len(request.files)} > {current_config['batch_processing_limit']}"
            )
        
        # 更新配置
        current_config.update({
            'ip': request.server_ip,
            'port_vllm': request.server_port,
            'min_pixels': request.min_pixels,
            'max_pixels': request.max_pixels,
            'max_image_width': request.max_image_width,
            'max_image_height': request.max_image_height,
            'max_total_pixels': request.max_total_pixels
        })
        
        dots_parser.ip = request.server_ip
        dots_parser.port = request.server_port
        dots_parser.min_pixels = request.min_pixels
        dots_parser.max_pixels = request.max_pixels
        
        results = []
        total_pixels = 0
        
        # 处理每个文件
        for file_path in request.files:
            if not os.path.exists(file_path):
                results.append({
                    'file_path': file_path,
                    'success': False,
                    'error': '文件不存在'
                })
                continue
            
            try:
                file_ext = os.path.splitext(file_path)[1].lower()
                
                if file_ext == '.pdf':
                    # PDF处理
                    parse_result = parse_pdf_with_high_level_api(dots_parser, file_path, request.prompt_mode)
                    
                    # 计算像素信息
                    file_pixels = 0
                    for page_result in parse_result['parsed_results']:
                        if page_result.get('layout_image'):
                            width, height = page_result['layout_image'].size
                            file_pixels += width * height
                    
                    total_pixels += file_pixels
                    
                    results.append({
                        'file_path': file_path,
                        'success': True,
                        'file_type': 'pdf',
                        'total_pages': parse_result['total_pages'],
                        'md_content': parse_result['combined_md_content'],
                        'cells_data': parse_result['combined_cells_data'],
                        'pixel_info': {
                            'total_pixels': file_pixels,
                            'estimated_memory_mb': (file_pixels * 4) / (1024 * 1024)
                        }
                    })
                    
                elif file_ext in ['.jpg', '.jpeg', '.png']:
                    # 图片处理
                    image = read_image_v2(file_path)
                    
                    width, height = image.size
                    file_pixels = width * height
                    total_pixels += file_pixels
                    
                    parse_result = parse_image_with_high_level_api(dots_parser, image, request.prompt_mode, request.fitz_preprocess)
                    
                    results.append({
                        'file_path': file_path,
                        'success': True,
                        'file_type': 'image',
                        'md_content': parse_result['md_content'],
                        'cells_data': parse_result['cells_data'],
                        'filtered': parse_result['filtered'],
                        'pixel_info': {
                            'width': width,
                            'height': height,
                            'total_pixels': file_pixels,
                            'estimated_memory_mb': (file_pixels * 4) / (1024 * 1024)
                        }
                    })
                    
                else:
                    results.append({
                        'file_path': file_path,
                        'success': False,
                        'error': f'不支持的文件格式: {file_ext}'
                    })
                    
            except Exception as e:
                results.append({
                    'file_path': file_path,
                    'success': False,
                    'error': str(e)
                })
        
        # 统计信息
        successful_count = sum(1 for r in results if r['success'])
        failed_count = len(results) - successful_count
        
        result_data = {
            'total_files': len(request.files),
            'successful_count': successful_count,
            'failed_count': failed_count,
            'total_pixels': total_pixels,
            'estimated_total_memory_mb': (total_pixels * 4) / (1024 * 1024),
            'results': results
        }
        
        return OCRResponse(
            success=True,
            message=f"批量OCR处理完成: {successful_count}成功, {failed_count}失败",
            data=result_data
        )
        
    except Exception as e:
        logger.error(f"批量OCR处理失败: {str(e)}")
        return OCRResponse(
            success=False,
            message="批量OCR处理失败",
            error=str(e)
        )

# ==================== Main Program ====================

def run_batch_server():
    """运行批量OCR服务器 (端口5003)"""
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5003,
        log_level="info"
    )

def run_realtime_server():
    """运行实时OCR服务器 (端口5004)"""
    uvicorn.run(
        app,
        host="0.0.0.0", 
        port=5004,
        log_level="info"
    )

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        server_type = sys.argv[1].lower()
        if server_type == "batch":
            print("启动批量OCR服务器 (端口5003)...")
            run_batch_server()
        elif server_type == "realtime":
            print("启动实时OCR服务器 (端口5004)...")
            run_realtime_server()
        else:
            print("用法: python dots_ocr_api_server.py [batch|realtime]")
            print("  batch: 启动批量OCR服务器 (端口5003)")
            print("  realtime: 启动实时OCR服务器 (端口5004)")
    else:
        print("请指定服务器类型:")
        print("  python dots_ocr_api_server.py batch     # 批量OCR服务器")
        print("  python dots_ocr_api_server.py realtime  # 实时OCR服务器")
