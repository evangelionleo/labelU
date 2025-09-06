import { useState, createRef, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import * as _ from 'lodash-es';
import { Empty, Spin, message, Typography, Card, Space, Button, Alert, Tabs, Switch, Input, InputNumber } from 'antd';
import { Annotator } from '@labelu/video-annotator-react';
import type { AudioAndVideoAnnotatorRef } from '@labelu/audio-annotator-react';
import { Annotator as AudioAnnotator } from '@labelu/audio-annotator-react';
import { useSearchParams, useParams, useRouteLoaderData } from 'react-router-dom';
import { Bridge } from 'iframe-message-bridge';
import type { ImageAnnotatorProps, AnnotatorRef as ImageAnnotatorRef } from '@labelu/image-annotator-react';
import { Annotator as ImageAnnotator } from '@labelu/image-annotator-react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { FlexLayout } from '@labelu/components-react';
import type { ToolName } from '@labelu/image';
import type { ILabel } from '@labelu/interface';
import { useTranslation } from '@labelu/i18n';
import { ScanOutlined, DownloadOutlined, RobotOutlined } from '@ant-design/icons';

import { MediaType, SampleState, type SampleResponse } from '@/api/types';
import { useScrollFetch } from '@/hooks/useScrollFetch';
import type { getSample } from '@/api/services/samples';
import { getSamples } from '@/api/services/samples';
import { convertAudioAndVideoConfig } from '@/utils/convertAudioAndVideoConfig';
import { convertAudioAndVideoSample, convertMediaAnnotations } from '@/utils/convertAudioAndVideoSample';
import type { TaskLoaderResult } from '@/loaders/task.loader';
import { convertImageConfig } from '@/utils/convertImageConfig';
import { convertImageAnnotations, convertImageSample } from '@/utils/convertImageSample';
import { TOOL_NAME } from '@/constants/toolName';
import useMe from '@/hooks/useMe';
import QAGenerationService from '@/api/services/qaGeneration';

import SlideLoader from './components/slideLoader';
import AnnotationRightCorner from './components/annotationRightCorner';
import AnnotationContext from './annotation.context';
import { LoadingWrapper, Wrapper } from './style';
import useSampleWs from '../../hooks/useSampleWs';
import SmartAnnotationPanel from './components/SmartAnnotationPanel';
import { ClickAnnotationPanel } from './components/ClickAnnotationPanel';

import { 
  startClickAnnotationSession, 
  addClickPoint, 
  clearClickPoints, 
  convertMaskToRectData,
  convertPercentageToPixel,
  type ClickAnnotationSession,
  type ClickAnnotationResult
} from '@/api/services/clickAnnotation';

// 添加PDF.js类型声明
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

type AllToolName = ToolName | 'segment' | 'frame' | 'tag' | 'text';

// 问答对生成标注组件
const QAGenerationAnnotation = ({ task, sample, preAnnotation }: { 
  task: any; 
  sample: any; 
  preAnnotation: any; 
}) => {
  const { t } = useTranslation();
  const { Title, Text, Paragraph } = Typography;
  
  // API配置常量 - 参考demo_gradio_pp.py
  const API_CONFIG = {
    deepseek_api_key: "sk-fd949d012f8d47f9a5840ccbe128f5fc",
    deepseek_model: "deepseek-chat",
    deepseek_base_url: "https://api.deepseek.com",
    default_qa_pairs: 5
  };
  
  // 获取任务的所有样本和预标注文件
  const { samples, preAnnotations } = useRouteLoaderData('task') as any;
  
  // PDF查看状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string>('');
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  
  // OCR状态
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrError, setOcrError] = useState<string>('');
  
  // 图片模式状态
  const [useHighQualityMode, setUseHighQualityMode] = useState(false); // false: 速度最快, true: 平衡性能
  
  // 样本导航状态
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [allSamples, setAllSamples] = useState<any[]>([]);
  
  // 问答对生成状态
  const [qaConfig, setQaConfig] = useState({
    apiKey: API_CONFIG.deepseek_api_key,
    model: API_CONFIG.deepseek_model,
    baseUrl: API_CONFIG.deepseek_base_url,
    numPairs: API_CONFIG.default_qa_pairs,
    prompt: `你是一个资深的知识工程师。基于给定知识片段，生成高质量问答对。
要求：
- 覆盖关键事实、概念、边界条件；
- 问题应简洁清晰，答案准确可验证；
- 输出严格为JSON数组，每个元素包含 question, answer 两个字段；
- 不要添加任何额外说明。
示例输出：
[{"question": "...", "answer": "..."}]`,
    knowledgeText: ''
  });
  
  // 问答对结果状态
  const [qaResult, setQaResult] = useState<{
    markdown: string;
    json: string;
    loading: boolean;
    saving: boolean;
    error: string;
  }>({
    markdown: '',
    json: '',
    loading: false,
    saving: false,
    error: ''
  });
  
  console.log('QAGenerationAnnotation 组件开始渲染');
  console.log('任务信息:', task);
  console.log('样本信息:', sample);
  console.log('预标注信息:', preAnnotation);
  console.log('所有样本:', samples);
  console.log('所有预标注:', preAnnotations);
  
  // 获取PDF文件URL
  useEffect(() => {
    if (sample?.data?.file?.url) {
      setPdfUrl(sample.data.file.url);
      console.log('PDF文件URL:', sample.data.file.url);
    } else if (preAnnotation?.data?.[0]?.file?.url) {
      setPdfUrl(preAnnotation.data[0].file.url);
      console.log('预标注PDF文件URL:', preAnnotation.data[0].file.url);
    }
  }, [sample, preAnnotation]);
  
  // 构建所有样本列表
  useEffect(() => {
    console.log('开始构建样本列表');
    console.log('samples:', samples);
    console.log('samples?.data:', samples?.data);
    console.log('samples?.data 类型:', typeof samples?.data);
    console.log('samples?.data 是否为数组:', Array.isArray(samples?.data));
    
    if (samples?.data && Array.isArray(samples.data)) {
      const sampleList = samples.data.filter((sampleItem: any) => 
        sampleItem.data?.file && sampleItem.data.file.url
      );
      setAllSamples(sampleList);
      
      // 设置当前样本索引
      const currentIndex = sampleList.findIndex((s: any) => s.id === sample?.id);
      if (currentIndex !== -1) {
        setCurrentSampleIndex(currentIndex);
        console.log('当前样本索引:', currentIndex);
      }
    }
  }, [samples, sample]);
  
  // 样本切换处理
  const handleSampleChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentSampleIndex > 0) {
      const newIndex = currentSampleIndex - 1;
      setCurrentSampleIndex(newIndex);
      const newSample = allSamples[newIndex];
      if (newSample?.data?.file?.url) {
        setPdfUrl(newSample.data.file.url);
        // 重置PDF状态
        setCurrentPage(1);
        setTotalPages(1);
        setPdfDocument(null);
        setPdfError('');
        console.log('切换到上一个样本:', newSample);
      }
    } else if (direction === 'next' && currentSampleIndex < allSamples.length - 1) {
      const newIndex = currentSampleIndex + 1;
      setCurrentSampleIndex(newIndex);
      const newSample = allSamples[newIndex];
      if (newSample?.data?.file?.url) {
        setPdfUrl(newSample.data.file.url);
        // 重置PDF状态
        setCurrentPage(1);
        setTotalPages(1);
        setPdfDocument(null);
        setPdfError('');
        console.log('切换到下一个样本:', newSample);
      }
    }
  };
  
  // OCR当前页
  const handleOCRCurrentPage = async () => {
    if (!pdfDocument) {
      setOcrError('PDF文档未加载完成');
      return;
    }
    
    try {
      setOcrLoading(true);
      setOcrError('');
      setOcrResult(null);
      
      console.log('=== OCR Debug 开始 ===');
      console.log('当前页:', currentPage);
      console.log('图片模式:', useHighQualityMode ? '平衡性能' : '速度最快');
      console.log('useHighQualityMode状态:', useHighQualityMode);
      
      let canvasElement: HTMLCanvasElement | null = null;
      
      if (useHighQualityMode) {
        // 平衡性能模式：获取高质量图片
        console.log('使用平衡性能模式，开始获取高质量图片...');
        canvasElement = await getHighQualityPageImage();
        if (!canvasElement) {
          setOcrError('获取高质量图片失败');
          return;
        }
        console.log('平衡性能模式 - 获取到高质量图片:', canvasElement.width, '×', canvasElement.height);
      } else {
        // 速度最快模式：使用当前显示的图片
        console.log('使用速度最快模式，获取当前显示图片...');
        canvasElement = document.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
        if (!canvasElement) {
          setOcrError('无法获取当前页面canvas');
          return;
        }
        console.log('速度最快模式 - 获取到当前图片:', canvasElement.width, '×', canvasElement.height);
      }
      
      console.log('最终使用的Canvas尺寸:', canvasElement.width, '×', canvasElement.height);
      console.log('总像素数:', canvasElement.width * canvasElement.height);
      console.log('=== OCR Debug 结束 ===');
      
      // 将canvas转换为blob
      const blob = await new Promise<Blob>((resolve) => {
        canvasElement!.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/png');
      });
      
      // 创建FormData
      const formData = new FormData();
      formData.append('file', blob, `page_${currentPage}_${canvasElement.width}x${canvasElement.height}.png`);
      formData.append('prompt_mode', 'prompt_layout_all_en');
      // 从运行时配置获取服务端 IP/端口（用于 OCR 后端）
      const runtimeCfg = (window as any).__SERVER_CONFIG || {};
      const configuredApi = String(runtimeCfg.API_BASE_URL || '');
      const configuredOcr = String(runtimeCfg.OCR_BASE_URL || '');

      // 推导 OCR 基础地址：
      // 1) 优先 OCR_BASE_URL
      // 2) 否则从 API_BASE_URL 解析 URL，强制端口改为 5004，并仅使用 origin
      const deriveOcrBase = () => {
        if (configuredOcr) {
          // 若未包含协议，自动补 http://
          const withProto = /^https?:\/\//i.test(configuredOcr) ? configuredOcr : `http://${configuredOcr}`;
          try {
            const u = new URL(withProto);
            return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
          } catch {
            return withProto;
          }
        }
        if (configuredApi) {
          try {
            const u = new URL(configuredApi);
            u.port = '5004';
            // 清空路径，仅保留协议+主机+端口
            return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
          } catch {
            // 回退：简单替换端口
            const m = configuredApi.match(/^https?:\/\/[^\/]+/);
            if (m) return m[0].replace(/:\d+$/, ':5004');
            return configuredApi;
          }
        }
        return '';
      };

      const ocrBase = deriveOcrBase();
      const ocrUrl = `${ocrBase ? ocrBase.replace(/\/$/, '') : ''}/realtime/ocr`;
      console.log('[OCR] runtime cfg:', runtimeCfg, 'configuredApi:', configuredApi, 'configuredOcr:', configuredOcr);
      console.log('[OCR] derived:', { ocrBase, ocrUrl });

      try {
        const { hostname, port } = new URL(ocrBase || window.location.origin);
        formData.append('server_ip', hostname || '');
        formData.append('server_port', port || '');
      } catch {
        formData.append('server_ip', '');
        formData.append('server_port', '');
      }
      formData.append('min_pixels', '100000');
      formData.append('max_pixels', '1000000');
      formData.append('fitz_preprocess', 'false');
      formData.append('max_image_width', '1300');
      formData.append('max_image_height', '1300');
      formData.append('max_total_pixels', '1690000');
      
      // 调用 OCR API（从运行时配置推导的地址）
      const response = await fetch(ocrUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`OCR API调用失败: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setOcrResult(result.data);
        console.log('OCR结果:', result.data);
      } else {
        throw new Error(result.error || 'OCR处理失败');
      }
      
    } catch (error: any) {
      console.error('OCR处理失败:', error);
      setOcrError(error.message || 'OCR处理失败');
    } finally {
      setOcrLoading(false);
    }
  };
  
  // 获取当前页高质量图片（平衡性能模式）
  const getHighQualityPageImage = async (): Promise<HTMLCanvasElement | null> => {
    if (!pdfDocument) return null;
    
    try {
      // 获取当前页面
      const page = await pdfDocument.getPage(currentPage);
      
      // 计算缩放比例，将最长边缩放到1300像素
      const viewport = page.getViewport({ scale: 1.0 });
      const maxDimension = Math.max(viewport.width, viewport.height);
      const targetScale = 1300 / maxDimension;
      
      // 创建新的viewport
      const scaledViewport = page.getViewport({ scale: targetScale });
      
      // 创建canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      
      // 设置canvas尺寸
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      // 渲染页面到canvas
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport
      };
      
      await page.render(renderContext).promise;
      
      console.log(`平衡性能模式 - 页面${currentPage}: ${viewport.width}×${viewport.height} → ${scaledViewport.width}×${scaledViewport.height} (缩放比例: ${targetScale.toFixed(3)})`);
      
      return canvas;
    } catch (error: any) {
      console.error('获取高质量图片失败:', error);
      return null;
    }
  };
  
  // 加载PDF文档并获取页数
  useEffect(() => {
    if (!pdfUrl) return;
    
    setPdfLoading(true);
    setPdfError('');
    
    // 动态加载PDF.js库
    const loadPDFJS = async () => {
      try {
        // 检查是否已经加载了PDF.js
        if (typeof window.pdfjsLib === 'undefined') {
          // 加载本地 PDF.js（已放置于 /scripts）
          const script = document.createElement('script');
          script.src = '/scripts/pdf.min.js';
          script.onload = () => {
            // 设置本地 worker 路径
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/scripts/pdf.worker.min.js';
            loadPDFDocument();
          };
          script.onerror = () => {
            setPdfError('PDF.js库加载失败');
            setPdfLoading(false);
          };
          document.head.appendChild(script);
        } else {
          loadPDFDocument();
        }
      } catch (error) {
        console.error('加载PDF.js失败:', error);
        setPdfError('PDF.js库加载失败');
        setPdfLoading(false);
      }
    };
    
    const loadPDFDocument = async () => {
      try {
        console.log('开始加载PDF文档:', pdfUrl);
        
        // 使用PDF.js加载文档
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        
        console.log('PDF文档加载成功，总页数:', pdf.numPages);
        
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setPdfLoading(false);
        
        // 重置到第一页
        setCurrentPage(1);
      } catch (error: any) {
        console.error('PDF文档加载失败:', error);
        setPdfError(`PDF文档加载失败: ${error.message}`);
        setPdfLoading(false);
      }
    };
    
    loadPDFJS();
  }, [pdfUrl]);
  
  // 翻页处理
  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  // 渲染PDF内容
  const renderPDFContent = () => {
    if (pdfLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spin size="large" />
          <div style={{ marginTop: '1rem' }}>
            <Text>正在加载PDF文件...</Text>
          </div>
        </div>
      );
    }
    
    if (pdfError) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Alert
            message="PDF加载失败"
            description={pdfError}
            type="error"
            showIcon
          />
        </div>
      );
    }
    
    if (!pdfUrl) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Text type="secondary" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
            未找到PDF文件
          </Text>
          <Text type="secondary">
            请检查文件是否正确上传
          </Text>
        </div>
      );
    }
    
    if (!pdfDocument) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Text type="secondary">PDF文档正在加载中...</Text>
        </div>
      );
    }
    
    // 使用PDF.js渲染当前页面
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <PDFPageRenderer 
          pdfDocument={pdfDocument} 
          pageNumber={currentPage} 
          onPageLoad={() => console.log(`PDF第${currentPage}页渲染完成`)}
        />
        
        {/* PDF页面信息指示器 */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          第 {currentPage} 页 / 共 {totalPages} 页
        </div>
      </div>
    );
  };
  
  // 计算当前canvas的像素信息
  const canvasDimensions = useMemo(() => {
    const canvas = document.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
    if (canvas) {
      return `${canvas.width} × ${canvas.height}`;
    }
    return 'N/A';
  }, [currentPage]);

  const totalPixels = useMemo(() => {
    const canvas = document.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
    if (canvas) {
      return canvas.width * canvas.height;
    }
    return 0;
  }, [currentPage]);

  const estimatedMemory = useMemo(() => {
    const pixels = totalPixels;
    return `${(pixels * 4 / (1024 * 1024)).toFixed(2)} MB`;
  }, [totalPixels]);

  // Markdown渲染函数
  const renderMarkdown = (markdown: string): string => {
    if (!markdown) return '';
    
    // 简单的Markdown到HTML转换
    let html = markdown
      // 标题
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // 粗体和斜体
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 代码
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // 图片 - 支持base64和URL
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        if (src.startsWith('data:image/')) {
          // Base64图片
          return `<img src="${src}" alt="${alt || '图片'}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 8px 0;" />`;
        } else if (src.startsWith('http')) {
          // 网络图片
          return `<img src="${src}" alt="${alt || '图片'}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 8px 0;" />`;
        } else {
          // 相对路径图片
          return `<img src="${src}" alt="${alt || '图片'}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 8px 0;" />`;
        }
      })
      // 链接
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // 列表
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$1. $2</li>')
      // 换行
      .replace(/\n/g, '<br>');
    
    // 包装列表项
    html = html
      .replace(/(<li>.*?<\/li>)/gm, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '');
    
    return html;
  };

  // 生成问答对函数
  const handleGenerateQA = async () => {
    if (!qaConfig.knowledgeText.trim()) {
      message.warning('请先输入知识文本');
      return;
    }

    if (!qaConfig.apiKey.trim()) {
      message.error('请配置DeepSeek API Key');
      return;
    }

    try {
      setQaResult(prev => ({ ...prev, loading: true, error: '' }));
      message.loading('正在生成问答对...', 0);

      // 构建请求数据
      const requestData = {
        model: qaConfig.model,
        messages: [
          {
            role: "system",
            content: "你是一个资深的知识工程师，专门负责生成高质量的问答对。"
          },
          {
            role: "user",
            content: `${qaConfig.prompt}\n\n知识文本：\n${qaConfig.knowledgeText}\n\n请生成${qaConfig.numPairs}个问答对。`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      };

      // 调用DeepSeek API
      const response = await fetch(`${qaConfig.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qaConfig.apiKey}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API调用失败: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
      }

      const result = await response.json();
      
      if (!result.choices || !result.choices[0]?.message?.content) {
        throw new Error('API返回数据格式错误');
      }

      const content = result.choices[0].message.content;
      
      // 尝试解析JSON格式的问答对
      let qaPairs;
      try {
        // 提取JSON部分
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          qaPairs = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('未找到有效的JSON格式');
        }
      } catch (parseError) {
        console.warn('JSON解析失败，使用原始内容:', parseError);
        qaPairs = content;
      }

      // 生成Markdown格式
      let markdown = '';
      if (Array.isArray(qaPairs)) {
        markdown = qaPairs.map((qa, index) => {
          return `## 问题 ${index + 1}\n\n${qa.question}\n\n## 答案 ${index + 1}\n\n${qa.answer}\n\n---\n\n`;
        }).join('');
      } else {
        markdown = content;
      }

      // 更新结果状态
      setQaResult({
        markdown,
        json: Array.isArray(qaPairs) ? JSON.stringify(qaPairs, null, 2) : content,
        loading: false,
        saving: false,
        error: ''
      });

      message.destroy();
      message.success(`成功生成${Array.isArray(qaPairs) ? qaPairs.length : 0}个问答对`);

    } catch (error: any) {
      console.error('生成问答对失败:', error);
      setQaResult(prev => ({
        ...prev,
        loading: false,
        saving: false,
        error: error.message || '生成问答对失败'
      }));
      
      message.destroy();
      message.error(`生成失败: ${error.message || '未知错误'}`);
    }
  };

  // 保存问答对到任务函数
  const handleSaveQAToTask = async () => {
    if (!qaResult.json) {
      message.warning('没有可保存的问答对数据');
      return;
    }

    try {
      setQaResult(prev => ({ ...prev, saving: true }));
      message.loading('正在保存问答对到任务...', 0);

      // 解析问答对数据
      let qaPairs;
      try {
        qaPairs = JSON.parse(qaResult.json);
        if (!Array.isArray(qaPairs)) {
          throw new Error('问答对数据格式错误');
        }
      } catch (parseError) {
        message.destroy();
        message.error('问答对数据格式错误，无法保存');
        return;
      }

      // 构建要保存的数据结构 - 直接保存问答对，不分会话
      // 过滤掉空的问题或答案，以及没有sampleId的数据
      const qaDataToSave = qaPairs
        .filter((qa: any) => qa && qa.question && qa.answer && 
          qa.question.trim() !== '' && qa.answer.trim() !== '')
        .map((qa: any, index: number) => ({
          id: `qa_${Date.now()}_${index}`,
          question: qa.question.trim(),
          answer: qa.answer.trim(),
          prompt: qaConfig.prompt,
          knowledgeText: qaConfig.knowledgeText,
          taskId: task.id,
          sampleId: sample?.data?.id,  // 修复：从sample?.id改为sample?.data?.id
          preAnnotationId: preAnnotation?.id,
          currentPage: currentPage,
          totalPages: totalPages,
          sampleIndex: currentSampleIndex,
          filename: allSamples[currentSampleIndex]?.data?.file?.filename || sample?.data?.file?.filename || '未命名文件',
          config: {
            apiKey: qaConfig.apiKey ? '***' + qaConfig.apiKey.slice(-4) : '', // 隐藏完整API Key
            model: qaConfig.model,
            baseUrl: qaConfig.baseUrl,
            numPairs: qaConfig.numPairs
          },
          createdAt: new Date().toISOString()
        }))
        .filter((qa: any) => qa.sampleId !== undefined && qa.sampleId !== null); // 过滤掉没有sampleId的数据

      // 检查过滤后的数据
      if (qaDataToSave.length === 0) {
        message.destroy();
        message.error('没有可保存的问答对数据：所有数据都缺少sampleId字段。请检查样本是否正确加载。');
        console.error('所有问答对数据都缺少sampleId字段:', qaPairs);
        console.error('sample对象:', sample);
        console.error('sample?.id:', sample?.id);
        return;
      }

      // 检查是否有有效的问答对数据
      if (qaDataToSave.length === 0) {
        message.destroy();
        message.warning('没有有效的问答对数据可保存');
        return;
      }

      console.log('准备保存的问答对数据:', qaDataToSave);

      try {
        // 1. 首先保存当前新生成的问答对到后端
        const batchCommand = {
          qa_pairs: qaDataToSave.map(qa => ({
            task_id: qa.taskId,
            sample_id: qa.sampleId,
            pre_annotation_id: qa.preAnnotationId,
            question: qa.question,
            answer: qa.answer,
            prompt: qa.prompt,
            knowledge_text: qa.knowledgeText,
            current_page: qa.currentPage,
            total_pages: qa.totalPages,
            sample_index: qa.sampleIndex,
            filename: qa.filename,
            api_model: qa.config.model,
            api_base_url: qa.config.baseUrl,
            num_pairs: qa.config.numPairs
          }))
        };

        const response = await QAGenerationService.batchCreate(batchCommand);
        
        // 2. 检查localStorage中本任务下还有哪些数据没有保存到数据库
        const storageKey = `qa_data_task_${task.id}`;
        const existingData = localStorage.getItem(storageKey);
        let allLocalData = [];
        
        if (existingData) {
          try {
            allLocalData = JSON.parse(existingData);
          } catch (error) {
            console.warn('解析现有localStorage数据失败，重置为空数组');
            allLocalData = [];
          }
        }

        // 3. 找出localStorage中未保存到数据库的数据（没有id或id为临时值的数据）
        const unsavedData = allLocalData.filter((qa: any) => 
          !qa.id || (typeof qa.id === 'string' && qa.id.startsWith('temp_')) || (typeof qa.id === 'number' && qa.id < 1000)
        );

        console.log('localStorage中未保存到数据库的数据:', unsavedData);

        // 4. 如果有未保存的数据，一起同步到数据库
        if (unsavedData.length > 0) {
          try {
            const unsavedBatchCommand = {
              qa_pairs: unsavedData
                .filter((qa: any) => qa.sampleId !== undefined && qa.sampleId !== null) // 过滤掉没有sampleId的数据
                .map(qa => ({
                  task_id: qa.taskId || task.id,
                  sample_id: qa.sampleId || sample?.data?.id,  // 修复：从sample.id改为sample?.data?.id
                  pre_annotation_id: qa.preAnnotationId,
                  question: qa.question,
                  answer: qa.answer,
                  prompt: qa.prompt,
                  knowledge_text: qa.knowledgeText,
                  current_page: qa.currentPage,
                  total_pages: qa.totalPages,
                  sample_index: qa.sampleIndex,
                  filename: qa.filename,
                  api_model: qa.config?.model,
                  api_base_url: qa.config?.baseUrl,
                  num_pairs: qa.config?.numPairs
                }))
            };

            const unsavedResponse = await QAGenerationService.batchCreate(unsavedBatchCommand);
            console.log('同步未保存数据到数据库成功:', unsavedResponse);
            
            message.destroy();
            message.success(`成功保存${response.total}个新问答对，并同步${unsavedResponse.total}个未保存数据到数据库！`);
          } catch (syncError: any) {
            console.warn('同步未保存数据失败:', syncError);
            message.destroy();
            message.warning(`新问答对保存成功，但同步未保存数据失败: ${syncError.message || '未知错误'}`);
          }
        } else {
          message.destroy();
          message.success(`成功保存${response.total}个问答对到后端数据库！`);
        }

        // 5. 更新localStorage，合并所有数据并标记为已保存
        const allQAData = [
          ...qaDataToSave.map((qa: any) => ({ ...qa, id: `saved_${Date.now()}_${Math.random()}` })),
          ...allLocalData.filter((qa: any) => qa.id && (typeof qa.id !== 'string' || !qa.id.startsWith('temp_')) && (typeof qa.id !== 'number' || qa.id >= 1000))
        ];
        
        localStorage.setItem(storageKey, JSON.stringify(allQAData, null, 2));

        // 6. 刷新已保存数据展示
        // 延迟刷新，确保数据已更新
        setTimeout(() => {
          // 这里可以触发数据刷新，或者让用户手动刷新
          console.log('数据已保存，建议刷新页面查看最新数据');
        }, 500);

        console.log('问答对数据已保存到后端:', {
          response,
          savedQAPairs: qaDataToSave.length,
          unsavedDataCount: unsavedData.length,
          totalLocalData: allQAData.length
        });

      } catch (apiError: any) {
        console.error('后端API保存失败:', apiError);
        
        // 如果后端保存失败，仍然保存到localStorage作为备份
        const storageKey = `qa_data_task_${task.id}`;
        const existingData = localStorage.getItem(storageKey);
        let allQAData = [];
        
        if (existingData) {
          try {
            allQAData = JSON.parse(existingData);
          } catch (error) {
            console.warn('解析现有数据失败，重置为空数组');
            allQAData = [];
          }
        }

        // 添加新的问答对数据到列表，标记为未保存
        const newQAData = qaDataToSave.map((qa: any) => ({ 
          ...qa, 
          id: `temp_${Date.now()}_${Math.random()}`,
          savedToDatabase: false 
        }));
        
        allQAData.push(...newQAData);
        
        // 保存到localStorage
        localStorage.setItem(storageKey, JSON.stringify(allQAData, null, 2));

        message.destroy();
        message.warning(`后端保存失败，已保存到本地缓存。错误: ${apiError.message || '未知错误'}`);
      }

    } catch (error: any) {
      console.error('保存问答对到任务失败:', error);
      setQaResult(prev => ({ ...prev, saving: false }));
      
      message.destroy();
      message.error(`保存失败: ${error.message || '未知错误'}`);
    } finally {
      setQaResult(prev => ({ ...prev, saving: false }));
    }
  };

  // 查看已保存的问答对数据函数
  const handleViewSavedQA = () => {
    try {
      const storageKey = `qa_data_task_${task.id}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (!savedData) {
        message.info('当前任务还没有保存的问答对数据');
        return;
      }

      const qaData = JSON.parse(savedData);
      console.log('已保存的问答对数据:', qaData);

      // 显示保存的数据统计信息
      const totalQAPairs = qaData.length;

      message.info(`当前任务已保存 ${totalQAPairs} 个问答对`);

      // 在控制台显示详细信息
      console.log('=== 已保存的问答对数据统计 ===');
      console.log(`任务ID: ${task.id}`);
      console.log(`总问答对数: ${totalQAPairs}`);
      
      qaData.forEach((qa: any, qaIndex: number) => {
        console.log(`\n--- 问答对 ${qaIndex + 1} ---`);
        console.log(`ID: ${qa.id}`);
        console.log(`创建时间: ${qa.createdAt}`);
        console.log(`样本ID: ${qa.sampleId}`);
        console.log(`页码: ${qa.currentPage}/${qa.totalPages}`);
        console.log(`文件名: ${qa.filename}`);
        console.log(`问题: ${qa.question?.substring(0, 100)}...`);
        console.log(`答案: ${qa.answer?.substring(0, 100)}...`);
        console.log(`提示词: ${qa.prompt?.substring(0, 100)}...`);
        console.log(`知识文本长度: ${qa.knowledgeText?.length || 0} 字符`);
      });

      // 可以在这里添加一个模态框来显示详细数据
      // 或者跳转到一个专门的数据查看页面

    } catch (error: any) {
      console.error('查看已保存数据失败:', error);
      message.error(`查看失败: ${error.message || '未知错误'}`);
    }
  };

  // 下载当前页图片函数
  const handleDownloadCurrentPage = async () => {
    try {
      console.log('=== 下载图片 Debug 开始 ===');
      console.log('当前页:', currentPage);
      console.log('图片模式:', useHighQualityMode ? '平衡性能' : '速度最快');
      console.log('useHighQualityMode状态:', useHighQualityMode);
      
      let canvasElement: HTMLCanvasElement | null = null;
      
      if (useHighQualityMode) {
        // 平衡性能模式：获取高质量图片
        console.log('使用平衡性能模式，开始获取高质量图片...');
        canvasElement = await getHighQualityPageImage();
        if (!canvasElement) {
          message.error('获取高质量图片失败');
          return;
        }
        console.log('平衡性能模式 - 获取到高质量图片:', canvasElement.width, '×', canvasElement.height);
      } else {
        // 速度最快模式：使用当前显示的图片
        console.log('使用速度最快模式，获取当前显示图片...');
        canvasElement = document.querySelector('.pdf-page-canvas') as HTMLCanvasElement;
        if (!canvasElement) {
          message.error('无法获取当前页面canvas');
          return;
        }
        console.log('速度最快模式 - 获取到当前图片:', canvasElement.width, '×', canvasElement.height);
      }
      
      console.log('最终使用的Canvas尺寸:', canvasElement.width, '×', canvasElement.height);
      console.log('总像素数:', canvasElement.width * canvasElement.height);
      console.log('=== 下载图片 Debug 结束 ===');
      
      // 将canvas转换为blob并下载
      const blob = await new Promise<Blob>((resolve) => {
        canvasElement!.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/png');
      });
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `page_${currentPage}_${canvasElement.width}x${canvasElement.height}_${useHighQualityMode ? 'high' : 'fast'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success(`已下载第${currentPage}页图片: ${canvasElement.width}×${canvasElement.height} (${useHighQualityMode ? '平衡性能' : '速度最快'}模式)`);
    } catch (error: any) {
      message.error(`下载失败: ${error.message}`);
    }
  };
  
  return (
    <div style={{ padding: '2rem', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 页面头部 */}
      <Card style={{ marginBottom: '1rem' }}>
        <Title level={3}>问答对生成任务</Title>
        <Text type="secondary">
          任务ID: {task.id} | 任务名称: {task.name}
        </Text>
        {pdfUrl && (
          <div style={{ marginTop: '0.5rem' }}>
            <Text type="secondary">
             当前文件: {allSamples[currentSampleIndex]?.data?.file?.filename || sample?.data?.file?.filename || preAnnotation?.data?.[0]?.file?.filename || '未命名文件'}
             {allSamples.length > 0 && (
               <span style={{ marginLeft: '0.5rem', color: '#1890ff' }}>
                 (样本 {currentSampleIndex + 1} / {allSamples.length})
               </span>
             )}
            </Text>
          </div>
        )}
        <Alert
          message="问答对生成页面"
          description="这是问答对生成任务的标注页面"
          type="success"
          showIcon
          style={{ marginTop: '1rem' }}
        />
        
        {/* DeepSeek API 配置说明 */}
        <Alert
          message="DeepSeek API 配置说明"
          description={
            <div>
              <p>问答对生成功能需要配置DeepSeek API才能正常工作：</p>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>获取API Key：访问 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer">DeepSeek平台</a></li>
                <li>配置API Key：在下方"问答对生成"面板中输入您的API Key</li>
                <li>选择模型：推荐使用 deepseek-chat 模型</li>
                <li>设置数量：可配置生成1-20个问答对</li>
              </ul>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
                💡 提示：API Key将保存在浏览器本地，不会上传到服务器
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: '1rem' }}
        />
      </Card>
      
      {/* PDF查看器和OCR结果 */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {/* 左侧：PDF查看器 */}
        <Card title="PDF文档查看" style={{ flex: 1 }}>
          <div style={{ 
            width: '100%',
            background: '#f8f9fa', 
            border: '2px dashed #d9d9d9',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '200px'
          }}>
            {renderPDFContent()}
          </div>
          
          {/* PDF控制按钮 */}
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem',
            borderTop: '1px solid #f0f0f0'
          }}>
            <Space>
              <Button 
                disabled={currentPage <= 1}
                onClick={() => handlePageChange('prev')}
              >
                上一页
              </Button>
              <Text>第 {currentPage} 页 / 共 {totalPages} 页</Text>
              <Button 
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange('next')}
              >
                下一页
              </Button>
            </Space>
            
            <Space style={{ marginTop: '1rem' }}>
              <Text>样本 {currentSampleIndex + 1} / {allSamples.length || 1}</Text>
              <Button 
                disabled={currentSampleIndex <= 0}
                onClick={() => handleSampleChange('prev')}
              >
                上一个样本
              </Button>
              <Button 
                disabled={currentSampleIndex >= (allSamples.length || 1) - 1}
                onClick={() => handleSampleChange('next')}
              >
                下一个样本
              </Button>
            </Space>
          </div>
        </Card>
        
        {/* 右侧：OCR结果展示 */}
        <Card title="OCR识别结果" style={{ flex: 1, marginLeft: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                    <Button 
                        type="primary" 
                        onClick={handleOCRCurrentPage}
                        loading={ocrLoading}
                        icon={<ScanOutlined />}
                    >
                        OCR当前页
                    </Button>
                    <Button 
                        onClick={handleDownloadCurrentPage}
                        icon={<DownloadOutlined />}
                    >
                        下载当前页图片
                    </Button>
                    <Switch
                        checked={useHighQualityMode}
                        onChange={setUseHighQualityMode}
                        checkedChildren="平衡性能"
                        unCheckedChildren="速度最快"
                    />
                </Space>
                
                {/* 图片模式说明 */}
                <Alert
                    message={`图片模式: ${useHighQualityMode ? '平衡性能' : '速度最快'}`}
                    description={
                        useHighQualityMode 
                            ? "将发送1300像素最长边的图片，提供更好的OCR质量"
                            : "使用当前显示的图片，处理速度最快"
                    }
                    type="info"
                    showIcon
                />
                
                {/* Debug信息 */}
                <Card size="small" title="Debug信息" style={{ backgroundColor: '#f5f5f5' }}>
                    <Space direction="vertical" size="small">
                        <Text type="secondary">当前页: {currentPage}</Text>
                        <Text type="secondary">Canvas尺寸: {canvasDimensions}</Text>
                        <Text type="secondary">总像素数: {totalPixels.toLocaleString()}</Text>
                        <Text type="secondary">预估内存: {estimatedMemory}</Text>
                        <Text type="secondary">服务端要求: min_pixels &gt;= 3136</Text>
                    </Space>
                </Card>
                
                {/* OCR结果展示 */}
                {ocrError && (
                    <Alert
                        message="OCR识别失败"
                        description={ocrError}
                        type="error"
                        showIcon
                    />
                )}
                
                {ocrResult && (
                    <Tabs defaultActiveKey="markdown" style={{ width: '100%' }}>
                        <Tabs.TabPane tab="Markdown预览" key="markdown">
                            <div 
                                style={{ 
                                    padding: '16px', 
                                    border: '1px solid #d9d9d9', 
                                    borderRadius: '6px',
                                    backgroundColor: '#fff',
                                    minHeight: '400px',
                                    overflow: 'auto'
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdown(ocrResult.md_content || '')
                                }}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="结构化数据" key="json">
                            <pre style={{ 
                                padding: '16px', 
                                backgroundColor: '#f6f8fa', 
                                border: '1px solid #e1e4e8',
                                borderRadius: '6px',
                                overflow: 'auto',
                                fontSize: '12px'
                            }}>
                                {JSON.stringify(ocrResult.cells_data || {}, null, 2)}
                            </pre>
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="文件信息" key="info">
                            <div style={{ padding: '16px' }}>
                                <p><strong>文件类型:</strong> {ocrResult.file_type}</p>
                                {ocrResult.file_type === 'pdf' && (
                                    <p><strong>总页数:</strong> {ocrResult.total_pages}</p>
                                )}
                                {ocrResult.pixel_info && (
                                    <div>
                                        <p><strong>像素信息:</strong></p>
                                        <ul>
                                            {ocrResult.pixel_info.width && (
                                                <li>宽度: {ocrResult.pixel_info.width}</li>
                                            )}
                                            {ocrResult.pixel_info.height && (
                                                <li>高度: {ocrResult.pixel_info.height}</li>
                                            )}
                                            <li>总像素数: {ocrResult.pixel_info.total_pixels?.toLocaleString()}</li>
                                            <li>预估内存: {ocrResult.pixel_info.estimated_memory_mb?.toFixed(2)} MB</li>
                                        </ul>
                                    </div>
                                )}
                                <p><strong>会话ID:</strong> {ocrResult.session_id}</p>
                            </div>
                        </Tabs.TabPane>
                    </Tabs>
                )}
                
                {!ocrResult && !ocrError && (
                    <Empty 
                        description="点击'OCR当前页'开始识别"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
            </Space>
        </Card>
      </div>
      
      {/* QA面板 - 已注释 */}
      {/* <Card title="问答对管理">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Text type="secondary">问答对管理功能</Text>
          <br />
          <Text type="secondary">
            支持添加、编辑、删除问答对，设置问题类型和难度等级
          </Text>
        </div>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" block>
            添加问答对
          </Button>
          
          <Card size="small" title="示例问答对 #1">
            <div style={{ marginBottom: '1rem' }}>
              <Text strong>问题：</Text>
              <div style={{ 
                marginTop: '0.5rem', 
                padding: '0.5rem', 
                background: '#f5f5f5', 
                borderRadius: '4px' 
              }}>
                这是一个示例问题？
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <Text strong>答案：</Text>
              <div style={{ 
                marginTop: '0.5rem', 
                padding: '0.5rem', 
                background: '#f5f5f5', 
                borderRadius: '4px',
                minHeight: '60px'
              }}>
                这是一个示例答案。
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', fontSize: '12px' }}>
              <Text type="secondary">类型: 一般问题</Text>
              <Text type="secondary">难度: 中等</Text>
              <Text type="secondary">页码: {currentPage}</Text>
            </div>
          </Card>
        </Space>
      </Card> */}
      
      {/* 调试信息 - 已注释 */}
      {/* <Card title="调试信息" style={{ marginTop: '1rem' }}>
        <Paragraph>
          <Text strong>任务信息:</Text>
          <pre style={{ background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
            {JSON.stringify({
              taskId: task.id,
              mediaType: task.media_type,
              hasQAGenerationTool: true,
              sampleId: sample?.id,
              preAnnotationId: preAnnotation?.id,
              pdfUrl: pdfUrl,
              currentPage: currentPage,
              totalPages: totalPages,
              pdfDocumentLoaded: !!pdfDocument,
              sampleNavigation: {
                currentSampleIndex: currentSampleIndex,
                totalSamples: allSamples.length,
                currentSample: allSamples[currentSampleIndex],
                allSamples: allSamples.map((s: any) => ({ 
                  id: s.id, 
                  filename: s.data?.file?.filename, 
                  url: s.data?.file?.url
                }))
              }
            }, null, 2)}
          </pre>
        </Paragraph>
      </Card> */}
      
      {/* 问答对生成组件 */}
      <Card title="问答对生成" style={{ marginBottom: '1rem' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 配置区域 */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>API配置</Text>
                
                {/* API状态指示器 */}
                <Alert
                  message={`DeepSeek API 状态: ${qaConfig.apiKey.trim() ? '已配置' : '未配置'}`}
                  description={
                    qaConfig.apiKey.trim() 
                      ? `模型: ${qaConfig.model} | 基础URL: ${qaConfig.baseUrl}`
                      : '请配置API Key以启用问答对生成功能'
                  }
                  type={qaConfig.apiKey.trim() ? 'success' : 'warning'}
                  showIcon
                />
                
                <Input 
                  placeholder="DeepSeek API Key" 
                  type="password"
                  value={qaConfig.apiKey}
                  onChange={(e) => setQaConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  style={{ width: '100%' }}
                  status={qaConfig.apiKey.trim() ? '' : 'warning'}
                />
                <Input 
                  placeholder="Model (默认: deepseek-chat)" 
                  value={qaConfig.model}
                  onChange={(e) => setQaConfig(prev => ({ ...prev, model: e.target.value }))}
                  style={{ width: '100%' }}
                />
                <Input 
                  placeholder="Base URL (默认: https://api.deepseek.com)" 
                  value={qaConfig.baseUrl}
                  onChange={(e) => setQaConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  style={{ width: '100%' }}
                />
                <InputNumber 
                  placeholder="问答对数量" 
                  value={qaConfig.numPairs}
                  onChange={(value) => setQaConfig(prev => ({ ...prev, numPairs: value || 5 }))}
                  min={1}
                  max={20}
                  style={{ width: '100%' }}
                />
              </Space>
            </div>
            
            <div style={{ flex: 2 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>提示词配置</Text>
                <Input.TextArea
                  placeholder="问答对生成提示词"
                  value={qaConfig.prompt}
                  onChange={(e) => setQaConfig(prev => ({ ...prev, prompt: e.target.value }))}
                  rows={8}
                  style={{ width: '100%' }}
                />
              </Space>
            </div>
          </div>
          
          {/* 知识文本输入区域 */}
          <div>
            <Text strong>知识文本输入</Text>
            <div style={{ marginTop: '0.5rem' }}>
              <Space>
                <Button 
                  size="small"
                  onClick={() => {
                    // 从OCR结果填充知识文本
                    if (ocrResult?.md_content) {
                      setQaConfig(prev => ({ ...prev, knowledgeText: ocrResult.md_content }));
                      message.success('已从OCR结果填充知识文本');
                    } else {
                      message.warning('请先进行OCR识别');
                    }
                  }}
                >
                  从OCR结果填充
                </Button>
                <Button 
                  size="small"
                  onClick={() => {
                    // 从结构化数据填充知识文本
                    if (ocrResult?.cells_data) {
                      const jsonText = JSON.stringify(ocrResult.cells_data, null, 2);
                      setQaConfig(prev => ({ ...prev, knowledgeText: jsonText }));
                      message.success('已从结构化数据填充知识文本');
                    } else {
                      message.warning('请先进行OCR识别');
                    }
                  }}
                >
                  从结构化数据填充
                </Button>
              </Space>
            </div>
            <Input.TextArea
              placeholder="请输入用于生成问答对的知识文本..."
              value={qaConfig.knowledgeText}
              onChange={(e) => setQaConfig(prev => ({ ...prev, knowledgeText: e.target.value }))}
              rows={10}
              style={{ marginTop: '0.5rem', width: '100%' }}
            />
          </div>
          
          {/* 生成按钮 */}
          <div style={{ textAlign: 'center' }}>
            <Button 
              type="primary" 
              size="large"
              icon={<RobotOutlined />}
              onClick={handleGenerateQA}
              loading={qaResult.loading}
              disabled={!qaConfig.knowledgeText.trim()}
            >
              ⚙️ 生成问答对
            </Button>
          </div>
          
          {/* 结果展示区域 */}
          <div>
            <Text strong>生成结果</Text>
            <Tabs defaultActiveKey="markdown" style={{ marginTop: '0.5rem' }}>
              <Tabs.TabPane tab="Markdown预览" key="markdown">
                <div style={{ 
                  padding: '16px', 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  minHeight: '200px',
                  overflow: 'auto'
                }}>
                  {qaResult.loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <Spin size="large" />
                      <div style={{ marginTop: '1rem' }}>正在生成问答对...</div>
                    </div>
                  ) : qaResult.error ? (
                    <Alert
                      message="生成失败"
                      description={qaResult.error}
                      type="error"
                      showIcon
                    />
                  ) : qaResult.markdown ? (
                    <div dangerouslySetInnerHTML={{
                      __html: renderMarkdown(qaResult.markdown)
                    }} />
                  ) : (
                    <Empty 
                      description="生成的问答对将在这里显示"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </div>
              </Tabs.TabPane>
              <Tabs.TabPane tab="JSON预览" key="json">
                <div style={{ 
                  padding: '16px', 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  backgroundColor: '#f6f8fa',
                  minHeight: '200px',
                  overflow: 'auto'
                }}>
                  {qaResult.loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <Spin size="large" />
                      <div style={{ marginTop: '1rem' }}>正在生成问答对...</div>
                    </div>
                  ) : qaResult.error ? (
                    <Alert
                      message="生成失败"
                      description={qaResult.error}
                      type="error"
                      showIcon
                    />
                  ) : qaResult.json ? (
                    <pre style={{ 
                      margin: 0, 
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {qaResult.json}
                    </pre>
                  ) : (
                    <Empty 
                      description="JSON格式的问答对将在这里显示"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </div>
              </Tabs.TabPane>
            </Tabs>
          </div>
          
          {/* 操作按钮区域 */}
          <div style={{ textAlign: 'center' }}>
            <Space size="middle">
              {/* 保存到任务按钮 */}
              <Button 
                type="primary"
                disabled={!qaResult.json}
                icon={<RobotOutlined />}
                onClick={handleSaveQAToTask}
                loading={qaResult.saving}
              >
                💾 保存到任务
              </Button>
              
              {/* 查看已保存数据按钮 */}
              <Button 
                icon={<RobotOutlined />}
                onClick={handleViewSavedQA}
              >
                📋 查看已保存
              </Button>
              
              {/* 下载JSON按钮 */}
              <Button 
                disabled={!qaResult.json}
                icon={<DownloadOutlined />}
                onClick={() => {
                  if (qaResult.json) {
                    // 创建并下载JSON文件
                    const blob = new Blob([qaResult.json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `qa_pairs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    message.success('问答对JSON文件已下载');
                  }
                }}
              >
                ⬇️ 下载JSON
              </Button>
            </Space>
          </div>
        </Space>
      </Card>
      
      {/* 已保存问答对数据展示组件 */}
      <Card title="已保存的问答对数据" style={{ marginTop: '1rem' }}>
        <SavedQADataDisplay taskId={task.id} />
      </Card>
    </div>
  );
};

// PDF页面渲染组件
const PDFPageRenderer = ({ 
  pdfDocument, 
  pageNumber, 
  onPageLoad 
}: { 
  pdfDocument: any; 
  pageNumber: number; 
  onPageLoad: () => void; 
}) => {
  const { Text } = Typography;
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!pdfDocument) return;
    
    const renderPage = async () => {
      try {
        setPageLoading(true);
        console.log(`开始渲染PDF第${pageNumber}页`);
        
        // 获取页面
        const page = await pdfDocument.getPage(pageNumber);
        console.log(`获取到PDF第${pageNumber}页:`, page);
        
        // 创建canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          throw new Error('无法创建canvas上下文');
        }
        
        // 设置canvas尺寸 - 使用1.0比例，稍后我们会缩放
        const viewport = page.getViewport({ scale: 1.0 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // 渲染页面到canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        console.log(`PDF第${pageNumber}页渲染完成`);
        
        setPageCanvas(canvas);
        setPageLoading(false);
        onPageLoad();
        
      } catch (error: any) {
        console.error(`渲染PDF第${pageNumber}页失败:`, error);
        setPageLoading(false);
      }
    };
    
    renderPage();
  }, [pdfDocument, pageNumber, onPageLoad]);
  
  if (pageLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        flexDirection: 'column'
      }}>
        <Spin size="large" />
        <div style={{ marginTop: '1rem' }}>
          <Text>正在渲染第 {pageNumber} 页...</Text>
        </div>
      </div>
    );
  }
  
  if (!pageCanvas) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%' 
      }}>
        <Text type="secondary">页面渲染失败</Text>
      </div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '1rem'
    }}>
      <div style={{ 
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <div ref={(el) => {
          if (el && pageCanvas) {
            el.innerHTML = '';
            
            // 为canvas添加class，以便OCR函数能够找到它
            pageCanvas.className = 'pdf-page-canvas';
            el.appendChild(pageCanvas);
          }
        }} />
      </div>
    </div>
  );
};

export const imageAnnotationRef = createRef<ImageAnnotatorRef>();
export const videoAnnotationRef = createRef<AudioAndVideoAnnotatorRef>();
export const audioAnnotationRef = createRef<AudioAndVideoAnnotatorRef>();

const PREVIEW_OFFSET_TOP = 102;
const OFFSET_TOP = 158;

const AnnotationPage = () => {
  const routeParams = useParams();
  const { task } = useRouteLoaderData('task') as TaskLoaderResult;
  const sample = (useRouteLoaderData('annotation') as any).sample as Awaited<ReturnType<typeof getSample>>;
  const preAnnotation = (useRouteLoaderData('annotation') as any).preAnnotation;
  const { t } = useTranslation();

  // 检查是否为问答对生成任务
  const isQAGenerationTask = useMemo(() => {
    return task?.config?.tools?.some((tool: any) => tool.tool === 'qaGenerationTool');
  }, [task?.config?.tools]);

  // 如果是问答对生成任务，显示问答对生成页面
  if (isQAGenerationTask && task?.media_type === MediaType.TEXT) {
    return <QAGenerationAnnotation task={task} sample={sample} preAnnotation={preAnnotation} />;
  }

  const preAnnotationConfig = useMemo(() => {
    const result: Partial<Record<AllToolName, any>> = {};

    if (preAnnotation) {
      const preAnnotationResult = JSON.parse(_.get(preAnnotation, 'data[0].data', 'null'));

      if (!preAnnotationResult) {
        return {};
      }

      const config = preAnnotationResult.config;

      if (!config) {
        return {};
      }

      Object.keys(preAnnotationResult.config).forEach((key) => {
        let toolName = key.replace(/Tool$/, '') as AllToolName;

        if (key.includes('audio') || key.includes('video')) {
          // audioSegmentTool => segment
          toolName = toolName.replace(/audio|video/, '').toLowerCase() as AllToolName;
        }

        result[toolName] = preAnnotationResult.config[key as keyof typeof config];
      });
    }

    return result;
  }, [preAnnotation]);
  const preAnnotations = useMemo(() => {
    if (!preAnnotation) {
      return {};
    }

    const preAnnotationResult = JSON.parse(_.get(preAnnotation, 'data[0].data', 'null'));
    let _annotations = _.get(preAnnotationResult, 'annotations', {});
    const preAnnotationFile = _.get(preAnnotation, 'data[0].file', {});
    // 兼容json预标注
    if (preAnnotationFile.filename?.endsWith('.json')) {
      _annotations = _.chain(preAnnotationResult)
        .get('result.annotations')
        .map((item) => {
          return [
            item.toolName,
            {
              toolName: item.toolName,
              result: item.result,
            },
          ];
        })
        .fromPairs()
        .value();
    }

    if (task?.media_type === MediaType.IMAGE) {
      return convertImageAnnotations(_annotations);
    } else if (task?.media_type === MediaType.VIDEO || task?.media_type === MediaType.AUDIO) {
      return convertMediaAnnotations(task.media_type, _annotations);
    }

    return {};
  }, [preAnnotation, task?.media_type]);

  const [searchParams] = useSearchParams();
  const taskConfig = _.get(task, 'config');
  console.log('标注页面 - taskConfig:', taskConfig);
  console.log('标注页面 - task:', task);
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const me = useMe();
  const [currentSampleConns, taskConns] = useSampleWs();
  const isMeTheCurrentEditingUser = currentSampleConns?.[0]?.user_id === me.data?.id;

  // TODO： labelu/image中的错误定义
  const onError = useCallback(
    (err: any) => {
      const value = err.value;

      if (err.type === 'rotate') {
        message.error(t('cannotRotateWhenAnnotationExist'));
      }

      if (err.type === 'minPointAmount') {
        message.error(`${t('minPointAmountCannotSmallThan')} ${value}`);
      }

      if (err.type === 'maxPointAmount') {
        message.error(`${t('maxPointAmountCannotExceed')} ${value}`);
      }

      if (err.type === 'minWidth') {
        message.error(`${t('minWidthCannotSmallThan')}${value}`);
      }

      if (err.type === 'minHeight') {
        message.error(`${t('minHeightCannotSmallThan')} ${value}`);
      }
    },
    [t],
  );

  // 默认加载数量常量
  const PAGE_SIZE = 40;
  // 滚动加载
  const [totalCount, setTotalCount] = useState<number>(0);
  const currentPage = useRef<number>(1);
  if (currentPage.current === 1) {
    currentPage.current = sample?.data.inner_id ? Math.floor(sample.data.inner_id / PAGE_SIZE) + 1 : 1;
  }

  const fetchSamples = useCallback(async () => {
    if (!routeParams.taskId) {
      return Promise.resolve([]);
    }

    const { data, meta_data } = await getSamples({
      task_id: +routeParams.taskId!,
      page: currentPage.current,
      size: PAGE_SIZE,
    });

    currentPage.current += 1;
    setTotalCount(meta_data?.total ?? 0);

    return data;
  }, [routeParams.taskId]);
  const [samples = [] as SampleResponse[], loading, setSamples, svc] = useScrollFetch(
    fetchSamples,
    () =>
      document.querySelector('.labelu-image__sidebar div') ||
      document.querySelector('.labelu-audio__sidebar div') ||
      document.querySelector('.labelu-video__sidebar div'),
    {
      isEnd: () => totalCount === samples.length,
    },
  );

  const leftSiderContent = useMemo(() => <SlideLoader />, []);



  const annotationContextValue = useMemo(() => {
    return {
      samples,
      setSamples,
      taskConnections: taskConns,
      task,
      currentEditingUser: currentSampleConns[0],
      isEnd: totalCount === samples.length,
    };
  }, [currentSampleConns, taskConns, samples, setSamples, task, totalCount]);

  let content = null;

  const editorConfig = useMemo(() => {
    console.log('计算 editorConfig - task?.media_type:', task?.media_type);
    console.log('计算 editorConfig - taskConfig:', taskConfig);
    
    if (task?.media_type === MediaType.VIDEO || task?.media_type === MediaType.AUDIO) {
      return convertAudioAndVideoConfig(taskConfig);
    }

    const result = convertImageConfig(taskConfig);
    console.log('计算 editorConfig - 结果:', result);
    return result;
  }, [task?.media_type, taskConfig]);

  const editingSample = useMemo(() => {
    if (task?.media_type === MediaType.IMAGE) {
      return convertImageSample(sample?.data);
    } else if (task?.media_type === MediaType.VIDEO || task?.media_type === MediaType.AUDIO) {
      return convertAudioAndVideoSample(sample?.data, task.media_type);
    }
  }, [sample?.data, task?.media_type]);

  const renderSidebar = useMemo(() => {
    return () => leftSiderContent;
  }, [leftSiderContent]);

  // =================== preview config ===================
  const [configFromParent, setConfigFromParent] = useState<any>();
  useLayoutEffect(() => {
    const bridge = new Bridge(window.parent);

    bridge.on('preview', (data) => {
      setConfigFromParent(data);
    });

    bridge.post('ready').catch(() => {});

    return () => bridge.destroy();
  }, []);



  const isLoading = useMemo(() => loading || isFetching > 0 || isMutating > 0, [loading, isFetching, isMutating]);

  const config = useMemo(() => {
    const result = configFromParent || editorConfig;
    console.log('最终 config:', result);
    
    // 如果配置中没有智能标注工具，自动添加
    if (result && !result.smartAnnotation && (result.rect || result.polygon)) {
      console.log('自动添加智能标注工具到配置');
      (result as any).smartAnnotation = {
        enabled: true,
        boxThreshold: 0.35,
        textThreshold: 0.25,
        syncRectLabels: true,
        labels: result.rect?.labels || result.polygon?.labels || []
      };
      console.log('智能标注配置已添加:', (result as any).smartAnnotation);
    }
    
    return result;
  }, [configFromParent, editorConfig]);

  // 确保智能标注工具在配置中
  useEffect(() => {
    if (config && !config.smartAnnotation && (config.rect || config.polygon)) {
      console.log('useEffect: 自动添加智能标注工具到配置');
      (config as any).smartAnnotation = {
        enabled: true,
        boxThreshold: 0.35,
        textThreshold: 0.25,
        syncRectLabels: true,
        labels: config.rect?.labels || config.polygon?.labels || []
      };
      console.log('智能标注配置已添加:', (config as any).smartAnnotation);
    }
  }, [config]);

  // 将任务配置保存到window对象中，方便调试
  useEffect(() => {
    if (task?.config) {
      (window as any).__TASK_CONFIG__ = task.config;
      console.log('任务配置已保存到 window.__TASK_CONFIG__');
    }
  }, [task?.config]);

  useEffect(() => {
    if (me.data && currentSampleConns?.[0] && !isMeTheCurrentEditingUser) {
      message.destroy();
      message.error(t('currentSampleIsAnnotating'));
    }
  }, [currentSampleConns, isMeTheCurrentEditingUser, me.data, t]);

  const requestEdit = useCallback<NonNullable<ImageAnnotatorProps['requestEdit']>>(
    (editType, { toolName, label }) => {
      if (!toolName) {
        return false;
      }

      const toolConfig = config[toolName];
      const toolNameKey =
        (toolName.includes('frame') || toolName.includes('segment')
          ? task!.media_type?.toLowerCase() + _.upperFirst(toolName)
          : toolName) + 'Tool';

      if (editType === 'create' && !toolConfig?.labels?.find((item: ILabel) => item.value === label)) {
        message.destroy();
        message.error(`${t('currentTool')}【${TOOL_NAME[toolNameKey]}】${t('doesntInclude')}【${label}】`);

        return false;
      }

      if (editType === 'update' && !config[toolName]) {
        message.destroy();
        message.error(`${t('currentConfigDoesntInclude')}【${TOOL_NAME[toolNameKey]}】`);
        return false;
      }

      return true;
    },
    [config, task, t],
  );

  const [currentTool, setCurrentTool] = useState<any>();
  const [labelMapping, setLabelMapping] = useState<Record<any, string>>();
  const [smartAnnotationActive, setSmartAnnotationActive] = useState(false);
  // 点击标注相关状态
  const [clickAnnotationActive, setClickAnnotationActive] = useState(false);
  const [clickAnnotationSession, setClickAnnotationSession] = useState<ClickAnnotationSession | null>(null);
  const [clickAnnotationSessionActive, setClickAnnotationSessionActive] = useState(false);
  const [clickAnnotationLoading, setClickAnnotationLoading] = useState(false);
  const [clickAnnotationPoints, setClickAnnotationPoints] = useState<Array<{id: number; x: number; y: number; type: 'positive' | 'negative'}>>([]);
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
  
  // 新增：当前对象的点击点状态
  const [currentObjectPoints, setCurrentObjectPoints] = useState<Array<{id: number; x: number; y: number; type: 'positive' | 'negative'}>>([]);
  const [currentObjectId, setCurrentObjectId] = useState<number>(1);
  const [clickPointIdCounter, setClickPointIdCounter] = useState<number>(1); // 添加点击点ID计数器

  // 获取当前选中的标签
  const getCurrentLabel = useCallback(() => {
    // 优先使用当前工具的标签
    if (currentTool && labelMapping && labelMapping[currentTool]) {
      return labelMapping[currentTool];
    }
    
    // 如果没有当前工具的标签，使用rect工具的默认标签
    if (labelMapping && labelMapping['rect']) {
      return labelMapping['rect'];
    }
    
    // 如果都没有，使用配置中的第一个标签
    if (config?.rect?.labels && config.rect.labels.length > 0) {
      return config.rect.labels[0].value;
    }
    
    // 最后的默认值
    return 'click_annotation';
  }, [currentTool, labelMapping, config]);

  // 处理标注数据变更
  const handleAnnotationChange = useCallback((annotation: any) => {
    console.log('标注数据变更:', annotation);
    
    // 确保标注数据能够被正确获取
    if (imageAnnotationRef.current?.getEngine()) {
      const engine = imageAnnotationRef.current.getEngine();
      const currentData = engine.getDataByTool();
      console.log('当前引擎数据:', currentData);
      
      // 检查rect数据是否包含我们的标注
      if (currentData?.rect) {
        console.log('当前rect标注数据:', currentData.rect);
        const hasClickAnnotation = currentData.rect.some((rect: any) => 
          rect.id?.startsWith('click_annotation_')
        );
        console.log('是否包含点击标注:', hasClickAnnotation);
        
        // 手动更新annotationsWithGlobal，确保标签列表能够显示
        // 这里我们需要将rect数据转换为AnnotationWithTool格式
        const rectAnnotations = currentData.rect.map((rect: any) => ({
          ...rect,
          tool: 'rect' as const,
          type: 'rect' as const
        }));
        
        console.log('转换后的rect标注数据:', rectAnnotations);
        
        // 这里可以添加手动更新annotationsWithGlobal的逻辑
        // 但是由于我们没有直接访问updateAnnotationsWithGlobal的权限
        // 我们需要通过其他方式来触发更新
      }
    }
    
    // 这里可以添加额外的处理逻辑，比如保存到后端等
  }, []);

  const handleLabelChange = useCallback((toolName: any, label: ILabel) => {
    if (!label) {
      return;
    }

    console.log('标签变更:', toolName, label.value);

    // 缓存当前标签
    setLabelMapping((prev) => {
      return {
        ...prev,
        [toolName]: label.value,
      };
    });
  }, []);

  const handleToolChange = useCallback((toolName: any) => {
    console.log('工具切换:', toolName);
    setCurrentTool(toolName);
    
    // 保存到window对象中，方便调试
    (window as any).__CURRENT_TOOL__ = toolName;
    (window as any).__AVAILABLE_TOOLS__ = Object.keys(config || {}).filter(key => key !== 'showOrder' && key !== 'text' && key !== 'tag');
    (window as any).__SMART_ANNOTATION_CONFIG__ = config?.smartAnnotation;
  }, [config]);

  const handleSmartAnnotationClick = useCallback(() => {
    console.log('智能标注按钮被点击');
    setSmartAnnotationActive(!smartAnnotationActive);
    setClickAnnotationActive(false); // 关闭点击标注
    setCurrentTool(smartAnnotationActive ? undefined : 'smartAnnotation');
  }, [smartAnnotationActive]);

  const handleClickAnnotationClick = useCallback(() => {
    console.log('点击标注按钮被点击');
    setClickAnnotationActive(prev => {
      const newState = !prev;
      if (newState) {
        message.info('点击标注已激活，图片将被恢复到适应容器的大小和位置');
      } else {
        message.info('点击标注已关闭');
      }
      return newState;
    });
    // 确保智能标注关闭
    setSmartAnnotationActive(false);
  }, []);

  const handleAddClickAnnotationPoint = useCallback((point: {id: number; x: number; y: number; type: 'positive' | 'negative'}) => {
    console.log('添加点击标注点:', point);
    setClickAnnotationPoints(prev => [...prev, point]);
  }, []);

  const handleRemoveClickAnnotationPoint = useCallback((pointId: number) => {
    console.log('删除点击标注点:', pointId);
    setClickAnnotationPoints(prev => prev.filter(p => p.id !== pointId));
  }, []);

  const handleClearClickAnnotationPoints = useCallback(() => {
    console.log('清除所有点击标注点');
    setClickAnnotationPoints([]);
  }, []);

  // 启动点击标注会话
  const handleStartClickAnnotation = useCallback(async () => {
    console.log('检查sample数据结构:', sample);
    console.log('检查sample.data:', sample?.data);
    console.log('检查sample.data.file:', sample?.data?.file);
    
    if (!sample?.data?.file?.url) {
      message.error('没有可用的图片');
      console.error('sample.data.file.url不存在:', sample?.data?.file);
      return;
    }

    try {
      setClickAnnotationLoading(true);
      message.loading('正在启动点击标注会话...', 0);

      // 获取图片文件
      const response = await fetch(sample.data.file.url);
      const blob = await response.blob();
      const imageFile = new File([blob], 'current_image.jpg', { type: 'image/jpeg' });
      setCurrentImageFile(imageFile);

      // 启动会话
      const session = await startClickAnnotationSession(imageFile);
      setClickAnnotationSession(session);
      setClickAnnotationSessionActive(true);
      setClickAnnotationPoints([]);

      message.destroy();
      message.success('点击标注会话启动成功！');
      console.log('点击标注会话启动成功:', session);

    } catch (error) {
      message.destroy();
      message.error(`启动点击标注会话失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('启动点击标注会话失败:', error);
    } finally {
      setClickAnnotationLoading(false);
    }
  }, [sample?.data?.file?.url]);

  // 添加点击点并获取分割结果
  const handleAddClickPoint = useCallback(async (x: number, y: number, type: 'positive' | 'negative') => {
    if (!clickAnnotationSession || !clickAnnotationSessionActive) {
      message.error('请先启动点击标注会话');
      return;
    }

    // 解析图片尺寸信息
    let imageWidth: number, imageHeight: number;
    try {
      if (!sample?.data?.data?.result) {
        message.error('无法获取图片尺寸信息');
        console.error('sample.data.data.result不存在:', sample?.data?.data);
        return;
      }

      const resultData = JSON.parse(sample.data.data.result);
      imageWidth = resultData.width;
      imageHeight = resultData.height;

      if (!imageWidth || !imageHeight) {
        message.error('图片尺寸信息不完整');
        console.error('图片尺寸信息不完整:', resultData);
        return;
      }

      console.log('解析的图片尺寸:', { width: imageWidth, height: imageHeight });
    } catch (error) {
      message.error('解析图片尺寸信息失败');
      console.error('解析图片尺寸信息失败:', error);
      return;
    }

    try {
      setClickAnnotationLoading(true);
      message.loading('正在处理点击点...', 0);

      // 先清除后端的所有点击点
      console.log('清除后端所有点击点');
      await clearClickPoints(clickAnnotationSession.sessionId);

      // 将当前对象的所有点击点（包括新点击的点）发送到后端
      const allCurrentPoints = [...currentObjectPoints, { id: clickPointIdCounter, x, y, type }];
      setClickPointIdCounter(prev => prev + 1); // 增加计数器
      console.log('当前对象的所有点击点:', allCurrentPoints);

      // 逐个发送当前对象的所有点击点
      for (const point of allCurrentPoints) {
        const pixelCoords = convertPercentageToPixel(point.x, point.y, imageWidth, imageHeight);
        const label = point.type === 'positive' ? 1 : 0;
        
        console.log(`发送点击点: (${pixelCoords.x}, ${pixelCoords.y}), label: ${label}`);
        
        // 发送点击点（不清除之前的点，因为我们已经清除了）
        const result = await addClickPoint(
          clickAnnotationSession.sessionId,
          pixelCoords.x,
          pixelCoords.y,
          label,
          false // 不清除之前的点
        );

        console.log('=== API返回的原始数据 ===');
        console.log('完整返回结果:', result);
        console.log('掩码数据:', result.mask);
        console.log('边界框数据:', result.bbox);
        console.log('总点数:', result.totalPoints);

        console.log('=== 转换前的数据 ===');
        console.log('图片尺寸:', { width: imageWidth, height: imageHeight });
        console.log('边界框:', result.bbox);
        console.log('掩码:', result.mask);
        console.log('当前选中的标签:', getCurrentLabel());

        // 转换结果为拉框数据
        const rectData = convertMaskToRectData(
          result.mask,
          result.bbox,
          imageWidth,
          imageHeight,
          getCurrentLabel() // 使用当前选中的标签
        );

        console.log('=== 转换后的拉框数据 ===');
        console.log('转换后的rectData:', rectData);
        console.log('rectData类型:', typeof rectData);
        console.log('rectData属性:', Object.keys(rectData));
        console.log('rectData的标签:', rectData.label);
        console.log('x, y, width, height:', {
          x: rectData.x,
          y: rectData.y,
          width: rectData.width,
          height: rectData.height
        });

        // 只在最后一个点击点时生成边界框
        if (point === allCurrentPoints[allCurrentPoints.length - 1]) {
          // 将拉框数据添加到标注引擎
          if (imageAnnotationRef.current?.getEngine()) {
            try {
              const engine = imageAnnotationRef.current.getEngine();
              if (!engine) {
                console.error('无法获取引擎实例');
                return;
              }

              // 获取当前已有的rect标注数据
              const currentData = engine.getDataByTool();
              console.log('当前引擎数据:', currentData);
              const currentRectData = currentData?.rect || [];
              console.log('当前rect数据:', currentRectData);

              // 检查rect工具是否已初始化，如果没有则初始化
              if (!currentData?.rect) {
                console.log('rect工具未初始化，尝试初始化...');
                // 尝试初始化rect工具
                try {
                  engine.loadData('rect', []);
                  console.log('rect工具初始化成功');
                } catch (initError) {
                  console.error('rect工具初始化失败:', initError);
                  message.error('rect工具初始化失败，请确保任务配置中包含拉框工具');
                  return;
                }
              }

              // Filter out previous click_annotation rects to only show the latest one for the current object
              const otherRects = currentRectData.filter((rect: any) =>
                !rect.id?.startsWith('click_annotation_')
              );

              // 添加新的标注数据 (only the latest one from the loop)
              const updatedRectData = [...otherRects, rectData];
              console.log('更新后的rect数据:', updatedRectData);

              // 通过引擎的loadData方法添加标注
              engine.loadData('rect', updatedRectData);

              // 验证数据是否成功添加
              const afterData = engine.getDataByTool();
              console.log('添加后的引擎数据:', afterData);
              console.log('添加后的rect数据:', afterData?.rect);

              console.log('成功添加拉框数据到引擎:', rectData);
              console.log('当前所有rect标注:', updatedRectData);

              // 触发标注数据更新，确保在标签列表中显示
              // 模拟一个标注完成事件，让系统知道有新的标注数据
              setTimeout(() => {
                try {
                  // 触发引擎的重新渲染
                  engine.render();
                  console.log('已触发引擎重新渲染');
                  
                  // 触发标注数据变更事件，确保标签列表更新
                  handleAnnotationChange(rectData);
                  console.log('已触发标注数据变更事件');
                  
                  // 直接触发引擎的add事件，确保数据能够正确持久化
                  // 这是关键：模拟Tool.onAdd事件，让系统知道有新的标注数据
                  engine.emit('add', [rectData]);
                  console.log('已触发引擎add事件');
                  
                } catch (renderError) {
                  console.error('重新渲染失败:', renderError);
                }
              }, 100);

              message.success(`点击点添加成功，生成了边界框: (${rectData.x}, ${rectData.y}, ${rectData.width}x${rectData.height})`);
            } catch (error) {
              console.error('添加标注到引擎失败:', error);
              message.error('添加标注到引擎失败');
            }
          } else {
            console.log('生成的拉框数据:', rectData);
            message.success(`点击点添加成功，生成了边界框: (${rectData.x}, ${rectData.y}, ${rectData.width}x${rectData.height})`);
          }
        }
      }

      message.destroy();

    } catch (error) {
      message.destroy();
      message.error(`添加点击点失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('添加点击点失败:', error);
    } finally {
      setClickAnnotationLoading(false);
    }
  }, [clickAnnotationSession, clickAnnotationSessionActive, sample?.data?.data?.result, imageAnnotationRef.current?.getEngine, currentObjectPoints, getCurrentLabel, handleAnnotationChange, clickPointIdCounter]);

  // 清除当前对象的点击点
  const handleClearCurrentClickPoints = useCallback(async () => {
    if (!clickAnnotationSession || !clickAnnotationSessionActive) {
      message.error('请先启动点击标注会话');
      return;
    }

    try {
      setClickAnnotationLoading(true);
      message.loading('正在清除当前对象点击点...', 0);

      // 清除后端会话中的点击点
      await clearClickPoints(clickAnnotationSession.sessionId);

      // 清除当前对象的点击点
      setCurrentObjectPoints([]);
      
      // 清除总点击点列表中的当前对象点
      setClickAnnotationPoints(prev => prev.filter(point => 
        !currentObjectPoints.some(currentPoint => currentPoint.id === point.id)
      ));

      message.destroy();
      message.success('当前对象点击点清除成功！');
      console.log('当前对象点击点清除成功');

    } catch (error) {
      message.destroy();
      message.error(`清除当前对象点击点失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('清除当前对象点击点失败:', error);
    } finally {
      setClickAnnotationLoading(false);
    }
  }, [clickAnnotationSession, clickAnnotationSessionActive, currentObjectPoints]);

  // 重置所有点击标注
  const handleResetClickAnnotation = useCallback(() => {
    setClickAnnotationPoints([]);
    setCurrentObjectPoints([]);
    setCurrentObjectId(1);
    setClickPointIdCounter(1); // 重置计数器
    setClickAnnotationSessionActive(false);
    setClickAnnotationSession(null);
    setCurrentImageFile(null);
    message.success('点击标注已重置');
  }, []);

  // 下一个对象
  const handleNextClickAnnotationObject = useCallback(() => {
    console.log('切换到下一个对象，当前对象ID:', currentObjectId);
    console.log('当前对象的点击点:', currentObjectPoints);
    
    // 保存当前对象的点击点（可选，用于历史记录）
    // 这里可以添加保存逻辑
    
    // 清除当前对象的点击点
    setCurrentObjectPoints([]);
    
    // 增加对象ID
    setCurrentObjectId(prev => prev + 1);
    
    message.success(`已切换到对象 ${currentObjectId + 1}，当前对象点击点已清除`);
    console.log('切换到对象:', currentObjectId + 1);
  }, [currentObjectId, currentObjectPoints]);

  // 处理图片点击事件
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!clickAnnotationActive || !clickAnnotationSessionActive) {
      return;
    }

    console.log('点击标注激活，处理图片点击事件');

    // 获取点击的容器元素
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    
    // 计算点击位置相对于容器的坐标
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    console.log('📍 点击坐标:', { x, y });
    
    // 判断是积极点还是消极点（Shift+左键为消极点）
    const type = e.shiftKey ? 'negative' : 'positive';
    console.log('🏷️ 点击类型:', type);
    
    // 添加点击点到当前对象
    const newPoint = {
      id: clickPointIdCounter, // 使用计数器生成ID
      x: x,
      y: y,
      type: type
    };
    setClickPointIdCounter(prev => prev + 1); // 增加计数器
    
    // 更新当前对象的点击点
    setCurrentObjectPoints(prev => [...prev, newPoint]);
    
    // 同时更新总点击点列表（用于显示）
    setClickAnnotationPoints(prev => [...prev, newPoint]);
    
    // 调用API处理当前对象的点击点
    handleAddClickPoint(x, y, type);
  }, [clickAnnotationActive, clickAnnotationSessionActive, handleAddClickPoint, clickPointIdCounter]);

  // 临时绘制点击点的函数
  const drawTemporaryClickPoints = useCallback(() => {
    // 查找标注容器
    const container = document.querySelector('.annotation-container') as HTMLElement;
    if (!container) return;

    // 创建或获取临时canvas
    let canvas = document.getElementById('temp-click-points') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'temp-click-points';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '1000';
      container.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas尺寸
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // 清除canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制当前对象的点击点
    currentObjectPoints.forEach((point) => {
      // 将百分比坐标转换为canvas坐标
      const x = (point.x / 100) * canvas.width;
      const y = (point.y / 100) * canvas.height;

      // 绘制点击点
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = point.type === 'positive' ? '#52c41a' : '#ff4d4f';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 绘制十字标记
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [currentObjectPoints]);

  // 清除临时点击点的函数
  const clearTemporaryClickPoints = useCallback(() => {
    const canvas = document.getElementById('temp-click-points') as HTMLCanvasElement;
    if (canvas) {
      canvas.remove();
    }
  }, []);

  // 当点击点变化时重新绘制
  useEffect(() => {
    if (clickAnnotationActive && clickAnnotationSessionActive) {
      drawTemporaryClickPoints();
    } else {
      clearTemporaryClickPoints();
    }
  }, [clickAnnotationPoints, clickAnnotationActive, clickAnnotationSessionActive, drawTemporaryClickPoints, clearTemporaryClickPoints]);

  const handleSmartAnnotationTrigger = useCallback(async (textPrompt: string, boxThreshold: number, textThreshold: number) => {
    console.log('触发智能标注:', { textPrompt, boxThreshold, textThreshold });
    
    // 这里应该调用实际的智能标注API
    // 目前只是模拟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    message.success('智能标注完成');
    return { success: true, message: '智能标注完成' };
  }, []);



  // 重新定义 topActionContent，不包含智能标注按钮
  const topActionContent = useMemo(() => {
    return (
      <AnnotationRightCorner totalSize={totalCount} fetchNext={svc} noSave={!!searchParams.get('noSave')} />
    );
  }, [totalCount, svc]);

  const currentLabel = useMemo(() => {
    return labelMapping?.[currentTool];
  }, [currentTool, labelMapping]);

  const disabled = useMemo(() => {
    return me.data && currentSampleConns[0] && !isMeTheCurrentEditingUser;
  }, [currentSampleConns, isMeTheCurrentEditingUser, me.data]);

  if (task?.media_type === MediaType.IMAGE) {
    content = (
      <>
        {/* 智能标注面板 */}
        {smartAnnotationActive && (
          <div style={{ 
            position: 'fixed', 
            top: '160px', 
            right: '20px', 
            zIndex: 1000,
            width: '300px',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}>
            <SmartAnnotationPanel
              onTriggerAnnotation={handleSmartAnnotationTrigger}
              disabled={false}
            />
          </div>
        )}

        {/* 点击标注面板 */}
        {clickAnnotationActive && (
          <div style={{ 
            position: 'fixed', 
            top: '160px', 
            right: '20px', 
            zIndex: 1000,
            width: '320px',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}>
            <ClickAnnotationPanel
              points={clickAnnotationPoints}
              currentObjectPoints={currentObjectPoints}
              currentObjectId={currentObjectId}
              sessionActive={clickAnnotationSessionActive}
              loading={clickAnnotationLoading}
              onAddPositivePoint={handleAddClickPoint}
              onAddNegativePoint={handleAddClickPoint}
              onClearPoints={handleClearCurrentClickPoints}
              onStartAnnotation={handleStartClickAnnotation}
              onClearCurrentObject={handleClearCurrentClickPoints}
              onResetAll={handleResetClickAnnotation}
              onNextObject={handleNextClickAnnotationObject}
              disabled={!clickAnnotationActive}
            />
          </div>
        )}
        <ImageAnnotator
          ref={imageAnnotationRef}
          renderSidebar={renderSidebar}
          toolbarRight={topActionContent}
          onError={onError}
          onLoad={(engine) => {
            console.log('标注引擎已加载:', engine);
            // 保存引擎到window对象中，方便调试
            (window as any).__ANNOTATION_ENGINE__ = engine;
          }}
          // windows platform pixel issue
          offsetTop={configFromParent ? PREVIEW_OFFSET_TOP : OFFSET_TOP}
          editingSample={editingSample}
          config={config}
          disabled={clickAnnotationActive || smartAnnotationActive}
          requestEdit={requestEdit}
          onLabelChange={handleLabelChange}
          onToolChange={handleToolChange}
          selectedTool={disabled ? undefined : currentTool}
          selectedLabel={disabled ? undefined : currentLabel}
          preAnnotationLabels={preAnnotationConfig}
          preAnnotations={sample.data.state === SampleState.NEW ? preAnnotations : undefined}
          smartAnnotationActive={smartAnnotationActive}
          onSmartAnnotationClick={handleSmartAnnotationClick}
          clickAnnotationActive={clickAnnotationActive}
          onClickAnnotationClick={handleClickAnnotationClick}
          onImageClick={handleImageClick}
          onAnnotationChange={handleAnnotationChange}
        />
      </>
    );
  } else if (task?.media_type === MediaType.VIDEO) {
    content = (
      <Annotator
        primaryColor="#0d53de"
        ref={videoAnnotationRef}
        offsetTop={configFromParent ? PREVIEW_OFFSET_TOP : OFFSET_TOP}
        editingSample={editingSample}
        config={config}
        toolbarRight={topActionContent}
        renderSidebar={renderSidebar}
        disabled={disabled}
        requestEdit={requestEdit}
        onLabelChange={handleLabelChange}
        onToolChange={handleToolChange}
        selectedTool={disabled ? undefined : currentTool}
        selectedLabel={disabled ? undefined : currentLabel}
        preAnnotationLabels={preAnnotationConfig}
        preAnnotations={sample.data.state === SampleState.NEW ? preAnnotations : undefined}
      />
    );
  } else if (task?.media_type === MediaType.AUDIO) {
    content = (
      <AudioAnnotator
        primaryColor="#0d53de"
        ref={audioAnnotationRef}
        offsetTop={configFromParent ? PREVIEW_OFFSET_TOP : OFFSET_TOP}
        editingSample={editingSample}
        config={config}
        disabled={disabled}
        toolbarRight={topActionContent}
        renderSidebar={renderSidebar}
        requestEdit={requestEdit}
        onLabelChange={handleLabelChange}
        onToolChange={handleToolChange}
        selectedTool={disabled ? undefined : currentTool}
        selectedLabel={disabled ? undefined : currentLabel}
        preAnnotationLabels={preAnnotationConfig}
        preAnnotations={sample.data.state === SampleState.NEW ? preAnnotations : undefined}
      />
    );
  }

  if (_.isEmpty(sample.data.file)) {
    return (
      <FlexLayout.Content items="center" justify="center" flex>
        <Empty description={t('noSample')} />
      </FlexLayout.Content>
    );
  }

  if (_.isEmpty(taskConfig?.tools) && _.isEmpty(configFromParent)) {
    return (
      <FlexLayout.Content items="center" justify="center" flex>
        <Empty description={t('noTool')} />
      </FlexLayout.Content>
    );
  }

  return (
    <AnnotationContext.Provider value={annotationContextValue}>
      {isLoading && (
        <LoadingWrapper items="center" justify="center" flex>
          <Spin spinning />
        </LoadingWrapper>
      )}
      <Wrapper flex="column" full loading={isLoading}>
        {content}
      </Wrapper>
    </AnnotationContext.Provider>
  );
};

// 已保存问答对数据展示组件
const SavedQADataDisplay = ({ taskId }: { taskId: number }) => {
  const { Text, Paragraph } = Typography;
  const [savedQAData, setSavedQAData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // 加载已保存的问答对数据
  const loadSavedQAData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 优先从后端API加载数据
      try {
        const response = await QAGenerationService.getByTaskId(taskId, 0, 1000);
        const apiData = response.items.map(qa => ({
          id: qa.id,
          question: qa.question,
          answer: qa.answer,
          prompt: qa.prompt,
          knowledgeText: qa.knowledge_text,
          currentPage: qa.current_page,
          totalPages: qa.total_pages,
          sampleIndex: qa.sample_index,
          filename: qa.filename,
          createdAt: qa.created_at,
          updatedAt: qa.updated_at
        }));
        
        console.log('从后端API加载的数据:', apiData);
        setSavedQAData(apiData);
        
        // 同步到localStorage作为缓存
        const storageKey = `qa_data_task_${taskId}`;
        localStorage.setItem(storageKey, JSON.stringify(apiData, null, 2));
        
        return;
      } catch (apiError) {
        console.warn('后端API加载失败，使用本地缓存:', apiError);
      }
      
      // 如果后端API失败，从localStorage加载缓存数据
      const storageKey = `qa_data_task_${taskId}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const qaData = JSON.parse(savedData);
        
        // 过滤掉无效的问答对数据
        const validQAData = qaData.filter((qa: any) => {
          return qa && 
                 qa.id && 
                 qa.question && 
                 qa.answer && 
                 qa.question.trim() !== '' && 
                 qa.answer.trim() !== '' &&
                 qa.createdAt;
        });
        
        console.log('从本地缓存加载的数据:', qaData);
        console.log('过滤后的有效数据:', validQAData);
        console.log('过滤掉的数据:', qaData.filter((qa: any) => !validQAData.includes(qa)));
        
        setSavedQAData(validQAData);
        
        // 如果发现无效数据，自动清理
        if (validQAData.length !== qaData.length) {
          console.log('发现无效数据，自动清理...');
          localStorage.setItem(storageKey, JSON.stringify(validQAData, null, 2));
        }
      } else {
        setSavedQAData([]);
      }
    } catch (error) {
      console.error('加载已保存数据失败:', error);
      setSavedQAData([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // 删除指定的问答对
  const handleDeleteQA = useCallback(async (qaId: string) => {
    try {
      // 优先调用后端API删除
      try {
        await QAGenerationService.delete(parseInt(qaId));
        message.success('问答对删除成功');
      } catch (apiError: any) {
        console.warn('后端API删除失败，使用本地删除:', apiError);
        message.warning('后端删除失败，已从本地缓存删除');
      }
      
      // 从本地状态中删除
      const updatedData = savedQAData.filter(qa => qa.id !== qaId);
      setSavedQAData(updatedData);
      
      // 更新localStorage缓存
      const storageKey = `qa_data_task_${taskId}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedData, null, 2));
      
    } catch (error) {
      console.error('删除问答对失败:', error);
      message.error('删除失败');
    }
  }, [taskId, savedQAData]);

  // 清空所有问答对数据
  const handleClearAllQA = useCallback(async () => {
    try {
      // 优先调用后端API清空
      try {
        await QAGenerationService.deleteByTaskId(taskId);
        message.success('所有问答对数据已从后端清空');
      } catch (apiError: any) {
        console.warn('后端API清空失败，使用本地清空:', apiError);
        message.warning('后端清空失败，已从本地缓存清空');
      }
      
      // 清空本地状态和缓存
      const storageKey = `qa_data_task_${taskId}`;
      localStorage.removeItem(storageKey);
      setSavedQAData([]);
      
    } catch (error) {
      console.error('清空数据失败:', error);
      message.error('清空失败');
    }
  }, [taskId]);

  // 导出所有问答对数据
  const handleExportAllQA = useCallback(async () => {
    try {
      if (savedQAData.length === 0) {
        message.warning('没有可导出的数据');
        return;
      }

      // 优先从后端获取最新数据
      let exportData;
      try {
        const response = await QAGenerationService.getByTaskId(taskId, 0, 10000);
        exportData = {
          taskId,
          exportTime: new Date().toISOString(),
          totalQAPairs: response.total,
          qaPairs: response.items.map(qa => ({
            id: qa.id,
            question: qa.question,
            answer: qa.answer,
            prompt: qa.prompt,
            knowledge_text: qa.knowledge_text,
            current_page: qa.current_page,
            total_pages: qa.total_pages,
            sample_index: qa.sample_index,
            filename: qa.filename,
            api_model: qa.api_model,
            api_base_url: qa.api_base_url,
            num_pairs: qa.num_pairs,
            created_at: qa.created_at,
            updated_at: qa.updated_at
          }))
        };
        message.success(`从后端获取最新数据，共 ${response.total} 个问答对`);
      } catch (apiError) {
        console.warn('后端API获取失败，使用本地缓存数据:', apiError);
        exportData = {
          taskId,
          exportTime: new Date().toISOString(),
          totalQAPairs: savedQAData.length,
          qaPairs: savedQAData,
          note: '使用本地缓存数据，可能不是最新'
        };
        message.warning('使用本地缓存数据导出');
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qa_pairs_task_${taskId}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success(`成功导出 ${exportData.totalQAPairs} 个问答对`);
    } catch (error) {
      console.error('导出数据失败:', error);
      message.error('导出失败');
    }
  }, [taskId, savedQAData]);

  // 切换展开/收起状态
  const toggleExpanded = useCallback((qaId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(qaId)) {
        newSet.delete(qaId);
      } else {
        newSet.add(qaId);
      }
      return newSet;
    });
  }, []);

  // 组件加载时自动加载数据
  useEffect(() => {
    // 延迟加载，确保组件完全挂载
    const timer = setTimeout(() => {
      loadSavedQAData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [loadSavedQAData]);

  // 如果没有数据，显示空状态
  if (savedQAData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Empty 
          description="还没有保存的问答对数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <div style={{ marginTop: '1rem' }}>
          <Text type="secondary">
            生成问答对后，点击"保存到任务"按钮即可在这里查看
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div>
              {/* 数据统计和操作按钮 */}
        <div style={{ marginBottom: '1rem' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Space size="middle" align="center">
                <Text strong>总计: {savedQAData.length} 个问答对</Text>
                <Button 
                  size="small" 
                  onClick={loadSavedQAData}
                  loading={loading}
                >
                  🔄 刷新
                </Button>
                <Button 
                  size="small" 
                  onClick={() => {
                    try {
                      const storageKey = `qa_data_task_${taskId}`;
                      const savedData = localStorage.getItem(storageKey);
                      
                      if (savedData) {
                        const qaData = JSON.parse(savedData);
                        const validQAData = qaData.filter((qa: any) => {
                          return qa && 
                                 qa.id && 
                                 qa.question && 
                                 qa.answer && 
                                 qa.question.trim() !== '' && 
                                 qa.answer.trim() !== '' &&
                                 qa.createdAt;
                        });
                        
                        if (validQAData.length !== qaData.length) {
                          localStorage.setItem(storageKey, JSON.stringify(validQAData, null, 2));
                          setSavedQAData(validQAData);
                          message.success(`数据清理完成，移除了 ${qaData.length - validQAData.length} 条无效数据`);
                        } else {
                          message.info('没有发现无效数据，无需清理');
                        }
                      }
                    } catch (error) {
                      console.error('数据清理失败:', error);
                      message.error('数据清理失败');
                    }
                  }}
                >
                  🧹 清理无效数据
                </Button>
                <Button 
                  size="small" 
                  type="primary"
                  onClick={handleExportAllQA}
                  disabled={savedQAData.length === 0}
                >
                  📤 导出全部
                </Button>
                <Button 
                  size="small" 
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: '确认清空',
                      content: `确定要清空所有 ${savedQAData.length} 个问答对数据吗？此操作不可恢复！`,
                      okText: '确认清空',
                      cancelText: '取消',
                      okType: 'danger',
                      onOk: handleClearAllQA
                    });
                  }}
                  disabled={savedQAData.length === 0}
                >
                  🗑️ 清空全部
                </Button>
              </Space>
            </div>
            
            {/* 调试信息 */}
            <div style={{ fontSize: '12px', color: '#666' }}>
              <Text type="secondary">
                存储键: qa_data_task_{taskId} | 
                最后更新: {new Date().toLocaleString()} | 
                数据状态: {savedQAData.length > 0 ? '正常' : '空'}
              </Text>
            </div>
          </Space>
        </div>

      {/* 问答对列表 */}
      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
        {savedQAData.map((qa, index) => (
          <Card 
            key={qa.id} 
            size="small" 
            style={{ marginBottom: '0.5rem' }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>问答对 #{index + 1}</span>
                <Space size="small">
                  <Button 
                    size="small" 
                    type="text"
                    onClick={() => toggleExpanded(qa.id)}
                  >
                    {expandedItems.has(qa.id) ? '收起' : '展开'}
                  </Button>
                  <Button 
                    size="small" 
                    danger
                    type="text"
                    onClick={() => {
                      Modal.confirm({
                        title: '确认删除',
                        content: '确定要删除这个问答对吗？',
                        okText: '确认删除',
                        cancelText: '取消',
                        okType: 'danger',
                        onOk: () => handleDeleteQA(qa.id)
                      });
                    }}
                  >
                    删除
                  </Button>
                </Space>
              </div>
            }
          >
            {/* 基本信息 */}
            <div style={{ marginBottom: '0.5rem' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text strong>问题：</Text>
                  <div style={{ 
                    marginTop: '0.25rem', 
                    padding: '0.5rem', 
                    background: '#f5f5f5', 
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    {qa.question}
                  </div>
                </div>
                
                <div>
                  <Text strong>答案：</Text>
                  <div style={{ 
                    marginTop: '0.25rem', 
                    padding: '0.5rem', 
                    background: '#f5f5f5', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '40px'
                  }}>
                    {qa.answer}
                  </div>
                </div>
              </Space>
            </div>

            {/* 展开后的详细信息 */}
            {expandedItems.has(qa.id) && (
              <div style={{ 
                marginTop: '1rem', 
                paddingTop: '1rem',
                borderTop: '1px solid #f0f0f0'
              }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text strong>提示词：</Text>
                    <div style={{ 
                      marginTop: '0.25rem', 
                      padding: '0.5rem', 
                      background: '#f6f8fa', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      maxHeight: '100px',
                      overflow: 'auto'
                    }}>
                      {qa.prompt}
                    </div>
                  </div>
                  
                  <div>
                    <Text strong>知识文本：</Text>
                    <div style={{ 
                      marginTop: '0.25rem', 
                      padding: '0.5rem', 
                      background: '#f6f8fa', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      maxHeight: '150px',
                      overflow: 'auto'
                    }}>
                      {qa.knowledgeText}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '12px' }}>
                    <Text type="secondary">页码: {qa.currentPage}/{qa.totalPages}</Text>
                    <Text type="secondary">样本: {qa.sampleIndex + 1}</Text>
                    <Text type="secondary">文件: {qa.filename}</Text>
                    <Text type="secondary">创建: {new Date(qa.createdAt).toLocaleString()}</Text>
                  </div>
                </Space>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AnnotationPage;
