import request from '../request';
import { ExportType } from '../types';

export interface SaveExportRequest {
  taskId: number;
  exportType: ExportType;
  fileName: string;
  exportData: any;
}

export interface ExportFileInfo {
  id: number;
  fileName: string;
  exportType: ExportType;
  taskId: number;
  taskName: string;
  createdAt: string;
  fileSize: number;
  downloadUrl: string;
}

export interface ExportFileListResponse {
  data: ExportFileInfo[];
  total: number;
  page: number;
  size: number;
}

// 保存导出文件到样本管理
export async function saveExportToSamples(
  taskId: number,
  exportType: ExportType,
  fileName: string,
  exportData: any
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('模拟保存到样本管理:', {
      taskId,
      exportType,
      fileName,
      exportDataSize: exportData ? JSON.stringify(exportData).length : 0
    });

    // 模拟API调用延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 模拟成功响应
    return {
      success: true,
      message: '导出文件已成功保存到样本管理',
    };
  } catch (error) {
    console.error('保存导出文件失败:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '保存失败',
    };
  }
}

// 获取样本管理中的导出文件列表
export async function getExportFiles(
  page: number = 1,
  size: number = 20
): Promise<ExportFileListResponse> {
  // 模拟数据
  const mockFiles: ExportFileInfo[] = [
    {
      id: 1,
      fileName: '测试导出文件_1.json',
      exportType: ExportType.JSON,
      taskId: 8,
      taskName: '测试任务',
      createdAt: new Date().toISOString(),
      fileSize: 1024,
      downloadUrl: '/api/download/1'
    },
    {
      id: 2,
      fileName: '测试导出文件_2.coco',
      exportType: ExportType.COCO,
      taskId: 8,
      taskName: '测试任务',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1天前
      fileSize: 2048,
      downloadUrl: '/api/download/2'
    }
  ];

  return {
    data: mockFiles,
    total: mockFiles.length,
    page: page - 1,
    size
  };
}

// 下载保存的导出文件
export async function downloadExportFile(fileId: number): Promise<Blob> {
  // 模拟下载
  const mockBlob = new Blob(['模拟文件内容'], { type: 'application/json' });
  return mockBlob;
}

// 删除保存的导出文件
export async function deleteExportFile(fileId: number): Promise<{ success: boolean }> {
  await request.delete(`/v1/export-management/files/${fileId}`);
  return { success: true };
}
