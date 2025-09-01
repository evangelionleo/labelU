"""
Layout Inference Web Application with Gradio

A Gradio-based layout inference tool that supports image uploads and multiple backend inference engines.
It adopts a reference-style interface design while preserving the original inference logic.
"""

import gradio as gr
import json
import os
import io
import tempfile
import base64
import zipfile
import uuid
import re
from pathlib import Path
from PIL import Image
import requests
import shutil # Import shutil for cleanup
from openai import OpenAI

# Local tool imports
from dots_ocr.utils import dict_promptmode_to_prompt
from dots_ocr.utils.consts import MIN_PIXELS, MAX_PIXELS
from dots_ocr.utils.demo_utils.display import read_image
from dots_ocr.utils.doc_utils import load_images_from_pdf
from dots_ocr.utils.image_utils import fetch_image

# Add DotsOCRParser import
from dots_ocr.parser import DotsOCRParser


# ==================== Configuration ====================
DEFAULT_CONFIG = {
    'ip': "127.0.0.1",
    'port_vllm': 8000,
    'min_pixels': MIN_PIXELS,
    'max_pixels': MAX_PIXELS,
    'max_image_width': 1300,  # 最大图片宽度限制
    'max_image_height': 1300,  # 最大图片高度限制
    'max_total_pixels': 2250000,  # 最大总像素数限制 (1500*1500)
    'test_images_dir': "./assets/showcase_origin",
    'deepseek_base_url': "https://api.deepseek.com",
    'deepseek_model': "deepseek-chat",
    'deepseek_api_key': "sk-fd949d012f8d47f9a5840ccbe128f5fc",
}

# ==================== Global Variables ====================
# Store current configuration
current_config = DEFAULT_CONFIG.copy()

# Create DotsOCRParser instance
dots_parser = DotsOCRParser(
    ip=DEFAULT_CONFIG['ip'],
    port=DEFAULT_CONFIG['port_vllm'],
    dpi=200,
    min_pixels=DEFAULT_CONFIG['min_pixels'],
    max_pixels=DEFAULT_CONFIG['max_pixels'],
    use_hf=True
)

def get_initial_session_state():
    return {
        'processing_results': {
            'original_image': None,
            'processed_image': None,
            'layout_result': None,
            'markdown_content': None,
            'cells_data': None,
            'temp_dir': None,
            'session_id': None,
            'result_paths': None,
            'pdf_results': None
        },
        'pdf_cache': {
            "images": [],
            "current_page": 0,
            "total_pages": 0,
            "file_type": None,
            "is_parsed": False,
            "results": []
        },
        'qa_results': {
            'qa_markdown': "",
            'qa_json': "",
            'download_path': None
        }
    }

def limit_image_size(image, max_width=None, max_height=None, max_total_pixels=None):
    """限制图片大小，确保最长边不超过1500像素，避免显存占用过高"""
    if max_width is None:
        max_width = current_config.get('max_image_width', 1500)
    if max_height is None:
        max_height = current_config.get('max_image_height', 1500)
    if max_total_pixels is None:
        max_total_pixels = current_config.get('max_total_pixels', 2250000)
    
    width, height = image.size
    original_pixels = width * height
    
    # 检查是否需要缩放
    scale_factor = 1.0
    
    # 检查最长边限制（确保最长边不超过1500像素）
    max_dimension = max(width, height)
    if max_dimension > max_width:  # max_width 和 max_height 都是1500
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
        print(f"图片已缩放: {width}×{height} → {new_width}×{new_height} (缩放比例: {scale_factor:.2f}, 最长边: {max(new_width, new_height)}像素)")
    
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

def load_file_for_preview(file_path, session_state):
    """Loads a file for preview, supports PDF and image files"""
    pdf_cache = session_state['pdf_cache']
    
    if not file_path or not os.path.exists(file_path):
        return None, "<div id='page_info_box'>0 / 0</div>", session_state
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.pdf':
            pages = load_images_from_pdf(file_path)
            pdf_cache["file_type"] = "pdf"
            
            # 计算PDF像素信息（缩放前）
            total_pixels_original = 0
            page_info_list = []
            for i, page in enumerate(pages):
                width, height = page.size
                pixels = width * height
                total_pixels_original += pixels
                page_info_list.append(f"第{i+1}页: {width}×{height} ({pixels:,} 像素)")
            
            # 应用大小限制到所有页面
            pages_limited = []
            total_pixels_limited = 0
            page_info_list_limited = []
            for i, page in enumerate(pages):
                limited_page = limit_image_size(page.copy())
                pages_limited.append(limited_page)
                width, height = limited_page.size
                pixels = width * height
                total_pixels_limited += pixels
                page_info_list_limited.append(f"第{i+1}页: {width}×{height} ({pixels:,} 像素)")
            
            pages = pages_limited
            
            # 估算显存占用 (假设每像素4字节RGBA)
            estimated_memory_mb_original = (total_pixels_original * 4) / (1024 * 1024)
            estimated_memory_mb_limited = (total_pixels_limited * 4) / (1024 * 1024)
            
            pixel_info = f"<div style='background-color: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 5px; margin: 10px 0; border: 1px solid #4a5568;'>" \
                        f"<strong>📊 PDF像素信息 (预览为缩放后效果):</strong><br>" \
                        f"总页数: {len(pages)}<br>" \
                        f"原始总像素数: {total_pixels_original:,}<br>" \
                        f"预览总像素数: {total_pixels_limited:,}<br>" \
                        f"原始估算显存: {estimated_memory_mb_original:.1f} MB<br>" \
                        f"预览估算显存: {estimated_memory_mb_limited:.1f} MB<br>" \
                        f"<details><summary>详细页信息（预览尺寸）</summary>" + "<br>".join(page_info_list_limited) + "</details>" \
                        f"</div>"
            
        elif file_ext in ['.jpg', '.jpeg', '.png']:
            image = Image.open(file_path)
            pdf_cache["file_type"] = "image"
            
            # 计算原始图片像素信息
            original_width, original_height = image.size
            original_pixels = original_width * original_height
            estimated_memory_mb_original = (original_pixels * 4) / (1024 * 1024)
            
            # 应用大小限制
            image_limited = limit_image_size(image.copy())
            limited_width, limited_height = image_limited.size
            limited_pixels = limited_width * limited_height
            estimated_memory_mb_limited = (limited_pixels * 4) / (1024 * 1024)
            
            pages = [image_limited]
            
            pixel_info = f"<div style='background-color: #2d3748; color: #e2e8f0; padding: 10px; border-radius: 5px; margin: 10px 0; border: 1px solid #4a5568;'>" \
                        f"<strong>📊 图片像素信息 (预览为缩放后效果):</strong><br>" \
                        f"原始尺寸: {original_width}×{original_height}<br>" \
                        f"预览尺寸: {limited_width}×{limited_height}<br>" \
                        f"原始总像素数: {original_pixels:,}<br>" \
                        f"预览总像素数: {limited_pixels:,}<br>" \
                        f"原始估算显存: {estimated_memory_mb_original:.1f} MB<br>" \
                        f"预览估算显存: {estimated_memory_mb_limited:.1f} MB</div>"
        else:
            return None, "<div id='page_info_box'>Unsupported file format</div>", session_state
    except Exception as e:
        return None, f"<div id='page_info_box'>File loading failed: {str(e)}</div>", session_state
    
    pdf_cache["images"] = pages
    pdf_cache["current_page"] = 0
    pdf_cache["total_pages"] = len(pages)
    pdf_cache["is_parsed"] = False
    pdf_cache["results"] = []
    pdf_cache["file_path"] = file_path
    pdf_cache["pixel_info"] = pixel_info
    
    # 返回缩放后的第一页图片用于预览
    preview_image = pages[0] if pages else None
    return preview_image, f"<div id='page_info_box'>1 / {len(pages)}</div>", pixel_info, session_state

