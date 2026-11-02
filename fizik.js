// ============================================================================
// ZENITH IV - INIS TAKIMI / FIZIK MOTORU
// ----------------------------------------------------------------------------
// hesaplar/sim.py dosyasinin BIREBIR JavaScript karsiligi + SOGUK GAZ ITKI
// SISTEMI. sim.py 6 serbestlik dereceli rijit cisim + 3 esnek bacak + zemin
// surtunmesi + govde-zemin carpismasini RK4 ile cozer; burada ayni denklemler,
// ayni katsayilar ve ayni integrasyon semasi kullanilir.
//
// Dogrulama:  itki kapali iken bu motor sim.py ile ayni sonucu vermek
// zorundadir. dogrula.mjs bunu python_referans.py ciktisiyla karsilastirir.
//
// EKLENEN KATMANLAR (sim.py'de yok, bu simulasyon icin yazildi)
//   1) TUP BOSALMASI   - 9 L / 300 bar tupun adyabatik bosalmasi
//   2) LULE ITKISI     - bogulmus (choked) akis; itki anlik tank basinciyla
//   3) VALF            - selenoid AC/KAPA + PWM + acilma/kapanma gecikmesi
//   4) KONTROL YASASI  - irtifa/hiz PID + 3 lule arasi itki farkiyla egim
//
// KABULLER (sim.py'den devralinan)
//   1. Bacak kutlesi ihmal (uc bacagin donen parcalari ~2.4 / 32 kg).
//   2. Zemin rijit (beton).
//   3. Amortisor: kendini ayarlayan endustriyel hidrolik amortisor (Airtac
//      ACA2020-2). Ic yapisi yayimlanmadigi icin ideal model:
//        F = F_yay(x) + K v^2 / max(1 - x/S_h, eps) + halka + metal durak
//      Statik olarak yuk tasimaz; duran roket poliuretan halkaya oturur.
//   4. Aerodinamik surukleme ihmal -> burada SECENEK olarak eklendi
//      (varsayilan KAPALI, boylece dogrulanmis modelle ayni kalir).
//   5. Zemine degen nokta (kubbeli pabucun en alt noktasi) govdeye gore
//      dogrusal bir yolda hareket eder: yukari ve ortalama 0.2865 oraninda
//      ICERI. Amortisor sikismasi x(s) bacak geometrisinden polinomdur;
//      kuvvet orani strok boyunca 2.91'den 3.13'e cikar.
//
// Bacak geometrisi ve amortisor degerleri geometri.js'ten okunur (OLCU, AMORT).
// ============================================================================
import { OLCU, AMORT } from './geometri.js';

export const G = 9.80665;

// ------------------------------------------------------------- QUATERNION
// Sira sim.py ile ayni: [w, x, y, z]
export function qCarp(a, b) {
  const w1 = a[0], x1 = a[1], y1 = a[2], z1 = a[3];
  const w2 = b[0], x2 = b[1], y2 = b[2], z2 = b[3];
  return [w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
          w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
          w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
          w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2];
}

/** Donme matrisi, satir sirali 9 elemanli dizi (R[3*i+j]). */
export function qMatris(q, out) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  const w = q[0] / n, x = q[1] / n, y = q[2] / n, z = q[3] / n;
  const R = out || new Float64Array(9);
  R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - w * z); R[2] = 2 * (x * z + w * y);
  R[3] = 2 * (x * y + w * z); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - w * x);
  R[6] = 2 * (x * z - w * y); R[7] = 2 * (y * z + w * x); R[8] = 1 - 2 * (x * x + y * y);
  return R;
}

export function qEksenAci(ex, ey, ez, aci) {
  const n = Math.hypot(ex, ey, ez) || 1;
  const s = Math.sin(aci / 2);
  return [Math.cos(aci / 2), ex / n * s, ey / n * s, ez / n * s];
}

// =========================================================================
//  SOGUK GAZ ITKI SISTEMI
// =========================================================================
//
// 1) TUP BOSALMASI
//    Tupten gaz ciktikca geride kalan gaz GENISLEYEREK sogur ve basinci
//    duser (adyabatik bosalma):   P/rho^g = sabit,  T/rho^(g-1) = sabit
//    9 L / 300 bar / 20 C hava  ->  3.21 kg gaz.
//
// 2) LULE ITKISI
//    Bogazda akis BOGULMUSTUR (ses hizina ulasir), debi sadece bogaz
//    kesitine ve tank sartlarina baglidir:
//       mdot = Cd * At * P0 * sqrt(g/(R*T0)) * (2/(g+1))^((g+1)/(2(g-1)))
//    Itki:  F = mdot * Ve.  Ve, tank sogudukca sqrt(T) ile duser.
//    Sonuc olarak itki anlik tank basinciyla DOGRU ORANTILIDIR.
//    Bogaz capi, 300 bar'da lule basina 344 N verecek sekilde secilmistir.
//
// 3) VALF
//    Selenoid valf sadece TAM ACIK / TAM KAPALI calisir, kisilamaz. Itki
//    PWM (darbe genislik modulasyonu) ile ayarlanir: valf saniyede onlarca
//    kez acilip kapanir, ortalama itki "doluluk orani" ile belirlenir.
//    Valfin acilmasi/kapanmasi ani degildir (10-20 ms). Darbe suresi
//    acilma suresinden kisa kalirsa valf TAM ACILAMAZ -> kontrol zorlasir.
//
export class ItkiSistemi {
  constructor(o) {
    o = o || {};
    const g = (k, v) => (o[k] !== undefined ? o[k] : v);
    // ---- GAZ: AZOT (KTR s.13) ----
    this.V = g('V', 0.009);                 // tup hacmi [m3]  (9 litre)
    this.P_dolu = g('P_dolu', 300e5);       // dolum basinci [Pa]
    this.T0 = g('T0', 298.0);               // dolum sicakligi [K]  (25 C)
    this.gama = g('gama', 1.40);
    this.Rgaz = g('Rgaz', 296.8);           // azot [J/kg K]
    this.Pa = g('Pa', 101325.0);            // dis ortam basinci [Pa]
    // ---- LULE GEOMETRISI (KTR s.14) ----
    this.d_bogaz = g('d_bogaz', 0.003);     // bogaz capi  [m]
    this.d_cikis = g('d_cikis', 0.010);     // cikis capi  [m]
    this.lambda = g('lambda', 0.983);       // 15 derece iraksak koni kaybi
    this.Cd = g('Cd', 1.0);                 // KTR ideal akis kabul ediyor
    // ---- YERLESIM (KTR CAD'inden olculdu) ----
    this.n = g('n', 3);
    this.r_lule = g('r_lule', 0.300);       // lule ekseninin yaricapi [m]
    this.z_lule = g('z_lule', 0.9377);      // lule yuksekligi (CAD z) [m]
    this.az_ofset = g('az_ofset', Math.PI / 3);  // bacaklara gore 60 derece
    // ---- VALF ----
    // KTR'de (ÖTR'den degisti) valfler step motorla surulen IGNE VALFLERDIR:
    // ac-kapa degil, ORANSAL. Kontrolcu anlik efektif bogaz alanini ayarlar.
    this.valf_tipi = g('valf_tipi', 'oransal');   // 'oransal' | 'ackapa'
    this.t_strok = g('t_strok', 0.15);      // ignenin tam yol suresi [s]
    this.a_min = g('a_min', 0.04);          // altinda kontrol edilemeyen aciklik
    this.f_pwm = g('f_pwm', 20.0);          // yalnizca 'ackapa' modunda [Hz]
    this.t_acilma = g('t_acilma', 0.012);
    this.t_kapanma = g('t_kapanma', 0.008);
    // ---- diger ----
    this.regulator = g('regulator', false);
    this.P_reg = g('P_reg', 150e5);
    this.tikali = o.tikali || [false, false, false];
    this.P_kesme = g('P_kesme', 2.0e5);     // altinda akis bogulmaz

    // ---- turetilen lule buyuklukleri ----
    this.At = Math.PI / 4 * this.d_bogaz * this.d_bogaz;   // 7.069e-6 m2
    this.Ae = Math.PI / 4 * this.d_cikis * this.d_cikis;   // 7.854e-5 m2
    this.alan_orani = this.Ae / this.At;                   // 11.11
    this.Me = cikisMach(this.alan_orani, this.gama);       // 4.03
    const m2 = this.Me * this.Me;
    this.Te = this.T0 / (1 + (this.gama - 1) / 2 * m2);    // 70.1 K
    this.basinc_orani = Math.pow(1 + (this.gama - 1) / 2 * m2,
                                 this.gama / (this.gama - 1));  // P0/Pe = 158
    this.Ve = this.Me * Math.sqrt(this.gama * this.Rgaz * this.Te);  // 688 m/s
    // bogulmus akis katsayisi (sicakliktan bagimsiz kisim)
    this.akisFn = Math.sqrt(this.gama
      * Math.pow(2 / (this.gama + 1), (this.gama + 1) / (this.gama - 1)));

    this.rho_dolu = this.P_dolu / (this.Rgaz * this.T0);
    this.m_gaz0 = this.rho_dolu * this.V;                  // 3.05 kg

    this.az = [];
    for (let i = 0; i < this.n; i++) {
      this.az.push(this.az_ofset + i * 2 * Math.PI / this.n);
    }

    // tasarim noktasi: 300 bar, valf tam acik
    const t0 = this.luleItkisi(this.P_dolu, this.T0, 1);
    this.F_tasarim = t0.F;              // ~337 N  (KTR 344 N, lambda'sız)
    this.F_tasarim_ideal = t0.F_ideal;  // ~343 N
    this.mdot_tasarim = t0.mdot;        // 0.488 kg/s

    this.F_tam = 0; this.P_tank = this.P_dolu; this.T_tank = this.T0;
    this.sifirla();
  }

