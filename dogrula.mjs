// ============================================================================
// ZENITH IV - SIMULASYON / DOGRULAMA
// ----------------------------------------------------------------------------
// fizik.js (tarayici motoru) ile sim.py (dogrulanmis Python cozucusu) ayni
// sonucu vermek zorundadir. Bu betik ikisini karsilastirir.
//
//   node dogrula.mjs
//
// referans.json dosyasini python_referans.py uretir.
// Cikti ayni zamanda dogrulama.json olarak kaydedilir; arayuzdeki
// "Dogrulama" paneli bu sayilari gosterir.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kosu, ItkiSistemi, G } from './fizik.js';
import { kinematikDenetimi, OLCU } from './geometri.js';

const BURASI = dirname(fileURLToPath(import.meta.url));
const REF = JSON.parse(readFileSync(join(BURASI, 'referans.json'), 'utf8'));
// Tasarimin kaynagi: hesaplar/geometri.json (02_geometri.py ciktisi)
const GEO_YOL = join(BURASI, '..', 'hesaplar', 'geometri.json');
const GEO = existsSync(GEO_YOL) ? JSON.parse(readFileSync(GEO_YOL, 'utf8')) : null;

const yesil = (s) => `\x1b[32m${s}\x1b[0m`;
const kirmizi = (s) => `\x1b[31m${s}\x1b[0m`;
const kalin = (s) => `\x1b[1m${s}\x1b[0m`;

let hata_sayisi = 0;
const rapor = { testler: [], parametre: {}, kinematik: {}, itki: {}, statik: {} };

function bagil(a, b) {
  const d = Math.max(Math.abs(b), 1e-9);
  return Math.abs(a - b) / d * 100;
}

console.log('='.repeat(78));
console.log(kalin('  ZENITH IV - fizik.js  <->  sim.py  DOGRULAMASI'));
console.log('='.repeat(78));

// ------------------------------------------------------ 0) PARAMETRE ESLESMESI
// Simulasyonun kullandigi sayilar tasarim dosyalariyla BIREBIR ayni olmali.
// a) geometri.js  <->  hesaplar/geometri.json
// b) fizik.js'in kurdugu model  <->  python_referans.py'nin sim.py'ye verdigi
//    model (referans.json -> model; o da param.py ve amortisor.json'dan okur)
console.log('\n' + kalin('0) PARAMETRE ESLESMESI  (tasarim dosyalariyla birebir mi?)'));
const esles = (ad, js, bekle, grup) => {
  const h = bagil(js, bekle);
  const ok = h < 1e-6;
  if (!ok) hata_sayisi++;
  console.log(`   ${ad.padEnd(30)} ${String(+js.toPrecision(10)).padStart(14)} ` +
    `(beklenen ${String(+bekle.toPrecision(10)).padStart(14)})  ` +
    (ok ? yesil('TAMAM') : kirmizi('ESKI KALMIS')));
  rapor.parametre[grup + ' ' + ad] = { js, beklenen: bekle, ok };
};
if (GEO) {
  console.log('   a) geometri.js <-> hesaplar/geometri.json');
  for (const [ad, js, bekle] of [
    ['D yatay u [mm]', OLCU.D_U, GEO.D[0]], ['D dusey z [mm]', OLCU.D_Z, GEO.D[1]],
    ['A yatay u [mm]', OLCU.A_U, GEO.A[0]], ['A dusey z [mm]', OLCU.A_Z, GEO.A[1]],
    ['C yatay u [mm]', OLCU.C_U, GEO.C[0]], ['C dusey z [mm]', OLCU.C_Z, GEO.C[1]],
    ['F yatay u [mm]', OLCU.F_U, GEO.F[0]], ['F dusey z [mm]', OLCU.F_Z, GEO.F[1]],
    ['zemin temasi z [mm]', OLCU.AYAK_TEMAS_Z, GEO.TEMAS_Z],
    ['dusey strok [mm]', OLCU.DUSEY_STROK, GEO.DUSEY_STROK],
    ['MA_0 [-]', OLCU.MA_0, GEO.MA_0], ['MA_1 [-]', OLCU.MA_1, GEO.MA_1],
    ['amortisor acik boyu [mm]', OLCU.L_AMORT_ACIK, GEO.L_amort_acik],
    ['amortisor kapali boyu [mm]', OLCU.L_AMORT_KAPALI, GEO.L_amort_kapali],
    ['ayak yaricapi tam strok [mm]', OLCU.AYAK_U_STROK, GEO.ayak_u_strok],
    ['temas yaricapi tam strok [mm]', OLCU.TEMAS_U_STROK, GEO.temas_u_strok],
    ['gabari [mm]', OLCU.GABARI, GEO.gabari],
    ['x(s) katsayisi a1 [-]', OLCU.X_S[0], GEO.x_s[0]],
    ['x(s) katsayisi a2 [1/m]', OLCU.X_S[1], GEO.x_s[1]],
    ['x(s) katsayisi a3 [1/m2]', OLCU.X_S[2], GEO.x_s[2]],
    ['disa egim (kubbe temasi) [-]', OLCU.DISA_EGIM, GEO.disa_egim],
  ]) esles(ad, js, bekle, 'geometri');
} else {
  console.log(kirmizi('   hesaplar/geometri.json bulunamadi - (a) atlandi'));
}
console.log('   b) fizik.js modeli <-> sim.py modeli (referans.json)');
const mj = kosu({ itki_yok: true, sabit_dt: 1e-3, t_son: 1e-3, h0: 0.01,
                  v0: [0, 0, 0], kare_hz: 1000 }).model;
