import { BarChart3, Calendar, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const NAV = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/users', label: 'User Management', icon: Users },
    { path: '/appointments', label: 'Appointments', icon: Calendar },
];

export default function Layout({ children, onLogout }) {
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="icon">
                        <BarChart3 size={22} color="white" />
                    </div>
                    <div>
                        <h2>DoctorChat</h2>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {NAV.map(({ path, label, icon: Icon }) => (
                        <div
                            key={path}
                            className={`nav-item ${location.pathname === path ? 'active' : ''}`}
                            onClick={() => navigate(path)}
                        >
                            <Icon size={20} />
                            {label}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="nav-item" onClick={onLogout}>
                        <LogOut size={20} />
                        Logout
                    </div>
                </div>
            </aside>

            <main className="main-content">{children}</main>
        </div>
    );
}