  sifirla() {
    this.m_gaz = this.m_gaz0;
    this.valf = new Float64Array(this.n);   // 0..1 efektif bogaz alani orani
    this.komut = new Float64Array(this.n);  // kontrolcunun istedigi oran
    this.F = new Float64Array(this.n);      // anlik itki [N]
    this.mdot = 0;
    this.kapali = false;
    const t = this.tamItki();
    this.F_tam = t.F; this.P_tank = t.P; this.T_tank = t.T;
  }

  /** Tupun anlik hali (adyabatik bosalma: P/rho^g ve T/rho^(g-1) sabit). */
  tankHali() {
    const rho = Math.max(0, this.m_gaz) / this.V;
    const oran = Math.max(rho / this.rho_dolu, 1e-12);
    return { rho: rho,
             P: this.P_dolu * Math.pow(oran, this.gama),
             T: this.T0 * Math.pow(oran, this.gama - 1) };
  }

  /**
   * Tek lulenin itkisi.  a = efektif bogaz alani orani (0..1).
   *   mdot = Cd * (a*At) * P0 / sqrt(R*T0) * sqrt(g*(2/(g+1))^((g+1)/(g-1)))
   *   F    = lambda * mdot*Ve + (Pe - Pa)*Ae*a
   * Sabit alan oranli lule oldugu icin Me, Te, Ve geometriden gelir ve
   * basinc dustukce degismez; degisen sey debidir.
   */
  luleItkisi(P0, T0g, a) {
    if (a <= 0 || P0 < this.P_kesme) return { F: 0, F_ideal: 0, mdot: 0 };
    const mdot = this.Cd * (this.At * a) * P0 / Math.sqrt(this.Rgaz * T0g) * this.akisFn;
    const Ve = this.Me * Math.sqrt(this.gama * this.Rgaz
      * (T0g / (1 + (this.gama - 1) / 2 * this.Me * this.Me)));
    const Pe = P0 / this.basinc_orani;
    const Fp = (Pe - this.Pa) * this.Ae * a;
    return { F: this.lambda * mdot * Ve + Fp, F_ideal: mdot * Ve + Fp, mdot: mdot };
  }

  /** Valf TAM ACIK iken tek lulenin itkisi (anlik tank haliyle). */
  tamItki() {
    if (this.m_gaz <= 0) return { F: 0, mdot: 0, P: 0, T: this.T0 };
    const h = this.tankHali();
    const Pc = this.regulator ? Math.min(this.P_reg, h.P) : h.P;
    const r = this.luleItkisi(Pc, h.T, 1);
    return { F: r.F, mdot: r.mdot, P: h.P, T: h.T, Pc: Pc };
  }

  /** Valfleri bir dt kadar ilerletir ve lule itkilerini hesaplar. */
  guncelle(t, dt) {
    const tam = this.tamItki();
    const Tp = 1.0 / this.f_pwm;
    const faz = (t % Tp) / Tp;
    let mdot_top = 0;
    for (let i = 0; i < this.n; i++) {
      const d = this.kapali ? 0 : Math.max(0, Math.min(1, this.komut[i]));
      if (this.valf_tipi === 'ackapa') {
        // --- ESKI TASARIM (ÖTR): selenoid valf, ac-kapa + PWM ---
        const ac = (d > 0) && (faz < d);
        const hedef = ac ? 1 : 0;
        const hiz = ac ? dt / this.t_acilma : dt / this.t_kapanma;
        this.valf[i] += Math.max(-hiz, Math.min(hiz, hedef - this.valf[i]));
      } else {
        // --- KTR TASARIMI: step motorlu igne valf, ORANSAL ---
        // Igne hedefe sinirli hizla gider; cok kucuk acikliklar kontrol
        // edilemedigi icin a_min altinda kapali sayilir.
        const hedef = d < this.a_min ? 0 : d;
        const hiz = dt / Math.max(this.t_strok, 1e-6);
        this.valf[i] += Math.max(-hiz, Math.min(hiz, hedef - this.valf[i]));
      }
      if (this.valf[i] < 0) this.valf[i] = 0;
      if (this.valf[i] > 1) this.valf[i] = 1;
      const a = this.tikali[i] ? 0 : this.valf[i];
      this.F[i] = tam.F * a;
      mdot_top += tam.mdot * a;
    }
    this.mdot = mdot_top;
    this.F_tam = tam.F;
    this.P_tank = tam.P;
    this.T_tank = tam.T;
  }

  /** Harcanan gazi duser (adim sonunda). */
  gazHarca(dt) {
    this.m_gaz = Math.max(0, this.m_gaz - this.mdot * dt);
  }
}

/** Sabit alan oranindan cikis Mach sayisi (izentropik, Newton ile). */
export function cikisMach(AeAt, gama) {
  const g = gama, us = (g + 1) / (2 * (g - 1));
  const f = (M) => Math.pow((2 / (g + 1)) * (1 + (g - 1) / 2 * M * M), us) / M - AeAt;
  let M = 3.0;
  for (let i = 0; i < 80; i++) {
    const e = 1e-6;
    const d = (f(M + e) - f(M - e)) / (2 * e);
    if (Math.abs(d) < 1e-14) break;
    const yeni = M - f(M) / d;
    M = Math.max(1.001, Math.min(12, yeni));
    if (Math.abs(f(M)) < 1e-12) break;
  }
  return M;
}

// =========================================================================
//  KONTROLCU  (aviyonik)
// =========================================================================
//
// Dikey eksen:  hedef hiz profili  v* = -sqrt(v_temas^2 + 2*a*h)
//   Yuksekken hizli, zemine yaklasirken yavas. Bu profil SABIT YAVASLAMA
//   ile inmek demektir. PID, gercek hizi bu profile oturtur.
//
// Egim:  govdenin z eksenini dusey ile hizalamak icin gereken moment PD ile
//   bulunur, sonra 3 lule arasinda paylastirilir. Lule i, CG'den r kadar
//   uzakta oldugu icin (r*sin(a_i), -r*cos(a_i), 0) yonunde moment uretir.
//   Ters cozum:  F_i = Fz/3 + (2/(3r)) * (Mx*sin(a_i) - My*cos(a_i))
//
export class Kontrolcu {
  constructor(o) {
    o = o || {};
    const g = (k, v) => (o[k] !== undefined ? o[k] : v);
    this.f_orn = g('f_orn', 100.0);         // ornekleme frekansi [Hz] (KTR: 100 Hz)
    this.a_hedef = g('a_hedef', 8.0);       // hedef yavaslama [m/s2]
    this.v_temas = g('v_temas', 0.08);      // hedeflenen temas hizi [m/s]
    this.v_tavan = g('v_tavan', 6.0);       // en yuksek inis hizi [m/s]
    this.h_son = g('h_son', 0.12);          // son yaklasma irtifasi [m]
    this.Kp_v = g('Kp_v', 7.0);
    this.Ki_v = g('Ki_v', 2.0);
    this.Kd_v = g('Kd_v', 0.10);
    this.Kp_egim = g('Kp_egim', 26.0);      // [Nm/rad]
    this.Kd_egim = g('Kd_egim', 7.0);       // [Nm/(rad/s)]
    this.egim_kazanc = g('egim_kazanc', 1.0);
    this.yanal_duzelt = g('yanal_duzelt', false);
    this.Kp_yanal = g('Kp_yanal', 0.9);
    this.egim_sinir = g('egim_sinir', 8 * Math.PI / 180);
    this.flare_h = g('flare_h', 0.55);      // altinda dikey tutulur [m]
    this.gurultu_h = g('gurultu_h', 0.0);   // irtifa gurultusu [m, std]
    this.gurultu_v = g('gurultu_v', 0.0);   // hiz gurultusu [m/s]
    this.gurultu_a = g('gurultu_a', 0.0);   // yonelim gurultusu [-]
    this.sapma_h = g('sapma_h', 0.0);       // irtifa sensoru SABIT hatasi [m]
    this.temasta_kes = g('temasta_kes', true);
    this.aktif_t = g('aktif_t', 0.4);       // aviyonigin devreye girdigi an [s]
    this.acik = g('acik', true);            // false -> kontrol tamamen kapali
    // CG'nin ayak tabanina uzakligi [m]: 480 + 112 = 592 mm
    this.cg_yer = g('cg_yer', (OLCU.CG_Z - OLCU.AYAK_TEMAS_Z) / 1000);
    this.m = g('m', 32.0);
    this.tohum = g('tohum', 20261028);
    this.sifirla();
  }