const RM = REF.model, RA = REF.model.amort;
for (const [ad, js, bekle] of [
  ['kutle [kg]', mj.m, RM.m],
  ['atalet Ix [kg m2]', mj.I[0], RM.I[0]], ['atalet Iz [kg m2]', mj.I[2], RM.I[2]],
  ['ayak yaricapi [m]', mj.r_ayak, RM.r_ayak], ['zemin temasi z [m]', mj.z_ayak, RM.z_ayak],
  ['agirlik merkezi z [m]', mj.cg_z, RM.cg_z],
  ['x(s) a1 [-]', mj.a1, RM.x_s[0]], ['x(s) a2 [1/m]', mj.a2, RM.x_s[1]],
  ['x(s) a3 [1/m2]', mj.a3, RM.x_s[2]], ['dusey strok [m]', mj.smax, RM.strok_dusey],
  ['disa egim [-]', mj.disa, RM.disa_egim],
  ['hidrolik sabit K [N s2/m2]', mj.K, RA.K], ['strok S [m]', mj.S, RA.S],
  ['delik kapanma S_h [m]', mj.Sh, RA.S_h], ['sizinti eps [-]', mj.eps, RA.eps],
  ['geri donus yayi acik [N]', mj.F0, RA.F0], ['geri donus yayi sikisik [N]', mj.F1, RA.F1],
  ['acilma direnci [N s/m]', mj.cg, RA.c_geri],
  ['halka devreye girme [m]', mj.xt, RA.x_t], ['halka rijitligi [N/m]', mj.kt, RA.k_t],
  ['halka sonumu [N s/m]', mj.ct, RA.c_t],
  ['metal durak [m]', mj.xd, RA.x_d], ['metal durak rijitligi [N/m]', mj.kd, RA.k_d],
  ['metal durak sonumu [N s/m]', mj.cd, RA.c_d], ['surtunme mu [-]', mj.mu, RM.mu],
]) esles(ad, js, bekle, 'model');

