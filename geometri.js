// ============================================================================
// ZENITH IV - INIS TAKIMI / GEOMETRI
// ----------------------------------------------------------------------------
// Butun olculer hesaplar/param.py, hesaplar/geometri.json ve
// hesaplar/amortisor.json dosyalarindan birebir alinmistir. Birim: mm.
// dogrula.mjs bu sayilari o JSON dosyalariyla karsilastirir; tasarim degisirse
// dogrulama burada eski kalan sayiyi yakalar.
// Bacak kinematigi (ucgen cercevenin D mafsali etrafinda donmesi) burada
// cozulur; hem 3B gorsel hem de dogrulama bu fonksiyonlari kullanir.
// ============================================================================

export const OLCU = {
  // ---- govde (gecen senenin CAD'inden olculdu) ----
  BORU_R: 128.5, BORU_OD: 30.0, BORU_Z0: 20.0, BORU_Z1: 935.0,
  ALT_PLAKA_Z0: 50.0, ALT_PLAKA_Z1: 62.0, ALT_PLAKA_R: 141.0,
  UST_ORUMCEK_R: 138.0, UST_ORUMCEK_Z: 930.0,
  GOVDE_ALT_Z: 3.0, ROKET_BOY: 1164.0,

  // ---- tasarim girdileri ----
  M_ROKET: 32.0, I_ROKET: [5.93, 5.93, 1.69], CG_Z: 480.0, N_BACAK: 3,

  // ---- bacak geometrisi (01f_hidrolik_geometri.py, 1 Kasim 2026) ----
  D_U: 215.0, D_Z: 20.0, D_Y: 38.5,      // alt mafsal (tek doner eksen)
  A_U: 215.0, A_Z: 295.0,                // kartusun ust gozu (boru kelepcesi)
  C_U: 301.34, C_Z: 114.60,              // kartusun alt gozu = ucgenin ust kosesi
  F_U: 560.0, F_Z: -67.0,                // ayak pimi
  AYAK_TEMAS_Z: -112.0, AYAK_PIM_OFS: 45.0,   // pabuc 14 + bosluk 3 + plaka F gozu R28
  DUSEY_STROK: 57.0,                     // zemine degen noktanin metal duraga kadar yolu

  // ---- parca olculeri (gorsel) ----
  PLAKA_T: 6.0, ENINE_OD: 34.0, KELEPCE_YARI: 45.0, KELEPCE_UST: 75.0,
  // yan plaka = uc kol + uc goz (P01): kol genislikleri ve goz yaricaplari
  KOL_GEN_DF: 14.0, KOL_GEN_DC: 16.0, KOL_GEN_CF: 32.0,
  GOZ_R_D: 22.0, GOZ_R_CF: 28.0,
  // ayak pabucu (P04, POM-C): bacaga SABIT, mafsalsiz. Ustu duz, tabani R200
  // kubbe; bacak strokta dondukce kubbe zeminde yuvarlanir.
  PAD_D: 100.0, PAD_T: 14.0, PAD_KUBBE_R: 200.0,
  SAP_U: 22.0, SAP_Y: 30.0,              // pabucu tasiyan sap (P03 ayak dugumu)

  // ---- geometri.json (02_geometri.py) dogrulanmis degerleri ----
  MA_0: 2.9060132965936907,       // kuvvet orani (yuksuz): temas yolu / amortisor yolu
  MA_1: 3.125206856315104,        // kuvvet orani (metal durak)
  L_AMORT_ACIK: 199.9968889758038,      // kartusun acik pim-pim boyu
  L_AMORT_KAPALI: 180.9963843541113,    // metal durakta
  AYAK_U_STROK: 569.7130618233917,      // ayak piminin metal duraktaki yaricapi
  TEMAS_U_STROK: 543.67004731189,       // zemine degen noktanin metal duraktaki yaricapi
  GABARI: 1073.3745091921871,     // kosegen (sinir 1200 mm)
  // amortisor sikismasi x [m] = X_S[0] s + X_S[1] s^2 + X_S[2] s^3   (s [m]: temas yukselmesi)
  X_S: [0.3439752172896808, -0.13985809407457675, -0.8209478316550615],
  // zemine degen nokta 1 mm yukselirken govdeye gore ortalama ne kadar disari gider
  // (kubbeli pabucta temas noktasi ICERI kayar: eksi)
  DISA_EGIM: -0.28649039803701726,
};

