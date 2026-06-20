import SwiftData // 导入数据持久化框架，用来在手机本地存储用户的资产数据
import SwiftUI   // 导入 UI 框架，用来搭建 App 界面

// ===== 【首页总览页面】—— App 的核心主页面，展示净资产、资产结构、快捷操作 =====
struct OverviewView: View {
    // @Environment(\.modelContext): 从 App 环境中获取数据操作手柄，用来增删改查数据库
    @Environment(\.modelContext) private var modelContext
    // @Query: 自动从数据库查询所有资产账户，按更新时间倒序排列
    @Query(sort: \AssetAccount.updatedAt, order: .reverse) private var assets: [AssetAccount]
    // 查询所有负债账户
    @Query(sort: \LiabilityAccount.updatedAt, order: .reverse) private var liabilities: [LiabilityAccount]
    // 查询所有净资产快照，按日期倒序
    @Query(sort: \NetWorthSnapshot.date, order: .reverse) private var snapshots: [NetWorthSnapshot]
    // @State: SwiftUI 的状态变量，改变时页面自动刷新；用来控制"快照已生成"弹窗
    @State private var statusMessage: String?
    @State private var showingStatus = false

    // 【计算属性】每次访问时重新计算财务汇总（总资产、总负债、净资产等）
    private var summary: FinancialSummary {
        FinancialSummaryService.makeSummary(assets: assets, liabilities: liabilities, snapshots: snapshots)
    }

    // 【计算属性】基于 summary 判断财务状态（稳健增长 / 负债偏高 / 结构均衡等）
    private var status: FinancialStatus {
        FinancialStatus.make(from: summary)
    }

    // 【计算属性】把资产按类型分组（现金、固定收益、权益等），算出各自的占比
    private var primaryAllocations: [PrimaryAllocation] {
        PrimaryAllocation.make(from: assets, totalAssets: summary.totalAssets)
    }

    // 【页面 body】定义页面长什么样
    var body: some View {
        NavigationStack {                       // 导航容器，提供标题栏和页面跳转能力
            ScrollView {                         // 可滚动区域，内容超出屏幕时能上下滑动
                VStack(alignment: .leading, spacing: 18) { // 垂直排列，左对齐，间距 18
                    netWorthHeader               // ① 净资产头部（显示金额数字）
                    financialStatusSection       // ② 财务状态（判断是稳健还是激进）
                    allocationSection            // ③ 资产结构（各类资产占比）
                    actionSection                // ④ 快捷操作（三个按钮）
                }
                .padding()                       // 给 VStack 加默认边距
            }
            .background(AppColors.groupedBackground) // 设置浅灰色分组背景
            .navigationTitle("RiceFinance")      // 导航栏标题
            .alert(statusMessage ?? "", isPresented: $showingStatus) { // 绑定弹窗，showingStatus 为 true 时弹出
                Button("好", role: .cancel) {}   // 弹窗里的"好"按钮
            }
        }
    }

    // ===== 【净资产头部区域】—— 显示净资产、总资产、总负债 =====
    private var netWorthHeader: some View {
        VStack(alignment: .leading, spacing: 18) { // 垂直排列，左对齐
            HStack(alignment: .top) {             // 水平排列，顶部对齐
                VStack(alignment: .leading, spacing: 8) { // 左侧：净资产标签+数字
                    Text("净资产")                 // "净资产"文字标签
                        .font(.subheadline.weight(.medium)) // 小标题字体，中等粗细
                        .foregroundStyle(.secondary) // 灰色文字
                    Text(CurrencyFormatter.short(summary.netWorth)) // 净资产金额
                        .font(.system(.largeTitle, design: .rounded, weight: .bold)) // 大标题、圆角数字、粗体
                        .lineLimit(1)              // 限制最多一行
                        .minimumScaleFactor(0.65)  // 数字太长时可缩小到 65%
                }

                Spacer()                          // 弹簧，把左右两边推开

                changeBadge                       // 右侧：较上月的变化标签
            }

            HStack(spacing: 12) {                 // 下方：总资产和总负债两行
                BalancePill(title: "总资产", value: CurrencyFormatter.short(summary.totalAssets), tint: .green) // 总资产卡片（绿色）
                BalancePill(title: "总负债", value: CurrencyFormatter.short(summary.totalLiabilities), tint: .red) // 总负债卡片（红色）
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading) // 宽度撑满，左对齐
        .padding(18)                               // 内边距
        .background(.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous)) // 白色背景圆角卡片
    }

