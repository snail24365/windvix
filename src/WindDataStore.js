import axios from "axios";
import { zip } from "./util";

export default class WindDataStore {
  static instance = null;

  constructor() {
    if (WindDataStore.instance != null) return WindDataStore.instance;
    WindDataStore.instance = this;
  }

  async initialize() {
    const res = await axios.get("/wind-vector.json");
    this.data = res.data;
  }
}