// ---------------------------------------------------------------- 1) KINEMATIK
console.log('\n' + kalin('1) BACAK KINEMATIGI  (hesaplar/geometri.json ile)'));
const kin = kinematikDenetimi();
// Beklenen degerler Python'un geometri hesabindan (02_geometri.py); dosya
// yoksa geometri.js'e yazilmis kopyalari kullanilir.
const kin_bekle = GEO ? {
  aci_deg: GEO.tmax_deg, ayak_radyal_mm: GEO.ayak_u_strok,
  amort_acik_mm: GEO.L_amort_acik, amort_kapali_mm: GEO.L_amort_kapali,
  MA_0: GEO.MA_0, MA_1: GEO.MA_1,
  disa_egim: GEO.disa_egim,
} : {
  aci_deg: kin.aci_deg, ayak_radyal_mm: OLCU.AYAK_U_STROK,
  amort_acik_mm: OLCU.L_AMORT_ACIK, amort_kapali_mm: OLCU.L_AMORT_KAPALI,
  MA_0: OLCU.MA_0, MA_1: OLCU.MA_1, disa_egim: OLCU.DISA_EGIM,
};
const kin_ad = {
  aci_deg: 'cerceve donmesi, tam strok [der]',
  ayak_radyal_mm: 'ayak yaricapi, tam strokta [mm]',
  amort_acik_mm: 'kartus acik boyu           [mm]',
  amort_kapali_mm: 'kartus metal durakta boyu  [mm]',
  MA_0: 'kuvvet orani MA_0          [-]',
  MA_1: 'kuvvet orani MA_1          [-]',
  disa_egim: 'temas noktasi disa egimi   [-]',
};
for (const k of Object.keys(kin_bekle)) {
  const h = bagil(kin[k], kin_bekle[k]);
  const ok = h < 0.2;
  if (!ok) hata_sayisi++;
  console.log(`   ${kin_ad[k]}  ${kin[k].toFixed(4).padStart(11)} ` +
    `(beklenen ${kin_bekle[k].toFixed(4).padStart(10)})  hata ${h.toFixed(4)}%  ` +
    (ok ? yesil('TAMAM') : kirmizi('HATA')));
  rapor.kinematik[k] = { js: kin[k], beklenen: kin_bekle[k], hata: h };
}
// Bilgi (test degil): fizik s'yi kubbeli pabucun zemine degen noktasindan olcer;
// metal durakta ayak pimi biraz daha fazla yukselir.
console.log(`   bilgi: metal durakta zemine degen nokta ` +
  `${kin.temas_yukselme_mm.toFixed(1)} mm yukselir ve ${(-kin.temas_kayma_mm).toFixed(1)} mm ` +
  `iceri kayar; ayak pimi ${kin.pim_yukselme_mm.toFixed(1)} mm yukselir`);
rapor.kinematik.temas_yukselme_mm = kin.temas_yukselme_mm;
rapor.kinematik.temas_kayma_mm = kin.temas_kayma_mm;

// --------------------------------------------- 2) ITKI SISTEMI (KTR ile)
// Beklenen degerler GECEN SENEKI KTR RAPORUNDAN alinmistir (s.13-15):
// azot, 3 mm bogaz, 10 mm cikis, 300 bar, 298 K.
console.log('\n' + kalin('2) SOGUK GAZ SISTEMI  (gecen seneki KTR s.13-15 ile)'));
const S = new ItkiSistemi({});
const tam = S.tamItki();
const itki_test = [
  ['bogaz capi                 [mm]', S.d_bogaz * 1000, 3.0, 0.5],
  ['cikis capi                 [mm]', S.d_cikis * 1000, 10.0, 0.5],
  ['alan orani Ae/At            [-]', S.alan_orani, 11.11, 0.5],
  ['cikis Mach sayisi           [-]', S.Me, 4.03, 1.0],
  ['cikis statik sicakligi      [K]', S.Te, 70.1, 1.5],
  ['cikis hizi Ve             [m/s]', S.Ve, 688.0, 0.5],
  ['tek lule debisi          [kg/s]', tam.mdot, 0.488, 0.5],
  ['tupteki azot kutlesi       [kg]', S.m_gaz0, 3.05, 0.5],
  ['lule itkisi (ideal)         [N]', S.F_tasarim_ideal, 344.0, 0.5],
  ['tam itkide gaz suresi       [s]', S.m_gaz0 / (3 * tam.mdot), 2.08, 2.0],
  ['lule yaricapi (CAD)        [mm]', S.r_lule * 1000, 300.0, 0.5],
];
for (const [ad, js, bekle, tol] of itki_test) {
  const h = bagil(js, bekle);
  const ok = h < tol;
  if (!ok) hata_sayisi++;
  console.log(`   ${ad}  ${js.toFixed(3).padStart(11)} ` +
    `(KTR ${bekle.toFixed(3).padStart(10)})  hata ${h.toFixed(3)}%  ` +
    (ok ? yesil('TAMAM') : kirmizi('HATA')));
  rapor.itki[ad.trim()] = { js, ktr: bekle, hata: h };
}
// KTR s.15: 5 saniye hover -> 1.80 kg gaz harcanir, tankta 1.25 kg kalir,
// basinc 85.8 bar'a, sicaklik 207.7 K'e duser. Adyabatik bosalma denetimi.
const S2 = new ItkiSistemi({});
S2.m_gaz = S2.m_gaz0 - 1.80;
const h2 = S2.tankHali();
for (const [ad, js, bekle, tol] of [
  ['5 s hover sonrasi basinc [bar]', h2.P / 1e5, 85.8, 1.5],
  ['5 s hover sonrasi sicaklik [K]', h2.T, 207.7, 1.5],
]) {
  const h = bagil(js, bekle);
  const ok = h < tol;
  if (!ok) hata_sayisi++;
  console.log(`   ${ad}  ${js.toFixed(3).padStart(11)} ` +
    `(KTR ${bekle.toFixed(3).padStart(10)})  hata ${h.toFixed(3)}%  ` +
    (ok ? yesil('TAMAM') : kirmizi('HATA')));
  rapor.itki[ad.trim()] = { js, ktr: bekle, hata: h };
}