    // ===== 【变化标签】—— 显示较上月的净资产变化（涨了绿色箭头，跌了红色箭头） =====
    @ViewBuilder                                  // 允许根据条件返回不同的界面
    private var changeBadge: some View {
        if let change = summary.netWorthChange, let rate = summary.netWorthChangeRate { // 如果有历史数据
            let isPositive = change >= 0           // 判断是涨还是跌
            VStack(alignment: .trailing, spacing: 4) { // 右对齐垂直排列
                Image(systemName: isPositive ? "arrow.up.right" : "arrow.down.right") // 涨→右上箭头，跌→右下箭头
                    .font(.caption.weight(.bold))   // 小字体，粗体
                Text(CurrencyFormatter.short(change)) // 变化金额
                Text(PercentFormatter.short(rate))    // 变化百分比
            }
            .font(.caption.weight(.semibold))      // 统一字体
            .foregroundStyle(isPositive ? .green : .red) // 涨→绿色，跌→红色
            .padding(.horizontal, 10)              // 左右内边距
            .padding(.vertical, 8)                 // 上下内边距
            .background((isPositive ? Color.green : Color.red).opacity(0.12), in: RoundedRectangle(cornerRadius: 8)) // 半透明背景圆角标签
        } else {                                   // 如果没有历史数据（首次使用）
            Text("首次快照")                         // 显示"首次快照"标签
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)        // 灰色文字
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 8)) // 半透明灰色背景
        }
    }

    // ===== 【财务状态区域】—— 显示 App 对用户财务状态的判断（稳健增长/负债偏高/结构均衡等） =====
    private var financialStatusSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "财务状态", systemImage: "heart.text.square") // 小标题

            HStack(alignment: .top, spacing: 12) { // 水平排列，顶部对齐
                Image(systemName: status.systemImage) // 根据状态显示不同图标
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(status.tint)   // 使用状态对应的颜色
                    .frame(width: 34, height: 34)    // 固定图标宽高
                    .background(status.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8)) // 半透明背景圆角

                VStack(alignment: .leading, spacing: 8) { // 右侧文字
                    Text(status.title)               // 状态标题（如"稳健增长"）
                        .font(.title3.weight(.semibold))
                    ForEach(status.notes, id: \.self) { note in // 逐条显示分析说明文字
                        Text(note)
                    }
                    .font(.subheadline)              // 小字号
                    .foregroundStyle(.secondary)     // 灰色
                    .fixedSize(horizontal: false, vertical: true) // 自动换行不截断
                }
            }
        }
        .padding(16)                                // 内边距
        .background(.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous)) // 白色圆角卡片
    }

    // ===== 【资产结构区域】—— 展示各类资产的占比（彩色条+详细列表） =====
    private var allocationSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "资产结构", systemImage: "chart.pie") // 小标题

            if primaryAllocations.isEmpty {         // 如果没有资产数据
                EmptyInlineState(text: "暂无资产数据，先在资产页新增账户。") // 显示提示文字
            } else {
                AllocationBar(items: primaryAllocations) // 横向彩色占比条

                VStack(spacing: 12) {               // 下方详细列表
                    ForEach(primaryAllocations) { item in // 遍历每种资产类型
                        AllocationSummaryRow(item: item) // 一行：色块+名称+百分比
                    }
                }
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    // ===== 【快捷操作区域】—— 三个功能按钮 =====
    private var actionSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "快捷操作", systemImage: "bolt") // 小标题

            HStack(spacing: 10) {                   // 水平排列三个按钮
                NavigationLink {                     // ① 跳转到资产列表页
                    AssetListView()
                } label: {
                    ActionTile(title: "更新资产", systemImage: "square.and.pencil", tint: .blue) // 蓝色按钮
                }
                .buttonStyle(.plain)                 // 朴素按钮样式

                Button {                             // ② 生成快照
                    createSnapshot()                  // 调用服务创建快照
                } label: {
                    ActionTile(title: "生成快照", systemImage: "camera", tint: .green) // 绿色按钮
                }
                .buttonStyle(.plain)
                .disabled(assets.isEmpty && liabilities.isEmpty) // 无数据时禁用按钮
                .opacity((assets.isEmpty && liabilities.isEmpty) ? 0.45 : 1) // 禁用时半透明

                NavigationLink {                     // ③ 跳转到 AI 分析页
                    AIAnalysisView()
                } label: {
                    ActionTile(title: "AI 分析", systemImage: "sparkles", tint: .purple) // 紫色按钮
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func createSnapshot() {
        do {
            let snapshot = SnapshotService.createSnapshot(assets: assets, liabilities: liabilities, context: modelContext)
            try VaultSyncService.write(snapshot)
            statusMessage = "快照已保存到 \(ICloudVaultService.locationDescription)。"
            showingStatus = true
        } catch {
            statusMessage = "保存快照失败：\(error.localizedDescription)"
            showingStatus = true
        }
    }
}

// ===== 【小标题组件】—— 显示一个带图标的小标题，如"❤️ 财务状态" =====
private struct SectionHeader: View {
    let title: String          // 标题文字
    let systemImage: String    // 图标名称

    var body: some View {
        Label(title, systemImage: systemImage) // SwiftUI 自带的图标+文字组件
            .font(.headline)                    // 标题字体
            .foregroundStyle(.primary)          // 主要颜色（浅色模式黑色，深色模式白色）
    }
}

// ===== 【余额小药丸组件】—— 带背景色的信息卡片，用于显示总资产/总负债 =====
private struct BalancePill: View {
    let title: String          // 标签文字（如"总资产"）
    let value: String          // 金额文字（如"¥300,000"）
    let tint: Color            // 主题色（资产绿色，负债红色）

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)                           // 标签
                .font(.caption)                   // 小字
                .foregroundStyle(.secondary)       // 灰色
            Text(value)                           // 金额
                .font(.subheadline.weight(.semibold)) // 小标题、半粗体
                .lineLimit(1)                     // 一行
                .minimumScaleFactor(0.75)          // 太长可缩小到 75%
        }
        .frame(maxWidth: .infinity, alignment: .leading) // 宽度撑满左对齐
        .padding(.horizontal, 12)                 // 左右内边距
        .padding(.vertical, 10)                   // 上下内边距
        .background(tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 8)) // 半透明主题色背景圆角
    }
}

