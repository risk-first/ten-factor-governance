import { createRoot } from 'react-dom/client';
import '../../../common/src/ui/styles.css';
import { CapabilityApp } from './CapabilityApp.tsx';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');
createRoot(root).render(<CapabilityApp />);