  sifirla() {
    this.int_v = 0; this.onceki_e = 0; this.t_son_ornek = -1e9;
    this.duty = new Float64Array(3);
    this.rnd_s = this.tohum >>> 0;
    this.temas_oldu = false;
    this.v_hedef = 0; this.F_cmd = 0; this.Mx = 0; this.My = 0;
    this.doygun = false;
  }

  // tekrarlanabilir rastgele sayi (ayni parametre -> ayni sonuc)
  rnd() {
    let x = this.rnd_s;
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    this.rnd_s = x;
    return x / 4294967296;
  }

  gauss(s) {
    if (!s) return 0;
    let u = 0, v = 0;
    while (u === 0) u = this.rnd();
    while (v === 0) v = this.rnd();
    return s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /**
   * Kontrol dongusunu f_orn frekansinda kosar, lule doluluk oranlarini yazar.
   * Aradaki adimlarda cikti SABIT TUTULUR (zero-order hold) - gercek bir
   * sayisal kontrolcu de boyle davranir.
   */
  guncelle(t, durum, itki) {
    const dt_ornek = 1.0 / this.f_orn;
    if (t - this.t_son_ornek < dt_ornek) return this.duty;
    const dt = Math.min(t - this.t_son_ornek, 4 * dt_ornek);
    this.t_son_ornek = t;

    if (!this.acik || t < this.aktif_t) {
      this.duty[0] = this.duty[1] = this.duty[2] = 0;
      // Kontrolcu kapaliyken "hedef hiz" diye bir sey yok; 0 yazmak grafikte
      // yaniltici duz bir cizgi birakirdi.
      this.v_hedef = NaN; this.F_cmd = 0; this.doygun = false;
      return this.duty;
    }
    if (this.temasta_kes && durum.temas) this.temas_oldu = true;
    if (this.temas_oldu) {
      this.duty[0] = this.duty[1] = this.duty[2] = 0;
      this.v_hedef = NaN; this.F_cmd = 0; this.doygun = false;
      return this.duty;
    }

    // ---------------- SENSORLER (gurultulu) ----------------
    // Irtifa = EN ALCAK AYAGIN zeminden yuksekligi. Govde egikken ayaklar
    // acildigi icin bu deger CG yuksekligi - 592 mm'den farklidir; roket 12
    // derece yatikken en alcak ayak 10 cm daha asagidadir. Kontrolcu bunu
    // gormezse son yaklasmayi gec baslatir ve egik inislerde sert iner.
    const h_ham = durum.h_gercek !== undefined
      ? durum.h_gercek : Math.max(0, durum.r[2] - this.cg_yer);
    const h = Math.max(0, h_ham) + this.sapma_h + this.gauss(this.gurultu_h);
    const vz = durum.v[2] + this.gauss(this.gurultu_v);
    const vx = durum.v[0] + this.gauss(this.gurultu_v);
    const vy = durum.v[1] + this.gauss(this.gurultu_v);
    const R = durum.R;
    const wx = durum.w[0], wy = durum.w[1];

    // ---------------- DIKEY: hedef hiz profili + PID ----------------
    // Uc kademeli profil:
    //   h > h_son  : v* = -sqrt(v_temas^2 + 2a(h-h_son))  -> sabit yavaslama
    //   tepe       : v_tavan ile sinirli                  -> en yuksek inis hizi
    //   h <= h_son : v* = -v_temas                        -> son yaklasma
    // Son kademe sart: sabit yavaslama profili temas anina kadar surdurulurse
    // sonsuz keskinlikte bir frenleme ister ve roket her zaman sert iner.
    const v_prof = Math.sqrt(this.v_temas * this.v_temas
      + 2 * this.a_hedef * Math.max(0, h - this.h_son));
    const tepede = v_prof >= this.v_tavan;
    const v_h = -Math.min(this.v_tavan, v_prof);
    this.v_hedef = v_h;
    this.faz = tepede ? 'inis' : (h > this.h_son ? 'frenleme' : 'son yaklasma');
    const e = v_h - vz;                       // >0 ise cok hizli iniyoruz
    const de = (e - this.onceki_e) / Math.max(dt, 1e-6);
    this.onceki_e = e;
    const F_tavan = 3 * Math.max(itki.F_tam, 1e-9);

    // ILERI BESLEME: hedef profil zaten a_hedef kadar yavaslama gerektirir,
    // bu yuzden gereken itki onden verilir; PID sadece sapmayi duzeltir.
    // (Ileri besleme olmasa, PID'in yavaslamayi uretebilmesi icin kalici bir
    //  hiz hatasi gerekirdi - roket profilden hep daha hizli inerdi.)
    // Profilin O ANDA gerektirdigi yavaslama: sabit hizla inilen kademelerde
    // (tepe hiz siniri, son yaklasma) sifir; sadece frenleme kademesinde a_hedef.
    const a_ff = (tepede || h <= this.h_son) ? 0 : this.a_hedef;
    const u_pid = this.Kp_v * e + this.Ki_v * this.int_v + this.Kd_v * de;
    let Fz = this.m * (G + a_ff) + this.m * u_pid;

    // ANTI-WINDUP: cikti doygunken integrali ayni yonde buyutme. Bu olmazsa
    // serbest dusus boyunca (itki 0'a kirpilirken) integral dolar ve frenleme
    // anında kontrolcu itkiyi geri tutar.
    const doyPos = Fz > F_tavan, doyNeg = Fz < 0;
    if (!(doyPos && e > 0) && !(doyNeg && e < 0)) {
      this.int_v = Math.max(-4, Math.min(4, this.int_v + e * dt));
    }
    this.doygun = doyPos;
    Fz = Math.max(0, Math.min(F_tavan, Fz));
    this.F_cmd = Fz;

    // ---------------- ISTENEN GOVDE EKSENI ----------------
    // Varsayilan: dikey. Yanal duzeltme acikken itki vektoru yanal hiza
    // KARSI egilir (gercek bir roket yanal hizi ancak egilerek durdurur).
    let nd0 = 0, nd1 = 0, nd2 = 1;
    if (this.yanal_duzelt && h > this.flare_h) {
      const ax = -this.Kp_yanal * vx, ay = -this.Kp_yanal * vy;
      const az = G + Math.max(0, Fz / this.m - G);
      let tx = ax / az, ty = ay / az;
      const tn = Math.hypot(tx, ty), lim = Math.tan(this.egim_sinir);
      if (tn > lim) { tx *= lim / tn; ty *= lim / tn; }
      const nn = Math.hypot(tx, ty, 1);
      nd0 = tx / nn; nd1 = ty / nn; nd2 = 1 / nn;
    }
    // istenen eksen, GOVDE cercevesinde:  ud = R^T * nd
    const ud0 = R[0] * nd0 + R[3] * nd1 + R[6] * nd2;
    const ud1 = R[1] * nd0 + R[4] * nd1 + R[7] * nd2;
    // hata ekseni = zhat_govde x ud = (-ud_y, ud_x, 0)
    const ex = -ud1, ey = ud0;
    const kp = this.Kp_egim * this.egim_kazanc, kd = this.Kd_egim * this.egim_kazanc;
    let Mx = kp * ex - kd * wx;
    let My = kp * ey - kd * wy;
    const Mmax = 1.1 * Math.max(itki.F_tam, 1e-9) * itki.r_lule;
    const Mn = Math.hypot(Mx, My);
    if (Mn > Mmax) { Mx *= Mmax / Mn; My *= Mmax / Mn; }
    this.Mx = Mx; this.My = My;

    // ---------------- LULELERE PAYLASTIRMA ----------------
    // Oransal igne valfte komut DOGRUDAN efektif bogaz alani oranidir.
    // Ac-kapa (selenoid + PWM) modunda ise valfin acilip kapanma suresi
    // ortalama acikligi komuttan saptirir; aviyonik bunu onden telafi eder.
    const telafi = itki.valf_tipi === 'ackapa'
      ? (itki.t_acilma - itki.t_kapanma) * itki.f_pwm / 2 : 0;
    const r = itki.r_lule, Ft = Math.max(itki.F_tam, 1e-9);
    for (let i = 0; i < 3; i++) {
      const a = itki.az[i];
      let Fi = Fz / 3 + (2 / (3 * r)) * (Mx * Math.sin(a) - My * Math.cos(a));
      Fi = Math.max(0, Math.min(Ft, Fi));
      const d = Fi / Ft;
      this.duty[i] = d > 1e-4 ? Math.max(0, Math.min(1, d + telafi)) : 0;
    }
    return this.duty;
  }
}

// =========================================================================
//  INIS MODELI  (sim.py / InisModeli sinifinin birebir karsiligi)
// =========================================================================
export class InisModeli {
  constructor(o) {
    o = o || {};
    const g = (k, v) => (o[k] !== undefined ? o[k] : v);
    this.m = g('m', 32.0);
    this.I = Float64Array.from(g('I', [5.93, 5.93, 1.69]));
    this.Iinv = Float64Array.from([1 / this.I[0], 1 / this.I[1], 1 / this.I[2]]);
    this.n = g('n_bacak', 3);
    this.smax = g('strok_dusey', OLCU.DUSEY_STROK / 1000);
    // amortisor sikismasi x [m] = a1 s + a2 s^2 + a3 s^3  (s: temas yukselmesi [m])
    const xs = g('x_s', OLCU.X_S);
    this.a1 = xs[0]; this.a2 = xs[1]; this.a3 = xs[2];
    // kendini ayarlayan hidrolik amortisor (sim.py / amortisor.py ile ayni)
    const am = Object.assign({}, AMORT, g('amort', {}) || {});
    this.K = am.K; this.S = am.S; this.Sh = am.S_h; this.eps = am.eps;
    this.F0 = am.F0; this.F1 = am.F1; this.cg = am.c_geri;
    this.xt = am.x_t; this.kt = am.k_t; this.ct = am.c_t;
    this.xd = am.x_d; this.kd = am.k_d; this.cd = am.c_d;
    this.mu = g('mu', 0.45);
    this.cg_z = g('cg_z', OLCU.CG_Z / 1000);
    this.z_ayak = g('z_ayak', OLCU.AYAK_TEMAS_Z / 1000);
    const disa = g('disa_egim', OLCU.DISA_EGIM);
    const r_ayak = g('r_ayak', OLCU.F_U / 1000);
    const ofs = g('azimut_ofset', 0.0);
    this.disa = disa; this.r_ayak = r_ayak;   // dogrula.mjs Python modeliyle karsilastirir

    this.p0 = []; this.e = []; this.az = [];
    for (let i = 0; i < this.n; i++) {
      const a = ofs + i * 2 * Math.PI / this.n;
      this.az.push(a);
      this.p0.push([r_ayak * Math.cos(a), r_ayak * Math.sin(a), this.z_ayak - this.cg_z]);
      this.e.push([disa * Math.cos(a), disa * Math.sin(a), 1.0]);
    }
    this.cg_yer = this.cg_z - this.z_ayak;

    // GOVDE TEMAS NOKTALARI - roket devrilirse govdenin zemine carpmasi
    // (bunlar olmadan devrilme sonrasi cozum anlamsiz buyuk kuvvetler uretir)
    this.govde_p = [];
    for (let j = 0; j < 12; j++) {
      const a = j * 2 * Math.PI / 12;
      this.govde_p.push([0.141 * Math.cos(a), 0.141 * Math.sin(a), 0.003 - this.cg_z]);
      this.govde_p.push([0.138 * Math.cos(a), 0.138 * Math.sin(a), 0.930 - this.cg_z]);
    }
    this.k_govde = 2.0e6; this.c_govde = 4.0e3;

    // BACAK TEMAS NOKTALARI  (sim.py'de YOKTU - eklendi)
    // sim.py yalnizca ayak ucunu ve govdeyi temas ettiriyordu; bacak cercevesinin
    // kendisi hicbir yere degmiyordu. Roket devrilince bacaklar zeminin icine
    // giriyordu. Secilen noktalar pabuc duzleminden en az 88 mm yukarida, yani
    // 75 mm'lik tam strokta bile zeminin ustunde: roket AYAKTAYKEN hicbiri
    // devreye girmez, dolayisiyla bacak yayiyla cift sayim olmaz.
    this.bacak_carpisma = g('bacak_carpisma', true);
    this.bacak_p = []; this.bacak_pad = [];
    const kD = [OLCU.D_U / 1000, OLCU.D_Z / 1000], kC = [OLCU.C_U / 1000, OLCU.C_Z / 1000];
    const kF = [OLCU.F_U / 1000, OLCU.F_Z / 1000];
    const orta = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bn = [kD, kC, orta(kD, kC), orta(kD, kF), orta(kC, kF)];   // D, C, D-C, D-F, C-F
    // Ust plaka ve itki grubu: KTR CAD'inde govdenin EN DIS parcasi burasi
    // (plaka ucu r = 291 mm, lule r = 300 mm). sim.py ust govdeyi r = 138 mm
    // kabul ediyordu; roket yatinca plaka gorsel olarak zemine giriyordu.
    const ust = [[0.291, 0.924], [0.300, 0.938], [0.2585, 0.965]];
    // Bacak 76 mm genisliginde iki plakadan, pabuc 100 mm capinda. Yalnizca
    // orta duzlem noktalarini kullanmak yetmiyordu: yan yatmis roketin pabuc
    // kosesi zeminin 6 cm altina girebiliyordu. Her nokta tegetsel olarak da
    // ucleniyor (orta duzlem ve +/- 41 mm).
    const ty = [0, 41, -41];
    for (let i = 0; i < this.n; i++) {
      const a = this.az[i], ca = Math.cos(a), sa = Math.sin(a);
      for (let j = 0; j < bn.length; j++) {
        for (let t2 = 0; t2 < ty.length; t2++) {
          const u = bn[j][0] * 1000, yv = ty[t2];
          this.bacak_p.push([(u * ca - yv * sa) / 1000, (u * sa + yv * ca) / 1000,
                             bn[j][1] - this.cg_z]);
        }
      }
      // itki grubu luleler gibi bacaklara gore 60 derece kaymistir
      const au = a + Math.PI / 3, cu = Math.cos(au), su = Math.sin(au);
      for (let j = 0; j < ust.length; j++) {
        this.bacak_p.push([ust[j][0] * cu, ust[j][0] * su, ust[j][1] - this.cg_z]);
      }
      // Pabucun kendisi: YALNIZCA bacak artik yay gibi davranamadiginda
      // (strok yonu yukari bakmiyorsa) devreye girer. Boylece ya bacak yayi
      // ya da ceza yayi calisir, ikisi birden asla. Pabuc 100 mm capinda
      // oldugu icin dort kosesi de alinir.
      for (const du of [-0.05, 0.05]) {
        for (const dy of [-0.05, 0.05]) {
          const u = (r_ayak + du) * 1000, yv = dy * 1000;
          this.bacak_pad.push([(u * ca - yv * sa) / 1000, (u * sa + yv * ca) / 1000,
                               this.z_ayak - this.cg_z]);
        }
      }
    }
    this.gp_rmax = 0;
    const hepsi = this.govde_p.concat(this.bacak_carpisma ? this.bacak_p : [],
                                      this.bacak_carpisma ? this.bacak_pad : []);
    for (let j = 0; j < hepsi.length; j++) {
      const p = hepsi[j];
      this.gp_rmax = Math.max(this.gp_rmax, Math.hypot(p[0], p[1], p[2]));
    }
    this._gecerli = new Uint8Array(this.n);

    // ---- EKLENTILER ----
    this.itki_sis = g('itki_sis', null);     // ItkiSistemi veya null
    this.itki_sabit = g('itki', 0.0);        // sim.py uyumlulugu: sabit dusey itki
    this.hava = g('hava', false);            // aerodinamik surukleme
    this.ruzgar = g('ruzgar', [0, 0]);       // [m/s] dunya cercevesinde
    this.Cd_yan = g('Cd_yan', 1.0); this.A_yan = g('A_yan', 0.30);
    this.Cd_dik = g('Cd_dik', 1.1); this.A_dik = g('A_dik', 0.13);
    this.rho_hava = g('rho_hava', 1.225);
    this.z_basinc = g('z_basinc', 0.60) - this.cg_z;

    // --- hot loop tamponlari (her adimda yeni dizi ayirmamak icin) ---
    this._R = new Float64Array(9);
    this._F = new Float64Array(3 * this.n);
    this._Pw = new Float64Array(3 * this.n);
    this._s = new Float64Array(this.n);
    this._x = new Float64Array(this.n);
    this._Fa = new Float64Array(this.n);
    this._k1 = new Float64Array(13); this._k2 = new Float64Array(13);
    this._k3 = new Float64Array(13); this._k4 = new Float64Array(13);
    this._yt = new Float64Array(13);
    this._q4 = new Float64Array(4);
    this._kuv = { F: this._F, Pw: this._Pw, s: this._s, Fa: this._Fa, x: this._x };
    this._Fit = new Float64Array(3);   // adim boyunca sabit tutulan lule itkileri
  }