// ============================================================================
//  AMORTISOR  -  AIRTAC ACA2020-2 (kendini ayarlayan hidrolik) + KARTUS
// ----------------------------------------------------------------------------
// Model degerleri hesaplar/amortisor.json'dan (amortisor.py, 03_amortisor_secimi.py).
//   F = F_yay(x) + K v^2/max(1 - x/S_h, eps)  [sikisma]   + halka + metal durak
// Kartus olculeri hesaplar/param.py'den; eksen boyunca ust gozden (A) mm.
// Amortisorun olculeri ureticinin resmi 2B teknik resminden (Airtac DWG).
// ============================================================================
export const AMORT = {
  URUN: 'Airtac ACA2020-2', YEDEK: 'SMC RB2015',
  // ---- fizik (amortisor.json -> model) ----
  K: 3333.333333333333,      // hidrolik sabit [N s2/m2] = M_diz / (2 S_h)
  M_diz: 120.0,              // katalog egrisinin dizindeki kutle [kg]
  S: 0.02, S_h: 0.018000000000000002, eps: 0.05,
  F0: 8.0, F1: 20.0,         // geri donus yayi [N] (acik / sikisik)
  c_geri: 50.0,              // acilmada direnc [N s/m] (cek valf)
  x_t: 0.014, k_t: 514773.84548482427, c_t: 2108.94429158024,     // poliuretan halka (Shore 95A)
  x_d: 0.019, k_d: 50000000.0, c_d: 41569.219381653056,           // metal durak
  // ---- kartus (param.py) ----
  L0: 200.0, TEMAS: 141.3,   // pim-pim acik boy; itici yuzu (acik) A'dan
  KOVAN_ARKA_R: 13.0, KOVAN_ON_R: 17.0, KOVAN_DIS_SON: 80.0, KOVAN_ON_SON: 159.8,
  GOZ_R_A: 13.0, GOZ_R_C: 11.0, GOZ_GEN: 6.0,
  ITICI_KAFA_R: 14.5, ITICI_KAFA_T: 6.0, ITICI_MIL_R: 6.0,
  TAMPON_KOVANI_R: 14.5, PU_DIS: 25.0, PU_T: 15.0, PU_H: 5.0,
  // ---- amortisor govdesi (resmi DWG, baslik ucundan) ----
  BOY: 127.3, UC_GOVDE: 35.0, GOVDE_CAP: 20.0, BASLIK_CAP: 18.0, BASLIK_BOY: 15.0, MIL_CAP: 6.0,
  KUTLE_G: 175.0,
};

