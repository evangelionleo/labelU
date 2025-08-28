import request from './request';

// 仪表板统计数据接口
export interface DashboardStats {
  totalTasks: number;
  totalUsers: number;
  totalSamples: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
}

// 最近任务接口
export interface RecentTask {
  id: string;
  name: string;
  status: 'FINISHED' | 'INPROGRESS' | 'DRAFT' | 'CONFIGURED';
  progress: number;
  assignee: string;
  dueDate: string;
  createdAt: string;
}

// 仪表板 API
export const dashboardApi = {
  // 获取仪表板统计数据
  getStats: (): Promise<DashboardStats> => {
    // Mock 数据 - 实际开发时替换为真实 API
    return Promise.resolve({
      totalTasks: 156,
      totalUsers: 23,
      totalSamples: 2847,
      completedTasks: 89,
      inProgressTasks: 45,
      pendingTasks: 22,
    });
    
    // 真实 API 调用示例：
    // return request.get('/api/v1/dashboard/stats');
  },

  // 获取最近任务列表
  getRecentTasks: (limit: number = 10): Promise<RecentTask[]> => {
    // Mock 数据 - 实际开发时替换为真实 API
    return Promise.resolve([
      {
        id: '1',
        name: '图像分类标注任务',
        status: 'INPROGRESS',
        progress: 75,
        assignee: '张三',
        dueDate: '2024-12-25',
        createdAt: '2024-12-15',
      },
      {
        id: '2',
        name: '文本情感分析',
        status: 'FINISHED',
        progress: 100,
        assignee: '李四',
        dueDate: '2024-12-20',
        createdAt: '2024-12-10',
      },
      {
        id: '3',
        name: '目标检测标注',
        status: 'DRAFT',
        progress: 0,
        assignee: '王五',
        dueDate: '2024-12-30',
        createdAt: '2024-12-18',
      },
      {
        id: '4',
        name: '语音识别标注',
        status: 'INPROGRESS',
        progress: 45,
        assignee: '赵六',
        dueDate: '2024-12-28',
        createdAt: '2024-12-12',
      },
      {
        id: '5',
        name: '视频分割标注',
        status: 'CONFIGURED',
        progress: 0,
        assignee: '钱七',
        dueDate: '2025-01-05',
        createdAt: '2024-12-20',
      },
    ]);
    
    // 真实 API 调用示例：
    // return request.get('/api/v1/dashboard/recent-tasks', { params: { limit } });
  },

  // 获取任务状态分布
  getTaskStatusDistribution: () => {
    // Mock 数据
    return Promise.resolve({
      finished: 89,
      inProgress: 45,
      draft: 22,
      configured: 15,
    });
    
    // 真实 API 调用示例：
    // return request.get('/api/v1/dashboard/task-status-distribution');
  },

  // 获取用户活跃度统计
  getUserActivityStats: () => {
    // Mock 数据
    return Promise.resolve({
      activeUsers: 18,
      totalUsers: 23,
      newUsersThisWeek: 3,
      activeUsersThisWeek: 15,
    });
    
    // 真实 API 调用示例：
    // return request.get('/api/v1/dashboard/user-activity-stats');
  },
};
