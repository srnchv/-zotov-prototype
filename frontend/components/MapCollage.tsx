// Коллаж карты на главной (десктоп, макет DEV map-collage 1740×800): геометрия слоями, четыре здания — ссылки
// на свои места в разделе «Карта». При наведении за зданием проявляется красный силуэт и подпись «Название, Город».
// Какое здание — какое место, настраивается в админке («Главная страница → Карта»). Все координаты — доли макета.
const W = 1740, H = 800;
const S3 = "https://s3.twcstorage.ru/7cba89b6-34c6-41a2-9a33-1130c8388a4d/media";
export const BUILDINGS = [
  { key: "b1", defTitle: "Дом Моссельпрома, Москва", img: `${S3}/f9e26b22/big.webp`, x: 200.79, y: 120.31, w: 467.92, h: 769.84, dx: -11, dy: -12, shadow: true, vb: "0 0 464.107 767.544",
    d: "M3.67246 763.412L0 378.722V371.377L35.3474 333.276L42.2333 331.439V289.206L74.8263 250.645L82.6303 253.4V257.99L100.074 263.04V67.4814L106.042 57.3822L114.305 59.2184L135.881 27.0844V11.9355L143.226 0L160.211 0.918114V57.3822L208.412 56.464L207.494 0H227.233L235.037 6.4268V17.9032L268.089 40.397L274.975 34.8883L284.156 40.397L282.32 250.186L318.586 265.335V228.61L327.767 223.102L394.33 258.908V304.355L443.449 328.685L452.63 330.521L458.598 328.685L464.107 329.603V756.067L324.094 763.412L249.268 767.544H225.397H138.176L100.074 765.707L3.67246 763.412Z" },
  { key: "b2", defTitle: "Хлебозавод №5, Москва", img: `${S3}/c3a72d35/big.webp`, x: 600, y: 231.9, w: 454.21, h: 431.71, dx: 12, dy: -16, shadow: false, vb: "0 0 448.642 425.845",
    d: "M0 402.525L6.09095 110.159L9.04942 107.201L14.9663 103.024L27.4963 96.9332L56.0368 87.8838L65.0862 86.8396L110.855 80.9227L134.523 78.6603L147.749 77.7902V7.13512L146.879 6.43901V1.39222L165.326 0.522082L192.474 0L228.15 0L258.779 0.696109L317.6 3.48055V79.7045L333.61 81.9669L365.109 86.1435L387.733 89.624L399.393 91.1903L411.923 95.889L427.585 101.806L438.897 106.853L444.988 111.726L448.642 404.439H427.063H399.393V422.538L88.5799 425.845V403.743H66.4784H35.1535L0 402.525Z" },
  { key: "b3", defTitle: "Дворец культуры имени А. М. Горького, Санкт-Петербург", img: `${S3}/ab104a80/big.webp`, x: 933.84, y: 488.5, w: 730.51, h: 279.93, dx: -14, dy: -18, shadow: false, vb: "0 0 730.512 279.929",
    d: "M5.39621 276.556L13.4905 83.6413L0 79.5941V72.1743L115.344 57.3348V10.7924L181.448 0L203.707 16.1886V10.7924L223.268 8.09432L225.966 10.1179L230.688 16.1886L233.386 23.6084V33.7263L240.806 38.448V41.8207L236.759 43.1697L236.084 62.731L261.716 61.3819L290.721 60.7074V57.3348L325.122 55.9857H372.339L454.631 58.0093V60.7074L503.871 64.08L502.522 36.4244L567.277 3.37263L626.635 14.8396L628.659 62.0564L705.555 74.1979L728.489 77.5706V84.9904L718.371 87.6885L730.512 275.207L232.037 279.929L5.39621 276.556Z" },
  { key: "b4", defTitle: "Городок чекистов, Екатеринбург", img: `${S3}/89aa8cff/big.webp`, x: 1179, y: 182, w: 422.78, h: 453.5, dx: 12, dy: -14, shadow: false, vb: "0 0 422.778 453.5",
    d: "M0 432.958V7.9007L27.1509 0L135.269 14.2213V25.2822L250.661 22.122L319.992 26.3357L376.233 34.2364L404.354 43.1905L418.899 52.1446L422.778 432.958L368.476 445.073L289.447 453.5H209.449H121.694L37.3324 447.706L0 432.958Z" },
];
export type Building = { key: string; placeId?: string; title: string };
const pct = (v: number, base: number) => `${(v / base) * 100}%`;
const box = (x: number, y: number, w: number, h: number) => ({ left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) });
const Circle = ({ x, y, d, fill }: { x: number; y: number; d: number; fill: string }) => <i className="mc-c" style={{ ...box(x, y, d, d), background: fill }} />;
const Shape = ({ x, y, w, h, vb, children }: { x: number; y: number; w: number; h: number; vb: string; children: React.ReactNode }) => (
  <svg className="mc-s" style={box(x, y, w, h)} viewBox={vb} preserveAspectRatio="none">{children}</svg>
);
const RED = "#f43c3a", INK = "#262626";
export default function MapCollage({ buildings }: { buildings: Building[] }) {
  const B = (key: string) => {
    const g = BUILDINGS.find((b) => b.key === key)!, info = buildings.find((b) => b.key === key);
    const href = info?.placeId ? `/map?place=${info.placeId}` : "/map";
    return (
      <a className={"mc-b" + (g.shadow ? " sh" : "")} key={key} href={href} style={box(g.x, g.y, g.w, g.h)} aria-label={info?.title || g.defTitle}>
        <svg className="mc-sil" viewBox={g.vb} preserveAspectRatio="none" style={{ left: pct(g.dx, g.w), top: pct(g.dy, g.h) }}><path d={g.d} /></svg>
        <img src={g.img} alt="" />
        <span className="mc-tip">{info?.title || g.defTitle}</span>
      </a>
    );
  };
  return (
    <div className="mcol" aria-label="Карта: конструктивистские адреса">
      <Circle x={1128} y={51} d={342} fill="#e5e5e5" />
      <Circle x={749} y={577} d={204} fill={INK} />
      <Shape x={1461.23} y={-58.31} w={199.53} h={341.13} vb="0 0 199.532 341.125"><path d="M190.766 4.81259L8.76579 336.313" stroke={RED} strokeWidth="20" /></Shape>
      {B("b4")}
      <Circle x={1549} y={467} d={160} fill={INK} />
      <Shape x={1082} y={212} w={277} h={315.76} vb="0 0 277 315.757"><rect width="19.3786" height="315.757" fill={INK} /><path d="M30.4655 0L277 99.3782L30.4655 213.663V0Z" fill={RED} /></Shape>
      <Shape x={527} y={241} w={92} h={104.87} vb="0 0 92 104.873"><rect width="6.43622" height="104.873" fill={INK} /><path d="M10.1185 0L92 33.0065L10.1185 70.964V0Z" fill={RED} /></Shape>
      <Circle x={22} y={241} d={477} fill={INK} />
      {B("b1")}
      <Shape x={378} y={449} w={535} h={425} vb="0 0 535 425"><path d="M374.357 0L511.06 10.6791L535 90.0905L226.622 425H0L374.357 0Z" fill={RED} /></Shape>
      {B("b2")}
      {B("b3")}
      <Shape x={1576.49} y={178.07} w={159.82} h={206.94} vb="0 0 159.816 206.943"><path d="M151.765 5.93121L8.05114 201.011" stroke={RED} strokeWidth="20" /></Shape>
      <Circle x={37} y={199} d={146} fill={RED} />
    </div>
  );
}
