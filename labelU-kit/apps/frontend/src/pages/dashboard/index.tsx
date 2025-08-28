import React from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag } from 'antd';
import { 
  ProjectOutlined, 
  UserOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from '@labelu/i18n';
import styled from 'styled-components';

const DashboardWrapper = styled.div`
  padding: 24px;
  
  .dashboard-header {
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
  
  .stat-card {
    .ant-card-body {
      padding: 24px;
    }
  }
  
  .progress-section {
    margin-top: 24px;
  }
`;

// Mock 数据
const mockStats = {
  totalTasks: 156,
  totalUsers: 23,
  totalSamples: 2847,
  completedTasks: 89,
  inProgressTasks: 45,
  pendingTasks: 22,
};

const mockRecentTasks = [
  {
    key: '1',
    name: '图像分类标注任务',
    status: 'INPROGRESS',
    progress: 75,
    assignee: '张三',
    dueDate: '2024-12-25',
  },
  {
    key: '2',
    name: '文本情感分析',
    status: 'FINISHED',
    progress: 100,
    assignee: '李四',
    dueDate: '2024-12-20',
  },
  {
    key: '3',
    name: '目标检测标注',
    status: 'DRAFT',
    progress: 0,
    assignee: '王五',
    dueDate: '2024-12-30',
  },
];

const Dashboard: React.FC = () => {
  const { t } = useTranslation();

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'FINISHED':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'INPROGRESS':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>进行中</Tag>;
      case 'DRAFT':
        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>草稿</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
  ];

  return (
    <DashboardWrapper>
      <div className="dashboard-header">
        <h1>{t('dashboard')}</h1>
        <p>欢迎使用 LabelU 数据标注平台</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="总任务数"
              value={mockStats.totalTasks}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="总用户数"
              value={mockStats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="总样本数"
              value={mockStats.totalSamples}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="已完成任务"
              value={mockStats.completedTasks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 任务进度 */}
      <div className="progress-section">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="任务状态分布" className="stat-card">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Statistic
                    title="进行中"
                    value={mockStats.inProgressTasks}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="已完成"
                    value={mockStats.completedTasks}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="待处理"
                    value={mockStats.pendingTasks}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="整体完成率" className="stat-card">
              <Progress
                type="circle"
                percent={Math.round((mockStats.completedTasks / mockStats.totalTasks) * 100)}
                format={(percent) => `${percent}%`}
                strokeColor="#52c41a"
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 最近任务 */}
      <Card title="最近任务" style={{ marginTop: 24 }}>
        <Table
          columns={columns}
          dataSource={mockRecentTasks}
          pagination={false}
          size="small"
        />
      </Card>
    </DashboardWrapper>
  );
};

export default Dashboard;
