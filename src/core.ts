/**
 * 最终幻想 14 速写店 roll 点交易与薪资管理工具（前端核心数据与业务逻辑部分/TypeScript 风格）
 *
 * 本段代码聚焦于数据结构定义、核心交互流程处理及部分语句生成。用于网页端适配的工具逻辑层。
 * （UI 部分建议采用常规前端框架，如 React/Vue，样式不在此段范围）
 */

// 预设业务、拒接类型（实际应在数据库或全局管理器中可动态维护）
const PRESET_SERVICES = [
    '速写', '摄影', '300w盲盒', '500w盲盒'
];
const PRESET_REFUSAL_TYPES = [
    '无拒接', '时间冲突', '风格不符', '价格异议'
];

// -------------------- 数据结构定义 --------------------
type CustomerRoll = {
    customerId: string;
    rollValue: number;
};

type TransactionRecord = {
    id: string; // 交易ID
    time: Date;
    customers: CustomerRoll[]; // roll点参与顾客及其点数
    selectedCustomers: CustomerRoll[]; // 中选顾客（可多位）
    selectedCustomer: CustomerRoll | null; // 兼容旧逻辑的首位中选顾客
    staffId: string; // 店员ID或称号
    serviceName: string;
    amount: number; // 名额数量
    money: number; // 交易总金额
    refusalType: string;
    pickStrategy: 'max' | 'min';
    winnerCount: number;
};

type StaffStat = {
    staffId: string;
    serviceName: string;
    totalCount: number;
    transactionCount: number;
    totalMoney: number;
    refusalSummary: Record<string, number>; // 拒接类型及次数
    salary: number;
};

type RollResultSummary = {
    transactionTime: string;
    customerRolls: string;
    selected: string;
    staffId: string;
    serviceName: string;
    amount: number;
    money: number;
};

// -------------------- 业务逻辑与工具函数 --------------------

