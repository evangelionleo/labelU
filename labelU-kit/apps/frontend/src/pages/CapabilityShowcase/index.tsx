import React from 'react';
import { Card, Row, Col, Typography, Space, Button } from 'antd';
import { useTranslation } from '@labelu/i18n';
import { FlexLayout } from '@labelu/components-react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const CapabilityShowcase: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const capabilities = [
    {
      title: '图像标注',
      description: '支持2D边界框、语义分割、多边形、关键点等多种标注方式',
      icon: '🖼️',
      features: ['目标检测', '场景分析', '图像识别', '机器翻译'],
      hasDemo: true,
      demoPath: '/capability-showcase/image-annotation'
    },
    {
      title: '视频标注',
      description: '强大的视频处理能力，支持视频分割、分类和信息提取',
      icon: '🎥',
      features: ['视频检索', '视频摘要', '动作识别', '场景分析']
    },
    {
      title: '音频标注',
      description: '高效的音频分析工具，支持音频分割、分类和信息提取',
      icon: '🎵',
      features: ['音频分割', '音频分类', '信息提取', '可视化处理']
    },
    {
      title: 'AI辅助标注',
      description: '支持一键加载预标注数据，提高标注效率和准确性',
      icon: '🤖',
      features: ['预标注加载', '智能优化', '效率提升', '准确性保证']
    }
  ];

  return (
    <FlexLayout flex="column" padding="2rem">
      <Title level={2} style={{ textAlign: 'center', marginBottom: '2rem' }}>
        {t('capabilityShowcase')}
      </Title>
      
      <Row gutter={[24, 24]}>
        {capabilities.map((capability, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card 
              hoverable 
              style={{ height: '100%' }}
              bodyStyle={{ padding: '1.5rem' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', fontSize: '3rem' }}>
                  {capability.icon}
                </div>
                <Title level={4} style={{ textAlign: 'center', margin: 0 }}>
                  {capability.title}
                </Title>
                <Paragraph style={{ textAlign: 'center', margin: 0 }}>
                  {capability.description}
                </Paragraph>
                <div>
                  <Title level={5} style={{ marginBottom: '0.5rem' }}>
                    主要功能：
                  </Title>
                  <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                    {capability.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                </div>
                {capability.hasDemo && (
                  <Button 
                    type="primary"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(capability.demoPath!)}
                    style={{ width: '100%' }}
                  >
                    体验演示
                  </Button>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </FlexLayout>
  );
};

export default CapabilityShowcase;