def turn_page(direction, session_state):
    """Page turning function"""
    pdf_cache = session_state['pdf_cache']
    
    if not pdf_cache["images"]:
        return None, "<div id='page_info_box'>0 / 0</div>", "", pdf_cache.get("pixel_info", ""), session_state

    if direction == "prev":
        pdf_cache["current_page"] = max(0, pdf_cache["current_page"] - 1)
    elif direction == "next":
        pdf_cache["current_page"] = min(pdf_cache["total_pages"] - 1, pdf_cache["current_page"] + 1)

    index = pdf_cache["current_page"]
    current_image = pdf_cache["images"][index]  # 使用缩放后的图片
    page_info = f"<div id='page_info_box'>{index + 1} / {pdf_cache['total_pages']}</div>"
    
    current_json = ""
    if pdf_cache["is_parsed"] and index < len(pdf_cache["results"]):
        result = pdf_cache["results"][index]
        if 'cells_data' in result and result['cells_data']:
            try:
                current_json = json.dumps(result['cells_data'], ensure_ascii=False, indent=2)
            except:
                current_json = str(result.get('cells_data', ''))
        if 'layout_image' in result and result['layout_image']:
            current_image = result['layout_image']  # 如果有OCR结果，显示OCR处理后的图片
    
    return current_image, page_info, current_json, pdf_cache.get("pixel_info", ""), session_state

def ocr_current_page(session_state, prompt_mode, server_ip, server_port, min_pixels, max_pixels, fitz_preprocess=False, output_root="./ocr_outputs", max_image_width=None, max_image_height=None, max_total_pixels=None):
    """对PDF已预览的当前页执行OCR，仅处理当前页，并进行安全缩放以避免显存占用过高。"""
    # 更新配置与解析器参数
    current_config.update({
        'ip': server_ip,
        'port_vllm': int(server_port),
        'min_pixels': int(min_pixels),
        'max_pixels': int(max_pixels),
        'max_image_width': max_image_width or current_config['max_image_width'],
        'max_image_height': max_image_height or current_config['max_image_height'],
        'max_total_pixels': max_total_pixels or current_config['max_total_pixels']
    })
    dots_parser.ip = server_ip
    dots_parser.port = int(server_port)
    dots_parser.min_pixels = int(min_pixels)
    dots_parser.max_pixels = int(max_pixels)

    pdf_cache = session_state['pdf_cache']
    processing_results = session_state['processing_results']

    # 需要先有PDF预览
    if not pdf_cache["images"] or pdf_cache.get("file_type") != "pdf":
        page_info = "<div id='page_info_box'>0 / 0</div>"
        return None, "请先上传并预览一个PDF文件，然后再使用'OCR当前页'。", "", "", gr.update(visible=False), page_info, "", pdf_cache.get("pixel_info", ""), session_state

    index = pdf_cache["current_page"]
    total_pages = pdf_cache["total_pages"]
    original_image = pdf_cache["images"][index]  # 这里已经是缩放后的图片

    # 由于图片已经在load_file_for_preview时缩放过了，这里不需要再次缩放
    # 直接使用缩放后的图片进行OCR处理
    resized_image = original_image

    # 注意：当前页来自PDF渲染，已是按dpi生成的大图，如果再启用fitz_preprocess会再次按dpi放大，易触发显存爆。
    # 因此对于PDF当前页，强制关闭fitz_preprocess，保持与 parse_pdf 的处理路径一致（source='pdf' 不走fitz_preprocess）。
    use_fitz_preprocess = False

    parse_result = parse_image_with_high_level_api(dots_parser, resized_image, prompt_mode, use_fitz_preprocess)

    page_result = {
        'page_no': index,
        'layout_image': parse_result.get('layout_image'),
        'cells_data': parse_result.get('cells_data'),
        'md_content': parse_result.get('md_content'),
        'filtered': parse_result.get('filtered', False)
    }

    if len(pdf_cache['results']) < total_pages:
        pdf_cache['results'] = (pdf_cache['results'] + [{}] * (total_pages - len(pdf_cache['results'])))[:total_pages]
    pdf_cache['results'][index] = page_result
    pdf_cache['is_parsed'] = True

    processing_results.update({
        'original_image': original_image,
        'layout_result': parse_result.get('layout_image'),
        'markdown_content': parse_result.get('md_content'),
        'cells_data': parse_result.get('cells_data'),
        'temp_dir': parse_result.get('temp_dir'),
        'session_id': parse_result.get('session_id'),
        'result_paths': parse_result.get('result_paths')
    })

    num_elements = len(parse_result.get('cells_data') or [])
    info_text = (
        f"**当前页OCR信息：**\n- 页码: {index + 1} / {total_pages}\n- 服务器: {current_config['ip']}:{current_config['port_vllm']}\n- 检测到 {num_elements} 个布局元素\n- 会话ID: {parse_result.get('session_id')}"
    )
    page_info = f"<div id='page_info_box'>{index + 1} / {total_pages}</div>"
    current_json = json.dumps(parse_result.get('cells_data') or {}, ensure_ascii=False, indent=2) if parse_result.get('cells_data') else ""

    download_zip_path = None
    if parse_result.get('temp_dir'):
        download_zip_path = os.path.join(parse_result['temp_dir'], f"layout_results_{parse_result['session_id']}.zip")
        with zipfile.ZipFile(download_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(parse_result['temp_dir']):
                for file in files:
                    if not file.endswith('.zip'):
                        zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), parse_result['temp_dir']))

    md_content = parse_result.get('md_content') or "No markdown content generated"
    # 立刻保存当前页 .md（分页输出），文件名包含页码，便于断点续传
    try:
        file_path = pdf_cache.get('file_path')
        if file_path:
            _write_page_markdown(output_root, file_path, index + 1, md_content)
    except Exception as e:
        print(f"Failed to persist current page md: {e}")
    return (
        parse_result.get('layout_image'),
        info_text,
        md_content,
        md_content,
        gr.update(value=download_zip_path, visible=bool(download_zip_path)),
        page_info,
        current_json,
        pdf_cache.get("pixel_info", ""),
        session_state
    )

