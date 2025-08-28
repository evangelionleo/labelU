import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Avatar, message, Row, Col, Statistic } from 'antd';
import { 
  PlusOutlined, 
  TeamOutlined, 
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ProjectOutlined
} from '@ant-design/icons';
import styled from 'styled-components';

const { Option } = Select;
const { TextArea } = Input;

const TeamsWrapper = styled.div`
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
  
  .stats-section {
    margin-bottom: 24px;
  }
`;

// Mock 数据
const mockTeams = [
  {
    key: '1',
    id: 1,
    name: '图像标注团队',
    description: '专注于图像分类和目标检测标注',
    leader: '张三',
    memberCount: 8,
    projectCount: 12,
    status: 'active',
    createdAt: '2024-01-01',
  },
  {
    key: '2',
    id: 2,
    name: '文本标注团队',
    description: '负责文本分类和情感分析标注',
    leader: '李四',
    memberCount: 6,
    projectCount: 8,
    status: 'active',
    createdAt: '2024-01-15',
  },
  {
    key: '3',
    id: 3,
    name: '语音标注团队',
    description: '专注于语音识别和语音分类标注',
    leader: '王五',
    memberCount: 4,
    projectCount: 5,
    status: 'inactive',
    createdAt: '2024-02-01',
  },
  {
    key: '4',
    id: 4,
    name: '视频标注团队',
    description: '负责视频分割和动作识别标注',
    leader: '赵六',
    memberCount: 10,
    projectCount: 15,
    status: 'active',
    createdAt: '2024-02-15',
  },
];

const Teams: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [form] = Form.useForm();

  const getStatusTag = (status: string) => {
    return status === 'active' 
      ? <Tag color="success">活跃</Tag>
      : <Tag color="default">非活跃</Tag>;
  };

  const handleCreateTeam = () => {
    setEditingTeam(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditTeam = (record: any) => {
    setEditingTeam(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      if (editingTeam) {
        console.log('编辑团队:', values);
        message.success('团队信息更新成功！');
      } else {
        console.log('创建团队:', values);
        message.success('团队创建成功！');
      }
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingTeam(null);
  };

  const handleDeleteTeam = (record: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除团队 "${record.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        console.log('删除团队:', record);
        message.success('团队删除成功！');
      },
    });
  };

  const columns = [
    {
      title: '团队名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: any) => (
        <Space>
          <Avatar 
            icon={<TeamOutlined />} 
            size="small"
            style={{ backgroundColor: '#1890ff' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.description}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '团队负责人',
      dataIndex: 'leader',
      key: 'leader',
      width: 120,
    },
    {
      title: '成员数量',
      dataIndex: 'memberCount',
      key: 'memberCount',
      width: 100,
      render: (count: number) => (
        <Space>
          <UserOutlined />
          {count} 人
        </Space>
      ),
    },
    {
      title: '项目数量',
      dataIndex: 'projectCount',
      key: 'projectCount',
      width: 100,
      render: (count: number) => (
        <Space>
          <ProjectOutlined />
          {count} 个
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
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
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEditTeam(record)}
          >
            编辑
          </Button>
          <Button 
            size="small"
          >
            成员管理
          </Button>
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTeam(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 统计数据
  const stats = {
    totalTeams: mockTeams.length,
    activeTeams: mockTeams.filter(t => t.status === 'active').length,
    totalMembers: mockTeams.reduce((sum, team) => sum + team.memberCount, 0),
    totalProjects: mockTeams.reduce((sum, team) => sum + team.projectCount, 0),
  };

  return (
    <TeamsWrapper>
      <div className="page-header">
        <h1>团队管理</h1>
        <p>管理标注团队，分配项目和成员</p>
      </div>

      {/* 统计卡片 */}
      <div className="stats-section">
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总团队数"
                value={stats.totalTeams}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="活跃团队"
                value={stats.activeTeams}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总成员数"
                value={stats.totalMembers}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总项目数"
                value={stats.totalProjects}
                prefix={<ProjectOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <div className="action-bar">
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleCreateTeam}
        >
          创建团队
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={mockTeams}
          pagination={{
            total: mockTeams.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 团队表单模态框 */}
      <Modal
        title={editingTeam ? '编辑团队' : '创建团队'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText={editingTeam ? '更新' : '创建'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 'active',
          }}
        >
          <Form.Item
            name="name"
            label="团队名称"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input placeholder="请输入团队名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="团队描述"
          >
            <TextArea 
              rows={3} 
              placeholder="请输入团队描述"
            />
          </Form.Item>

          <Form.Item
            name="leader"
            label="团队负责人"
            rules={[{ required: true, message: '请输入团队负责人' }]}
          >
            <Input placeholder="请输入团队负责人姓名" />
          </Form.Item>

          <Form.Item
            name="status"
            label="团队状态"
          >
            <Select>
              <Option value="active">活跃</Option>
              <Option value="inactive">非活跃</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </TeamsWrapper>
  );
};

export default Teams;
