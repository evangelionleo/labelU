# 导出功能使用指南

## 功能概述

新增了"保存到样本管理"功能，允许用户在导出数据时选择将文件保存到样本管理系统中，方便后续查看和下载。

## 功能特性

### 1. 导出格式选择
- 支持多种导出格式：JSON、XML、CSV、COCO、YOLO、PASCAL_VOC、MASK、LABEL_ME、TF_RECORD
- 根据任务类型和工具自动显示可用的导出格式

### 2. 保存到样本管理
- 新增复选框选项"保存到样本管理"
- 勾选后可输入自定义文件名称
- 导出的文件将保存到样本管理系统

### 3. 样本管理页面
- 新增样本管理页面：`/samples-management`
- 显示所有保存的导出文件列表
- 支持文件预览、下载、删除操作
- 提供文件统计信息

## 使用方法

### 步骤1：导出数据
1. 在任务页面点击"导出"按钮
2. 选择导出格式
3. 勾选"保存到样本管理"选项
4. 输入文件名称
5. 点击"导出"按钮

### 步骤2：查看保存的文件
1. 在侧边栏点击"样本管理" → "导出文件管理"
2. 查看保存的导出文件列表
3. 可以预览、下载或删除文件

### 步骤3：测试功能
1. 访问 `/samples-management/test-export` 页面
2. 使用测试按钮验证导出功能

## 技术实现

### 前端组件
- `ExportPortal`: 导出对话框组件
- `SamplesManagement`: 样本管理页面
- `TestExport`: 测试页面

### API服务
- `exportManagement.ts`: 导出管理相关API
- `samples.ts`: 样本导出API（已修改）

### 路由配置
- 新增 `/samples-management` 路由
- 新增 `/samples-management/test-export` 测试路由

## 文件结构

```
src/
├── components/
│   └── ExportPortal/
│       └── index.tsx          # 导出对话框组件
├── pages/
│   └── samples/
│       ├── index.tsx          # 样本管理页面
│       └── test-export.tsx    # 测试页面
├── api/
│   └── services/
│       ├── exportManagement.ts # 导出管理API
│       └── samples.ts         # 样本API（已修改）
└── routes.tsx                 # 路由配置（已修改）
```

## 注意事项

1. 当前使用模拟API进行测试
2. 需要后端实现相应的API接口
3. 导出功能需要任务有标注数据才能正常工作
4. 文件保存功能需要网络连接

## 后续开发

1. 实现真实的后端API接口
2. 添加文件预览功能
3. 支持批量操作
4. 添加文件搜索和筛选功能
5. 优化用户界面和交互体验
