import request from '../request';

export interface PreAnnotationTask {
  id: string;
  name: string;
  taskType: string;
  model: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED';
  progress: number;
  totalSamples: number;
  processedSamples: number;
  accuracy: number;
  createdAt: string;
  updatedAt: string;
  description?: string;
  priority: 'high' | 'normal' | 'low';
  config?: string;
  files: string[];
}

export interface CreatePreAnnotationTaskRequest {
  name: string;
  taskType: string;
  model: string;
  taskId: string;
  description?: string;
  priority: 'high' | 'normal' | 'low';
  config?: string;
  files: File[];
}

export interface PreAnnotationTaskListResponse {
  data: PreAnnotationTask[];
  total: number;
  page: number;
  size: number;
}

// 获取预标注任务列表
export async function getPreAnnotationTasks(
  page: number = 1,
  size: number = 20
): Promise<PreAnnotationTaskListResponse> {
  return await request.get('/v1/pre-annotation/tasks', {
    params: {
      page: page - 1,
      size,
    },
  });
}

// 创建预标注任务
export async function createPreAnnotationTask(
  data: CreatePreAnnotationTaskRequest
): Promise<{ success: boolean; taskId: string; message: string }> {
  try {
    // 创建FormData对象用于文件上传
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('taskType', data.taskType);
    formData.append('model', data.model);
    formData.append('taskId', data.taskId);
    formData.append('priority', data.priority);
    
    if (data.description) {
      formData.append('description', data.description);
    }
    
    if (data.config) {
      formData.append('config', data.config);
    }
    
    // 添加文件
    data.files.forEach((file, index) => {
      formData.append(`files`, file);
    });

    const response = await request.post('/v1/pre-annotation/tasks', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return {
      success: true,
      taskId: response.data.id,
      message: '预标注任务创建成功',
    };
  } catch (error) {
    console.error('创建预标注任务失败:', error);
    return {
      success: false,
      taskId: '',
      message: error instanceof Error ? error.message : '创建失败',
    };
  }
}

// 获取预标注任务详情
export async function getPreAnnotationTask(taskId: string): Promise<PreAnnotationTask> {
  return await request.get(`/v1/pre-annotation/tasks/${taskId}`);
}

// 更新预标注任务状态
export async function updatePreAnnotationTaskStatus(
  taskId: string,
  status: 'RUNNING' | 'PAUSED' | 'STOP'
): Promise<{ success: boolean; message: string }> {
  try {
    await request.patch(`/v1/pre-annotation/tasks/${taskId}/status`, {
      status,
    });
    
    return {
      success: true,
      message: '状态更新成功',
    };
  } catch (error) {
    console.error('更新任务状态失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '更新失败',
    };
  }
}

// 删除预标注任务
export async function deletePreAnnotationTask(taskId: string): Promise<{ success: boolean; message: string }> {
  try {
    await request.delete(`/v1/pre-annotation/tasks/${taskId}`);
    
    return {
      success: true,
      message: '任务删除成功',
    };
  } catch (error) {
    console.error('删除任务失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '删除失败',
    };
  }
}

// 获取预标注结果
export async function getPreAnnotationResults(taskId: string): Promise<any> {
  return await request.get(`/v1/pre-annotation/tasks/${taskId}/results`);
}

// 下载预标注结果
export async function downloadPreAnnotationResults(taskId: string, format: string): Promise<Blob> {
  const response = await request.get(`/v1/pre-annotation/tasks/${taskId}/results/download`, {
    params: { format },
    responseType: 'blob',
  });
  return response;
}
