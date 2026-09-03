import { useEffect, useMemo, useState } from 'react';
import { buildMenuText, resolveMenuDate, type MenuDish } from '../lib/menu';
import './CopyableMenu.css';

interface Props {
  dishes: MenuDish[];
  dateISO?: string;
  serveTime?: string;
}

export default function CopyableMenu({ dishes, dateISO, serveTime }: Props) {
  const [copied, setCopied] = useState(false);
  // Static build, so only the browser knows the real date. Filling it in after
  // mount keeps the server and first client render in agreement.
  const [today, setToday] = useState<Date | undefined>(undefined);
  useEffect(() => setToday(new Date()), []);

  const text = useMemo(() => {
    const explicit = dateISO ? new Date(dateISO) : undefined;
    return buildMenuText({ dishes, date: resolveMenuDate(explicit, today), serveTime });
  }, [dishes, dateISO, serveTime, today]);

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
