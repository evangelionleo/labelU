import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Button, 
  Upload, 
  Typography, 
  Space, 
  message, 
  Divider,
  Tag,
  Statistic,
  Progress,
  Alert,
  Switch,
  Input,
  Slider,
  Tabs
} from 'antd';
import { 
  UploadOutlined, 
  ClearOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  EyeOutlined,
  AimOutlined,
  SendOutlined,
  BulbOutlined
} from '@ant-design/icons';
// import { useTranslation } from '@labelu/i18n';
import { FlexLayout } from '@labelu/components-react';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

// 样式组件
const WorkspaceContainer = styled.div`
  background: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  min-height: 500px;
`;

const ImageContainer = styled.div`
  position: relative;
  border: 2px solid #d9d9d9;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CanvasWrapper = styled.div`
  position: relative;
  max-width: 100%;
  max-height: 100%;
`;

const OverlayCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
`;

const ControlPanel = styled(Card)`
  .ant-card-body {
    padding: 16px;
  }
`;

const StatsCard = styled(Card)`
  text-align: center;
  .ant-card-body {
    padding: 16px;
  }
`;

interface Point {
  x: number;
  y: number;
  type: 'positive' | 'negative';
}

type BoundingBox = [number, number, number, number]; // [x1, y1, x2, y2]

interface MaskData {
  size: [number, number];
  counts: string;
}

interface SegmentationResult {
  mask: MaskData;
  bbox: BoundingBox;
  score: number;
  total_points: number;
}

interface AutoAnnotationResult {
  success: boolean;
  message?: string;
  text_prompt?: string;
  objects?: Array<{
    id?: number;
    label?: string;
    bbox?: BoundingBox;
    mask?: MaskData;
    confidence?: number;
  }>;
  detection_count?: number;
  processing_time?: number;
  image_info?: {
    width: number;
    height: number;
  };
}

interface AnnotationObject {
  id: number;
  points: Point[];
  mask?: MaskData;
  bbox?: BoundingBox;
  color: string;
  sessionId?: string;
  label?: string; // 自然语言标注的标签
  confidence?: number; // 检测置信度
}

