#!/usr/bin/env python3
"""
DotsOCR API 客户端测试脚本

用于测试批量OCR和实时OCR API服务
"""

import requests
import json
import os
import time
from pathlib import Path

# API配置
BATCH_API_URL = "http://localhost:5003"
REALTIME_API_URL = "http://localhost:5004"

def test_health_check():
    """测试健康检查"""
    print("=== 测试健康检查 ===")
    
    for url in [BATCH_API_URL, REALTIME_API_URL]:
        try:
            response = requests.get(f"{url}/health")
            print(f"{url}: {response.json()}")
        except Exception as e:
            print(f"{url}: 连接失败 - {e}")

def test_config():
    """测试配置信息"""
    print("\n=== 测试配置信息 ===")
    
    for url in [BATCH_API_URL, REALTIME_API_URL]:
        try:
            response = requests.get(f"{url}/config")
            config = response.json()
            print(f"{url}:")
            print(f"  当前配置: {config['current_config']}")
            print(f"  可用提示模式: {config['available_prompt_modes']}")
        except Exception as e:
            print(f"{url}: 连接失败 - {e}")

def test_realtime_ocr(file_path):
    """测试实时OCR API"""
    print(f"\n=== 测试实时OCR API ===")
    print(f"文件: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"文件不存在: {file_path}")
        return
    
    try:
        # 准备文件上传
        with open(file_path, 'rb') as f:
            files = {'file': (os.path.basename(file_path), f, 'application/octet-stream')}
            
            data = {
                'prompt_mode': 'prompt_layout_all_en',
                'server_ip': '127.0.0.1',
                'server_port': 8000,
                'min_pixels': 100000,
                'max_pixels': 1000000,
                'fitz_preprocess': False,
                'max_image_width': 1300,
                'max_image_height': 1300,
                'max_total_pixels': 1690000
            }
            
            # 发送请求
            start_time = time.time()
            response = requests.post(f"{REALTIME_API_URL}/realtime/ocr", files=files, data=data)
            end_time = time.time()
            
            print(f"响应时间: {end_time - start_time:.2f}秒")
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                if result['success']:
                    data = result['data']
                    print(f"处理成功!")
                    print(f"文件类型: {data['file_type']}")
                    
                    if data['file_type'] == 'pdf':
                        print(f"总页数: {data['total_pages']}")
                        print(f"像素信息: {data['pixel_info']}")
                        print(f"Markdown内容长度: {len(data['combined_md_content'])}")
                    else:
                        print(f"像素信息: {data['pixel_info']}")
                        print(f"Markdown内容长度: {len(data['md_content'])}")
                else:
                    print(f"处理失败: {result['error']}")
            else:
                print(f"请求失败: {response.text}")
                
    except Exception as e:
        print(f"测试失败: {e}")

def test_batch_ocr(file_paths):
    """测试批量OCR API"""
    print(f"\n=== 测试批量OCR API ===")
    print(f"文件数量: {len(file_paths)}")
    
    # 检查文件是否存在
    existing_files = []
    for file_path in file_paths:
        if os.path.exists(file_path):
            existing_files.append(file_path)
        else:
            print(f"文件不存在: {file_path}")
    
    if not existing_files:
        print("没有可用的文件进行测试")
        return
    
    try:
        # 准备请求数据
        request_data = {
            'files': existing_files,
            'prompt_mode': 'prompt_layout_all_en',
            'server_ip': '127.0.0.1',
            'server_port': 8000,
            'min_pixels': 100000,
            'max_pixels': 1000000,
            'fitz_preprocess': False,
            'max_image_width': 1300,
            'max_image_height': 1300,
            'max_total_pixels': 1690000
        }
        
        # 发送请求
        start_time = time.time()
        response = requests.post(f"{BATCH_API_URL}/batch/ocr", json=request_data)
        end_time = time.time()
        
        print(f"响应时间: {end_time - start_time:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                data = result['data']
                print(f"批量处理成功!")
                print(f"总文件数: {data['total_files']}")
                print(f"成功数量: {data['successful_count']}")
                print(f"失败数量: {data['failed_count']}")
                print(f"总像素数: {data['total_pixels']:,}")
                print(f"估算总显存: {data['estimated_total_memory_mb']:.1f} MB")
                
                # 显示每个文件的处理结果
                for i, file_result in enumerate(data['results']):
                    print(f"\n文件 {i+1}: {file_result['file_path']}")
                    if file_result['success']:
                        print(f"  状态: 成功")
                        print(f"  类型: {file_result['file_type']}")
                        if file_result['file_type'] == 'pdf':
                            print(f"  页数: {file_result['total_pages']}")
                        print(f"  像素信息: {file_result['pixel_info']}")
                    else:
                        print(f"  状态: 失败")
                        print(f"  错误: {file_result['error']}")
            else:
                print(f"批量处理失败: {result['error']}")
        else:
            print(f"请求失败: {response.text}")
            
    except Exception as e:
        print(f"测试失败: {e}")

def main():
    """主函数"""
    print("DotsOCR API 客户端测试")
    print("=" * 50)
    
    # 测试健康检查
    test_health_check()
    
    # 测试配置信息
    test_config()
    
    # 测试文件路径
    test_files = [
        # 添加您的测试文件路径
        # "path/to/test/image.jpg",
        # "path/to/test/document.pdf",
    ]
    
    if test_files:
        # 测试实时OCR
        if len(test_files) > 0:
            test_realtime_ocr(test_files[0])
        
        # 测试批量OCR
        if len(test_files) > 1:
            test_batch_ocr(test_files)
        else:
            test_batch_ocr(test_files)
    else:
        print("\n请编辑脚本中的 test_files 列表，添加您的测试文件路径")
        print("示例:")
        print("test_files = [")
        print("    'path/to/test/image.jpg',")
        print("    'path/to/test/document.pdf',")
        print("]")

if __name__ == "__main__":
    main()
