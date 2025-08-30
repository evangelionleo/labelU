import type { BasicImageAnnotation, ToolName } from '../interface';
import { Annotation } from './Annotation';

export interface SmartAnnotationData extends BasicImageAnnotation {
  label: string;
  confidence?: number;
  boxThreshold?: number;
  textThreshold?: number;
  textPrompt?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SmartAnnotationStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
}

export class SmartAnnotationAnnotation extends Annotation<SmartAnnotationData, SmartAnnotationStyle> {
  public static labelStatic = {
    getLabelColor: (label: string) => {
      // 根据标签返回颜色，这里使用简单的哈希算法
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ];
      const hash = label.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return colors[Math.abs(hash) % colors.length];
    }
  };

  constructor(props: {
    name: ToolName;
    id: string;
    data: SmartAnnotationData;
    showOrder: boolean;
    style: SmartAnnotationStyle;
    hoveredStyle?: SmartAnnotationStyle;
  }) {
    super(props);
  }

  public render(ctx: CanvasRenderingContext2D) {
    const { data, style } = this;
    const { x, y, width, height } = data;

    ctx.save();
    
    // 绘制边界框
    ctx.strokeStyle = style.strokeColor || SmartAnnotationAnnotation.labelStatic.getLabelColor(data.label);
    ctx.lineWidth = style.strokeWidth || 2;
    ctx.strokeRect(x, y, width, height);

    // 绘制填充
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.globalAlpha = style.fillOpacity || 0.3;
      ctx.fillRect(x, y, width, height);
    }

    // 绘制标签
    if (data.label) {
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.globalAlpha = 1;
      const textWidth = ctx.measureText(data.label).width;
      const textHeight = 12;
      
      // 绘制标签背景
      ctx.fillStyle = SmartAnnotationAnnotation.labelStatic.getLabelColor(data.label);
      ctx.fillRect(x, y - textHeight - 2, textWidth + 4, textHeight + 2);
      
      // 绘制标签文字
      ctx.fillStyle = '#fff';
      ctx.fillText(data.label, x + 2, y - 4);
    }

    // 绘制置信度
    if (data.confidence !== undefined) {
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.globalAlpha = 0.8;
      const confidenceText = `${(data.confidence * 100).toFixed(1)}%`;
      ctx.fillText(confidenceText, x + width - 40, y + height + 12);
    }

    ctx.restore();
  }

  public isPointInAnnotation(x: number, y: number): boolean {
    const { data } = this;
    return x >= data.x && x <= data.x + data.width && 
           y >= data.y && y <= data.y + data.height;
  }
}
