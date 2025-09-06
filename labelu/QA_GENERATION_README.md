# 问答对生成系统使用说明

## 🎯 系统概述

问答对生成系统是一个完整的问答对数据管理解决方案，支持前端生成、后端持久化存储、数据查询和管理等功能。

## 🏗️ 系统架构

### 后端架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Router    │    │   Service       │    │   CRUD          │
│   (FastAPI)     │───▶│   Layer         │───▶│   Operations    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Domain        │    │   Database      │
                       │   Models        │    │   (SQLite)      │
                       └─────────────────┘    └─────────────────┘
```

### 前端架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Components │    │   API Service   │    │   LocalStorage  │
│   (React)       │───▶│   (TypeScript)  │───▶│   (Cache)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🗄️ 数据库设计

### 问答对表结构
```sql
CREATE TABLE qa_generation (
    id INTEGER NOT NULL PRIMARY KEY,
    task_id INTEGER,                    -- 任务ID
    sample_id INTEGER,                  -- 样本ID
    pre_annotation_id INTEGER,          -- 预标注ID
    question TEXT NOT NULL,             -- 问题内容
    answer TEXT NOT NULL,               -- 答案内容
    prompt TEXT,                        -- 生成提示词
    knowledge_text TEXT,                -- 知识文本/制式文本
    current_page INTEGER,               -- 当前页码
    total_pages INTEGER,                -- 总页数
    sample_index INTEGER,               -- 样本索引
    filename VARCHAR(512),              -- 文件名
    api_model VARCHAR(128),             -- API模型
    api_base_url VARCHAR(512),          -- API基础URL
    num_pairs INTEGER,                  -- 问答对数量
    created_by INTEGER,                 -- 创建者用户ID
    created_at DATETIME,                -- 创建时间
    updated_at DATETIME,                -- 更新时间
    deleted_at DATETIME,                -- 删除时间
    FOREIGN KEY(task_id) REFERENCES task (id),
    FOREIGN KEY(sample_id) REFERENCES task_sample (id),
    FOREIGN KEY(pre_annotation_id) REFERENCES task_pre_annotation (id),
    FOREIGN KEY(created_by) REFERENCES user (id)
);
```

## 🚀 功能特性

### 1. 问答对生成
- 支持DeepSeek API集成
- 可配置生成参数（模型、数量、提示词等）
- 智能内容过滤和验证

### 2. 数据持久化
- 后端SQLite数据库存储
- 前端localStorage缓存
- 数据同步和一致性保证

### 3. 数据管理
- 问答对增删改查
- 批量操作支持
- 数据统计和分析

### 4. 用户界面
- 直观的数据展示
- 实时操作反馈
- 响应式设计

## 📁 文件结构

```
labelu/
├── internal/
│   ├── domain/models/
│   │   └── qa_generation.py          # 数据模型
│   ├── adapter/
│   │   ├── persistence/
│   │   │   └── crud_qa_generation.py # CRUD操作
│   │   └── routers/
│   │       └── qa_generation.py      # API路由
│   └── application/
│       ├── command/
│       │   └── qa_generation.py      # 命令模型
│       ├── response/
│       │   └── qa_generation.py      # 响应模型
│       └── service/
│           └── qa_generation.py      # 业务逻辑
├── alembic_labelu/versions/
│   └── create_qa_generation_table.py # 数据库迁移
└── QA_GENERATION_README.md            # 本文档

labelU-kit/apps/frontend/src/
├── api/services/
│   └── qaGeneration.ts               # 前端API服务
└── pages/tasks.[id].samples.[id]/
    └── index.tsx                     # 问答对页面组件
```

## 🔧 安装和配置

### 1. 后端配置

#### 数据库迁移
```bash
cd labelu
alembic upgrade head
```

#### 启动服务
```bash
uvicorn main:app --reload
```

### 2. 前端配置

#### 安装依赖
```bash
cd labelU-kit/apps/frontend
npm install
```

#### 启动开发服务器
```bash
npm run dev
```

## 📖 使用方法

### 1. 生成问答对

1. 在问答对生成页面配置DeepSeek API
2. 输入知识文本或从OCR结果填充
3. 点击"生成问答对"按钮
4. 系统自动调用API生成问答对

### 2. 保存数据

1. 生成完成后，点击"保存到任务"按钮
2. 系统自动保存到后端数据库
3. 同时更新本地缓存

### 3. 管理数据

1. 在"已保存的问答对数据"组件中查看所有数据
2. 支持单个删除、批量清空等操作
3. 可以导出数据为JSON格式

## 🔌 API接口

### 基础路径
```
/api/v1/qa-generation
```

### 主要接口

#### 创建问答对
```http
POST /api/v1/qa-generation/
```

#### 批量创建
```http
POST /api/v1/qa-generation/batch
```

#### 查询列表
```http
GET /api/v1/qa-generation/
```

#### 根据任务查询
```http
GET /api/v1/qa-generation/task/{task_id}
```

#### 根据样本查询
```http
GET /api/v1/qa-generation/sample/{sample_id}
```

#### 获取统计信息
```http
GET /api/v1/qa-generation/task/{task_id}/stats
```

#### 更新问答对
```http
PUT /api/v1/qa-generation/{id}
```

#### 删除问答对
```http
DELETE /api/v1/qa-generation/{id}
```

#### 批量删除
```http
DELETE /api/v1/qa-generation/batch
```

## 🛠️ 开发指南

### 1. 添加新字段

1. 修改 `qa_generation.py` 模型
2. 更新命令和响应模型
3. 修改CRUD操作
4. 更新数据库迁移文件
5. 重启服务

### 2. 添加新功能

1. 在服务层添加业务逻辑
2. 在路由层添加API接口
3. 在前端添加UI组件
4. 更新类型定义

### 3. 测试

1. 后端API测试
2. 前端组件测试
3. 集成测试
4. 数据库操作测试

## 🐛 故障排除

### 常见问题

#### 1. 数据库连接失败
- 检查数据库文件权限
- 确认数据库路径配置
- 验证SQLite版本兼容性

#### 2. API调用失败
- 检查网络连接
- 验证API密钥配置
- 查看后端日志

#### 3. 数据同步问题
- 清除浏览器缓存
- 重新加载页面
- 检查localStorage状态

### 日志查看

#### 后端日志
```bash
tail -f labelu.log
```

#### 前端日志
- 打开浏览器开发者工具
- 查看Console标签页

## 📈 性能优化

### 1. 数据库优化
- 添加适当的索引
- 使用分页查询
- 定期清理软删除数据

### 2. 前端优化
- 实现虚拟滚动
- 使用React.memo优化渲染
- 实现数据懒加载

### 3. API优化
- 实现数据缓存
- 使用批量操作
- 添加请求限流

## 🔒 安全考虑

### 1. 数据验证
- 输入参数验证
- SQL注入防护
- XSS攻击防护

### 2. 权限控制
- 用户身份验证
- 操作权限检查
- 数据访问控制

### 3. 敏感信息
- API密钥加密存储
- 日志脱敏处理
- 数据传输加密

## 📝 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 基础问答对生成功能
- 数据库持久化支持
- 前端管理界面

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交代码变更
4. 创建Pull Request
5. 代码审查和合并

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：
- 提交Issue
- 发送邮件
- 参与讨论

---

**注意**: 本文档会随着系统更新而持续更新，请关注最新版本。





