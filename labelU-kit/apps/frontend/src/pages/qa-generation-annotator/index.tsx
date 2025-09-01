import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Upload, message, Typography, Space, Divider } from 'antd';
import { UploadOutlined, FileTextOutlined, FilePdfOutlined, FileImageOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const Container = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const FilePreviewCard = styled(Card)`
  margin-top: 16px;
  .ant-card-body {
    padding: 16px;
  }
`;

const QAGenerationAnnotator: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [fileList, setFileList] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 文件上传配置
  const uploadProps = {
    name: 'file',
    multiple: true,
    fileList: fileList,
    beforeUpload: (file: any) => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      
      if (!isImage && !isPdf) {
        message.error('只能上传图片或PDF文件！');
        return false;
      }
      
      const isLt100M = file.size / 1024 / 1024 < 100;
      if (!isLt100M) {
        message.error('文件大小不能超过100MB！');
        return false;
      }
      
      // 如果是PDF，只取第一页作为预览
      if (isPdf) {
        setFileType('pdf');
        // 这里应该使用PDF.js或其他库来提取第一页
        // 暂时使用占位符
        setPreviewImage('/placeholder-pdf.png');
      } else {
        setFileType('image');
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
      
      setFileList(prev => [...prev, file]);
      return false; // 阻止自动上传
    },
    onRemove: (file: any) => {
      setFileList(prev => prev.filter(item => item.uid !== file.uid));
      if (fileList.length === 1) {
        setPreviewImage(null);
        setFileType(null);
      }
    },
  };

  const handleStartAnnotation = () => {
    if (fileList.length === 0) {
      message.error('请先上传文件');
      return;
    }
    
    setIsProcessing(true);
    // 这里应该跳转到实际的标注页面
    message.success('开始问答对生成标注');
    setIsProcessing(false);
  };

  const handleBackToTask = () => {
    navigate(`/tasks/${taskId}/edit`);
  };

  return (
    <Container>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Title level={2}>🔍 问答对生成标注</Title>
            <Text type="secondary">
              任务ID: {taskId} | 支持PDF、Word、图片等格式，系统将自动提取文本内容用于问答对生成
            </Text>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="📁 文件上传" extra={
            <Space>
              <Button onClick={handleBackToTask}>返回任务配置</Button>
            </Space>
          }>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 PDF、Word、图片等格式，单个文件不超过100MB
              </p>
            </Dragger>
            
            <Divider />
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>已上传文件 ({fileList.length}):</Text>
              {fileList.map((file, index) => (
                <div key={file.uid} style={{ 
                  padding: '8px 12px', 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {file.type === 'application/pdf' ? (
                    <FilePdfOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <FileImageOutlined style={{ color: '#1890ff' }} />
                  )}
                  <Text>{file.name}</Text>
                  <Text type="secondary">({(file.size / 1024 / 1024).toFixed(2)} MB)</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="👁️ 文件预览">
            {previewImage ? (
              <div style={{ textAlign: 'center' }}>
                {fileType === 'pdf' ? (
                  <div style={{ 
                    padding: '40px', 
                    border: '2px dashed #d9d9d9', 
                    borderRadius: '8px',
                    backgroundColor: '#fafafa'
                  }}>
                    <FilePdfOutlined style={{ fontSize: '48px', color: '#ff4d4f' }} />
                    <div style={{ marginTop: '16px' }}>
                      <Text strong>PDF文件预览</Text>
                      <br />
                      <Text type="secondary">显示第一页内容</Text>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={previewImage} 
                    alt="预览" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '300px', 
                      objectFit: 'contain',
                      border: '1px solid #d9d9d9',
                      borderRadius: '8px'
                    }} 
                  />
                )}
              </div>
            ) : (
              <div style={{ 
                padding: '40px', 
                border: '2px dashed #d9d9d9', 
                borderRadius: '8px',
                textAlign: 'center',
                backgroundColor: '#fafafa'
              }}>
                <FileTextOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
                <div style={{ marginTop: '16px' }}>
                  <Text type="secondary">暂无预览</Text>
                  <br />
                  <Text type="secondary">请上传文件后查看预览</Text>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card>
            <Space>
              <Button 
                type="primary" 
                size="large"
                icon={<FileTextOutlined />}
                onClick={handleStartAnnotation}
                loading={isProcessing}
                disabled={fileList.length === 0}
              >
                开始问答对生成标注
              </Button>
              <Button 
                size="large"
                onClick={handleBackToTask}
              >
                返回任务配置
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default QAGenerationAnnotator;
