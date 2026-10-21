import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  markdown: string;
  className?: string;
};

/** Safe GFM markdown for chat bubbles and the markdown viewer data app. */
export function MarkdownView({ markdown, className }: Props) {
  return (
    <div className={className ? `md-view ${className}` : 'md-view'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {markdown || ''}
      </ReactMarkdown>
    </div>
  );
}
