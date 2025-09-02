#!/usr/bin/env python3
"""
DotsOCR 完整系统启动脚本

同时启动API服务和Gradio测试界面
"""

import subprocess
import sys
import time
import os
import signal
import threading
from pathlib import Path

def start_server(script_name, args=None, port=None):
    """启动指定脚本"""
    try:
        cmd = [sys.executable, script_name]
        if args:
            cmd.extend(args)
        
        print(f"启动 {script_name}...")
        process = subprocess.Popen(cmd, cwd=os.getcwd())
        return process
    except Exception as e:
        print(f"启动 {script_name} 失败: {e}")
        return None

def check_server_health(url, timeout=30):
    """检查服务器健康状态"""
    import requests
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{url}/health", timeout=5)
            if response.status_code == 200:
                return True
        except:
            pass
        time.sleep(1)
    return False

def main():
    """主函数"""
    print("🚀 DotsOCR 完整系统启动器")
    print("=" * 60)
    
    # 检查脚本文件是否存在
    required_scripts = [
        "dots_ocr_api_server.py",
        "gradio_api_test.py"
    ]
    
    for script in required_scripts:
        script_path = Path(script)
        if not script_path.exists():
            print(f"❌ 错误: 找不到脚本文件 {script_path}")
            print("请确保在正确的目录下运行此脚本")
            return
    
    processes = []
    
    try:
        # 1. 启动批量OCR API服务器
        print("\n📦 启动批量OCR API服务器...")
        batch_process = start_server("dots_ocr_api_server.py", ["batch"])
        if not batch_process:
            print("❌ 批量OCR服务器启动失败")
            return
        processes.append(("批量OCR API", batch_process, 5003))
        
        # 等待批量服务器启动
        print("等待批量OCR服务器启动...")
        if check_server_health("http://localhost:5003"):
            print("✅ 批量OCR服务器启动成功 (端口5003)")
        else:
            print("❌ 批量OCR服务器启动失败")
            return
        
        # 2. 启动实时OCR API服务器
        print("\n🔄 启动实时OCR API服务器...")
        realtime_process = start_server("dots_ocr_api_server.py", ["realtime"])
        if not realtime_process:
            print("❌ 实时OCR服务器启动失败")
            return
        processes.append(("实时OCR API", realtime_process, 5004))
        
        # 等待实时服务器启动
        print("等待实时OCR服务器启动...")
        if check_server_health("http://localhost:5004"):
            print("✅ 实时OCR服务器启动成功 (端口5004)")
        else:
            print("❌ 实时OCR服务器启动失败")
            return
        
        # 3. 启动Gradio测试界面
        print("\n🌐 启动Gradio测试界面...")
        gradio_process = start_server("gradio_api_test.py")
        if not gradio_process:
            print("❌ Gradio界面启动失败")
            return
        processes.append(("Gradio测试界面", gradio_process, 7860))
        
        # 等待Gradio启动
        print("等待Gradio界面启动...")
        time.sleep(5)  # Gradio启动需要一些时间
        
        print("\n🎉 所有服务启动成功!")
        print("=" * 60)
        print("🌐 服务访问地址:")
        print("  批量OCR API: http://localhost:5003")
        print("  实时OCR API: http://localhost:5004")
        print("  Gradio测试界面: http://localhost:7860")
        print("\n📋 API端点:")
        print("  健康检查: http://localhost:5003/health 或 http://localhost:5004/health")
        print("  配置信息: http://localhost:5003/config 或 http://localhost:5004/config")
        print("  实时OCR: http://localhost:5004/realtime/ocr")
        print("  批量OCR: http://localhost:5003/batch/ocr")
        print("\n💡 使用说明:")
        print("  1. 打开浏览器访问 http://localhost:7860")
        print("  2. 在Gradio界面中测试API功能")
        print("  3. 支持实时OCR和批量OCR两种模式")
        print("  4. 自动1300像素缩放，控制显存占用")
        print("\n按 Ctrl+C 停止所有服务")
        
        # 监控进程状态
        while True:
            time.sleep(2)
            
            # 检查所有进程是否还在运行
            for name, process, port in processes:
                if process.poll() is not None:
                    print(f"❌ {name} (端口{port}) 意外停止")
                    return
                    
    except KeyboardInterrupt:
        print("\n🛑 正在停止所有服务...")
        
        # 停止所有进程
        for name, process, port in processes:
            if process:
                print(f"停止 {name}...")
                process.terminate()
                try:
                    process.wait(timeout=5)
                    print(f"✅ {name} 已停止")
                except subprocess.TimeoutExpired:
                    process.kill()
                    print(f"⚠️  强制停止 {name}")
        
        print("所有服务已停止")

if __name__ == "__main__":
    main()
