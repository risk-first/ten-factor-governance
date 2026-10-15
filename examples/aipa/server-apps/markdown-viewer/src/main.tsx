import { createRoot } from 'react-dom/client';
import '../../../common/src/ui/styles.css';
import { MarkdownViewerApp } from './MarkdownViewerApp.tsx';

const root = document.getElementById('app');
if (!root) throw new Error('#app missing');
createRoot(root).render(<MarkdownViewerApp />);
