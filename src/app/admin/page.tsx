import { isAuthenticated } from '@/lib/auth';
import { getIndicators } from '@/lib/indicators';
import { getFeedback } from '@/lib/db/feedback';
import AdminDashboard from './AdminDashboard';
import LoginForm from './LoginForm';

export default async function AdminPage() {
    const auth = await isAuthenticated();

    if (!auth) {
        return <LoginForm />;
    }

    const [data, feedback] = await Promise.all([getIndicators(), getFeedback()]);
    return <AdminDashboard initialData={data} initialFeedback={feedback} />;
}