// ---------------------------------------------------------- 3) STATIK DENGE
console.log('\n' + kalin('3) STATIK DENGE  (modelin kendi dogrulamasi)'));
const st = REF.statik;
const sr = kosu({
  itki_yok: true, sabit_dt: st.dt, t_son: st.t_son, h0: st.h0,
  v0: [0, 0, st.v0], kare_hz: 500,
});
const N_son = sr.kayit.N[sr.kayit.N.length - 1];
const s_son = sr.kayit.s[sr.kayit.s.length - 1][0] * 1000;
const x_son = sr.kayit.x[sr.kayit.x.length - 1][0] * 1000;
const W = REF.model.m * G;
const st_test = [
  ['roket agirligi              [N]', W, st.agirlik_N, 0.01],
  ['3 bacagin toplam tepkisi    [N]', N_son, st.tepki_N, 0.05],
  ['duran roket: ayak yolu     [mm]', s_son, st.cokme_mm, 0.5],
  ['amortisor sikismasi        [mm]', x_son, st.x_mm, 0.5],
  ['analitik (halka agirligi tasir) ', x_son, st.x_analitik_mm, 0.5],
];
for (const [ad, js, bekle, tol] of st_test) {
  const h = bagil(js, bekle);
  const ok = h < tol;
  if (!ok) hata_sayisi++;
  console.log(`   ${ad}  ${js.toFixed(4).padStart(11)} ` +
    `(Python ${bekle.toFixed(4).padStart(13)})  hata ${h.toFixed(4)}%  ` +
    (ok ? yesil('TAMAM') : kirmizi('HATA')));
  rapor.statik[ad.trim()] = { js, python: bekle, hata: h };
}
rapor.statik.agirlik_hatasi_yuzde = bagil(N_son, W);
console.log(`   -> agirligin tepki kuvvetiyle kapanmasi: ` +
  kalin(`%${bagil(N_son, W).toFixed(4)} hata`));

// ------------------------------------------------- 4) YUK DURUMLARI (T1..T7)
console.log('\n' + kalin('4) YUK DURUMLARI  (sim.py T1..T8, itki kapali)'));
const alanlar = [
  ['strok_max_mm', 'strok [mm]', 0.5],
  ['x_max_mm', 'x amort [mm]', 0.5],
  ['Fa_max_N', 'F_amort [N]', 0.5],
  ['N_max_N', 'N_ayak [N]', 0.5],
  ['Ft_max_N', 'F_yanal [N]', 1.0],
  ['ivme_max_g', 'ivme [g]', 0.5],
  ['egim_max_deg', 'egim [der]', 1.0],
];
console.log('   ' + 'TEST'.padEnd(32) +
  alanlar.map(a => a[1].padStart(12)).join('') + '   en buyuk hata');
