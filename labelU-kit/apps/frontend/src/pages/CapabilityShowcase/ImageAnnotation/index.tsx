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
  Switch
} from 'antd';
import { 
  UploadOutlined, 
  ClearOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  EyeOutlined,
  AimOutlined
} from '@ant-design/icons';
// import { useTranslation } from '@labelu/i18n';
import { FlexLayout } from '@labelu/components-react';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

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

interface AnnotationObject {
  id: number;
  points: Point[];
  mask?: MaskData;
  bbox?: BoundingBox;
  color: string;
  sessionId?: string;
}

const ImageAnnotation = () => {
  // const { t } = useTranslation();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentObject, setCurrentObject] = useState(1);
  const [annotations, setAnnotations] = useState<AnnotationObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('请上传图片开始标注');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
  const [showMask, setShowMask] = useState(true);
  const [showBbox, setShowBbox] = useState(true);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // API配置
  const API_BASE_URL = 'http://localhost:5000';
  
  // 预定义的颜色
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];

  const getCurrentAnnotation = () => {
    return annotations.find(ann => ann.id === currentObject);
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

      const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('图片上传失败');
      }

      const uploadResult = await uploadResponse.json();
      setStatus('图片上传成功，正在初始化分割会话...');

      // 开始分割会话
      const sessionResponse = await fetch(`${API_BASE_URL}/api/start_session`, {
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
        setAnnotations([{
          id: 1,
          points: [],
          color: colors[0],
          sessionId: sessionResult.session_id
        }]);
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
      const response = await fetch(`${API_BASE_URL}/api/add_point`, {
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
    
    try {
      // Base64解码
      const binaryString = atob(encodedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return {
        width,
        height,
        data: bytes
      };
    } catch (error) {
      console.error('掩码解码失败:', error);
      return null;
    }
  };

  // 绘制掩码
  const drawMask = (ctx: CanvasRenderingContext2D, mask: MaskData, color: string, rect: DOMRect, imageSize: { width: number; height: number }) => {
    const decodedMask = decodeMask(mask);
    if (!decodedMask) return;

    const scaleX = rect.width / imageSize.width;
    const scaleY = rect.height / imageSize.height;

    // 创建临时canvas用于掩码
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = decodedMask.width;
    tempCanvas.height = decodedMask.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // 将掩码数据转换为ImageData
    const imageData = tempCtx.createImageData(decodedMask.width, decodedMask.height);
    const rgbaColor = hexToRgba(color, 0.5); // 半透明

    for (let i = 0; i < decodedMask.data.length; i++) {
      if (decodedMask.data[i] > 0) {
        const pixelIndex = i * 4;
        imageData.data[pixelIndex] = rgbaColor.r;     // R
        imageData.data[pixelIndex + 1] = rgbaColor.g; // G
        imageData.data[pixelIndex + 2] = rgbaColor.b; // B
        imageData.data[pixelIndex + 3] = rgbaColor.a; // A
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    // 将掩码绘制到主canvas上
    ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
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
      // 绘制掩码（如果开关开启）
      if (annotation.mask && showMask) {
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
      const response = await fetch(`${API_BASE_URL}/api/clear_points`, {
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
      await fetch(`${API_BASE_URL}/api/clear_points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSessionId
        })
      });

      const newObjectId = currentObject + 1;
      setCurrentObject(newObjectId);
      
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
    setIsSessionActive(false);
    setCurrentSessionId(null);
    setStatus('已重置所有标注，请重新开始');
  };

  const exportAnnotations = () => {
    const data = {
      image: uploadedImage,
      sessionId: currentSessionId,
      annotations: annotations.map(ann => ({
        id: ann.id,
        points: ann.points,
        mask: ann.mask,
        bbox: ann.bbox,
        color: ann.color
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
        SAM2 图像分割演示
      </Title>
      
      <Alert
        message="SAM2 智能分割"
        description="基于Meta SAM2模型的智能图像分割工具。上传图片后，只需点击几个关键点，AI即可自动生成精确的分割掩码和边界框。支持多对象同时标注，实时预览分割结果。"
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
            {/* 基本控制 */}
            <ControlPanel title="基本控制" size="small">
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
            </ControlPanel>

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

            {/* 统计信息 */}
            <Row gutter={8}>
              <Col span={12}>
                <StatsCard size="small">
                  <Statistic title="总对象数" value={annotations.length} />
                </StatsCard>
              </Col>
              <Col span={12}>
                <StatsCard size="small">
                  <Statistic title="总点数" value={totalPoints} />
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
                      <Space>
                        <Tag color={annotation.color}>对象 {annotation.id}</Tag>
                        <Text type="secondary">{annotation.points.length} 点</Text>
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
              <Paragraph style={{ margin: 0, fontSize: '12px' }}>
                • 上传图片并点击"开始标注"启动SAM2会话<br/>
                • 左键点击: 添加正向点（前景）<br/>
                • Shift + 左键: 添加负向点（背景）<br/>
                • 实时生成分割掩码和边界框<br/>
                • 支持多对象分割标注<br/>
                • 后端服务: localhost:5000
              </Paragraph>
            </Card>
          </Space>
        </Col>
      </Row>
    </FlexLayout>
  );
};

export default ImageAnnotation;