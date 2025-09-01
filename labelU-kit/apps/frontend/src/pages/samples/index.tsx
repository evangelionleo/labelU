import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Popconfirm, Typography, Card, Row, Col, Statistic } from 'antd';
import { DownloadOutlined, DeleteOutlined, FileTextOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from '@labelu/i18n';
import { FlexLayout } from '@labelu/components-react';

import { getExportFiles, downloadExportFile, deleteExportFile, ExportFileInfo } from '@/api/services/exportManagement';

const { Title, Text } = Typography;

const SamplesManagement: React.FC = () => {
  const [exportFiles, setExportFiles] = useState<ExportFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<ExportFileInfo | null>(null);
  const { t } = useTranslation();

  // 获取导出文件列表
  const fetchExportFiles = async (page: number = 1, pageSize: number = 20) => {
    try {
      setLoading(true);
      const response = await getExportFiles(page, pageSize);
      setExportFiles(response.data);
      setPagination({
        current: response.page + 1,
        pageSize: response.size,
        total: response.total,
      });
    } catch (error) {
      console.error('获取导出文件列表失败:', error);
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportFiles();
  }, []);

  // 下载文件
  const handleDownload = async (file: ExportFileInfo) => {
    try {
      const blob = await downloadExportFile(file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error('下载文件失败');
    }
  };

  // 删除文件
  const handleDelete = async (fileId: number) => {
    try {
      await deleteExportFile(fileId);
      message.success('文件删除成功');
      fetchExportFiles(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('删除文件失败:', error);
      message.error('删除文件失败');
    }
  };

  // 预览文件
  const handlePreview = (file: ExportFileInfo) => {
    setPreviewFile(file);
    setPreviewVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '文件名称',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => (
        <Text strong>{text}</Text>
      ),
    },
    {
      title: '导出格式',
      dataIndex: 'exportType',
      key: 'exportType',
      render: (text: string) => (
        <Text code>{text}</Text>
      ),
    },
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      render: (size: number) => {
        const formatSize = (bytes: number) => {
          if (bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };
        return formatSize(size);
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: ExportFileInfo) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
            size="small"
          >
            预览
          </Button>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            size="small"
          >
            下载
          </Button>
          <Popconfirm
            title="确定要删除这个文件吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 分页处理
  const handleTableChange = (pagination: any) => {
    fetchExportFiles(pagination.current, pagination.pageSize);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>样本管理</Title>
      
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总文件数"
              value={pagination.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="JSON格式"
              value={exportFiles.filter(f => f.exportType === 'JSON').length}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="COCO格式"
              value={exportFiles.filter(f => f.exportType === 'COCO').length}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="其他格式"
              value={exportFiles.filter(f => !['JSON', 'COCO'].includes(f.exportType)).length}
            />
          </Card>
        </Col>
      </Row>

      {/* 文件列表 */}
      <Card title="导出文件列表">
        <Table
          columns={columns}
          dataSource={exportFiles}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* 预览模态框 */}
      <Modal
        title={`预览文件: ${previewFile?.fileName}`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => previewFile && handleDownload(previewFile)}>
            下载
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {previewFile && (
          <div>
            <p><strong>文件名称:</strong> {previewFile.fileName}</p>
            <p><strong>导出格式:</strong> {previewFile.exportType}</p>
            <p><strong>任务名称:</strong> {previewFile.taskName}</p>
            <p><strong>创建时间:</strong> {new Date(previewFile.createdAt).toLocaleString()}</p>
            <p><strong>文件大小:</strong> {previewFile.fileSize} bytes</p>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                文件预览功能正在开发中，您可以点击下载按钮下载文件查看内容。
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SamplesManagement;
