import { useState } from 'react';
import './CopyableMenu.css';

export default function CopyableMenu({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="menu-text">
      <h2>Menu listing</h2>
      <p className="hint">Copy this into the dinner announcement, then fill in the crew names.</p>
      <button type="button" className="copy-btn" onClick={copy}>
        {copied ? 'Copied' : 'Copy as text'}
      </button>
      <pre>{text}</pre>
    </section>
  );
}
