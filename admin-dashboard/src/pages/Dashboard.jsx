import {
    Activity,
    Calendar,
    MessageSquare,
    Star,
    Stethoscope,
    UserCheck,
    UserX,
    Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { getStats } from '../api';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getStats().then(r => { setStats(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading"><div className="spinner" /> Loading dashboard…</div>;
    
    // If stats is missing or invalid (e.g. an error object returned with 200 status)
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
        return (
            <div className="loading" style={{ flexDirection: 'column', gap: '10px' }}>
                <p>Failed to load statistics.</p>
                <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer' }}>
                    Retry
                </button>
            </div>
        );
    }

    const appointmentStatusData = [
        { name: 'Pending', value: stats.pendingAppointments },
        { name: 'Confirmed', value: stats.confirmedAppointments },
        { name: 'Completed', value: stats.completedAppointments },
        { name: 'Cancelled', value: stats.cancelledAppointments },
    ].filter(d => d.value > 0);

    const specialtyData = (stats.appointmentsBySpecialty || []).map(s => ({
        name: s.specialty || 'General',
        count: s.count,
    }));

    return (
        <>
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Overview of your DoctorChat platform</p>
            </div>

            <div className="stats-grid">
                <StatCard icon={<Stethoscope size={22} />} bg="var(--primary-light)" color="var(--primary)"
                    value={stats.totalDoctors} label="Total Doctors" />
                <StatCard icon={<Users size={22} />} bg="var(--success-light)" color="var(--success)"
                    value={stats.totalPatients} label="Total Patients" />
                <StatCard icon={<Calendar size={22} />} bg="var(--warning-light)" color="var(--warning)"
                    value={stats.totalAppointments} label="Appointments" />
                <StatCard icon={<Activity size={22} />} bg="var(--purple-light)" color="var(--purple)"
                    value={stats.activeConsultations} label="Active Consults" />
                <StatCard icon={<MessageSquare size={22} />} bg="var(--cyan-light)" color="var(--cyan)"
                    value={stats.totalMessages} label="Messages" />
                <StatCard icon={<Star size={22} />} bg="var(--warning-light)" color="var(--warning)"
                    value={stats.totalReviews} label="Reviews" />
                <StatCard icon={<UserCheck size={22} />} bg="var(--success-light)" color="var(--success)"
                    value={stats.recentDoctors + stats.recentPatients} label="New (30d)" />
                <StatCard icon={<UserX size={22} />} bg="var(--danger-light)" color="var(--danger)"
                    value={stats.suspendedUsers} label="Suspended" />
            </div>

            <div className="charts-grid">
                <div className="chart-card">
                    <h3>Appointments by Status</h3>
                    {appointmentStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={appointmentStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                                    paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                    {appointmentStatusData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, color: '#f1f5f9' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div className="loading">No data yet</div>}
                </div>

                <div className="chart-card">
                    <h3>Appointments by Specialty</h3>
                    {specialtyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={specialtyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} angle={-30} textAnchor="end" height={60} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, color: '#f1f5f9' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="loading">No data yet</div>}
                </div>
            </div>
        </>
    );
}

function StatCard({ icon, bg, color, value, label }) {
    return (
        <div className="stat-card">
            <div className="icon-box" style={{ background: bg, color }}>
                {icon}
            </div>
            <div className="value">{value}</div>
            <div className="label">{label}</div>
        </div>
    );
}
