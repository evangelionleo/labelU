import React from 'react';
import { Card, Button, Space, Typography, Alert } from 'antd';
import { BugOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface SmartAnnotationDebugProps {
  smartAnnotationActive: boolean;
  onToggleSmartAnnotation: () => void;
}

const SmartAnnotationDebug: React.FC<SmartAnnotationDebugProps> = ({
  smartAnnotationActive,
  onToggleSmartAnnotation,
}) => {
  return (
    <Card 
      title={
        <Space>
          <BugOutlined />
          <span>智能标注调试</span>
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Alert
          message="智能标注状态"
          description={
            <div>
              <p>智能标注面板: <Text code style={{ color: smartAnnotationActive ? '#52c41a' : '#ff4d4f' }}>
                {smartAnnotationActive ? '已激活' : '未激活'}
              </Text></p>
            </div>
          }
          type={smartAnnotationActive ? 'success' : 'info'}
          showIcon
          icon={<InfoCircleOutlined />}
        />

        <Space wrap>
          <Button
            type="primary"
            onClick={onToggleSmartAnnotation}
          >
            {smartAnnotationActive ? '关闭' : '打开'}智能标注
          </Button>
        </Space>

        <div style={{ fontSize: '12px', color: '#666' }}>
          <Title level={5}>使用说明：</Title>
          <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
            <li>点击右上角的智能标注按钮</li>
            <li>在右侧面板中输入要检测的对象描述</li>
            <li>调整阈值参数</li>
            <li>点击"开始智能标注"按钮</li>
          </ul>
        </div>
      </Space>
    </Card>
  );
};

export default SmartAnnotationDebug;
