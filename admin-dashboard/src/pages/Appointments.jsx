import { useEffect, useMemo, useState } from 'react';
import { getAppointments } from '../api';

export default function Appointments() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        getAppointments().then(r => { setAppointments(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let data = appointments;
        if (statusFilter !== 'All') data = data.filter(a => a.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(a =>
                a.doctorName.toLowerCase().includes(q) ||
                a.patientName.toLowerCase().includes(q) ||
                (a.reason || '').toLowerCase().includes(q)
            );
        }
        return data;
    }, [appointments, search, statusFilter]);

    const statusBadge = (status) => {
        switch (status) {
            case 'Pending': return 'badge-pending';
            case 'Confirmed': return 'badge-confirmed';
            case 'Completed': return 'badge-completed';
            case 'Cancelled': return 'badge-cancelled';
            default: return '';
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /> Loading appointments…</div>;

    return (
        <>
            <div className="page-header">
                <h1>Appointments</h1>
                <p>{appointments.length} total appointments on the platform</p>
            </div>

            <div className="table-card">
                <div className="table-header">
                    <h3>All Appointments</h3>
                    <div className="filter-row">
                        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                        <input
                            className="search-input"
                            placeholder="Search by name or reason…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Patient</th>
                            <th>Doctor</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(a => (
                            <tr key={a.id}>
                                <td style={{ fontWeight: 600 }}>{a.date}</td>
                                <td>{a.time}</td>
                                <td>{a.patientName}</td>
                                <td>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{a.doctorName}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.doctorSpecialty}</div>
                                    </div>
                                </td>
                                <td><span className="badge badge-doctor">{a.type}</span></td>
                                <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                    {a.reason || '—'}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No appointments found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
