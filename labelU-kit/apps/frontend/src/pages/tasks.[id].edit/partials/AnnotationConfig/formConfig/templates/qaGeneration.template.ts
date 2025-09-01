import { i18n } from '@labelu/i18n';

import type { FancyItemIdentifier } from '@/components/FancyInput/types';

export default [
  {
    field: 'tool',
    key: 'tool',
    type: 'string',
    hidden: true,
    initialValue: 'qaGenerationTool',
  },
  {
    key: 'config',
    field: 'config',
    type: 'group',
    children: [
      {
        field: 'textConfigurable',
        key: 'textConfigurable',
        type: 'boolean',
        hidden: true,
        initialValue: false,
      },
      {
        field: 'textCheckType',
        key: 'textCheckType',
        type: 'number',
        hidden: true,
        initialValue: 0,
      },
      {
        type: 'category-attribute',
        key: 'field',
        field: 'attributes',
        label: '',
        addStringText: i18n.t('add'),
        disabledStringOptions: ['order'],
        showAddTag: false,
        initialValue: [
          {
            key: '问题',
            value: 'question',
            required: true,
            type: 'string',
            maxLength: 500,
            stringType: 'text',
            defaultValue: '',
          },
          {
            key: '答案',
            value: 'answer',
            required: true,
            type: 'string',
            maxLength: 2000,
            stringType: 'text',
            defaultValue: '',
          },
          {
            key: '问题类型',
            value: 'questionType',
            type: 'enum',
            required: false,
            defaultValue: 'general',
            options: [
              { label: '一般问题', value: 'general' },
              { label: '选择题', value: 'multiple_choice' },
              { label: '判断题', value: 'true_false' },
              { label: '填空题', value: 'fill_blank' },
            ],
          },
          {
            key: '难度等级',
            value: 'difficulty',
            type: 'enum',
            required: false,
            defaultValue: 'medium',
            options: [
              { label: '简单', value: 'easy' },
              { label: '中等', value: 'medium' },
              { label: '困难', value: 'hard' },
            ],
          },
        ],
      },
    ],
  },
] as FancyItemIdentifier[];
