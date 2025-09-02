import React from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Card, Alert } from 'antd';

const { Title, Text } = Typography;

const QAGenerationPage = () => {
  const routeParams = useParams();
  const taskId = routeParams.taskId;
  
  console.log('QAGenerationPage 组件开始渲染');
  console.log('路由参数:', routeParams);
  console.log('任务ID:', taskId);
  
  return (
    <div style={{ padding: '2rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <Card>
        <Title level={2}>问答对生成页面</Title>
        <Text>任务ID: {taskId}</Text>
        
        <Alert
          message="页面加载成功"
          description="这是一个简单的测试页面"
          type="success"
          showIcon
          style={{ marginTop: '1rem' }}
        />
        
        <div style={{ marginTop: '2rem' }}>
          <Text>如果你能看到这个页面，说明路由配置正确！</Text>
        </div>
      </Card>
    </div>
  );
};

export default QAGenerationPage;
