import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Upload, message } from 'antd';
import { 
  PlusOutlined, 
  RobotOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined
} from '@ant-design/icons';
import styled from 'styled-components';

const { Option } = Select;
const { TextArea } = Input;

const PreAnnotationWrapper = styled.div`
  padding: 24px;
  
  .page-header {
    margin-bottom: 24px;
    
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #262626;
    }
    
    p {
      margin: 8px 0 0 0;
      color: #8c8c8c;
    }
  }
  
  .action-bar {
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
`;

// Mock 数据
const mockPreAnnotationTasks = [
  {
    key: '1',
    id: 'PA001',
    name: '图像分类预标注任务',
    model: 'ResNet-50',
    status: 'RUNNING',
    progress: 75,
    totalSamples: 1000,
    processedSamples: 750,
    accuracy: 92.5,
    createdAt: '2024-12-15',
    updatedAt: '2024-12-19',
  },
  {
    key: '2',
    id: 'PA002',
    name: '目标检测预标注任务',
    model: 'YOLO-v5',
    status: 'COMPLETED',
    progress: 100,
    totalSamples: 500,
    processedSamples: 500,
    accuracy: 88.3,
    createdAt: '2024-12-10',
    updatedAt: '2024-12-18',
  },
  {
    key: '3',
    id: 'PA003',
    name: '文本分类预标注任务',
    model: 'BERT-base',
    status: 'PAUSED',
    progress: 45,
    totalSamples: 800,
    processedSamples: 360,
    accuracy: 85.7,
    createdAt: '2024-12-12',
    updatedAt: '2024-12-17',
  },
  {
    key: '4',
    id: 'PA004',
    name: '语音识别预标注任务',
    model: 'Whisper',
    status: 'FAILED',
    progress: 0,
    totalSamples: 300,
    processedSamples: 0,
    accuracy: 0,
    createdAt: '2024-12-14',
    updatedAt: '2024-12-16',
  },
];

const PreAnnotation: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Tag color="processing" icon={<PlayCircleOutlined />}>运行中</Tag>;
      case 'COMPLETED':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'PAUSED':
        return <Tag color="warning" icon={<PauseCircleOutlined />}>已暂停</Tag>;
      case 'FAILED':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const handleCreateTask = () => {
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      console.log('创建预标注任务:', values);
      message.success('预标注任务创建成功！');
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 120,
      render: (progress: number) => `${progress}%`,
    },
    {
      title: '样本数量',
      key: 'samples',
      width: 120,
      render: (record: any) => `${record.processedSamples}/${record.totalSamples}`,
    },
    {
      title: '准确率',
      dataIndex: 'accuracy',
      key: 'accuracy',
      width: 100,
      render: (accuracy: number) => accuracy > 0 ? `${accuracy}%` : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (record: any) => (
        <Space size="small">
          {record.status === 'RUNNING' && (
            <Button size="small" icon={<PauseCircleOutlined />}>暂停</Button>
          )}
          {record.status === 'PAUSED' && (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />}>继续</Button>
          )}
          {record.status === 'COMPLETED' && (
            <Button size="small">查看结果</Button>
          )}
          {record.status === 'FAILED' && (
            <Button size="small" danger>重试</Button>
          )}
          <Button size="small">编辑</Button>
          <Button size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <PreAnnotationWrapper>
      <div className="page-header">
        <h1>预标注任务</h1>
        <p>使用AI模型进行自动预标注，提高标注效率</p>
      </div>

      <div className="action-bar">
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleCreateTask}
        >
          创建预标注任务
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={mockPreAnnotationTasks}
          pagination={{
            total: mockPreAnnotationTasks.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 创建预标注任务模态框 */}
      <Modal
        title="创建预标注任务"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            model: 'ResNet-50',
            priority: 'normal',
          }}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入预标注任务名称" />
          </Form.Item>

          <Form.Item
            name="model"
            label="选择模型"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select placeholder="请选择预标注模型">
              <Option value="ResNet-50">ResNet-50 (图像分类)</Option>
              <Option value="YOLO-v5">YOLO-v5 (目标检测)</Option>
              <Option value="BERT-base">BERT-base (文本分类)</Option>
              <Option value="Whisper">Whisper (语音识别)</Option>
              <Option value="Custom">自定义模型</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="taskId"
            label="关联任务"
            rules={[{ required: true, message: '请选择关联任务' }]}
          >
            <Select placeholder="请选择要预标注的任务">
              <Option value="task1">图像分类标注任务</Option>
              <Option value="task2">目标检测标注任务</Option>
              <Option value="task3">文本情感分析任务</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述"
          >
            <TextArea 
              rows={3} 
              placeholder="请输入任务描述（可选）"
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
          >
            <Select>
              <Option value="high">高</Option>
              <Option value="normal">中</Option>
              <Option value="low">低</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="config"
            label="模型配置"
          >
            <TextArea 
              rows={4} 
              placeholder="请输入模型配置参数（JSON格式，可选）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </PreAnnotationWrapper>
  );
};

export default PreAnnotation;