// ===== 【资产分配条组件】—— 横向彩色分段条，直观展示各类资产占比 =====
private struct AllocationBar: View {
    let items: [PrimaryAllocation] // 各类资产数据

    var body: some View {
        GeometryReader { proxy in                    // 获取父容器宽度
            HStack(spacing: 3) {                     // 水平排列各色段，间距 3
                ForEach(items) { item in
                    RoundedRectangle(cornerRadius: 3) // 每段是一个圆角矩形
                        .fill(item.color)            // 填充该资产类别的颜色
                        .frame(width: max(proxy.size.width * item.ratio, 6)) // 宽度 = 总宽 × 占比，最少 6 像素
                }
            }
        }
        .frame(height: 12)                           // 条的总高度
        .clipShape(RoundedRectangle(cornerRadius: 6)) // 剪裁成圆角
        .accessibilityHidden(true)                   // 对屏幕阅读器隐藏
    }
}

// ===== 【资产分配行组件】—— 一行显示一种资产的名称和百分比 =====
private struct AllocationSummaryRow: View {
    let item: PrimaryAllocation

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 3)        // 颜色小方块
                .fill(item.color)                    // 与彩色条颜色一致
                .frame(width: 10, height: 10)        // 固定大小

            Text(item.title)                         // 资产名称（如"现金类"）
                .font(.subheadline.weight(.medium))

            Spacer()                                 // 把百分比挤到右边

            Text(PercentFormatter.short(item.ratio)) // 百分比数字（如"32%"）
                .font(.subheadline.monospacedDigit().weight(.semibold)) // 等宽数字对齐
                .foregroundStyle(.secondary)          // 灰色
        }
    }
}

// ===== 【快捷操作瓷砖组件】—— 方形按钮卡片，用于快捷操作区域 =====
private struct ActionTile: View {
    let title: String          // 按钮文字
    let systemImage: String    // 图标名称
    let tint: Color            // 主题色

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: systemImage)           // 图标
                .font(.headline.weight(.semibold))
                .foregroundStyle(tint)               // 主题色
                .frame(width: 32, height: 32)        // 固定大小
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8)) // 半透明背景圆角

            Text(title)                              // 文字标签
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity)                  // 宽度撑满
        .frame(height: 82)                           // 固定高度
        .background(AppColors.secondaryGroupedBackground, in: RoundedRectangle(cornerRadius: 8)) // 浅灰背景卡片
        .contentShape(RoundedRectangle(cornerRadius: 8)) // 点击区域为圆角矩形
    }
}

// ===== 【空状态提示组件】—— 无数据时显示灰色提示文字 =====
private struct EmptyInlineState: View {
    let text: String           // 提示文字

    var body: some View {
        Text(text)
            .font(.subheadline)                      // 小字
            .foregroundStyle(.secondary)             // 灰色
            .frame(maxWidth: .infinity, alignment: .leading) // 宽度撑满左对齐
            .padding(.vertical, 6)                   // 上下留白
    }
}

// ===== 【财务状态模型】—— 存储 App 对用户财务状态的判断结果 =====
private struct FinancialStatus {
    let title: String          // 状态标题（"稳健增长"/"负债偏高"/"结构均衡"/"增长进取"）
    let notes: [String]        // 分析说明文字列表
    let systemImage: String    // 对应的 SF Symbol 图标名
    let tint: Color            // 主题色（绿色/橙色/蓝色/红色）

