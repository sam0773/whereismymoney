// 测试XIRR函数的负收益率计算
function calculateXIRR(cashFlows, guess = 0.1) {
    // 最大迭代次数
    const maxIterations = 2000;
    // 放宽收敛阈值，提高收敛性
    const tolerance = 1e-4;
    
    // 至少需要两笔不同的现金流量才能计算XIRR
    if (cashFlows.length < 2) {
        return 0;
    }
    
    // 检查是否有正有负的现金流量
    const hasNegative = cashFlows.some(cf => cf.amount < 0);
    const hasPositive = cashFlows.some(cf => cf.amount > 0);
    if (!hasNegative || !hasPositive) {
        return 0;
    }
    
    // 计算NPV
    const npv = (rate) => {
        return cashFlows.reduce((total, cf) => {
            const daysDiff = Math.ceil((new Date(cf.date) - new Date(cashFlows[0].date)) / (1000 * 60 * 60 * 24));
            return total + cf.amount / Math.pow(1 + rate, daysDiff / 365);
        }, 0);
    };
    
    // 计算NPV的导数
    const npvDerivative = (rate) => {
        return cashFlows.reduce((total, cf) => {
            const daysDiff = Math.ceil((new Date(cf.date) - new Date(cashFlows[0].date)) / (1000 * 60 * 60 * 24));
            return total - (cf.amount * daysDiff / 365) / Math.pow(1 + rate, daysDiff / 365 + 1);
        }, 0);
    };
    
    // 增加更多的初始猜测值，特别是负值区域，确保负收益率能被正确计算
    const initialGuesses = [0.1, -0.1, 0.5, -0.5, 0, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -0.9];
    
    for (const initialGuess of initialGuesses) {
        let rate = initialGuess;
        let iteration = 0;
        let npvValue = npv(rate);
        
        // 使用牛顿迭代法求解
        while (Math.abs(npvValue) > tolerance && iteration < maxIterations) {
            const derivative = npvDerivative(rate);
            if (derivative === 0) break;
            
            rate = rate - npvValue / derivative;
            npvValue = npv(rate);
            iteration++;
        }
        
        // 检查是否收敛到合理值
        if (Math.abs(npvValue) <= tolerance) {
            // 放宽极端值检查，允许更宽的负值范围
            if (rate > 10) {
                return 10;
            } else if (rate < -2) {
                return -2;
            }
            return rate;
        }
    }
    
    // 如果所有初始猜测都不收敛，直接使用简单收益率计算
    // 计算总投入和总产出
    const totalInput = Math.abs(cashFlows.filter(cf => cf.amount < 0).reduce((sum, cf) => sum + cf.amount, 0));
    const totalOutput = cashFlows.filter(cf => cf.amount > 0).reduce((sum, cf) => sum + cf.amount, 0);
    
    if (totalInput <= 0) return 0;
    
    // 计算持有天数
    const startDate = new Date(cashFlows[0].date);
    const endDate = new Date(cashFlows[cashFlows.length - 1].date);
    const daysHeld = Math.max(0.5, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    
    // 计算简单年化收益率
    const simpleReturn = (totalOutput - totalInput) / totalInput;
    const annualizedReturn = simpleReturn * (365 / daysHeld);
    
    // 确保返回值在合理范围内
    if (annualizedReturn > 10) {
        return 10;
    } else if (annualizedReturn < -2) {
        return -2;
    }
    
    return annualizedReturn;
}

// 测试用例1：负收益率测试
const testCase1 = [
    { date: '2023-01-01', amount: -10000 }, // 购买10000元
    { date: '2023-01-02', amount: 999 }     // 赎回999元，亏损
];

console.log('测试用例1：负收益率测试');
console.log('现金流:', testCase1);
const result1 = calculateXIRR(testCase1) * 100;
console.log('年化收益率:', result1.toFixed(2) + '%');

// 测试用例2：当天存入当天取出，亏损
const testCase2 = [
    { date: '2023-01-01', amount: -10000 }, // 购买10000元
    { date: '2023-01-01', amount: 9500 }     // 当天赎回9500元，亏损
];

console.log('\n测试用例2：当天存入当天取出，亏损');
console.log('现金流:', testCase2);
const result2 = calculateXIRR(testCase2) * 100;
console.log('年化收益率:', result2.toFixed(2) + '%');

// 测试用例3：正常盈利
const testCase3 = [
    { date: '2023-01-01', amount: -10000 }, // 购买10000元
    { date: '2023-12-31', amount: 11000 }    // 一年后赎回11000元，盈利
];

console.log('\n测试用例3：正常盈利');
console.log('现金流:', testCase3);
const result3 = calculateXIRR(testCase3) * 100;
console.log('年化收益率:', result3.toFixed(2) + '%');
