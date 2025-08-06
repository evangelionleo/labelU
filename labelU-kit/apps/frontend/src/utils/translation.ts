/**
 * 翻译工具函数
 */

// 检测文本是否包含中文
export function containsChinese(text: string): boolean {
  const chineseRegex = /[\u4e00-\u9fff]/;
  return chineseRegex.test(text);
}

// 检测输入语言类型
export function detectLanguage(text: string): 'zh' | 'en' {
  return containsChinese(text) ? 'zh' : 'en';
}

// 检查是否完全基于词典翻译（不包含未翻译的中文）
function isFullyTranslated(originalText: string, translatedText: string): boolean {
  // 移除句号进行比较
  const cleanTranslated = translatedText.replace(/\.$/, '');
  
  // 如果翻译结果包含中文，说明没有完全翻译
  if (containsChinese(cleanTranslated)) {
    return false;
  }
  
  // 检查是否为纯英文结果
  const englishRegex = /^[a-zA-Z\s.]+$/;
  return englishRegex.test(cleanTranslated);
}

// 验证英文翻译结果的合理性
function isValidEnglishTranslation(text: string): boolean {
  // 基本英文字符检查
  const englishRegex = /^[a-zA-Z\s.,!?-]+$/;
  if (!englishRegex.test(text)) {
    return false;
  }
  
  // 检查是否包含常见的错误翻译标识
  const invalidPatterns = [
    /^[A-Z][a-z]+an$/, // 类似 "Pemain" 的模式
    /^[A-Z][a-z]*[aeiou]{3,}/, // 包含过多元音的非英文单词
    /^.{15,}$/, // 过长的单词可能是错误翻译
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(text.trim())) {
      return false;
    }
  }
  
  return true;
}

// 翻译函数 - 优先使用本地词典，确保准确性
export async function translateText(text: string, from: string = 'zh', to: string = 'en'): Promise<string> {
  try {
    // 如果文本已经是英文，确保以英文句号结尾（AI检测必需）
    if (from === 'en' || !containsChinese(text)) {
      const trimmed = text.trim();
      return trimmed.endsWith('.') ? trimmed : trimmed + '.';
    }

    // 优先使用本地词典翻译，确保准确性
    const localResult = await fallbackTranslation(text);
    
    // 检查是否是完全基于词典的翻译（不包含未翻译的原文）
    if (isFullyTranslated(text, localResult)) {
      console.log('使用本地词典翻译:', text, '->', localResult);
      return localResult;
    }

    // 只有在本地词典无法完全翻译时才使用在线API
    console.log('本地词典部分翻译，尝试在线API补充...');
    
    try {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.append('q', text);
      url.searchParams.append('langpair', `${from}|${to}`);

      const translateResponse = await fetch(url.toString());
      
      if (!translateResponse.ok) {
        throw new Error(`翻译请求失败: ${translateResponse.status}`);
      }

      const result = await translateResponse.json();
      
      if (result.responseStatus === 200 && result.responseData?.translatedText) {
        const translatedText = result.responseData.translatedText.trim();
        
        // 验证在线翻译结果的合理性
        if (isValidEnglishTranslation(translatedText)) {
          console.log('使用在线API翻译:', text, '->', translatedText);
          return translatedText.endsWith('.') ? translatedText : translatedText + '.';
        } else {
          console.log('在线翻译结果不合理，使用本地翻译:', localResult);
          return localResult;
        }
      } else {
        throw new Error('翻译响应格式错误');
      }
    } catch (apiError) {
      console.log('在线API失败，使用本地翻译:', localResult);
      return localResult;
    }
  } catch (error) {
    console.error('翻译失败:', error);
    return await fallbackTranslation(text);
  }
}