// ============================================================================
//  GOVDE YERLESIMI  -  GECEN SENEKI KTR CAD MONTAJINDAN OLCULDU
// ----------------------------------------------------------------------------
// Kaynak:  gecen seneki KTR'nin CAD montaji (Zenith_3.step)
// 166 kati parcanin sinir kutusu gmsh/OpenCASCADE ile okundu; eksen, basinc
// tupunun merkezi alindi. Asagidaki sayilar TAHMIN DEGIL, o montajdan cikti.
// z = 0  ->  karbon borularin alt ucu (CAD orijini).
//
// NOT: Roketin burun konisi YOKTUR; govde acik bir kafestir. Luleler govdenin
// ALTINDA degil, USTTEKI Y-plakanin uclarinda, r = 300 mm'de bulunur ve asagi
// bakar. KTR metni "250 mm" yaziyor; CAD 300 mm gosteriyor, CAD esas alindi.
// ============================================================================
export const KTR = {
  // ---- govde kafesi ----
  BORU_R: 128.5, BORU_OD: 30.0, BORU_Z: [0.0, 935.0],
  BORU_AZ: [105, 225, 345],            // derece - bacaklarla ayni hizada
  // ---- alt bolge ----
  ALT_BLOK_R: 140.9, ALT_BLOK_Z: [30.0, 42.0],
  AVIYONIK_Z: [42.0, 155.5], AVIYONIK_GEN: [230.0, 152.2],
  // TF02 Pro, asagi bakar. Eski yeri eksende z 4.2-30 idi (alt plakanin altinda); duran roket 10 cm'lik
  // kor bolgede kaliyordu. 3 Kasim 2026: yine eksende, aviyonik kutusunun tabaninda (mercek 45 mm yukarida);
  // isin alt plakadaki pencereden gecer (param.py LIDAR_*, PENCERE).
  LIDAR_Z: [49.5, 75.3], LIDAR_GEN: [37.0, 55.0], LIDAR_AZ: 0.0, LIDAR_R: 0.0, LIDAR_PENCERE: [36.0, 46.0],
  // ---- basinc tupu ve hizalama yuzukleri ----
  TANK_R: 87.5, TANK_Z: [170.0, 740.0],            // kompozit, 9 litre
  ALT_YUZUK_R: 137.6, ALT_YUZUK_Z: [207.5, 215.5],
  UST_YUZUK_R: 137.6, UST_YUZUK_Z: [684.5, 692.5],
  SILIKON_ALT_Z: [211.1, 216.1], SILIKON_UST_Z: [685.5, 690.5],
  // ---- pnomatik ----
  MANIFOLD_GEN: 65.8, MANIFOLD_Z: [745.8, 836.8],  // eksen uzerinde
  SOLENOID_R: 64.7, SOLENOID_Z: [713.3, 789.3],
  HORTUM_Z: [797.3, 1062.7],                       // esnek yuksek basinc hatlari
  // ---- ust plaka ve itki grubu ----
  UST_PLAKA_YARI: 291.0, UST_PLAKA_Z: [918.0, 930.0],
  LULE_R: 300.0, LULE_Z: [928.5, 946.9], LULE_AZ: [45, 165, 285],
  VALF_R: 291.0, VALF_Z: [938.5, 991.5], VALF_GEN: 42.0,
  MOTOR_R: 258.5, MOTOR_Z: [937.0, 993.0], MOTOR_GEN: [74.3, 89.8],
  UBOLT_GEN: 46.1, UBOLT_Z: [943.0, 1049.0],       // vinc baglanti gozu
  // ---- lule ic geometrisi (KTR s.14) ----
  LULE_GIRIS_CAP: 14.0, LULE_BOGAZ_CAP: 3.0, LULE_CIKIS_CAP: 10.0,
  LULE_YAKINSAK_ACI: 45.0, LULE_IRAKSAK_ACI: 15.0,
  // ---- luleler bacaklara gore 60 derece kaymis (CAD: 45 vs 345) ----
  LULE_AZ_OFSET: 60.0,
};

/** Lulenin eksenel kesit hatti [ [r, z], ... ] - De Laval konturu. */
export function luleKesiti() {
  const rg = KTR.LULE_GIRIS_CAP / 2, rb = KTR.LULE_BOGAZ_CAP / 2;
  const rc = KTR.LULE_CIKIS_CAP / 2;
  const Lyak = (rg - rb) / Math.tan(KTR.LULE_YAKINSAK_ACI * Math.PI / 180);
  const Lira = (rc - rb) / Math.tan(KTR.LULE_IRAKSAK_ACI * Math.PI / 180);
  return { rg, rb, rc, Lyak, Lira, boy: Lyak + Lira };
}

// ---------------------------------------------------------------- KINEMATIK
// Ucgen cerceve (D-C-F) tek bir eksen etrafinda doner: D mafsali, tegetsel (y)
// dogrultuda. Noktalar D'ye gore (u = radyal, w = dusey) ikililerle tutulur.
const uF = OLCU.F_U - OLCU.D_U;        // 345
const wF = OLCU.F_Z - OLCU.D_Z;        // -87
const uC = OLCU.C_U - OLCU.D_U;        // 86.34
const wC = OLCU.C_Z - OLCU.D_Z;        // 94.60
const uA = OLCU.A_U - OLCU.D_U;        //   0
const wA = OLCU.A_Z - OLCU.D_Z;        // 275
// pabuc tabaninin ortasi ve taban kubbesinin merkezi (pabuc bacaga sabit)
const wT = wF - OLCU.AYAK_PIM_OFS;     // -132
const wK = wT + OLCU.PAD_KUBBE_R;      //   68
// Zemine degen nokta kubbe merkezinin (K) tam altindadir; ayagin zemine gore
// yukselmesi K'nin yukselmesidir. Fizik (sim.py gibi) s'yi bu noktadan olcer.
const RK = Math.hypot(uF, wK);
const PHI_K = Math.atan2(uF, wK);

