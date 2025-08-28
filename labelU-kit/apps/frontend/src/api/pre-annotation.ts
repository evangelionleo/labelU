import request from './request';

// 预标注任务接口
export interface PreAnnotationTask {
  id: string;
  name: string;
  model: string;
  status: 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'PENDING';
  progress: number;
  totalSamples: number;
  processedSamples: number;
  accuracy: number;
  taskId: string;
  description?: string;
  priority: 'high' | 'normal' | 'low';
  config?: string;
  createdAt: string;
  updatedAt: string;
}

// 创建预标注任务请求
export interface CreatePreAnnotationTaskRequest {
  name: string;
  model: string;
  taskId: string;
  description?: string;
  priority: 'high' | 'normal' | 'low';
  config?: string;
}

// 预标注模型接口
export interface PreAnnotationModel {
  id: string;
  name: string;
  type: 'image' | 'text' | 'audio' | 'video';
  description: string;
  version: string;
  accuracy: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

// 预标注结果接口
export interface PreAnnotationResult {
  id: string;
  taskId: string;
  sampleId: string;
  result: any;
  confidence: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

// 预标注任务 API
export const preAnnotationApi = {
  // 获取预标注任务列表
  getTasks: (params?: {
    page?: number;
    size?: number;
    status?: string;
    model?: string;
  }): Promise<{ data: PreAnnotationTask[]; total: number }> => {
    // Mock 数据 - 实际开发时替换为真实 API
    const mockTasks: PreAnnotationTask[] = [
      {
        id: 'PA001',
        name: '图像分类预标注任务',
        model: 'ResNet-50',
        status: 'RUNNING',
        progress: 75,
        totalSamples: 1000,
        processedSamples: 750,
        accuracy: 92.5,
        taskId: 'task1',
        description: '使用ResNet-50模型进行图像分类预标注',
        priority: 'high',
        createdAt: '2024-12-15',
        updatedAt: '2024-12-19',
      },
      {
        id: 'PA002',
        name: '目标检测预标注任务',
        model: 'YOLO-v5',
        status: 'COMPLETED',
        progress: 100,
        totalSamples: 500,
        processedSamples: 500,
        accuracy: 88.3,
        taskId: 'task2',
        description: '使用YOLO-v5模型进行目标检测预标注',
        priority: 'normal',
        createdAt: '2024-12-10',
        updatedAt: '2024-12-18',
      },
      {
        id: 'PA003',
        name: '文本分类预标注任务',
        model: 'BERT-base',
        status: 'PAUSED',
        progress: 45,
        totalSamples: 800,
        processedSamples: 360,
        accuracy: 85.7,
        taskId: 'task3',
        description: '使用BERT-base模型进行文本分类预标注',
        priority: 'low',
        createdAt: '2024-12-12',
        updatedAt: '2024-12-17',
      },
    ];

    return Promise.resolve({
      data: mockTasks,
      total: mockTasks.length,
    });
    
    // 真实 API 调用示例：
    // return request.get('/api/v1/pre-annotation/tasks', { params });
  },

  // 创建预标注任务
  createTask: (data: CreatePreAnnotationTaskRequest): Promise<PreAnnotationTask> => {
    // Mock 数据 - 实际开发时替换为真实 API
    const newTask: PreAnnotationTask = {
      id: `PA${Date.now()}`,
      name: data.name,
      model: data.model,
      status: 'PENDING',
      progress: 0,
      totalSamples: 0,
      processedSamples: 0,
      accuracy: 0,
      taskId: data.taskId,
      description: data.description,
      priority: data.priority,
      config: data.config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return Promise.resolve(newTask);
    
    // 真实 API 调用示例：
    // return request.post('/api/v1/pre-annotation/tasks', data);
  },

  // 获取预标注任务详情
  getTask: (id: string): Promise<PreAnnotationTask> => {
    // Mock 数据
    const mockTask: PreAnnotationTask = {
      id,
      name: '图像分类预标注任务',
      model: 'ResNet-50',
      status: 'RUNNING',
      progress: 75,
      totalSamples: 1000,
      processedSamples: 750,
      accuracy: 92.5,
      taskId: 'task1',
      description: '使用ResNet-50模型进行图像分类预标注',
      priority: 'high',
      createdAt: '2024-12-15',
      updatedAt: '2024-12-19',
    };

    return Promise.resolve(mockTask);
    
    // 真实 API 调用示例：
    // return request.get(`/api/v1/pre-annotation/tasks/${id}`);
  },

  // 更新预标注任务状态
  updateTaskStatus: (id: string, status: string): Promise<void> => {
    // Mock 数据
    return Promise.resolve();
    
    // 真实 API 调用示例：
    // return request.patch(`/api/v1/pre-annotation/tasks/${id}/status`, { status });
  },

  // 删除预标注任务
  deleteTask: (id: string): Promise<void> => {
    // Mock 数据
    return Promise.resolve();
    
    // 真实 API 调用示例：
    // return request.delete(`/api/v1/pre-annotation/tasks/${id}`);
  },

  // 获取预标注模型列表
  getModels: (): Promise<PreAnnotationModel[]> => {
    // Mock 数据
    const mockModels: PreAnnotationModel[] = [
      {
        id: 'model1',
        name: 'ResNet-50',
        type: 'image',
        description: '用于图像分类的深度残差网络',
        version: 'v1.0',
        accuracy: 92.5,
        status: 'active',
        createdAt: '2024-12-01',
      },
      {
        id: 'model2',
        name: 'YOLO-v5',
        type: 'image',
        description: '用于目标检测的实时检测模型',
        version: 'v5.0',
        accuracy: 88.3,
        status: 'active',
        createdAt: '2024-12-01',
      },
      {
        id: 'model3',
        name: 'BERT-base',
        type: 'text',
        description: '用于文本分类的预训练语言模型',
        version: 'v1.0',
        accuracy: 85.7,
        status: 'active',
        createdAt: '2024-12-01',
      },
      {
        id: 'model4',
        name: 'Whisper',
        type: 'audio',
        description: '用于语音识别的多语言模型',
        version: 'v1.0',
        accuracy: 78.9,
        status: 'active',
        createdAt: '2024-12-01',
      },
    ];

    return Promise.resolve(mockModels);
    
    // 真实 API 调用示例：
    // return request.get('/api/v1/pre-annotation/models');
  },

  // 获取预标注结果
  getResults: (taskId: string, params?: {
    page?: number;
    size?: number;
    status?: string;
  }): Promise<{ data: PreAnnotationResult[]; total: number }> => {
    // Mock 数据
    const mockResults: PreAnnotationResult[] = [
      {
        id: 'result1',
        taskId,
        sampleId: 'sample1',
        result: { label: 'cat', confidence: 0.95 },
        confidence: 0.95,
        status: 'completed',
        createdAt: '2024-12-19',
      },
      {
        id: 'result2',
        taskId,
        sampleId: 'sample2',
        result: { label: 'dog', confidence: 0.87 },
        confidence: 0.87,
        status: 'completed',
        createdAt: '2024-12-19',
      },
    ];

    return Promise.resolve({
      data: mockResults,
      total: mockResults.length,
    });
    
    // 真实 API 调用示例：
    // return request.get(`/api/v1/pre-annotation/tasks/${taskId}/results`, { params });
  },
};
