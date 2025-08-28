import React, { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Avatar, message } from 'antd';
import { 
  PlusOutlined, 
  UserOutlined, 
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  LockOutlined
} from '@ant-design/icons';
import styled from 'styled-components';

const { Option } = Select;

const UsersWrapper = styled.div`
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
const mockUsers = [
  {
    key: '1',
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    avatar: null,
    createdAt: '2024-01-01',
    lastLogin: '2024-12-19',
  },
  {
    key: '2',
    id: 2,
    username: '张三',
    email: 'zhangsan@example.com',
    role: 'annotator',
    status: 'active',
    avatar: null,
    createdAt: '2024-01-15',
    lastLogin: '2024-12-18',
  },
  {
    key: '3',
    id: 3,
    username: '李四',
    email: 'lisi@example.com',
    role: 'reviewer',
    status: 'inactive',
    avatar: null,
    createdAt: '2024-02-01',
    lastLogin: '2024-12-10',
  },
  {
    key: '4',
    id: 4,
    username: '王五',
    email: 'wangwu@example.com',
    role: 'annotator',
    status: 'active',
    avatar: null,
    createdAt: '2024-02-15',
    lastLogin: '2024-12-19',
  },
];

const Users: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form] = Form.useForm();

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'admin':
        return <Tag color="red" icon={<LockOutlined />}>管理员</Tag>;
      case 'reviewer':
        return <Tag color="blue" icon={<TeamOutlined />}>审核员</Tag>;
      case 'annotator':
        return <Tag color="green" icon={<UserOutlined />}>标注员</Tag>;
      default:
        return <Tag color="default">{role}</Tag>;
    }
  };

  const getStatusTag = (status: string) => {
    return status === 'active' 
      ? <Tag color="success">活跃</Tag>
      : <Tag color="default">非活跃</Tag>;
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditUser = (record: any) => {
    setEditingUser(record);
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      if (editingUser) {
        console.log('编辑用户:', values);
        message.success('用户信息更新成功！');
      } else {
        console.log('创建用户:', values);
        message.success('用户创建成功！');
      }
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingUser(null);
  };

  const handleDeleteUser = (record: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 "${record.username}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        console.log('删除用户:', record);
        message.success('用户删除成功！');
      },
    });
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 200,
      render: (record: any) => (
        <Space>
          <Avatar 
            icon={<UserOutlined />} 
            src={record.avatar}
            size="small"
          />
          <div>
            <div style={{ fontWeight: 500 }}>{record.username}</div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => getRoleTag(role),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (record: any) => (
        <Space size="small">
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteUser(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <UsersWrapper>
      <div className="page-header">
        <h1>用户管理</h1>
        <p>管理系统用户，分配角色和权限</p>
      </div>

      <div className="action-bar">
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleCreateUser}
        >
          添加用户
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={mockUsers}
          pagination={{
            total: mockUsers.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 用户表单模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={500}
        okText={editingUser ? '更新' : '创建'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            role: 'annotator',
            status: 'active',
          }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱地址" />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择用户角色">
              <Option value="admin">管理员</Option>
              <Option value="reviewer">审核员</Option>
              <Option value="annotator">标注员</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
          >
            <Select>
              <Option value="active">活跃</Option>
              <Option value="inactive">非活跃</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </UsersWrapper>
  );
};

export default Users;
