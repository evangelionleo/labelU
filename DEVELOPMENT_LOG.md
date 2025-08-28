# LabelU 前端开发日志

## 开发要求记录

### 当前任务：添加左侧边栏功能

**用户要求**：
- 在左侧添加一个侧边栏
- 先开发前端页面，不写后端逻辑
- 维护开发文档
- 记录每次修改的详细信息

## 修改记录

### 2024-12-19 - 初始化开发文档

**修改内容**：
- 创建 DEVELOPMENT_LOG.md 文档
- 记录开发要求和进度

**文件**：
- `DEVELOPMENT_LOG.md` - 开发日志文档

**作用**：
- 记录开发进度
- 跟踪修改内容
- 便于后续维护

### 2024-12-19 - 创建侧边栏组件

**用户要求**：
- 在左侧添加一个侧边栏
- 支持折叠/展开功能
- 包含多个菜单项和子菜单

**修改内容**：
- 创建侧边栏组件 (`src/components/Sidebar/index.tsx`)
- 集成到主布局 (`src/layouts/MainLayoutWithNavigation/index.tsx`)
- 添加仪表板页面 (`src/pages/dashboard/index.tsx`)
- 更新路由配置 (`src/routes.tsx`)
- 创建 Mock API 接口 (`src/api/dashboard.ts`)

**文件及作用**：

1. **`src/components/Sidebar/index.tsx`**
   - 侧边栏主组件
   - 包含折叠/展开功能
   - 支持多级菜单
   - 响应式设计

2. **`src/layouts/MainLayoutWithNavigation/index.tsx`**
   - 修改主布局，集成侧边栏
   - 使用 Ant Design Layout 组件
   - 保持原有的头部导航

3. **`src/pages/dashboard/index.tsx`**
   - 仪表板页面组件
   - 显示统计数据和图表
   - 包含 Mock 数据

4. **`src/routes.tsx`**
   - 添加仪表板路由
   - 修改默认首页为仪表板
   - 保持原有路由结构

5. **`src/api/dashboard.ts`**
   - 仪表板相关的 API 接口
   - 包含 Mock 数据和真实 API 调用示例
   - TypeScript 类型定义

**预留的前端端口要求的数据**：

1. **仪表板统计数据** (`/api/v1/dashboard/stats`)
   ```typescript
   {
     totalTasks: number;
     totalUsers: number;
     totalSamples: number;
     completedTasks: number;
     inProgressTasks: number;
     pendingTasks: number;
   }
   ```

2. **最近任务列表** (`/api/v1/dashboard/recent-tasks`)
   ```typescript
   {
     id: string;
     name: string;
     status: string;
     progress: number;
     assignee: string;
     dueDate: string;
     createdAt: string;
   }[]
   ```

3. **任务状态分布** (`/api/v1/dashboard/task-status-distribution`)
   ```typescript
   {
     finished: number;
     inProgress: number;
     draft: number;
     configured: number;
   }
   ```

4. **用户活跃度统计** (`/api/v1/dashboard/user-activity-stats`)
   ```typescript
   {
     activeUsers: number;
     totalUsers: number;
     newUsersThisWeek: number;
     activeUsersThisWeek: number;
   }
   ```

**Mock 数据如何替换为真实数据**：

1. 在 `src/api/dashboard.ts` 中，将 Mock 数据替换为真实 API 调用
2. 取消注释真实 API 调用代码
3. 注释或删除 Mock 数据代码
4. 确保后端提供对应的 API 接口

### 2024-12-19 - 侧边栏菜单中文化

**用户要求**：
- 将侧边栏的英文目录改成中文

**修改内容**：
- 修改侧边栏组件中的菜单项标签，从英文改为中文
- 保持路由路径不变，只修改显示文本

**文件**：
- `src/components/Sidebar/index.tsx` - 侧边栏组件

**具体修改**：

1. **主菜单项**：
   - `dashboard` → `仪表板`
   - `taskList` → `任务管理`
   - `samples` → `样本管理`
   - `users` → `用户管理`
   - `teams` → `团队管理`
   - `reports` → `报表中心`
   - `settings` → `系统设置`

2. **子菜单项**：
   - `overview` → `概览`
   - `analytics` → `数据分析`
   - `allTasks` → `全部任务`
   - `createTask` → `创建任务`
   - `taskTemplates` → `任务模板`
   - `allSamples` → `全部样本`
   - `annotatedSamples` → `已标注样本`
   - `unannotatedSamples` → `未标注样本`
   - `userList` → `用户列表`
   - `userRoles` → `用户角色`
   - `teamList` → `团队列表`
   - `teamProjects` → `团队项目`
   - `progressReport` → `进度报表`
   - `qualityReport` → `质量报表`
   - `performanceReport` → `绩效报表`
   - `profileSettings` → `个人设置`
   - `systemSettings` → `系统设置`
   - `securitySettings` → `安全设置`

**作用**：
- 提升用户体验，使用中文界面更符合国内用户习惯
- 保持功能完整性，路由和功能不受影响
- 便于后续维护和扩展

