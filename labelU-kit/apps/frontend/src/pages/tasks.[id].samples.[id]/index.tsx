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
import SmartAnnotationDebug from './components/SmartAnnotationDebug';
import SmartAnnotationPanel from './components/SmartAnnotationPanel';
import ClickAnnotationPanel from './components/ClickAnnotationPanel';

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
  const [clickAnnotationActive, setClickAnnotationActive] = useState(false);
  const [clickAnnotationPoints, setClickAnnotationPoints] = useState<Array<{id: number; x: number; y: number; type: 'positive' | 'negative'}>>([]);
  const [clickAnnotationSessionActive, setClickAnnotationSessionActive] = useState(false);

  const handleLabelChange = useCallback((toolName: any, label: ILabel) => {
    if (!label) {
      return;
    }

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

  const handleStartClickAnnotation = useCallback(() => {
    console.log('开始点击标注会话');
    setClickAnnotationSessionActive(true);
    message.success('点击标注会话已启动，点击图片进行标注');
  }, []);

  const handleClearCurrentClickAnnotationObject = useCallback(() => {
    console.log('清除当前对象点');
    setClickAnnotationPoints([]);
    message.success('当前对象点已清除');
  }, []);

  const handleResetAllClickAnnotation = useCallback(() => {
    console.log('重置所有点击标注');
    setClickAnnotationPoints([]);
    setClickAnnotationSessionActive(false);
    message.success('所有点击标注已重置');
  }, []);

  const handleNextClickAnnotationObject = useCallback(() => {
    console.log('创建下一个对象');
    // 这里可以保存当前对象的数据
    if (clickAnnotationPoints.length > 0) {
      console.log('保存当前对象数据:', clickAnnotationPoints);
      // TODO: 保存当前对象数据到后端或本地存储
    }
    // 清空当前对象的点，准备创建新对象
    setClickAnnotationPoints([]);
    message.success('已创建下一个对象，可以开始新的标注');
  }, [clickAnnotationPoints]);

  // 处理图片点击事件
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    console.log('图片点击事件触发:', { clickAnnotationActive, clickAnnotationSessionActive });
    
    if (!clickAnnotationActive || !clickAnnotationSessionActive) {
      console.log('点击标注未激活，忽略点击');
      return;
    }

    // 阻止事件冒泡，避免触发原有的标注工具
    e.preventDefault();
    e.stopPropagation();

    // 获取点击的坐标
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log('点击坐标:', { x, y, rectWidth: rect.width, rectHeight: rect.height });
    
    // 使用容器相对坐标（0-100范围）
    // 这种方法可以确保点击同一位置得到相同坐标，不受缩放和拖拽影响
    const imageX = (x / rect.width) * 100;
    const imageY = (y / rect.height) * 100;
    
    console.log('转换后的相对坐标:', { imageX, imageY });
    
    // 根据是否按住Shift键判断点的类型
    const pointType: 'positive' | 'negative' = e.shiftKey ? 'negative' : 'positive';
    
    const newPoint = {
      id: Date.now(), // 使用时间戳作为临时ID
      x: imageX,
      y: imageY,
      type: pointType
    };

    console.log('添加点击标注点:', newPoint);
    setClickAnnotationPoints(prev => [...prev, newPoint]);
    
    message.success(`已添加${pointType === 'positive' ? '积极' : '消极'}点: (${imageX.toFixed(1)}, ${imageY.toFixed(1)})`);
  }, [clickAnnotationActive, clickAnnotationSessionActive]);

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
        <SmartAnnotationDebug
          smartAnnotationActive={smartAnnotationActive}
          onToggleSmartAnnotation={handleSmartAnnotationClick}
        />


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
            width: '300px',
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }}>
            <ClickAnnotationPanel
              points={clickAnnotationPoints}
              onAddPoint={handleAddClickAnnotationPoint}
              onRemovePoint={handleRemoveClickAnnotationPoint}
              onClearPoints={handleClearClickAnnotationPoints}
              onStartAnnotation={handleStartClickAnnotation}
              onClearCurrentObject={handleClearCurrentClickAnnotationObject}
              onResetAll={handleResetAllClickAnnotation}
              onNextObject={handleNextClickAnnotationObject}
              disabled={false}
              isAnnotationActive={clickAnnotationSessionActive}
            />
          </div>
        )}
        <ImageAnnotator
          renderSidebar={renderSidebar}
          toolbarRight={topActionContent}
          ref={imageAnnotationRef}
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
