import type { ImageAnnotatorProps } from '@labelu/image-annotator-react';
import type { ToolName } from '@labelu/image';
import { TOOL_NAMES } from '@labelu/image';

import type { ToolsConfigState } from '@/types/toolConfig';

export function convertImageConfig(taskConfig?: ToolsConfigState) {
  console.log('convertImageConfig - 输入配置:', taskConfig);
  console.log('convertImageConfig - taskConfig?.tools:', taskConfig?.tools);
  
  const editorConfig: NonNullable<ImageAnnotatorProps['config']> = {
    showOrder: true,
  } as NonNullable<ImageAnnotatorProps['config']>;
  const commonLabels = taskConfig?.attributes ?? [];

  taskConfig?.tools?.forEach((item) => {
    const toolName = item.tool.replace(/Tool$/, '') as ToolName | 'tag' | 'text';
    console.log('处理工具:', item.tool, '转换后:', toolName, '是否在TOOL_NAMES中:', TOOL_NAMES.includes(toolName as ToolName));
    console.log('TOOL_NAMES:', TOOL_NAMES);

    if (TOOL_NAMES.includes(toolName as ToolName)) {
      if (!editorConfig[toolName]) {
        editorConfig[toolName] = {} as any;
      }

      // @ts-ignore
      editorConfig[toolName] = {
        labels: [...commonLabels, ...(item.config.attributes ?? [])],
        // @ts-ignore
        outOfImage: Boolean(taskConfig.drawOutsideTarget),
      };

      if (toolName === 'line') {
        editorConfig.line!.edgeAdsorptive = Boolean(item.config.edgeAdsorption);
        editorConfig.line!.lineType = item.config.lineType === 0 ? 'line' : 'spline';
        editorConfig.line!.minPointAmount = item.config.lowerLimitPointNum;
        editorConfig.line!.maxPointAmount = item.config.upperLimitPointNum;
        editorConfig.line!.style = {
          ...editorConfig.line!.style,
          arrowType: item.config.arrowType,
        };
      }

      if (toolName === 'relation') {
        editorConfig.relation!.style = {
          lineStyle: item.config.lineStyle,
          arrowType: item.config.arrowType,
        };
      }

      if (toolName === 'point') {
        editorConfig.point!.maxPointAmount = item.config.upperLimit;
      }

      if (toolName === 'rect') {
        editorConfig.rect!.minWidth = item.config.minWidth;
        editorConfig.rect!.minHeight = item.config.minHeight;
      }

      if (toolName === 'polygon') {
        editorConfig.polygon!.edgeAdsorptive = Boolean(item.config.edgeAdsorption);
        editorConfig.polygon!.lineType = item.config.lineType === 0 ? 'line' : 'spline';

        editorConfig.polygon!.minPointAmount = item.config.lowerLimitPointNum;
        editorConfig.polygon!.maxPointAmount = item.config.upperLimitPointNum;
      }

      // 处理智能标注工具的特殊配置
      if (toolName === 'smartAnnotation' as any) {
        console.log('处理智能标注工具配置:', item.config);
        if (!(editorConfig as any).smartAnnotation) {
          (editorConfig as any).smartAnnotation = {};
        }
        (editorConfig as any).smartAnnotation.enabled = item.config?.enabled ?? true;
        (editorConfig as any).smartAnnotation.boxThreshold = item.config?.boxThreshold ?? 0.35;
        (editorConfig as any).smartAnnotation.textThreshold = item.config?.textThreshold ?? 0.25;
        (editorConfig as any).smartAnnotation.syncRectLabels = item.config?.syncRectLabels ?? true;
        (editorConfig as any).smartAnnotation.labels = [...commonLabels, ...(item.config.attributes ?? [])];
      }
    }

    if (toolName === 'tag') {
      editorConfig.tag = item.config.attributes;
    }

    if (toolName === 'text') {
      editorConfig.text = item.config.attributes;
    }
  });

  // 如果任务配置中有拉框工具但没有智能标注工具，自动添加智能标注工具
  const hasRectTool = taskConfig?.tools?.some(item => item.tool === 'rectTool');
  const hasSmartAnnotationTool = taskConfig?.tools?.some(item => item.tool === 'smartAnnotationTool');
  
  if (hasRectTool && !hasSmartAnnotationTool && !(editorConfig as any).smartAnnotation) {
    console.log('检测到拉框工具但缺少智能标注工具，自动添加智能标注配置');
    
    // 获取拉框工具的标签
    const rectTool = taskConfig?.tools?.find(item => item.tool === 'rectTool');
    const rectLabels = rectTool?.config?.attributes || [];
    
    (editorConfig as any).smartAnnotation = {
      enabled: true,
      boxThreshold: 0.35,
      textThreshold: 0.25,
      syncRectLabels: true,
      labels: [...commonLabels, ...rectLabels],
    };
    
    console.log('自动添加的智能标注配置:', (editorConfig as any).smartAnnotation);
  }

  console.log('convertImageConfig - 输出配置:', editorConfig);
  return editorConfig;
}