### 2024-12-19 - 添加预标注任务功能

**用户要求**：
- 在侧边栏目录中添加"预标注任务"菜单项

**修改内容**：
- 在侧边栏中添加预标注任务菜单项
- 创建预标注任务页面组件
- 创建预标注任务相关的 API 接口
- 添加路由配置

**文件及作用**：

1. **`src/components/Sidebar/index.tsx`**
   - 添加预标注任务菜单项
   - 包含子菜单：任务列表、创建任务、模型管理、预标注结果
   - 使用 RobotOutlined 图标

2. **`src/pages/pre-annotation/index.tsx`**
   - 预标注任务主页面
   - 包含任务列表表格
   - 创建任务的模态框
   - 支持任务状态管理（运行、暂停、继续、删除等）

3. **`src/api/pre-annotation.ts`**
   - 预标注任务相关的 API 接口
   - 包含 Mock 数据和真实 API 调用示例
   - TypeScript 类型定义

4. **`src/routes.tsx`**
   - 添加预标注任务路由配置
   - 集成到主布局中

**预标注任务功能特性**：

1. **任务管理**：
   - 创建预标注任务
   - 查看任务列表
   - 任务状态控制（运行/暂停/继续）
   - 任务进度监控

2. **模型支持**：
   - ResNet-50 (图像分类)
   - YOLO-v5 (目标检测)
   - BERT-base (文本分类)
   - Whisper (语音识别)
   - 自定义模型

3. **任务状态**：
   - RUNNING (运行中)
   - COMPLETED (已完成)
   - PAUSED (已暂停)
   - FAILED (失败)
   - PENDING (等待中)

**预留的前端端口要求的数据**：

1. **预标注任务列表** (`/api/v1/pre-annotation/tasks`)
   ```typescript
   {
     data: PreAnnotationTask[];
     total: number;
   }
   ```

2. **创建预标注任务** (`POST /api/v1/pre-annotation/tasks`)
   ```typescript
   {
     name: string;
     model: string;
     taskId: string;
     description?: string;
     priority: 'high' | 'normal' | 'low';
     config?: string;
   }
   ```

3. **预标注模型列表** (`/api/v1/pre-annotation/models`)
   ```typescript
   PreAnnotationModel[]
   ```

4. **预标注结果** (`/api/v1/pre-annotation/tasks/{id}/results`)
   ```typescript
   {
     data: PreAnnotationResult[];
     total: number;
   }
   ```

**Mock 数据如何替换为真实数据**：

1. 在 `src/api/pre-annotation.ts` 中，将 Mock 数据替换为真实 API 调用
2. 取消注释真实 API 调用代码
3. 注释或删除 Mock 数据代码
4. 确保后端提供对应的 API 接口

### 2024-12-19 - 创建完整页面体系

**用户要求**：
- 将"任务管理"改为"任务大厅"
- 创建用户管理、团队管理、报表中心等页面
- 修复路由问题

**修改内容**：
- 修改侧边栏菜单名称
- 创建用户管理页面
- 创建团队管理页面
- 创建报表中心页面
- 更新路由配置

**文件及作用**：

1. **`src/components/Sidebar/index.tsx`**
   - 将"任务管理"改为"任务大厅"
   - 保持其他菜单项不变

2. **`src/pages/users/index.tsx`**
   - 用户管理页面
   - 用户列表展示
   - 添加/编辑/删除用户功能
   - 角色和状态管理

3. **`src/pages/teams/index.tsx`**
   - 团队管理页面
   - 团队列表展示
   - 创建/编辑/删除团队功能
   - 团队统计信息

4. **`src/pages/reports/index.tsx`**
   - 报表中心页面
   - 多种报表类型
   - 数据统计和图表
   - 报表导出功能

5. **`src/routes.tsx`**
   - 添加新页面的路由配置
   - 修复路由结构
   - 更新面包屑导航

**页面功能特性**：

1. **用户管理页面**：
   - 用户列表表格
   - 用户角色管理（管理员、审核员、标注员）
   - 用户状态管理（活跃、非活跃）
   - 添加/编辑/删除用户

2. **团队管理页面**：
   - 团队列表展示
   - 团队统计信息（总团队数、活跃团队、总成员数、总项目数）
   - 团队创建和编辑
   - 成员管理功能

3. **报表中心页面**：
   - 多种报表类型（概览、进度、绩效、质量）
   - 时间范围筛选
   - 数据统计卡片
   - 任务进度报表
   - 用户绩效报表
   - 图表占位符（趋势图、饼图、柱状图）

**路由修复**：
- 修复了任务大厅的路由配置
- 添加了用户管理、团队管理、报表中心的路由
- 确保所有页面都能正常访问

**Mock 数据**：
- 所有页面都包含完整的 Mock 数据
- 数据格式符合真实业务场景
- 便于后续替换为真实 API

### 2024-12-19 - 修复任务页面和侧边栏链接

**用户要求**：
- 修复任务页面404问题
- 将侧边栏"创建任务"改为"新建任务"
- 确保新建任务链接正确工作

