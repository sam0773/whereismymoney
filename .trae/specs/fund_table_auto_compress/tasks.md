# 基金表格自动压缩功能 - 实现计划

## [x] Task 1: 添加产品名称列自动压缩样式
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在style.css中添加产品名称列的压缩样式
  - 设置最大宽度和overflow属性
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgment` TR-1.1: 开启联网查询后，产品名称列宽度自动压缩
  - `human-judgment` TR-1.2: 操作按钮始终完整显示
- **Notes**: 使用CSS的max-width和overflow属性

## [x] Task 2: 添加产品名称滚动动画效果
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 创建CSS动画实现名称滚动效果
  - 添加hover暂停滚动功能
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `human-judgment` TR-2.1: 名称过长时自动滚动显示
  - `human-judgment` TR-2.2: 鼠标悬停时暂停滚动
- **Notes**: 使用CSS @keyframes实现滚动动画

## [x] Task 3: 在handleFundApiToggle中添加压缩触发逻辑
- **Priority**: P0
- **Depends On**: Task 1, Task 2
- **Description**: 
  - 修改handleFundApiToggle函数
  - 开启联网查询时添加压缩类名
  - 关闭时移除压缩类名
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `human-judgment` TR-3.1: 开启联网查询自动压缩产品名称列
  - `human-judgment` TR-3.2: 关闭联网查询恢复原宽度
- **Notes**: 通过添加/移除CSS类名实现动态切换