/** D'ye gore (u,w) noktasini theta kadar dondurur. theta>0 -> ayak YUKSELIR. */
export function donustur(u, w, th) {
  const ct = Math.cos(th), st = Math.sin(th);
  return [u * ct - w * st, u * st + w * ct];
}

/** Zemine degen noktanin s_mm kadar DUSEY yukselmesine karsilik gelen cerceve donme acisi. */
export function bacakAcisi(s_mm) {
  const c = (wK + s_mm) / RK;
  return PHI_K - Math.acos(Math.max(-1, Math.min(1, c)));
}

/** Verilen donme acisinda bacagin onemli noktalari (govde koordinatlarinda). */
export function bacakNoktalari(th) {
  const [fu, fw] = donustur(uF, wF, th);
  const [cu, cw] = donustur(uC, wC, th);
  const [tu, tw] = donustur(uF, wT, th);
  const [ku, kw] = donustur(uF, wK, th);
  return {
    D: [OLCU.D_U, OLCU.D_Z],
    A: [OLCU.A_U, OLCU.A_Z],
    C: [OLCU.D_U + cu, OLCU.D_Z + cw],
    F: [OLCU.D_U + fu, OLCU.D_Z + fw],
    // pabuc tabaninin ortasi: pabuc bacaga sabit oldugu icin bacakla doner
    T: [OLCU.D_U + tu, OLCU.D_Z + tw],
    // zemine degen nokta: kubbenin en alt noktasi, kubbe merkezinin tam altinda
    TEMAS: [OLCU.D_U + ku, OLCU.D_Z + kw - OLCU.PAD_KUBBE_R],
  };
}

/**
 * Pabucun yan kesiti, pabuca gore [r, h] ikilileri (r: eksenden, h: taban
 * ortasindan yukari). Kubbeli tabandan baslar, duz ust yuzle kapanir.
 * 3B'de donel govde, 2B kesitte cokgen olarak kullanilir.
 */
export function pabucProfili(n = 12) {
  const R = OLCU.PAD_D / 2, Rk = OLCU.PAD_KUBBE_R;
  const p = [];
  for (let i = 0; i <= n; i++) {
    const r = R * i / n;
    p.push([r, Rk - Math.sqrt(Rk * Rk - r * r)]);   // kenarda 6.35 mm yukarida
  }
  p.push([R, OLCU.PAD_T], [0, OLCU.PAD_T]);
  return p;
}

/** Kartusun pim-pim boyu [mm]. Acikken 200.0, metal durakta 181.0. */
export function amortisorBoyu(th) {
  const [cu, cw] = donustur(uC, wC, th);
  return Math.hypot(cu - uA, cw - wA);
}

/** Anlik kuvvet orani MA = d(zemine degen noktanin dusey yolu) / d(amortisor sikismasi). */
export function kuvvetOrani(th) {
  const e = 1e-5;
  const ds = donustur(uF, wK, th + e)[1] - donustur(uF, wK, th - e)[1];
  const dL = amortisorBoyu(th - e) - amortisorBoyu(th + e);
  return ds / dL;
}

// --------------------------------------------------------------- OZ DENETIM
/** Kinematigin geometri.json (02_geometri.py) sonuclariyla tutarliligini olcer. */
export function kinematikDenetimi() {
  const th = bacakAcisi(OLCU.DUSEY_STROK);
  const n = bacakNoktalari(th);
  const n0 = bacakNoktalari(0);
  return {
    aci_deg: th * 180 / Math.PI,                  // beklenen 9.6727
    ayak_radyal_mm: n.F[0],                       // beklenen 569.713 (ayak pimi)
    amort_acik_mm: amortisorBoyu(0),              // beklenen 199.997
    amort_kapali_mm: amortisorBoyu(th),           // beklenen 180.996
    MA_0: kuvvetOrani(0),                         // beklenen 2.90601
    MA_1: kuvvetOrani(th),                        // beklenen 3.12521
    disa_egim: (n.TEMAS[0] - n0.TEMAS[0]) / OLCU.DUSEY_STROK,  // beklenen -0.2865
    // bilgi: ayak piminin yukselmesi (temas noktasindan biraz fazla)
    temas_yukselme_mm: n.TEMAS[1] - n0.TEMAS[1],
    temas_kayma_mm: n.TEMAS[0] - n0.TEMAS[0],
    pim_yukselme_mm: n.F[1] - n0.F[1],
  };
}
