import { Modal, Select, Input, Checkbox, Space, Typography } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { FlexLayout } from '@labelu/components-react';
import { i18n, useTranslation } from '@labelu/i18n';
import { message } from 'antd';

import { ExportType, MediaType } from '@/api/types';
import { outputSample, outputSamples } from '@/api/services/samples';
import { saveExportToSamples } from '@/api/services/exportManagement';
import { EGlobalToolName, ImageToolName } from '@/enums';

const { Text } = Typography;

export interface ExportPortalProps {
  children: React.ReactChild;
  taskId: number;
  mediaType: MediaType | undefined;
  sampleIds?: number[];
  tools?: any[];
}

export const exportDescriptionMapping = {
  [ExportType.JSON]: i18n.t('formatJsonDescription'),
  [ExportType.CSV]: i18n.t('formatCsvDescription'),
  [ExportType.XML]: i18n.t('formatXmlDescription'),
  [ExportType.COCO]: i18n.t('formatCocoDescription'),
  [ExportType.MASK]: i18n.t('formatMaskDescription'),
  [ExportType.YOLO]: i18n.t('formatYoloDescription'),
  [ExportType.LABEL_ME]: i18n.t('formatLabelmeDescription'),
  [ExportType.TF_RECORD]: i18n.t('formatTFRecordDescription'),
  [ExportType.PASCAL_VOC]: i18n.t('formatPascalVocDescription'),
};

const optionMapping = {
  [ExportType.JSON]: {
    label: ExportType.JSON,
    value: ExportType.JSON,
  },
  [ExportType.XML]: {
    label: ExportType.XML,
    value: ExportType.XML,
  },
  [ExportType.CSV]: {
    label: ExportType.CSV,
    value: ExportType.CSV,
  },
  [ExportType.YOLO]: {
    label: ExportType.YOLO,
    value: ExportType.YOLO,
  },
  [ExportType.COCO]: {
    label: ExportType.COCO,
    value: ExportType.COCO,
  },
  [ExportType.PASCAL_VOC]: {
    label: ExportType.PASCAL_VOC,
    value: ExportType.PASCAL_VOC,
  },
  [ExportType.MASK]: {
    label: ExportType.MASK,
    value: ExportType.MASK,
  },
  [ExportType.LABEL_ME]: {
    label: 'Labelme' as any,
    value: ExportType.LABEL_ME,
  },
  [ExportType.TF_RECORD]: {
    label: 'TF Record' as any,
    value: ExportType.TF_RECORD,
  },
};

function isIncludeCoco(tools?: any[]) {
  if (!tools) {
    return false;
  }

  // coco 包含 rect 和 polygon、point
  return !tools.some((item) => [ImageToolName.Cuboid, ImageToolName.Line, ImageToolName.Point].includes(item.tool));
}

