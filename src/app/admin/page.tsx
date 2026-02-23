import { isAuthenticated } from '@/lib/auth';
import { getIndicators } from '@/lib/db';
import AdminDashboard from './AdminDashboard';
import LoginForm from './LoginForm';

export default async function AdminPage() {
    const auth = await isAuthenticated();

    if (!auth) {
        return <LoginForm />;
    }

    const data = await getIndicators();
    return <AdminDashboard initialData={data} />;
}
