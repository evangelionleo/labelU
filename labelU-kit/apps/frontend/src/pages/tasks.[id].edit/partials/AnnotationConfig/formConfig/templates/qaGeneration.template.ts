export default {
  commonAttributeConfigurable: false,
  drawOutsideTarget: false,
  tools: [
    {
      tool: 'qaGenerationTool',
      config: {
        textConfigurable: false,
        textCheckType: 0,
        attributes: [
          {
            key: '问题',
            value: 'question',
            type: 'string',
            stringType: 'text',
            required: true,
            defaultValue: '',
            maxLength: 500,
          },
          {
            key: '答案',
            value: 'answer',
            type: 'string',
            stringType: 'text',
            required: true,
            defaultValue: '',
            maxLength: 2000,
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
    },
  ],
};
