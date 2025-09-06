import request from '../request';

// 问答对相关类型定义
export interface QAGeneration {
  id: number;
  task_id: number;
  sample_id: number;
  pre_annotation_id?: number;
  question: string;
  answer: string;
  prompt?: string;
  knowledge_text?: string;
  current_page?: number;
  total_pages?: number;
  sample_index?: number;
  filename?: string;
  api_model?: string;
  api_base_url?: string;
  num_pairs?: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQAGenerationCommand {
  task_id: number;
  sample_id: number;
  pre_annotation_id?: number;
  question: string;
  answer: string;
  prompt?: string;
  knowledge_text?: string;
  current_page?: number;
  total_pages?: number;
  sample_index?: number;
  filename?: string;
  api_model?: string;
  api_base_url?: string;
  num_pairs?: number;
}

export interface BatchCreateQAGenerationCommand {
  qa_pairs: CreateQAGenerationCommand[];
}

export interface UpdateQAGenerationCommand {
  question?: string;
  answer?: string;
  prompt?: string;
  knowledge_text?: string;
  current_page?: number;
  total_pages?: number;
  sample_index?: number;
  filename?: string;
  api_model?: string;
  api_base_url?: string;
  num_pairs?: number;
}

export interface QAGenerationQueryParams {
  task_id?: number;
  sample_id?: number;
  pre_annotation_id?: number;
  created_by?: number;
  page?: number;
  size?: number;
  sorting?: string;
}

export interface QAGenerationListResponse {
  items: QAGeneration[];
  total: number;
  page: number;
  size: number;
}

export interface QAGenerationStatsResponse {
  task_id: number;
  total_qa_pairs: number;
  total_samples: number;
  created_by_users: number[];
  latest_created_at?: string;
}

export interface CreateQAGenerationResponse {
  id: number;
}

export interface BatchCreateQAGenerationResponse {
  ids: number[];
  total: number;
}

export interface CommonDataResp {
  ok: boolean;
  message?: string;
}

// API服务类
export class QAGenerationService {
  private static baseUrl = '/v1/qa-generation';

  /**
   * 创建单个问答对
   */
  static async create(data: CreateQAGenerationCommand): Promise<CreateQAGenerationResponse> {
    return request.post(`${this.baseUrl}/`, data);
  }

  /**
   * 批量创建问答对
   */
  static async batchCreate(data: BatchCreateQAGenerationCommand): Promise<BatchCreateQAGenerationResponse> {
    const response: any = await request.post(`${this.baseUrl}/batch`, data);
    return response.data;
  }

  /**
   * 获取单个问答对
   */
  static async get(id: number): Promise<QAGeneration> {
    return request.get(`${this.baseUrl}/${id}`);
  }

  /**
   * 查询问答对列表
   */
  static async list(params: QAGenerationQueryParams): Promise<QAGenerationListResponse> {
    return request.get(`${this.baseUrl}/`, { params });
  }

  /**
   * 根据任务ID获取问答对列表
   */
  static async getByTaskId(taskId: number, page: number = 0, size: number = 100): Promise<QAGenerationListResponse> {
    const response: any = await request.get(`${this.baseUrl}/task/${taskId}`, { params: { page, size } });
    return {
      items: response.data,
      total: response.meta_data?.total || 0,
      page: response.meta_data?.page || 0,
      size: response.meta_data?.size || 0
    };
  }

  /**
   * 根据样本ID获取问答对列表
   */
  static async getBySampleId(sampleId: number, page: number = 0, size: number = 100): Promise<QAGenerationListResponse> {
    return request.get(`${this.baseUrl}/sample/${sampleId}`, { params: { page, size } });
  }

  /**
   * 获取问答对统计信息
   */
  static async getStats(taskId: number): Promise<QAGenerationStatsResponse> {
    return request.get(`${this.baseUrl}/task/${taskId}/stats`);
  }

  /**
   * 更新问答对
   */
  static async update(id: number, data: UpdateQAGenerationCommand): Promise<QAGeneration> {
    return request.put(`${this.baseUrl}/${id}`, data);
  }

  /**
   * 删除问答对
   */
  static async delete(id: number): Promise<CommonDataResp> {
    const response: any = await request.delete(`${this.baseUrl}/${id}`);
    return response.data;
  }

  /**
   * 批量删除问答对
   */
  static async batchDelete(ids: number[]): Promise<CommonDataResp> {
    return request.delete(`${this.baseUrl}/batch`, { data: { qa_generation_ids: ids } });
  }

  /**
   * 根据任务ID删除所有问答对
   */
  static async deleteByTaskId(taskId: number): Promise<CommonDataResp> {
    const response: any = await request.delete(`${this.baseUrl}/task/${taskId}`);
    return response.data;
  }

  /**
   * 根据样本ID删除所有问答对
   */
  static async deleteBySampleId(sampleId: number): Promise<CommonDataResp> {
    return request.delete(`${this.baseUrl}/sample/${sampleId}`);
  }
}

// 导出默认实例
export default QAGenerationService;
