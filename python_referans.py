# -*- coding: utf-8 -*-
"""
ZENITH IV - SIMULASYON / PYTHON REFERANS DEGERLERI
===================================================
Tarayicidaki JavaScript fizik motoru (fizik.js) sim.py ile AYNI sonucu
vermek zorundadir. Bu betik, dogrulama icin referans sayilari uretir.

Cikti: referans.json  ->  dogrula.mjs bunu okur ve JS sonuclariyla karsilastirir.

Kosulan testler:
  T0  STATIK DENGE   : 3 bacagin tepkisi = roket agirligi; duran roket poliuretan
                       halkaya oturur (amortisor sikismasi analitik degerle)
  T1..T8             : sim.py'nin yuk durumlari (itki = 0, saf inis)
"""
import sys, os, json
import numpy as np

HES = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "hesaplar"))
sys.path.insert(0, HES)
from sim import InisModeli            # noqa: E402
import param as P                     # noqa: E402

GEO = json.load(open(os.path.join(HES, "geometri.json"), encoding="utf-8"))
AMJ = json.load(open(os.path.join(HES, "amortisor.json"), encoding="utf-8"))
AM  = AMJ["model"]

ORTAK = dict(m=P.M_ROKET, I=P.I_ROKET, n_bacak=P.N_BACAK,
             r_ayak=P.F_U/1000.0, z_ayak=P.AYAK_TEMAS_Z/1000.0, cg_z=P.CG_Z/1000.0,
             x_s=GEO["x_s"], strok_dusey=P.DUSEY_STROK/1000.0, disa_egim=GEO["disa_egim"],
             mu=P.MU_ZEMIN, itki=0.0)

DURUMLAR = [
    ("T1  0.2 m/s  duz",                dict(v0=(0,0,-0.2), egim_deg=0.0)),
    ("T2  1.5 m/s  duz",                dict(v0=(0,0,-1.5), egim_deg=0.0)),
    ("T3  1.5 m/s  10d TEK bacak",      dict(v0=(0,0,-1.5), egim_deg=10.0, egim_yonu_deg=0.0)),
    ("T4  1.5 m/s  10d IKI bacak",      dict(v0=(0,0,-1.5), egim_deg=10.0, egim_yonu_deg=180.0)),
    ("T5  2.0 m/s + 0.5 m/s yanal",     dict(v0=(0,0,-2.0), egim_deg=0.0, vx=0.5)),
    ("T6  3.0 m/s  duz",                dict(v0=(0,0,-3.0), egim_deg=0.0)),
    ("T7  3.5 m/s  12d TEK (devrilir)", dict(v0=(0,0,-3.5), egim_deg=12.0, egim_yonu_deg=0.0)),
    ("T8  2.0 m/s  duz (tasarim)",      dict(v0=(0,0,-2.0), egim_deg=0.0)),
]

DT, TSON = 1e-4, 1.2

cikti = dict(
    aciklama="sim.py referans degerleri - fizik.js bunlari tutturmak zorunda",
    model=dict({k: (list(v) if isinstance(v, tuple) else v) for k, v in ORTAK.items()}, amort=AM),
    G=9.80665, dt=DT, t_son=TSON, testler=[])

# ----------------------------------------------------------- T0 STATIK DENGE
mt  = InisModeli(AM, **ORTAK)
kay = mt.coz(v0=(0,0,-0.01), h0=0.0005, t_son=2.0, dt=2e-4)
W   = P.M_ROKET*9.80665
N3  = float(np.sum(kay["N"][-1]))
cikti["statik"] = dict(agirlik_N=W, tepki_N=N3, hata_yuzde=abs(N3-W)/W*100.0,
                       cokme_mm=float(kay["s"][-1][0])*1000.0,
                       x_mm=float(kay["x"][-1][0])*1000.0,
                       x_analitik_mm=AMJ["x_dinlenme_mm"],
                       dt=2e-4, t_son=2.0, h0=0.0005, v0=-0.01)
print("T0 STATIK DENGE   agirlik %.2f N | tepki %.2f N | hata %.4f %%"
      % (W, N3, abs(N3-W)/W*100.0))
print("   duran roket: ayak %.2f mm yukseldi, amortisor %.3f mm sikisti (analitik %.3f mm)"
      % (kay["s"][-1][0]*1000.0, kay["x"][-1][0]*1000.0, AMJ["x_dinlenme_mm"]))
print()

# ----------------------------------------------------------- T1..T8
for ad, kw in DURUMLAR:
    m = InisModeli(AM, **ORTAK)
    o = m.ozet(m.coz(t_son=TSON, dt=DT, **kw))
    cikti["testler"].append(dict(
        ad=ad,
        girdi={k: (list(v) if isinstance(v, tuple) else v) for k, v in kw.items()},
        strok_max_mm=o["strok_max_mm"], x_max_mm=o["x_max_mm"], Fa_max_N=o["Fa_max_N"],
        N_max_N=o["N_max_N"], Ft_max_N=o["Ft_max_N"],
        ivme_max_g=o["ivme_max_g"], egim_max_deg=o["egim_max_deg"],
        egim_son_deg=o["egim_son_deg"], devrildi=o["devrildi"], dur=o["dur"]))
    print("%-34s strok %6.1f mm | x %5.2f mm | Fa %7.0f N | N %7.0f N | ivme %5.2f g | egim %5.1f d %s"
          % (ad, o["strok_max_mm"], o["x_max_mm"], o["Fa_max_N"], o["N_max_N"],
             o["ivme_max_g"], o["egim_max_deg"], "DEVRILDI" if o["devrildi"] else ""))

yol = os.path.join(os.path.dirname(os.path.abspath(__file__)), "referans.json")
json.dump(cikti, open(yol, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("\n-> %s" % yol)
