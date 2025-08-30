# 智能标注工具修复总结

## 问题描述
智能标注工具无法正常保存到数据库配置，导致标注页面不显示智能标注按钮。

## 根本原因
1. 智能标注工具在`TOOL_NAMES`常量中被定义，但缺少实际的工具实现文件
2. 工具映射`ToolMapping`中没有智能标注工具的映射
3. 缺少智能标注的注解类和接口定义
4. 配置保存和转换逻辑不完整

## 修复内容

### 1. 创建智能标注工具实现
- **文件**: `labelU-kit/packages/image/src/tools/SmartAnnotation.tool.ts`
- **功能**: 实现智能标注工具类，包含配置管理和API调用接口

### 2. 创建智能标注注解类
- **文件**: `labelU-kit/packages/image/src/annotations/SmartAnnotation.annotation.ts`
- **功能**: 实现智能标注的渲染和交互逻辑

### 3. 更新工具映射和导出
- **文件**: `labelU-kit/packages/image/src/tools/index.ts`
- **修改**: 添加智能标注工具的导出

- **文件**: `labelU-kit/packages/image/src/AnnotatorBase.ts`
- **修改**: 在`ToolMapping`中添加智能标注工具映射

### 4. 更新注解映射
- **文件**: `labelU-kit/packages/image/src/annotations/index.ts`
- **修改**: 添加智能标注注解到`AnnotationMapping`

### 5. 更新接口定义
- **文件**: `labelU-kit/packages/image/src/interface.ts`
- **修改**: 
  - 添加`SmartAnnotationData`和`SmartAnnotationConfig`类型
  - 更新`ToolOptions`、`AnnotationData`、`AnnotationTool`等类型定义
  - 添加智能标注到`AnnotationToolData`类型映射

### 6. 修复配置模板
- **文件**: `labelU-kit/apps/frontend/src/pages/tasks.[id].edit/partials/AnnotationConfig/formConfig/templates/smartAnnotation.template.ts`
- **修改**: 更新为正确的FancyForm模板格式，包含所有必要的配置字段

### 7. 修复配置转换逻辑
- **文件**: `labelU-kit/apps/frontend/src/utils/convertImageConfig.ts`
- **修改**: 修复智能标注配置的转换，使用正确的字段名`attributes`

### 8. 修复表单同步逻辑
- **文件**: `labelU-kit/apps/frontend/src/pages/tasks.[id].edit/partials/AnnotationConfig/formConfig/index.tsx`
- **修改**: 修复拉框标签同步到智能标注工具的逻辑，使用正确的字段名

### 9. 创建智能标注面板组件
- **文件**: `labelU-kit/packages/image-annotator-react/src/SmartAnnotationPanel/index.tsx`
- **功能**: 提供智能标注的用户界面，包含文本输入、阈值调节等功能

### 10. 创建智能标注Hook
- **文件**: `labelU-kit/packages/image-annotator-react/src/hooks/useSmartAnnotation.ts`
- **功能**: 提供智能标注的业务逻辑，包括API调用和结果处理

### 11. 集成到图像标注器
- **文件**: `labelU-kit/packages/image-annotator-react/src/ImageAnnotator.tsx`
- **修改**: 集成智能标注面板和hook，在工具切换时显示相应的界面

## 配置结构
智能标注工具的配置结构如下：
```json
{
  "tool": "smartAnnotationTool",
  "config": {
    "enabled": true,
    "boxThreshold": 0.35,
    "textThreshold": 0.25,
    "syncRectLabels": true,
    "attributes": [
      {
        "color": "#1890ff",
        "key": "标签1",
        "value": "label-1"
      }
    ]
  }
}
```

## 使用流程
1. 在任务配置页面选择"智能标注"工具
2. 配置智能标注参数（阈值、标签等）
3. 保存任务配置
4. 在标注页面选择智能标注工具
5. 在智能标注面板中输入文本描述
6. 点击"开始智能标注"按钮触发自动标注

## 注意事项
1. 智能标注工具需要后端API支持
2. 配置保存时会自动同步拉框工具的标签
3. 智能标注结果会以矩形标注的形式显示
4. 工具激活时会显示专门的智能标注面板

## 后续工作
1. 实现实际的智能标注API调用
2. 添加智能标注结果的保存和加载
3. 优化用户界面和交互体验
4. 添加错误处理和重试机制