const ImageAnnotation = () => {
  // const { t } = useTranslation();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentObject, setCurrentObject] = useState(1);
  const [annotations, setAnnotations] = useState<AnnotationObject[]>([]);
  const [nextObjectId, setNextObjectId] = useState(1); // 全局对象ID计数器
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('请上传图片开始标注');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
  const [showMask, setShowMask] = useState(true);
  const [showBbox, setShowBbox] = useState(true);
  
  // 自然语言标注相关状态
  const [textPrompt, setTextPrompt] = useState('');
  const [boxThreshold, setBoxThreshold] = useState(0.35);
  const [textThreshold, setTextThreshold] = useState(0.25);
  const [annotationMode, setAnnotationMode] = useState<'manual' | 'auto'>('manual');
  
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // API配置 - 动态获取当前域名和协议
  const getBaseURL = () => {
    const { protocol, hostname, port } = window.location;
    
    // 如果是开发环境的localhost，使用原始逻辑
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}`;
    }
    
    // 如果是外网域名（如cpolar），使用当前域名
    return `${protocol}//${hostname}`;
  };
  
  const SAM2_API_URL = `${getBaseURL()}:5000`;  // SAM2手动分割API
  const AUTO_ANNOTATE_API_URL = `${getBaseURL()}:5001`;  // 自动标注API
  
  console.log('API URLs:', { SAM2_API_URL, AUTO_ANNOTATE_API_URL });
  
  // 预定义的颜色
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

  const getCurrentAnnotation = () => {
    return annotations.find(ann => ann.id === currentObject);
  };

  // 获取当前标注模式的对象计数
  const getObjectCounts = () => {
    const manualObjects = annotations.filter(ann => ann.points.length > 0 || (!ann.label || ann.label.startsWith('对象')));
    const autoObjects = annotations.filter(ann => ann.label && !ann.label.startsWith('对象') && ann.confidence !== undefined);
    return {
      manual: manualObjects.length,
      auto: autoObjects.length,
      total: annotations.length
    };
  };

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setCurrentImageFile(file);
      setStatus('图片上传成功，点击"开始标注"进入标注模式');
      setIsSessionActive(false);
      setAnnotations([]);
      setCurrentObject(1);
      setCurrentSessionId(null);
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传行为
  }, []);

  const startAnnotationSession = async () => {
    if (!uploadedImage || !currentImageFile) {
      message.warning('请先上传图片');
      return;
    }

    setLoading(true);
    setStatus('正在上传图片到服务器...');

    try {
      // 上传图片到后端
      const formData = new FormData();
      formData.append('file', currentImageFile);

      const uploadResponse = await fetch(`${SAM2_API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('图片上传失败');
      }

      const uploadResult = await uploadResponse.json();
      setStatus('图片上传成功，正在初始化分割会话...');

      // 开始分割会话
      const sessionResponse = await fetch(`${SAM2_API_URL}/api/start_session`, {
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
      setCurrentSessionId(sessionResult.session_id);
      setIsSessionActive(true);
      setStatus('标注会话已启动，点击图片进行标注');
      
      // 初始化第一个标注对象
      if (annotations.length === 0) {
        const newObjectId = nextObjectId;
        setAnnotations([{
          id: newObjectId,
          points: [],
          color: colors[(newObjectId - 1) % colors.length],
          sessionId: sessionResult.session_id
        }]);
        setCurrentObject(newObjectId);
        setNextObjectId(newObjectId + 1);
      }

      message.success('标注会话启动成功！');
    } catch (error) {
      message.error(`启动失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setStatus('标注会话启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isSessionActive || !imageRef.current || !currentSessionId) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 转换为图片相对坐标
    const imageX = (x / rect.width) * imageRef.current.naturalWidth;
    const imageY = (y / rect.height) * imageRef.current.naturalHeight;

    const newPoint: Point = {
      x: imageX,
      y: imageY,
      type: e.shiftKey ? 'negative' : 'positive'
    };

    setLoading(true);
    setStatus('正在进行分割...');

    try {
      // 调用后端API添加点并进行分割
      const response = await fetch(`${SAM2_API_URL}/api/add_point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSessionId,
          point: [imageX, imageY],
          label: newPoint.type === 'positive' ? 1 : 0,
          clear_previous: false
        })
      });

      if (!response.ok) {
        throw new Error('分割请求失败');
      }

      const result: SegmentationResult = await response.json();
      
      // 调试输出
      console.log('SAM2 返回结果:', result);
      console.log('边界框数据:', result.bbox);
      
      // 更新当前对象的标注数据
      setAnnotations(prev => {
        const updated = [...prev];
        const currentAnn = updated.find(ann => ann.id === currentObject);
        if (currentAnn) {
          currentAnn.points.push(newPoint);
          currentAnn.mask = result.mask;
          currentAnn.bbox = result.bbox;
        }
        return updated;
      });

      drawAnnotations();
      setStatus(`已添加${newPoint.type === 'positive' ? '正向' : '负向'}点，共${result.total_points}个点，分割完成`);
      message.success('分割完成！');
    } catch (error) {
      message.error(`分割失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setStatus('分割操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 解码掩码数据
  const decodeMask = (mask: MaskData) => {
    const [height, width] = mask.size;
    const encodedData = mask.counts;
    
    console.log('掩码数据:', { size: mask.size, countsType: typeof encodedData, countsLength: encodedData?.length });
    
    try {
      // 检查数据类型和格式
      if (typeof encodedData === 'string') {
        // 尝试不同的解码方式
        
        // 方式1: 检查是否是有效的Base64
        if (isValidBase64(encodedData)) {
          console.log('使用Base64解码');
          const binaryString = atob(encodedData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return { width, height, data: bytes };
        }
        
        // 方式2: 尝试作为COCO RLE格式处理
        console.log('尝试COCO RLE解码');
        return decodeCocoRLE(encodedData, height, width);
        
      } else if (Array.isArray(encodedData)) {
        // 方式3: 如果是数组格式，直接转换
        console.log('使用数组格式');
        const bytes = new Uint8Array(encodedData);
        return { width, height, data: bytes };
      }
      
      console.warn('不支持的掩码数据格式');
      return null;
      
    } catch (error) {
      console.error('掩码解码失败:', error);
      
      // 如果所有方法都失败，创建一个空的掩码
      console.log('创建空掩码作为fallback');
      const bytes = new Uint8Array(width * height);
      return { width, height, data: bytes };
    }
  };

  // 检查是否是有效的Base64字符串
  const isValidBase64 = (str: string): boolean => {
    try {
      // Base64字符集检查
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(str)) {
        return false;
      }
      
      // 尝试解码测试
      atob(str);
      return true;
    } catch {
      return false;
    }
  };

  // COCO RLE解码函数
  const decodeCocoRLE = (rleString: string, height: number, width: number) => {
    try {
      // 简化的RLE解码 - 根据实际RLE格式调整
      const rleArray = rleString.split(',').map(num => parseInt(num.trim()));
      const pixels = new Uint8Array(width * height);
      
      let pixelIndex = 0;
      let value = 0; // 0表示背景，1表示前景
      
      for (let i = 0; i < rleArray.length; i++) {
        const runLength = rleArray[i];
        for (let j = 0; j < runLength && pixelIndex < pixels.length; j++) {
          pixels[pixelIndex++] = value * 255; // 转换为0或255
        }
        value = 1 - value; // 交替0和1
      }
      
      return { width, height, data: pixels };
    } catch (error) {
      console.error('COCO RLE解码失败:', error);
      return null;
    }
  };

  // 从边界框创建矩形掩码
  const createMaskFromBbox = (bbox: BoundingBox, imageInfo: { width: number; height: number }): MaskData => {
    const [x1, y1, x2, y2] = bbox;
    const { width, height } = imageInfo;
    
    console.log('从边界框创建掩码:', { bbox, imageInfo });
    
    // 创建简化的掩码数据（仅用于可视化）
    const maskPixels = new Uint8Array(Math.floor(width * height));
    
    // 填充边界框区域
    for (let y = Math.max(0, Math.floor(y1)); y < Math.min(height, Math.floor(y2)); y++) {
      for (let x = Math.max(0, Math.floor(x1)); x < Math.min(width, Math.floor(x2)); x++) {
        const index = y * width + x;
        if (index < maskPixels.length) {
          maskPixels[index] = 255; // 前景
        }
      }
    }
    
    // 使用简单的Base64编码
    const binaryString = String.fromCharCode.apply(null, Array.from(maskPixels));
    const base64String = btoa(binaryString);
    
    return {
      size: [height, width],
      counts: base64String
    };
  };

  // 绘制掩码
  const drawMask = (ctx: CanvasRenderingContext2D, mask: MaskData, color: string, rect: DOMRect, imageSize: { width: number; height: number }) => {
    try {
      const decodedMask = decodeMask(mask);
      if (!decodedMask) {
        console.log('掩码解码返回null，跳过绘制');
        return;
      }

      console.log('绘制掩码:', { 
        maskSize: [decodedMask.width, decodedMask.height], 
        imageSize: [imageSize.width, imageSize.height],
        dataLength: decodedMask.data.length 
      });

      // 创建临时canvas用于掩码
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = decodedMask.width;
      tempCanvas.height = decodedMask.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) {
        console.error('无法创建临时canvas上下文');
        return;
      }

      // 将掩码数据转换为ImageData
      const imageData = tempCtx.createImageData(decodedMask.width, decodedMask.height);
      const rgbaColor = hexToRgba(color, 0.5); // 半透明

      // 确保数据长度匹配
      const expectedLength = decodedMask.width * decodedMask.height;
      const actualLength = decodedMask.data.length;
      
      console.log('数据长度检查:', { expected: expectedLength, actual: actualLength });

      for (let i = 0; i < Math.min(expectedLength, actualLength); i++) {
        if (decodedMask.data[i] > 0) {
          const pixelIndex = i * 4;
          // 确保不会越界
          if (pixelIndex + 3 < imageData.data.length) {
            imageData.data[pixelIndex] = rgbaColor.r;     // R
            imageData.data[pixelIndex + 1] = rgbaColor.g; // G
            imageData.data[pixelIndex + 2] = rgbaColor.b; // B
            imageData.data[pixelIndex + 3] = rgbaColor.a; // A
          }
        }
      }

      tempCtx.putImageData(imageData, 0, 0);

      // 将掩码绘制到主canvas上，使用适当的缩放
      ctx.save();
      ctx.globalAlpha = 0.5; // 设置透明度
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
      ctx.restore();
      
      console.log('掩码绘制完成');
      
    } catch (error) {
      console.error('绘制掩码时发生错误:', error);
    }
  };

  // 绘制边界框
  const drawBoundingBox = (ctx: CanvasRenderingContext2D, bbox: BoundingBox, color: string, rect: DOMRect, imageSize: { width: number; height: number }) => {
    console.log('绘制边界框:', bbox, '颜色:', color);
    
    if (!bbox || bbox.length !== 4) {
      console.log('无效的边界框数据');
      return;
    }
    
    const scaleX = rect.width / imageSize.width;
    const scaleY = rect.height / imageSize.height;

    const [x1, y1, x2, y2] = bbox;
    const scaledX1 = x1 * scaleX;
    const scaledY1 = y1 * scaleY;
    const scaledX2 = x2 * scaleX;
    const scaledY2 = y2 * scaleY;
    
    console.log('缩放后坐标:', { scaledX1, scaledY1, scaledX2, scaledY2 });

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(scaledX1, scaledY1, scaledX2 - scaledX1, scaledY2 - scaledY1);
    ctx.setLineDash([]);

    // 绘制尺寸标签
    ctx.fillStyle = color;
    ctx.font = '12px Arial';
    const width = Math.round(scaledX2 - scaledX1);
    const height = Math.round(scaledY2 - scaledY1);
    ctx.fillText(`${width}×${height}`, scaledX1, scaledY1 - 5);
  };

  // 辅助函数：将十六进制颜色转换为RGBA
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b, a: Math.round(alpha * 255) };
  };

  // 绘制所有标注
  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas尺寸
    const rect = image.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const imageSize = {
      width: image.naturalWidth,
      height: image.naturalHeight
    };

    // 绘制所有对象的标注
    annotations.forEach(annotation => {
      console.log(`绘制对象 ${annotation.id}:`, {
        hasMask: !!annotation.mask,
        showMask,
        shouldDrawMask: !!(annotation.mask && showMask),
        annotationMode
      });
      
      // 绘制掩码（如果开关开启）
      if (annotation.mask && showMask) {
        console.log(`开始绘制对象 ${annotation.id} 的掩码`);
        drawMask(ctx, annotation.mask, annotation.color, rect, imageSize);
      }

      // 绘制边界框（如果开关开启）
      if (annotation.bbox && showBbox) {
        drawBoundingBox(ctx, annotation.bbox, annotation.color, rect, imageSize);
      }

      // 绘制点
      annotation.points.forEach(point => {
        const x = (point.x / imageSize.width) * rect.width;
        const y = (point.y / imageSize.height) * rect.height;

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = point.type === 'positive' ? annotation.color : '#ff4d4f';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制十字标记
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
      });
    });
  }, [annotations, showMask, showBbox]);

  useEffect(() => {
    drawAnnotations();
  }, [annotations, drawAnnotations]);

  const clearCurrentPoints = async () => {
    if (!currentSessionId) {
      message.warning('请先启动标注会话');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SAM2_API_URL}/api/clear_points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSessionId
        })
      });

      if (response.ok) {
        setAnnotations(prev => {
          const updated = [...prev];
          const currentAnn = updated.find(ann => ann.id === currentObject);
          if (currentAnn) {
            currentAnn.points = [];
            currentAnn.mask = undefined;
            currentAnn.bbox = undefined;
          }
          return updated;
        });
        setStatus(`已清除对象${currentObject}的所有标注点`);
        message.success('清除成功');
      }
    } catch (error) {
      message.error(`清除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const nextObject = async () => {
    if (!currentSessionId) {
      message.warning('请先启动标注会话');
      return;
    }

    setLoading(true);
    try {
      // 清除当前会话的后端状态
      await fetch(`${SAM2_API_URL}/api/clear_points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSessionId
        })
      });

      const newObjectId = nextObjectId;
      setCurrentObject(newObjectId);
      setNextObjectId(newObjectId + 1);
      
      // 添加新的标注对象
      if (!annotations.find(ann => ann.id === newObjectId)) {
        setAnnotations(prev => [...prev, {
          id: newObjectId,
          points: [],
          color: colors[(newObjectId - 1) % colors.length],
          sessionId: currentSessionId
        }]);
      }
      
      setStatus(`切换到对象${newObjectId}，开始新的标注`);
      message.success(`已切换到对象${newObjectId}`);
    } catch (error) {
      message.error(`切换对象失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setAnnotations([]);
    setCurrentObject(1);
    setNextObjectId(1); // 重置全局计数器
    setIsSessionActive(false);
    setCurrentSessionId(null);
    setStatus('已重置所有标注，请重新开始');
  };

  // 自然语言自动标注
  const performAutoAnnotation = async () => {
    if (!currentImageFile) {
      message.warning('请先上传图片');
      return;
    }

    if (!textPrompt.trim()) {
      message.warning('请输入要检测的对象描述');
      return;
    }

    setLoading(true);
    setStatus('正在进行自动标注...');

    try {
      const formData = new FormData();
      formData.append('image', currentImageFile);
      formData.append('text_prompt', textPrompt.trim());
      formData.append('box_threshold', boxThreshold.toString());
      formData.append('text_threshold', textThreshold.toString());

      const response = await fetch(`${AUTO_ANNOTATE_API_URL}/api/auto_annotate`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
      }

      const result: AutoAnnotationResult = await response.json();
      
      console.log('自动标注结果:', result);
      console.log('API返回的第一个对象详情:', result.objects?.[0]);

      if (result.success) {
        // 验证结果数据
        if (!result.objects || !Array.isArray(result.objects)) {
          throw new Error('无效的检测结果：缺少objects数组');
        }
        
        // 转换自动标注结果为标注对象，使用全局ID计数器
        let currentNextId = nextObjectId;
        const autoAnnotations: AnnotationObject[] = result.objects.map((obj, index) => {
          const objectId = currentNextId + index;
          console.log(`对象 ${objectId}:`, {
            hasMask: !!obj.mask,
            maskData: obj.mask ? { size: obj.mask.size, countsType: typeof obj.mask.counts } : null,
            hasBbox: !!obj.bbox,
            bboxData: obj.bbox
          });
          
          return {
            id: objectId,
            points: [],
            mask: obj.mask || (obj.bbox ? createMaskFromBbox(obj.bbox, result.image_info || { width: 640, height: 480 }) : undefined),
            bbox: obj.bbox,
            color: colors[(objectId - 1) % colors.length],
            label: obj.label || `对象${objectId}`,
            confidence: typeof obj.confidence === 'number' ? obj.confidence : 0
          };
        });

        // 合并到现有标注中，而不是替换
        setAnnotations(prev => [...prev, ...autoAnnotations]);
        
        // 更新全局ID计数器
        setNextObjectId(currentNextId + result.objects.length);
        
        // 设置当前对象为第一个新添加的对象
        if (autoAnnotations.length > 0) {
          setCurrentObject(autoAnnotations[0].id);
        }
        
        const detectionCount = result.detection_count || autoAnnotations.length;
        const processingTime = result.processing_time?.toFixed(2) || '0';
        
        setStatus(`自动标注完成！检测到 ${detectionCount} 个对象，用时 ${processingTime}s`);
        message.success(`检测完成！发现 ${detectionCount} 个对象`);
      } else {
        throw new Error(result.message || '自动标注失败');
      }
    } catch (error) {
      message.error(`自动标注失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setStatus('自动标注失败');
    } finally {
      setLoading(false);
    }
  };

  const exportAnnotations = () => {
    const data = {
      image: uploadedImage,
      sessionId: currentSessionId,
      annotationMode,
      textPrompt: annotationMode === 'auto' ? textPrompt : undefined,
      annotations: annotations.map(ann => ({
        id: ann.id,
        points: ann.points,
        mask: ann.mask,
        bbox: ann.bbox,
        color: ann.color,
        label: ann.label,
        confidence: ann.confidence
      })),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sam2_annotations_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    message.success('标注数据已导出');
  };

  const totalPoints = annotations.reduce((sum, ann) => sum + ann.points.length, 0);
  const currentAnnotation = getCurrentAnnotation();

  return (
    <FlexLayout flex="column" padding="24px">
      <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
        智能图像标注演示
      </Title>
      
      <Alert
        message="双模式智能分割"
        description="图像分割工具，支持两种标注模式：1) 手动标注：通过点击关键点进行精确分割；2) 智能标注：使用自然语言描述自动检测和分割对象。实时生成分割掩码和边界框，支持多对象标注。"
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Row gutter={24}>
        {/* 主工作区 */}
        <Col span={16}>
          <WorkspaceContainer>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 上传区域 */}
              {!uploadedImage && (
                <Card>
                  <Upload.Dragger
                    accept="image/*"
                    beforeUpload={handleImageUpload}
                    showUploadList={false}
                    style={{ padding: '40px' }}
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
                    </p>
                    <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
                    <p className="ant-upload-hint">支持 JPG、PNG、GIF 格式</p>
                  </Upload.Dragger>
                </Card>
              )}

              {/* 图片显示区域 */}
              {uploadedImage && (
                <ImageContainer>
                  <CanvasWrapper>
                    <img
                      ref={imageRef}
                      src={uploadedImage}
                      alt="上传的图片"
                      style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
                      onClick={handleImageClick}
                    />
                    <OverlayCanvas ref={canvasRef} />
                  </CanvasWrapper>
                </ImageContainer>
              )}

              {/* 状态显示 */}
              <Card size="small">
                <Text type="secondary">状态: {status}</Text>
              </Card>
            </Space>
          </WorkspaceContainer>
        </Col>

        {/* 控制面板 */}
        <Col span={8}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* 标注模式选择 */}
            <Card size="small">
              <Tabs 
                activeKey={annotationMode} 
                onChange={(key) => setAnnotationMode(key as 'manual' | 'auto')}
                size="small"
              >
                <TabPane tab={<span><AimOutlined />手动标注</span>} key="manual">
                  {/* 手动标注控制 */}
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button
                      type="primary"
                      icon={<AimOutlined />}
                      onClick={startAnnotationSession}
                      disabled={!uploadedImage}
                      loading={loading}
                      block
                    >
                      开始标注
                    </Button>
                    <Button
                      icon={<ClearOutlined />}
                      onClick={clearCurrentPoints}
                      disabled={!isSessionActive}
                      loading={loading}
                      block
                    >
                      清除当前对象点
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={resetAll}
                      disabled={!uploadedImage}
                      block
                    >
                      重置所有
                    </Button>
                  </Space>
                </TabPane>
                
                <TabPane tab={<span><BulbOutlined />智能标注</span>} key="auto">
                  {/* 自然语言标注控制 */}
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text style={{ fontSize: '12px', color: '#666' }}>描述要检测的对象：</Text>
                      <TextArea
                        rows={3}
                        value={textPrompt}
                        onChange={(e) => setTextPrompt(e.target.value)}
                        placeholder="例如：person. car. dog. building.
