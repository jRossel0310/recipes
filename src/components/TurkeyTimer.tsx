import { estimateTurkey, formatMinutes } from '../lib/turkey';
import './RecipeScaler.css';
import './TurkeyTimer.css';

export default function TurkeyTimer({ lbs }: { lbs: number }) {
  const est = estimateTurkey(lbs);
  if (!est) return null;

  return (
    <section className="scaler turkey-timer">
      <h2>Cook time for a {lbs} lb turkey</h2>
      <dl>
        <dt>Roast at 350°F</dt>
        <dd>about {formatMinutes(est.cook)}</dd>
        <dt>Start checking temps</dt>
        <dd>around {formatMinutes(est.checkAt)} in</dd>
        <dt>With 30-45 min rest</dt>
        <dd>
          {formatMinutes(est.totalLow)} - {formatMinutes(est.totalHigh)}
        </dd>
      </dl>
      <p className="hint">
        Rough guide for an unstuffed bird, at 13 min per lb. Pull it by temperature, not the clock.
      </p>
    </section>
  );
}