// 生成唯一ID（简单实现，生产建议使用uuid）
function generateId(): string {
    return 'T-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

// 给定顾客roll点数，按照策略选出若干位顾客
function pickCustomersByRoll(
    customers: CustomerRoll[],
    pick: 'max' | 'min',
    winnerCount: number
): CustomerRoll[] {
    if (!customers.length || winnerCount <= 0) return [];
    const sorted = [...customers].sort((a, b) => {
        return pick === 'max' ? b.rollValue - a.rollValue : a.rollValue - b.rollValue;
    });
    return sorted.slice(0, winnerCount);
}

// 管理者录入/提交 roll点交易，核心处理流程
function createTransactionRecord(
    customers: CustomerRoll[],
    staffId: string,
    serviceName: string,
    amount: number,
    money: number,
    refusalType: string,
    pickStrategy: 'max' | 'min' = 'max',
    winnerCount: number = 1
): TransactionRecord {
    const selectedCustomers = pickCustomersByRoll(customers, pickStrategy, winnerCount);
    return {
        id: generateId(),
        time: new Date(),
        customers,
        selectedCustomers,
        selectedCustomer: selectedCustomers[0] ?? null,
        staffId,
        serviceName,
        amount,
        money,
        refusalType,
        pickStrategy,
        winnerCount
    };
}

// 输出面向顾客/管理者的roll点总结语句
function generateRollResultMessage(tr: TransactionRecord): string {
    if (!tr.selectedCustomers.length) {
        return '本次未筛选出符合条件的顾客，请检查输入数据或名额数量。';
    }
    const pickText = tr.pickStrategy === 'max' ? '最高' : '最低';
    const winnerLines = tr.selectedCustomers
        .map((c, idx) => `${idx + 1}. ${c.customerId}（${c.rollValue}点）`)
        .join('；');

    const staffText = tr.staffId ? `[${tr.staffId}]` : '（未填写）';
    const serviceText = tr.serviceName || '（未填写）';

    let result = `本次 roll 点结束！共选出 ${tr.selectedCustomers.length} 位顾客：${winnerLines}。`;
    result += `\n老师 ${staffText} 将提供 [${serviceText}] 服务，名额：${tr.amount}。`;
    result += `\n取点规则：${pickText}点优先。请${tr.selectedCustomers.length}位大人稍后等待我私聊。`;
    if (tr.money) {
        result += `\n交易金额：${tr.money} 金币（或等价单位）。`;
    }
    if (tr.refusalType && tr.refusalType !== '无拒接') {
        result += `\n拒接类型：${tr.refusalType}（已协调）。`;
    }
    return result;
}

// 用于顾客公开查询的结果条目组成
function mapToPublicRollResult(tr: TransactionRecord): RollResultSummary {
    const selectedText = tr.selectedCustomers
        .map(c => `${c.customerId}(${c.rollValue})`)
        .join('、');
    return {
        transactionTime: tr.time.toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'}),
        customerRolls: tr.customers.map(c => `${c.customerId}(${c.rollValue})`).join('、'),
        selected: selectedText,
        staffId: tr.staffId,
        serviceName: tr.serviceName,
        amount: tr.amount,
        money: tr.money,
    };
}

// 汇总店员统计数据
function aggregateStaffStats(records: TransactionRecord[]): StaffStat[] {
    // 按 staffId + serviceName 分组
    const map = new Map<string, StaffStat>();
    for (const r of records) {
        const key = r.staffId + '||' + r.serviceName;
        if (!map.has(key)) {
            map.set(key, {
                staffId: r.staffId,
                serviceName: r.serviceName,
                totalCount: 0,
                transactionCount: 0,
                totalMoney: 0,
                refusalSummary: {},
                salary: 0
            });
        }
        const stat = map.get(key)!;
        stat.totalCount += r.amount;
        stat.transactionCount += 1;
        stat.totalMoney += r.money;
        stat.refusalSummary[r.refusalType] = (stat.refusalSummary[r.refusalType] || 0) + 1;
        // 假设薪资按金额 50%，可配置
        stat.salary += Math.round(r.money * 0.5);
    }
    return Array.from(map.values());
}

// 导出店员薪资汇总表内容（二维数组，头部 + 数据+合计行）
function buildStaffExportTable(stats: StaffStat[]): (string | number)[][] {
    const table: (string | number)[][] = [
        ['店员 ID', '业务名称', '业务数量', '交易笔数', '总金额（金币）', '拒接类型', '累计薪资（金币）']
    ];
    let totalCount = 0, totalTrans = 0, totalMoney = 0, totalSalary = 0;
    for (const stat of stats) {
        const refSummaryText = Object.keys(stat.refusalSummary)
            .filter(rt => rt !== '无拒接')
            .map(rt => `${rt}（${stat.refusalSummary[rt]} 笔）`)
            .join('，') || '无拒接';
        table.push([
            stat.staffId,
            stat.serviceName,
            stat.totalCount,
            stat.transactionCount,
            stat.totalMoney,
            refSummaryText,
            stat.salary
        ]);
        totalCount += stat.totalCount;
        totalTrans += stat.transactionCount;
        totalMoney += stat.totalMoney;
        totalSalary += stat.salary;
    }
    table.push([
        '合计', '-', totalCount, totalTrans, totalMoney, '-', totalSalary
    ]);
    return table;
}

// -------------------- 权限&查询辅助 --------------------

// 按权限分区数据展示
function filterRecordsForView(records: TransactionRecord[], role: 'manager' | 'staff' | 'guest', viewerId?: string): any[] {
    switch(role) {
        case 'manager':
            return records;
        case 'staff':
            return records.filter(r => r.staffId === viewerId)
                .map(r => ({
                    ...r,
                    refusalType: r.refusalType,
                    time: r.time.toLocaleString('zh-CN', {hour12: false})
                }));
        case 'guest':
            return records.map(mapToPublicRollResult);
        default:
            return [];
    }
}

// -------------------- 批量粘贴解析 --------------------

// 解析聊天记录格式，例如：
// “[晓晓贝8]<维加斯> 宇宙和香 掷出了 672 点！（最大100）”
function parseBatchCustomerRolls(input: string): CustomerRoll[] {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
    .map(line => {
      // 仅当存在“掷/roll 出 … 点”时才匹配
      const match = line.match(
        /^(.+?)\s*(?:掷|擲|roll|ROLL)(?:出)?(?:了)?\s*(\d{1,4})\s*点/
      );
      if (!match) return null;

      // 如果行里包含“（最大…）”或“(最大…)”，直接忽略
      if (line.includes('（最大') || line.includes('(最大')) {
        return null;
      }

      let rawName = match[1];
      rawName = rawName.replace(/^[\[\(（【<][^\]\)）】>]+[\]\)）】>]\s*/g, '');
      let customerId = rawName.replace(/^[^\u4e00-\u9fa5A-Za-z0-9_\- ]+|[^\u4e00-\u9fa5A-Za-z0-9_\- ]+$/g, '');
      customerId = customerId.trim();

      const rollValue = parseInt(match[2], 10);
      if (!customerId || Number.isNaN(rollValue)) return null;

      return { customerId, rollValue };
    })
    .filter(Boolean) as CustomerRoll[];
}

// -------------------- Example Usage (伪代码/测试) --------------------

// // 管理者批量录入
// const batch = `A 88\nB 99\nC 76`;
// const rollData = parseBatchCustomerRolls(batch);
// const record = createTransactionRecord(
//     rollData, 'YYY', '单人速写', 2, 5000, '无拒接', 'min', 2
// );
// const msg = generateRollResultMessage(record);
// console.log(msg);
// // 店员专用视图
// const staffView = filterRecordsForView([record], 'staff', 'YYY');
// // 顾客可见条目
// const publicList = filterRecordsForView([record], 'guest');
// // 导出表格
// const stats = aggregateStaffStats([record]);
// const exportTable = buildStaffExportTable(stats);

export {
    PRESET_SERVICES,
    PRESET_REFUSAL_TYPES,
    createTransactionRecord,
    generateRollResultMessage,
    filterRecordsForView,
    parseBatchCustomerRolls,
    aggregateStaffStats,
    buildStaffExportTable
};

export type { TransactionRecord, StaffStat, CustomerRoll };