  // ------------------------------------------------------ amortisor
  /** Amortisor kuvveti [N]: x sikisma [m], xd sikisma hizi [m/s] (sim.py ile ayni sira). */
  amortisor(x, xd) {
    const S = this.S;
    const yay = this.F0 + (this.F1 - this.F0) * Math.min(Math.max(x, 0.0), S) / S;
    const hid = xd > 0 ? this.K * xd * xd / Math.max(1.0 - x / this.Sh, this.eps) : this.cg * xd;
    const tam = x > this.xt ? Math.max(0.0, this.kt * (x - this.xt) + this.ct * xd) : 0.0;
    const dur = x > this.xd ? Math.max(0.0, this.kd * (x - this.xd) + this.cd * xd) : 0.0;
    return yay + hid + tam + dur;
  }

  // ------------------------------------------------------ bacak kuvvetleri
  bacakKuvvetleri(r, R, v, wd) {
    const F = this._F, Pw = this._Pw, s = this._s, Fa = this._Fa, X = this._x;
    for (let i = 0; i < this.n; i++) {
      const p = this.p0[i], ev = this.e[i];
      const ewx = R[0] * ev[0] + R[1] * ev[1] + R[2] * ev[2];
      const ewy = R[3] * ev[0] + R[4] * ev[1] + R[5] * ev[2];
      const ewz = R[6] * ev[0] + R[7] * ev[1] + R[8] * ev[2];
      const pwx0 = R[0] * p[0] + R[1] * p[1] + R[2] * p[2];
      const pwy0 = R[3] * p[0] + R[4] * p[1] + R[5] * p[2];
      const pwz0 = R[6] * p[0] + R[7] * p[1] + R[8] * p[2];
      // Bacak ancak strok yonu hala yukari bakiyorsa kuvvet uretebilir.
      // Roket 75 dereceden fazla yatarsa o bacak artik itemez.
      const gecerli = ewz > 0.25;
      this._gecerli[i] = gecerli ? 1 : 0;
      const ez = gecerli ? ewz : 1.0;
      const sv = -(r[2] + pwz0) / ez;
      const temas = (sv > 0.0) && gecerli;
      const se = temas ? sv : 0.0;
      s[i] = se;
      const sl = Math.min(se, this.smax * 1.6);
      const px = pwx0 + sl * ewx, py = pwy0 + sl * ewy, pz = pwz0 + sl * ewz;
      Pw[3 * i] = r[0] + px; Pw[3 * i + 1] = r[1] + py; Pw[3 * i + 2] = r[2] + pz;
      const Vx = v[0] + wd[1] * pz - wd[2] * py;
      const Vy = v[1] + wd[2] * px - wd[0] * pz;
      const Vz = v[2] + wd[0] * py - wd[1] * px;
      const sdot = -Vz / ez;
      // x(s) polinomu ayak yolunun 1.3 katina kadar (otesi yalniz devrilmis rokette)
      const sx = Math.min(se, 1.3 * this.smax);
      const dxds = this.a1 + 2.0 * this.a2 * sx + 3.0 * this.a3 * sx * sx;
      const x = sx * (this.a1 + sx * (this.a2 + sx * this.a3));
      const xdot = dxds * sdot;
      const fa = temas ? Math.max(0.0, this.amortisor(x, xdot)) : 0.0;
      Fa[i] = fa; X[i] = x;
      const N = fa * dxds;
      const hiz = Math.sqrt(Vx * Vx + Vy * Vy + 1e-4);
      F[3 * i] = -this.mu * (N / hiz) * Vx;
      F[3 * i + 1] = -this.mu * (N / hiz) * Vy;
      F[3 * i + 2] = N;
    }
    return this._kuv;
  }