export default function ExportPortal({ taskId, sampleIds, mediaType, tools, children }: ExportPortalProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [exportType, setExportType] = useState<ExportType>(ExportType.JSON);
  const [saveToSamples, setSaveToSamples] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const { t } = useTranslation();

  const handleOpenModal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleOptionChange = (value: ExportType) => {
    setExportType(value);
  };

  const handleExport = useCallback(async () => {
    try {
      console.log('开始导出，参数:', {
        taskId,
        sampleIds,
        exportType,
        saveToSamples,
        exportFileName
      });

      let exportData;
      
      if (!sampleIds) {
        console.log('执行全量导出');
        exportData = await outputSamples(taskId, exportType);
      } else {
        console.log('执行选中样本导出，样本ID:', sampleIds);
        exportData = await outputSample(taskId, sampleIds, exportType);
      }

      console.log('导出数据获取成功:', exportData);

      // 如果选择保存到样本管理
      if (saveToSamples && exportFileName.trim()) {
        console.log('准备保存到样本管理:', {
          taskId,
          exportType,
          fileName: exportFileName.trim()
        });
        
        try {
          const saveResult = await saveExportToSamples(taskId, exportType, exportFileName.trim(), exportData);
          console.log('保存到样本管理结果:', saveResult);
          
          if (saveResult.success) {
            message.success('导出文件已成功保存到样本管理！');
          } else {
            message.warning(`导出成功，但保存到样本管理失败: ${saveResult.message}`);
          }
        } catch (saveError) {
          console.error('保存到样本管理失败:', saveError);
          message.warning('导出成功，但保存到样本管理失败');
        }
      } else {
        message.success('导出成功！');
      }

      setTimeout(() => {
        setModalVisible(false);
        // 重置状态
        setSaveToSamples(false);
        setExportFileName('');
      });
    } catch (error) {
      console.error('导出失败:', error);
      message.error(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }, [exportType, sampleIds, taskId, saveToSamples, exportFileName]);

  const plainChild = useMemo(() => {
    if (
      children === null ||
      children === undefined ||
      typeof children === 'boolean' ||
      !React.isValidElement(children)
    ) {
      return null;
    }

    if (typeof children === 'string' || typeof children === 'number') {
      return <span onClick={handleOpenModal}>{children}</span>;
    }

    return React.cloneElement(React.Children.only(children), {
      // @ts-ignore
      onClick: handleOpenModal,
    });
  }, [children, handleOpenModal]);

  const options = useMemo(() => {
    const toolsWithoutTagAndText = tools?.filter(
      (item) => ![EGlobalToolName.Text, EGlobalToolName.Tag].includes(item.tool),
    );
    const result = [optionMapping[ExportType.JSON], optionMapping[ExportType.XML]];

    if (!mediaType) {
      return result;
    }

    const onlyPolygonTool = toolsWithoutTagAndText?.length === 1 && toolsWithoutTagAndText[0].tool === 'polygonTool';
    const onlyRectTool = toolsWithoutTagAndText?.length === 1 && toolsWithoutTagAndText[0].tool === 'rectTool';
    const onlyPointTool = toolsWithoutTagAndText?.length === 1 && toolsWithoutTagAndText[0].tool === 'pointTool';
    const onlyCuboidTool = toolsWithoutTagAndText?.length === 1 && toolsWithoutTagAndText[0].tool === 'cuboidTool';
    const onlyLineTool = toolsWithoutTagAndText?.length === 1 && toolsWithoutTagAndText[0].tool === 'lineTool';

    if (mediaType === MediaType.IMAGE) {
      result.push(optionMapping[ExportType.TF_RECORD]);

      if (onlyPolygonTool || onlyRectTool || onlyPointTool || onlyCuboidTool || onlyLineTool) {
        result.push(optionMapping[ExportType.CSV]);
      }

      if (isIncludeCoco(toolsWithoutTagAndText)) {
        result.push(optionMapping[ExportType.COCO]);
      }

      if (onlyRectTool) {
        result.push(optionMapping[ExportType.YOLO], optionMapping[ExportType.PASCAL_VOC]);
      }

      // mask: polygon
      if (onlyPolygonTool) {
        result.push(optionMapping[ExportType.MASK]);
      }

      if (!toolsWithoutTagAndText?.find((item) => ['cuboidTool'].includes(item.tool))) {
        result.push(optionMapping[ExportType.LABEL_ME] as any);
      }
    }

    return result;
  }, [mediaType, tools]);

  return (
    <>
      {plainChild}
      <Modal
        title={t('selectExportFormat')}
        okText={t('doExport')}
        onOk={handleExport}
        onCancel={handleCloseModal}
        open={modalVisible}
        width={600}
      >
        <FlexLayout flex="column" gap="1rem">
          <FlexLayout.Header items="center" gap="1rem" flex>
            <span style={{ whiteSpace: 'nowrap' }}>{t('exportFormat')}</span>
            <Select popupMatchSelectWidth={false} options={options} onChange={handleOptionChange} value={exportType} />
          </FlexLayout.Header>
          
          <div>{exportDescriptionMapping[exportType]}</div>
          
          {/* 保存到样本管理选项 */}
          <Space direction="vertical" style={{ width: '100%' }}>
            <Checkbox 
              checked={saveToSamples} 
              onChange={(e) => setSaveToSamples(e.target.checked)}
            >
              <Text strong>保存到样本管理</Text>
            </Checkbox>
            
            {saveToSamples && (
              <div style={{ marginLeft: 24 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  请输入导出文件名称：
                </Text>
                <Input
                  placeholder="请输入文件名称"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  style={{ width: '100%' }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  导出的文件将保存到样本管理页面，可以在样本管理中查看和下载
                </Text>
              </div>
            )}
          </Space>
        </FlexLayout>
      </Modal>
    </>
  );
}
