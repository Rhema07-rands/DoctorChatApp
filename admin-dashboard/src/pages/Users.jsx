import { useEffect, useMemo, useState } from 'react';
import { getUsers, suspendUser } from '../api';

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');

    useEffect(() => {
        getUsers().then(r => { setUsers(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        let data = users;
        if (typeFilter !== 'All') data = data.filter(u => u.userType === typeFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(u =>
                `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
            );
        }
        return data;
    }, [users, search, typeFilter]);

    const handleToggleSuspend = async (id, currentlySupended) => {
        try {
            await suspendUser(id, !currentlySupended);
            setUsers(prev => prev.map(u => u.id === id ? { ...u, isSuspended: !currentlySupended } : u));
        } catch (err) {
            alert('Failed to update: ' + (err.response?.data || err.message));
        }
    };

    const typeColor = (t) => {
        switch (t) {
            case 'Doctor': return 'badge-doctor';
            case 'Patient': return 'badge-patient';
            case 'Admin': return 'badge-admin';
            default: return '';
        }
    };

    const getInitials = (first, last) =>
        `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();

    const avatarColor = (type) => {
        switch (type) {
            case 'Doctor': return '#3b82f6';
            case 'Patient': return '#22c55e';
            default: return '#8b5cf6';
        }
    };

    if (loading) return <div className="loading"><div className="spinner" /> Loading users…</div>;

    return (
        <>
            <div className="page-header">
                <h1>User Management</h1>
                <p>{users.length} registered users across the platform</p>
            </div>

            <div className="table-card">
                <div className="table-header">
                    <h3>All Users</h3>
                    <div className="filter-row">
                        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="All">All Types</option>
                            <option value="Doctor">Doctors</option>
                            <option value="Patient">Patients</option>
                            <option value="Admin">Admins</option>
                        </select>
                        <input
                            className="search-input"
                            placeholder="Search by name or email…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(u => (
                            <tr key={u.id}>
                                <td>
                                    <div className="user-cell">
                                        {u.profilePictureUrl && !u.profilePictureUrl.includes('placehold') ? (
                                            <img src={u.profilePictureUrl} alt="" style={{ width: 36, height: 36, borderRadius: 10 }} />
                                        ) : (
                                            <div className="user-avatar" style={{ background: avatarColor(u.userType) }}>
                                                {getInitials(u.firstName, u.lastName)}
                                            </div>
                                        )}
                                        <div>
                                            <div className="user-name">{u.firstName} {u.lastName}</div>
                                            <div className="user-email">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td><span className={`badge ${typeColor(u.userType)}`}>{u.userType}</span></td>
                                <td>
                                    <span className={`badge ${u.isSuspended ? 'badge-suspended' : 'badge-active'}`}>
                                        {u.isSuspended ? 'Suspended' : 'Active'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    {u.userType !== 'Admin' && (
                                        <button
                                            className={`toggle-btn ${u.isSuspended ? 'activate' : 'suspend'}`}
                                            onClick={() => handleToggleSuspend(u.id, u.isSuspended)}
                                        >
                                            {u.isSuspended ? 'Activate' : 'Suspend'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