  // ------------------------------------------------ govde/bacak-zemin temasi
  govdeTemasi(r, R, v, wd, acc) {
    // hizli cikis: en alcak olasi nokta bile zeminin uzerindeyse gec
    if (r[2] - this.gp_rmax > 0) return false;
    let any = false;
    const liste = this._temasListesi();
    for (let j = 0; j < liste.length; j++) {
      const p = liste[j];
      const px = R[0] * p[0] + R[1] * p[1] + R[2] * p[2];
      const py = R[3] * p[0] + R[4] * p[1] + R[5] * p[2];
      const pz = R[6] * p[0] + R[7] * p[1] + R[8] * p[2];
      const bat = -(r[2] + pz);
      if (bat <= 0) continue;
      const Vx = v[0] + wd[1] * pz - wd[2] * py;
      const Vy = v[1] + wd[2] * px - wd[0] * pz;
      const Vz = v[2] + wd[0] * py - wd[1] * px;
      const N = Math.max(0, this.k_govde * bat - this.c_govde * Vz);
      const hiz = Math.sqrt(Vx * Vx + Vy * Vy + 1e-4);
      const fx = -0.6 * (N / hiz) * Vx, fy = -0.6 * (N / hiz) * Vy;
      acc.Fx += fx; acc.Fy += fy; acc.Fz += N;
      acc.Tx += py * N - pz * fy;
      acc.Ty += pz * fx - px * N;
      acc.Tz += px * fy - py * fx;
      any = true;
    }
    return any;
  }

  /**
   * O adimda ceza yayiyla temas edecek noktalarin listesi.
   * Govde noktalari her zaman; bacak cercevesi (secenek acikken) her zaman;
   * pabuclar SADECE o bacak artik yay gibi davranamiyorken.
   */
  _temasListesi() {
    if (!this.bacak_carpisma) return this.govde_p;
    const l = this._liste || (this._liste = []);
    l.length = 0;
    for (let j = 0; j < this.govde_p.length; j++) l.push(this.govde_p[j]);
    for (let j = 0; j < this.bacak_p.length; j++) l.push(this.bacak_p[j]);
    for (let i = 0; i < this.n; i++) {
      if (this._gecerli[i]) continue;
      for (let j = 0; j < 4; j++) l.push(this.bacak_pad[4 * i + j]);
    }
    return l;
  }

