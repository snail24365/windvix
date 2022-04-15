import axios from "axios";
import { zip } from "./util";
let instance = null;

export default class WindDataManager {
  constructor() {
    if (instance != null) return instance;

    this._vx = null;
    this._vy = null;
    this._meta = null;

    instance = this;
  }

  async init() {
    const extractFirst = (x) => x.data[0];
    const extractData = (x) => x.data;

    const vxResponse = await axios.get(`u-component.json`).then(extractFirst);
    const vyResponse = (this.vy = await axios
      .get(`v-component.json`)
      .then(extractFirst));

    const header = vxResponse.header;
    const metaInfo = {
      latitudeHigh: header.la1,
      latitudeLow: header.la2,
      longitudeLow: header.lo1,
      longitudeHigh: header.lo2,
      numPoints: header.numberPoints,
      numX: header.nx,
      numY: header.ny,
      refTime: header.refTime,
      dx: header.dx,
      dy: header.dy,
      vxMax: Math.max(...vxResponse.data),
      vyMax: Math.max(...vyResponse.data),
      vxMin: Math.min(...vxResponse.data),
      vyMin: Math.min(...vyResponse.data),
    };

    this.vx = extractData(vxResponse);
    this.vy = extractData(vyResponse);

    const speeds = zip(
      this.vx.map((x) => x ** 2),
      this.vy.map((y) => y ** 2)
    ).map((arr) => (arr[0] + arr[1]) ** 0.5);

    metaInfo.maxSpeed = Math.max(...speeds);

    this.meta = metaInfo;
  }

  get vx() {
    if (this._vx === null) throw "Need Initialization";
    return this._vx;
  }

  set vx(vx) {
    this._vx = vx;
  }

  get vy() {
    if (this._vy === null) throw "Need Initialization";
    return this._vy;
  }

  set vy(vy) {
    this._vy = vy;
  }

  get meta() {
    if (this._meta === null) throw "Need Initialization";
    return this._meta;
  }

  set meta(meta) {
    this._meta = meta;
  }
}
