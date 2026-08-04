import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Portfolio } from '@/pages/Portfolio';
import { StoreRecord } from '@/pages/StoreRecord';
import { PlanEditor } from '@/pages/PlanEditor';
import { Analysis } from '@/pages/Analysis';
import { Benchmarking } from '@/pages/Benchmarking';
import { Carriers } from '@/pages/Carriers';
import { RollUp } from '@/pages/RollUp';
import { Alerts } from '@/pages/Alerts';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/store/:id" element={<StoreRecord />} />
        <Route path="/store/:id/plan" element={<PlanEditor />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/benchmarking" element={<Benchmarking />} />
        <Route path="/carriers" element={<Carriers />} />
        <Route path="/roll-up" element={<RollUp />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
