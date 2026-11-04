import { createRoot } from 'react-dom/client';
import '../../../common/src/ui/styles.css';
import './console.css';
import './gemara.css';
import { GovernanceConsoleApp } from './GovernanceConsoleApp.tsx';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');
createRoot(root).render(<GovernanceConsoleApp />);
