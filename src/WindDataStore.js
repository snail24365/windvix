import axios from "axios";
import { zip } from "./util";

const uninitializedErrorMessage = `Need to wait finishing 'initialize' method call.`;

export default class WindDataStore {
  static instance = null;

  constructor() {
    if (WindDataStore.instance != null) return WindDataStore.instance;

    this._vx = null;
    this._vy = null;
    this._meta = null;

    WindDataStore.instance = this;
  }

  async initialize() {
    const extractInfo = async (fileUrl) =>
      axios.get(fileUrl).then((x) => x.data[0]);

    const xAxisSpeedInfo = await extractInfo(`u-component.json`);
    const yAxisSpeedInfo = await extractInfo(`v-component.json`);
    const header = xAxisSpeedInfo.header;

    this._vx = xAxisSpeedInfo.data;
    this._vy = yAxisSpeedInfo.data;
    this._meta = {
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
      vxMax: Math.max(...this.vx),
      vyMax: Math.max(...this.vy),
      vxMin: Math.min(...this.vx),
      vyMin: Math.min(...this.vy),
    };

    const speeds = zip(
      this.vx.map((x) => x ** 2),
      this.vy.map((y) => y ** 2)
    ).map((arr) => (arr[0] + arr[1]) ** 0.5);

    this._meta.maxSpeed = Math.max(...speeds);
  }

  get vx() {
    if (this._vx === null) throw uninitializedErrorMessage;
    return this._vx;
  }

  set vx(vx) {
    this._vx = vx;
  }

  get vy() {
    if (this._vy === null) throw uninitializedErrorMessage;
    return this._vy;
  }

  set vy(vy) {
    this._vy = vy;
  }

  get meta() {
    if (this._meta === null) throw uninitializedErrorMessage;
    return this._meta;
  }
}