    // 【静态方法】传入财务汇总数据，返回分析出的财务状态
    static func make(from summary: FinancialSummary) -> FinancialStatus {
        guard summary.totalAssets > 0 else {         // 如果总资产为 0（还没录入数据）
            return .init(
                title: "等待记录",
                notes: ["录入资产后，会自动判断现金、防守资产和权益资产占比。"],
                systemImage: "tray",
                tint: .gray
            )
        }

        let defensiveRatio = ratio(for: ["现金", "存款", "固定收益"], in: summary.typeAllocations) // 防守型资产占比
        let equityRatio = ratio(for: ["基金", "股票"], in: summary.typeAllocations) // 权益类资产占比
        let liabilityRatio = decimalRatio(summary.totalLiabilities, total: summary.totalAssets) // 负债/资产比

        let title: String
        let systemImage: String
        let tint: Color
        if liabilityRatio > 0.5 {                    // 负债超过资产 50%
            title = "负债偏高"
            systemImage = "exclamationmark.triangle.fill"
            tint = .orange
        } else if defensiveRatio >= 0.6 && equityRatio < 0.25 { // 防守≥60%且权益<25%
            title = "稳健增长"
            systemImage = "checkmark.seal.fill"
            tint = .green
        } else if equityRatio >= 0.45 {              // 权益≥45%
            title = "增长进取"
            systemImage = "chart.line.uptrend.xyaxis"
            tint = .red
        } else {                                     // 其他情况
            title = "结构均衡"
            systemImage = "scale.3d"
            tint = .blue
        }

        return .init(
            title: title,
            notes: [
                defensiveRatio >= 0.5
                    ? "现金与固定收益占比较高，整体风险偏低。"
                    : "防守型资产占比适中，注意保留足够现金缓冲。",
                equityRatio < 0.2
                    ? "权益类资产占比较低，长期增长弹性有限。"
                    : "权益类资产提供增长弹性，也会带来净值波动。"
            ],
            systemImage: systemImage,
            tint: tint
        )
    }

    // 【辅助方法】计算指定资产类别集合的总占比（如"现金+存款+固定收益"的占比之和）
    private static func ratio(for titles: Set<String>, in allocations: [AllocationItem]) -> Double {
        allocations
            .filter { titles.contains($0.title) } // 只保留需要的类别
            .reduce(0) { $0 + $1.ratio }          // 求和
    }

    // 【辅助方法】Decimal 转 Double 做除法
    private static func decimalRatio(_ value: Decimal, total: Decimal) -> Double {
        guard total > 0 else { return 0 }
        return NSDecimalNumber(decimal: value).doubleValue / NSDecimalNumber(decimal: total).doubleValue
    }
}

// ===== 【主要资产分配模型】—— 存储某一类资产的名称、占比和颜色 =====
private struct PrimaryAllocation: Identifiable {
    let id: String             // 唯一标识（如 "cash"）
    let title: String          // 显示名称（如 "现金类"）
    let ratio: Double          // 占总资产的比例（如 0.32 = 32%）
    let color: Color           // 显示颜色

    // 【静态方法】遍历所有资产，按类型分组，计算每组的占比
    static func make(from assets: [AssetAccount], totalAssets: Decimal) -> [PrimaryAllocation] {
        guard totalAssets > 0 else { return [] } // 没有资产则返回空

        // 定义分组规则：(唯一ID, 显示名称, 包含的资产类型集合, 颜色)
        let groups: [(String, String, Set<AssetType>, Color)] = [
            ("cash", "现金类", [.cash, .deposit], .mint),
            ("fixedIncome", "固定收益", [.fixedIncome], .teal),
            ("equity", "权益类", [.fund, .stock], .indigo),
            ("gold", "黄金", [.commodity], .orange),
            ("foreignCurrency", "外币", [.foreignCurrency], .cyan),
            ("other", "其他", [.other], .gray)
        ]

        return groups.compactMap { id, title, types, color in
            let amount = assets
                .filter { types.contains($0.type) } // 筛选出该类型的资产
                .reduce(Decimal.zero) { $0 + $1.amount } // 金额求和

            guard amount > 0 else { return nil } // 金额为 0 就跳过
            return PrimaryAllocation(
                id: id,
                title: title,
                ratio: decimalRatio(amount, total: totalAssets),
                color: color
            )
        }
    }

    // 【辅助方法】Decimal 转 Double 做除法
    private static func decimalRatio(_ value: Decimal, total: Decimal) -> Double {
        guard total > 0 else { return 0 }
        return NSDecimalNumber(decimal: value).doubleValue / NSDecimalNumber(decimal: total).doubleValue
    }
}
