// ============================================================================
// ZENITH IV - INIS TAKIMI / ANLIK GERILME
// ----------------------------------------------------------------------------
// Simulasyon her an bacaktaki uc kuvveti bilir: ayagin dusey zemin kuvveti (N),
// kartus kuvveti (Fa) ve ayagin yanal (surtunme) kuvveti (Y). Bu modul o
// kuvvetlerden her parcanin gerilmesini bulur.
//
// Gerilme burada bastan hesaplanmaz. El hesaplari (07) ve sonlu eleman analizi
// (08) her kontrolu nihai yukte yapti; gerilme_veri.js o sonuclari ve her
// kontrolun hangi kuvvetle buyudugunu tasir (18_simulator_gerilme.py uretir).
// Parcalar akma sinirinin altinda dogrusal elastik calistigi icin
//     gerilme(t) = gerilme(nihai) x F(t) / F(nihai)
// Istisnalar veride yazili: Hertz temasi F^(1/3) ile buyur, on yuklu
// civatalarda gerilmenin bir kismi sabittir.
// ============================================================================
import { GERILME } from './gerilme_veri.js';
export { GERILME };

/** Bir kontrolun y = {N, Fa, Y} [N] yuklerindeki degeri (kontrolun kendi biriminde). */
export function kontrolDegeri(k, y) {
  let d = 0;
  for (const kanal in k.pay) {
    const r = Math.max(0, y[kanal] || 0) / GERILME.ref[kanal];
    const v = k.pay[kanal] * Math.pow(r, k.us);
    d = k.birlesim === 'enbuyuk' ? Math.max(d, v) : d + v;
  }
  return k.sabit + d;
}

/**
 * Akmaya oran: 0 = yuksuz, 1 = akma (parca kalici egilir; burkulmada burkulur,
 * kelepcede kayar). Civata on yuku gibi inisten bagimsiz sabit pay hem degerden
 * hem sinirdan dusulur: oran, inisin kalan payin ne kadarini kullandigidir.
 */
export function kullanim(k, deger) {
  return Math.max(0, deger - k.sabit) / (k.akma - k.sabit);
}

/** Her parca icin en zorlanan kontrol: { kod: { u, k, deger } }. */
export function parcaDurumu(y) {
  const sonuc = {};
  for (const p of GERILME.parcalar) sonuc[p.kod] = { u: 0, k: null, deger: 0 };
  for (const k of GERILME.kontroller) {
    const deger = kontrolDegeri(k, y);
    const u = kullanim(k, deger);
    const s = sonuc[k.parca];
    if (!s.k || u > s.u) { s.u = u; s.k = k; s.deger = deger; }
  }
  return sonuc;
}

// ---------------------------------------------------------------- RENK OLCEGI
// Sonlu eleman programlarindaki gibi: mavi yuksuz, kirmizi akma. Sari, tasarim
// olcutunun sinirinda (2 m/s'de akmaya karsi emniyet 1,5 -> akmanin 2/3'u).
export const TASARIM_SINIRI = 1 / 1.5;
export const RAMPA = [
  [0.00, '#3157d5'],
  [0.30, '#1597b2'],
  [0.50, '#2f9e44'],
  [TASARIM_SINIRI, '#e8b90c'],
  [0.85, '#ef7d0f'],
  [1.00, '#e02424'],
  [1.25, '#7a0b1e'],
];
const RAMPA_RGB = RAMPA.map(([u, h]) => [u, parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]);

/** Akmaya oranin rengi: [r, g, b], her biri 0..1. */
export function rampa(u) {
  const R = RAMPA_RGB;
  if (!(u > R[0][0])) return R[0].slice(1);
  for (let i = 1; i < R.length; i++) {
    if (u <= R[i][0]) {
      const a = R[i - 1], b = R[i], f = (u - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    }
  }
  return R[R.length - 1].slice(1);
}

/** CSS rengi olarak. */
export function rampaCss(u) {
  const [r, g, b] = rampa(u);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
