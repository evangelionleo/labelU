import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import { 
  Button, 
  Card, 
  Space, 
  Typography, 
  message, 
  Spin,
  Empty,
  Pagination,
  Tooltip
} from 'antd';
import { 
  LeftOutlined, 
  RightOutlined, 
  FileTextOutlined,
  QuestionCircleOutlined,
  EditOutlined,
  SaveOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { FlexLayout } from '@labelu/components-react';
import { useTranslation } from '@labelu/i18n';
import _ from 'lodash-es';

import type { TaskLoaderResult } from '@/loaders/task.loader';
import { MediaType } from '@/api/types';
import {
  PageContainer,
  HeaderSection,
  PDFViewerContainer,
  PDFCanvas,
  ControlPanel,
  NavigationButtons,
  FileNavigation,
  QAPanel,
  QACard,
  StyledInput,
  StyledTextarea,
  StyledSelect,
  FieldContainer,
  FieldLabel,
  FieldValue,
  FieldAttributesRow,
  AttributeItem,
  ActionButtons,
  SaveButton,
  EditButton,
  DeleteButton,
  PageInfo,
  FileInfo,
  EmptyContainer,
  LoadingContainer
} from './style';

const { Title, Text } = Typography;

const QAGenerationPage = () => {
  const { t } = useTranslation();
  const routeParams = useParams();
  const taskId = routeParams.taskId;
  const routerData = useRouteLoaderData('task') as TaskLoaderResult;
  
  const task = routerData.task;
  const samples = routerData.samples?.data || [];
  const preAnnotations = routerData.preAnnotations?.data || [];
  
  // 状态管理
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [qaList, setQaList] = useState<any[]>([]);
  
  // 合并所有文件（预标注文件和样本文件）
  const allFiles = useMemo(() => {
    const files: any[] = [];
    
    // 添加预标注文件
    if (preAnnotations && preAnnotations.length > 0) {
      files.push(...preAnnotations);
    }
    
    // 添加样本文件
    if (samples && samples.length > 0) {
      files.push(...samples);
    }
    
    return files;
  }, [preAnnotations, samples]);
  
  // 当前文件
  const currentFile = useMemo(() => {
    return (allFiles[currentFileIndex] as any) || null;
  }, [allFiles, currentFileIndex]);
  
  // 检查是否为问答对生成任务
  const isQAGenerationTask = useMemo(() => {
    return task?.config?.tools?.some((tool: any) => tool.tool === 'qaGenerationTool');
  }, [task?.config?.tools]);
  
  // 检查任务媒体类型
  const isTextTask = useMemo(() => {
    return task?.media_type === MediaType.TEXT;
  }, [task?.media_type]);
  
  // 初始化QA列表
  useEffect(() => {
    if (currentFile && isQAGenerationTask) {
      // 从文件数据中提取现有的QA对
      const existingQA = (currentFile as any)?.data?.result?.qaGenerationTool?.result || [];
      setQaList(existingQA);
      
      // 模拟PDF页数（实际应该从PDF文件获取）
      setTotalPages((currentFile as any)?.data?.meta_data?.total_pages || 10);
    }
  }, [currentFile, isQAGenerationTask]);
  
  // 文件切换处理
  const handleFileChange = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
      setCurrentPage(1); // 重置页码
    } else if (direction === 'next' && currentFileIndex < allFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      setCurrentPage(1); // 重置页码
    }
  }, [currentFileIndex, allFiles.length]);
  
  // 页面切换处理
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);
  
  // 添加新的QA对
  const handleAddQA = useCallback(() => {
    const newQA = {
      id: Date.now(),
      question: '',
      answer: '',
      questionType: 'general',
      difficulty: 'medium',
      page: currentPage,
      isEditing: true
    };
    setQaList(prev => [...prev, newQA]);
  }, [currentPage]);
  
  // 保存QA对
  const handleSaveQA = useCallback((qaId: number) => {
    setQaList(prev => prev.map(qa => 
      qa.id === qaId ? { ...qa, isEditing: false } : qa
    ));
    message.success('QA对保存成功');
  }, []);
  
  // 删除QA对
  const handleDeleteQA = useCallback((qaId: number) => {
    setQaList(prev => prev.filter(qa => qa.id !== qaId));
    message.success('QA对删除成功');
  }, []);
  
  // 更新QA对内容
  const handleQAChange = useCallback((qaId: number, field: string, value: any) => {
    setQaList(prev => prev.map(qa => 
      qa.id === qaId ? { ...qa, [field]: value } : qa
    ));
  }, []);
  
  // 渲染PDF内容（模拟）
  const renderPDFContent = () => {
    if (!currentFile) {
      return (
        <EmptyContainer>
          <Empty 
            description="没有可用的文件" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </EmptyContainer>
      );
    }
    
    return (
      <FileInfo>
        <FileTextOutlined style={{ fontSize: '4rem', color: '#d9d9d9', marginBottom: '1rem' }} />
        <div>
          <Text strong style={{ fontSize: '1.2rem' }}>
            {currentFile.filename || currentFile.file?.filename || '未命名文件'}
          </Text>
        </div>
        <PageInfo>
          <Text type="secondary">
            第 {currentPage} 页 / 共 {totalPages} 页
          </Text>
        </PageInfo>
        <div style={{ 
          padding: '2rem', 
          border: '1px solid #d9d9d9', 
          borderRadius: '8px',
          background: '#fafafa'
        }}>
          <Text type="secondary">
            这里是PDF第 {currentPage} 页的内容预览
          </Text>
          <br />
          <Text type="secondary">
            实际使用时，这里应该显示真实的PDF页面内容
          </Text>
        </div>
      </FileInfo>
    );
  };
  
  // 渲染QA列表
  const renderQAList = () => {
    if (!isQAGenerationTask) {
      return (
        <EmptyContainer>
          <Empty 
            description="当前任务不是问答对生成任务" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </EmptyContainer>
      );
    }
    
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <Title level={4} style={{ margin: 0 }}>
            <QuestionCircleOutlined style={{ marginRight: '0.5rem' }} />
            问答对列表
          </Title>
          <Button type="primary" onClick={handleAddQA}>
            添加问答对
          </Button>
        </div>
        
        {qaList.length === 0 ? (
          <EmptyContainer>
            <Empty 
              description="暂无问答对，点击上方按钮添加" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </EmptyContainer>
        ) : (
          qaList.map(qa => (
            <QACard
              key={qa.id}
              title={`问答对 #${qa.id}`}
              extra={
                <ActionButtons>
                  {qa.isEditing ? (
                    <SaveButton 
                      type="primary" 
                      size="small" 
                      icon={<SaveOutlined />}
                      onClick={() => handleSaveQA(qa.id)}
                    >
                      保存
                    </SaveButton>
                  ) : (
                    <EditButton 
                      size="small" 
                      icon={<EditOutlined />}
                      onClick={() => handleQAChange(qa.id, 'isEditing', true)}
                    >
                      编辑
                    </EditButton>
                  )}
                  <DeleteButton 
                    danger 
                    size="small" 
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteQA(qa.id)}
                  >
                    删除
                  </DeleteButton>
                </ActionButtons>
              }
            >
              <FieldContainer>
                <FieldLabel>问题：</FieldLabel>
                {qa.isEditing ? (
                  <StyledInput
                    type="text"
                    value={qa.question}
                    onChange={(e) => handleQAChange(qa.id, 'question', e.target.value)}
                    placeholder="请输入问题"
                  />
                ) : (
                  <FieldValue>
                    {qa.question || '未设置问题'}
                  </FieldValue>
                )}
              </FieldContainer>
              
              <FieldContainer>
                <FieldLabel>答案：</FieldLabel>
                {qa.isEditing ? (
                  <StyledTextarea
                    value={qa.answer}
                    onChange={(e) => handleQAChange(qa.id, 'answer', e.target.value)}
                    placeholder="请输入答案"
                  />
                ) : (
                  <FieldValue minHeight="80px">
                    {qa.answer || '未设置答案'}
                  </FieldValue>
                )}
              </FieldContainer>
              
              <FieldAttributesRow>
                <AttributeItem>
                  <Text strong>问题类型：</Text>
                  {qa.isEditing ? (
                    <StyledSelect
                      value={qa.questionType}
                      onChange={(e) => handleQAChange(qa.id, 'questionType', e.target.value)}
                    >
                      <option value="general">一般问题</option>
                      <option value="multiple_choice">选择题</option>
                      <option value="true_false">判断题</option>
                      <option value="fill_blank">填空题</option>
                    </StyledSelect>
                  ) : (
                    <Text>
                      {qa.questionType === 'general' ? '一般问题' : 
                       qa.questionType === 'multiple_choice' ? '选择题' :
                       qa.questionType === 'true_false' ? '判断题' : '填空题'}
                    </Text>
                  )}
                </AttributeItem>
                
                <AttributeItem>
                  <Text strong>难度等级：</Text>
                  {qa.isEditing ? (
                    <StyledSelect
                      value={qa.difficulty}
                      onChange={(e) => handleQAChange(qa.id, 'difficulty', e.target.value)}
                    >
                      <option value="easy">简单</option>
                      <option value="medium">中等</option>
                      <option value="hard">困难</option>
                    </StyledSelect>
                  ) : (
                    <Text>
                      {qa.difficulty === 'easy' ? '简单' : 
                       qa.difficulty === 'medium' ? '中等' : '困难'}
                    </Text>
                  )}
                </AttributeItem>
                
                <AttributeItem>
                  <Text strong>页码：</Text>
                  <Text>{qa.page}</Text>
                </AttributeItem>
              </FieldAttributesRow>
            </QACard>
          ))
        )}
      </div>
    );
  };
  
  // 检查任务类型
  if (!isQAGenerationTask || !isTextTask) {
    return (
      <PageContainer>
        <HeaderSection>
          <EmptyContainer>
            <Empty 
              description="当前任务不支持问答对生成功能" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </EmptyContainer>
        </HeaderSection>
      </PageContainer>
    );
  }
  
  return (
    <PageContainer>
      {/* 页面头部 */}
      <HeaderSection>
        <FlexLayout items="center" justify="space-between">
          <div>
            <Title level={3} style={{ margin: 0 }}>
              问答对生成任务
            </Title>
            <Text type="secondary">
              任务ID: {taskId} | 文件总数: {allFiles.length}
            </Text>
          </div>
          <Space>
            <Button type="primary" icon={<SaveOutlined />}>
              保存所有更改
            </Button>
          </Space>
        </FlexLayout>
      </HeaderSection>
      
      {/* PDF查看器 */}
      <PDFViewerContainer>
        <Title level={4} style={{ marginBottom: '1rem' }}>
          PDF文档查看
        </Title>
        
        <PDFCanvas>
          {loading ? (
            <LoadingContainer>
              <Spin size="large" />
            </LoadingContainer>
          ) : (
            renderPDFContent()
          )}
        </PDFCanvas>
        
        <ControlPanel>
          <NavigationButtons>
            <Tooltip title="上一页">
              <Button 
                icon={<LeftOutlined />} 
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
              />
            </Tooltip>
            
            <Pagination
              current={currentPage}
              total={totalPages}
              pageSize={1}
              showSizeChanger={false}
              showQuickJumper
              onChange={handlePageChange}
              showTotal={(total, range) => `第 ${range[0]}-${range[1]} 页，共 ${total} 页`}
            />
            
            <Tooltip title="下一页">
              <Button 
                icon={<RightOutlined />} 
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              />
            </Tooltip>
          </NavigationButtons>
          
          <FileNavigation>
            <Text>
              文件 {currentFileIndex + 1} / {allFiles.length}
            </Text>
            <Button 
              icon={<LeftOutlined />} 
              disabled={currentFileIndex <= 0}
              onClick={() => handleFileChange('prev')}
            >
              上一个文件
            </Button>
            <Button 
              icon={<RightOutlined />} 
              disabled={currentFileIndex >= allFiles.length - 1}
              onClick={() => handleFileChange('next')}
            >
              下一个文件
            </Button>
          </FileNavigation>
        </ControlPanel>
      </PDFViewerContainer>
      
      {/* QA面板 */}
      <QAPanel>
        {renderQAList()}
      </QAPanel>
    </PageContainer>
  );
};

export default QAGenerationPage;
