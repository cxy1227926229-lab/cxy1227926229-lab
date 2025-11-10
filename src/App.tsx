import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  parseBatchCustomerRolls,
  createTransactionRecord,
  generateRollResultMessage,
  PRESET_SERVICES,
  aggregateStaffStats,
  buildStaffExportTable,
  filterRecordsForView,
  type TransactionRecord
} from './core';

type PickStrategy = 'max' | 'min';
type Page = 'welcome' | 'announcement' | 'roll' | 'stats' | 'staff' | 'guest';
type Role = 'manager' | 'staff' | null;

// FF14风格主题样式
const ff14Theme = {
  background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
  backgroundDark: '#0a0a0a',
  backgroundCard: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
  gold: '#d4af37',
  goldLight: '#f4d03f',
  goldDark: '#b8860b',
  bronze: '#cd7f32',
  text: '#f5e6d3',
  textSecondary: '#d4af37',
  textMuted: '#8b7355',
  border: '2px solid #d4af37',
  borderLight: '1px solid #8b7355',
  shadow: '0 4px 20px rgba(212, 175, 55, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  shadowHover: '0 6px 30px rgba(212, 175, 55, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  buttonPrimary: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
  buttonSecondary: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
  buttonDanger: 'linear-gradient(135deg, #8b0000 0%, #5a0000 100%)',
};

// 通用样式生成函数

function App() {
  // 权限和页面导航
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [userRole, setUserRole] = useState<Role>(null);
  const [loginPassword, setLoginPassword] = useState('');

  // 基础信息输入
  const [staffId, setStaffId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [priceInfo, setPriceInfo] = useState(''); // 例如"500w"
  const [slots, setSlots] = useState(1); // 名额数量 == 中选人数
  const [pickStrategy, setPickStrategy] = useState<PickStrategy>('min');

  // 文案与 roll 结果
  const [announcement, setAnnouncement] = useState('');
  const [rollInput, setRollInput] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 所有交易记录（用于统计和汇总）
  const [allRecords, setAllRecords] = useState<TransactionRecord[]>([]);

  // 店员视图筛选
  const [staffViewerId, setStaffViewerId] = useState('');

  // 标记是否已完成初始数据加载
  const isInitialLoadComplete = useRef(false);

  // 从 localStorage 加载数据（页面加载时）
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ffxiv-roll-records');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 将时间字符串转换回 Date 对象
        const records: TransactionRecord[] = parsed.map((r: any) => ({
          ...r,
          time: new Date(r.time)
        }));
        setAllRecords(records);
        console.log('已加载', records.length, '条记录');
      } else {
        console.log('localStorage 中没有保存的数据');
      }
      // 标记初始加载完成
      isInitialLoadComplete.current = true;
    } catch (error) {
      console.error('加载数据失败:', error);
      isInitialLoadComplete.current = true;
    }
  }, []);

  // 保存数据到 localStorage（当 allRecords 变化时，但跳过初始加载）
  useEffect(() => {
    // 只有在完成初始加载后才保存，避免覆盖已有数据
    if (!isInitialLoadComplete.current) {
      return;
    }
    try {
      const dataToSave = JSON.stringify(allRecords);
      localStorage.setItem('ffxiv-roll-records', dataToSave);
      console.log('数据已保存到 localStorage，共', allRecords.length, '条记录');
    } catch (error) {
      console.error('保存数据失败:', error);
      // 如果是存储空间不足，提示用户
      if (error instanceof DOMException && error.code === 22) {
        alert('存储空间不足，无法保存数据。请清理浏览器缓存后重试。');
      }
    }
  }, [allRecords]);

  // 登录处理
  const handleLogin = (role: 'manager' | 'staff') => {
    if (role === 'manager') {
      // 管理员密码
      if (loginPassword === '15351') {
        setUserRole('manager');
        setCurrentPage('announcement');
      } else {
        alert('管理员密码错误');
      }
    } else if (role === 'staff') {
      // 店员直接进入，不需要密码
      setUserRole('staff');
      setCurrentPage('stats');
    }
  };

  const announcementPreview = useMemo(() => {
    if (!staffId && !serviceName && !priceInfo) return '';
    // 如果价格信息有值，则包含在公告中；否则不显示价格部分
    const pricePart = priceInfo ? priceInfo : '';
    const target = `【${pricePart}${serviceName || '业务名称未填'}（${staffId || '店员未填'}）】`;
    const pickText = pickStrategy === 'min' ? '最小' : '最大';
    const slotText = slots > 1 ? `${slots} 位大人` : `1 位大人`;
    return `打扰致歉——请想要指定${target}速写业务的大人，在说话频道复制【/random】进行 roll 点，取点数${pickText}的${slotText}。`;
  }, [staffId, serviceName, priceInfo, pickStrategy, slots]);

  const handleGenerateAnnouncement = () => {
    if (!staffId || !serviceName) {
      setErrorMessage('请先填写店员和业务名称。');
      return;
    }
    setErrorMessage('');
    setAnnouncement(announcementPreview);
  };

  const handleRunRoll = () => {
    setErrorMessage('');
    const customers = parseBatchCustomerRolls(rollInput);
    if (customers.length === 0) {
      setResultMessage('没有识别到有效的 roll 结果，请确认聊天记录格式。');
      return;
    }
    if (slots <= 0) {
      setResultMessage('名额数量需大于 0。');
      return;
    }

    const record = createTransactionRecord(
      customers,
      staffId || '未填写',
      serviceName || '未填写',
      slots,
      0, // 交易金额设为0
      '无拒接',
      pickStrategy,
      slots
    );

    // 添加到所有记录中
    setAllRecords([...allRecords, record]);
    setResultMessage(generateRollResultMessage(record));
  };

  const handleExportStats = () => {
    if (allRecords.length === 0) {
      alert('暂无记录，无法导出统计');
      return;
    }
    const stats = aggregateStaffStats(allRecords);
    const table = buildStaffExportTable(stats);
    
    // 转换为CSV格式
    const csv = table.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // 创建下载链接
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `店员统计_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // 中选结果汇总
  const selectedSummary = useMemo(() => {
    if (allRecords.length === 0) return [];
    const summary: Record<string, { customerId: string; count: number; records: TransactionRecord[] }> = {};
    
    allRecords.forEach(record => {
      record.selectedCustomers.forEach(customer => {
        if (!summary[customer.customerId]) {
          summary[customer.customerId] = {
            customerId: customer.customerId,
            count: 0,
            records: []
          };
        }
        summary[customer.customerId].count += 1;
        summary[customer.customerId].records.push(record);
      });
    });
    
    return Object.values(summary).sort((a, b) => b.count - a.count);
  }, [allRecords]);

  const stats = useMemo(() => {
    if (allRecords.length === 0) return null;
    return aggregateStaffStats(allRecords);
  }, [allRecords]);

  const staffView = useMemo(() => {
    if (!staffViewerId || allRecords.length === 0) return [];
    return filterRecordsForView(allRecords, 'staff', staffViewerId);
  }, [allRecords, staffViewerId]);

  const guestView = useMemo(() => {
    if (allRecords.length === 0) return [];
    return filterRecordsForView(allRecords, 'guest');
  }, [allRecords]);

  // 导航按钮样式
  const navButtonStyle = (page: Page): React.CSSProperties => ({
    padding: '12px 24px',
    background: currentPage === page ? ff14Theme.buttonPrimary : ff14Theme.buttonSecondary,
    border: currentPage === page ? ff14Theme.border : ff14Theme.borderLight,
    color: currentPage === page ? '#0a0a0a' : ff14Theme.text,
    cursor: 'pointer',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 'bold',
    boxShadow: currentPage === page ? ff14Theme.shadow : 'none',
    transition: 'all 0.3s',
    textShadow: currentPage === page ? 'none' : '0 1px 2px rgba(0,0,0,0.5)'
  });

  // 权限检查
  const canAccessPage = (page: Page): boolean => {
    if (page === 'welcome') return true;
    if (page === 'announcement' || page === 'roll') {
      return userRole === 'manager';
    }
    if (page === 'stats') {
      return userRole === 'staff';
    }
    if (page === 'staff') {
      return userRole === 'manager';
    }
    if (page === 'guest') {
      return userRole === 'manager' || userRole === 'staff';
    }
    return false;
  };

  // 欢迎界面
  if (currentPage === 'welcome' || !userRole) {
    return (
      <div style={{ 
        padding: '32px', 
        color: ff14Theme.text, 
        background: ff14Theme.background, 
        minHeight: '100vh', 
        fontFamily: '"Microsoft YaHei", "SimSun", serif', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 装饰性背景元素 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        
        <h1 style={{ 
          fontSize: 42, 
          marginBottom: 16,
          color: ff14Theme.gold,
          textShadow: `0 0 20px ${ff14Theme.gold}, 0 2px 10px rgba(0,0,0,0.8)`,
          fontWeight: 'bold',
          letterSpacing: '2px',
          position: 'relative',
          zIndex: 1
        }}>比尔格的祝福菜单</h1>
        
        <div style={{ 
          background: ff14Theme.backgroundCard, 
          padding: '40px 32px', 
          borderRadius: 12, 
          maxWidth: 420, 
          width: '100%',
          border: ff14Theme.border,
          boxShadow: ff14Theme.shadow,
          position: 'relative',
          zIndex: 1
        }}>
          <h2 style={{ 
            fontSize: 24, 
            marginBottom: 32, 
            textAlign: 'center',
            color: ff14Theme.textSecondary,
            textShadow: `0 0 10px ${ff14Theme.gold}`,
            fontWeight: 'bold'
          }}>欢迎使用</h2>
          
          <div style={{ marginBottom: 28 }}>
            <label 
              htmlFor="login-password"
              style={{ 
                display: 'block', 
                marginBottom: 12,
                color: ff14Theme.text,
                fontSize: 16,
                fontWeight: 'bold'
              }}
            >
              管理员登录
            </label>
            <input
              id="login-password"
              name="login-password"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="请输入管理员密码"
              aria-label="管理员登录密码"
              style={{ 
                width: '100%', 
                padding: '12px 16px', 
                marginBottom: 12,
                background: ff14Theme.backgroundDark,
                border: ff14Theme.borderLight,
                borderRadius: 6,
                color: ff14Theme.text,
                fontSize: 16,
                outline: 'none',
                transition: 'all 0.3s'
              }}
              onFocus={(e) => {
                e.target.style.border = ff14Theme.border;
                e.target.style.boxShadow = `0 0 10px ${ff14Theme.gold}`;
              }}
              onBlur={(e) => {
                e.target.style.border = ff14Theme.borderLight;
                e.target.style.boxShadow = 'none';
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleLogin('manager');
                }
              }}
            />
            <button 
              onClick={() => handleLogin('manager')}
              aria-label="管理员登录按钮"
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: ff14Theme.buttonPrimary,
                border: 'none',
                color: '#0a0a0a',
                cursor: 'pointer',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 'bold',
                boxShadow: ff14Theme.shadow,
                transition: 'all 0.3s',
                textShadow: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = ff14Theme.shadowHover;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = ff14Theme.shadow;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              管理员登录
            </button>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: 12,
              color: ff14Theme.text,
              fontSize: 16,
              fontWeight: 'bold'
            }}>店员登录</label>
            <button 
              onClick={() => handleLogin('staff')}
              aria-label="店员登录按钮"
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: ff14Theme.buttonSecondary,
                border: ff14Theme.borderLight,
                color: ff14Theme.text,
                cursor: 'pointer',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = ff14Theme.border;
                e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = ff14Theme.borderLight;
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              店员登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '32px', 
      color: ff14Theme.text, 
      background: ff14Theme.background, 
      minHeight: '100vh', 
      fontFamily: '"Microsoft YaHei", "SimSun", serif',
      position: 'relative'
    }}>
      {/* 装饰性背景 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 30%, rgba(212, 175, 55, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(212, 175, 55, 0.03) 0%, transparent 50%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 32,
        position: 'relative',
        zIndex: 1
      }}>
        <h1 style={{ 
          margin: 0,
          fontSize: 36,
          color: ff14Theme.gold,
          textShadow: `0 0 20px ${ff14Theme.gold}, 0 2px 10px rgba(0,0,0,0.8)`,
          fontWeight: 'bold',
          letterSpacing: '2px'
        }}>比尔格的祝福菜单</h1>
        <button 
          onClick={() => {
            setUserRole(null);
            setCurrentPage('welcome');
            setLoginPassword('');
          }}
          aria-label="退出登录"
          style={{ 
            padding: '10px 20px', 
            background: ff14Theme.buttonSecondary,
            border: ff14Theme.borderLight,
            color: ff14Theme.text,
            cursor: 'pointer',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 'bold',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.border = ff14Theme.border;
            e.currentTarget.style.boxShadow = `0 0 10px ${ff14Theme.gold}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.border = ff14Theme.borderLight;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          退出登录
        </button>
      </div>

      {/* 快速导航 */}
      <div style={{ 
        marginBottom: 32, 
        display: 'flex', 
        gap: 12, 
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 1
      }}>
        {userRole === 'manager' && (
          <>
            <button 
              onClick={() => setCurrentPage('announcement')} 
              aria-label="页面1：生成公告"
              style={navButtonStyle('announcement')}
              onMouseEnter={(e) => {
                if (currentPage !== 'announcement') {
                  e.currentTarget.style.border = ff14Theme.border;
                  e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 'announcement') {
                  e.currentTarget.style.border = ff14Theme.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              页面1：生成公告
            </button>
            <button 
              onClick={() => setCurrentPage('roll')} 
              aria-label="页面2：粘贴结果"
              style={navButtonStyle('roll')}
              onMouseEnter={(e) => {
                if (currentPage !== 'roll') {
                  e.currentTarget.style.border = ff14Theme.border;
                  e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 'roll') {
                  e.currentTarget.style.border = ff14Theme.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              页面2：粘贴结果
            </button>
            <button 
              onClick={() => setCurrentPage('staff')} 
              aria-label="店员视图"
              style={navButtonStyle('staff')}
              onMouseEnter={(e) => {
                if (currentPage !== 'staff') {
                  e.currentTarget.style.border = ff14Theme.border;
                  e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 'staff') {
                  e.currentTarget.style.border = ff14Theme.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              店员视图
            </button>
            <button 
              onClick={() => setCurrentPage('guest')} 
              aria-label="roll点查询"
              style={navButtonStyle('guest')}
              onMouseEnter={(e) => {
                if (currentPage !== 'guest') {
                  e.currentTarget.style.border = ff14Theme.border;
                  e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 'guest') {
                  e.currentTarget.style.border = ff14Theme.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              roll点查询
            </button>
          </>
        )}
        {userRole === 'staff' && (
          <>
            <button 
              onClick={() => setCurrentPage('stats')} 
              aria-label="页面3：店员统计"
              style={navButtonStyle('stats')}
              onMouseEnter={(e) => {
                if (currentPage !== 'stats') {
                  e.currentTarget.style.border = ff14Theme.border;
                  e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 'stats') {
                  e.currentTarget.style.border = ff14Theme.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              页面3：店员统计
            </button>
            <button 
              onClick={() => setCurrentPage('guest')} 
              aria-label="roll点查询"
              style={navButtonStyle('guest')}
              onMouseEnter={(e) => {
                if (currentPage !== 'guest') {
                  e.currentTarget.style.border = ff14Theme.border;
                  e.currentTarget.style.boxShadow = `0 0 15px ${ff14Theme.gold}`;
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== 'guest') {
                  e.currentTarget.style.border = ff14Theme.borderLight;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              roll点查询
            </button>
          </>
        )}
      </div>

      {/* 页面1：生成公告（仅管理员） */}
      {currentPage === 'announcement' && canAccessPage('announcement') && (
        <section style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            background: ff14Theme.backgroundCard,
            padding: '32px',
            borderRadius: 12,
            border: ff14Theme.border,
            boxShadow: ff14Theme.shadow,
            maxWidth: 600
          }}>
            <h2 style={{ 
              fontSize: 24, 
              marginBottom: 24,
              color: ff14Theme.gold,
              textShadow: `0 0 10px ${ff14Theme.gold}`,
              fontWeight: 'bold'
            }}>① 填写业务信息（用于自动生成公告）</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label htmlFor="staff-id">
              店员 ID / 称号：
              <input
                id="staff-id"
                name="staff-id"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="如 睠恋/Igniss 老师"
                aria-label="店员 ID 或称号"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>
            <label htmlFor="service-select">
              业务名称（可下拉选择预设或手动输入）：
              <select
                id="service-select"
                name="service-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) setServiceName(e.target.value);
                }}
                aria-label="业务名称预设选择"
                style={{ width: '100%', padding: 8, marginTop: 4, marginBottom: 4 }}
              >
                <option value="">-- 快速选择预设 --</option>
                {PRESET_SERVICES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                id="service-name"
                name="service-name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="或手动输入"
                aria-label="业务名称手动输入"
                style={{ width: '100%', padding: 8 }}
              />
            </label>
            <label htmlFor="price-info">
              价格 / 数量信息：
              <input
                id="price-info"
                name="price-info"
                value={priceInfo}
                onChange={(e) => setPriceInfo(e.target.value)}
                placeholder="如 500w、300w/张"
                aria-label="价格或数量信息"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>
            <label htmlFor="slots">
              名额数量（中选人数）：
              <input
                id="slots"
                name="slots"
                type="text"
                value={slots}
                onChange={(e) => {
                  const value = e.target.value;
                  // 只允许输入数字，如果为空则设为1
                  if (value === '') {
                    setSlots(1);
                    return;
                  }
                  // 只允许输入数字字符
                  if (/^\d+$/.test(value)) {
                    const numValue = parseInt(value, 10);
                    if (numValue > 0) {
                      setSlots(numValue);
                    }
                  }
                }}
                placeholder="请输入中选人数，如：1、2、3"
                aria-label="名额数量（手动输入）"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>
            <label htmlFor="pick-strategy">
              取最大还是最小：
              <select
                id="pick-strategy"
                name="pick-strategy"
                value={pickStrategy}
                onChange={(e) => setPickStrategy(e.target.value as PickStrategy)}
                aria-label="取最大还是最小点数"
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              >
                <option value="min">取最小点（常见）</option>
                <option value="max">取最大点</option>
              </select>
            </label>
            <button 
              onClick={handleGenerateAnnouncement} 
              aria-label="生成公告文案"
              style={{ padding: '10px 16px', marginTop: 12 }}
            >
              生成公告文案
            </button>
            {errorMessage && <p style={{ color: '#f88' }}>{errorMessage}</p>}
            {announcementPreview && (
              <div style={{ background: '#2b2d30', padding: 12, borderRadius: 6, lineHeight: 1.6 }}>
                <strong>公告预览：</strong>
                <p style={{ whiteSpace: 'pre-wrap' }}>{announcementPreview}</p>
              </div>
            )}
            {announcement && (
              <div style={{ background: '#1f6feb20', padding: 12, borderRadius: 6, lineHeight: 1.6 }}>
                <strong>已生成公告（可复制粘贴游戏频道）：</strong>
                <p style={{ whiteSpace: 'pre-wrap' }}>{announcement}</p>
              </div>
            )}
          </div>
          </div>
        </section>
      )}

      {/* 页面2：粘贴roll结果（仅管理员） */}
      {currentPage === 'roll' && canAccessPage('roll') && (
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>② 粘贴 roll 结果，自动选人</h2>
          <p style={{ marginBottom: 12 }}>把游戏里聊天日志复制进来（保留原格式即可，括号里的"最大100"会自动忽略）。</p>
          <label htmlFor="roll-input" style={{ display: 'block', marginBottom: 8 }}>
            Roll 点结果输入：
          </label>
          <textarea
            id="roll-input"
            name="roll-input"
            rows={10}
            value={rollInput}
            onChange={(e) => setRollInput(e.target.value)}
            placeholder={`示例：\n[晓晓贝8]<维加斯> 宇宙和香 掷出了 672 点！\n达达快 掷出了127点！`}
            aria-label="粘贴 roll 点结果"
            style={{ width: '100%', maxWidth: 600, padding: 12, fontSize: 15, borderRadius: 6 }}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button 
              onClick={handleRunRoll} 
              aria-label="生成中选结果"
              style={{ padding: '10px 16px', background: '#1f6feb', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4 }}
            >
              生成中选结果
            </button>
            <button 
              onClick={() => {
                setRollInput('');
                setResultMessage('');
              }}
              aria-label="清空输入"
              style={{ padding: '10px 16px', background: '#2b2d30', border: '1px solid #444', color: '#fff', cursor: 'pointer', borderRadius: 4 }}
            >
              清空输入
            </button>
          </div>
          {resultMessage && (
            <div style={{ marginTop: 16, background: '#2b2d30', padding: 16, borderRadius: 6, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {resultMessage}
            </div>
          )}

          {/* 数据保存状态提示 */}
          <div style={{ marginTop: 16, padding: 12, background: '#1a3a1a', border: '1px solid #4a8', borderRadius: 6, fontSize: 14 }}>
            <div style={{ color: '#8f8', marginBottom: 4 }}>
              ✓ 数据自动保存：{allRecords.length > 0 ? `已保存 ${allRecords.length} 条记录到浏览器本地存储` : '暂无记录（添加记录后会自动保存）'}
            </div>
            <div style={{ color: '#aaa', fontSize: 12 }}>
              提示：数据保存在浏览器本地，刷新页面后不会丢失。打开浏览器控制台（F12）可查看保存日志。
            </div>
          </div>

          {/* 所有记录列表（可删除） */}
          {allRecords.length > 0 && (
            <div style={{ marginTop: 32, background: '#2b2d30', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, margin: 0 }}>所有roll点记录（共 {allRecords.length} 条）</h3>
                <button 
                  onClick={() => {
                    if (confirm('确定要清空所有记录吗？此操作不可恢复！')) {
                      setAllRecords([]);
                      setResultMessage('');
                    }
                  }}
                  aria-label="清空所有记录"
                  style={{ padding: '8px 16px', background: '#dc3545', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 4, fontSize: 14 }}
                >
                  清空所有记录
                </button>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {allRecords.map((record, idx) => (
                  <div key={record.id} style={{ marginBottom: 12, padding: 12, background: '#1a1a1a', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                        #{idx + 1} - {record.time.toLocaleString('zh-CN')}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>店员：</strong>{record.staffId} | <strong>业务：</strong>{record.serviceName} | <strong>名额：</strong>{record.amount}
                      </div>
                      <div style={{ fontSize: 14, color: '#ccc', marginBottom: 4 }}>
                        参与：{record.customers.map(c => `${c.customerId}(${c.rollValue})`).join('、')}
                      </div>
                      <div style={{ fontSize: 14, color: '#1f6feb' }}>
                        中选：{record.selectedCustomers.map(c => `${c.customerId}(${c.rollValue})`).join('、')}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('确定要删除这条记录吗？')) {
                          setAllRecords(allRecords.filter(r => r.id !== record.id));
                        }
                      }}
                      aria-label={`删除记录 ${idx + 1}`}
                      style={{ 
                        padding: '6px 12px', 
                        background: '#dc3545', 
                        border: 'none', 
                        color: '#fff', 
                        cursor: 'pointer', 
                        borderRadius: 4, 
                        fontSize: 12,
                        marginLeft: 12,
                        flexShrink: 0
                      }}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 中选结果汇总 */}
          {selectedSummary.length > 0 && (
            <div style={{ marginTop: 32, background: '#2b2d30', padding: 16, borderRadius: 8 }}>
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>中选结果汇总</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {selectedSummary.map((item, idx) => (
                  <div key={idx} style={{ background: '#1a1a1a', padding: 12, borderRadius: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#1f6feb' }}>
                      {item.customerId}
                    </div>
                    <div style={{ fontSize: 14, color: '#aaa' }}>
                      中选次数：{item.count} 次
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 页面3：店员统计（仅店员） */}
      {currentPage === 'stats' && canAccessPage('stats') && (
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>③ 店员统计</h2>
          {allRecords.length === 0 ? (
            <p style={{ color: '#aaa' }}>暂无记录，请等待管理员录入数据。</p>
          ) : (
            <div style={{ background: '#2b2d30', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#1a1a1a' }}>
                    <th style={{ padding: 8, textAlign: 'left', border: '1px solid #444' }}>店员ID</th>
                    <th style={{ padding: 8, textAlign: 'left', border: '1px solid #444' }}>业务名称</th>
                    <th style={{ padding: 8, textAlign: 'right', border: '1px solid #444' }}>数量</th>
                    <th style={{ padding: 8, textAlign: 'left', border: '1px solid #444' }}>客人ID</th>
                  </tr>
                </thead>
                <tbody>
                  {allRecords.map((record, idx) => (
                    <tr key={record.id} style={{ background: idx % 2 === 0 ? '#2b2d30' : '#1a1a1a' }}>
                      <td style={{ padding: 8, border: '1px solid #444' }}>{record.staffId}</td>
                      <td style={{ padding: 8, border: '1px solid #444' }}>{record.serviceName}</td>
                      <td style={{ padding: 8, textAlign: 'right', border: '1px solid #444' }}>{record.amount}</td>
                      <td style={{ padding: 8, border: '1px solid #444' }}>
                        {record.selectedCustomers.map(c => c.customerId).join('、')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 店员视图（仅管理员） */}
      {currentPage === 'staff' && canAccessPage('staff') && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, margin: 0 }}>店员视图</h2>
            {stats && stats.length > 0 && (
              <button 
                onClick={handleExportStats}
                aria-label="导出统计CSV"
                style={{ 
                  padding: '10px 20px', 
                  background: ff14Theme.buttonPrimary,
                  border: 'none',
                  color: '#0a0a0a',
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 'bold',
                  boxShadow: ff14Theme.shadow,
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = ff14Theme.shadowHover;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = ff14Theme.shadow;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                导出统计CSV
              </button>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="staff-viewer-id">
              输入店员ID/称号：
              <input
                id="staff-viewer-id"
                name="staff-viewer-id"
                value={staffViewerId}
                onChange={(e) => setStaffViewerId(e.target.value)}
                placeholder="如 睠恋/Igniss 老师"
                aria-label="输入店员ID或称号"
                style={{ width: '100%', maxWidth: 300, padding: 8, marginTop: 4 }}
              />
            </label>
          </div>
          {!staffViewerId ? (
            <p style={{ color: '#aaa' }}>请输入店员ID查看专属记录。</p>
          ) : staffView.length === 0 ? (
            <p style={{ color: '#aaa' }}>暂无该店员的记录，或店员ID不匹配。</p>
          ) : (
            <div style={{ background: '#2b2d30', padding: 16, borderRadius: 8 }}>
              <h3 style={{ marginBottom: 12 }}>该店员的记录（共 {staffView.length} 条）</h3>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {staffView.map((record: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: 12, padding: 12, background: '#1a1a1a', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                      {record.time}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <strong>业务：</strong>{record.serviceName} | <strong>名额：</strong>{record.amount}
                    </div>
                    <div style={{ fontSize: 14, color: '#ccc' }}>
                      参与顾客：{record.customers.map((c: any) => `${c.customerId}(${c.rollValue})`).join('、')}
                    </div>
                    <div style={{ fontSize: 14, color: '#1f6feb', marginTop: 4 }}>
                      中选：{record.selectedCustomers.map((c: any) => `${c.customerId}(${c.rollValue})`).join('、')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* roll点查询（管理员和店员） */}
      {currentPage === 'guest' && canAccessPage('guest') && (
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 16 }}>roll点查询</h2>
          {guestView.length === 0 ? (
            <p style={{ color: '#aaa' }}>暂无公开记录。</p>
          ) : (
            <div style={{ background: '#2b2d30', padding: 16, borderRadius: 8 }}>
              <h3 style={{ marginBottom: 12 }}>所有roll点记录（共 {guestView.length} 条）</h3>
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {guestView.map((summary: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: 12, padding: 12, background: '#1a1a1a', borderRadius: 4 }}>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                      {summary.transactionTime}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <strong>店员：</strong>{summary.staffId} | <strong>业务：</strong>{summary.serviceName} | 
                      <strong>名额：</strong>{summary.amount}
                    </div>
                    <div style={{ fontSize: 14, color: '#ccc', marginBottom: 4 }}>
                      参与：{summary.customerRolls}
                    </div>
                    <div style={{ fontSize: 14, color: '#1f6feb' }}>
                      中选：{summary.selected}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