// 扩展的本地词典映射 - 确保高质量翻译
const translationMap: Record<string, string> = {
  // 人物相关
  '人': 'person',
  '人物': 'person', 
  '人员': 'person',
  '男人': 'man',
  '女人': 'woman',
  '孩子': 'child',
  '小孩': 'child',
  '婴儿': 'baby',
  '老人': 'elderly person',
  
  // 交通工具
  '汽车': 'car',
  '车': 'car',
  '车辆': 'car',
  '卡车': 'truck',
  '公交车': 'bus',
  '巴士': 'bus',
  '自行车': 'bicycle',
  '摩托车': 'motorcycle',
  '飞机': 'airplane',
  '火车': 'train',
  '船': 'boat',
  
  // 动物
  '狗': 'dog',
  '狗狗': 'dog',
  '猫': 'cat',
  '猫咪': 'cat',
  '鸟': 'bird',
  '鸟类': 'bird',
  '马': 'horse',
  '牛': 'cow',
  '羊': 'sheep',
  '猪': 'pig',
  '鱼': 'fish',
  
  // 建筑物品
  '建筑': 'building',
  '建筑物': 'building',
  '房子': 'house',
  '房屋': 'house',
  '楼房': 'building',
  '商店': 'shop',
  '学校': 'school',
  '医院': 'hospital',
  
  // 自然物品
  '树': 'tree',
  '树木': 'tree',
  '花': 'flower',
  '花朵': 'flower',
  '草': 'grass',
  '山': 'mountain',
  '河': 'river',
  '湖': 'lake',
  
  // 家具用品
  '桌子': 'table',
  '椅子': 'chair',
  '床': 'bed',
  '沙发': 'sofa',
  '门': 'door',
  '窗户': 'window',
  
  // 电子设备
  '手机': 'phone',
  '电话': 'phone',
  '电脑': 'computer',
  '笔记本': 'laptop',
  '电视': 'television',
  '相机': 'camera',
  
  // 书籍物品
  '书': 'book',
  '书籍': 'book',
  '报纸': 'newspaper',
  '杂志': 'magazine',
  
  // 运动用品
  '球': 'ball',
  '足球': 'soccer ball',
  '篮球': 'basketball',
  '网球': 'tennis ball',
  
  // 食物
  '食物': 'food',
  '水果': 'fruit',
  '蔬菜': 'vegetable',
  '面包': 'bread',
  '蛋糕': 'cake',
};

async function fallbackTranslation(text: string): Promise<string> {
  // 智能分割：优先按句号分隔，如果没有句号则按空格分隔
  let parts: string[] = [];
  
  if (text.includes('.') || text.includes('。')) {
    // 包含句号时按句号分隔
    parts = text.split(/[.。]/);
  } else {
    // 没有句号时按空格分隔
    parts = text.split(/\s+/);
  }
  
  const translatedParts: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // 查找本地词典映射
    const translated = translationMap[trimmed] || trimmed;
    translatedParts.push(translated);
  }

  // 确保所有翻译结果都以英文句号结尾（AI检测必需）
  if (translatedParts.length === 0) {
    const trimmed = text.trim();
    return trimmed.endsWith('.') ? trimmed : trimmed + '.';
  }
  
  if (translatedParts.length === 1) {
    return translatedParts[0] + '.';
  }
  
  // 多个部分时用句号+空格连接，最后确保以句号结尾
  const result = translatedParts.join('. ');
  return result.endsWith('.') ? result : result + '.';
}

// 智能翻译：自动检测语言并翻译
export async function smartTranslate(text: string): Promise<{
  originalText: string;
  translatedText: string;
  language: 'zh' | 'en';
  wasTranslated: boolean;
}> {
  const originalText = text.trim();
  const language = detectLanguage(originalText);
  
  if (language === 'en') {
    return {
      originalText,
      translatedText: originalText,
      language,
      wasTranslated: false,
    };
  }

  try {
    const translatedText = await translateText(originalText, 'zh', 'en');
    return {
      originalText,
      translatedText,
      language,
      wasTranslated: true,
    };
  } catch (error) {
    console.error('智能翻译失败:', error);
    return {
      originalText,
      translatedText: originalText,
      language,
      wasTranslated: false,
    };
  }
}