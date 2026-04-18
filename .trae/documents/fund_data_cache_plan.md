# 基金数据缓存功能实现计划

## 一、需求分析

### 问题描述
当前基金页面在刷新后，联网查询的数据需要重新获取，导致用户需要等待数据加载。用户希望能够缓存这些数据，避免每次刷新都重新获取。

### 功能需求
1. 使用浏览器本地存储（localStorage）缓存基金数据
2. 设置合理的缓存过期时间（如30分钟）
3. 在缓存有效期内优先使用缓存数据
4. 缓存过期后自动重新获取数据

## 二、技术方案

### 2.1 缓存机制设计

| 缓存项 | 存储结构 | 过期时间 | 说明 |
|--------|----------|----------|------|
| 基金API数据 | `fundApiData_{fundCode}` | 30分钟 | 存储单个基金的API查询结果 |
| 缓存时间戳 | `fundApiData_timestamp_{fundCode}` | - | 记录缓存的时间戳 |

### 2.2 实现步骤

#### 步骤1：修改前端JavaScript代码（js/fund.js）

1. **添加缓存读取函数**
   - 在页面加载时读取localStorage中的缓存数据
   - 检查缓存是否过期

2. **修改数据获取逻辑**
   - 在获取基金数据前检查缓存
   - 如果缓存有效，使用缓存数据；否则从API获取

3. **添加缓存写入函数**
   - 在成功获取API数据后，将数据写入localStorage
   - 记录缓存时间戳

4. **修改handleFundApiToggle函数**
   - 在启用联网查询时，优先加载缓存数据
   - 显示缓存数据后再进行后台更新

#### 步骤2：修改updateFundApiData函数
- 在获取数据后，将数据写入缓存
- 同时记录缓存时间戳

#### 步骤3：修改renderFundTableSection函数
- 使用缓存数据进行表格渲染

## 三、文件修改清单

| 文件 | 修改内容 | 说明 |
|------|----------|------|
| js/fund.js | 添加缓存读取函数 | 从localStorage读取缓存数据 |
| js/fund.js | 添加缓存写入函数 | 将数据写入localStorage |
| js/fund.js | 修改updateFundApiData函数 | 获取数据后写入缓存 |
| js/fund.js | 修改handleFundApiToggle函数 | 启用联网查询时优先加载缓存 |

## 四、代码实现概要

### 4.1 缓存读取函数

```javascript
function loadFundApiCache() {
    const now = Date.now();
    const cacheExpiry = 30 * 60 * 1000; // 30分钟过期
    
    // 遍历localStorage，读取所有基金数据缓存
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('fundApiData_')) {
            const fundCode = key.replace('fundApiData_', '');
            const timestampKey = `fundApiData_timestamp_${fundCode}`;
            const timestamp = parseFloat(localStorage.getItem(timestampKey));
            
            // 检查缓存是否过期
            if (timestamp && (now - timestamp) < cacheExpiry) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    fundApiData[fundCode] = data;
                    fundLoadingStatus[fundCode] = 'loaded';
                } catch (error) {
                    console.error('加载基金缓存数据失败:', error);
                }
            }
        }
    }
}
```

### 4.2 缓存写入函数

```javascript
function saveFundApiCache(fundCode, data) {
    try {
        localStorage.setItem(`fundApiData_${fundCode}`, JSON.stringify(data));
        localStorage.setItem(`fundApiData_timestamp_${fundCode}`, Date.now().toString());
    } catch (error) {
        console.error('保存基金缓存数据失败:', error);
    }
}
```

### 4.3 修改updateFundApiData函数

在成功获取API数据后，添加缓存写入逻辑：

```javascript
if (dataChanged) {
    fundApiData[fund.fundCode] = data;
    saveFundApiCache(fund.fundCode, data); // 写入缓存
    console.log(`成功更新基金${fund.fundCode}数据`);
}
```

### 4.4 修改handleFundApiToggle函数

在启用联网查询时，先加载缓存数据：

```javascript
if (isFundApiEnabled) {
    loadFundApiCache(); // 先加载缓存数据
    renderFundTable();  // 使用缓存数据渲染表格
    updateFundApiData(); // 后台更新数据
    // ...
}
```

## 五、潜在风险与处理

### 5.1 存储容量限制
- localStorage有5MB的存储限制
- 处理方式：定期清理过期缓存，避免存储过多数据

### 5.2 数据一致性
- 缓存数据可能与实际数据有延迟
- 处理方式：设置合理的过期时间（30分钟），过期后自动更新

### 5.3 隐私安全
- 基金数据属于用户个人信息
- 处理方式：缓存仅存储基金代码和收益数据，不存储用户身份信息

## 六、测试验证

1. **缓存读取测试**
   - 启用联网查询，获取基金数据
   - 刷新页面，检查是否显示缓存数据
   - 验证表格是否立即显示数据，无需等待

2. **缓存过期测试**
   - 等待30分钟后刷新页面
   - 验证是否重新获取数据

3. **缓存清理测试**
   - 手动清除localStorage
   - 验证页面正常工作