  // ------------------------------------------------------ turev
  turev(y, dy) {
    const q4 = this._q4;
    q4[0] = y[3]; q4[1] = y[4]; q4[2] = y[5]; q4[3] = y[6];
    const R = qMatris(q4, this._R);
    const rx = y[0], ry = y[1], rz = y[2];
    const r = [rx, ry, rz];
    const v = [y[7], y[8], y[9]];
    const wx = y[10], wy = y[11], wz = y[12];
    // acisal hiz dunya cercevesinde:  wd = R*w
    const wd = [R[0] * wx + R[1] * wy + R[2] * wz,
                R[3] * wx + R[4] * wy + R[5] * wz,
                R[6] * wx + R[7] * wy + R[8] * wz];

    const kuv = this.bacakKuvvetleri(r, R, v, wd);
    const F = kuv.F, Pw = kuv.Pw;
    const acc = { Fx: 0, Fy: 0, Fz: -this.m * G + this.itki_sabit, Tx: 0, Ty: 0, Tz: 0 };
    for (let i = 0; i < this.n; i++) {
      const fx = F[3 * i], fy = F[3 * i + 1], fz = F[3 * i + 2];
      acc.Fx += fx; acc.Fy += fy; acc.Fz += fz;
      const px = Pw[3 * i] - rx, py = Pw[3 * i + 1] - ry, pz = Pw[3 * i + 2] - rz;
      acc.Tx += py * fz - pz * fy;
      acc.Ty += pz * fx - px * fz;
      acc.Tz += px * fy - py * fx;
    }
    this.govdeTemasi(r, R, v, wd, acc);

    // ---------------- LULE ITKILERI ----------------
    // Itki GOVDE eksenine paraleldir; lule CG'den uzakta oldugu icin
    // luleler arasi fark DOGRUDAN moment uretir.
    if (this.itki_sis) {
      const S = this.itki_sis;
      const zl = S.z_lule - this.cg_z;
      for (let i = 0; i < S.n; i++) {
        const Fi = this._Fit[i];
        if (Fi === 0) continue;
        const a = S.az[i];
        const lx = S.r_lule * Math.cos(a), ly = S.r_lule * Math.sin(a);
        const fx = R[2] * Fi, fy = R[5] * Fi, fz = R[8] * Fi;
        acc.Fx += fx; acc.Fy += fy; acc.Fz += fz;
        const px = R[0] * lx + R[1] * ly + R[2] * zl;
        const py = R[3] * lx + R[4] * ly + R[5] * zl;
        const pz = R[6] * lx + R[7] * ly + R[8] * zl;
        acc.Tx += py * fz - pz * fy;
        acc.Ty += pz * fx - px * fz;
        acc.Tz += px * fy - py * fx;
      }
    }

    // ---------------- AERODINAMIK (secenek) ----------------
    if (this.hava) {
      const px = R[2] * this.z_basinc, py = R[5] * this.z_basinc, pz = R[8] * this.z_basinc;
      const Vx = v[0] + wd[1] * pz - wd[2] * py - this.ruzgar[0];
      const Vy = v[1] + wd[2] * px - wd[0] * pz - this.ruzgar[1];
      const Vz = v[2] + wd[0] * py - wd[1] * px;
      const q = 0.5 * this.rho_hava;
      const hy = Math.hypot(Vx, Vy);
      const fx = -q * this.Cd_yan * this.A_yan * hy * Vx;
      const fy = -q * this.Cd_yan * this.A_yan * hy * Vy;
      const fz = -q * this.Cd_dik * this.A_dik * Math.abs(Vz) * Vz;
      acc.Fx += fx; acc.Fy += fy; acc.Fz += fz;
      acc.Tx += py * fz - pz * fy;
      acc.Ty += pz * fx - px * fz;
      acc.Tz += px * fy - py * fx;
    }

    // ---------------- hareket denklemleri ----------------
    // moment GOVDE cercevesine cevrilir:  Tb = R^T * T
    const Tbx = R[0] * acc.Tx + R[3] * acc.Ty + R[6] * acc.Tz;
    const Tby = R[1] * acc.Tx + R[4] * acc.Ty + R[7] * acc.Tz;
    const Tbz = R[2] * acc.Tx + R[5] * acc.Ty + R[8] * acc.Tz;
    const Ix = this.I[0], Iy = this.I[1], Iz = this.I[2];
    dy[0] = v[0]; dy[1] = v[1]; dy[2] = v[2];
    // qdot = 0.5 * q (x) [0, w]
    const q0 = y[3], q1 = y[4], q2 = y[5], q3 = y[6];
    dy[3] = 0.5 * (-q1 * wx - q2 * wy - q3 * wz);
    dy[4] = 0.5 * (q0 * wx + q2 * wz - q3 * wy);
    dy[5] = 0.5 * (q0 * wy - q1 * wz + q3 * wx);
    dy[6] = 0.5 * (q0 * wz + q1 * wy - q2 * wx);
    dy[7] = acc.Fx / this.m; dy[8] = acc.Fy / this.m; dy[9] = acc.Fz / this.m;
    // wdot = Iinv * (Tb - w x (I w))
    dy[10] = this.Iinv[0] * (Tbx - (wy * (Iz * wz) - wz * (Iy * wy)));
    dy[11] = this.Iinv[1] * (Tby - (wz * (Ix * wx) - wx * (Iz * wz)));
    dy[12] = this.Iinv[2] * (Tbz - (wx * (Iy * wy) - wy * (Ix * wx)));
    return dy;
  }