def get_test_images():
    """Gets the list of test images"""
    test_images = []
    test_dir = current_config['test_images_dir']
    if os.path.exists(test_dir):
        test_images = [os.path.join(test_dir, name) for name in os.listdir(test_dir) 
                      if name.lower().endswith(('.png', '.jpg', '.jpeg', '.pdf'))]
    return test_images

def create_temp_session_dir():
    """Creates a unique temporary directory for each processing request"""
    session_id = uuid.uuid4().hex[:8]
    temp_dir = os.path.join(tempfile.gettempdir(), f"dots_ocr_demo_{session_id}")
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir, session_id

def parse_image_with_high_level_api(parser, image, prompt_mode, fitz_preprocess=False):
    """
    Processes using the high-level API parse_image from DotsOCRParser
    """
    # Create a temporary session directory
    temp_dir, session_id = create_temp_session_dir()
    
    try:
        # Save the PIL Image as a temporary file
        temp_image_path = os.path.join(temp_dir, f"input_{session_id}.png")
        image.save(temp_image_path, "PNG")
        
        # Use the high-level API parse_image
        filename = f"demo_{session_id}"
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
    """
    Processes using the high-level API parse_pdf from DotsOCRParser
    """
    # Create a temporary session directory
    temp_dir, session_id = create_temp_session_dir()
    
    try:
        # Use the high-level API parse_pdf
        filename = f"demo_{session_id}"
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

# ==================== Core Processing Function ====================
def process_image_inference(session_state, test_image_input, file_input,
                          prompt_mode, server_ip, server_port, min_pixels, max_pixels,
                          fitz_preprocess=False, output_root="./ocr_outputs", 
                          max_image_width=None, max_image_height=None, max_total_pixels=None
                          ):
    """Core function to handle image/PDF inference"""
    # Use session_state instead of global variables
    processing_results = session_state['processing_results']
    pdf_cache = session_state['pdf_cache']
    
    if processing_results.get('temp_dir') and os.path.exists(processing_results['temp_dir']):
        try:
            shutil.rmtree(processing_results['temp_dir'], ignore_errors=True)
        except Exception as e:
            print(f"Failed to clean up previous temporary directory: {e}")
    
    # Reset processing results for the current session
    session_state['processing_results'] = get_initial_session_state()['processing_results']
    processing_results = session_state['processing_results']
    
    current_config.update({
        'ip': server_ip,
        'port_vllm': server_port,
        'min_pixels': min_pixels,
        'max_pixels': max_pixels,
        'max_image_width': max_image_width or current_config['max_image_width'],
        'max_image_height': max_image_height or current_config['max_image_height'],
        'max_total_pixels': max_total_pixels or current_config['max_total_pixels']
    })
    
    # Update parser configuration
    dots_parser.ip = server_ip
    dots_parser.port = server_port
    dots_parser.min_pixels = min_pixels
    dots_parser.max_pixels = max_pixels
    
    input_file_path = file_input if file_input else test_image_input
    
    if not input_file_path:
        return None, "Please upload image/PDF file or select test image", "", "", gr.update(value=None), None, "", "", session_state
    
    file_ext = os.path.splitext(input_file_path)[1].lower()
    
    try:
        if file_ext == '.pdf':
            # 改为按页顺序增量解析 + 立即保存
            return parse_pdf_incremental_and_save(dots_parser, input_file_path, prompt_mode, session_state, output_root)
        
        else: # Image processing
            image = read_image_v2(input_file_path)  # 这里已经应用了大小限制
            session_state['pdf_cache'] = get_initial_session_state()['pdf_cache']
            
            original_image = image  # 这里已经是缩放后的图片
            parse_result = parse_image_with_high_level_api(dots_parser, image, prompt_mode, fitz_preprocess)
            
            if parse_result['filtered']:
                 info_text = f"**Image Information:**\n- Original Size: {original_image.width} x {original_image.height}\n- Processing: JSON parsing failed, using cleaned text output\n- Server: {current_config['ip']}:{current_config['port_vllm']}\n- Session ID: {parse_result['session_id']}"
                 processing_results.update({
                     'original_image': original_image, 'markdown_content': parse_result['md_content'],
                     'temp_dir': parse_result['temp_dir'], 'session_id': parse_result['session_id'],
                     'result_paths': parse_result['result_paths']
                 })
                 return original_image, info_text, parse_result['md_content'], parse_result['md_content'], gr.update(visible=False), None, "", "", session_state
            
            md_content_raw = parse_result['md_content'] or "No markdown content generated"
            processing_results.update({
                'original_image': original_image, 'layout_result': parse_result['layout_image'],
                'markdown_content': parse_result['md_content'], 'cells_data': parse_result['cells_data'],
                'temp_dir': parse_result['temp_dir'], 'session_id': parse_result['session_id'],
                'result_paths': parse_result['result_paths']
            })
            
            num_elements = len(parse_result['cells_data']) if parse_result['cells_data'] else 0
            info_text = f"**Image Information:**\n- Original Size: {original_image.width} x {original_image.height}\n- Model Input Size: {parse_result['input_width']} x {parse_result['input_height']}\n- Server: {current_config['ip']}:{current_config['port_vllm']}\n- Detected {num_elements} layout elements\n- Session ID: {parse_result['session_id']}"
            
            current_json = json.dumps(parse_result['cells_data'], ensure_ascii=False, indent=2) if parse_result['cells_data'] else ""
            
            download_zip_path = None
            if parse_result['temp_dir']:
                download_zip_path = os.path.join(parse_result['temp_dir'], f"layout_results_{parse_result['session_id']}.zip")
                with zipfile.ZipFile(download_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, _, files in os.walk(parse_result['temp_dir']):
                        for file in files:
                            if not file.endswith('.zip'): zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), parse_result['temp_dir']))
            
            return (
                parse_result['layout_image'], info_text, parse_result['md_content'] or "No markdown content generated",
                md_content_raw, gr.update(value=download_zip_path, visible=bool(download_zip_path)),
                None, current_json, "", session_state
            )
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"Error during processing: {e}", "", "", gr.update(value=None), None, "", "", session_state

