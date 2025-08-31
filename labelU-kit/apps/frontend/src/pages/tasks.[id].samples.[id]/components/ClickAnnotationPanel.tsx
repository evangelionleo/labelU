import React, { useCallback } from 'react';
import { Card, Button, Space, Typography, Alert, Tag, Divider, message } from 'antd';
import { AimOutlined, InfoCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Text, Title } = Typography;

const PanelWrapper = styled(Card)`
  margin: 16px;
  width: 320px;
  .ant-card-body {
    padding: 16px;
  }
`;

const PointList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  margin: 12px 0;
`;

const PointItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  margin: 4px 0;
  background: #f5f5f5;
  border-radius: 4px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  width: 100%;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

interface ClickAnnotationPanelProps {
  points: Array<{id: number; x: number; y: number; type: 'positive' | 'negative'}>;
  currentObjectPoints: Array<{id: number; x: number; y: number; type: 'positive' | 'negative'}>;
  currentObjectId: number;
  sessionActive: boolean;
  loading: boolean;
  onAddPositivePoint: (x: number, y: number, type: 'positive') => void;
  onAddNegativePoint: (x: number, y: number, type: 'negative') => void;
  onClearPoints: () => void;
  onStartAnnotation: () => void;
  onClearCurrentObject: () => void;
  onResetAll: () => void;
  onNextObject: () => void;
  disabled: boolean;
}

export function ClickAnnotationPanel({
  points,
  currentObjectPoints,
  currentObjectId,
  sessionActive,
  loading,
  onAddPositivePoint,
  onAddNegativePoint,
  onClearPoints,
  onStartAnnotation,
  onClearCurrentObject,
  onResetAll,
  onNextObject,
  disabled
}: ClickAnnotationPanelProps) {
  return (
    <PanelWrapper>
      <Alert
        message="点击标注模式"
        description={`当前对象: ${currentObjectId} | 当前对象点击点: ${currentObjectPoints.length} | 总点击点: ${points.length}`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <ButtonGroup>
        <Button
          type="primary"
          onClick={onStartAnnotation}
          loading={loading}
          disabled={disabled || sessionActive}
          style={{ width: '100%', marginBottom: 8 }}
        >
          开始标注
        </Button>

        <ButtonRow>
          <Button
            onClick={onClearCurrentObject}
            loading={loading}
            disabled={disabled || !sessionActive}
            style={{ flex: 1, marginRight: 4 }}
          >
            清除当前对象点
          </Button>
          <Button
            onClick={onNextObject}
            disabled={disabled || !sessionActive}
            style={{ flex: 1, marginLeft: 4 }}
          >
            下一个对象
          </Button>
        </ButtonRow>

        <Button
          onClick={onResetAll}
          loading={loading}
          disabled={disabled || !sessionActive}
          style={{ width: '100%', marginTop: 8 }}
        >
          重置所有
        </Button>
      </ButtonGroup>

      <Divider />

      <div>
        <h4>标注统计</h4>
        <p>当前对象: {currentObjectId}</p>
        <p>当前对象点击点: {currentObjectPoints.length}</p>
        <p>总点击点: {points.length}</p>
      </div>

      <Divider />

      <div>
        <h4>当前对象点击点</h4>
        {currentObjectPoints.length === 0 ? (
          <p style={{ color: '#999' }}>暂无点击点</p>
        ) : (
          <ul style={{ paddingLeft: 16 }}>
            {currentObjectPoints.map((point) => (
              <li key={point.id}>
                {point.type === 'positive' ? '🟢' : '🔴'} 
                ({point.x.toFixed(1)}%, {point.y.toFixed(1)}%)
              </li>
            ))}
          </ul>
        )}
      </div>

      <Divider />

      <div>
        <h4>使用说明</h4>
        <ul style={{ paddingLeft: 16, fontSize: 12, color: '#666' }}>
          <li>点击"开始标注"启动会话</li>
          <li>在图片上直接点击添加积极点</li>
          <li>按住Shift+点击添加消极点</li>
          <li>点击"下一个对象"切换到新对象</li>
          <li>每个对象只记录自己的点击点</li>
        </ul>
      </div>
    </PanelWrapper>
  );
}
