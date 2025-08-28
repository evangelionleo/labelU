import React, { useState } from 'react';
import { Layout, Menu, Button, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  TeamOutlined,
  BarChartOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@labelu/i18n';
import styled from 'styled-components';

const { Sider } = Layout;

const StyledSider = styled(Sider)`
  .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
  }
  
  .ant-menu {
    flex: 1;
    border-right: none;
  }
  
  .sidebar-trigger {
    position: absolute;
    top: 16px;
    right: -12px;
    z-index: 10;
    background: #fff;
    border: 1px solid #d9d9d9;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    
    &:hover {
      border-color: #1890ff;
      color: #1890ff;
    }
  }
`;

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // 菜单项配置
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
      children: [
        {
          key: '/dashboard/overview',
          label: '概览',
        },
        {
          key: '/dashboard/analytics',
          label: '数据分析',
        },
      ],
    },
    {
      key: '/tasks',
      icon: <ProjectOutlined />,
      label: '任务大厅',
      children: [
        {
          key: '/tasks',
          label: '全部任务',
        },
        {
          key: '/tasks/0/edit?isNew=true',
          label: '新建任务',
        },
        {
          key: '/tasks/templates',
          label: '任务模板',
        },
      ],
    },
    {
      key: '/samples',
      icon: <FileTextOutlined />,
      label: '样本管理',
      children: [
        {
          key: '/samples/all',
          label: '全部样本',
        },
        {
          key: '/samples/annotated',
          label: '已标注样本',
        },
        {
          key: '/samples/unannotated',
          label: '未标注样本',
        },
      ],
    },
    {
      key: '/pre-annotation',
      icon: <RobotOutlined />,
      label: '预标注任务',
      children: [
        {
          key: '/pre-annotation/tasks',
          label: '预标注任务列表',
        },
        {
          key: '/pre-annotation/create',
          label: '创建预标注任务',
        },
        {
          key: '/pre-annotation/models',
          label: '模型管理',
        },
        {
          key: '/pre-annotation/results',
          label: '预标注结果',
        },
      ],
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
      children: [
        {
          key: '/users/list',
          label: '用户列表',
        },
        {
          key: '/users/roles',
          label: '用户角色',
        },
      ],
    },
    {
      key: '/teams',
      icon: <TeamOutlined />,
      label: '团队管理',
      children: [
        {
          key: '/teams/list',
          label: '团队列表',
        },
        {
          key: '/teams/projects',
          label: '团队项目',
        },
      ],
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: '报表中心',
      children: [
        {
          key: '/reports/progress',
          label: '进度报表',
        },
        {
          key: '/reports/quality',
          label: '质量报表',
        },
        {
          key: '/reports/performance',
          label: '绩效报表',
        },
      ],
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      children: [
        {
          key: '/settings/profile',
          label: '个人设置',
        },
        {
          key: '/settings/system',
          label: '系统设置',
        },
        {
          key: '/settings/security',
          label: '安全设置',
        },
      ],
    },
  ];

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const pathname = location.pathname;
    const selectedKeys: string[] = [];
    
    // 找到匹配的菜单项
    const findSelectedKey = (items: any[]) => {
      for (const item of items) {
        if (item.key === pathname) {
          selectedKeys.push(item.key);
          return true;
        }
        if (item.children) {
          if (findSelectedKey(item.children)) {
            selectedKeys.push(item.key);
            return true;
          }
        }
      }
      return false;
    };
    
    findSelectedKey(menuItems);
    return selectedKeys;
  };

  return (
    <StyledSider 
      trigger={null} 
      collapsible 
      collapsed={collapsed}
      width={240}
      style={{
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
      }}
    >
      <Tooltip 
        title={collapsed ? t('expand') : t('collapse')} 
        placement="right"
      >
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-trigger"
        />
      </Tooltip>
      
      <Menu
        mode="inline"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={collapsed ? [] : ['/dashboard', '/tasks', '/samples']}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </StyledSider>
  );
};

export default Sidebar;