# MINIMAL CHANGE: Functions now take `session_state` as an argument.
def clear_all_data(session_state):
    """Clears all data"""
    processing_results = session_state['processing_results']
    
    if processing_results.get('temp_dir') and os.path.exists(processing_results['temp_dir']):
        try:
            shutil.rmtree(processing_results['temp_dir'], ignore_errors=True)
        except Exception as e:
            print(f"Failed to clean up temporary directory: {e}")
    
    # Reset the session state by returning a new initial state
    new_session_state = get_initial_session_state()
    
    return (
        None,  # Clear file input
        "",    # Clear test image selection
        None,  # Clear result image
        "Waiting for processing results...",  # Reset info display
        "## Waiting for processing results...",  # Reset Markdown display
        "🕐 Waiting for parsing result...",    # Clear raw Markdown text
        gr.update(visible=False),  # Hide download button
        "<div id='page_info_box'>0 / 0</div>",  # Reset page info
        "🕐 Waiting for parsing result...",     # Clear current page JSON
        "",  # Clear pixel info display
        new_session_state
    )

def update_prompt_display(prompt_mode):
    """Updates the prompt display content"""
    return dict_promptmode_to_prompt[prompt_mode]

def get_default_qa_prompt():
    return (
        "你是一个资深的知识工程师。基于给定知识片段，生成高质量问答对。\n"
        "要求：\n"
        "- 覆盖关键事实、概念、边界条件；\n"
        "- 问题应简洁清晰，答案准确可验证；\n"
        "- 输出严格为JSON数组，每个元素包含 question, answer 两个字段；\n"
        "- 不要添加任何额外说明。\n"
        "示例输出：\n"
        "[{\"question\": \"...\", \"answer\": \"...\"}]\n"
    )

