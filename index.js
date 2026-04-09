const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');

// 钢管报价平台
const platforms = [
  {
    name: '兆泰钢铁',
    url: 'https://www.zhaohaogang.com/jiagebiao/zhifenguan'
  },
  {
    name: '1688天津钢管',
    url: 'https://s.1688.com/kq/-CCECBDF2C2DDD0FDB8D6B9DC.html'
  }
];

// 解析用户输入
function parseUserInput(input) {
  const parts = input.split('+');
  if (parts.length !== 2) {
    throw new Error('请使用 品类+规格 的格式输入，例如：直缝焊管+4分217');
  }
  return {
    category: parts[0].trim(),
    specification: parts[1].trim()
  };
}

// 从兆泰钢铁获取价格
async function getPricesFromZhaohaogang(category, specification) {
  try {
    const response = await axios.get(platforms[0].url);
    const $ = cheerio.load(response.data);
    const prices = [];
    
    // 查找包含规格的表格
    $('table').each((i, table) => {
      const tableHeader = $(table).find('th').first().text().trim();
      if (tableHeader.includes(specification)) {
        $(table).find('tr').each((j, row) => {
          const cells = $(row).find('td');
          if (cells.length >= 4) {
            const thickness = cells.eq(0).text().trim();
            const price = cells.eq(3).text().trim();
            if (thickness && price) {
              prices.push({
                platform: platforms[0].name,
                category: category,
                specification: `${specification} ${thickness}`,
                price: parseFloat(price),
                url: platforms[0].url
              });
            }
          }
        });
      }
    });
    
    return prices;
  } catch (error) {
    console.error('获取兆泰钢铁价格失败:', error.message);
    return [];
  }
}

// 从1688获取价格
async function getPricesFrom1688(category, specification) {
  try {
    const response = await axios.get(platforms[1].url);
    const $ = cheerio.load(response.data);
    const prices = [];
    
    // 查找产品列表
    $('.offer-list-item').each((i, item) => {
      const title = $(item).find('.title').text().trim();
      const priceText = $(item).find('.price').text().trim();
      
      if (title.includes(category) && title.includes(specification)) {
        const priceMatch = priceText.match(/¥(\d+(?:\.\d+)?)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1]);
          prices.push({
            platform: platforms[1].name,
            category: category,
            specification: specification,
            price: price,
            url: platforms[1].url
          });
        }
      }
    });
    
    return prices;
  } catch (error) {
    console.error('获取1688价格失败:', error.message);
    return [];
  }
}

// 主函数
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('请输入钢管品类和规格（格式：品类+规格）：', async (input) => {
    try {
      const { category, specification } = parseUserInput(input);
      
      console.log(`正在查询 ${category} ${specification} 的最新报价...`);
      
      // 并行获取所有平台的价格
      const [zhaogangPrices, alibabaPrices] = await Promise.all([
        getPricesFromZhaohaogang(category, specification),
        getPricesFrom1688(category, specification)
      ]);
      
      // 合并价格并排序
      const allPrices = [...zhaogangPrices, ...alibabaPrices];
      allPrices.sort((a, b) => a.price - b.price);
      
      // 展示前5条最低价格
      console.log('\n=== 最新报价（从低到高）===');
      const top5Prices = allPrices.slice(0, 5);
      
      if (top5Prices.length === 0) {
        console.log('未找到相关报价');
      } else {
        top5Prices.forEach((price, index) => {
          console.log(`${index + 1}. ${price.platform} - ${price.specification}: ¥${price.price}`);
          console.log(`   链接: ${price.url}`);
        });
      }
    } catch (error) {
      console.error('错误:', error.message);
    } finally {
      rl.close();
    }
  });
}

// 运行主函数
main();