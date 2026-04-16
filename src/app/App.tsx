import { BrowserRouter, Route, Routes } from 'react-router';
import HomePage from './HomePage';
import StudentAssignmentPage from './pages/StudentAssignmentPage';
import SubmissionViewPage from './pages/SubmissionViewPage';

function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (!base || base === '/') return undefined;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ukol/:assignmentId" element={<StudentAssignmentPage />} />
        <Route path="/odpoved/:submissionId" element={<SubmissionViewPage />} />
      </Routes>
    </BrowserRouter>
  );
}