def _extract_json_array(text):
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    import re
    patterns = [
        r"```json\s*(\[.*?\])\s*```",
        r"```\s*(\[.*?\])\s*```",
        r"(\[\s*\{[\s\S]*\}\s*\])"
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            try:
                arr = json.loads(m.group(1))
                if isinstance(arr, list):
                    return arr
            except Exception:
                continue
    return None

def _qa_list_to_markdown(qa_list):
    lines = ["## 生成的问答对"]
    for i, qa in enumerate(qa_list, 1):
        q = qa.get('question', '').strip()
        a = qa.get('answer', '').strip()
        lines.append(f"{i}. 问：{q}")
        lines.append(f"   答：{a}")
    return "\n\n".join(lines)

def generate_qa_with_deepseek(session_state, knowledge_text, qa_prompt, num_pairs, deepseek_api_key, deepseek_base_url, deepseek_model):
    knowledge_text = (knowledge_text or "").strip()
    qa_prompt = (qa_prompt or get_default_qa_prompt()).strip()
    num_pairs = int(num_pairs or 5)
    if not knowledge_text:
        return "请先提供用于出题的知识文本。", "", gr.update(visible=False), session_state

    api_key = (deepseek_api_key or current_config.get('deepseek_api_key') or os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        return "未检测到 DeepSeek API Key，请在左侧填写或设置环境变量 DEEPSEEK_API_KEY。", "", gr.update(visible=False), session_state

    base_url = (deepseek_base_url or current_config['deepseek_base_url']).strip()
    model = (deepseek_model or current_config['deepseek_model']).strip()

    system_prompt = qa_prompt + f"\n\n请基于以下知识生成 {num_pairs} 组问答对，并严格以JSON数组输出：\n"
    user_content = knowledge_text[:15000]

    client = OpenAI(api_key=api_key, base_url=base_url)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            top_p=0.9,
            max_completion_tokens=4096,
        )
        content = resp.choices[0].message.content
    except Exception as e:
        return f"生成失败：{e}", "", gr.update(visible=False), session_state

    qa_list = _extract_json_array(content) or []
    if not qa_list:
        # 回退，尽量包装为单一Q&A
        qa_list = [{"question": "基于上述知识的综合问答", "answer": content.strip()}]

    qa_md = _qa_list_to_markdown(qa_list)
    qa_json_str = json.dumps(qa_list, ensure_ascii=False, indent=2)

    # 保存为临时文件，提供下载
    temp_dir, session_id = create_temp_session_dir()
    out_path = os.path.join(temp_dir, f"qa_{session_id}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(qa_json_str)

    session_state['qa_results'] = {
        'qa_markdown': qa_md,
        'qa_json': qa_json_str,
        'download_path': out_path,
    }
    return qa_md, qa_json_str, gr.update(value=out_path, visible=True), session_state

def fill_knowledge_from_current_json(session_state):
    try:
        data = session_state['pdf_cache']
        idx = data.get('current_page', 0)
        if data.get('is_parsed') and data.get('results') and idx < len(data['results']):
            cells = data['results'][idx].get('cells_data')
        else:
            cells = session_state['processing_results'].get('cells_data')
        return json.dumps(cells or {}, ensure_ascii=False, indent=2)
    except Exception:
        return ""

def passthrough_md(md_text):
    return md_text or ""

def save_markdown_to_file(session_state, md_text):
    """Save current OCR markdown to a temporary .md file and expose it via DownloadButton."""
    import gradio as gr
    md = (md_text or "").strip()
    if not md:
        md = (session_state.get('processing_results', {}).get('markdown_content') or "").strip()
    if not md:
        return gr.update(visible=False)

    temp_dir = session_state.get('processing_results', {}).get('temp_dir')
    session_id = session_state.get('processing_results', {}).get('session_id')
    if not temp_dir or not session_id or not os.path.exists(temp_dir):
        temp_dir, session_id = create_temp_session_dir()
    out_path = os.path.join(temp_dir, f"ocr_{session_id}.md")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(md)
    return gr.update(value=out_path, visible=True)

def _ensure_doc_output_dir(output_root, file_path):
    base = os.path.splitext(os.path.basename(file_path))[0]
    target_dir = os.path.join(output_root or "./ocr_outputs", base)
    os.makedirs(target_dir, exist_ok=True)
    return base, target_dir

def _write_page_markdown(output_root, file_path, page_no_1based, md_content):
    if not md_content:
        return None
    base, target_dir = _ensure_doc_output_dir(output_root, file_path)
    out_path = os.path.join(target_dir, f"{base}_page_{int(page_no_1based):04d}.md")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    return out_path

def _detect_last_saved_page(output_root, file_path):
    base, target_dir = _ensure_doc_output_dir(output_root, file_path)
    try:
        files = [name for name in os.listdir(target_dir) if name.startswith(f"{base}_page_") and name.endswith('.md')]
    except Exception:
        files = []
    page_nums = []
    for name in files:
        try:
            num = int(name.rsplit('_page_', 1)[1].split('.md')[0])
            page_nums.append(num)
        except Exception:
            continue
    return max(page_nums) if page_nums else 0

def _persist_pdf_results_per_page(output_root, file_path, parsed_results):
    last_out_path = None
    for page in parsed_results:
        page_no_1 = int(page.get('page_no', 0)) + 1
        md = page.get('md_content') or ""
        last_out_path = _write_page_markdown(output_root, file_path, page_no_1, md)
    return last_out_path

def resume_ocr_from_checkpoint(session_state, prompt_mode, server_ip, server_port, min_pixels, max_pixels, output_root, max_image_width=None, max_image_height=None, max_total_pixels=None):
    """断点OCR续传：
    - 根据输出目录中已存在的分页 .md 文件，检测最后一页编号；
    - 重新识别最后一页（校对覆盖）；
    - 继续识别后续所有未完成页；
    - 每识别一页立即保存为独立 .md 文件。
    返回：更新UI，展示最后处理页的信息与内容。
    """
    # 更新配置与解析器参数
    current_config.update({
        'ip': server_ip,
        'port_vllm': int(server_port),
        'min_pixels': int(min_pixels),
        'max_pixels': int(max_pixels),
        'max_image_width': max_image_width or current_config['max_image_width'],
        'max_image_height': max_image_height or current_config['max_image_height'],
        'max_total_pixels': max_total_pixels or current_config['max_total_pixels']
    })
    dots_parser.ip = server_ip
    dots_parser.port = int(server_port)
    dots_parser.min_pixels = int(min_pixels)
    dots_parser.max_pixels = int(max_pixels)

    pdf_cache = session_state.get('pdf_cache', {})
    file_path = pdf_cache.get('file_path')
    if not file_path or pdf_cache.get('file_type') != 'pdf' or not pdf_cache.get('images'):
        return None, "请先在左侧上传并预览一个PDF后再执行断点续传。", "", "", gr.update(visible=False), "<div id='page_info_box'>0 / 0</div>", "", pdf_cache.get("pixel_info", ""), session_state

    total_pages = int(pdf_cache.get('total_pages') or 0)
    if total_pages <= 0:
        return None, "PDF页数无效。", "", "", gr.update(visible=False), "<div id='page_info_box'>0 / 0</div>", "", pdf_cache.get("pixel_info", ""), session_state

    # 检测最后已保存页（1-based）；0 表示未保存任何页
    last_saved = _detect_last_saved_page(output_root, file_path)
    start_index = max(0, int(last_saved) - 1)

    last_result = None
    for page_idx in range(start_index, total_pages):
        origin_image = pdf_cache['images'][page_idx]  # 这里已经是缩放后的图片
        # 由于图片已经在load_file_for_preview时缩放过了，这里不需要再次缩放
        image_resized = origin_image
        result = parse_image_with_high_level_api(dots_parser, image_resized, prompt_mode, fitz_preprocess=False)

        # 更新缓存
        page_entry = {
            'page_no': page_idx,
            'layout_image': result.get('layout_image'),
            'cells_data': result.get('cells_data'),
            'md_content': result.get('md_content'),
            'filtered': result.get('filtered', False)
        }
        if len(pdf_cache.get('results', [])) < total_pages:
            pdf_cache['results'] = (pdf_cache.get('results', []) + [{}] * (total_pages - len(pdf_cache.get('results', []))))[:total_pages]
        pdf_cache['results'][page_idx] = page_entry
        pdf_cache['is_parsed'] = True
        session_state['pdf_cache'] = pdf_cache

        # 立即分页保存（覆盖最后一页，继续保存后续页）
        _write_page_markdown(output_root, file_path, page_idx + 1, result.get('md_content') or "")
        last_result = (page_idx, result)

    if last_result is None:
        return None, "未处理任何页面。", "", "", gr.update(visible=False), f"<div id='page_info_box'>0 / {total_pages}</div>", "", pdf_cache.get("pixel_info", ""), session_state

    # 展示最后处理页
    last_idx, parse_result = last_result
    num_elements = len(parse_result.get('cells_data') or [])
    info_text = (
        f"**断点续传完成：**\\n- 最后处理页: {last_idx + 1} / {total_pages}\\n- 服务器: {current_config['ip']}:{current_config['port_vllm']}\\n- 检测到 {num_elements} 个布局元素\\n- 会话ID: {parse_result.get('session_id')}"
    )
    page_info = f"<div id='page_info_box'>{last_idx + 1} / {total_pages}</div>"
    current_json = json.dumps(parse_result.get('cells_data') or {}, ensure_ascii=False, indent=2) if parse_result.get('cells_data') else ""
    md_content = parse_result.get('md_content') or "No markdown content generated"

    return (
        parse_result.get('layout_image'),
        info_text,
        md_content,
        md_content,
        gr.update(visible=False),
        page_info,
        current_json,
        session_state
    )

def parse_pdf_incremental_and_save(parser, pdf_path, prompt_mode, session_state, output_root):
    """顺序逐页解析PDF，保证每页完成后立即写出 .md 文件并更新缓存。"""
    # 预览准备（保持与现有行为一致）
    preview_image, page_info, pixel_info, session_state = load_file_for_preview(pdf_path, session_state)
    pdf_cache = session_state['pdf_cache']
    total_pages = pdf_cache['total_pages']
    results = []
    combined_md_list = []

    # 确保 results 列表大小
    pdf_cache['results'] = [{} for _ in range(total_pages)]

    for i in range(total_pages):
        origin_image = pdf_cache['images'][i]  # 这里已经是缩放后的图片
        # 对PDF页禁用fitz_preprocess，避免二次放大
        parse_result = parse_image_with_high_level_api(parser, origin_image, prompt_mode, fitz_preprocess=False)
        page_result = {
            'page_no': i,
            'layout_image': parse_result.get('layout_image'),
            'cells_data': parse_result.get('cells_data'),
            'md_content': parse_result.get('md_content'),
            'filtered': parse_result.get('filtered', False)
        }
        results.append(page_result)
        pdf_cache['results'][i] = page_result
        pdf_cache['is_parsed'] = True

        md = parse_result.get('md_content') or ""
        if md:
            combined_md_list.append(md)
        # 关键：每页结束立即写文件
        _write_page_markdown(output_root, pdf_path, i + 1, md)

    combined_md = "\n\n---\n\n".join(combined_md_list) if combined_md_list else ""
    session_state['processing_results'].update({
        'markdown_content': combined_md,
        'cells_data': sum([r.get('cells_data') or [] for r in results], []),
        'pdf_results': results,
    })

    # 输出与原流程对齐
    info_text = f"**PDF Information:**\n- Total Pages: {total_pages}\n- Server: {current_config['ip']}:{current_config['port_vllm']}\n- Total Detected Elements: {len(session_state['processing_results']['cells_data'])}\n- Session ID: {session_state['processing_results'].get('session_id') or ''}"
    current_page_layout_image = preview_image
    current_page_json = ""
    first_result = results[0] if results else {}
    if first_result.get('layout_image'):
        current_page_layout_image = first_result['layout_image']
    if first_result.get('cells_data'):
        try:
            current_page_json = json.dumps(first_result['cells_data'], ensure_ascii=False, indent=2)
        except Exception:
            current_page_json = str(first_result['cells_data'])
    return (
        current_page_layout_image,
        info_text,
        combined_md or "No markdown content generated",
        combined_md or "No markdown content generated",
        None,
        page_info,
        current_page_json,
        pixel_info,
        session_state,
    )

# ==================== Gradio Interface ====================
def create_gradio_interface():
    """Creates the Gradio interface"""
    
    # CSS styles, matching the reference style
    css = """

    #parse_button {
        background: #FF576D !important; /* !important 确保覆盖主题默认样式 */
        border-color: #FF576D !important;
    }
    /* 鼠标悬停时的颜色 */
    #parse_button:hover {
        background: #F72C49 !important;
        border-color: #F72C49 !important;
    }
    
    #page_info_html {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        margin: 0 12px;
    }

    #page_info_box {
        padding: 8px 20px;
        font-size: 16px;
        border: 1px solid #bbb;
        border-radius: 8px;
        background-color: #f8f8f8;
        text-align: center;
        min-width: 80px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    #markdown_output {
        min-height: 800px;
        overflow: auto;
    }

    footer {
        visibility: hidden;
    }
    
    #info_box {
        padding: 10px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #dee2e6;
        margin: 10px 0;
        font-size: 14px;
    }
    
    #result_image {
        border-radius: 8px;
    }
    
    #markdown_tabs {
        height: 100%;
    }
    """
    
    with gr.Blocks(theme="ocean", css=css, title='dots.ocr') as demo:
        session_state = gr.State(value=get_initial_session_state())
        
        # Title
        gr.HTML("""
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 2em;">🔍 dots.ocr</h1>
            </div>
            <div style="text-align: center; margin-bottom: 10px;">
                <em>Supports image/PDF layout analysis and structured output</em>
            </div>
        """)
        
        with gr.Row():
            # Left side: Input and Configuration
            with gr.Column(scale=1, elem_id="left-panel"):
                gr.Markdown("### 📥 Upload & Select")
                file_input = gr.File(
                    label="Upload PDF/Image", 
                    type="filepath", 
                    file_types=[".pdf", ".jpg", ".jpeg", ".png"],
                )
                
                test_images = get_test_images()
                test_image_input = gr.Dropdown(
                    label="Or Select an Example",
                    choices=[""] + test_images,
                    value="",
                )

                gr.Markdown("### ⚙️ Prompt & Actions")
                prompt_mode = gr.Dropdown(
                    label="Select Prompt",
                    choices=["prompt_layout_all_en", "prompt_layout_only_en", "prompt_ocr"],
                    value="prompt_layout_all_en",
                )
                
                # Display current prompt content
                prompt_display = gr.Textbox(
                    label="Current Prompt Content",
                    value=dict_promptmode_to_prompt[list(dict_promptmode_to_prompt.keys())[0]],
                    lines=4,
                    max_lines=8,
                    interactive=False,
                    show_copy_button=True
                )
                
                with gr.Row():
                    process_btn = gr.Button("🔍 Parse", variant="primary", scale=2, elem_id="parse_button")
                    clear_btn = gr.Button("🗑️ Clear", variant="secondary", scale=1)
                
                with gr.Accordion("🛠️ Advanced Configuration", open=False):
                    fitz_preprocess = gr.Checkbox(
                        label="Enable fitz_preprocess for images", 
                        value=True,
                        info="Processes image via a PDF-like pipeline (image->pdf->200dpi image). Recommended if your image DPI is low."
                    )
                    with gr.Row():
                        server_ip = gr.Textbox(label="Server IP", value=DEFAULT_CONFIG['ip'])
                        server_port = gr.Number(label="Port", value=DEFAULT_CONFIG['port_vllm'], precision=0)
                    with gr.Row():
                        min_pixels = gr.Number(label="Min Pixels", value=DEFAULT_CONFIG['min_pixels'], precision=0)
                        max_pixels = gr.Number(label="Max Pixels", value=DEFAULT_CONFIG['max_pixels'], precision=0)
                    
                    # Image size limitation settings
                    gr.Markdown("**图片大小限制设置 (确保最长边不超过1500像素，避免显存占用过高):**")
                    with gr.Row():
                        max_image_width = gr.Number(label="最大宽度", value=DEFAULT_CONFIG['max_image_width'], precision=0)
                        max_image_height = gr.Number(label="最大高度", value=DEFAULT_CONFIG['max_image_height'], precision=0)
                    max_total_pixels = gr.Number(label="最大总像素数", value=DEFAULT_CONFIG['max_total_pixels'], precision=0, 
                                               info="超过此限制的图片将被自动缩放，确保最长边不超过1500像素")
                    
                    with gr.Row():
                        output_root = gr.Textbox(label="输出根目录(分页保存)", value="./ocr_outputs")
            # Right side: Result Display
            with gr.Column(scale=6, variant="compact"):
                with gr.Row():
                    # Result Image
                    with gr.Column(scale=3):
                        gr.Markdown("### 👁️ 文件预览 (缩放后效果)")
                        result_image = gr.Image(
                            label="Layout Preview",
                            visible=True,
                            height=800,
                            show_label=False
                        )
                        
                        # Pixel Info Display
                        pixel_info_display = gr.HTML(
                            value="",
                            elem_id="pixel_info_display"
                        )
                        
                        # Page navigation (shown during PDF preview)
                        with gr.Row():
                            prev_btn = gr.Button("⬅ Previous", size="sm")
                            page_info = gr.HTML(
                                value="<div id='page_info_box'>0 / 0</div>", 
                                elem_id="page_info_html"
                            )
                            next_btn = gr.Button("Next ➡", size="sm")
                            ocr_current_btn = gr.Button("📝 OCR当前页", size="sm")
                        
                        # Info Display
                        info_display = gr.Markdown(
                            "Waiting for processing results...",
                            elem_id="info_box"
                        )
                    
                    # Markdown Result
                    with gr.Column(scale=3):
                        gr.Markdown("### ✔️ Result Display")
                        
                        with gr.Tabs(elem_id="markdown_tabs"):
                            with gr.TabItem("Markdown Render Preview"):
                                md_output = gr.Markdown(
                                    "## Please click the parse button to parse or select for single-task recognition...",
                                    max_height=600,
                                    latex_delimiters=[
                                        {"left": "$$", "right": "$$", "display": True},
                                        {"left": "$", "right": "$", "display": False}
                                    ],
                                    show_copy_button=False,
                                    elem_id="markdown_output"
                                )
                            
                            with gr.TabItem("Markdown Raw Text"):
                                md_raw_output = gr.Textbox(
                                    value="🕐 Waiting for parsing result...",
                                    label="Markdown Raw Text",
                                    max_lines=100,
                                    lines=38,
                                    show_copy_button=True,
                                    elem_id="markdown_output",
                                    show_label=False
                                )
                                save_current_page_btn = gr.Button("💾 保存当前页为 .md", size="sm")
                                md_perpage_download_btn = gr.DownloadButton("⬇️ 下载当前页 .md", visible=False)
                                resume_btn = gr.Button("⏩ 断点OCR续传", size="sm")
                            
                            with gr.TabItem("Current Page JSON"):
                                current_page_json = gr.Textbox(
                                    value="🕐 Waiting for parsing result...",
                                    label="Current Page JSON",
                                    max_lines=100,
                                    lines=38,
                                    show_copy_button=True,
                                    elem_id="markdown_output",
                                    show_label=False
                                )

                            with gr.TabItem("问答对生成"):
                                with gr.Row():
                                    with gr.Column(scale=1):
                                        qa_api_key = gr.Textbox(label="DeepSeek API Key", type="password", value=DEFAULT_CONFIG['deepseek_api_key'])
                                        qa_model = gr.Textbox(label="Model", value=DEFAULT_CONFIG['deepseek_model'])
                                        qa_base_url = gr.Textbox(label="Base URL", value=DEFAULT_CONFIG['deepseek_base_url'])
                                        qa_num_pairs = gr.Number(label="数量", value=5, precision=0)
                                    with gr.Column(scale=2):
                                        qa_prompt = gr.Textbox(
                                            label="问答对提示词(可编辑)",
                                            value=get_default_qa_prompt(),
                                            lines=8,
                                            max_lines=16,
                                            show_copy_button=True
                                        )
                                with gr.Row():
                                    with gr.Column(scale=1):
                                        fill_from_json_btn = gr.Button("从当前页JSON填充知识")
                                        fill_from_md_btn = gr.Button("从Markdown填充知识")
                                    with gr.Column(scale=2):
                                        qa_knowledge = gr.Textbox(
                                            label="用于出题的知识文本(可编辑)",
                                            lines=14,
                                            max_lines=24,
                                            show_copy_button=True
                                        )
                                with gr.Row():
                                    gen_qa_btn = gr.Button("⚙️ 生成问答对", variant="primary")
                                    qa_download_btn = gr.DownloadButton("⬇️ 下载JSON", visible=False)
                                with gr.Row():
                                    qa_md_preview = gr.Markdown("## 生成的问答对将展示在这里")
                                    qa_json_preview = gr.Textbox(label="JSON 预览", lines=18, show_copy_button=True)
                
                # Download Button
                with gr.Row():
                    download_btn = gr.DownloadButton(
                        "⬇️ Download Results",
                        visible=False
                    )
                with gr.Row():
                    save_md_btn = gr.Button("💾 保存为 Markdown", variant="secondary")
                    md_download_btn = gr.DownloadButton("⬇️ 下载Markdown", visible=False)
        
        # When the prompt mode changes, update the display content
        prompt_mode.change(
            fn=update_prompt_display,
            inputs=prompt_mode,
            outputs=prompt_display,
        )
        
        # Show preview on file upload
        file_input.upload(
            # fn=lambda file_data, state: load_file_for_preview(file_data, state),
            fn=load_file_for_preview,
            inputs=[file_input, session_state],
            outputs=[result_image, page_info, pixel_info_display, session_state]
        )
        
        # Also handle test image selection
        test_image_input.change(
            # fn=lambda path, state: load_file_for_preview(path, state),
            fn=load_file_for_preview,
            inputs=[test_image_input, session_state],
            outputs=[result_image, page_info, pixel_info_display, session_state]
        )

        prev_btn.click(
            fn=lambda s: turn_page("prev", s),
            inputs=[session_state], 
            outputs=[result_image, page_info, current_page_json, pixel_info_display, session_state]
        )
        
        next_btn.click(
            fn=lambda s: turn_page("next", s),
            inputs=[session_state], 
            outputs=[result_image, page_info, current_page_json, pixel_info_display, session_state]
        )

        ocr_current_btn.click(
            fn=ocr_current_page,
            inputs=[session_state, prompt_mode, server_ip, server_port, min_pixels, max_pixels, fitz_preprocess, output_root, max_image_width, max_image_height, max_total_pixels],
            outputs=[result_image, info_display, md_output, md_raw_output, download_btn, page_info, current_page_json, pixel_info_display, session_state]
        )

        def _save_current_page_md(session_state, md_raw_text, output_root):
            data = session_state.get('pdf_cache', {})
            file_path = data.get('file_path')
            idx = int(data.get('current_page', 0))
            md = (md_raw_text or "").strip()
            if not md:
                # fallback to processing_results
                md = (session_state.get('processing_results', {}).get('markdown_content') or "").strip()
            if not md or not file_path:
                return gr.update(visible=False)
            out = _write_page_markdown(output_root, file_path, idx + 1, md)
            return gr.update(value=out, visible=True)

        save_current_page_btn.click(
            fn=_save_current_page_md,
            inputs=[session_state, md_raw_output, output_root],
            outputs=[md_perpage_download_btn]
        )

        resume_btn.click(
            fn=resume_ocr_from_checkpoint,
            inputs=[session_state, prompt_mode, server_ip, server_port, min_pixels, max_pixels, output_root, max_image_width, max_image_height, max_total_pixels],
            outputs=[result_image, info_display, md_output, md_raw_output, download_btn, page_info, current_page_json, pixel_info_display, session_state]
        )
        
        process_btn.click(
            fn=process_image_inference,
            inputs=[
                session_state, test_image_input, file_input,
                prompt_mode, server_ip, server_port, min_pixels, max_pixels, 
                fitz_preprocess, output_root, max_image_width, max_image_height, max_total_pixels
            ],
            outputs=[
                result_image, info_display, md_output, md_raw_output,
                download_btn, page_info, current_page_json, pixel_info_display, session_state
            ]
        )

        # QA tab interactions
        fill_from_json_btn.click(
            fn=fill_knowledge_from_current_json,
            inputs=[session_state],
            outputs=[qa_knowledge]
        )

        fill_from_md_btn.click(
            fn=passthrough_md,
            inputs=[md_raw_output],
            outputs=[qa_knowledge]
        )

        gen_qa_btn.click(
            fn=generate_qa_with_deepseek,
            inputs=[session_state, qa_knowledge, qa_prompt, qa_num_pairs, qa_api_key, qa_base_url, qa_model],
            outputs=[qa_md_preview, qa_json_preview, qa_download_btn, session_state]
        )

        save_md_btn.click(
            fn=save_markdown_to_file,
            inputs=[session_state, md_raw_output],
            outputs=[md_download_btn]
        )
        
        clear_btn.click(
            fn=clear_all_data,
            inputs=[session_state],
            outputs=[
                file_input, test_image_input,
                result_image, info_display, md_output, md_raw_output,
                download_btn, page_info, current_page_json, pixel_info_display, session_state
            ]
        )
    
    return demo

# ==================== Main Program ====================
if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7860
    demo = create_gradio_interface()
    demo.queue().launch(
        server_name="0.0.0.0", 
        server_port=port, 
        debug=True
    )