**修改内容**：
- 修改侧边栏菜单项名称和链接
- 确保路由配置正确

**文件及作用**：

1. **`src/components/Sidebar/index.tsx`**
   - 将"创建任务"改为"新建任务"
   - 修改链接从 `/tasks/create` 改为 `/tasks/0/edit?isNew=true`
   - 确保链接指向正确的新建任务页面

**路由配置说明**：
- 新建任务页面路由：`/tasks/0/edit?isNew=true`
- 任务编辑页面路由：`/tasks/:taskId/edit`
- 当 taskId 为 0 时，表示新建任务
- 当 taskId 不为 0 时，表示编辑现有任务

**页面功能**：
- 新建任务页面：`TaskEdit` 组件
- 支持任务基本配置
- 支持文件上传
- 支持任务模板选择

### 2024-12-19 - 侧边栏菜单优化

**用户要求**：
- 将侧边栏中的"新建任务"改为"创建任务"

**修改内容**：
- 确认侧边栏菜单项已经是"创建任务"
- 检查并确保菜单项的一致性

**文件及作用**：

1. **`src/components/Sidebar/index.tsx`**
   - 确认任务大厅子菜单中的"创建任务"项
   - 保持菜单项命名的一致性

**当前菜单结构**：
- 任务大厅
  - 全部任务
  - 创建任务 ✓
  - 任务模板
- 样本管理
- 预标注任务
- 用户管理
- 团队管理
- 报表中心

### 2024-12-19 - 菜单数据持久化

**用户要求**：
- 将侧边栏列表数据持久化，不要直接写在代码里

**修改内容**：
- 创建菜单配置文件 (`src/config/menu.ts`)
- 创建菜单管理 API 接口 (`src/api/menu.ts`)
- 创建菜单管理 Hook (`src/hooks/useMenu.ts`)
- 修改侧边栏组件使用配置文件

**文件及作用**：

1. **`src/config/menu.ts`**
   - 菜单配置数据持久化
   - 菜单工具函数
   - TypeScript 类型定义
   - 默认展开配置

2. **`src/api/menu.ts`**
   - 菜单管理相关的 API 接口
   - 包含 Mock 数据和真实 API 调用示例
   - 菜单权限管理接口

3. **`src/hooks/useMenu.ts`**
   - 菜单状态管理 Hook
   - 权限过滤逻辑
   - 菜单 CRUD 操作
   - 面包屑路径计算

4. **`src/components/Sidebar/index.tsx`**
   - 修改为使用配置文件中的菜单数据
   - 使用菜单工具函数
   - 简化代码结构

**菜单数据持久化特性**：

1. **配置分离**：
   - 菜单数据从组件中分离
   - 支持动态配置
   - 便于维护和扩展

2. **权限控制**：
   - 支持基于用户权限的菜单过滤
   - 细粒度的权限控制
   - 动态权限管理

3. **数据管理**：
   - 支持菜单的增删改查
   - 菜单排序和隐藏控制
   - 父子菜单关系管理

4. **工具函数**：
   - 面包屑路径计算
   - 菜单项查找
   - 权限检查

**预留的前端端口要求的数据**：

1. **获取菜单配置** (`GET /api/v1/menu/config`)
   ```typescript
   MenuItem[]
   ```

2. **获取用户菜单权限** (`GET /api/v1/menu/permissions/{userId}`)
   ```typescript
   MenuPermission[]
   ```

3. **更新菜单配置** (`PUT /api/v1/menu/config`)
   ```typescript
   MenuItem[]
   ```

4. **创建菜单项** (`POST /api/v1/menu/items`)
   ```typescript
   Omit<MenuItem, 'id'>
   ```

5. **更新菜单项** (`PATCH /api/v1/menu/items/{id}`)
   ```typescript
   Partial<MenuItem>
   ```

6. **删除菜单项** (`DELETE /api/v1/menu/items/{id}`)
   ```typescript
   void
   ```

**Mock 数据如何替换为真实数据**：

1. 在 `src/api/menu.ts` 中，将 Mock 数据替换为真实 API 调用
2. 取消注释真实 API 调用代码
3. 注释或删除 Mock 数据代码
4. 确保后端提供对应的 API 接口
5. 在 `src/hooks/useMenu.ts` 中使用真实的用户ID

---

## 待完成任务

1. ✅ 创建开发文档
2. ✅ 分析现有前端结构
3. ✅ 创建侧边栏组件
4. ✅ 集成到主布局
5. ✅ 添加路由配置
6. ✅ 创建 Mock 数据
7. ✅ 预留 API 接口
8. ⏳ 添加更多页面组件
9. ⏳ 完善国际化支持
10. ⏳ 添加用户管理页面
11. ⏳ 添加团队管理页面
12. ⏳ 添加报表页面

## 技术栈

- React 18 + TypeScript
- Ant Design
- React Router
- Vite

## 项目结构

```
labelU-kit/apps/frontend/
├── src/
│   ├── components/     # 通用组件
│   ├── pages/         # 页面组件
│   ├── layouts/       # 布局组件
│   ├── api/           # API 接口
│   └── ...
```
