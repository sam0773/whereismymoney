# 基金表格自动压缩功能 - 产品需求文档

## Overview
- **Summary**: 当开启联网查询后，如果表格宽度不足以显示所有内容（包括操作按钮），自动压缩产品名称列，名称过长时自动滚动显示。
- **Purpose**: 确保在开启联网查询后，所有操作按钮都能完整显示，提升用户体验。
- **Target Users**: 使用基金页面的用户。

## Goals
- 开启联网查询后自动压缩产品名称列
- 确保操作按钮始终完整显示
- 产品名称过长时自动滚动显示

## Non-Goals (Out of Scope)
- 不改变其他列的宽度
- 不改变表格的整体布局结构

## Background & Context
- 当前开启联网查询后，表格会增加近1月收益、近3月收益、近1年收益三列
- 当表格宽度不足时，操作按钮可能被遮挡或显示不全
- 需要动态调整产品名称列宽度，确保操作按钮完整显示

## Functional Requirements
- **FR-1**: 开启联网查询时，自动计算并压缩产品名称列宽度
- **FR-2**: 确保操作按钮始终完整显示
- **FR-3**: 产品名称过长时自动滚动显示

## Non-Functional Requirements
- **NFR-1**: 响应速度快，不影响用户体验
- **NFR-2**: 滚动动画流畅

## Constraints
- **Technical**: 使用CSS和JavaScript实现
- **Dependencies**: 依赖现有的基金表格结构

## Assumptions
- 用户浏览器支持CSS动画
- 表格容器有固定宽度限制

## Acceptance Criteria

### AC-1: 产品名称列自动压缩
- **Given**: 用户开启联网查询
- **When**: 表格宽度不足以显示所有内容
- **Then**: 产品名称列自动压缩，操作按钮完整显示
- **Verification**: `human-judgment`

### AC-2: 产品名称滚动显示
- **Given**: 产品名称列被压缩后名称过长
- **When**: 用户查看表格
- **Then**: 产品名称自动滚动显示完整内容
- **Verification**: `human-judgment`

## Open Questions
- [ ] 是否需要添加滚动控制按钮？