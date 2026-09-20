import { useState, useEffect } from 'react';
import api from './api';

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 300, margin: '4rem auto' }}>
      <h2>IT Asset & Incident Manager</h2>
      <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Log In</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}

function AssetList() {
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ hostname: '', ram_gb: '', os: '', serial_number: '' });

  const loadAssets = async () => {
    const res = await api.get('/assets');
    setAssets(res.data.data);
  };

  useEffect(() => { loadAssets(); }, []);

  const addAsset = async (e) => {
    e.preventDefault();
    await api.post('/assets', form);
    setForm({ hostname: '', ram_gb: '', os: '', serial_number: '' });
    loadAssets();
  };

  return (
    <div>
      <h3>Assets</h3>
      <form onSubmit={addAsset}>
        <input placeholder="Hostname" value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
        <input placeholder="RAM (GB)" value={form.ram_gb} onChange={(e) => setForm({ ...form, ram_gb: e.target.value })} />
        <input placeholder="OS" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} />
        <input placeholder="Serial Number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
        <button type="submit">Add Asset</button>
      </form>
      <ul>
        {assets.map((a) => (
          <li key={a.id}>{a.hostname} — {a.os} — {a.ram_gb}GB — SN:{a.serial_number}</li>
        ))}
      </ul>
    </div>
  );
}

function TicketList() {
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const loadTickets = async () => {
    const res = await api.get('/tickets');
    setTickets(res.data.data);
  };

  useEffect(() => { loadTickets(); }, []);

  const addTicket = async (e) => {
    e.preventDefault();
    await api.post('/tickets', form);
    setForm({ title: '', description: '', priority: 'medium' });
    loadTickets();
  };

  const updateStatus = async (id, status) => {
    await api.put(`/tickets/${id}`, { status });
    loadTickets();
  };

  return (
    <div>
      <h3>Tickets</h3>
      <form onSubmit={addTicket}>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button type="submit">Log Ticket</button>
      </form>
      <ul>
        {tickets.map((t) => (
          <li key={t.id}>
            [{t.priority}] {t.title} — <strong>{t.status}</strong>
            {' '}
            <button onClick={() => updateStatus(t.id, 'in_progress')}>In Progress</button>
            <button onClick={() => updateStatus(t.id, 'resolved')}>Resolve</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto' }}>
      <h2>Welcome, {user.username}</h2>
      <AssetList />
      <hr />
      <TicketList />
    </div>
  );
}
