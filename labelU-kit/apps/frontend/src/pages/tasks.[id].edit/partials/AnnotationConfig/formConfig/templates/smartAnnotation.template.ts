import type { FormProps } from 'antd';
import { useTranslation } from '@labelu/i18n';

import { i18n } from '@labelu/i18n';

import type { FancyItemIdentifier } from '@/components/FancyInput/types';

export default [
  {
    field: 'tool',
    key: 'tool',
    type: 'string',
    hidden: true,
    initialValue: 'smartAnnotationTool',
  },
  {
    key: 'config',
    field: 'config',
    type: 'group',
    children: [
      {
        field: 'enabled',
        key: 'enabled',
        type: 'boolean',
        label: i18n.t('enabled'),
        initialValue: true,
      },
      {
        field: 'boxThreshold',
        key: 'boxThreshold',
        type: 'number',
        label: '边界框阈值',
        initialValue: 0.35,
        antProps: {
          min: 0,
          max: 1,
          step: 0.01,
          placeholder: '边界框检测阈值',
        },
        rules: [
          {
            required: true,
            message: '边界框阈值不能为空',
          },
        ],
      },
      {
        field: 'textThreshold',
        key: 'textThreshold',
        type: 'number',
        label: '文本阈值',
        initialValue: 0.25,
        antProps: {
          min: 0,
          max: 1,
          step: 0.01,
          placeholder: '文本检测阈值',
        },
        rules: [
          {
            required: true,
            message: '文本阈值不能为空',
          },
        ],
      },
      {
        field: 'syncRectLabels',
        key: 'syncRectLabels',
        type: 'boolean',
        label: '同步拉框标签',
        initialValue: true,
      },
      {
        field: 'attributes',
        key: 'attributes',
        type: 'list-attribute',
        label: i18n.t('labelConfig'),
        initialValue: [
          {
            color: '#1890ff',
            key: i18n.t('label1'),
            value: 'label-1',
          },
        ],
      },
    ],
  },
] as FancyItemIdentifier[];
