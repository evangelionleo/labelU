import React, { useState, useCallback } from 'react';
import { Card, Button, Input, Slider, Space, Typography, message, Alert } from 'antd';
import { BulbOutlined, SendOutlined, InfoCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { TextArea } = Input;
const { Text, Title } = Typography;

const PanelWrapper = styled(Card)`
  margin: 16px;
  .ant-card-body {
    padding: 16px;
  }
`;

const ControlGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled(Text)`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
`;

interface SmartAnnotationPanelProps {
  onTriggerAnnotation?: (textPrompt: string, boxThreshold: number, textThreshold: number) => Promise<any>;
  disabled?: boolean;
}

const SmartAnnotationPanel: React.FC<SmartAnnotationPanelProps> = ({
  onTriggerAnnotation,
  disabled = false,
}) => {
  const [textPrompt, setTextPrompt] = useState('');
  const [boxThreshold, setBoxThreshold] = useState(0.35);
  const [textThreshold, setTextThreshold] = useState(0.25);
  const [loading, setLoading] = useState(false);

  const handleTriggerAnnotation = useCallback(async () => {
    if (!textPrompt.trim()) {
      message.warning('请输入要检测的对象描述');
      return;
    }

    if (!onTriggerAnnotation) {
      message.warning('智能标注功能未配置');
      return;
    }

    setLoading(true);
    try {
      await onTriggerAnnotation(textPrompt.trim(), boxThreshold, textThreshold);
      message.success('智能标注已触发');
    } catch (error) {
      message.error('智能标注失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [textPrompt, boxThreshold, textThreshold, onTriggerAnnotation]);

  return (
    <PanelWrapper title={<><BulbOutlined /> 智能标注</>}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          message="智能标注功能"
          description="使用自然语言描述自动检测和标注图像中的对象"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
        />

        <ControlGroup>
          <Label>描述要检测的对象：</Label>
          <TextArea
            rows={3}
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder="例如：人物 汽车 狗 建筑物
或英文：person car dog building
注意：多个对象用空格或句号分隔"
            disabled={disabled}
          />
        </ControlGroup>

        <ControlGroup>
          <Label>边界框阈值: {boxThreshold}</Label>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={boxThreshold}
            onChange={setBoxThreshold}
            disabled={disabled}
          />
        </ControlGroup>

        <ControlGroup>
          <Label>文本阈值: {textThreshold}</Label>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={textThreshold}
            onChange={setTextThreshold}
            disabled={disabled}
          />
        </ControlGroup>

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleTriggerAnnotation}
          loading={loading}
          disabled={disabled || !textPrompt.trim()}
          block
        >
          开始智能标注
        </Button>

        <div style={{ fontSize: '12px', color: '#666' }}>
          <Title level={5}>使用说明：</Title>
          <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
            <li>输入要检测的对象描述（支持中英文）</li>
            <li>调整边界框和文本阈值</li>
            <li>点击"开始智能标注"按钮</li>
            <li>系统会自动检测并标注对象</li>
          </ul>
        </div>
      </Space>
    </PanelWrapper>
  );
};

export default SmartAnnotationPanel;
