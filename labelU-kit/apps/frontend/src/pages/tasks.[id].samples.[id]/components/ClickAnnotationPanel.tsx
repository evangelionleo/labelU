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

interface Point {
  id: number;
  x: number;
  y: number;
  type: 'positive' | 'negative';
}

interface ClickAnnotationPanelProps {
  points: Point[];
  onAddPoint?: (point: Point) => void;
  onRemovePoint?: (pointId: number) => void;
  onClearPoints?: () => void;
  onStartAnnotation?: () => void;
  onClearCurrentObject?: () => void;
  onResetAll?: () => void;
  onNextObject?: () => void;
  disabled?: boolean;
  isAnnotationActive?: boolean;
}

const ClickAnnotationPanel: React.FC<ClickAnnotationPanelProps> = ({
  points,
  onAddPoint,
  onRemovePoint,
  onClearPoints,
  onStartAnnotation,
  onClearCurrentObject,
  onResetAll,
  onNextObject,
  disabled = false,
  isAnnotationActive = false,
}) => {
    const positivePoints = points.filter(p => p.type === 'positive');
    const negativePoints = points.filter(p => p.type === 'negative');

  return (
    <PanelWrapper title={<><AimOutlined /> 点击标注</>}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Alert
          message="点击标注功能"
          description="在图片上直接点击添加积极点（正向标注）或消极点（负向标注）。按住Shift键点击添加消极点。在点击标注模式下，图片将被恢复到适应容器的大小和位置，并固定不允许缩放和拖拽。"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: '8px' }}
        />

        <div>
          <Title level={5} style={{ marginBottom: '12px' }}>操作按钮</Title>
          <ButtonGroup>
            {/* 第一行：开始标注 */}
            <Button
              type="primary"
              onClick={onStartAnnotation}
              disabled={disabled || isAnnotationActive}
              style={{ width: '100%' }}
            >
              {isAnnotationActive ? '标注会话已启动' : '开始标注'}
            </Button>
            
            {/* 第二行：管理按钮 */}
            <ButtonRow>
              <Button
                onClick={onClearCurrentObject}
                disabled={disabled || points.length === 0}
                style={{ flex: 1 }}
              >
                清除当前对象点
              </Button>
              <Button
                onClick={onNextObject}
                disabled={disabled || !isAnnotationActive}
                style={{ flex: 1 }}
              >
                下一个对象
              </Button>
            </ButtonRow>
            
            {/* 第三行：重置按钮 */}
            <Button
              danger
              onClick={onResetAll}
              disabled={disabled}
              style={{ width: '100%' }}
            >
              重置所有
            </Button>
          </ButtonGroup>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <div>
          <Title level={5} style={{ marginBottom: '8px' }}>标注统计</Title>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Tag color="green" style={{ margin: 0 }}>积极点: {positivePoints.length}</Tag>
            <Tag color="red" style={{ margin: 0 }}>消极点: {negativePoints.length}</Tag>
            <Tag color="blue" style={{ margin: 0 }}>总计: {points.length}</Tag>
          </div>
        </div>

        {points.length > 0 && (
          <div>
            <Title level={5} style={{ marginBottom: '8px' }}>已添加的点</Title>
            <PointList>
              {points.map(point => (
                <PointItem key={point.id}>
                  <div>
                    <Tag color={point.type === 'positive' ? 'green' : 'red'}>
                      {point.type === 'positive' ? '积极' : '消极'}
                    </Tag>
                    <Text>坐标: ({point.x.toFixed(1)}, {point.y.toFixed(1)})</Text>
                  </div>
                  <Button
                    size="small"
                    danger
                    onClick={() => onRemovePoint?.(point.id)}
                    disabled={disabled}
                  >
                    删除
                  </Button>
                </PointItem>
              ))}
            </PointList>
          </div>
        )}

        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          <Title level={5} style={{ marginBottom: '8px' }}>使用说明：</Title>
          <ul style={{ margin: '0', paddingLeft: '16px', lineHeight: '1.5' }}>
            <li>点击"开始标注"启动标注会话</li>
            <li>在图片上直接点击添加积极点（正向标注）</li>
            <li>按住Shift键在图片上点击添加消极点（负向标注）</li>
            <li>积极点表示要包含的区域</li>
            <li>消极点表示要排除的区域</li>
            <li>可以添加多个点来精确标注</li>
            <li>在点击标注模式下，图片将被恢复到适应容器的大小和位置</li>
            <li>图片将被固定，不允许缩放和拖拽</li>
            <li>点击"清除当前对象点"清除当前对象的点</li>
            <li>点击"下一个对象"保存当前对象并创建新对象</li>
            <li>点击"重置所有"清除所有点并结束会话</li>
          </ul>
        </div>
      </Space>
    </PanelWrapper>
  );
};

export default ClickAnnotationPanel;
