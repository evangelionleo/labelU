import { useState, createRef, useMemo, useCallback, useRef, useLayoutEffect, useEffect } from 'react';
import * as _ from 'lodash-es';
import { Empty, Spin, message } from 'antd';
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

type AllToolName = ToolName | 'segment' | 'frame' | 'tag' | 'text';

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

export default AnnotationPage;
