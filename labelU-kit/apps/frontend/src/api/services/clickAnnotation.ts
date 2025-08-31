import request from '../request';
import type { RectData } from '@labelu/image/src/annotations/Rect.annotation';

// 点击标注API配置
const getClickAnnotationAPI = () => {
  const { protocol, hostname, port } = window.location;
  
  // 如果是开发环境的localhost，直接使用对应端口
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5000/api`;
  }
  
  // 如果是外网域名（如cpolar），使用代理路径
  const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  return `${baseUrl}/api/sam2`;  // 通过前端服务器代理
};

const CLICK_ANNOTATION_API_URL = getClickAnnotationAPI();

// 点击标注会话接口
export interface ClickAnnotationSession {
  sessionId: string;
  imagePath: string;
  points: Array<{
    x: number;
    y: number;
    label: number; // 1: 前景点, 0: 背景点
  }>;
}

// 点击标注结果接口
export interface ClickAnnotationResult {
  sessionId: string;
  mask: any; // RLE格式的掩码，可能是对象格式
  bbox: { x: number; y: number; w: number; h: number } | number[] | { x: number; y: number; width: number; height: number }; // 边界框，支持多种格式
  totalPoints: number;
}

// 第一步：与后端通信 - 启动点击标注会话
export async function startClickAnnotationSession(imageFile: File): Promise<ClickAnnotationSession> {
  try {
    console.log('开始启动点击标注会话...');
    
    // 上传图片
    const formData = new FormData();
    formData.append('file', imageFile);
    
    const uploadResponse = await fetch(`${CLICK_ANNOTATION_API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error('图片上传失败');
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('图片上传成功:', uploadResult);
    
    // 启动会话
    const sessionResponse = await fetch(`${CLICK_ANNOTATION_API_URL}/start_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_path: uploadResult.path
      })
    });
    
    if (!sessionResponse.ok) {
      throw new Error('创建会话失败');
    }
    
    const sessionResult = await sessionResponse.json();
    console.log('点击标注会话启动成功:', sessionResult);
    
    return {
      sessionId: sessionResult.session_id,
      imagePath: uploadResult.path,
      points: []
    };
    
  } catch (error) {
    console.error('启动点击标注会话失败:', error);
    throw error;
  }
}

// 第一步：与后端通信 - 添加点击点并获取分割结果
export async function addClickPoint(
  sessionId: string, 
  x: number, 
  y: number, 
  label: number = 1, // 1: 前景点, 0: 背景点
  clearPrevious: boolean = false
): Promise<ClickAnnotationResult> {
  try {
    console.log(`添加点击点: (${x}, ${y}), label: ${label}`);
    
    const response = await fetch(`${CLICK_ANNOTATION_API_URL}/add_point`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        point: [x, y],
        label: label,
        clear_previous: clearPrevious
      })
    });
    
    if (!response.ok) {
      throw new Error('添加点击点失败');
    }
    
    const result = await response.json();
    console.log('点击点添加成功:', result);
    
    return {
      sessionId: result.session_id,
      mask: result.mask,
      bbox: result.bbox,
      totalPoints: result.total_points
    };
    
  } catch (error) {
    console.error('添加点击点失败:', error);
    throw error;
  }
}

// 第一步：与后端通信 - 清除所有点击点
export async function clearClickPoints(sessionId: string): Promise<void> {
  try {
    console.log('清除点击点...');
    
    const response = await fetch(`${CLICK_ANNOTATION_API_URL}/clear_points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error('清除点击点失败');
    }
    
    console.log('点击点清除成功');
    
  } catch (error) {
    console.error('清除点击点失败:', error);
    throw error;
  }
}

// 第二步：与服务端通信 - 将分割结果转换为拉框数据
export function convertMaskToRectData(
  mask: string | any, 
  bbox: { x: number; y: number; w: number; h: number } | { x: number; y: number; width: number; height: number } | number[],
  imageWidth: number,
  imageHeight: number,
  label: string = 'click_annotation'
): RectData {
  console.log('=== convertMaskToRectData 函数开始 ===');
  console.log('输入参数:');
  console.log('- mask:', mask);
  console.log('- bbox:', bbox);
  console.log('- imageWidth:', imageWidth);
  console.log('- imageHeight:', imageHeight);
  console.log('- label:', label);
  
  // 处理bbox数据格式
  let bboxObj: { x: number; y: number; width: number; height: number };
  
  if (Array.isArray(bbox)) {
    // 如果是数组格式 [x, y, width, height]
    console.log('检测到bbox为数组格式，转换为对象格式');
    bboxObj = {
      x: bbox[0],
      y: bbox[1], 
      width: bbox[2],
      height: bbox[3]
    };
    console.log('转换后的bbox对象:', bboxObj);
  } else if (bbox && 'w' in bbox && 'h' in bbox) {
    // 如果是xywh格式 {x, y, w, h}
    console.log('检测到bbox为xywh格式，转换为width/height格式');
    bboxObj = {
      x: bbox.x,
      y: bbox.y,
      width: bbox.w,
      height: bbox.h
    };
    console.log('转换后的bbox对象:', bboxObj);
  } else {
    // 如果已经是width/height格式 {x, y, width, height}
    console.log('检测到bbox为width/height格式，直接使用');
    bboxObj = bbox as { x: number; y: number; width: number; height: number };
  }
  
  // 将掩码的边界框转换为拉框数据
  const rectData: RectData = {
    id: `click_annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    x: bboxObj.x,
    y: bboxObj.y,
    width: bboxObj.width,
    height: bboxObj.height,
    order: Date.now(), // 使用时间戳作为顺序
    label: label,
    visible: true,
    valid: true,
    attributes: {
      mask: mask, // 保存原始掩码数据
      source: 'click_annotation'
    }
  };
  
  console.log('=== convertMaskToRectData 函数结束 ===');
  console.log('生成的rectData:', rectData);
  console.log('rectData的x, y, width, height:', {
    x: rectData.x,
    y: rectData.y,
    width: rectData.width,
    height: rectData.height
  });
  console.log('rectData的id:', rectData.id);
  console.log('rectData的label:', rectData.label);
  console.log('rectData的attributes:', rectData.attributes);
  
  return rectData;
}

// 工具函数：将百分比坐标转换为像素坐标
export function convertPercentageToPixel(
  percentageX: number, 
  percentageY: number, 
  imageWidth: number, 
  imageHeight: number
): { x: number; y: number } {
  return {
    x: Math.round((percentageX / 100) * imageWidth),
    y: Math.round((percentageY / 100) * imageHeight)
  };
}

// 工具函数：将像素坐标转换为百分比坐标
export function convertPixelToPercentage(
  pixelX: number, 
  pixelY: number, 
  imageWidth: number, 
  imageHeight: number
): { x: number; y: number } {
  return {
    x: (pixelX / imageWidth) * 100,
    y: (pixelY / imageHeight) * 100
  };
}
