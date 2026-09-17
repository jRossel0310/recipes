import { useEffect, useState } from 'react';
import { counterpartPath, localeOf } from '../lib/locale-paths';
import { t } from '../lib/ui-strings';
import './LanguageToggle.css';

export default function LanguageToggle() {
  const [pathname, setPathname] = useState<string | null>(null);
  useEffect(() => setPathname(window.location.pathname), []);
  if (pathname === null) return null;

  const lang = localeOf(pathname);
  const target = counterpartPath(pathname);
  const isGerman = lang === 'de';

  if (!target) {
    return (
      <span className="lang-toggle is-disabled" title="No German version of this page">
        <span className="lang-toggle-track" aria-hidden="true"><span className="lang-toggle-thumb" /></span>
        <span>Deutsch</span>
      </span>
    );
  }

  return (
    <a className={`lang-toggle${isGerman ? ' is-on' : ''}`} href={target} role="switch" aria-checked={isGerman}>
      <span className="lang-toggle-track" aria-hidden="true"><span className="lang-toggle-thumb" /></span>
      <span>{t(lang, 'switchLanguage')}</span>
    </a>
  );
}
