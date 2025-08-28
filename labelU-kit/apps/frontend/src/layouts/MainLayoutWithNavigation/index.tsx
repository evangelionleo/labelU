import { useEffect } from 'react';
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { FlexLayout } from '@labelu/components-react';
import { Layout } from 'antd';

import Navigate from '@/components/Navigate';
import Sidebar from '@/components/Sidebar';

const LayoutWrapper = styled(FlexLayout)`
  min-height: 100vh;
`;

const MainContent = styled(FlexLayout.Content)`
  background-color: #f4f5f7;
`;

const StyledLayout = styled(Layout)`
  min-height: 100vh;
`;

const ContentWrapper = styled(Layout.Content)`
  background-color: #f4f5f7;
  margin: 0;
  padding: 0;
`;

const MainLayout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 标注配置预览不需要导航头部
  const isPreview = searchParams.get('noSave');

  useEffect(() => {
    if (window.IS_ONLINE) {
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <StyledLayout>
      {!isPreview && (
        <FlexLayout.Header>
          <Navigate />
        </FlexLayout.Header>
      )}
      <Layout>
        <Sidebar />
        <ContentWrapper>
          <Outlet />
        </ContentWrapper>
      </Layout>
    </StyledLayout>
  );
};
export default MainLayout;