  rk4(y, dt) {
    const k1 = this.turev(y, this._k1), yt = this._yt;
    for (let i = 0; i < 13; i++) yt[i] = y[i] + 0.5 * dt * k1[i];
    const k2 = this.turev(yt, this._k2);
    for (let i = 0; i < 13; i++) yt[i] = y[i] + 0.5 * dt * k2[i];
    const k3 = this.turev(yt, this._k3);
    for (let i = 0; i < 13; i++) yt[i] = y[i] + dt * k3[i];
    const k4 = this.turev(yt, this._k4);
    for (let i = 0; i < 13; i++) y[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    const nq = Math.hypot(y[3], y[4], y[5], y[6]);
    y[3] /= nq; y[4] /= nq; y[5] /= nq; y[6] /= nq;
    return y;
  }

  /** sim.py coz() ile ayni baslangic durumu. */
  baslangic(o) {
    o = o || {};
    const egim = (o.egim_deg || 0) * Math.PI / 180;
    const yon = (o.egim_yonu_deg || 0) * Math.PI / 180;
    const q = qEksenAci(Math.cos(yon + Math.PI / 2), Math.sin(yon + Math.PI / 2), 0, egim);
    const R = qMatris(q, new Float64Array(9));
    let zmin = Infinity;
    for (let i = 0; i < this.n; i++) {
      const p = this.p0[i];
      zmin = Math.min(zmin, R[6] * p[0] + R[7] * p[1] + R[8] * p[2]);
    }
    const v0 = o.v0 || [0, 0, 0];
    const w0 = o.w0 || [0, 0, 0];
    const y = new Float64Array(13);
    y[0] = 0; y[1] = 0; y[2] = -zmin + (o.h0 !== undefined ? o.h0 : 0.004);
    y[3] = q[0]; y[4] = q[1]; y[5] = q[2]; y[6] = q[3];
    y[7] = (o.vx || 0) + v0[0]; y[8] = v0[1]; y[9] = v0[2];
    y[10] = w0[0]; y[11] = w0[1]; y[12] = w0[2];
    return y;
  }

  egimDeg(R) { return Math.acos(Math.max(-1, Math.min(1, R[8]))) * 180 / Math.PI; }
}

// =========================================================================
//  KOSU - senaryoyu basindan sonuna cozer, kareleri ve ozeti dondurur
// =========================================================================
export const VARSAYILAN = {
  // ---- birakma ----
  irtifa: 9.0, egim_deg: 0.0, egim_yonu_deg: 0.0,
  serbest_dusus: 0.40, yanal_hiz: 0.0, ruzgar: 0.0, ruzgar_yonu_deg: 0.0,
  // ---- itki ----
  P_tank_bar: 300, regulator: false, P_reg_bar: 150,
  valf_tipi: 'oransal', t_strok_ms: 150,
  f_pwm: 20, t_acilma_ms: 12, tikali: [false, false, false],
  // ---- kontrol ----
  kontrol_acik: true, a_hedef: 8.0, v_tavan: 6.0, Kp_v: 7.0, egim_kazanc: 1.0,
  Ki_v: 2.0, Kd_v: 0.10, v_temas: 0.08, h_son: 0.12,
  f_orn: 30, gurultu: 0, sapma_h: 0, yanal_duzelt: false, temasta_kes: true,
  // ---- model ----
  kutle: 32.0,                 // sartname ust siniri (KTR 24,4 / 25 kg diyor)
  // Airtac ACA2020-2 kendini ayarlayan hidrolik amortisor (hesaplar/amortisor.json)
  mu: 0.45, amort: null,       // null -> geometri.js AMORT degerleri
  hava: null,                  // null -> ruzgar varsa otomatik acilir
  bacak_carpisma: true,        // bacak cercevesi de zemine degsin (sim.py'de yok)
  // ---- cozucu ----
  dt_ucus: 5e-4, dt_orta: 2e-4, dt_temas: 1e-4, t_max: 16.0, kare_hz: 200,
  // ---- dogrulama modu (sim.py ile birebir karsilastirma) ----
  sabit_dt: null, t_son: null, h0: null, v0: null, vx: null, w0: null,
  itki_yok: false,
};

export function kosu(par) {
  const p = Object.assign({}, VARSAYILAN, par || {});
  const hava = (p.hava === null || p.hava === undefined)
    ? (Math.abs(p.ruzgar) > 1e-9) : !!p.hava;
  const ruz = [p.ruzgar * Math.cos(p.ruzgar_yonu_deg * Math.PI / 180),
               p.ruzgar * Math.sin(p.ruzgar_yonu_deg * Math.PI / 180)];

  const itki_sis = p.itki_yok ? null : new ItkiSistemi({
    P_dolu: p.P_tank_bar * 1e5, regulator: p.regulator, P_reg: p.P_reg_bar * 1e5,
    f_pwm: p.f_pwm, t_acilma: p.t_acilma_ms / 1000,
    t_kapanma: Math.max(0.002, p.t_acilma_ms / 1000 * 0.67),
    tikali: p.tikali.slice(),
    valf_tipi: p.valf_tipi, t_strok: p.t_strok_ms / 1000,
  });

  // Atalet momenti kutle ile olcekleniyor. 32 kg'daki degerler param.py'den
  // (KTR'nin 24,4 kg matrisinin olceklenmis hali); boylece m = 32 iken
  // dogrulama sayilari birebir korunur.
  const ko = p.kutle / 32.0;
  const m = new InisModeli({
    m: p.kutle, I: [5.93 * ko, 5.93 * ko, 1.69 * ko], n_bacak: 3,
    r_ayak: OLCU.F_U / 1000, z_ayak: OLCU.AYAK_TEMAS_Z / 1000, cg_z: OLCU.CG_Z / 1000,
    x_s: OLCU.X_S, strok_dusey: OLCU.DUSEY_STROK / 1000, disa_egim: OLCU.DISA_EGIM,
    amort: p.amort || {}, mu: p.mu,
    itki_sis: itki_sis, hava: hava, ruzgar: ruz,
    // itki_yok = "sim.py referans modu": bacak carpismasi sim.py'de olmadigi
    // icin o modda kapatilir, boylece dogrulama birebir ayni kalir.
    bacak_carpisma: p.bacak_carpisma && !p.itki_yok,
  });

  const kont = new Kontrolcu({
    f_orn: p.f_orn, a_hedef: p.a_hedef, v_tavan: p.v_tavan, Kp_v: p.Kp_v,
    Ki_v: p.Ki_v, Kd_v: p.Kd_v, v_temas: p.v_temas, h_son: p.h_son,
    egim_kazanc: p.egim_kazanc, yanal_duzelt: p.yanal_duzelt,
    temasta_kes: p.temasta_kes, aktif_t: p.serbest_dusus,
    acik: p.kontrol_acik, cg_yer: m.cg_yer, m: m.m,
    gurultu_h: 0.02 * p.gurultu, gurultu_v: 0.05 * p.gurultu,
    gurultu_a: 0.005 * p.gurultu, sapma_h: p.sapma_h,
  });

  const y = m.baslangic({
    egim_deg: p.egim_deg, egim_yonu_deg: p.egim_yonu_deg,
    h0: p.h0 !== null && p.h0 !== undefined ? p.h0 : p.irtifa,
    v0: p.v0 || [0, 0, 0],
    vx: (p.vx !== null && p.vx !== undefined) ? p.vx : (p.v0 ? 0 : p.yanal_hiz),
    w0: p.w0 || [0, 0, 0],
  });

  const kare_dt = 1.0 / p.kare_hz;
  const K = {
    t: [], r: [], q: [], s: [], x: [], Fa: [], Nb: [], Ftb: [], N: [], ivme: [],
    F: [], valf: [], P_tank: [], m_gaz: [], egim: [], vz: [], h: [],
    v_hedef: [], duty: [],
  };
  let t = 0, sonraki_kare = 0, adim = 0;
  const t_max = p.t_son !== null && p.t_son !== undefined ? p.t_son : p.t_max;
  let ilk_temas = -1, v_temas = 0, egim_temas = 0;
  // Roket devrilirse GOVDE bacaklardan once yere carpar. "Temas hizi" olarak
  // ilk bacak temasini bildirmek yaniltici olur: govde çoktan carpmis, sekmis
  // ve hiz degismis olur. Bu yuzden ilk carpma ayrica izlenir.
  let ilk_carpma = -1, v_carpma = 0, egim_carpma = 0, carpan = '';
  let strok_max = 0, x_max = 0, Fa_max = 0, N_max = 0, Ft_max = 0, ivme_max = 0, egim_max = 0;
  let egim_son = 0, v_geri = 0, geri_bulundu = false, doygun_sure = 0;
  // Devrildikten SONRAKI kuvvetler govdenin zemine carpmasindan gelir ve
  // bacak tasarim yuku DEGILDIR (04_senaryolar.py ayni uyariyi veriyor).
  // Bu yuzden "ayakta" maksimumlar ayrica tutulur - arayuz bunlari gosterir.
  let a_strok = 0, a_x = 0, a_Fa = 0, a_N = 0, a_Ft = 0, a_ivme = 0;
  let t_devrildi = -1;
  const Rt = new Float64Array(9), q4 = new Float64Array(4);

  while (t < t_max - 1e-12) {
    q4[0] = y[3]; q4[1] = y[4]; q4[2] = y[5]; q4[3] = y[6];
    const R = qMatris(q4, Rt);
    const egim = m.egimDeg(R);
    const wd = [R[0] * y[10] + R[1] * y[11] + R[2] * y[12],
                R[3] * y[10] + R[4] * y[11] + R[5] * y[12],
                R[6] * y[10] + R[7] * y[11] + R[8] * y[12]];
    const kuv = m.bacakKuvvetleri([y[0], y[1], y[2]], R, [y[7], y[8], y[9]], wd);

    let s_en = 0, temas = false;
    for (let i = 0; i < 3; i++) {
      if (kuv.s[i] > s_en) s_en = kuv.s[i];
      if (kuv.s[i] > 1e-6) temas = true;
      if (kuv.x[i] > x_max) x_max = kuv.x[i];
      if (kuv.Fa[i] > Fa_max) Fa_max = kuv.Fa[i];
      if (kuv.F[3 * i + 2] > N_max) N_max = kuv.F[3 * i + 2];
      const ft = Math.hypot(kuv.F[3 * i], kuv.F[3 * i + 1]);
      if (ft > Ft_max) Ft_max = ft;
    }
    if (s_en > strok_max) strok_max = s_en;
    if (egim > egim_max) egim_max = egim;
    egim_son = egim;
    const Nt = kuv.F[2] + kuv.F[5] + kuv.F[8];
    const ivme = Nt / (m.m * G);
    if (ivme > ivme_max) ivme_max = ivme;
    if (egim <= 55.0) {
      if (s_en > a_strok) a_strok = s_en;
      if (ivme > a_ivme) a_ivme = ivme;
      for (let i = 0; i < 3; i++) if (kuv.x[i] > a_x) a_x = kuv.x[i];
      for (let i = 0; i < 3; i++) {
        if (kuv.Fa[i] > a_Fa) a_Fa = kuv.Fa[i];
        if (kuv.F[3 * i + 2] > a_N) a_N = kuv.F[3 * i + 2];
        const ft = Math.hypot(kuv.F[3 * i], kuv.F[3 * i + 1]);
        if (ft > a_Ft) a_Ft = ft;
      }
    } else if (t_devrildi < 0) { t_devrildi = t; }
    if (temas && ilk_temas < 0) { ilk_temas = t; v_temas = y[9]; egim_temas = egim; }
    // Roketin HERHANGI bir parcasi zemine degdi mi? Yalnizca govde noktalarina
    // bakmak yetmiyordu: yan yatmis roket bacaklariyla ve ust plakasiyla
    // yasliyor, govde noktalari ise havada kaliyor.
    let govde_degdi = false;
    if (y[2] - m.gp_rmax <= 0) {
      const liste = m._temasListesi();
      for (let j = 0; j < liste.length; j++) {
        const p = liste[j];
        if (y[2] + (R[6] * p[0] + R[7] * p[1] + R[8] * p[2]) < 0) {
          govde_degdi = true; break;
        }
      }
    }
    const carpma_var = temas || govde_degdi;
    if (ilk_carpma < 0 && carpma_var) {
      ilk_carpma = t; v_carpma = y[9]; egim_carpma = egim;
      carpan = temas ? 'ayak' : 'govde';
    }
    if (ilk_temas >= 0 && !temas && !geri_bulundu && t > ilk_temas + 0.001) {
      v_geri = y[9]; geri_bulundu = true;
    }

    // en alcak ayagin zeminden yuksekligi (strok uygulanmamis geometrik deger)
    let h_gercek = Infinity;
    for (let i = 0; i < 3; i++) {
      const p = m.p0[i];
      const pz = R[6] * p[0] + R[7] * p[1] + R[8] * p[2];
      if (y[2] + pz < h_gercek) h_gercek = y[2] + pz;
    }

    // ---------------- kontrol (zero-order hold) ----------------
    if (itki_sis) {
      kont.guncelle(t, {
        r: [y[0], y[1], y[2]], v: [y[7], y[8], y[9]],
        w: [y[10], y[11], y[12]], R: R, temas: carpma_var, h_gercek: h_gercek,
      }, { F_tam: itki_sis.F_tam, r_lule: itki_sis.r_lule, az: itki_sis.az,
           t_acilma: itki_sis.t_acilma, t_kapanma: itki_sis.t_kapanma,
           f_pwm: itki_sis.f_pwm, valf_tipi: itki_sis.valf_tipi });
      for (let i = 0; i < 3; i++) itki_sis.komut[i] = kont.duty[i];
    }

    // ---------------- adim boyu ----------------
    // Uc kademeli adim: carpisma aninda ince (dogrulanmis 1e-4), son
    // yaklasmada orta, serbest ucusta kaba. Boylece cozum hem sim.py ile
    // ayni kaliyor hem de tarayicida anlik hesaplanacak kadar hizli.
    let dt;
    if (p.sabit_dt !== null && p.sabit_dt !== undefined) {
      dt = p.sabit_dt;
    } else {
      const h_simdi = y[2] - m.cg_yer;
      // carpisma bittikten sonra (temas + 0.35 s) artik sonumlenme var,
      // ince adima gerek kalmiyor
      const carpisma = (temas && (ilk_temas < 0 || t < ilk_temas + 0.35))
                       || h_simdi < 0.02 || egim > 25;
      dt = carpisma ? p.dt_temas : (h_simdi < 0.45 || temas ? p.dt_orta : p.dt_ucus);
    }

    // ---------------- valf + itki (adim boyunca SABIT) ----------------
    if (itki_sis) {
      itki_sis.guncelle(t, dt);
      for (let i = 0; i < 3; i++) m._Fit[i] = itki_sis.F[i];
      if (kont.doygun) doygun_sure += dt;
    }

    // ---------------- kare kaydi ----------------
    if (t >= sonraki_kare - 1e-12) {
      K.t.push(t);
      K.r.push([y[0], y[1], y[2]]);
      K.q.push([y[3], y[4], y[5], y[6]]);
      K.s.push([kuv.s[0], kuv.s[1], kuv.s[2]]);
      K.x.push([kuv.x[0], kuv.x[1], kuv.x[2]]);
      K.Fa.push([kuv.Fa[0], kuv.Fa[1], kuv.Fa[2]]);
      // bacak basina dusey tepki ve yanal surtunme (2B teknik resim paneli icin)
      K.Nb.push([kuv.F[2], kuv.F[5], kuv.F[8]]);
      K.Ftb.push([Math.hypot(kuv.F[0], kuv.F[1]), Math.hypot(kuv.F[3], kuv.F[4]),
                  Math.hypot(kuv.F[6], kuv.F[7])]);
      K.N.push(Nt);
      K.ivme.push(ivme);
      K.F.push(itki_sis ? [itki_sis.F[0], itki_sis.F[1], itki_sis.F[2]] : [0, 0, 0]);
      K.valf.push(itki_sis ? [itki_sis.valf[0], itki_sis.valf[1], itki_sis.valf[2]] : [0, 0, 0]);
      K.duty.push(itki_sis ? [kont.duty[0], kont.duty[1], kont.duty[2]] : [0, 0, 0]);
      K.P_tank.push(itki_sis ? itki_sis.P_tank / 1e5 : 0);
      K.m_gaz.push(itki_sis ? itki_sis.m_gaz : 0);
      K.egim.push(egim);
      K.vz.push(y[9]);
      K.h.push(Math.max(0, h_gercek));      // en alcak ayagin yerden yuksekligi
      K.v_hedef.push(kont.v_hedef);
      sonraki_kare += kare_dt;
    }

    // ---------------- integrasyon ----------------
    m.rk4(y, dt);
    if (itki_sis) itki_sis.gazHarca(dt);
    t += dt;
    adim++;

    if (p.t_son === null || p.t_son === undefined) {
      if (ilk_temas >= 0 && t > ilk_temas + 1.6) break;
      // Devrilme kesinlestiyse govde yere yattiktan kisa sure sonra bitir.
      // DIKKAT: roket HAVADA takla atabilir; o zaman bu kural simulasyonu
      // roket daha yere inmeden kesiyordu. Bu yuzden temas sarti da gerekli.
      // Devrilmede roket takla atip sekerek duruyor; 1,2 s yetmiyordu ve son
      // kare roketi havada yakaliyordu. 2,6 s sonunda oturmus oluyor.
      if (ilk_carpma >= 0 && t_devrildi >= 0
          && t > Math.max(t_devrildi, ilk_carpma) + 2.6) {
        break;
      }
    }
    if (adim > 500000) break;
  }

  const ozet = {
    strok_max_mm: strok_max * 1000,
    strok_orani: strok_max / m.smax,
    x_max_mm: x_max * 1000, tampon: x_max > m.xt, dur: x_max > m.xd,
    x_ayakta_mm: a_x * 1000,
    Fa_max_N: Fa_max, N_max_N: N_max, Ft_max_N: Ft_max,
    ivme_max_g: ivme_max,
    // devrilmeden onceki (gecerli) maksimumlar
    strok_ayakta_mm: a_strok * 1000, strok_ayakta_orani: a_strok / m.smax,
    Fa_ayakta_N: a_Fa, N_ayakta_N: a_N, Ft_ayakta_N: a_Ft, ivme_ayakta_g: a_ivme,
    t_devrildi: t_devrildi,
    egim_max_deg: egim_max, egim_son_deg: egim_son,
    v_geri_ms: v_geri,
    devrildi: egim_max > 55.0,
    // Bildirilen temas: roketin HERHANGI bir parcasinin zemine ilk dokundugu an
    v_temas_ms: Math.abs(ilk_carpma >= 0 ? v_carpma : v_temas),
    egim_temas_deg: ilk_carpma >= 0 ? egim_carpma : egim_temas,
    ilk_carpan: carpan,
    v_ayak_temas_ms: Math.abs(v_temas),      // yalnizca ayak temasi
    t_temas: ilk_carpma >= 0 ? ilk_carpma : ilk_temas,
    t_ayak_temas: ilk_temas, t_toplam: t, adim: adim,
    gaz_kalan_kg: itki_sis ? itki_sis.m_gaz : 0,
    gaz_baslangic_kg: itki_sis ? itki_sis.m_gaz0 : 0,
    gaz_bitti: itki_sis ? (itki_sis.m_gaz <= 1e-4) : false,
    P_son_bar: itki_sis ? itki_sis.P_tank / 1e5 : 0,
    doygun_sure: doygun_sure,
    temas_var: ilk_carpma >= 0,
    // metal duraga (strok sonundan 1 mm once) roket ayaktayken degdi mi
    dipledi: a_x > m.xd,
    lule_tasarim_N: itki_sis ? itki_sis.F_tasarim : 0,
    bogaz_mm: itki_sis ? itki_sis.d_bogaz * 1000 : 0,
    itki_agirlik: itki_sis ? 3 * itki_sis.F_tasarim / (m.m * G) : 0,
  };
  ozet.sonuc = siniflandir(ozet);
  return { kayit: K, ozet: ozet, model: m, itki: itki_sis };
}

/** Inisin sonucunu sartname ve yapisal limitlere gore siniflandirir. */
export function siniflandir(o) {
  if (!o.temas_var) {
    return { kod: 'temas_yok', ad: 'Zemine değmedi', renk: 'notr',
             not: 'Simülasyon süresi içinde zemine temas olmadı.' };
  }
  if (o.devrildi) {
    return { kod: 'devrildi', ad: 'DEVRİLDİ', renk: 'kritik',
             not: 'Roket yana yattı. Görev başarısız.' };
  }
  if (o.dipledi) {
    return { kod: 'dipledi', ad: 'METAL DURAĞA OTURDU', renk: 'kritik',
             not: 'Amortisör ve poliüretan halka darbeyi bitiremedi; itici metal durağa vurdu '
                  + '(amortisör strok sonundan 1 mm önce korunur, darbenin kalanı yapıya gider).' };
  }
  const v = o.v_temas_ms;
  if (v <= 0.2) {
    return { kod: 'basarili', ad: 'BAŞARILI YUMUŞAK İNİŞ', renk: 'iyi',
             not: 'Temas hızı şartnamenin 0–0,2 m/s sınırı içinde.' };
  }
  if (v <= 2.0) {
    return { kod: 'limit', ad: 'SERT AMA GÜVENLİ', renk: 'uyari',
             not: 'Tasarım hızı (2 m/s) içinde; yapıda kalıcı şekil değişimi beklenmez.' };
  }
  if (v <= 3.0) {
    return { kod: 'nihai', ad: 'ÇOK SERT', renk: 'kritik',
             not: 'Tasarım hızının üstünde, nihai yük (3,0 m/s) içinde: kopma yok, kalıcı eğilme olabilir.' };
  }
  return { kod: 'hasar', ad: 'HASAR BEKLENİR', renk: 'kritik',
           not: 'Temas hızı nihai tasarım yükünün üzerinde.' };
}
