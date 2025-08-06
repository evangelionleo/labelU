// 简单的翻译功能测试
import { smartTranslate, containsChinese, detectLanguage } from './translation.js';

async function testTranslation() {
  console.log('🧪 开始测试翻译功能（修复版）...');
  console.log('🎯 重点测试: "人" 应该翻译为 "person." 而不是 "Pemain."');
  
  // 测试用例 - 测试自动添加句号功能
  const testCases = [
    // 单个中文词
    '人',
    '人物', 
    '汽车',
    '狗',
    
    // 多个中文词（空格分隔）
    '人 汽车 狗',
    '人物 汽车 狗 建筑物',
    
    // 多个中文词（句号分隔）
    '人. 汽车. 狗.',
    '人物. 汽车. 狗. 建筑物.',
    
    // 单个英文词（测试自动添加句号）
    'person',
    'car',
    'man',
    
    // 多个英文词（空格分隔）
    'person car dog',
    'man woman child',
    
    // 多个英文词（句号分隔）
    'person. car. dog.',
    'man. woman. child.',
    
    // 已有句号的情况
    'person.',
    'car.',
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📝 测试输入: "${testCase}"`);
    console.log(`🔍 包含中文: ${containsChinese(testCase)}`);
    console.log(`🌐 语言检测: ${detectLanguage(testCase)}`);
    
    try {
      const result = await smartTranslate(testCase);
      console.log(`✅ 翻译结果:`, result);
      console.log(`🎯 最终文本: "${result.translatedText}"`);
      console.log(`📍 以句号结尾: ${result.translatedText.endsWith('.')}`);
    } catch (error) {
      console.error(`❌ 翻译失败:`, error);
    }
  }
  
  console.log('\n🎉 翻译功能测试完成！');
}

// 在浏览器控制台中运行
if (typeof window !== 'undefined') {
  window.testTranslation = testTranslation;
  console.log('💡 在浏览器控制台中运行 testTranslation() 来测试翻译功能');
}

export { testTranslation };