注意：多个对象用英文句号分隔"
                        style={{ marginTop: '4px' }}
                      />
                    </div>
                    
                    <div>
                      <Text style={{ fontSize: '12px', color: '#666' }}>检测阈值: {boxThreshold}</Text>
                      <Slider
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={boxThreshold}
                        onChange={setBoxThreshold}
                        tooltip={{ formatter: (value) => value?.toFixed(2) }}
                      />
                    </div>
                    
                    <div>
                      <Text style={{ fontSize: '12px', color: '#666' }}>文本阈值: {textThreshold}</Text>
                      <Slider
                        min={0.1}
                        max={0.9}
                        step={0.05}
                        value={textThreshold}
                        onChange={setTextThreshold}
                        tooltip={{ formatter: (value) => value?.toFixed(2) }}
                      />
                    </div>
                    
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={performAutoAnnotation}
                      disabled={!uploadedImage}
                      loading={loading}
                      block
                    >
                      开始智能标注
                    </Button>
                    
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={resetAll}
                      disabled={!uploadedImage}
                      block
                    >
                      重置所有
                    </Button>
                  </Space>
                </TabPane>
              </Tabs>
            </Card>



            {/* 显示控制 */}
            <ControlPanel title="显示控制" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>显示掩码</Text>
                  <Switch 
                    checked={showMask} 
                    onChange={setShowMask}
                    size="small"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>显示边界框</Text>
                  <Switch 
                    checked={showBbox} 
                    onChange={setShowBbox}
                    size="small"
                  />
                </div>
              </Space>
            </ControlPanel>

            {/* 多对象控制 */}
            {annotationMode === 'manual' && (
              <ControlPanel title="多对象标注" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text>当前对象: </Text>
                    <Tag color={currentAnnotation?.color || colors[0]}>
                      对象 {currentObject}
                    </Tag>
                  </div>
                  <div>
                    <Text type="secondary">
                      当前对象点数: {currentAnnotation?.points.length || 0}
                    </Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      掩码: {currentAnnotation?.mask ? '✅' : '❌'} | 
                      边界框: {currentAnnotation?.bbox ? '✅' : '❌'}
                    </Text>
                  </div>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={nextObject}
                    disabled={!isSessionActive}
                    loading={loading}
                    block
                  >
                    下一个对象
                  </Button>
                </Space>
              </ControlPanel>
            )}

            {/* 统计信息 */}
            <Row gutter={8}>
              <Col span={12}>
                <StatsCard size="small">
                  <Statistic 
                    title="总对象数" 
                    value={getObjectCounts().total}
                    suffix={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        (手动:{getObjectCounts().manual} 智能:{getObjectCounts().auto})
                      </Text>
                    }
                  />
                </StatsCard>
              </Col>
              <Col span={12}>
                <StatsCard size="small">
                  <Statistic 
                    title={annotationMode === 'manual' ? "总点数" : "下一个ID"} 
                    value={annotationMode === 'manual' ? totalPoints : nextObjectId} 
                  />
                </StatsCard>
              </Col>
            </Row>

            {/* 对象列表 */}
            {annotations.length > 0 && (
              <ControlPanel title="标注对象" size="small">
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {annotations.map(annotation => (
                    <div key={annotation.id} style={{ 
                      padding: '8px', 
                      border: annotation.id === currentObject ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      borderRadius: '4px',
                      backgroundColor: annotation.id === currentObject ? '#f0f9ff' : '#fafafa'
                    }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Space>
                          <Tag color={annotation.color}>对象 {annotation.id}</Tag>
                          {annotationMode === 'manual' && (
                            <Text type="secondary">{annotation.points.length} 点</Text>
                          )}
                          {annotationMode === 'auto' && annotation.confidence && (
                            <Text type="secondary">{(annotation.confidence * 100).toFixed(1)}%</Text>
                          )}
                        </Space>
                        {annotation.label && (
                          <Text style={{ fontSize: '12px' }} strong>
                            {annotation.label}
                          </Text>
                        )}
                      </Space>
                    </div>
                  ))}
                </Space>
              </ControlPanel>
            )}

            {/* 导出 */}
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportAnnotations}
              disabled={totalPoints === 0}
              block
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              导出标注数据
            </Button>

            {/* 操作提示 */}
            <Card size="small" title="操作提示">
              {annotationMode === 'manual' ? (
                <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                  • 上传图片并点击"开始标注"启动SAM2会话<br/>
                  • 左键点击: 添加正向点（前景）<br/>
                  • Shift + 左键: 添加负向点（背景）<br/>
                  • 实时生成分割掩码和边界框<br/>
                  • 支持多对象分割标注<br/>
                  • 后端服务: {getBaseURL()}:5000
                </Paragraph>
              ) : (
                <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                  • 上传图片并输入要检测的对象描述<br/>
                  • 使用自然语言描述，如"person. car. dog."<br/>
                  • 调整检测阈值和文本阈值<br/>
                  • 点击"开始智能标注"自动检测对象<br/>
                  • 支持多对象同时检测<br/>
                  • 后端服务: {getBaseURL()}:5001/api/auto_annotate
                </Paragraph>
              )}
            </Card>
          </Space>
        </Col>
      </Row>
    </FlexLayout>
  );
};

export default ImageAnnotation;