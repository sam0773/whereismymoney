# 基金API优化功能 - 产品需求文档

## Overview
- **Summary**: 优化基金页面的联网查询功能，包括提升查询速度、清理控制台日志、显示数据获取时间、以及实现当日缓存机制。
- **Purpose**: 提升用户体验，减少数据加载时间，提供更好的数据管理。
- **Target Users**: 使用基金页面查询基金收益数据的用户。

## Goals
- 提升基金数据联网查询速度
- 清理浏览器控制台中的成功消息日志
- 在联网查询开关左侧显示数据获取时间
- 实现当日缓存机制，只保留当天已获取的最新数据

## Non-Goals (Out of Scope)
- 不涉及后端API接口的修改
- 不改变现有数据展示方式
- 不添加新的基金数据列

## Background & Context
- 当前基金页面的联网查询功能存在以下问题：
  1. 查询速度较慢，用户等待时间较长
  2. 浏览器控制台输出大量成功消息，影响调试
  3. 用户无法知道数据获取时间
  4. 缓存机制不完善，每次刷新都重新获取数据

## Functional Requirements
- **FR-1**: 优化联网查询速度，采用并行请求方式
- **FR-2**: 移除控制台中的成功消息日志
- **FR-3**: 在联网查询开关左侧显示上次数据获取时间
- **FR-4**: 实现当日缓存机制，缓存数据当天有效

## Non-Functional Requirements
- **NFR-1**: 查询速度提升50%以上
- **NFR-2**: 缓存数据只保留当天最新版本
- **NFR-3**: 获取时间显示格式为"HH:mm:ss"

## Constraints
- **Technical**: 使用浏览器localStorage进行缓存
- **Business**: 缓存有效期为当日24:00
- **Dependencies**: 依赖现有的基金API接口

## Assumptions
- 用户浏览器支持localStorage
- 用户系统时间准确

## Acceptance Criteria

### AC-1: 查询速度优化
- **Given**: 用户打开基金页面并启用联网查询
- **When**: 系统获取基金数据
- **Then**: 数据获取时间减少50%以上
- **Verification**: `programmatic`
- **Notes**: 通过并行请求多个基金数据实现

### AC-2: 控制台日志清理
- **Given**: 用户打开浏览器控制台
- **When**: 联网查询数据获取成功
- **Then**: 控制台不显示成功消息日志
- **Verification**: `human-judgment`

### AC-3: 获取时间显示
- **Given**: 用户启用联网查询
- **When**: 数据获取完成
- **Then**: 在联网查询开关左侧显示获取时间
- **Verification**: `human-judgment`

### AC-4: 当日缓存机制
- **Given**: 用户在同一天内多次刷新页面
- **When**: 启用联网查询
- **Then**: 优先使用缓存数据，不重新获取
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要提供手动刷新按钮？
- [ ] 是否需要显示缓存有效期提示？