import { createRoot } from 'react-dom/client';
import '../../../common/src/ui/styles.css';
import { AgentUiApp } from './AgentUiApp.tsx';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');
createRoot(root).render(<AgentUiApp />);
