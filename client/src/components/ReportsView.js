import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart,
  Calendar
} from 'lucide-react';
import api from '../config/api';
import LoadingSpinner from './LoadingSpinner';

const ReportsView = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [dailyReport, setDailyReport] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [menuPerformance, setMenuPerformance] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  
  const loadDailyReport = useCallback(async () => {
    const response = await api.get(`/api/reports/daily-sales?date=${selectedDate}`);
    setDailyReport(response.data);
  }, [selectedDate]);

  const loadWeeklyReport = useCallback(async () => {
    const params = selectedWeek ? `?week_start=${selectedWeek}` : '';
    const response = await api.get(`/api/reports/weekly-sales${params}`);
    setWeeklyReport(response.data);
  }, [selectedWeek]);

  const loadMonthlyReport = useCallback(async () => {
    const response = await api.get(`/api/reports/monthly-sales?year=${selectedYear}&month=${selectedMonth}`);
    setMonthlyReport(response.data);
  }, [selectedMonth, selectedYear]);

  const loadMenuPerformance = useCallback(async () => {
    const response = await api.get('/api/reports/menu-performance');
    setMenuPerformance(response.data);
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'daily':
          await loadDailyReport();
          break;
        case 'weekly':
          await loadWeeklyReport();
          break;
        case 'monthly':
          await loadMonthlyReport();
          break;
        case 'menu':
          await loadMenuPerformance();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }

  }, [activeTab, loadDailyReport, loadWeeklyReport, loadMonthlyReport, loadMenuPerformance]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      loadReports();
    }
  }, [user, loadReports]);

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600">You don't have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600">Track your restaurant's performance and insights</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'daily', name: 'Daily Sales', icon: Calendar },
            { id: 'weekly', name: 'Weekly Sales', icon: TrendingUp },
            { id: 'monthly', name: 'Monthly Sales', icon: BarChart3 },
            { id: 'menu', name: 'Menu Performance', icon: ShoppingCart }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div>
          {activeTab === 'daily' && <DailyReportView report={dailyReport} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
          {activeTab === 'weekly' && <WeeklyReportView report={weeklyReport} selectedWeek={selectedWeek} setSelectedWeek={setSelectedWeek} />}
          {activeTab === 'monthly' && <MonthlyReportView report={monthlyReport} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />}
          {activeTab === 'menu' && <MenuPerformanceView report={menuPerformance} />}
        </div>
      )}
    </div>
  );
};

const DailyReportView = ({ report, selectedDate, setSelectedDate }) => {
  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input w-auto"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Orders"
          value={report.summary.total_orders}
          icon={<ShoppingCart className="h-6 w-6" />}
          color="bg-primary-500"
        />
        <SummaryCard
          title="Total Revenue"
          value={`€${report.summary.total_revenue.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-success-500"
        />
        <SummaryCard
          title="Average Order"
          value={`€${report.summary.average_order_value.toFixed(2)}`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-warning-500"
        />
        <SummaryCard
          title="Net Revenue"
          value={`€${report.summary.net_revenue.toFixed(2)}`}
          icon={<BarChart3 className="h-6 w-6" />}
          color="bg-info-500"
        />
      </div>

      {/* Top Selling Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h3>
          <div className="space-y-3">
            {report.top_selling_items.slice(0, 5).map((item, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.quantity_sold} sold</p>
                </div>
                <p className="font-semibold text-gray-900">€{item.revenue.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Waiter Performance</h3>
          <div className="space-y-3">
            {report.waiter_performance.slice(0, 5).map((waiter, index) => (
              <div key={index} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{waiter.name}</p>
                  <p className="text-sm text-gray-600">{waiter.orders_count} orders</p>
                </div>
                <p className="font-semibold text-gray-900">€{waiter.total_sales.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Sales</h3>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {Object.entries(report.hourly_breakdown).map(([hour, data]) => (
            <div key={hour} className="text-center">
              <div className="text-xs text-gray-600 mb-1">{hour}</div>
              <div className="bg-primary-100 rounded p-2">
                <div className="text-sm font-medium text-primary-900">{data.orders}</div>
                <div className="text-xs text-primary-700">€{data.revenue.toFixed(0)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WeeklyReportView = ({ report, selectedWeek, setSelectedWeek }) => {
  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Week Selector */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Week Starting:</label>
        <input
          type="date"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="input w-auto"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Orders"
          value={report.summary.total_orders}
          icon={<ShoppingCart className="h-6 w-6" />}
          color="bg-primary-500"
        />
        <SummaryCard
          title="Total Revenue"
          value={`€${report.summary.total_revenue.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-success-500"
        />
        <SummaryCard
          title="Daily Average"
          value={`€${report.summary.average_daily_revenue.toFixed(2)}`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-warning-500"
        />
        <SummaryCard
          title="Net Revenue"
          value={`€${report.summary.net_revenue.toFixed(2)}`}
          icon={<BarChart3 className="h-6 w-6" />}
          color="bg-info-500"
        />
      </div>

      {/* Daily Breakdown */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Breakdown</h3>
        <div className="grid grid-cols-7 gap-4">
          {Object.entries(report.daily_breakdown).map(([date, data]) => (
            <div key={date} className="text-center">
              <div className="text-sm font-medium text-gray-900 mb-2">{data.day_name}</div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-bold text-gray-900">{data.orders}</div>
                <div className="text-sm text-gray-600">orders</div>
                <div className="text-sm font-medium text-gray-900 mt-1">€{data.revenue.toFixed(0)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MonthlyReportView = ({ report, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear }) => {
  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* Month/Year Selector */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          className="input w-auto"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2023, i).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <label className="text-sm font-medium text-gray-700">Year:</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="input w-auto"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <option key={i} value={new Date().getFullYear() - 2 + i}>
              {new Date().getFullYear() - 2 + i}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Orders"
          value={report.summary.total_orders}
          icon={<ShoppingCart className="h-6 w-6" />}
          color="bg-primary-500"
        />
        <SummaryCard
          title="Total Revenue"
          value={`€${report.summary.total_revenue.toFixed(2)}`}
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-success-500"
        />
        <SummaryCard
          title="Daily Average"
          value={`€${report.summary.average_daily_revenue.toFixed(2)}`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-warning-500"
        />
        <SummaryCard
          title="Net Revenue"
          value={`€${report.summary.net_revenue.toFixed(2)}`}
          icon={<BarChart3 className="h-6 w-6" />}
          color="bg-info-500"
        />
      </div>

      {/* Monthly Overview */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {report.month_name} {report.year} Overview
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {Object.entries(report.daily_breakdown).map(([date, data]) => {
            const day = new Date(date).getDate();
            return (
              <div key={date} className="text-center">
                <div className="text-xs text-gray-600 mb-1">{day}</div>
                <div className={`rounded p-1 ${data.orders > 0 ? 'bg-primary-100' : 'bg-gray-50'}`}>
                  <div className="text-xs font-medium">{data.orders}</div>
                  <div className="text-xs">€{data.revenue.toFixed(0)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MenuPerformanceView = ({ report }) => {
  if (!report) return null;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Menu Item Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity Sold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg per Order
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.menu_performance.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity_sold}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{item.total_revenue.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.orders_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.average_quantity_per_order.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, icon, color }) => {
  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color} text-white`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;