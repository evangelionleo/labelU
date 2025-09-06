#!/usr/bin/env python3
"""
测试问答对API的简单脚本
"""

import requests
import json

# 配置
BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api/v1/qa-generation"

def test_qa_generation_api():
    """测试问答对API"""
    
    print("🧪 开始测试问答对API...")
    
    # 1. 测试API是否可访问
    try:
        response = requests.get(f"{BASE_URL}/docs")
        print(f"✅ API文档可访问: {response.status_code}")
    except Exception as e:
        print(f"❌ API文档不可访问: {e}")
        return
    
    # 2. 测试问答对路由是否注册
    try:
        response = requests.get(f"{BASE_URL}/openapi.json")
        if response.status_code == 200:
            openapi_data = response.json()
            paths = openapi_data.get('paths', {})
            
            qa_paths = [path for path in paths.keys() if 'qa-generation' in path]
            if qa_paths:
                print(f"✅ 问答对API路由已注册: {qa_paths}")
            else:
                print("❌ 问答对API路由未找到")
                print("可用的路径:", list(paths.keys())[:10])
        else:
            print(f"❌ 无法获取OpenAPI文档: {response.status_code}")
    except Exception as e:
        print(f"❌ 测试路由注册失败: {e}")
    
    # 3. 测试具体的API端点
    test_endpoints = [
        "/",
        "/batch",
        "/task/1",
        "/sample/1"
    ]
    
    for endpoint in test_endpoints:
        try:
            url = f"{API_URL}{endpoint}"
            response = requests.get(url)
            print(f"🔍 测试 {endpoint}: {response.status_code}")
            if response.status_code == 401:
                print(f"   ✅ 端点存在，需要认证")
            elif response.status_code == 405:
                print(f"   ❌ 方法不允许，可能是路由配置问题")
            elif response.status_code == 404:
                print(f"   ❌ 端点不存在")
            else:
                print(f"   📊 响应: {response.status_code}")
        except Exception as e:
            print(f"   ❌ 测试失败: {e}")
    
    print("\n🎯 测试完成！")
    print("\n💡 如果看到401错误，说明API正常工作，只是需要认证")
    print("💡 如果看到405错误，说明路由配置有问题")
    print("💡 如果看到404错误，说明端点不存在")

if __name__ == "__main__":
    test_qa_generation_api()




