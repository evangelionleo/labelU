import type { ToolName } from '../interface';
import type { SmartAnnotationData, SmartAnnotationStyle } from '../annotations/SmartAnnotation.annotation';
import { Tool } from './Tool';
import { axis } from '../singletons';
import { SmartAnnotationAnnotation } from '../annotations/SmartAnnotation.annotation';

export interface SmartAnnotationConfig {
  enabled?: boolean;
  boxThreshold?: number;
  textThreshold?: number;
  labels?: any[];
  syncRectLabels?: boolean;
  getTools: () => any;
  name?: ToolName;
  data?: SmartAnnotationData[];
  style?: SmartAnnotationStyle;
}

export class SmartAnnotationTool extends Tool<SmartAnnotationData, SmartAnnotationStyle, SmartAnnotationConfig> {
  public name: ToolName = 'smartAnnotation';

  static create({ data, ...config }: SmartAnnotationConfig) {
    return new SmartAnnotationTool({ ...config, data: data ?? [] });
  }

  constructor(config: SmartAnnotationConfig) {
    super({
      name: 'smartAnnotation',
      enabled: true,
      boxThreshold: 0.35,
      textThreshold: 0.25,
      labels: [],
      data: [],
      ...config,
      getTools: config.getTools || (() => ({} as any)),
      style: {
        strokeColor: '#1890ff',
        strokeWidth: 2,
        fillColor: '#1890ff',
        fillOpacity: 0.3,
        ...config.style,
      },
    } as any);
    this.setupShapes();
  }

  protected setupShapes() {
    // 智能标注工具不需要绘制形状，主要用于触发自动标注
    this.drawing = new Map();
  }

  protected handleMouseDown = (e: MouseEvent) => {
    console.log('智能标注工具handleMouseDown被调用');
    
    // 智能标注工具响应鼠标点击事件
    if (!this.config.enabled) {
      console.log('智能标注功能未启用');
      return;
    }

    console.log('智能标注工具已启用，处理点击事件');

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 转换为图片相对坐标
    const imageElement = e.target as HTMLImageElement;
    const imageX = (x / rect.width) * imageElement.naturalWidth;
    const imageY = (y / rect.height) * imageElement.naturalHeight;

    console.log('智能标注点击:', { x: imageX, y: imageY, type: e.shiftKey ? 'negative' : 'positive' });
    
    // 触发点击标注
    this.handleClickAnnotation(imageX, imageY, e.shiftKey ? 'negative' : 'positive');
  };

  protected handleMouseMove = (_e: MouseEvent) => {
    // 不处理鼠标移动
  };

  protected handleEscape = (_e: MouseEvent) => {
    // 不处理ESC键
  };

  protected handleDelete = (_e: KeyboardEvent) => {
    // 不处理删除键
  };

  protected convertAnnotationItem(data: SmartAnnotationData) {
    return {
      ...data,
      ...axis!.convertCanvasCoordinate(data),
      width: data.width / axis!.initialBackgroundScale,
      height: data.height / axis!.initialBackgroundScale,
    };
  }

  public activate(label?: string) {
    this.activeLabel = label;
    console.log('智能标注工具已激活，标签:', label);
    console.log('智能标注工具配置:', this.config);
  }

  public deactivate() {
    this.activeLabel = undefined;
    console.log('智能标注工具已停用');
  }

  public clear() {
    this.drawing?.clear();
    this.draft = null;
    this.sketch = null;
  }

  public destroy() {
    this.clear();
  }

  public render(ctx: CanvasRenderingContext2D) {
    // 渲染智能标注的结果
    this.drawing?.forEach((annotation) => {
      annotation.render(ctx);
    });

    if (this.draft) {
      this.draft.render(ctx);
    }
  }

  public load(data: SmartAnnotationData[]) {
    this.drawing?.clear();
    data.forEach((item) => {
      const annotation = new SmartAnnotationAnnotation({
        name: this.name,
        id: item.id,
        data: item,
        showOrder: this.showOrder,
        style: this.style,
        hoveredStyle: this.hoveredStyle,
      });
      this.drawing?.set(item.id, annotation);
    });
  }

  public getData(): SmartAnnotationData[] {
    return Array.from(this.drawing?.values() || []).map((annotation) => annotation.data);
  }

  // 处理点击标注
  private async handleClickAnnotation(x: number, y: number, type: 'positive' | 'negative') {
    if (!this.config.enabled) {
      console.warn('智能标注功能未启用');
      return;
    }

    try {
      console.log('点击标注:', { x, y, type });
      
      // 模拟API调用
      const response = await this.callClickAnnotationAPI(x, y, type);
      
      if (response.success) {
        // 将结果添加到标注中
        this.addAnnotationResult(response.result);
      }
    } catch (error) {
      console.error('点击标注失败:', error);
    }
  }

  // 调用点击标注API
  private async callClickAnnotationAPI(x: number, y: number, type: 'positive' | 'negative') {
    // 这里应该调用实际的API
    // 目前只是模拟
    console.log('调用点击标注API:', { x, y, type });
    
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 模拟返回结果
    return {
      success: true,
      result: {
        bbox: [x - 50, y - 50, x + 50, y + 50],
        mask: null,
        confidence: 0.85,
        label: this.activeLabel || '智能标注对象'
      }
    };
  }

  // 添加标注结果
  private addAnnotationResult(result: any) {
    if (!result || !result.bbox) {
      return;
    }

    const [x1, y1, x2, y2] = result.bbox;
    const annotationData: SmartAnnotationData = {
      id: `smart_${Date.now()}`,
      order: this.drawing?.size || 0,
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      label: result.label || this.activeLabel || '智能标注对象',
      confidence: result.confidence,
      valid: true,
      visible: true
    };

    const annotation = new SmartAnnotationAnnotation({
      name: this.name,
      id: annotationData.id,
      data: annotationData,
      showOrder: this.showOrder,
      style: this.style,
      hoveredStyle: this.hoveredStyle,
    });
    this.drawing?.set(annotationData.id, annotation);
    
    console.log('添加智能标注结果:', annotationData);
  }

  // 触发智能标注的方法
  public async triggerSmartAnnotation(textPrompt: string, imageFile: File) {
    if (!this.config.enabled) {
      console.warn('智能标注功能未启用');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('text_prompt', textPrompt);
      formData.append('box_threshold', (this.config.boxThreshold || 0.35).toString());
      formData.append('text_threshold', (this.config.textThreshold || 0.25).toString());

      // 这里应该调用实际的智能标注API
      // const response = await fetch('/api/auto_annotate', {
      //   method: 'POST',
      //   body: formData
      // });
      
      console.log('触发智能标注:', {
        textPrompt,
        boxThreshold: this.config.boxThreshold,
        textThreshold: this.config.textThreshold,
        labels: this.config.labels
      });
    } catch (error) {
      console.error('智能标注失败:', error);
    }
  }
}
