import styled from 'styled-components';
import { Card, Button } from 'antd';

// 页面容器
export const PageContainer = styled.div`
  padding: 1.5rem;
  background: #f5f5f5;
  min-height: 100vh;
`;

// 头部区域
export const HeaderSection = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

// PDF查看器容器
export const PDFViewerContainer = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 600px;
  display: flex;
  flex-direction: column;
`;

// PDF画布区域
export const PDFCanvas = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  margin: 1rem 0;
  min-height: 500px;
  position: relative;
  overflow: hidden;
`;

// 控制面板
export const ControlPanel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-top: 1px solid #f0f0f0;
  flex-wrap: wrap;
  gap: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

// 导航按钮组
export const NavigationButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

// 文件导航
export const FileNavigation = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    justify-content: center;
  }
`;

// QA面板
export const QAPanel = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

// QA卡片
export const QACard = styled(Card)`
  margin-bottom: 1rem;
  border: 1px solid #d9d9d9;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .ant-card-head {
    background: #fafafa;
    border-bottom: 1px solid #d9d9d9;
  }
  
  .ant-card-body {
    padding: 1.5rem;
  }
`;

// 输入字段样式
export const StyledInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 14px;
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
  
  &::placeholder {
    color: #bfbfbf;
  }
`;

// 文本域样式
export const StyledTextarea = styled.textarea`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  margin-top: 0.5rem;
  min-height: 80px;
  resize: vertical;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
  
  &::placeholder {
    color: #bfbfbf;
  }
`;

// 选择框样式
export const StyledSelect = styled.select`
  margin-left: 0.5rem;
  padding: 0.25rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  transition: border-color 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #1890ff;
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
`;

// 字段标签容器
export const FieldContainer = styled.div`
  margin-bottom: 1rem;
`;

// 字段标签
export const FieldLabel = styled.div`
  font-weight: 600;
  color: #262626;
  margin-bottom: 0.5rem;
`;

// 字段值显示
export const FieldValue = styled.div<{ minHeight?: string }>`
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
  min-height: ${props => props.minHeight || 'auto'};
  color: #595959;
  line-height: 1.5;
`;

// 字段属性行
export const FieldAttributesRow = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
  }
`;

// 属性项
export const AttributeItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

// 操作按钮组
export const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

// 保存按钮
export const SaveButton = styled(Button)`
  &.ant-btn-primary {
    background: #52c41a;
    border-color: #52c41a;
    
    &:hover {
      background: #73d13d;
      border-color: #73d13d;
    }
  }
`;

// 编辑按钮
export const EditButton = styled(Button)`
  &.ant-btn {
    color: #1890ff;
    border-color: #1890ff;
    
    &:hover {
      color: #40a9ff;
      border-color: #40a9ff;
    }
  }
`;

// 删除按钮
export const DeleteButton = styled(Button)`
  &.ant-btn-dangerous {
    color: #ff4d4f;
    border-color: #ff4d4f;
    
    &:hover {
      color: #ff7875;
      border-color: #ff7875;
    }
  }
`;

// 页面信息显示
export const PageInfo = styled.div`
  text-align: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 1rem 0;
`;

// 文件信息显示
export const FileInfo = styled.div`
  text-align: center;
  padding: 2rem;
`;

// 空状态容器
export const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
`;

// 加载状态容器
export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
`;

// 响应式容器
export const ResponsiveContainer = styled.div`
  @media (max-width: 768px) {
    padding: 1rem;
  }
  
  @media (max-width: 480px) {
    padding: 0.5rem;
  }
`;
