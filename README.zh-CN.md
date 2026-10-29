# Mellow

**围绕真实记录、当晚状态与长期个人模式的陪伴型产品。**

[产品网站](https://mellowtonight.app/) · [English](README.md) · [架构说明](docs/architecture.md) · [验证记录](docs/verification.md)

这个仓库用于展示 Mellow 的产品设计与精选工程实现。你可以先看界面和设计判断，再沿着代码入口查看实现和测试。

<img src="assets/tonight.webp" alt="当晚状态与陪伴反馈" width="230"> <img src="assets/personal.webp" alt="个人模式与支持证据的内部预览" width="230">

图片取自产品官网，使用示例记录；右图为 Premium 内部预览，不是真实用户效果数据。图片获取日期为 2026-10-23。

## 我关注的三个问题

### 输入是否可信

识别到饮品，不代表知道用户喝了多少。候选中的未知信息保持未知；进入确认页后，用户填写实际饮用量与酒精度。包装容量不会自动变成摄入量。

代码入口：[输入确认](src/intake/confirmation.ts)、[数据校验](src/intake/normalized.ts)、[单位解析](src/agent/units.ts)。

### 反馈是否有依据

一次事件先进入内容决策，再决定是否发声、发声原因、优先级和证据层级。表达层在约束内组织语言；无效或超时的输出有确定性回退，也允许沉默。陪伴反馈与后续 Tell Mellow 对话层是不同机制。

代码入口：[发声决策](src/content/shouldSpeak.ts)、[事件与输出记录](src/contentIntegration/engine.ts)、[受约束表达](src/companion/voiceComposer.ts)。

### 个人化是否可解释

用户看到的不只是标签，还能看到含义和支持记录。证据不足时不强行下结论；基础类型、个人模型和访问权限分开表达。

代码入口：[证据规则](src/content/evidence.ts)、[个人化边界](src/entitlement/productBoundary.ts)。内容反馈的证据阈值和 Drinking Style 发布门槛属于不同层，不能混为一谈。

## 如何查看这个作品

1. 看上面的界面，了解产品将哪些不确定性解释给用户。
2. 阅读[架构说明](docs/architecture.md)，理解事件、事实、状态与反馈如何衔接。
3. 运行测试，检查被选中的规则和边界，而不是只看说明文字。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
```

需要 Node.js 22.13 以上和 pnpm 11。测试不需要密钥、账号或生产数据。

## 公开范围

这是从实际项目提取的原始代码及其必要依赖，不是临时编造的示例，也不是完整 App。仓库未包含完整 iOS 客户端、后端部署、Agent 模型服务、私人配置和用户记录。原始代码保留了部分历史契约和词汇，不代表相应功能当前已向用户开放。

模块来源和校验值见[来源清单](docs/source-manifest.json)，检查结果和未覆盖范围见[验证记录](docs/verification.md)。工程测试不等于真机验收或真实用户效果。产品状态为估计，不能用于判断能否驾车。

本次公开用于作品审阅，未授予开源许可，详见[权利说明](RIGHTS.md)。
