import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Space, Tag, Form, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from '@labelu/i18n';

import { getSample, updateSample } from '@/api/services/samples';
import type { SampleResponse } from '@/api/types';

const { TextArea } = Input;

const Container = styled.div`
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
`;

const TextCard = styled(Card)`
  margin-bottom: 20px;
`;

const AnnotationArea = styled.div`
  margin-top: 20px;
`;

const TagContainer = styled.div`
  margin: 10px 0;
`;

const TextAnnotation: React.FC = () => {
  const { taskId, sampleId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  
  const [sample, setSample] = useState<SampleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (taskId && sampleId) {
      loadSample();
    }
  }, [taskId, sampleId]);

  const loadSample = async () => {
    try {
      setLoading(true);
      const response = await getSample(Number(taskId), Number(sampleId));
      setSample(response.data);
      
      // 如果有现有标注结果，加载到表单
      if (response.data.data?.result) {
        try {
          const result = JSON.parse(response.data.data.result);
          if (result.textTool?.result) {
            const textAnnotations: Record<string, string> = {};
            result.textTool.result.forEach((item: any) => {
              Object.entries(item.value || {}).forEach(([key, value]) => {
                textAnnotations[key] = value as string;
              });
            });
            setAnnotations(textAnnotations);
            form.setFieldsValue(textAnnotations);
          }
        } catch (e) {
          console.error('Failed to parse existing annotations:', e);
        }
      }
    } catch (error) {
      message.error(t('loadSampleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // 构建标注结果
      const result = {
        textTool: {
          toolName: 'textTool',
          result: [
            {
              id: 'text-annotation-1',
              type: 'text',
              value: values
            }
          ]
        }
      };

      await updateSample(Number(taskId), Number(sampleId), {
        data: {
          result: JSON.stringify(result)
        },
        state: 'DONE'
      });

      message.success(t('saveSuccess'));
      setAnnotations(values);
    } catch (error) {
      message.error(t('saveFailed'));
    }
  };

  const handleSkip = async () => {
    try {
      await updateSample(Number(taskId), Number(sampleId), {
        state: 'SKIPPED'
      });
      message.success(t('skipSuccess'));
      navigate(`/tasks/${taskId}`);
    } catch (error) {
      message.error(t('skipFailed'));
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!sample) {
    return <div>Sample not found</div>;
  }

  return (
    <Container>
      <TextCard title={t('textContent')}>
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace'
        }}>
          {sample.data?.data || 'No text content available'}
        </div>
      </TextCard>

      <Card title={t('textAnnotation')}>
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('sentiment')}
            name="sentiment"
            rules={[{ required: true, message: t('sentimentRequired') }]}
          >
            <Input placeholder={t('enterSentiment')} />
          </Form.Item>

          <Form.Item
            label={t('category')}
            name="category"
            rules={[{ required: true, message: t('categoryRequired') }]}
          >
            <Input placeholder={t('enterCategory')} />
          </Form.Item>

          <Form.Item
            label={t('summary')}
            name="summary"
          >
            <TextArea 
              rows={4} 
              placeholder={t('enterSummary')}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            label={t('keywords')}
            name="keywords"
          >
            <Input placeholder={t('enterKeywords')} />
          </Form.Item>
        </Form>

        <AnnotationArea>
          <Space>
            <Button type="primary" onClick={handleSave}>
              {t('save')}
            </Button>
            <Button onClick={handleSkip}>
              {t('skip')}
            </Button>
          </Space>
        </AnnotationArea>

        {Object.keys(annotations).length > 0 && (
          <TagContainer>
            <h4>{t('currentAnnotations')}:</h4>
            {Object.entries(annotations).map(([key, value]) => (
              <Tag key={key} color="blue">
                {key}: {value}
              </Tag>
            ))}
          </TagContainer>
        )}
      </Card>
    </Container>
  );
};

export default TextAnnotation;