let en_buyuk_hata = 0;
for (const T of REF.testler) {
  const g = T.girdi;
  const r = kosu({
    itki_yok: true, sabit_dt: REF.dt, t_son: REF.t_son,
    h0: 0.004,
    v0: g.v0 || [0, 0, 0],
    vx: g.vx !== undefined ? g.vx : 0,
    egim_deg: g.egim_deg || 0,
    egim_yonu_deg: g.egim_yonu_deg || 0,
    kare_hz: 200,
  });
  const satir = [];
  let en = 0;
  const kayit_satiri = { ad: T.ad, alanlar: {} };
  for (const [k, , tol] of alanlar) {
    const h = bagil(r.ozet[k], T[k]);
    if (h > en) en = h;
    if (h > tol) hata_sayisi++;
    satir.push(r.ozet[k].toFixed(1).padStart(12));
    kayit_satiri.alanlar[k] = { js: r.ozet[k], python: T[k], hata: h };
  }
  const dev_ok = r.ozet.devrildi === T.devrildi;
  if (!dev_ok) hata_sayisi++;
  kayit_satiri.devrildi = { js: r.ozet.devrildi, python: T.devrildi, ok: dev_ok };
  kayit_satiri.en_buyuk_hata = en;
  rapor.testler.push(kayit_satiri);
  if (en > en_buyuk_hata) en_buyuk_hata = en;
  console.log('   ' + T.ad.padEnd(32) + satir.join('') +
    `   ${en < 0.5 ? yesil('%' + en.toFixed(3)) : kirmizi('%' + en.toFixed(3))}` +
    (dev_ok ? '' : kirmizi('  DEVRILME UYUSMADI')));
}
rapor.en_buyuk_hata = en_buyuk_hata;

// ------------------------------------------------------------ 5) ENERJI DENGESI
console.log('\n' + kalin('5) ENERJI DENGESI  (bagimsiz oz denetim)'));
// Serbest dususte (temas yok, itki yok, hava yok) toplam enerji korunmalidir.
const er = kosu({
  itki_yok: true, irtifa: 6.0, sabit_dt: 1e-4, t_son: 0.8, kare_hz: 1000,
});
const k0 = 0, k1 = er.kayit.t.length - 1;
const E = (i) => 0.5 * 32 * (er.kayit.vz[i] ** 2) + 32 * G * er.kayit.r[i][2];
const E0 = E(k0), E1 = E(k1);
const e_hata = Math.abs(E1 - E0) / Math.abs(E0) * 100;
const e_ok = e_hata < 0.001;
if (!e_ok) hata_sayisi++;
console.log(`   serbest dususte toplam enerji  ${E0.toFixed(4)} J -> ` +
  `${E1.toFixed(4)} J   hata ${e_hata.toExponential(2)}%  ` +
  (e_ok ? yesil('TAMAM') : kirmizi('HATA')));
rapor.enerji = { E0, E1, hata: e_hata };

// ----------------------------------------------------------------- 6) SONUC
console.log('\n' + '='.repeat(78));
if (hata_sayisi === 0) {
  console.log(kalin(yesil('  SONUC: TUM TESTLER GECTI')) +
    `   -  en buyuk sapma  %${en_buyuk_hata.toFixed(4)}`);
  console.log('  Tarayicidaki fizik, sim.py ile ayni sonucu veriyor.');
} else {
  console.log(kalin(kirmizi(`  SONUC: ${hata_sayisi} TEST BASARISIZ`)));
}
console.log('='.repeat(78));

rapor.tarih = new Date().toISOString().slice(0, 10);
rapor.hata_sayisi = hata_sayisi;
rapor.gecti = hata_sayisi === 0;
writeFileSync(join(BURASI, 'dogrulama.json'), JSON.stringify(rapor, null, 1), 'utf8');
console.log('\n-> dogrulama.json yazildi');
process.exit(hata_sayisi === 0 ? 0 : 1);
