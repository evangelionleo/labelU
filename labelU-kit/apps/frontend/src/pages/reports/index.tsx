import React, { useState } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Select, Button, Table, Progress, Tag } from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined,
  PieChartOutlined,
  DownloadOutlined,
  CalendarOutlined,
  TeamOutlined,
  ProjectOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import styled from 'styled-components';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ReportsWrapper = styled.div`
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
  
  .filter-section {
    margin-bottom: 24px;
    padding: 16px;
    background: #fafafa;
    border-radius: 6px;
  }
  
  .stats-section {
    margin-bottom: 24px;
  }
  
  .chart-section {
    margin-bottom: 24px;
  }
`;

// Mock 数据
const mockReportData = {
  overview: {
    totalTasks: 156,
    completedTasks: 89,
    totalUsers: 23,
    activeUsers: 18,
    totalSamples: 2847,
    annotatedSamples: 2156,
  },
  progressData: [
    {
      key: '1',
      taskName: '图像分类标注任务',
      progress: 75,
      completedSamples: 750,
      totalSamples: 1000,
      assignee: '张三',
      dueDate: '2024-12-25',
      status: 'in_progress',
    },
    {
      key: '2',
      taskName: '目标检测标注任务',
      progress: 100,
      completedSamples: 500,
      totalSamples: 500,
      assignee: '李四',
      dueDate: '2024-12-20',
      status: 'completed',
    },
    {
      key: '3',
      taskName: '文本情感分析',
      progress: 45,
      completedSamples: 360,
      totalSamples: 800,
      assignee: '王五',
      dueDate: '2024-12-30',
      status: 'in_progress',
    },
  ],
  userPerformance: [
    {
      key: '1',
      username: '张三',
      completedTasks: 12,
      totalSamples: 850,
      accuracy: 95.2,
      efficiency: 92.1,
    },
    {
      key: '2',
      username: '李四',
      completedTasks: 8,
      totalSamples: 620,
      accuracy: 93.8,
      efficiency: 89.5,
    },
    {
      key: '3',
      username: '王五',
      completedTasks: 15,
      totalSamples: 1100,
      accuracy: 96.1,
      efficiency: 94.2,
    },
  ],
};

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState<any>(null);
  const [reportType, setReportType] = useState('overview');

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'in_progress':
        return <Tag color="processing">进行中</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const progressColumns = [
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 200,
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      render: (record: any) => (
        <div>
          <Progress percent={record.progress} size="small" />
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
            {record.completedSamples}/{record.totalSamples}
          </div>
        </div>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
    },
  ];

  const performanceColumns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '完成任务',
      dataIndex: 'completedTasks',
      key: 'completedTasks',
      width: 100,
    },
    {
      title: '标注样本',
      dataIndex: 'totalSamples',
      key: 'totalSamples',
      width: 100,
    },
    {
      title: '准确率',
      dataIndex: 'accuracy',
      key: 'accuracy',
      width: 100,
      render: (accuracy: number) => `${accuracy}%`,
    },
    {
      title: '效率评分',
      dataIndex: 'efficiency',
      key: 'efficiency',
      width: 100,
      render: (efficiency: number) => `${efficiency}%`,
    },
  ];

  const handleExportReport = () => {
    console.log('导出报表:', { dateRange, reportType });
  };

  return (
    <ReportsWrapper>
      <div className="page-header">
        <h1>报表中心</h1>
        <p>查看标注项目的统计数据和进度报告</p>
      </div>

      {/* 筛选条件 */}
      <div className="filter-section">
        <Row gutter={16} align="middle">
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>时间范围：</div>
            <RangePicker 
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8 }}>报表类型：</div>
            <Select 
              value={reportType} 
              onChange={setReportType}
              style={{ width: '100%' }}
            >
              <Option value="overview">概览报表</Option>
              <Option value="progress">进度报表</Option>
              <Option value="performance">绩效报表</Option>
              <Option value="quality">质量报表</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={handleExportReport}
            >
              导出报表
            </Button>
          </Col>
        </Row>
      </div>

      {/* 统计概览 */}
      <div className="stats-section">
        <Row gutter={16}>
          <Col span={4}>
            <Card>
              <Statistic
                title="总任务数"
                value={mockReportData.overview.totalTasks}
                prefix={<ProjectOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已完成任务"
                value={mockReportData.overview.completedTasks}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="总用户数"
                value={mockReportData.overview.totalUsers}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="活跃用户"
                value={mockReportData.overview.activeUsers}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="总样本数"
                value={mockReportData.overview.totalSamples}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已标注样本"
                value={mockReportData.overview.annotatedSamples}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 图表区域 */}
      <div className="chart-section">
        <Row gutter={16}>
          <Col span={12}>
            <Card 
              title="任务进度报表" 
              extra={<Button size="small" icon={<DownloadOutlined />}>导出</Button>}
            >
              <Table
                columns={progressColumns}
                dataSource={mockReportData.progressData}
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card 
              title="用户绩效报表" 
              extra={<Button size="small" icon={<DownloadOutlined />}>导出</Button>}
            >
              <Table
                columns={performanceColumns}
                dataSource={mockReportData.userPerformance}
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 图表占位符 */}
      <div className="chart-section">
        <Row gutter={16}>
          <Col span={8}>
            <Card title="任务完成趋势">
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
                <LineChartOutlined style={{ fontSize: 48 }} />
                <div style={{ marginLeft: 16 }}>
                  <div>趋势图表</div>
                  <div style={{ fontSize: 12 }}>显示任务完成趋势</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="用户活跃度分布">
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
                <PieChartOutlined style={{ fontSize: 48 }} />
                <div style={{ marginLeft: 16 }}>
                  <div>饼图</div>
                  <div style={{ fontSize: 12 }}>显示用户活跃度分布</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="样本标注质量">
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
                <BarChartOutlined style={{ fontSize: 48 }} />
                <div style={{ marginLeft: 16 }}>
                  <div>柱状图</div>
                  <div style={{ fontSize: 12 }}>显示标注质量统计</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </ReportsWrapper>
  );
};

export default Reports;
